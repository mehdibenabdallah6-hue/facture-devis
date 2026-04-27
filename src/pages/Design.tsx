import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import {
  Palette,
  Upload,
  X,
  CheckCircle2,
  Sparkles,
  Image as ImageIcon,
  Wand2,
  FileText,
  Briefcase,
  HardHat,
  Loader2,
} from 'lucide-react';
import { compressImageToDataURL } from '../services/imageUtils';

/**
 * Sample the dominant non-neutral colour of an image (returned as #RRGGBB).
 * We bucket pixels in a coarse 3-bit-per-channel grid (8×8×8 = 512 buckets)
 * after filtering out near-white / near-black / near-grey pixels — that
 * leaves the saturated brand-coloured pixels (logo header, accent stripes)
 * which are exactly what we want to lift off an existing invoice.
 */
async function extractAccentColor(dataUrl: string): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 240;
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;

        type Bucket = { count: number; r: number; g: number; b: number };
        const buckets = new Map<string, Bucket>();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lum = (r + g + b) / 3;
          // Skip background paper (≈white) and ink/text (≈black) and greys.
          if (lum > 235 || lum < 25) continue;
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat < 0.28) continue;
          const key = `${r >> 5}|${g >> 5}|${b >> 5}`;
          const bucket = buckets.get(key);
          if (bucket) {
            bucket.count++;
            bucket.r += r;
            bucket.g += g;
            bucket.b += b;
          } else {
            buckets.set(key, { count: 1, r, g, b });
          }
        }

        if (buckets.size === 0) return resolve(null);
        let best: Bucket | null = null;
        buckets.forEach(v => {
          if (!best || v.count > best.count) best = v;
        });
        if (!best) return resolve(null);
        const finalBucket: Bucket = best;
        const r = Math.round(finalBucket.r / finalBucket.count);
        const g = Math.round(finalBucket.g / finalBucket.count);
        const b = Math.round(finalBucket.b / finalBucket.count);
        const hex =
          '#' +
          [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
        resolve(hex);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

type TemplateId = 'moderne' | 'classique' | 'chantier';

const TEMPLATES: {
  id: TemplateId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  preview: React.ReactNode;
}[] = [
  {
    id: 'moderne',
    label: 'Moderne',
    desc: 'Épuré, beaucoup de blanc, accent coloré.',
    icon: Sparkles,
    preview: (
      <div className="w-full aspect-[1/1.2] bg-white rounded-lg shadow-inner overflow-hidden flex flex-col">
        <div className="h-2 bg-primary" />
        <div className="p-2 flex-1 flex flex-col gap-1">
          <div className="h-2 w-1/3 bg-on-surface/80 rounded" />
          <div className="h-1.5 w-1/2 bg-on-surface-variant/40 rounded" />
          <div className="mt-2 flex flex-col gap-0.5">
            <div className="h-1 bg-on-surface-variant/30 rounded" />
            <div className="h-1 bg-on-surface-variant/30 rounded w-5/6" />
            <div className="h-1 bg-on-surface-variant/30 rounded w-4/6" />
          </div>
          <div className="mt-auto h-2 w-1/3 self-end bg-primary/70 rounded" />
        </div>
      </div>
    ),
  },
  {
    id: 'classique',
    label: 'Classique',
    desc: 'Cadre noir, mise en page traditionnelle.',
    icon: Briefcase,
    preview: (
      <div className="w-full aspect-[1/1.2] bg-white rounded-lg shadow-inner overflow-hidden flex flex-col border border-on-surface/30">
        <div className="p-2 flex-1 flex flex-col gap-1">
          <div className="h-2 w-1/2 bg-on-surface/80 rounded-sm" />
          <div className="h-px w-full bg-on-surface/50 my-1" />
          <div className="flex flex-col gap-0.5">
            <div className="h-1 bg-on-surface-variant/40 rounded" />
            <div className="h-1 bg-on-surface-variant/40 rounded w-5/6" />
            <div className="h-1 bg-on-surface-variant/40 rounded w-4/6" />
          </div>
          <div className="h-px w-full bg-on-surface/50 my-1" />
          <div className="mt-auto h-2 w-1/3 self-end bg-on-surface/80 rounded-sm" />
        </div>
      </div>
    ),
  },
  {
    id: 'chantier',
    label: 'Chantier',
    desc: 'Accent jaune/orange, lisible sur photo.',
    icon: HardHat,
    preview: (
      <div className="w-full aspect-[1/1.2] bg-white rounded-lg shadow-inner overflow-hidden flex flex-col">
        <div className="h-3 bg-amber-500" />
        <div className="p-2 flex-1 flex flex-col gap-1">
          <div className="h-2 w-1/3 bg-on-surface rounded" />
          <div className="h-1.5 w-1/2 bg-amber-600/70 rounded" />
          <div className="mt-2 flex flex-col gap-0.5">
            <div className="h-1 bg-on-surface-variant/30 rounded" />
            <div className="h-1 bg-on-surface-variant/30 rounded w-5/6" />
            <div className="h-1 bg-on-surface-variant/30 rounded w-4/6" />
          </div>
          <div className="mt-auto h-2 w-1/3 self-end bg-amber-500 rounded" />
        </div>
      </div>
    ),
  },
];

const PRESET_COLORS = ['#E8621A', '#6750A4', '#1d4ed8', '#0d9488', '#dc2626', '#0f172a'];

// Each template has a signature accent color. Picking a template shifts the
// accent to its default so the choice is immediately reflected in the PDF;
// users can still override afterwards via the color picker.
const TEMPLATE_DEFAULT_COLORS: Record<TemplateId, string> = {
  moderne: '#E8621A',
  classique: '#1F2937',
  chantier: '#F59E0B',
};

/**
 * Design page — top-level (was previously a section inside Settings).
 *
 * Two big ideas:
 *  1. Pick a template (Moderne / Classique / Chantier)
 *  2. Personalise it (logo, accent color, footer text, papier en-tête)
 *
 * Future: extract design from an uploaded existing invoice (deferred).
 *
 * Whatever the user picks here is auto-applied to every PDF export — no
 * per-document choice needed.
 */
export default function Design() {
  const { company, saveCompany } = useData();
  const letterheadRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    pdfTemplate: 'moderne' as TemplateId,
    pdfAccentColor: '#E8621A',
    pdfFooterText: '',
    letterheadUrl: '',
    logoUrl: '',
    hideCompanyInfo: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // "Import an old invoice for design" — preview state shown after the user
  // picks a file but before they confirm "Apply". Lets them see the detected
  // colour and the page that will become their letterhead before overwriting
  // their current customisation.
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    imageUrl: string;
    accentColor: string | null;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (company) {
      setFormData({
        pdfTemplate: (company.pdfTemplate as TemplateId) || 'moderne',
        pdfAccentColor: company.pdfAccentColor || '#E8621A',
        pdfFooterText: company.pdfFooterText || '',
        letterheadUrl: company.letterheadUrl || '',
        logoUrl: company.logoUrl || '',
        hideCompanyInfo: company.hideCompanyInfo || false,
      });
    }
  }, [company]);

  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataURL(file, 2000, 0.75);
      setFormData(prev => ({ ...prev, letterheadUrl: dataUrl }));
    } catch (err) {
      console.error('Erreur papier:', err);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataURL(file, 600, 0.85);
      setFormData(prev => ({ ...prev, logoUrl: dataUrl }));
    } catch (err) {
      console.error('Erreur logo:', err);
    }
  };

  const handleImportInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still triggers onChange.
    if (e.target) e.target.value = '';
    if (!file) return;
    setImportError(null);
    setIsImporting(true);
    try {
      // PDFs aren't decoded client-side without pdfjs-dist. Friendly message
      // tells the user how to get an image instead.
      if (file.type === 'application/pdf') {
        throw new Error(
          "Les PDF ne sont pas encore supportés. Faites une capture d'écran de la première page (PNG ou JPG) et réessayez.",
        );
      }
      const dataUrl = await compressImageToDataURL(file, 2000, 0.78);
      const accentColor = await extractAccentColor(dataUrl);
      setImportPreview({ imageUrl: dataUrl, accentColor });
    } catch (err) {
      console.error('Erreur import facture:', err);
      setImportError(
        err instanceof Error
          ? err.message
          : "Impossible d'analyser cette facture. Essayez avec une image PNG ou JPG.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const applyImportedDesign = () => {
    if (!importPreview) return;
    setFormData(prev => ({
      ...prev,
      letterheadUrl: importPreview.imageUrl,
      pdfAccentColor: importPreview.accentColor || prev.pdfAccentColor,
      // Letterhead presumably already has the company's name/address/SIRET
      // printed on it — hide the auto block to avoid duplication.
      hideCompanyInfo: true,
    }));
    setImportPreview(null);
    setImportError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveCompany(formData);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-5 md:space-y-8 max-w-5xl mx-auto min-w-0 w-full pb-24">
      {/* Hero */}
      <header className="animate-fade-in-up min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-primary">
            Design
          </span>
        </div>
        <h1 className="font-headline text-[26px] md:text-4xl font-extrabold text-on-surface tracking-tight mb-2 leading-tight">
          Votre style, sur toutes vos factures.
        </h1>
        <p className="text-on-surface-variant font-medium text-sm md:text-lg leading-snug max-w-3xl">
          Choisissez un modèle, ajoutez votre logo et votre couleur. Photofacto applique
          automatiquement votre style à <strong>chaque PDF</strong>, devis ou facture.
        </p>
      </header>

      {/* Templates */}
      <section className="animate-fade-in-up animation-delay-100 bg-surface-container-lowest rounded-2xl p-5 md:p-7 shadow-sm border border-outline-variant/10">
        <div className="mb-4 md:mb-5">
          <h2 className="text-lg md:text-xl font-extrabold font-headline text-on-surface">
            1. Choisissez un modèle
          </h2>
          <p className="text-sm text-on-surface-variant font-medium">
            Trois styles pensés pour les artisans.
          </p>
        </div>

        <p className="text-[11px] text-on-surface-variant mb-3">
          Choisir un modèle ajuste aussi la couleur d'accent — vous pouvez la personnaliser
          ensuite.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {TEMPLATES.map(t => {
            const isSelected = formData.pdfTemplate === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setFormData(prev => ({
                    ...prev,
                    pdfTemplate: t.id,
                    // Sync accent to the template's signature color so the
                    // choice is visible in PDF output. User can still tweak
                    // the color afterwards.
                    pdfAccentColor: TEMPLATE_DEFAULT_COLORS[t.id],
                  }))
                }
                className={`text-left rounded-2xl p-3 md:p-4 transition-all border-2 ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                    : 'border-outline-variant/20 bg-surface-container-low hover:border-primary/40 hover:bg-primary/5'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <t.icon
                      className={`w-4 h-4 ${
                        isSelected ? 'text-primary' : 'text-on-surface-variant'
                      }`}
                    />
                    <span className="font-extrabold text-sm md:text-base text-on-surface">
                      {t.label}
                    </span>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-primary" aria-label="Sélectionné" />
                  )}
                </div>
                <div className="bg-surface-container-high rounded-xl p-3">{t.preview}</div>
                <p className="text-xs text-on-surface-variant mt-3 leading-snug">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Customization */}
      <section className="animate-fade-in-up animation-delay-200 bg-surface-container-lowest rounded-2xl p-5 md:p-7 shadow-sm border border-outline-variant/10 space-y-6">
        <div>
          <h2 className="text-lg md:text-xl font-extrabold font-headline text-on-surface">
            2. Personnalisez
          </h2>
          <p className="text-sm text-on-surface-variant font-medium">
            Logo, couleur, signature de bas de page.
          </p>
        </div>

        {/* Logo */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:gap-6 items-start">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Logo
            </label>
            <input
              type="file"
              accept="image/jpeg, image/png, image/webp"
              className="hidden"
              ref={logoRef}
              onChange={handleLogoUpload}
            />
            <button
              type="button"
              onClick={() => logoRef.current?.click()}
              className="min-touch w-full border-2 border-dashed border-outline-variant/50 hover:border-primary bg-surface-container hover:bg-primary/5 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors"
            >
              <ImageIcon className="w-5 h-5 text-on-surface-variant" />
              <span className="text-sm font-bold text-on-surface">
                {formData.logoUrl ? 'Changer le logo' : 'Importer un logo (PNG, JPG)'}
              </span>
            </button>
            {formData.logoUrl && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                className="text-error text-xs font-bold flex items-center gap-1 hover:underline"
              >
                <X className="w-3.5 h-3.5" /> Retirer le logo
              </button>
            )}
          </div>
          {formData.logoUrl && (
            <div className="bg-white border border-outline-variant/20 rounded-xl p-3 w-32 h-32 flex items-center justify-center shrink-0">
              <img
                src={formData.logoUrl}
                alt="Logo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Accent color */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Couleur d'accent
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {PRESET_COLORS.map(color => {
              const isSelected = formData.pdfAccentColor.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, pdfAccentColor: color }))}
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    isSelected
                      ? 'border-on-surface scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ background: color }}
                  aria-label={`Couleur ${color}`}
                />
              );
            })}
            <div className="flex items-center gap-2 ml-1">
              <input
                type="color"
                value={formData.pdfAccentColor}
                onChange={e =>
                  setFormData(prev => ({ ...prev, pdfAccentColor: e.target.value }))
                }
                className="w-10 h-10 rounded-full border-2 border-outline-variant/30 cursor-pointer bg-transparent"
                aria-label="Couleur personnalisée"
              />
              <span className="text-xs text-on-surface-variant font-mono">
                {formData.pdfAccentColor}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Texte de bas de page
          </label>
          <input
            type="text"
            placeholder='Ex : "Merci de votre confiance — paiement par virement"'
            value={formData.pdfFooterText}
            onChange={e =>
              setFormData(prev => ({ ...prev, pdfFooterText: e.target.value }))
            }
            className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
          />
          <p className="text-[11px] text-on-surface-variant mt-1.5">
            Apparaît en bas de chaque facture / devis exporté.
          </p>
        </div>

        {/* Letterhead */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Papier à en-tête (optionnel)
          </label>
          <p className="text-xs text-on-surface-variant mb-3">
            Image complète A4 (logo + bordures) qui remplace l'en-tête généré.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="space-y-2">
              <input
                type="file"
                accept="image/jpeg, image/png, image/webp"
                className="hidden"
                ref={letterheadRef}
                onChange={handleLetterheadUpload}
              />
              <button
                type="button"
                onClick={() => letterheadRef.current?.click()}
                className="min-touch w-full border-2 border-dashed border-outline-variant/50 hover:border-primary bg-surface-container hover:bg-primary/5 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors"
              >
                <Upload className="w-5 h-5 text-on-surface-variant" />
                <span className="text-sm font-bold text-on-surface">
                  {formData.letterheadUrl ? 'Changer le papier' : 'Importer un papier en-tête'}
                </span>
              </button>
              {formData.letterheadUrl && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData(prev => ({ ...prev, letterheadUrl: '' }))
                    }
                    className="text-error text-xs font-bold flex items-center gap-1 hover:underline"
                  >
                    <X className="w-3.5 h-3.5" /> Retirer le papier
                  </button>
                  <label className="flex items-center gap-3 p-3 bg-surface-container-high rounded-xl cursor-pointer hover:bg-surface-container-highest transition-colors mt-2">
                    <input
                      type="checkbox"
                      checked={formData.hideCompanyInfo}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          hideCompanyInfo: e.target.checked,
                        }))
                      }
                      className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/20"
                    />
                    <span className="text-xs font-medium text-on-surface">
                      Mon papier contient déjà mon nom, adresse et SIRET — masquer le bloc texte
                      automatique.
                    </span>
                  </label>
                </>
              )}
            </div>
            {formData.letterheadUrl && (
              <div className="bg-surface-container-high rounded-xl p-2 aspect-[1/1.414] shadow-inner overflow-hidden w-32 mx-auto md:mx-0 border border-outline-variant/20">
                <img
                  src={formData.letterheadUrl}
                  alt="Papier en-tête"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Import design from an existing invoice */}
      <section className="animate-fade-in-up animation-delay-300 bg-tertiary/5 border-2 border-tertiary/30 rounded-2xl p-5 md:p-7">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-tertiary/15 text-tertiary flex items-center justify-center shrink-0">
            <Wand2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base md:text-lg font-extrabold font-headline text-on-surface mb-1">
              Importer une ancienne facture pour reproduire votre design
            </h2>
            <p className="text-sm text-on-surface-variant">
              Photofacto détecte votre couleur d'accent et utilise l'image comme papier
              à en-tête. Vos prochaines factures reprennent le même style.
            </p>
          </div>
        </div>

        <input
          type="file"
          accept="image/jpeg, image/png, image/webp"
          className="hidden"
          ref={importRef}
          onChange={handleImportInvoice}
        />

        {!importPreview ? (
          <>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              disabled={isImporting}
              className="min-touch w-full border-2 border-dashed border-tertiary/40 hover:border-tertiary bg-surface-container hover:bg-tertiary/5 rounded-xl px-4 py-4 flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-5 h-5 text-tertiary animate-spin" />
                  <span className="text-sm font-bold text-on-surface">
                    Analyse de votre facture...
                  </span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-tertiary" />
                  <span className="text-sm font-bold text-on-surface">
                    Importer une ancienne facture (PNG ou JPG)
                  </span>
                </>
              )}
            </button>
            {importError && (
              <p className="text-xs text-error font-medium mt-2">{importError}</p>
            )}
            <p className="text-[11px] text-on-surface-variant mt-2">
              Astuce : pour un PDF, faites une capture d'écran de la première page.
            </p>
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-start bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4">
              <div className="bg-white border border-outline-variant/20 rounded-lg p-1 aspect-[1/1.414] w-32 mx-auto sm:mx-0 overflow-hidden shadow-inner">
                <img
                  src={importPreview.imageUrl}
                  alt="Aperçu de la facture importée"
                  className="w-full h-full object-cover rounded"
                />
              </div>
              <div className="space-y-3 min-w-0">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">
                    Couleur détectée
                  </span>
                  {importPreview.accentColor ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full border-2 border-outline-variant/30 shadow-inner"
                        style={{ background: importPreview.accentColor }}
                        aria-hidden
                      />
                      <span className="text-sm font-mono text-on-surface">
                        {importPreview.accentColor}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-on-surface-variant">
                      Aucune couleur dominante claire — votre couleur actuelle sera conservée.
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1.5">
                    Papier à en-tête
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    L'image servira de fond à vos PDF. Le bloc texte automatique
                    (nom, adresse, SIRET) sera masqué pour éviter les doublons.
                  </span>
                </div>
              </div>
            </div>
            {formData.letterheadUrl && (
              <p className="text-xs text-on-surface bg-amber-100 border border-amber-300 rounded-lg px-3 py-2">
                Vous avez déjà un papier à en-tête — appliquer remplacera l'actuel.
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={applyImportedDesign}
                className="btn-glow flex-1 bg-tertiary text-on-tertiary px-5 py-3 rounded-xl font-bold text-sm shadow-spark-cta active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Appliquer ce design
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportPreview(null);
                  setImportError(null);
                }}
                className="min-touch px-4 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Key reassurance pill */}
      <div className="animate-fade-in-up animation-delay-300 bg-primary/5 border border-primary/15 rounded-2xl p-4 md:p-5 flex items-start gap-3">
        <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-on-surface">
          <strong>Votre style est appliqué automatiquement à toutes vos factures.</strong>{' '}
          Pas besoin d'y revenir à chaque création.
        </p>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-4 z-30 flex justify-end">
        <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-spark-lg px-3 py-2 flex items-center gap-3">
          {saved && (
            <span className="animate-fade-in flex items-center gap-2 text-tertiary font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" /> Sauvegardé
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-glow min-touch bg-primary text-on-primary px-5 md:px-7 py-2.5 md:py-3 rounded-xl font-bold text-sm shadow-spark-cta hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:transform-none"
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer le design'}
          </button>
        </div>
      </div>
    </div>
  );
}
