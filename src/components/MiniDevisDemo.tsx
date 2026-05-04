import { useEffect, useState } from 'react';
import { ArrowRight, Camera, CheckCircle2, Mic2, PencilLine, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getMiniDemoMode,
  MINI_DEMO_MODES,
  MINI_DEMO_NOTICE,
  MINI_DEMO_QUOTE_LINES,
  MINI_DEMO_TOTAL_HT,
  MINI_DEMO_TOTAL_TTC,
  MINI_DEMO_VAT,
  MINI_DEMO_VAT_RATE,
  type MiniDemoMode,
} from '../lib/miniDevisDemo';
import { track } from '../services/analytics';

interface MiniDevisDemoProps {
  registerHref?: string;
  page?: string;
}

const eurFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const modeIcons: Record<MiniDemoMode, typeof Camera> = {
  photo: Camera,
  voice: Mic2,
  text: PencilLine,
};

export function MiniDevisDemo({
  registerHref = '/inscription?mode=register',
  page = 'marketing',
}: MiniDevisDemoProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<MiniDemoMode>('photo');
  const [localText, setLocalText] = useState(getMiniDemoMode('text').content);
  const activeMode = getMiniDemoMode(mode);

  useEffect(() => {
    track('demo_viewed', { page });
  }, [page]);

  const handleModeSelect = (nextMode: MiniDemoMode) => {
    setMode(nextMode);
    track('demo_mode_selected', { mode: nextMode, page });
  };

  const handlePrimaryCta = () => {
    track('demo_cta_clicked', { page, cta: 'create_first_quote' });
    navigate(registerHref);
  };

  const displayedContent = mode === 'text' ? localText : activeMode.content;

  return (
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 lg:gap-8 items-stretch">
      <div className="flex flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Mini démo simulée
          </div>
          <h2 className="font-headline font-extrabold text-3xl md:text-[38px] text-secondary-dim mb-3 leading-tight">
            Voyez comment vos notes deviennent un devis
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Photo du carnet, dictée ou texte rapide : Photofacto transforme vos notes en lignes de devis.
            Les prix affichés ici viennent d’un catalogue démo.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/[0.055] p-4 text-sm text-secondary-dim">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="leading-relaxed">
              {MINI_DEMO_NOTICE}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handlePrimaryCta}
            className="min-touch inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-spark-cta transition-all duration-200 hover:-translate-y-0.5 hover:shadow-spark-cta-lg active:scale-[0.98] cursor-pointer"
          >
            Créer mon premier devis
            <ArrowRight className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-on-surface-variant">
            Gratuit · sans carte bancaire
          </span>
        </div>
      </div>

      <div className="rounded-[24px] border-spark bg-white p-4 md:p-5 shadow-spark-sm">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-background p-1.5">
          {MINI_DEMO_MODES.map(item => {
            const Icon = modeIcons[item.id];
            const selected = item.id === mode;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleModeSelect(item.id)}
                className={`min-touch inline-flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-[11px] sm:text-xs font-bold transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                  selected
                    ? 'bg-white text-primary shadow-spark-sm'
                    : 'text-on-surface-variant hover:bg-white/70 hover:text-secondary-dim'
                }`}
                aria-pressed={selected}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid md:grid-cols-[0.95fr_1.05fr] gap-4">
          <div className="rounded-2xl border-spark bg-background p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {activeMode.title}
            </div>
            {mode === 'text' ? (
              <textarea
                value={localText}
                onChange={event => setLocalText(event.target.value)}
                className="mt-3 min-h-[170px] w-full resize-none rounded-xl border border-outline-variant/60 bg-white px-3 py-3 text-sm leading-relaxed text-secondary-dim focus:ring-2 focus:ring-primary/20"
                aria-label="Texte rapide de démonstration local"
              />
            ) : (
              <pre className="mt-3 min-h-[170px] whitespace-pre-wrap rounded-xl border border-outline-variant/60 bg-white px-3 py-3 text-sm leading-relaxed text-secondary-dim font-sans">
                {displayedContent}
              </pre>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-on-surface-variant">
              Aucun fichier n’est envoyé et aucun texte n’est analysé : cette démo publique reste locale et illustrative.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/15 bg-primary/[0.045] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Devis prêt à vérifier
                </div>
                <div className="mt-1 text-xs text-on-surface-variant">
                  Brouillon modifiable avant envoi
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-100">
                  Prix issus du catalogue démo
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 border border-blue-100">
                  Modifiable avant envoi
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border-spark bg-white">
              {MINI_DEMO_QUOTE_LINES.map(line => (
                <div
                  key={line.label}
                  className="flex items-start justify-between gap-3 border-b border-on-surface-variant/10 px-3.5 py-2.5 last:border-b-0"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="text-[13px] font-semibold text-secondary-dim">
                      {line.label}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-sm font-extrabold text-secondary-dim">
                    {eurFormatter.format(line.amountHT)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border-spark bg-white px-3.5 py-3 text-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>Total HT</span>
                <span className="font-semibold">{eurFormatter.format(MINI_DEMO_TOTAL_HT)}</span>
              </div>
              <div className="mt-1 flex justify-between text-on-surface-variant">
                <span>TVA {MINI_DEMO_VAT_RATE} %</span>
                <span className="font-semibold">{eurFormatter.format(MINI_DEMO_VAT)}</span>
              </div>
              <div className="mt-1.5 flex justify-between border-t border-on-surface-variant/10 pt-1.5 text-secondary-dim">
                <span className="font-bold">Total TTC</span>
                <span className="font-extrabold">{eurFormatter.format(MINI_DEMO_TOTAL_TTC)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
