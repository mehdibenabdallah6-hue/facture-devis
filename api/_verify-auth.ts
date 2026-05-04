/**
 * Verify a Firebase ID token from an Authorization: Bearer ... header.
 * Returns the decoded token (with `uid`) or throws.
 *
 * Use this in every API route that performs writes on behalf of a user —
 * NEVER trust a userId passed in the request body.
 */
import { ensureFirebaseAdmin } from './_firebase-admin.js';

export async function verifyAuth(req: any): Promise<{ uid: string; email?: string }> {
  const header: string | undefined = req.headers?.authorization || req.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Missing or malformed Authorization header');
    (err as any).status = 401;
    throw err;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    const err = new Error('Empty bearer token');
    (err as any).status = 401;
    throw err;
  }
  const { auth } = ensureFirebaseAdmin();
  let decoded: any;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch (e: any) {
    const err = new Error('Invalid or expired ID token');
    (err as any).status = 401;
    throw err;
  }
  assertVerifiedPasswordAccount(decoded);
  return { uid: decoded.uid, email: decoded.email };
}

function assertVerifiedPasswordAccount(decoded: any) {
  const provider = decoded?.firebase?.sign_in_provider;
  if (provider === 'password' && decoded?.email && decoded?.email_verified !== true) {
    const err = new Error('Email non vérifié. Vérifiez votre adresse email pour continuer.');
    (err as any).status = 403;
    throw err;
  }
}
