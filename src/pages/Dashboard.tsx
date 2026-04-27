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

      {/* Overdue Alert (Spark style) */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-300/50 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-2 h-2 bg-red-600 rounded-full shrink-0" />
          <div className="flex-1 text-[13px] font-semibold text-red-900">
            <strong>{overdueCount} facture{overdueCount > 1 ? 's' : ''} en retard</strong>
            <span className="mx-1">—</span>
            Total à récupérer : <strong>{formatCurrency(overdueAmount)}</strong>
          </div>
          <button
            onClick={() => navigate('/app/invoices')}
            className="min-h-[44px] bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform"
          >
            Relancer les clients
          </button>
        </div>
      )}

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
          const months = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthInvoices = invoices.filter(inv => {
              const invDate = new Date(inv.date);
              return (
                invDate.getMonth() === d.getMonth() &&
                invDate.getFullYear() === d.getFullYear() &&
                inv.status === 'paid'
              );
            });
            const revenue = monthInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);
            months.push({ label: format(d, 'MMM', { locale: fr }), revenue });
          }
          const maxRevenue = Math.max(...months.map(m => m.revenue), 1);

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
              {/* Bar chart */}
              <div className="bg-white border-spark rounded-2xl p-5 shadow-spark-sm">
                <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">
                  CA encaissé — 6 derniers mois
                </div>
                <div className="flex items-end gap-2.5 h-20">
                  {months.map(m => {
                    const pct = Math.max(3, (m.revenue / maxRevenue) * 100);
                    const isMax = m.revenue === maxRevenue && m.revenue > 0;
                    return (
                      <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5">
                        <div
                          className="w-[80%] rounded-t-[5px] transition-all"
                          style={{
                            height: `${pct}%`,
                            minHeight: 3,
                            background: isMax ? '#E8621A' : 'rgba(232,98,26,0.18)',
                          }}
                        />
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
