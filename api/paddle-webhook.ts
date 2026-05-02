import * as crypto from 'crypto';
import { ensureFirebaseAdmin } from './_lib/firebaseAdmin.js';
import { methodNotAllowed, ok, serverError, unauthorized } from './_lib/http.js';
import { verifyPaddleSignature } from './_lib/paddle.js';
import { planFromPriceId } from './_lib/billing.js';

type PaddleEvent = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: {
    id?: string;
    status?: string;
    customer_id?: string;
    items?: Array<{ price?: { id?: string } }>;
    custom_data?: {
      userId?: string;
      billingCycle?: 'monthly' | 'annual';
    };
  };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing PADDLE_WEBHOOK_SECRET');
    return serverError(res, new Error('PADDLE_WEBHOOK_SECRET missing'));
  }

  const rawBody = await getRawBody(req);
  const signatureHeader = req.headers['paddle-signature'];
  if (typeof signatureHeader !== 'string' || !signatureHeader) {
    return unauthorized(res, 'Signature Paddle manquante.');
  }
  if (!verifyPaddleSignature(rawBody, signatureHeader, secret)) {
    return unauthorized(res, 'Signature Paddle invalide ou expirée.');
  }

  try {
    const event = JSON.parse(rawBody) as PaddleEvent;
    const eventType = event.event_type || '';
    const data = event.data;
    const eventId = event.event_id || crypto.createHash('sha256').update(rawBody).digest('hex');
    const occurredAt = event.occurred_at || new Date().toISOString();

    if (!eventType || !data) return res.status(400).json({ error: 'Payload Paddle invalide.' });

    const { db } = ensureFirebaseAdmin();
    const eventRef = db.collection('paddleEvents').doc(eventId);

    if (!eventType.startsWith('subscription.')) {
      await eventRef.set({
        eventId,
        eventType,
        ignored: true,
        receivedAt: new Date().toISOString(),
      }, { merge: true });
      return ok(res, { received: true, ignored: true });
    }

    const userId = data.custom_data?.userId;
    if (!userId) {
      await eventRef.set({
        eventId,
        eventType,
        ignored: true,
        reason: 'missing_user_id',
        receivedAt: new Date().toISOString(),
      }, { merge: true });
      return ok(res, { received: true, warning: 'No userId' });
    }

    const priceId = data.items?.[0]?.price?.id || null;
    const plan = planFromPriceId(priceId);
    const normalizedStatus = normalizeStatus(
      eventType === 'subscription.canceled' ? 'canceled' : data.status,
    );
    const billingCycle = data.custom_data?.billingCycle || inferBillingCycle(priceId);
    const nowIso = new Date().toISOString();

    const result = await db.runTransaction(async tx => {
      const existingEvent = await tx.get(eventRef);
      if (existingEvent.exists) return { duplicate: true };

      const companyRef = db.collection('companies').doc(userId);
      const companySnap = await tx.get(companyRef);
      const company = companySnap.exists ? (companySnap.data() as any) : {};
      const lastEventAt = company?.paddleLastEventAt;

      tx.set(eventRef, {
        eventId,
        eventType,
        userId,
        paddleSubscriptionId: data.id || null,
        priceId,
        receivedAt: nowIso,
        occurredAt,
      });

      if (lastEventAt && new Date(occurredAt) < new Date(lastEventAt)) {
        return { duplicate: false, stale: true };
      }

      tx.set(companyRef, {
        plan,
        billingCycle,
        subscriptionStatus: normalizedStatus,
        pendingPlan: null,
        pendingBillingCycle: null,
        paddleCustomerId: data.customer_id || company?.paddleCustomerId || null,
        paddleSubscriptionId: data.id || company?.paddleSubscriptionId || null,
        paddlePriceId: priceId,
        paddleLastEventAt: occurredAt,
        updatedAt: nowIso,
      }, { merge: true });

      tx.set(db.collection('invoiceEvents').doc(), {
        invoiceId: userId,
        companyId: userId,
        ownerId: userId,
        actorId: 'paddle:webhook',
        type: auditTypeFor(eventType, normalizedStatus),
        resourceType: 'subscription',
        resourceId: data.id || eventId,
        timestamp: nowIso,
        metadata: {
          eventId,
          eventType,
          priceId: priceId || '',
          plan,
          status: normalizedStatus,
        },
      });

      return { duplicate: false, stale: false };
    });

    return ok(res, { received: true, ...result });
  } catch (error) {
    return serverError(res, error);
  }
}

function normalizeStatus(status?: string): string {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'paused':
    case 'canceled':
      return status;
    default:
      return 'expired';
  }
}

function auditTypeFor(eventType: string, status: string) {
  if (eventType === 'subscription.created') return 'subscription_created';
  if (eventType === 'subscription.canceled' || status === 'canceled') return 'subscription_cancelled';
  if (eventType === 'subscription.payment_failed') return 'payment_failed';
  return 'subscription_updated';
}

function inferBillingCycle(priceId: string | null): 'monthly' | 'annual' | null {
  if (!priceId) return null;
  return /annual|year/i.test(priceId) ? 'annual' : 'monthly';
}

async function getRawBody(req: any): Promise<string> {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
