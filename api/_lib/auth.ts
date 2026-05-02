import { ensureFirebaseAdmin } from './firebaseAdmin.js';

export type AuthContext = { uid: string; email?: string };

export async function verifyAuth(req: any): Promise<AuthContext> {
  const header: string | undefined = req.headers?.authorization || req.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) throw httpAuthError(401, 'Missing Authorization bearer token');
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw httpAuthError(401, 'Empty bearer token');
  try {
    const { auth } = ensureFirebaseAdmin();
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    throw httpAuthError(401, 'Invalid or expired token');
  }
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

