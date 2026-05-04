import { ensureFirebaseAdmin } from '../_firebase-admin.js';

export type AdminUser = {
  uid: string;
};

export async function requireAdmin(req: any): Promise<AdminUser> {
  const header: string | undefined = req.headers?.authorization || req.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw httpError(401, 'Non authentifié');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw httpError(401, 'Non authentifié');
  }

  const { auth } = ensureFirebaseAdmin();
  let decoded: any;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    throw httpError(401, 'Session invalide ou expirée');
  }

  if (decoded?.admin !== true) {
    throw httpError(403, 'Accès admin requis');
  }
  const provider = decoded?.firebase?.sign_in_provider;
  if (provider === 'password' && decoded?.email && decoded?.email_verified !== true) {
    throw httpError(403, 'Email non vérifié. Vérifiez votre adresse email pour continuer.');
  }

  return { uid: decoded.uid };
}

export function handleAdminAuthError(res: any, error: any) {
  const status = error?.status === 403 ? 403 : 401;
  return res.status(status).json({ error: error?.message || (status === 403 ? 'Accès refusé' : 'Non authentifié') });
}

function httpError(status: 401 | 403, message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}
