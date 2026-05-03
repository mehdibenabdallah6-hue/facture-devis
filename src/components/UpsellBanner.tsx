import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Zap, AlertTriangle, ArrowRight } from 'lucide-react';
import { usePlan } from '../hooks/usePlan';
import { track } from '../services/analytics';

/* ──────────────────────────────────────────────────────────────
   PHOTOFACTO — UpsellBanner
   Soft, progressive paywall nudges. Replaces the "either silent
   or hard-blocked" UX with three calibrated thresholds:
     - 60 % → friendly heads-up, low-key gradient
     - 80 % → urgent, primary-toned, explicit numbers
     - 100 % → hard CTA, only path forward is /upgrade
   Both the invoice quota and the AI quota are surfaced.
   ────────────────────────────────────────────────────────────── */

type Resource = 'invoice' | 'ai' | 'auto';

interface UpsellBannerProps {
  /** Which quota to surface. `auto` picks whichever is closer to its limit. */
  resource?: Resource;
  /** Where the banner is rendered — for analytics segmentation. */
  surface: 'dashboard' | 'invoices_list' | 'invoice_create' | 'catalog' | 'clients';
  className?: string;
}

interface BannerState {
  resource: 'invoice' | 'ai';
  used: number;
  limit: number;
  ratio: number;
  threshold: 60 | 80 | 100;
  remaining: number;
}

function computeRatio(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(1, used / limit);
}

function pickThreshold(ratio: number): 60 | 80 | 100 | null {
  if (ratio >= 1) return 100;
  if (ratio >= 0.8) return 80;
  if (ratio >= 0.6) return 60;
  return null;
}

