import { useMemo, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MiniDevisDemoProps {
  /** Texte d'exemple pré-rempli pour suggérer ce que l'utilisateur peut taper. */
  examplePlaceholder?: string;
  /** Texte au-dessus de la zone de saisie. */
  helper?: string;
  /** Quand l'utilisateur clique le CTA d'inscription, on emmène ici. */
  registerHref?: string;
}

interface DevisLine {
  label: string;
  detail: string;
  amountHT: number;
}

const FALLBACK_PRESTATION = 'Prestation principale décrite par le client';

const eurFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function summarisePrestation(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  if (!cleaned) return FALLBACK_PRESTATION;
  // Garder la première proposition la plus parlante : on coupe à la première
  // séparation forte ("+", virgule, "et"), sinon on garde 80 char max.
  const segment =
    cleaned
      .split(/\s*(?:\+|,| et )\s*/i)
      .find(part => part.length > 3) || cleaned;
  return segment.length > 80
    ? segment.slice(0, 78).trimEnd() + '…'
    : segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function MiniDevisDemo({
  examplePlaceholder = 'Ex : remplacement robinet cuisine + déplacement + raccordement',
  helper = 'Décrivez votre intervention comme vous le diriez à un collègue.',
  registerHref = '/inscription?mode=register',
}: MiniDevisDemoProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const lines: DevisLine[] = useMemo(() => {
    const prestation = summarisePrestation(input || examplePlaceholder.replace(/^Ex\s*:\s*/i, ''));
    return [
      { label: 'Déplacement', detail: 'Forfait aller-retour', amountHT: 35 },
      { label: 'Main-d’œuvre', detail: '2 h × 45 €/h', amountHT: 90 },
      { label: 'Prestation principale', detail: prestation, amountHT: 120 },
    ];
  }, [input, examplePlaceholder]);

  const totalHT = lines.reduce((sum, l) => sum + l.amountHT, 0);
  const tva = +(totalHT * 0.2).toFixed(2);
  const totalTTC = +(totalHT + tva).toFixed(2);

  return (
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6 items-stretch">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-3">
          Mini démo
        </div>
        <h2 className="font-headline font-extrabold text-3xl md:text-[38px] text-secondary-dim mb-3 leading-tight">
          Essayez avec une prestation réelle.
        </h2>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {helper} Photofacto vous montre un aperçu structuré, puis vous créez un compte pour modifier les lignes, ajouter votre logo et télécharger le PDF.
        </p>
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
          Décrivez votre intervention
        </label>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={examplePlaceholder}
          className="w-full min-h-[104px] bg-background border-spark rounded-2xl px-4 py-3 focus:ring-2 focus:ring-primary/20 text-sm resize-none"
        />
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="mt-3 w-full min-touch bg-primary text-white rounded-xl py-3 text-sm font-bold shadow-spark-cta flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
        >
          Préparer un devis
          <Sparkles className="w-4 h-4" />
        </button>

        {submitted && (
          <div className="mt-4 bg-primary/[0.06] border border-primary/[0.18] rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Aperçu de devis · brouillon
              </div>
              <div className="text-[10px] text-on-surface-variant">
                Estimatif — modifiable dans l'app
              </div>
            </div>

            <div className="bg-white rounded-xl border-spark divide-y divide-on-surface-variant/10">
              {lines.map((l, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Ligne {i + 1} · {l.label}
                    </div>
                    <div className="text-[13px] text-on-surface mt-0.5 truncate">
                      {l.detail}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-secondary-dim whitespace-nowrap">
                    {eurFormatter.format(l.amountHT)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 bg-white rounded-xl border-spark px-3.5 py-3 text-sm">
              <div className="flex justify-between text-on-surface-variant">
                <span>Total HT</span>
                <span className="font-semibold">{eurFormatter.format(totalHT)}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant mt-1">
                <span>TVA 20 %</span>
                <span className="font-semibold">{eurFormatter.format(tva)}</span>
              </div>
              <div className="flex justify-between text-secondary-dim mt-1.5 pt-1.5 border-t border-on-surface-variant/10">
                <span className="font-bold">Total estimatif TTC</span>
                <span className="font-extrabold">{eurFormatter.format(totalTTC)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(registerHref)}
              className="mt-4 w-full min-touch inline-flex items-center justify-center gap-2 bg-secondary-dim text-white rounded-xl py-3 text-xs font-bold"
            >
              Créer un compte pour modifier et télécharger
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
