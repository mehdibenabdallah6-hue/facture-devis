/**
 * Verify a Firebase ID token from an Authorization: Bearer ... header.
 * Returns the decoded token (with `uid`) or throws.
 *
 * Use this in every API route that performs writes on behalf of a user —
 * NEVER trust a userId passed in the request body.
 */
import { ensureFirebaseAdmin } from './_firebase-admin';

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
  try {
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (e: any) {
    const err = new Error('Invalid or expired ID token');
    (err as any).status = 401;
    throw err;
  }
}
