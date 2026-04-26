/**
 * Append an audit-trail event for an invoice — Vercel Serverless Function.
 *
 * POST /api/invoice-event
 * Body: { invoiceId: string, type: EventType, metadata?: Record<string, any> }
 *
 * Why server-side:
 *   The audit trail must not be writable directly by the client (Firestore
 *   rules below deny all client writes to /invoiceEvents). The client posts
 *   to this endpoint, the server verifies the user owns the invoice and
 *   appends the event with a server-side timestamp.
 */

import { ensureFirebaseAdmin } from './_firebase-admin';
import { verifyAuth } from './_verify-auth';

const ALLOWED_TYPES = new Set([
  'create',
  'update',
  'validate',
  'send',
  'mark_paid',
  'mark_unpaid',
  'cancel',
  'credit_note_created',
  'export_pdf',
  'export_facturx',
  'pdp_send',
  'pdp_status_update',
  'view',
  'sign',
]);

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
  const type: string | undefined = body.type;
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

  if (!invoiceId || !type) {
    res.status(400).json({ error: 'invoiceId and type are required' });
    return;
  }
  if (!ALLOWED_TYPES.has(type)) {
    res.status(400).json({ error: `Unknown event type: ${type}` });
    return;
  }

  const { db } = ensureFirebaseAdmin();

  try {
    const invoiceSnap = await db.collection('invoices').doc(invoiceId).get();
    if (!invoiceSnap.exists) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    const invoice = invoiceSnap.data() as any;
    if (invoice.ownerId !== uid) {
      res.status(403).json({ error: 'Not your invoice' });
      return;
    }

    const nowIso = new Date().toISOString();
    const eventRef = await db.collection('invoiceEvents').add({
      invoiceId,
      ownerId: uid,
      type,
      actorId: uid,
      timestamp: nowIso,
      metadata: pruneMetadata(metadata),
    });

    res.status(200).json({ ok: true, eventId: eventRef.id });
  } catch (e: any) {
    console.error('invoice-event error:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
}

// Drop anything we don't want to risk persisting (passwords, tokens, etc.).
// Cap key length and value length defensively.
function pruneMetadata(meta: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  let keys = 0;
  for (const k of Object.keys(meta)) {
    if (keys >= 20) break;
    if (/password|secret|token|api[_-]?key/i.test(k)) continue;
    const v = meta[k];
    if (v == null) continue;
    if (typeof v === 'string') {
      out[k] = v.slice(0, 500);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 20);
    } else if (typeof v === 'object') {
      out[k] = JSON.parse(JSON.stringify(v).slice(0, 2000));
    }
    keys++;
  }
  return out;
}
