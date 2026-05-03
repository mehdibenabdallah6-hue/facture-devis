import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, AlertTriangle, Bot, CreditCard, FileText, Flag, Target, Users } from 'lucide-react';
import { AdminCard, AdminShell } from './AdminShell';
import { fetchAdminApi } from './adminApi';

type CountMap = Record<string, number>;

type FunnelStep = {
  event: string;
  count: number;
  conversionFromPrevious: number;
  conversionFromSignup: number;
};

type Summary = {
  acquisition: {
    totalUsers: number;
    newUsersToday: number;
    newUsers7d: number;
    newUsers30d: number;
    activeUsers24h: number;
    activeUsers7d: number;
    activeUsers30d: number;
    companiesCreated: number;
    usersWithCompany: number;
    usersWithoutCompany: number;
  };
  activation: {
    activatedUsers: number;
    activationRate: number;
    nonActivatedUsers: number;
    signedUpNoDocument: number;
    companyNoDocument: number;
    documentNoSendSignatureValidation: number;
  };
  documents: {
    total: number;
    byType: CountMap;
    byStatus: CountMap;
    quotesCreated7d: number;
    quotesCreated30d: number;
    invoicesCreated7d: number;
    invoicesCreated30d: number;
    invoicesValidated7d: number;
    invoicesValidated30d: number;
    quotesSigned7d: number;
    quotesSigned30d: number;
    emailsSent7d: number;
    emailsSent30d: number;
  };
  ai: {
    started7d: number;
    started30d: number;
    succeeded7d: number;
    failed7d: number;
    successRate7d: number;
    usersUsedAi: number;
    quotaReachedUsers: number;
    recentErrors: Array<{ type: string; timestamp: string; severity: string }>;
  };
  business: {
    plans: CountMap;
    subscriptions: CountMap;
    checkoutStarted7d: number;
    checkoutStarted30d: number;
    subscriptionStarted7d: number;
    subscriptionStarted30d: number;
    checkoutToSubscriptionRate7d: number;
    upgradeClicked7d: number;
    upgradeClicked30d: number;
    clickedUpgradeNoPaying: number;
    activeSubscriptions: number;
    cancelledSubscriptions: number;
    pastDueSubscriptions: number;
  };
  errors: {
    errors24h: number;
    errors7d: number;
    bySeverity: CountMap;
  };
  funnel: FunnelStep[];
  blockedUsersSummary: CountMap;
  posthog: { configured: boolean; warning?: string };
};

