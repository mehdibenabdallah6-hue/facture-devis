/**
 * Create a credit note (avoir) from a validated invoice — Vercel Serverless Function.
 *
 * POST /api/invoice-credit-note
 * Body: { invoiceId: string, reason?: string }
 *
 * What it does:
 *   1. Verifies caller's Firebase ID token.
 *   2. Loads the source invoice. It MUST be `isLocked === true` (validated).
 *   3. Creates a new invoice document with:
 *        - type: 'credit'
 *        - items: same lines but quantity inverted (negative)
 *        - linkedInvoiceId: <source invoice id>
 *        - linkedInvoiceNumber: <source invoice number>
 *        - status: 'validated', isLocked: true
 *        - number: assigned atomically from the credit-note sequence
 *   4. Marks the source invoice with `creditedBy` so the link is bidirectional.
 *   5. Logs an `invoiceEvents` "credit_note_created" entry.
 *
 * Why server-side:
 *   Same reason as invoice-validate — the credit-note number must be unique
 *   and continuous within its own sequence, and the link to the source invoice
 *   must be authoritative. Doing it client-side would let users skip the lock.
 */

import { ensureFirebaseAdmin } from './_firebase-admin.js';
import { verifyAuth } from './_verify-auth.js';

function buildNumber(prefix: string, year: number, n: number): string {
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let uid: string;
  try {
    ({ uid } = await verifyAuth(req));
  } catch (e: any) {
    res.status(e.status || 401).json({ error: e.message || 'Unauthorized' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const invoiceId: string | undefined = body.invoiceId;
  const reason: string = (body.reason || '').toString().slice(0, 500);
  if (!invoiceId || typeof invoiceId !== 'string') {
    res.status(400).json({ error: 'invoiceId is required' });
    return;
  }

  const { db } = ensureFirebaseAdmin();

  try {
    const result = await db.runTransaction(async (tx) => {
      const sourceRef = db.collection('invoices').doc(invoiceId);
      const sourceSnap = await tx.get(sourceRef);
      if (!sourceSnap.exists) throw httpError(404, 'Source invoice not found');

      const source = sourceSnap.data() as any;
      if (source.ownerId !== uid) throw httpError(403, 'Not your invoice');

      // Only validated invoices can be credited — French practice: avoirs target
      // a real, issued invoice, not a draft.
      if (source.isLocked !== true || source.type !== 'invoice') {
        throw httpError(400, 'Credit notes can only be issued for validated invoices');
      }
      if (source.creditedBy) {
        return {
          creditNoteId: source.creditedBy,
          number: source.creditedByNumber || null,
          alreadyExists: true,
        };
      }

      const companyRef = db.collection('companies').doc(uid);
      const companySnap = await tx.get(companyRef);
      const company = companySnap.exists ? (companySnap.data() as any) : {};

      const issueDate = new Date();
      const year = issueDate.getFullYear();
      const counterRef = companyRef.collection('counters').doc(`credit-${year}`);
      const counterSnap = await tx.get(counterRef);
      const previousValue = counterSnap.exists ? (counterSnap.data() as any).value || 0 : 0;
      const nextValue = previousValue + 1;
      const number = buildNumber('AV', year, nextValue);

      // Inverted lines — quantities negative so totals come out negative.
      const invertedItems = (source.items || []).map((it: any) => ({
        description: it.description || '',
        quantity: -Math.abs(Number(it.quantity) || 0),
        unitPrice: Number(it.unitPrice) || 0,
        vatRate: Number(it.vatRate) || 0,
      }));

      // Recompute totals from inverted lines so we don't rely on client math.
      let totalHT = 0;
      let totalVAT = 0;
      for (const it of invertedItems) {
        const lineHT = it.quantity * it.unitPrice;
        totalHT += lineHT;
        totalVAT += lineHT * (it.vatRate / 100);
      }
      // Round to 2 decimals
      totalHT = Math.round(totalHT * 100) / 100;
      totalVAT = Math.round(totalVAT * 100) / 100;
      const totalTTC = Math.round((totalHT + totalVAT) * 100) / 100;

      const nowIso = issueDate.toISOString();

      const creditRef = db.collection('invoices').doc(); // auto-id
      tx.set(creditRef, {
        ownerId: uid,
        type: 'credit',
        clientId: source.clientId || '',
        clientName: source.clientName || '',
        clientEmail: source.clientEmail || '',
        number,
        date: nowIso.slice(0, 10),
        dueDate: nowIso.slice(0, 10),
        serviceDate: source.serviceDate || nowIso.slice(0, 10),
        status: 'validated',
        isLocked: true,
        validatedAt: nowIso,
        validatedBy: uid,
        vatRegime: source.vatRegime || 'standard',
        items: invertedItems,
        totalHT,
        totalVAT,
        totalTTC,
        notes: reason ? `Avoir suite à : ${reason}` : `Avoir sur facture ${source.number}`,
        linkedInvoiceId: invoiceId,
        linkedInvoiceNumber: source.number,
        creditNoteFor: invoiceId,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      tx.update(sourceRef, {
        creditedBy: creditRef.id,
        creditedByNumber: number,
        creditedAt: nowIso,
        updatedAt: nowIso,
      });

      tx.set(counterRef, {
        type: 'credit',
        year,
        value: nextValue,
        updatedAt: nowIso,
      }, { merge: true });

      const eventRef = db.collection('invoiceEvents').doc();
      tx.set(eventRef, {
        invoiceId: creditRef.id,
        ownerId: uid,
        type: 'credit_note_created',
        actorId: uid,
        timestamp: nowIso,
        metadata: {
          sourceInvoiceId: invoiceId,
          sourceInvoiceNumber: source.number,
          assignedNumber: number,
          reason: reason || null,
        },
      });

      return { creditNoteId: creditRef.id, number };
    });

    res.status(200).json({ ok: true, ...result });
  } catch (e: any) {
    const status = e.status || 500;
    console.error('invoice-credit-note error:', e);
    res.status(status).json({ error: e.message || 'Server error' });
  }
}

function httpError(status: number, message: string): Error {
  const e = new Error(message);
  (e as any).status = status;
  return e;
}
