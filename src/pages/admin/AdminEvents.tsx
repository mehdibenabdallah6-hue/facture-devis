import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock, Filter } from 'lucide-react';
import { AdminCard, AdminShell } from './AdminShell';
import { fetchAdminApi } from './adminApi';

type AdminEventCount = {
  event: string;
  count: number;
  users: number;
};

type AdminRecentEvent = {
  event: string;
  userKey: string;
  timestamp: string;
};

type EventsPayload = {
  ok: true;
  configured: boolean;
  warning?: string;
  events: AdminEventCount[];
  top24h: AdminEventCount[];
  top7d: AdminEventCount[];
  top30d: AdminEventCount[];
  grouped: Record<string, number>;
  recent: AdminRecentEvent[];
};

export default function AdminEvents() {
  const [payload, setPayload] = useState<EventsPayload | null>(null);
  const [eventFilter, setEventFilter] = useState('all');
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [error, setError] = useState('');

  useEffect(() => {
    const query = new URLSearchParams();
    if (eventFilter !== 'all') query.set('event', eventFilter);
    query.set('period', period);
    fetchAdminApi<EventsPayload>(`/api/admin-events?${query.toString()}`)
      .then(data => setPayload(data))
      .catch(err => setError(err.message || 'Erreur admin'));
  }, [eventFilter, period]);

  const availableEvents = useMemo(() => {
    const names = new Set((payload?.events || []).map(row => row.event));
    return ['all', ...Array.from(names).sort()];
  }, [payload]);

  const selectedTop = period === '24h' ? payload?.top24h : period === '30d' ? payload?.top30d : payload?.top7d;

  return (
    <AdminShell
      title="Événements"
      subtitle="PostHog serveur uniquement, events whitelistés, aucune propriété libre ou donnée sensible."
    >
      {error && <AdminCard className="border-error/30 text-error">{error}</AdminCard>}
      {payload && !payload.configured && !error && (
        <AdminCard className="mb-4 border-primary/20 bg-primary/5 text-sm text-on-surface-variant">
          PostHog serveur non configuré : fallback vide propre. Ajoutez `POSTHOG_PROJECT_ID` et `POSTHOG_PERSONAL_API_KEY` sur Vercel pour afficher les compteurs.
        </AdminCard>
      )}
      {payload?.warning && <AdminCard className="mb-4 border-primary/20 text-sm text-on-surface-variant">{payload.warning}</AdminCard>}
      {!payload && !error && <AdminCard className="h-40 animate-pulse" />}
      {payload && !error && (
        <div className="space-y-4">
          <AdminCard>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 font-bold text-on-surface">
                <Activity className="h-5 w-5 text-primary" />
                Analyse événements
              </div>
              <div className="flex flex-wrap gap-2">
                <Select label="Période" value={period} onChange={value => setPeriod(value as any)} options={['24h', '7d', '30d']} />
                <Select label="Event" value={eventFilter} onChange={setEventFilter} options={availableEvents} />
              </div>
            </div>
          </AdminCard>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <AdminCard>
              <h2 className="mb-4 font-headline text-xl font-extrabold">Top events {period}</h2>
              <div className="space-y-2">
                {(selectedTop || []).length === 0 && <p className="text-sm text-on-surface-variant">Aucun event sur la période.</p>}
                {(selectedTop || []).map(row => (
                  <div key={row.event}>
                    <EventCountRow row={row} />
                  </div>
                ))}
              </div>
            </AdminCard>

            <AdminCard>
              <h2 className="mb-4 font-headline text-xl font-extrabold">Groupement par type</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(payload.grouped).length === 0 && <p className="text-sm text-on-surface-variant">Aucun groupement disponible.</p>}
                {Object.entries(payload.grouped).map(([event, count]) => (
                  <div key={event} className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2 text-sm">
                    <span className="font-mono text-xs font-bold text-on-surface">{event}</span>
                    <span className="font-extrabold text-primary">{count}</span>
                  </div>
                ))}
              </div>
            </AdminCard>
          </div>

          <AdminCard className="overflow-hidden p-0">
            <div className="border-b border-outline-variant/10 px-5 py-4">
              <h2 className="flex items-center gap-2 font-headline text-xl font-extrabold">
                <Clock className="h-5 w-5 text-primary" />
                Events récents
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-surface-container text-left text-xs uppercase tracking-widest text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Utilisateur anonymisé</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {payload.recent.map((row, index) => (
                    <tr key={`${row.event}-${row.timestamp}-${index}`} className="hover:bg-surface-container-low/60">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-on-surface">{row.event}</td>
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{row.userKey}</td>
                      <td className="px-4 py-3">{formatDate(row.timestamp)}</td>
                    </tr>
                  ))}
                  {payload.recent.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-on-surface-variant" colSpan={3}>Aucun event récent.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </div>
      )}
    </AdminShell>
  );
}

function EventCountRow({ row }: { row: AdminEventCount }) {
  return (
    <div className="rounded-xl bg-surface-container-low px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs font-bold text-on-surface">{row.event}</span>
        <span className="font-headline text-xl font-extrabold text-primary">{row.count}</span>
      </div>
      <p className="mt-1 text-xs text-on-surface-variant">{row.users} utilisateur{row.users > 1 ? 's' : ''}</p>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-2 rounded-2xl bg-surface-container-low px-3 py-2 text-sm font-bold text-on-surface-variant">
      <Filter className="h-4 w-4" />
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} className="max-w-[240px] bg-transparent font-bold text-on-surface outline-none">
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR');
}
