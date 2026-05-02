import { Timestamp } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './firebaseAdmin.js';

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const { db } = ensureFirebaseAdmin();
  const safeKey = key.replace(/[^\w:.-]/g, '_').slice(0, 180);
  const ref = db.collection('rateLimits').doc(safeKey);
  const now = Date.now();
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as any) : {};
    const resetAt = data.resetAt?.toMillis?.() ?? 0;
    const count = resetAt > now ? Number(data.count || 0) : 0;
    if (count >= limit) {
      return { ok: false as const, retryAfterMs: Math.max(0, resetAt - now) };
    }
    tx.set(ref, {
      count: count + 1,
      resetAt: Timestamp.fromMillis(now + windowMs),
      updatedAt: new Date(now).toISOString(),
    }, { merge: true });
    return { ok: true as const };
  });
}

export function getClientIp(req: any): string {
  const raw = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  return String(raw).split(',')[0].trim().slice(0, 80);
}