const LABELS: Record<string, string> = {
  user_signed_up: 'Inscription',
  company_created: 'Entreprise créée',
  client_created: 'Client créé',
  quote_or_invoice_created: 'Document créé',
  sent_or_validated: 'Envoyé / validé',
  checkout_started: 'Checkout lancé',
  subscription_started: 'Abonnement',
  noCompany24h: '+24h sans entreprise',
  companyNoClient: 'Entreprise sans client',
  clientNoDocument: 'Client sans document',
  documentNeverSent: 'Document jamais envoyé',
  quotaReached: 'Quota atteint',
  recentError: 'Erreur récente',
  checkoutNoPayment: 'Checkout sans paiement',
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
      title="Cockpit SaaS"
      subtitle="Vue fondateur read-only : acquisition, activation, usage, IA, business et erreurs. Données anonymisées, aucun contenu client final."
    >
      {error && <ErrorBox message={error} />}
      {!summary && !error && <LoadingGrid />}
      {summary && (
        <div className="space-y-5">
          {!summary.posthog.configured && (
            <AdminCard className="border-primary/20 bg-primary/5 text-sm text-on-surface-variant">
              PostHog serveur non configuré : les métriques d’événements restent à zéro. Le cockpit Firestore/Auth continue de fonctionner.
            </AdminCard>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<Users />} label="Utilisateurs" value={summary.acquisition.totalUsers} hint={`${summary.acquisition.newUsers7d} nouveaux 7j`} />
            <MetricCard icon={<Activity />} label="Actifs 7j" value={summary.acquisition.activeUsers7d} hint={`${summary.acquisition.activeUsers24h} actifs 24h`} />
            <MetricCard icon={<Target />} label="Activation" value={`${summary.activation.activationRate}%`} hint={`${summary.activation.activatedUsers} activés`} />
            <MetricCard icon={<CreditCard />} label="Abonnements actifs" value={summary.business.activeSubscriptions} hint={`${summary.business.checkoutToSubscriptionRate7d}% checkout → abo`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <AdminCard>
              <SectionTitle icon={<Flag />} title="Funnel principal" />
              <div className="space-y-3">
                {summary.funnel.map(step => (
                  <div key={step.event} className="rounded-2xl bg-surface-container-low px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-bold text-on-surface">{LABELS[step.event] || step.event}</span>
                      <span className="font-headline text-2xl font-extrabold text-primary">{step.count}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-on-surface-variant">
                      <Badge>{step.conversionFromPrevious}% depuis étape précédente</Badge>
                      <Badge>{step.conversionFromSignup}% depuis inscription</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCard>

            <AdminCard>
              <SectionTitle icon={<AlertTriangle />} title="Utilisateurs à regarder" />
              <Breakdown values={summary.blockedUsersSummary} labels={LABELS} />
            </AdminCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <AdminCard>
              <SectionTitle icon={<Users />} title="Acquisition / activation" />
              <MiniList rows={[
                ['Nouveaux aujourd’hui', summary.acquisition.newUsersToday],
                ['Nouveaux 30j', summary.acquisition.newUsers30d],
                ['Avec entreprise', summary.acquisition.usersWithCompany],
                ['Sans entreprise', summary.acquisition.usersWithoutCompany],
                ['Non activés', summary.activation.nonActivatedUsers],
                ['Entreprise sans document', summary.activation.companyNoDocument],
              ]} />
            </AdminCard>
            <AdminCard>
              <SectionTitle icon={<FileText />} title="Documents" />
              <MiniList rows={[
                ['Devis créés 7j', summary.documents.quotesCreated7d],
                ['Devis créés 30j', summary.documents.quotesCreated30d],
                ['Factures créées 7j', summary.documents.invoicesCreated7d],
                ['Factures validées 7j', summary.documents.invoicesValidated7d],
                ['Devis signés 7j', summary.documents.quotesSigned7d],
                ['Emails envoyés 7j', summary.documents.emailsSent7d],
              ]} />
            </AdminCard>
            <AdminCard>
              <SectionTitle icon={<Bot />} title="IA" />
              <MiniList rows={[
                ['Analyses lancées 7j', summary.ai.started7d],
                ['Succès IA 7j', summary.ai.succeeded7d],
                ['Échecs IA 7j', summary.ai.failed7d],
                ['Taux succès IA', `${summary.ai.successRate7d}%`],
                ['Utilisateurs IA', summary.ai.usersUsedAi],
                ['Quotas atteints', summary.ai.quotaReachedUsers],
              ]} />
            </AdminCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <AdminCard>
              <SectionTitle icon={<CreditCard />} title="Business" />
              <MiniList rows={[
                ['Checkout 7j', summary.business.checkoutStarted7d],
                ['Abos démarrés 7j', summary.business.subscriptionStarted7d],
                ['Clics upgrade 7j', summary.business.upgradeClicked7d],
                ['Upgrade sans paiement', summary.business.clickedUpgradeNoPaying],
                ['Annulés', summary.business.cancelledSubscriptions],
                ['Past due', summary.business.pastDueSubscriptions],
              ]} />
            </AdminCard>
            <AdminCard>
              <SectionTitle icon={<Users />} title="Plans" />
              <Breakdown values={summary.business.plans} />
            </AdminCard>
            <AdminCard>
              <SectionTitle icon={<AlertTriangle />} title="Erreurs" />
              <MiniList rows={[
                ['Erreurs 24h', summary.errors.errors24h],
                ['Erreurs 7j', summary.errors.errors7d],
              ]} />
              <div className="mt-3">
                <Breakdown values={summary.errors.bySeverity} />
              </div>
            </AdminCard>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function MetricCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint: string }) {
  return (
    <AdminCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
          <p className="mt-2 font-headline text-3xl font-extrabold text-on-surface">{value}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{hint}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
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

function Breakdown({ values, labels = {} }: { values: CountMap; labels?: Record<string, string> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return <p className="text-sm text-on-surface-variant">Aucune donnée.</p>;
  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2 text-sm">
          <span className="font-medium text-on-surface-variant">{labels[key] || key}</span>
          <span className="font-extrabold text-on-surface">{value}</span>
        </div>
      ))}
    </div>
  );
}

function MiniList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2 text-sm">
          <span className="text-on-surface-variant">{label}</span>
          <span className="font-extrabold text-on-surface">{value}</span>
        </div>
      ))}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white/70 px-2.5 py-1">{children}</span>;
}

function ErrorBox({ message }: { message: string }) {
  return <AdminCard className="border-error/30 text-error">{message}</AdminCard>;
}

function LoadingGrid() {
  return <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map(i => <AdminCard key={i} className="h-36 animate-pulse" />)}</div>;
}
