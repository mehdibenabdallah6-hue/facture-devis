import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Bug, Route, Users } from 'lucide-react';
import { AdminCard, AdminShell } from './AdminShell';
import { fetchAdminApi } from './adminApi';

type AdminErrorRow = {
  type: string;
  route: string;
  severity: 'critical' | 'warning' | 'info';
  userKey: string;
  timestamp: string;
};

type ErrorsPayload = {
  ok: true;
  recent: AdminErrorRow[];
  byType: Record<string, number>;
  byRoute: Record<string, number>;
  bySeverity: Record<string, number>;
  affectedUsers: number;
  warning?: string;
};

export default function AdminErrors() {
  const [payload, setPayload] = useState<ErrorsPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminApi<ErrorsPayload>('/api/admin-errors')
      .then(data => setPayload(data))
      .catch(err => setError(err.message || 'Erreur admin'));
  }, []);

  return (
    <AdminShell
      title="Erreurs"
      subtitle="Agrégats techniques anonymisés. Aucun message brut, stack trace, contenu IA, PDF, photo, signature ou donnée client final."
    >
      {error && <AdminCard className="border-error/30 text-error">{error}</AdminCard>}
      {payload?.warning && !error && <AdminCard className="mb-4 border-primary/20 text-sm text-on-surface-variant">{payload.warning}</AdminCard>}
      {!payload && !error && <AdminCard className="h-40 animate-pulse" />}
      {payload && !error && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Metric icon={<AlertTriangle />} label="Critiques" value={payload.bySeverity.critical || 0} tone="critical" />
            <Metric icon={<Bug />} label="Warnings" value={payload.bySeverity.warning || 0} tone="warning" />
            <Metric icon={<Bug />} label="Info" value={payload.bySeverity.info || 0} />
            <Metric icon={<Users />} label="Users concernés" value={payload.affectedUsers} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <AdminCard>
              <SectionTitle icon={<Bug />} title="Par type" />
              <List values={payload.byType} />
            </AdminCard>
            <AdminCard>
              <SectionTitle icon={<Route />} title="Par route" />
              <List values={payload.byRoute} />
            </AdminCard>
            <AdminCard>
              <SectionTitle icon={<AlertTriangle />} title="Par gravité" />
              <List values={payload.bySeverity} />
            </AdminCard>
          </div>

          <AdminCard className="overflow-hidden p-0">
            <div className="border-b border-outline-variant/10 px-5 py-4">
              <h2 className="font-headline text-xl font-extrabold">Erreurs récentes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-surface-container text-left text-xs uppercase tracking-widest text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Gravité</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {payload.recent.map((row, index) => (
                    <tr key={`${row.type}-${row.timestamp}-${index}`} className="hover:bg-surface-container-low/60">
                      <td className="px-4 py-3"><Severity severity={row.severity} /></td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-on-surface">{row.type}</td>
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{row.route}</td>
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{row.userKey}</td>
                      <td className="px-4 py-3">{formatDate(row.timestamp)}</td>
                    </tr>
                  ))}
                  {payload.recent.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-on-surface-variant" colSpan={5}>Aucune erreur récente.</td>
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

function Metric({ icon, label, value, tone = 'default' }: { icon: ReactNode; label: string; value: number; tone?: 'default' | 'critical' | 'warning' }) {
  const color = tone === 'critical' ? 'text-error bg-error/10' : tone === 'warning' ? 'text-amber-700 bg-amber-100' : 'text-primary bg-primary/10';
  return (
    <AdminCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
          <p className="mt-2 font-headline text-3xl font-extrabold text-on-surface">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl [&>svg]:h-5 [&>svg]:w-5 ${color}`}>{icon}</div>
      </div>
    </AdminCard>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 font-headline text-xl font-extrabold text-on-surface [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-primary">
      {icon}
      {title}
    </h2>
  );
}

function List({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return <p className="text-sm text-on-surface-variant">Aucune donnée.</p>;
  return (
    <div className="space-y-2">
      {entries.map(([label, count]) => (
        <div key={label} className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2 text-sm">
          <span className="font-mono text-xs font-bold text-on-surface">{label}</span>
          <span className="font-extrabold text-primary">{count}</span>
        </div>
      ))}
    </div>
  );
}

function Severity({ severity }: { severity: AdminErrorRow['severity'] }) {
  const className = severity === 'critical'
    ? 'bg-error/10 text-error'
    : severity === 'warning'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-surface-container text-on-surface-variant';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${className}`}>{severity}</span>;
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR');
}
