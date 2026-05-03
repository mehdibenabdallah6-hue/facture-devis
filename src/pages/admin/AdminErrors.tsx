import { useEffect, useState } from 'react';
import { AdminCard, AdminShell } from './AdminShell';
import { fetchAdminApi } from './adminApi';

type AdminErrorRow = {
  type: string;
  count: number;
};

export default function AdminErrors() {
  const [errors, setErrors] = useState<AdminErrorRow[]>([]);
  const [byMonth, setByMonth] = useState<Record<string, number>>({});
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminApi<{ ok: true; errors: AdminErrorRow[]; byMonth: Record<string, number>; warning?: string }>('/api/admin-errors')
      .then(data => {
        setErrors(data.errors || []);
        setByMonth(data.byMonth || {});
        setWarning(data.warning || '');
      })
      .catch(err => setError(err.message || 'Erreur admin'));
  }, []);

  return (
    <AdminShell
      title="Erreurs"
      subtitle="Uniquement des agrégats techniques. Aucun message utilisateur brut, stack trace, PDF, photo ou ligne de facture."
    >
      {error && <AdminCard className="border-error/30 text-error">{error}</AdminCard>}
      {warning && !error && <AdminCard className="mb-4 border-primary/20 text-sm text-on-surface-variant">{warning}</AdminCard>}
      {!error && (
        <div className="grid gap-4 md:grid-cols-2">
          <AdminCard>
            <h2 className="mb-3 font-headline text-xl font-extrabold">Types d’erreurs</h2>
            <List rows={errors.map(row => [row.type, row.count])} empty="Aucune erreur agrégée." />
          </AdminCard>
          <AdminCard>
            <h2 className="mb-3 font-headline text-xl font-extrabold">Par mois</h2>
            <List rows={Object.entries(byMonth)} empty="Aucun historique." />
          </AdminCard>
        </div>
      )}
    </AdminShell>
  );
}

function List({ rows, empty }: { rows: Array<[string, number]>; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-on-surface-variant">{empty}</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map(([label, count]) => (
        <div key={label} className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2 text-sm">
          <span className="font-mono text-xs font-bold text-on-surface">{label}</span>
          <span className="font-extrabold text-primary">{count}</span>
        </div>
      ))}
    </div>
  );
}
