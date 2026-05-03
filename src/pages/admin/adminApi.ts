import { auth } from '../../firebase';

export async function fetchAdminApi<T>(path: string): Promise<T> {
  const current = auth.currentUser;
  if (!current) throw new Error('Non authentifié');
  const token = await current.getIdToken();
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Erreur admin (${response.status})`);
  }
  return payload as T;
}
