import { useEffect, useMemo, useState } from 'react';
import { Filter, Users } from 'lucide-react';
import { AdminCard, AdminShell } from './AdminShell';
import { fetchAdminApi } from './adminApi';

type AdminUserRow = {
  userKey: string;
  uidShort: string;
  emailMasked: string;
  createdAt: string;
  lastActivityAt: string;
  plan: string;
  subscriptionStatus: string;
  profession: string;
  hasCompany: boolean;
  hasClient: boolean;
  quoteCount: number;
  invoiceCount: number;
  validatedInvoiceCount: number;
  signedQuoteCount: number;
  aiUsed: boolean;
  quotaReached: boolean;
  upgradeClicked: boolean;
  checkoutStarted: boolean;
  paid: boolean;
  errors7d: number;
  activationStatus: string;
};

type FilterKey =
  | 'all'
  | 'active'
  | 'inactive'
  | 'activated'
  | 'not_activated'
  | 'no_document'
  | 'quota'
  | 'error'
  | 'checkout_unpaid'
  | 'ai_used'
  | 'paid'
  | 'not_paid';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs 30j' },
  { key: 'inactive', label: 'Inactifs' },
  { key: 'activated', label: 'Activés' },
  { key: 'not_activated', label: 'Non activés' },
  { key: 'no_document', label: 'Aucun document' },
  { key: 'quota', label: 'Quota atteint' },
  { key: 'error', label: 'Erreur récente' },
  { key: 'checkout_unpaid', label: 'Checkout non payé' },
  { key: 'ai_used', label: 'IA utilisée' },
  { key: 'paid', label: 'Payants' },
  { key: 'not_paid', label: 'Non payants' },
];

const STATUS_LABELS: Record<string, string> = {
  new: 'new',
  onboarding_started: 'onboarding',
  company_created: 'entreprise',
  activated: 'activé',
  power_user: 'power user',
  blocked: 'bloqué',
  paying: 'payant',
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    fetchAdminApi<{ ok: true; users: AdminUserRow[] }>('/api/admin-users')
      .then(data => setUsers(data.users || []))
      .catch(err => setError(err.message || 'Erreur admin'));
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (planFilter !== 'all' && user.plan !== planFilter) return false;
      if (filter === 'active' && !isRecent(user.lastActivityAt, 30)) return false;
      if (filter === 'inactive' && isRecent(user.lastActivityAt, 30)) return false;
      if (filter === 'activated' && !['activated', 'power_user', 'paying'].includes(user.activationStatus)) return false;
      if (filter === 'not_activated' && ['activated', 'power_user', 'paying'].includes(user.activationStatus)) return false;
      if (filter === 'no_document' && user.quoteCount + user.invoiceCount > 0) return false;
      if (filter === 'quota' && !user.quotaReached) return false;
      if (filter === 'error' && user.errors7d === 0) return false;
      if (filter === 'checkout_unpaid' && (!user.checkoutStarted || user.paid)) return false;
      if (filter === 'ai_used' && !user.aiUsed) return false;
      if (filter === 'paid' && !user.paid) return false;
      if (filter === 'not_paid' && user.paid) return false;
      return true;
    });
  }, [users, planFilter, filter]);

  return (
    <AdminShell
      title="Utilisateurs"
      subtitle="Vue anonymisée : email masqué, UID tronqué/hashé, aucun client final, SIRET, adresse, PDF, signature ou ligne de facture."
    >
      {error && <AdminCard className="border-error/30 text-error">{error}</AdminCard>}
      {!error && (
        <div className="space-y-4">
          <AdminCard>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 font-bold text-on-surface">
                <Users className="h-5 w-5 text-primary" />
                {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''} affiché{filteredUsers.length > 1 ? 's' : ''}
              </div>
              <div className="flex flex-wrap gap-2">
                <Select label="Plan" value={planFilter} onChange={setPlanFilter} options={['all', 'free', 'starter', 'pro']} />
                <Select label="Filtre" value={filter} onChange={value => setFilter(value as FilterKey)} options={FILTERS.map(item => item.key)} labels={Object.fromEntries(FILTERS.map(item => [item.key, item.label]))} />
              </div>
            </div>
          </AdminCard>

          <AdminCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-sm">
                <thead className="bg-surface-container text-left text-xs uppercase tracking-widest text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Inscription</th>
                    <th className="px-4 py-3">Dernière activité</th>
                    <th className="px-4 py-3">Entreprise</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Devis</th>
                    <th className="px-4 py-3">Factures</th>
                    <th className="px-4 py-3">Validées</th>
                    <th className="px-4 py-3">Signés</th>
                    <th className="px-4 py-3">IA</th>
                    <th className="px-4 py-3">Quota</th>
                    <th className="px-4 py-3">Upgrade</th>
                    <th className="px-4 py-3">Checkout</th>
                    <th className="px-4 py-3">Payé</th>
                    <th className="px-4 py-3">Erreurs 7j</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredUsers.map(user => (
                    <tr key={user.userKey} className="hover:bg-surface-container-low/60">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-bold text-on-surface">{user.uidShort}</div>
                        <div className="text-xs text-on-surface-variant">{user.emailMasked || user.userKey}</div>
                      </td>
                      <td className="px-4 py-3"><PlanBadge plan={user.plan} /></td>
                      <td className="px-4 py-3"><StatusBadge status={user.activationStatus} /></td>
                      <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3">{formatDate(user.lastActivityAt)}</td>
                      <td className="px-4 py-3"><Bool value={user.hasCompany} /></td>
                      <td className="px-4 py-3"><Bool value={user.hasClient} /></td>
                      <td className="px-4 py-3 font-bold">{user.quoteCount}</td>
                      <td className="px-4 py-3 font-bold">{user.invoiceCount}</td>
                      <td className="px-4 py-3 font-bold">{user.validatedInvoiceCount}</td>
                      <td className="px-4 py-3 font-bold">{user.signedQuoteCount}</td>
                      <td className="px-4 py-3"><Bool value={user.aiUsed} /></td>
                      <td className="px-4 py-3"><Bool value={user.quotaReached} danger /></td>
                      <td className="px-4 py-3"><Bool value={user.upgradeClicked} /></td>
                      <td className="px-4 py-3"><Bool value={user.checkoutStarted} /></td>
                      <td className="px-4 py-3"><Bool value={user.paid} /></td>
                      <td className="px-4 py-3 font-bold text-error">{user.errors7d || ''}</td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-on-surface-variant" colSpan={17}>
                        Aucun utilisateur pour ce filtre.
                      </td>
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

function Select({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="flex items-center gap-2 rounded-2xl bg-surface-container-low px-3 py-2 text-sm font-bold text-on-surface-variant">
      <Filter className="h-4 w-4" />
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} className="bg-transparent font-bold text-on-surface outline-none">
        {options.map(option => <option key={option} value={option}>{labels[option] || option}</option>)}
      </select>
    </label>
  );
}

function Bool({ value, danger = false }: { value: boolean; danger?: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${value ? (danger ? 'bg-error/10 text-error' : 'bg-tertiary/10 text-tertiary') : 'bg-surface-container text-on-surface-variant'}`}>
      {value ? 'Oui' : 'Non'}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  return <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">{plan}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const critical = status === 'blocked';
  const paying = status === 'paying';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${critical ? 'bg-error/10 text-error' : paying ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-container text-on-surface'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR');
}

function isRecent(value: string, days: number) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}
