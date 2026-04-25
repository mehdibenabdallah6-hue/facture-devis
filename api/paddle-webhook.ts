import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

type PaddleEvent = {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: {
    id?: string;
    status?: string;
    items?: Array<{ price?: { id?: string } }>;
    custom_data?: {
      userId?: string;
      planId?: 'starter' | 'pro';
      billingCycle?: 'monthly' | 'annual';
    };
  };
};

function getRawBody(req: any): string {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body ?? {});
}

function parseSignatureHeader(signatureHeader: string): { timestamp: string | null; signatures: string[] } {
  const parts = signatureHeader.split(';').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('ts='))?.slice(3) ?? null;
  const signatures = parts
    .filter((part) => part.startsWith('h1='))
    .map((part) => part.slice(3))
    .filter(Boolean);

  return { timestamp, signatures };
}

function verifyPaddleSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;

  const payload = `${timestamp}:${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

  return signatures.some((signature) => {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(signature, 'hex');
    return (
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  });
}

function getFirebaseServiceAccount() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (rawServiceAccount) {
    return JSON.parse(rawServiceAccount);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials');
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function ensureFirebaseAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(getFirebaseServiceAccount()),
    });
  }

  return getFirestore();
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing PADDLE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Configuration webhook Paddle manquante.' });
  }

  const signatureHeader = req.headers['paddle-signature'];
  if (typeof signatureHeader !== 'string' || !signatureHeader) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const rawBody = getRawBody(req);
  if (!verifyPaddleSignature(rawBody, signatureHeader, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const event = JSON.parse(rawBody) as PaddleEvent;
    const eventType = event.event_type;
    const data = event.data;

    if (!eventType || !data) {
      return res.status(400).json({ error: 'Invalid event payload' });
    }

    if (!eventType.startsWith('subscription.')) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const db = ensureFirebaseAdmin();
    const userId = data.custom_data?.userId;

    if (!userId) {
      console.warn('[Paddle Webhook] userId absent dans custom_data');
      return res.status(200).json({ received: true, warning: 'No userId' });
    }

    const companyRef = db.collection('companies').doc(userId);
    const companySnap = await companyRef.get();
    const company = companySnap.exists ? companySnap.data() : {};
    const incomingOccurredAt = event.occurred_at || new Date().toISOString();
    const lastEventAt = company?.paddleLastEventAt;

    if (lastEventAt && new Date(incomingOccurredAt) < new Date(lastEventAt)) {
      return res.status(200).json({ received: true, ignored: 'stale_event' });
    }

    const planId = data.custom_data?.planId || company?.pendingPlan || company?.plan || 'starter';
    const billingCycle =
      data.custom_data?.billingCycle || company?.pendingBillingCycle || company?.billingCycle || null;
    const priceId = data.items?.[0]?.price?.id || company?.paddlePriceId || null;
    const normalizedStatus = normalizeStatus(
      eventType === 'subscription.canceled' ? 'canceled' : data.status,
    );

    await companyRef.set(
      {
        plan: planId,
        billingCycle,
        subscriptionStatus: normalizedStatus,
        pendingPlan: null,
        pendingBillingCycle: null,
        paddleSubscriptionId: data.id || company?.paddleSubscriptionId || null,
        paddlePriceId: priceId,
        paddleLastEventAt: incomingOccurredAt,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    console.log(
      `[Paddle Webhook] ${eventType} -> ${userId} (${planId}, ${normalizedStatus})`,
    );

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}
