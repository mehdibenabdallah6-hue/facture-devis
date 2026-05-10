import { verifyAuth } from './auth.js';
import { ensureFirebaseAdmin } from './firebaseAdmin.js';
import {
  applyCors,
  badRequest,
  methodNotAllowed,
  ok,
  serverError,
  unauthorized,
} from './http.js';
import type { AppPlan, BillingCycle } from '../../shared/billing';

const ALLOWED_PENDING_PLANS = new Set<AppPlan>(['starter', 'pro']);
const ALLOWED_BILLING_CYCLES = new Set<BillingCycle>(['monthly', 'annual']);

export async function handleSubscriptionPending(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return methodNotAllowed(res);

  let authCtx;
  try {
    authCtx = await verifyAuth(req);
  } catch (error: any) {
    return unauthorized(res, error?.message || 'Authentification requise.');
  }

  let body: any;
  try {
    body = await parseJsonRequest(req);
  } catch {
    return badRequest(res, 'JSON invalide.');
  }

  const pendingPlan = body?.pendingPlan;
  const billingCycle = body?.billingCycle;

  if (!ALLOWED_PENDING_PLANS.has(pendingPlan)) {
    return badRequest(res, 'Plan en attente invalide.');
  }
  if (!ALLOWED_BILLING_CYCLES.has(billingCycle)) {
    return badRequest(res, 'Cycle de facturation invalide.');
  }

  try {
    const { db } = ensureFirebaseAdmin();
    const updatedAt = new Date().toISOString();
    await db.collection('companies').doc(authCtx.uid).set({
      subscriptionStatus: 'pending_activation',
      pendingPlan,
      pendingBillingCycle: billingCycle,
      updatedAt,
    }, { merge: true });

    return ok(res, {
      ok: true,
      subscriptionStatus: 'pending_activation',
      pendingPlan,
      pendingBillingCycle: billingCycle,
      updatedAt,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

async function parseJsonRequest(req: any) {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}');

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