export function UpsellBanner({ resource = 'auto', surface, className = '' }: UpsellBannerProps) {
  const plan = usePlan();
  const quotaReachedKeyRef = useRef<string | null>(null);

  const state: BannerState | null = useMemo(() => {
    // Paid users → never show
    if (!plan.isFree) return null;

    const candidates: BannerState[] = [];

    if (resource === 'invoice' || resource === 'auto') {
      if (!plan.invoiceUnlimited && plan.invoiceLimit > 0) {
        const ratio = computeRatio(plan.invoiceUsed, plan.invoiceLimit);
        const threshold = pickThreshold(ratio);
        if (threshold !== null) {
          candidates.push({
            resource: 'invoice',
            used: plan.invoiceUsed,
            limit: plan.invoiceLimit,
            ratio,
            threshold,
            remaining: plan.invoiceRemaining as number,
          });
        }
      }
    }

    if (resource === 'ai' || resource === 'auto') {
      if (!plan.aiUnlimited && plan.aiLimit > 0) {
        const ratio = computeRatio(plan.aiUsed, plan.aiLimit);
        const threshold = pickThreshold(ratio);
        if (threshold !== null) {
          candidates.push({
            resource: 'ai',
            used: plan.aiUsed,
            limit: plan.aiLimit,
            ratio,
            threshold,
            remaining: plan.aiRemaining as number,
          });
        }
      }
    }

    if (candidates.length === 0) return null;
    // Pick whichever is closest to its limit
    candidates.sort((a, b) => b.ratio - a.ratio);
    return candidates[0];
  }, [
    plan.isFree,
    plan.invoiceUnlimited,
    plan.invoiceLimit,
    plan.invoiceUsed,
    plan.invoiceRemaining,
    plan.aiUnlimited,
    plan.aiLimit,
    plan.aiUsed,
    plan.aiRemaining,
    resource,
  ]);

  // Fire only the product-critical quota event, never a generic impression.
  useEffect(() => {
    if (!state || state.threshold !== 100) return;
    const key = `${surface}:${state.resource}:${state.used}:${state.limit}`;
    if (quotaReachedKeyRef.current === key) return;
    quotaReachedKeyRef.current = key;
    track('quota_limit_reached', {
      surface,
      quota_resource: state.resource,
      used: state.used,
      limit: state.limit,
    });
  }, [state, surface]);

  if (!state) return null;

  const isHard = state.threshold === 100;
  const isUrgent = state.threshold === 80;

  // Tone-specific styling
  const Icon = isHard ? AlertTriangle : state.resource === 'ai' ? Sparkles : Zap;
  const containerClass = isHard
    ? 'border-error/30 bg-gradient-to-r from-error-container to-error-container/60'
    : isUrgent
      ? 'border-primary/30 bg-gradient-to-r from-primary-container to-primary-container/60'
      : 'border-outline-variant/30 bg-gradient-to-r from-surface-container-low to-surface-container';
  const iconClass = isHard
    ? 'bg-error text-on-error'
    : isUrgent
      ? 'bg-primary text-on-primary'
      : 'bg-primary/10 text-primary';
  const titleClass = isHard ? 'text-on-error-container' : 'text-on-surface';
  const bodyClass = isHard
    ? 'text-on-error-container/80'
    : 'text-on-surface-variant';

  // Copy
  const resourceNoun = state.resource === 'ai' ? 'utilisations IA' : 'documents';
  const resourceVerb = state.resource === 'ai' ? 'utilisée' : 'créé';

  let title: string;
  let body: string;
  let cta: string;

  if (isHard) {
    title = state.resource === 'ai'
      ? 'Quota IA atteint pour ce mois'
      : 'Quota mensuel atteint';
    body = state.resource === 'ai'
      ? `Vous avez utilisé vos ${state.limit} ${resourceNoun} gratuites. Passez à Starter pour 50 utilisations / mois (ou Pro pour l'illimité).`
      : `Vous avez créé ${state.limit} ${resourceNoun} ce mois-ci. Passez à un plan payant pour continuer à facturer sans limite.`;
    cta = 'Voir les plans';
  } else if (isUrgent) {
    title = state.resource === 'ai'
      ? `Plus que ${state.remaining} utilisation${state.remaining > 1 ? 's' : ''} IA ce mois-ci`
      : `Plus que ${state.remaining} document${state.remaining > 1 ? 's' : ''} gratuit${state.remaining > 1 ? 's' : ''} ce mois-ci`;
    body = state.resource === 'ai'
      ? 'Évitez l\'interruption — Starter offre 50 utilisations IA / mois.'
      : 'Passez à Starter pour facturer sans limite (et garder l\'IA).';
    cta = 'Comparer les plans';
  } else {
    title = state.resource === 'ai'
      ? `${state.used} / ${state.limit} ${resourceNoun}`
      : `${state.used} / ${state.limit} ${resourceNoun} ce mois-ci`;
    body = state.resource === 'ai'
      ? `Pour 9 € / mois, l'IA tourne 50 fois — vous gagnez ~${Math.max(45, 50 * 2)} minutes par mois sur la saisie.`
      : 'Vous êtes bien lancé. Anticipez la limite avec Starter (illimité, 9 €/mois).';
    cta = 'Découvrir Starter';
  }

  const handleCtaClick = () => {
    track('clicked_upgrade_plan', {
      surface,
      quota_resource: state.resource,
      used: state.used,
      limit: state.limit,
    });
  };

  return (
    <section
      role={isHard ? 'alert' : 'status'}
      className={`mb-6 flex flex-col gap-4 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between md:p-5 ${containerClass} ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className={`mb-1 text-base font-bold leading-tight font-headline ${titleClass}`}>
            {title}
          </h3>
          <p className={`text-sm leading-relaxed ${bodyClass}`}>
            {body}
          </p>
          {/* Progress bar — only on soft thresholds */}
          {!isHard && (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-outline-variant/20">
                <div
                  className={`h-full rounded-full transition-all ${isUrgent ? 'bg-primary' : 'bg-primary/60'}`}
                  style={{ width: `${Math.round(state.ratio * 100)}%` }}
                />
              </div>
              <span className={`text-xs font-medium ${bodyClass}`}>
                {state.used}/{state.limit} {resourceVerb}{state.used !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      <Link
        to="/app/upgrade"
        onClick={handleCtaClick}
        className={`btn-glow inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-spark-cta transition-all hover:shadow-xl active:scale-95 font-headline ${
          isHard
            ? 'bg-error text-on-error hover:bg-error/90'
            : 'bg-primary text-on-primary hover:bg-primary-dim'
        }`}
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

export default UpsellBanner;
