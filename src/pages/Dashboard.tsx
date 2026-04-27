import type React from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { usePlan } from '../hooks/usePlan';
import {
  Camera,
  FileText,
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Plus,
  Zap,
  Crown,
  AlertTriangle,
} from 'lucide-react';
import { InvoiceStatusBadge, getEffectiveInvoiceStatus } from '../components/InvoiceStatusBadge';

type KpiProps = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
};

function KpiCard({ label, value, sub, icon, color }: KpiProps) {
  return (
    <div className="bg-white border-spark rounded-2xl p-3.5 md:p-5 shadow-spark-sm min-w-0">
      <div
        className="w-8 h-8 md:w-9 md:h-9 rounded-[10px] flex items-center justify-center mb-2 md:mb-3"
        style={{ background: `${color}14` }}
      >
        {icon}
      </div>
      <div className="font-headline text-xl md:text-2xl font-bold text-secondary-dim tracking-tight leading-none mb-1 truncate">
        {value}
      </div>
      <div className="text-[10px] md:text-[11px] font-medium text-on-surface-variant leading-tight">{label}</div>
      {sub && <div className="text-[10px] font-semibold text-primary mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { invoices, company, loading, articles } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isFree, limits } = usePlan();

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-surface-container rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-white rounded-2xl border-spark" />
          ))}
        </div>
      </div>
    );
  }

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const effectiveInvoices = invoices.map(inv => ({
    ...inv,
    status: getEffectiveInvoiceStatus(inv),
  }));

  const thisMonthInvoices = effectiveInvoices.filter(inv => {
    const date = new Date(inv.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const prevMonthInvoices = effectiveInvoices.filter(inv => {
    const date = new Date(inv.date);
    return date.getMonth() === prevMonth && date.getFullYear() === prevMonthYear;
  });

  const totalAmount = effectiveInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);
  const thisMonthRevenue = thisMonthInvoices
    .filter(inv => inv.status === 'paid' || inv.status === 'sent')
    .reduce((sum, inv) => sum + inv.totalTTC, 0);
  const prevMonthRevenue = prevMonthInvoices
    .filter(inv => inv.status === 'paid' || inv.status === 'sent')
    .reduce((sum, inv) => sum + inv.totalTTC, 0);
  const revenueVariation =
    prevMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
      : null;
  const pendingAmount = effectiveInvoices
    .filter(inv => inv.status === 'sent')
    .reduce((sum, inv) => sum + inv.totalTTC, 0);
  const pendingCount = effectiveInvoices.filter(inv => inv.status === 'sent').length;
  const paidAmount = effectiveInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.totalTTC, 0);
  const overdueInvoices = effectiveInvoices.filter(inv => inv.status === 'overdue');
  const overdueCount = overdueInvoices.length;
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);

  const recentInvoices = [...effectiveInvoices]
    .sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    )
    .slice(0, 5);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: company?.defaultCurrency || 'EUR',
    }).format(amount);

  const getElapsedDays = (dateValue?: string) => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000));
  };

  const pluralDays = (days: number) => `${days} jour${days > 1 ? 's' : ''}`;

  const getPaymentFollowUpLabel = (invoice: (typeof effectiveInvoices)[number]) => {
    if (invoice.type !== 'invoice') return null;
    if (invoice.status === 'paid') return 'Payée';
    if (invoice.status === 'overdue') {
      const days = getElapsedDays(invoice.dueDate);
      return days == null ? 'En retard' : `En retard depuis ${pluralDays(days)}`;
    }
    if (invoice.status === 'sent') {
      const days = getElapsedDays(invoice.updatedAt || invoice.date);
      return days === 0 ? "Envoyée aujourd'hui" : days == null ? 'Envoyée' : `Envoyée il y a ${pluralDays(days)}`;
    }
    return null;
  };

  const getPaymentFollowUpClass = (invoice: (typeof effectiveInvoices)[number]) => {
    if (invoice.status === 'paid') return 'text-emerald-700';
    if (invoice.status === 'overdue') return 'text-red-700';
    if (invoice.status === 'sent') return 'text-amber-700';
    return 'text-on-surface-variant';
  };

  let daysLeft = 0;
  let showTrialBanner = false;
  if (company?.subscriptionStatus === 'trial' && company.trialStartedAt) {
    const trialStart = new Date(company.trialStartedAt).getTime();
    const now = Date.now();
    daysLeft = 14 - Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 5 && daysLeft > 0) showTrialBanner = true;
  }

  // ---- Quick-start checklist (4 steps, hides itself when all done) ----
  // Lives above KPIs so artisans always see the next concrete action.
  // Step ordering follows the natural funnel: catalog → create → send,
  // with "design" tucked between create and send (logo upload is the most
  // concrete signal that the design has been touched). The Design entry
  // also serves as the mobile target for the "tour-design" tutorial step
  // since the desktop sidebar entry is display:none on phones.
  const hasPrice = (articles?.length || 0) > 0;
  const hasInvoice = invoices.length > 0;
  const hasSent = invoices.some(inv => inv.status === 'sent' || inv.status === 'paid');
  const hasDesign = !!company?.logoUrl;
  const onboardingDone = hasPrice && hasInvoice && hasDesign && hasSent;
  const onboardingSteps: { key: string; label: string; done: boolean; to: string; tourId?: string }[] = [
    { key: 'catalog', label: 'Ajouter un prix', done: hasPrice, to: '/app/catalog' },
    { key: 'create', label: 'Créer une facture', done: hasInvoice, to: '/app/invoices/new' },
    { key: 'design', label: 'Personnaliser le design', done: hasDesign, to: '/app/design', tourId: 'tour-design-mobile' },
    { key: 'send', label: 'Envoyer', done: hasSent, to: '/app/invoices' },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Trial Banner */}
      {showTrialBanner && (
        <div className="bg-primary-container border border-primary/20 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-on-primary-container text-sm">
                Plus que {daysLeft} jour{daysLeft > 1 ? 's' : ''} d'essai gratuit
              </p>
              <p className="text-xs text-on-primary-container/70">
                Continuez à facturer pour seulement 14,90€/mois
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/app/upgrade')}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap shadow-spark-cta active:scale-95 transition-transform"
          >
            Passer au Pro
          </button>
        </div>
      )}

      {/* Quick-start checklist — only while at least one step is pending */}
      {!onboardingDone && (
        <section
          aria-label="Premiers pas"
          className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-3.5 md:p-4 shadow-spark-sm"
        >
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <h2 className="text-xs md:text-sm font-bold uppercase tracking-widest text-primary">
              Premiers pas
            </h2>
            <span className="text-[11px] font-bold text-on-surface-variant">
              {onboardingSteps.filter(s => s.done).length} / {onboardingSteps.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {onboardingSteps.map((s, idx) => (
              <button
                key={s.key}
                id={s.tourId}
                type="button"
                onClick={() => navigate(s.to)}
                className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all text-left ${
                  s.done
                    ? 'bg-tertiary/10 border border-tertiary/20'
                    : 'bg-surface-container-low hover:bg-primary/5 border border-outline-variant/15 hover:border-primary/30'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    s.done
                      ? 'bg-tertiary text-on-tertiary'
                      : 'bg-white border border-outline-variant/40 text-on-surface-variant'
                  }`}
                >
                  {s.done ? <CheckCircle className="w-4 h-4" strokeWidth={2.5} /> : idx + 1}
                </div>
                <span
                  className={`text-sm font-bold flex-1 leading-tight ${
                    s.done ? 'text-tertiary line-through decoration-tertiary/40' : 'text-on-surface'
                  }`}
                >
                  {s.label}
                </span>
                {!s.done && (
                  <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-4">
        <div>
          <p className="text-on-surface-variant font-medium text-xs mb-1">
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
          <h1 className="font-headline text-[26px] md:text-[32px] font-extrabold text-secondary-dim tracking-tight leading-tight">
            Bonjour{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''} 👋
          </h1>
        </div>
        <button
          onClick={() => navigate('/app/invoices/new')}
          className="btn-glow hidden sm:flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-spark-cta-lg active:scale-95 transition-transform w-fit"
        >
          <Plus className="w-[15px] h-[15px]" strokeWidth={2.5} />
          Nouvelle facture
        </button>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3.5">
        <KpiCard
          label="Factures ce mois"
          value={`${thisMonthInvoices.length}`}
          sub={
            revenueVariation !== null
              ? `${revenueVariation >= 0 ? '+' : ''}${thisMonthInvoices.length - prevMonthInvoices.length} vs mois dernier`
              : undefined
          }
          color="#E8621A"
          icon={<FileText className="w-[17px] h-[17px] text-primary" />}
        />
        <KpiCard
          label="Chiffre d'affaires"
          value={formatCurrency(totalAmount)}
          sub={
            revenueVariation !== null
              ? `${revenueVariation >= 0 ? '+' : ''}${revenueVariation}% vs mois dernier`
              : undefined
          }
          color="#2563eb"
          icon={
            revenueVariation !== null && revenueVariation < 0 ? (
              <TrendingDown className="w-[17px] h-[17px] text-blue-600" />
            ) : (
              <TrendingUp className="w-[17px] h-[17px] text-blue-600" />
            )
          }
        />
        <KpiCard
          label="En attente"
          value={formatCurrency(pendingAmount)}
          sub={`${pendingCount} envoyée${pendingCount > 1 ? 's' : ''}`}
          color="#d97706"
          icon={<FileText className="w-[17px] h-[17px] text-amber-600" />}
        />
        <KpiCard
          label="Encaissé"
          value={formatCurrency(paidAmount)}
          color="#16a34a"
          icon={<CheckCircle className="w-[17px] h-[17px] text-green-600" />}
        />
      </section>

      {/* Usage warning */}
      {isFree &&
        limits.monthlyInvoiceLimit > 0 &&
        (() => {
          const used = company?.monthlyInvoiceCount || 0;
          const limit = limits.monthlyInvoiceLimit;
          const pct = Math.round((used / limit) * 100);
          if (pct < 60) return null;
          return (
            <div
              className={`p-4 rounded-2xl flex items-start sm:items-center gap-3 ${
                pct >= 90
                  ? 'bg-error-container/50 border border-error/20'
                  : pct >= 80
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-white border-spark'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 shrink-0 ${
                  pct >= 90 ? 'text-error' : pct >= 80 ? 'text-amber-600' : 'text-on-surface-variant'
                }`}
              />
              <div className="flex-1">
                <p className="font-bold text-sm">
                  {pct >= 90
                    ? 'Limite presque atteinte !'
                    : pct >= 80
                      ? 'Vous approchez de la limite'
                      : 'Utilisation du plan gratuit'}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {used}/{limit} factures ce mois ({pct}% utilisé)
                  {pct >= 90 && ' — Passez au plan Solo pour continuer sans limite.'}
                </p>
              </div>
              {pct >= 90 && (
                <button
                  onClick={() => navigate('/app/upgrade')}
                  className="shrink-0 bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold shadow-spark-cta active:scale-95 transition-transform flex items-center gap-1"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Passer Solo
                </button>
              )}
            </div>
          );
        })()}

      {/* Relances en attente — top 3 overdue invoices with quick actions.
          Reminders are sent automatically by the daily cron at /api/cron-reminders;
          this widget surfaces what's pending so the artisan keeps situational
          awareness even when they don't open the invoice list. */}
      {overdueCount > 0 && (() => {
        const overdueSorted = [...overdueInvoices].sort((a, b) => {
          const dueA = new Date(a.dueDate || 0).getTime();
          const dueB = new Date(b.dueDate || 0).getTime();
          return dueA - dueB; // oldest overdue first
        });
        const topOverdue = overdueSorted.slice(0, 3);
        const restCount = overdueSorted.length - topOverdue.length;

        return (
          <section
            aria-label="Relances en attente"
            className="bg-red-50 border border-red-300/50 rounded-2xl p-4 md:p-5 shadow-spark-sm"
          >
            <header className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-red-600/10 rounded-[10px] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-700" />
                </div>
                <div>
                  <h2 className="font-headline font-extrabold text-[15px] text-red-900 leading-tight">
                    {overdueCount} facture{overdueCount > 1 ? 's' : ''} en retard
                  </h2>
                  <p className="text-[11px] md:text-xs font-semibold text-red-800/80 mt-0.5">
                    Total à récupérer · <span className="font-extrabold text-red-900">{formatCurrency(overdueAmount)}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/app/invoices?filter=overdue')}
                className="hidden sm:flex shrink-0 items-center gap-1 text-xs font-bold text-red-800 hover:text-red-900"
              >
                Tout voir <ArrowRight className="w-3 h-3" />
              </button>
            </header>

            <ul className="space-y-2">
              {topOverdue.map(inv => {
                const daysLate = getElapsedDays(inv.dueDate);
                const remindersSent: number = (inv as any).remindersSent || 0;
                const lastReminderAt: string | undefined = (inv as any).lastReminderAt;
                const lastReminderDays = getElapsedDays(lastReminderAt);
                return (
                  <li
                    key={inv.id}
                    onClick={() => navigate(`/app/invoices/${inv.id}`)}
                    className="bg-white border border-red-200/70 rounded-xl px-3 py-2.5 flex items-center gap-3 cursor-pointer hover:border-red-300 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-secondary-dim truncate">
                          {inv.clientName}
                        </span>
                        <span className="text-[11px] text-on-surface-variant shrink-0">· {inv.number}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-red-700 mt-0.5">
                        {daysLate != null ? `Retard ${pluralDays(daysLate)}` : 'En retard'}
                        {remindersSent > 0 && (
                          <span className="text-on-surface-variant font-medium ml-2">
                            · {remindersSent} relance{remindersSent > 1 ? 's' : ''} envoyée{remindersSent > 1 ? 's' : ''}
                            {lastReminderDays != null ? ` (il y a ${pluralDays(lastReminderDays)})` : ''}
                          </span>
                        )}
                        {remindersSent === 0 && (
                          <span className="text-on-surface-variant font-medium ml-2">
                            · relance auto au prochain palier
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="font-headline font-bold text-sm text-secondary-dim shrink-0">
                      {formatCurrency(inv.totalTTC)}
                    </div>
                    <ArrowRight className="w-4 h-4 text-red-600 shrink-0" />
                  </li>
                );
              })}
            </ul>

            {restCount > 0 && (
              <button
                onClick={() => navigate('/app/invoices?filter=overdue')}
                className="mt-3 w-full sm:hidden bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform"
              >
                Voir les {restCount} autre{restCount > 1 ? 's' : ''}
              </button>
            )}
          </section>
        );
      })()}

      {/* Empty state (no invoices) */}
      {invoices.length === 0 && (
        <section>
          <div className="bg-white rounded-[20px] p-5 md:p-12 text-center border-spark shadow-spark-md">
            <div className="w-14 h-14 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
              <Zap className="w-7 h-7 md:w-10 md:h-10 text-primary fill-primary" />
            </div>
            <h2 className="font-headline text-xl md:text-2xl font-extrabold text-secondary-dim mb-3">
              Bienvenue ! Voici comment démarrer
            </h2>

            <div className="max-w-sm mx-auto space-y-2.5 md:space-y-3 mb-5 md:mb-7 text-left">
              {[
                {
                  step: '1',
                  title: 'Complétez votre profil',
                  desc: 'Ajoutez votre SIRET et adresse pour des factures conformes.',
                  done: !!company?.siret,
                },
                {
                  step: '2',
                  title: 'Photo + description rapide',
                  desc: "L'IA prépare une proposition de facture à vérifier.",
                  done: false,
                },
                {
                  step: '3',
                  title: 'Vérifiez et envoyez',
                  desc: 'Relisez, téléchargez le PDF ou envoyez-le par email.',
                  done: false,
                },
              ].map(item => (
                <div
                  key={item.step}
                  className={`flex items-start gap-3 p-3 rounded-xl ${
                    item.done
                      ? 'bg-primary/[0.06] border border-primary/15'
                      : 'bg-background border-spark'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                      item.done
                        ? 'bg-primary text-white'
                        : 'bg-white border-spark text-on-surface-variant'
                    }`}
                  >
                    {item.done ? '✓' : item.step}
                  </div>
                  <div>
                    <p
                      className={`font-bold text-sm ${
                        item.done ? 'text-primary' : 'text-on-surface'
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/app/invoices/new')}
                  className="btn-glow flex items-center justify-center gap-2 bg-primary text-white font-bold px-5 md:px-7 py-3 md:py-3.5 rounded-xl shadow-spark-cta-lg active:scale-95 transition-transform"
              >
                <Camera className="w-5 h-5" />
                Importer une photo
              </button>
              <button
                onClick={() => navigate('/app/invoices/new')}
                  className="flex items-center justify-center gap-2 bg-background border-spark text-on-surface font-bold px-5 md:px-7 py-3 md:py-3.5 rounded-xl active:scale-95 transition-transform"
              >
                <FileText className="w-5 h-5" />
                Saisir manuellement
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Recent activity */}
      {invoices.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-headline font-bold text-[15px] text-secondary-dim">
              Activité récente
            </h2>
            <button
              onClick={() => navigate('/app/invoices')}
              className="text-xs font-bold text-primary flex items-center gap-1"
            >
              Tout voir <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="bg-white border-spark rounded-2xl overflow-hidden shadow-spark-sm">
            {recentInvoices.map((invoice, i) => (
              <div
                key={invoice.id}
                onClick={() => navigate(`/app/invoices/${invoice.id}`)}
                className={`flex items-center px-3.5 md:px-5 py-3 cursor-pointer hover:bg-background/50 transition-colors ${
                  i < recentInvoices.length - 1 ? 'border-b-spark' : ''
                }`}
              >
                <div className="w-[34px] h-[34px] bg-primary/10 rounded-[10px] flex items-center justify-center text-xs font-bold text-primary mr-3 shrink-0">
                  {invoice.clientName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-secondary-dim truncate">
                    {invoice.clientName}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    {invoice.number} · {format(new Date(invoice.date), 'dd MMM', { locale: fr })}
                  </div>
                  {getPaymentFollowUpLabel(invoice) && (
                    <div className={`text-[11px] font-bold mt-0.5 ${getPaymentFollowUpClass(invoice)}`}>
                      {getPaymentFollowUpLabel(invoice)}
                    </div>
                  )}
                </div>
                <InvoiceStatusBadge invoice={invoice} compact />
                <div className="font-headline font-bold text-xs md:text-sm text-secondary-dim ml-2 md:ml-4 shrink-0">
                  {formatCurrency(invoice.totalTTC)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Analytics */}
      {invoices.length > 3 &&
        (() => {
          // Build a 6-month stacked breakdown: paid (encaissé) + en attente
          // (sent / not yet due) + en retard. Reading from `effectiveInvoices`
          // ensures that a `sent` invoice past its due date is counted in the
          // overdue bucket — the same logic the rest of the dashboard uses.
          const months: {
            label: string;
            paid: number;
            pending: number;
            overdue: number;
            total: number;
          }[] = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthInvoices = effectiveInvoices.filter(inv => {
              if (inv.type !== 'invoice') return false;
              const invDate = new Date(inv.date);
              return (
                invDate.getMonth() === d.getMonth() &&
                invDate.getFullYear() === d.getFullYear()
              );
            });
            const paid = monthInvoices
              .filter(inv => inv.status === 'paid')
              .reduce((sum, inv) => sum + inv.totalTTC, 0);
            const pending = monthInvoices
              .filter(inv => inv.status === 'sent')
              .reduce((sum, inv) => sum + inv.totalTTC, 0);
            const overdue = monthInvoices
              .filter(inv => inv.status === 'overdue')
              .reduce((sum, inv) => sum + inv.totalTTC, 0);
            months.push({
              label: format(d, 'MMM', { locale: fr }),
              paid,
              pending,
              overdue,
              total: paid + pending + overdue,
            });
          }
          const maxRevenue = Math.max(...months.map(m => m.total), 1);

          const quotes = invoices.filter(inv => inv.type === 'quote');
          const acceptedQuotes = quotes.filter(q => q.status === 'accepted');
          const conversionRate =
            quotes.length > 0
              ? Math.round((acceptedQuotes.length / quotes.length) * 100)
              : 0;

          const paidInvoices = invoices.filter(
            inv => inv.status === 'paid' && inv.date && inv.dueDate,
          );
          const avgDelay =
            paidInvoices.length > 0
              ? Math.round(
                  paidInvoices.reduce((sum, inv) => {
                    const issued = new Date(inv.date).getTime();
                    const due = new Date(inv.dueDate).getTime();
                    return sum + Math.max(0, (due - issued) / (1000 * 60 * 60 * 24));
                  }, 0) / paidInvoices.length,
                )
              : 0;

          return (
            <section className="grid lg:grid-cols-[2fr_1fr_1fr] gap-3.5">
              {/* Stacked bar chart — paid / pending / overdue per month */}
              <div className="bg-white border-spark rounded-2xl p-5 shadow-spark-sm">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Cash flow — 6 derniers mois
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-semibold text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />Encaissé
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />En attente
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />En retard
                    </span>
                  </div>
                </div>
                <div className="flex items-end gap-2.5 h-24">
                  {months.map(m => {
                    const total = m.total;
                    const totalPct = Math.max(3, (total / maxRevenue) * 100);
                    const paidPct = total > 0 ? (m.paid / total) * 100 : 0;
                    const pendingPct = total > 0 ? (m.pending / total) * 100 : 0;
                    const overduePct = total > 0 ? (m.overdue / total) * 100 : 0;
                    const tooltip = `${m.label} · ${formatCurrency(total)}\nEncaissé ${formatCurrency(m.paid)} · En attente ${formatCurrency(m.pending)} · En retard ${formatCurrency(m.overdue)}`;
                    return (
                      <div
                        key={m.label}
                        className="flex-1 flex flex-col items-center gap-1.5 group"
                        title={tooltip}
                      >
                        <div
                          className="w-[80%] flex flex-col-reverse rounded-t-[5px] overflow-hidden transition-all"
                          style={{
                            height: `${totalPct}%`,
                            minHeight: 3,
                            background: total === 0 ? 'rgba(204,79,18,0.08)' : undefined,
                          }}
                        >
                          {paidPct > 0 && (
                            <div style={{ height: `${paidPct}%`, background: '#10b981' }} />
                          )}
                          {pendingPct > 0 && (
                            <div style={{ height: `${pendingPct}%`, background: '#fbbf24' }} />
                          )}
                          {overduePct > 0 && (
                            <div style={{ height: `${overduePct}%`, background: '#ef4444' }} />
                          )}
                        </div>
                        <span className="text-[9px] text-on-surface-variant font-semibold capitalize">
                          {m.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Conversion */}
              <div className="bg-white border-spark rounded-2xl p-5 shadow-spark-sm flex flex-col justify-between">
                <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Taux conversion devis
                </div>
                <div>
                  <div className="font-headline text-[38px] font-bold text-primary leading-none tracking-tight">
                    {conversionRate}%
                  </div>
                  <div className="text-[11px] text-on-surface-variant mt-1">
                    {acceptedQuotes.length}/{quotes.length} devis acceptés
                  </div>
                </div>
              </div>

              {/* Delay */}
              <div className="bg-white border-spark rounded-2xl p-5 shadow-spark-sm flex flex-col justify-between">
                <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Délai paiement moyen
                </div>
                <div>
                  <div className="font-headline text-[38px] font-bold text-blue-600 leading-none tracking-tight">
                    {avgDelay}j
                  </div>
                  <div className="text-[11px] text-on-surface-variant mt-1">
                    sur {paidInvoices.length} factures
                  </div>
                </div>
              </div>
            </section>
          );
        })()}
    </div>
  );
}
