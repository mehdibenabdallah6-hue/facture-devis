import { FieldValue } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './firebaseAdmin.js';

export async function writeAuditEvent(input: {
  companyId?: string;
  ownerId: string;
  actorUid: string;
  type: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, any>;
}) {
  const { db } = ensureFirebaseAdmin();
  await db.collection('invoiceEvents').add({
    invoiceId: input.resourceType === 'invoice' ? input.resourceId : input.metadata?.invoiceId || input.resourceId,
    companyId: input.companyId || input.ownerId,
    ownerId: input.ownerId,
    actorId: input.actorUid,
    type: input.type,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    timestamp: new Date().toISOString(),
    serverTimestamp: FieldValue.serverTimestamp(),
    metadata: prune(input.metadata || {}),
  });
}

function prune(meta: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const key of Object.keys(meta).slice(0, 20)) {
    if (/secret|token|password|api[_-]?key|signatureData/i.test(key)) continue;
    const value = meta[key];
    if (value == null) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 500);
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
    else out[key] = JSON.stringify(value).slice(0, 1000);
  }
  return out;
}

