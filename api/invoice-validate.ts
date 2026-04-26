/**
 * Server-side invoice validation + numbering — Vercel Serverless Function
 *
 * POST /api/invoice-validate
 * Body: { invoiceId: string }
 *
 * Why this exists:
 *   French law (Article L441-3 Code de commerce, Article 242 nonies A annexe II
 *   au CGI) requires invoice numbers to be unique, chronological, and continuous.
 *   Generating them client-side as the previous code did allows races, gaps,
 *   and tampering. This endpoint:
 *
 *   1. Verifies the caller's Firebase ID token (no spoofing the user).
 *   2. Atomically increments a per-company / per-type / per-year counter using
 *      a Firestore transaction so concurrent validations cannot collide.
 *   3. Stamps the invoice with the assigned `number`, `status='validated'`,
 *      `validatedAt`, `validatedBy`, and `isLocked=true`.
 *   4. Writes an `invoiceEvents` record so the audit trail is server-authoritative.
 *
 * Counter location:
 *   companies/{ownerId}/counters/{type}-{year}  →  { value: number, updatedAt }
 *
 * Number formats:
 *   invoice  →  {invoicePrefix||'F'}-{YYYY}-{NNN}
 *   quote    →  D-{YYYY}-{NNN}
 *   credit   →  AV-{YYYY}-{NNN}
 *   deposit  →  AC-{YYYY}-{NNN}   (acompte)
 *
 * Important: this endpoint never assigns a number to a draft. The number is
 * only assigned at validation time. This protects the legal sequence even
 * if a draft is later deleted.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './_firebase-admin';
import { verifyAuth } from './_verify-auth';

type InvoiceType = 'invoice' | 'quote' | 'deposit' | 'credit';

const PREFIX_FALLBACK: Record<InvoiceType, string> = {
  invoice: 'F',
  quote: 'D',
  credit: 'AV',
  deposit: 'AC',
};

function buildNumber(prefix: string, year: number, n: number): string {
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
}

function pickPrefix(type: InvoiceType, companyInvoicePrefix?: string): string {
  if (type === 'invoice' && companyInvoicePrefix && companyInvoicePrefix.length <= 8) {
    return companyInvoicePrefix.toUpperCase();
  }
  return PREFIX_FALLBACK[type];
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 1. Auth
  let uid: string;
  try {
    ({ uid } = await verifyAuth(req));
  } catch (e: any) {
    res.status(e.status || 401).json({ error: e.message || 'Unauthorized' });
    return;
  }

  // 2. Body
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const invoiceId: string | undefined = body.invoiceId;
  if (!invoiceId || typeof invoiceId !== 'string') {
    res.status(400).json({ error: 'invoiceId is required' });
    return;
  }

  const { db } = ensureFirebaseAdmin();
  const invoiceRef = db.collection('invoices').doc(invoiceId);
  const companyRef = db.collection('companies').doc(uid);
  const eventsRef = db.collection('invoiceEvents');

  try {
    const result = await db.runTransaction(async (tx) => {
      // Reads MUST happen before writes inside a transaction.
      const invoiceSnap = await tx.get(invoiceRef);
      if (!invoiceSnap.exists) throw httpError(404, 'Invoice not found');

      const invoice = invoiceSnap.data() as any;
      if (invoice.ownerId !== uid) throw httpError(403, 'Not your invoice');

      // Idempotency: if already validated, return its existing number rather than re-numbering.
      if (invoice.isLocked === true && invoice.number) {
        return { number: invoice.number, alreadyValidated: true };
      }

      const type: InvoiceType = (invoice.type as InvoiceType) || 'invoice';
      if (!['invoice', 'quote', 'deposit', 'credit'].includes(type)) {
        throw httpError(400, `Invalid invoice type: ${type}`);
      }

      // Pull company for the prefix.
      const companySnap = await tx.get(companyRef);
      const company = companySnap.exists ? (companySnap.data() as any) : {};

      // Counter doc — one per (company, type, year) for strict legal continuity.
      // Quote sequences and credit-note sequences are independent of invoice
      // sequences per French practice: gaps in the invoice sequence are
      // suspicious to URSSAF/DGFIP, but quotes/avoirs follow their own series.
      const issueDate = invoice.date ? new Date(invoice.date) : new Date();
      const year = isNaN(issueDate.getTime()) ? new Date().getFullYear() : issueDate.getFullYear();
      const counterId = `${type}-${year}`;
      const counterRef = companyRef.collection('counters').doc(counterId);
      const counterSnap = await tx.get(counterRef);
      const previousValue = counterSnap.exists ? (counterSnap.data() as any).value || 0 : 0;
      const nextValue = previousValue + 1;

      const prefix = pickPrefix(type, company.invoicePrefix);
      const number = buildNumber(prefix, year, nextValue);

      const now = Timestamp.now();
      const nowIso = now.toDate().toISOString();

      // Writes
      tx.set(counterRef, {
        type,
        year,
        value: nextValue,
        updatedAt: nowIso,
      }, { merge: true });

      tx.update(invoiceRef, {
        number,
        status: 'validated',
        isLocked: true,
        validatedAt: nowIso,
        validatedBy: uid,
        updatedAt: nowIso,
      });

      // Audit trail event — created in same transaction so the invoice cannot
      // be validated without a corresponding event. This is the server-side
      // record of truth; client UI is read-only.
      const eventRef = eventsRef.doc();
      tx.set(eventRef, {
        invoiceId,
        ownerId: uid,
        type: 'validate',
        actorId: uid,
        timestamp: nowIso,
        metadata: {
          assignedNumber: number,
          previousNumber: invoice.number || null,
          counterId,
          counterValue: nextValue,
        },
      });

      return { number, alreadyValidated: false };
    });

    res.status(200).json({ ok: true, ...result });
  } catch (e: any) {
    const status = e.status || 500;
    console.error('invoice-validate error:', e);
    res.status(status).json({ error: e.message || 'Server error' });
  }
}

function httpError(status: number, message: string): Error {
  const e = new Error(message);
  (e as any).status = status;
  return e;
}
