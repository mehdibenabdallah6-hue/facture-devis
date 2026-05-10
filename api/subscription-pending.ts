import { verifyAuth } from './_lib/auth.js';
import { ensureFirebaseAdmin } from './_lib/firebaseAdmin.js';
import {
  applyCors,
  badRequest,
  methodNotAllowed,
  ok,
  parseJsonBody,
  serverError,
  unauthorized,
} from './_lib/http.js';
import type { AppPlan, BillingCycle } from '../src/lib/billing';

const ALLOWED_PENDING_PLANS = new Set<AppPlan>(['starter', 'pro']);
const ALLOWED_BILLING_CYCLES = new Set<BillingCycle>(['monthly', 'annual']);

export default async function handler(req: any, res: any) {
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
    body = parseJsonBody(req);
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
