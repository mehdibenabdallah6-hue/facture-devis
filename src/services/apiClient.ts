import type { User } from 'firebase/auth';
import { auth } from '../firebase';
import { requiresEmailVerification } from '../lib/authVerification';

export async function callAuthenticatedApi<T = unknown>(
  user: User | null | undefined,
  path: string,
  body: unknown,
): Promise<T> {
  if (!user || requiresEmailVerification(user)) throw new Error('Email non vérifié');
  const current = auth.currentUser;
  if (!current) throw new Error('Session expirée. Veuillez vous reconnecter.');
  const token = await current.getIdToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    // ignore parse error
  }
  if (!res.ok) {
    const messageParts = [
      payload?.error,
      payload?.detail,
      payload?.code ? `code: ${payload.code}` : null,
    ].filter(Boolean);
    const err: any = new Error(messageParts.length ? messageParts.join(' — ') : `${path} a échoué (${res.status})`);
    err.status = res.status;
    err.code = payload?.code;
    err.detail = payload?.detail;
    err.payload = payload;
    throw err;
  }
  return payload as T;
}
