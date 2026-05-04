import { ensureFirebaseAdmin } from './firebaseAdmin.js';

export type AuthContext = { uid: string; email?: string };

export async function verifyAuth(req: any): Promise<AuthContext> {
  const header: string | undefined = req.headers?.authorization || req.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) throw httpAuthError(401, 'Missing Authorization bearer token');
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw httpAuthError(401, 'Empty bearer token');
  let decoded: any;
  try {
    const { auth } = ensureFirebaseAdmin();
    decoded = await auth.verifyIdToken(token);
  } catch {
    throw httpAuthError(401, 'Invalid or expired token');
  }
  assertVerifiedPasswordAccount(decoded);
  return { uid: decoded.uid, email: decoded.email };
}

export const requireAuth = verifyAuth;

export async function getCompanyForUser(uid: string, companyId = uid) {
  if (companyId !== uid) throw httpAuthError(403, 'Forbidden company');
  const { db } = ensureFirebaseAdmin();
  const snap = await db.collection('companies').doc(companyId).get();
  return snap.exists ? { id: companyId, data: snap.data() as any } : { id: companyId, data: null };
}

export async function requireCompanyOwner(companyId: string, uid: string) {
  if (companyId !== uid) throw httpAuthError(403, 'Forbidden company');
  return getCompanyForUser(uid, companyId);
}

function httpAuthError(status: number, message: string) {
  const error = new Error(message);
  (error as any).status = status;
  return error;
}

function assertVerifiedPasswordAccount(decoded: any) {
  const provider = decoded?.firebase?.sign_in_provider;
  if (provider === 'password' && decoded?.email && decoded?.email_verified !== true) {
    throw httpAuthError(403, 'Email non vérifié. Vérifiez votre adresse email pour continuer.');
  }
}
