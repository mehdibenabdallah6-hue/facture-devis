import { useEffect, useState } from 'react';
import { AdminCard, AdminShell } from './AdminShell';
import { fetchAdminApi } from './adminApi';

type AdminUserRow = {
  userKey: string;
  createdMonth: string;
  plan: string;
  subscriptionStatus: string;
  profession: string;
  invoiceUsageBucket: string;
  aiUsageBucket: string;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminApi<{ ok: true; users: AdminUserRow[] }>('/api/admin-users')
      .then(data => setUsers(data.users || []))
      .catch(err => setError(err.message || 'Erreur admin'));
  }, []);

  return (
    <AdminShell
      title="Utilisateurs"
      subtitle="Vue anonymisée par clé hashée. Pas d’email, pas de SIRET, pas d’adresse, pas de client final."
    >
      {error && <AdminCard className="border-error/30 text-error">{error}</AdminCard>}
      {!error && (
        <AdminCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface-container text-left text-xs uppercase tracking-widest text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Créé</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Abonnement</th>
                  <th className="px-4 py-3">Métier</th>
                  <th className="px-4 py-3">Docs/mois</th>
                  <th className="px-4 py-3">IA/mois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {users.map(user => (
                  <tr key={user.userKey} className="hover:bg-surface-container-low/60">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-on-surface">{user.userKey}</td>
                    <td className="px-4 py-3">{user.createdMonth}</td>
                    <td className="px-4 py-3">{user.plan}</td>
                    <td className="px-4 py-3">{user.subscriptionStatus}</td>
                    <td className="px-4 py-3">{user.profession}</td>
                    <td className="px-4 py-3">{user.invoiceUsageBucket}</td>
                    <td className="px-4 py-3">{user.aiUsageBucket}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-on-surface-variant" colSpan={7}>
                      Aucune donnée utilisateur agrégée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}
    </AdminShell>
  );
}
