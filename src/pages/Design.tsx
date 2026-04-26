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
} from 'lucide-react';
import { compressImageToDataURL } from '../services/imageUtils';

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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {TEMPLATES.map(t => {
            const isSelected = formData.pdfTemplate === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, pdfTemplate: t.id }))}
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

      {/* Import design (deferred) */}
      <section className="animate-fade-in-up animation-delay-300 bg-tertiary/5 border-2 border-dashed border-tertiary/30 rounded-2xl p-5 md:p-7">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-tertiary/15 text-tertiary flex items-center justify-center shrink-0">
            <Wand2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-base md:text-lg font-extrabold font-headline text-on-surface">
                Importer une ancienne facture pour reproduire votre design
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-widest text-tertiary bg-tertiary/15 px-2 py-0.5 rounded-full">
                Bientôt
              </span>
            </div>
            <p className="text-sm text-on-surface-variant">
              Photofacto analysera votre facture (PDF ou photo), récupérera votre logo, votre
              couleur et la mise en page, puis appliquera ce style à toutes vos prochaines
              factures.
            </p>
          </div>
        </div>
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
