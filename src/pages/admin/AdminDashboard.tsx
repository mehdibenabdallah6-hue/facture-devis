import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, FileText, Users } from 'lucide-react';
import { AdminCard, AdminShell } from './AdminShell';
import { fetchAdminApi } from './adminApi';

type Summary = {
  users: { total: number; plans: Record<string, number>; subscriptions: Record<string, number> };
  documents: { total: number; byType: Record<string, number>; byStatus: Record<string, number> };
};

export default function AdminDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminApi<{ ok: true } & Summary>('/api/admin-summary')
      .then(data => setSummary(data))
      .catch(err => setError(err.message || 'Erreur admin'));
  }, []);

  return (
    <AdminShell
      title="Vue globale"
      subtitle="Indicateurs anonymisés : aucun PDF, photo, signature, adresse, email client ou ligne de facture n’est affiché."
    >
      {error && <ErrorBox message={error} />}
      {!summary && !error && <LoadingGrid />}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <AdminCard>
            <Metric icon={<Users className="h-5 w-5" />} label="Comptes entreprises" value={summary.users.total} />
            <Breakdown title="Plans" values={summary.users.plans} />
          </AdminCard>
          <AdminCard>
            <Metric icon={<FileText className="h-5 w-5" />} label="Documents suivis" value={summary.documents.total} />
            <Breakdown title="Types" values={summary.documents.byType} />
          </AdminCard>
          <AdminCard>
            <Metric icon={<AlertCircle className="h-5 w-5" />} label="Statuts documents" value={Object.keys(summary.documents.byStatus).length} />
            <Breakdown title="Répartition" values={summary.documents.byStatus} />
          </AdminCard>
        </div>
      )}
    </AdminShell>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
        <p className="font-headline text-3xl font-extrabold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values);
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Aucune donnée.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex justify-between rounded-xl bg-surface-container-low px-3 py-2 text-sm">
              <span className="font-medium text-on-surface-variant">{key}</span>
              <span className="font-bold text-on-surface">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <AdminCard className="border-error/30 text-error">{message}</AdminCard>;
}

function LoadingGrid() {
  return <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(i => <AdminCard key={i} className="h-44 animate-pulse" />)}</div>;
}
