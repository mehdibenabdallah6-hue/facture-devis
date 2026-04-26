/**
 * Shared Firebase Admin initializer for Vercel API routes.
 *
 * Reads credentials from one of:
 *   - FIREBASE_SERVICE_ACCOUNT — full JSON, recommended
 *   - FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (with \n escapes)
 *
 * Returns a singleton Firestore Admin instance.
 *
 * NOTE for the founder: see docs/CONFORMITE_FACTURATION_FR.md and
 * docs/FIREBASE_RULES.md for the full set of env vars to configure on Vercel.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (rawServiceAccount) {
    try {
      return JSON.parse(rawServiceAccount);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT or the FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY trio.'
    );
  }

  return { projectId, clientEmail, privateKey };
}

export function ensureFirebaseAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(getServiceAccount()) });
  }
  return { db: getFirestore(), auth: getAdminAuth() };
}
