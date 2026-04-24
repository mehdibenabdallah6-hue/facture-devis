import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { X, AlertCircle, CheckCircle2, Building2, MapPin, ExternalLink, Clock } from 'lucide-react';

interface LegalInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

/**
 * Modal that asks for legal info (address, SIRET, TVA regime) before creating the first invoice.
 * This replaces the old mandatory step-2 onboarding.
 */
export default function LegalInfoModal({ isOpen, onClose, onComplete }: LegalInfoModalProps) {
  const { company, saveCompany } = useData();
  const { success, error: showError } = useToast();

  const [address, setAddress] = useState(company?.address || '');
  const [siret, setSiret] = useState(company?.siret || '');
  const [vatRegime, setVatRegime] = useState<'standard' | 'franchise' | 'autoliquidation'>(
    company?.vatRegime || 'franchise'
  );
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAddress(company?.address || '');
      setSiret(company?.siret || '');
      setVatRegime(company?.vatRegime || 'franchise');
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!address.trim()) {
      showError('Adresse requise', 'L\'adresse est obligatoire sur vos factures.');
      return;
    }
    if (!siret.trim()) {
      showError('SIRET requis', 'Le numéro SIRET est obligatoire sur vos factures.');
      return;
    }
    if (siret.replace(/\s/g, '').length !== 14) {
      showError('SIRET invalide', 'Le SIRET doit contenir exactement 14 chiffres.');
      return;
    }

    setLoading(true);
    try {
      await saveCompany({
        address: address.trim(),
        siret: siret.replace(/\s/g, ''),
        vatRegime,
        updatedAt: new Date().toISOString(),
      });
      success('Profil complété ✓', 'Vos informations légales sont enregistrées.');
      onComplete();
    } catch {
      showError('Erreur', 'Impossible de sauvegarder. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-inverse-surface/60 backdrop-blur-md animate-fade-in">
      <div className="bg-surface-container-lowest rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden border border-outline-variant/10 animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-headline font-bold text-on-surface text-lg">Informations légales</h2>
              <p className="text-xs text-on-surface-variant">Obligatoire pour créer une facture</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container-high transition-colors">
            <X className="w-5 h-5 text-on-surface-variant" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* Explanation */}
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
            <p className="text-sm text-on-surface leading-relaxed">
              En France, chaque facture doit mentionner les informations légales de votre entreprise.
              Ces données apparaîtront automatiquement sur vos factures et devis.
            </p>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              <MapPin className="w-3.5 h-3.5" />
              Adresse de l'entreprise <span className="text-error">*</span>
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="12 rue des Artisans, 75001 Paris"
              className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium resize-none"
            />
          </div>

          {/* SIRET */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              N° SIRET <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={siret}
                onChange={e => setSiret(e.target.value.replace(/[^0-9\s]/g, ''))}
                placeholder="123 456 789 00012"
                maxLength={17}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-base font-mono tracking-wider pr-10"
              />
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary-dim transition-colors"
                title="Où trouver mon SIRET ?"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            {showHint && (
              <div className="bg-surface-container rounded-lg p-3 text-xs text-on-surface-variant leading-relaxed animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-primary" />
                Votre SIRET (14 chiffres) est disponible sur :
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  <li>Votre extrait Kbis</li>
                  <li>Vos courriers URSSAF / impôts</li>
                  <li><a href="https://www.sirene.fr" target="_blank" rel="noopener" className="text-primary hover:underline">sirene.fr</a> (recherche gratuite par nom)</li>
                </ul>
              </div>
            )}
            <p className="text-xs text-on-surface-variant/60 px-1">14 chiffres, sans espaces</p>
          </div>

          {/* TVA Regime — Simplified */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Facturez-vous la TVA ? <span className="text-error">*</span></label>
            <div className="space-y-2">
              <button
                onClick={() => setVatRegime('franchise')}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                  vatRegime === 'franchise'
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant/20 hover:border-primary/30 bg-surface'
                }`}
              >
                <div className={`w-5 h-5 shrink-0 mt-0.5 rounded-full border-2 flex items-center justify-center ${vatRegime === 'franchise' ? 'border-primary bg-primary' : 'border-outline-variant'}`}>
                  {vatRegime === 'franchise' && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <div>
                  <div className={`text-sm font-bold ${vatRegime === 'franchise' ? 'text-primary' : 'text-on-surface'}`}>
                    Non, je ne facture pas la TVA
                  </div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    Auto-entrepreneur / micro-entreprise — mention "TVA non applicable" sur la facture
                  </div>
                </div>
              </button>

              <button
                onClick={() => setVatRegime('standard')}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                  vatRegime === 'standard'
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant/20 hover:border-primary/30 bg-surface'
                }`}
              >
                <div className={`w-5 h-5 shrink-0 mt-0.5 rounded-full border-2 flex items-center justify-center ${vatRegime === 'standard' ? 'border-primary bg-primary' : 'border-outline-variant'}`}>
                  {vatRegime === 'standard' && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <div>
                  <div className={`text-sm font-bold ${vatRegime === 'standard' ? 'text-primary' : 'text-on-surface'}`}>
                    Oui, je facture la TVA
                  </div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    SARL, SAS, EURL… — TVA collectée et déductible
                  </div>
                </div>
              </button>

              <button
                onClick={() => setVatRegime('autoliquidation')}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                  vatRegime === 'autoliquidation'
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant/20 hover:border-primary/30 bg-surface'
                }`}
              >
                <div className={`w-5 h-5 shrink-0 mt-0.5 rounded-full border-2 flex items-center justify-center ${vatRegime === 'autoliquidation' ? 'border-primary bg-primary' : 'border-outline-variant'}`}>
                  {vatRegime === 'autoliquidation' && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <div>
                  <div className={`text-sm font-bold ${vatRegime === 'autoliquidation' ? 'text-primary' : 'text-on-surface'}`}>
                    Autoliquidation (sous-traitance BTP)
                  </div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    Art. 283-2 nonies du CGI — le client final paie la TVA
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <Clock className="w-4 h-4" />
              Plus tard
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="btn-glow flex-1 bg-primary text-on-primary px-6 py-3.5 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-spark-cta"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer et continuer'}
              {!loading && <CheckCircle2 className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-xs text-on-surface-variant/50 text-center -mt-2">
            ⚠️ Ces informations seront obligatoires avant de télécharger ou envoyer une facture.
          </p>
        </div>
      </div>
    </div>
  );
}
