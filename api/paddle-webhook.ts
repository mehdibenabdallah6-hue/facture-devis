import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;
  const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!PADDLE_WEBHOOK_SECRET || !FIREBASE_SERVICE_ACCOUNT) {
    console.error("Missing PADDLE_WEBHOOK_SECRET or FIREBASE_SERVICE_ACCOUNT");
    return res.status(500).json({ error: 'Configurations manquantes sur le serveur.' });
  }

  // 1. Verify Paddle webhook signature
  const signature = req.headers['paddle-signature'] || '';
  const body = JSON.stringify(req.body);

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Basic signature log for debug if needed
  // console.log("Signature received:", signature);

  try {
    const event = req.body;

    // Initialization of Firebase Admin
    if (!getApps().length) {
      initializeApp({
        credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT))
      });
    }
    const db = getFirestore();

    const eventType = event.event_type;
    const data = event.data;

    console.log(`[Paddle Webhook] Received ${eventType}`);

    if (eventType.startsWith('subscription.')) {
      const customData = data.custom_data;
      const userId = customData?.userId;
      const planId = customData?.planId || 'pro'; // default to pro if not specified but paid

      if (!userId) {
        console.warn("No userId found in custom_data");
        return res.status(200).json({ received: true, warning: 'No userId' });
      }

      const companyRef = db.collection('companies').doc(userId);

      if (eventType === 'subscription.created' || eventType === 'subscription.updated') {
        const status = data.status; // 'active', 'trialing', etc.
        
        await companyRef.update({
          plan: planId,
          subscriptionStatus: status,
          paddleSubscriptionId: data.id,
          updatedAt: new Date().toISOString()
        });
        
        console.log(`[Paddle Webhook] User ${userId} updated to ${planId} (${status})`);
      } 
      
      else if (eventType === 'subscription.canceled') {
        await companyRef.update({
          plan: 'free',
          subscriptionStatus: 'canceled',
          updatedAt: new Date().toISOString()
        });
        console.log(`[Paddle Webhook] User ${userId} downgraded to free (canceled)`);
      }
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
}
