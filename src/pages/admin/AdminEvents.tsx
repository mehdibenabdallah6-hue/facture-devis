import { useEffect, useState } from 'react';
import { AdminCard, AdminShell } from './AdminShell';
import { fetchAdminApi } from './adminApi';

type AdminEventRow = {
  event: string;
  count: number;
};

export default function AdminEvents() {
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [configured, setConfigured] = useState(false);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminApi<{ ok: true; configured: boolean; events: AdminEventRow[]; warning?: string }>('/api/admin-events')
      .then(data => {
        setConfigured(Boolean(data.configured));
        setEvents(data.events || []);
        setWarning(data.warning || '');
      })
      .catch(err => setError(err.message || 'Erreur admin'));
  }, []);

  return (
    <AdminShell
      title="Événements"
      subtitle="Événements whitelistés seulement. Les propriétés libres et données sensibles sont bloquées avant envoi."
    >
      {error && <AdminCard className="border-error/30 text-error">{error}</AdminCard>}
      {!configured && !error && (
        <AdminCard className="mb-4 border-primary/20 bg-primary/5 text-sm text-on-surface-variant">
          PostHog serveur non configuré : fallback vide propre. Ajoutez `POSTHOG_PROJECT_ID` et `POSTHOG_PERSONAL_API_KEY` sur Vercel pour afficher les compteurs.
        </AdminCard>
      )}
      {warning && <AdminCard className="mb-4 border-primary/20 text-sm text-on-surface-variant">{warning}</AdminCard>}
      {!error && (
        <div className="grid gap-3 md:grid-cols-2">
          {events.map(row => (
            <AdminCard key={row.event} className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs font-bold text-on-surface">{row.event}</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-extrabold text-primary">{row.count}</span>
            </AdminCard>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
