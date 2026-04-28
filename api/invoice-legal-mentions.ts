/**
 * Server-side legal-mentions patch for draft invoices.
 *
 * The validation modal can append mandatory French legal mentions to
 * `invoice.notes`. Doing it directly from the browser can be rejected by
 * Firestore rules depending on the invoice state/shape, so this endpoint keeps
 * the write authoritative while preserving the same ownership and lock checks.
 */
import { ensureFirebaseAdmin } from './_firebase-admin';
import { verifyAuth } from './_verify-auth';

const MAX_NOTES_LENGTH = 4000;

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

  let body: any = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e: any) {
      res.status(400).json({ error: 'Invalid JSON body', detail: e.message });
      return;
    }
  }
  body = body || {};

  const invoiceId = body.invoiceId;
  const notes = body.notes;
  if (!invoiceId || typeof invoiceId !== 'string') {
    res.status(400).json({ error: 'invoiceId is required' });
    return;
  }
  if (typeof notes !== 'string') {
    res.status(400).json({ error: 'notes must be a string' });
    return;
  }
  if (notes.length > MAX_NOTES_LENGTH) {
    res.status(400).json({ error: `Les mentions dépassent ${MAX_NOTES_LENGTH} caractères.` });
    return;
  }

  let db: ReturnType<typeof ensureFirebaseAdmin>['db'];
  try {
    ({ db } = ensureFirebaseAdmin());
  } catch (e: any) {
    console.error('invoice-legal-mentions: Firebase Admin init failed:', e);
    res.status(500).json({
      error: 'Firebase Admin not configured on the server.',
      detail: e?.message,
    });
    return;
  }

  try {
    const invoiceRef = db.collection('invoices').doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    if (!invoiceSnap.exists) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const invoice = invoiceSnap.data() as any;
    if (invoice.ownerId !== uid) {
      res.status(403).json({ error: 'Not your invoice' });
      return;
    }
    if (invoice.isLocked === true) {
      res.status(409).json({
        error: 'Cette facture est déjà validée. Pour corriger ses mentions, créez un avoir.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    await invoiceRef.update({
      notes,
      updatedAt: nowIso,
    });

    await db.collection('invoiceEvents').add({
      invoiceId,
      ownerId: uid,
      type: 'update',
      actorId: uid,
      timestamp: nowIso,
      metadata: {
        fields: ['notes'],
        source: 'legal_mentions_autofix',
      },
    });

    res.status(200).json({ ok: true, notes });
  } catch (e: any) {
    console.error('invoice-legal-mentions error:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
}
