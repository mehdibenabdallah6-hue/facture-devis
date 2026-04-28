import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, CreditCard, CheckCircle2, AlertCircle, ArrowUpRight, Package, Palette, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlan } from '../hooks/usePlan';
import ReferralCard from '../components/ReferralCard';
import { PLAN_DISPLAY_NAMES } from '../lib/billing';

export default function Settings() {
  const { company, saveCompany } = useData();
  const { user } = useAuth();
  const { plan, hasPaidAccess, isPendingActivation } = usePlan();

  const [formData, setFormData] = useState({
    name: '',
    profession: '',
    address: '',
    siret: '',
    vatNumber: '',
    legalForm: '',
    capital: 0,
    vatRegime: 'standard' as 'standard' | 'franchise' | 'autoliquidation',
    decennale: '',
    rcPro: '',
    invoicePrefix: 'F-',
    defaultPaymentTerms: 30,
    defaultCurrency: 'EUR',
    defaultVat: 20,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        profession: company.profession || '',
        address: company.address || '',
        siret: company.siret || '',
        vatNumber: company.vatNumber || '',
        legalForm: company.legalForm || '',
        capital: company.capital || 0,
        vatRegime: company.vatRegime || 'standard',
        decennale: company.decennale || '',
        rcPro: company.rcPro || '',
        invoicePrefix: company.invoicePrefix || 'F-',
        defaultPaymentTerms: company.defaultPaymentTerms || 30,
        defaultCurrency: company.defaultCurrency || 'EUR',
        defaultVat: company.defaultVat || 20,
      });
    }
  }, [company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveCompany(formData);
      setSaved(true);
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    } catch {
      // saveCompany already surfaces a toast; just don't flip to "Saved".
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-8 max-w-4xl mx-auto min-w-0 w-full">
      <header className="animate-fade-in-up min-w-0">
        <h1 className="font-headline text-[26px] md:text-4xl font-extrabold text-on-surface tracking-tight mb-1 leading-tight">Paramètres</h1>
        <p className="text-on-surface-variant font-medium text-sm md:text-lg leading-snug">Gérez les informations de votre entreprise et vos préférences.</p>
      </header>

      <div className="animate-fade-in-up animation-delay-100 bg-primary-container/30 border-2 border-primary/20 p-4 md:p-6 rounded-2xl flex flex-row md:flex-row items-start gap-3 md:gap-4 min-w-0">
        <div className="w-11 h-11 md:w-16 md:h-16 bg-primary/10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
          <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-primary" />
        </div>
        <div className="text-left min-w-0 flex-1">
          <h3 className="font-bold text-primary text-base md:text-lg mb-1 font-headline leading-tight">Facturation électronique 2026</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed">Photofacto génère des factures au format Factur-X (standard officiel 2026). <span className="text-primary font-medium">Connexion directe Chorus Pro / PPF : Bientôt disponible.</span></p>
        </div>
      </div>

      <div className="animate-fade-in-up animation-delay-200 card-hover bg-surface-container-lowest border border-outline-variant/10 p-4 md:p-8 rounded-2xl flex flex-col items-start gap-4 md:gap-6 shadow-sm min-w-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-4 md:gap-6 text-left min-w-0">
          <div className="flex items-center gap-3 md:gap-5 min-w-0 flex-1">
            <div className={`w-11 h-11 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${plan !== 'free' ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-container-high text-on-surface-variant'}`}>
              <CreditCard className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-on-surface mb-1 text-base md:text-lg font-headline">Abonnement</h3>
              {hasPaidAccess ? (
                <p className="text-sm text-on-surface-variant flex items-center justify-center sm:justify-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-tertiary" /> 
                  <span className="font-bold text-tertiary">Actif</span> Plan {PLAN_DISPLAY_NAMES[plan]}
                </p>
              ) : isPendingActivation ? (
                <p className="text-sm text-on-surface-variant flex items-center justify-center sm:justify-start gap-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  <span className="font-bold text-primary">Activation en cours</span>
                </p>
              ) : (
                <p className="text-sm text-on-surface-variant">Plan actuel : <span className="font-bold text-on-surface text-base">Gratuit</span></p>
              )}
            </div>
          </div>
          {!hasPaidAccess && !isPendingActivation ? (
            <Link to="/app/upgrade" className="btn-glow min-touch bg-secondary text-on-secondary px-5 md:px-8 py-3 md:py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-secondary/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all w-full sm:w-auto text-center">
              Voir les offres
            </Link>
          ) : (
            <Link
              to="/app/abonnement"
              className="min-touch bg-surface-container hover:bg-surface-container-highest text-on-surface px-5 md:px-6 py-3 rounded-xl font-medium text-sm transition-all w-full sm:w-auto inline-flex items-center justify-center gap-2"
            >
              Gérer mon abonnement
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          )}
        </div>
        
        {hasPaidAccess && (
          <div className="w-full bg-surface-container-low p-3.5 md:p-4 rounded-xl flex items-start gap-3 mt-1 md:mt-2 border border-outline-variant/20">
            <AlertCircle className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" />
            <div className="text-sm text-on-surface-variant">
              <p className="font-bold text-on-surface mb-1">Pour annuler ou modifier votre carte bancaire :</p>
              <p>Un lien de gestion sécurisé vous a été envoyé par e-mail (via Paddle) lors de votre paiement. Vous pouvez l'utiliser à tout moment pour gérer votre abonnement, ou contacter notre support.</p>
            </div>
          </div>
        )}
      </div>

      {/* Referral Section */}
      {user && (
        <div className="animate-fade-in-up animation-delay-200">
          <ReferralCard userId={user.uid} company={company} referralCount={company?.referralCount || 0} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 md:space-y-8 animate-fade-in-up animation-delay-300">
        <section className="bg-surface-container-lowest rounded-2xl p-4 md:p-10 shadow-sm border border-outline-variant/10 space-y-5 md:space-y-6">
          <h2 className="text-xl md:text-2xl font-extrabold font-headline text-on-surface">Entreprise</h2>
          
          <div className="space-y-4 md:space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Nom de l'entreprise *</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Métier</label>
                <input 
                  type="text" 
                  value={formData.profession}
                  onChange={e => setFormData({...formData, profession: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Adresse complète</label>
              <textarea 
                rows={3}
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm resize-none font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">SIRET</label>
                <input 
                  type="text" 
                  value={formData.siret}
                  onChange={e => setFormData({...formData, siret: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium uppercase font-sans tracking-wide"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">N° TVA Intracommunautaire</label>
                <input 
                  type="text" 
                  value={formData.vatNumber}
                  onChange={e => setFormData({...formData, vatNumber: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium uppercase font-sans tracking-wide"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Forme juridique</label>
                <input 
                  type="text" 
                  placeholder="ex: SASU, SARL, Auto-entrepreneur"
                  value={formData.legalForm}
                  onChange={e => setFormData({...formData, legalForm: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Capital social (€)</label>
                <input 
                  type="number" 
                  value={formData.capital || ''}
                  onChange={e => setFormData({...formData, capital: parseFloat(e.target.value) || 0})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Assurance Décennale</label>
                <input 
                  type="text" 
                  placeholder="Compagnie, contrat..."
                  value={formData.decennale}
                  onChange={e => setFormData({...formData, decennale: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Assurance RC Pro</label>
                <input 
                  type="text" 
                  placeholder="Compagnie, contrat..."
                  value={formData.rcPro}
                  onChange={e => setFormData({...formData, rcPro: e.target.value})}
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
            </div>
          </div>
        </section>

        {/*
          Catalogue & Design used to live as in-page sections here. They now
          have dedicated top-level pages — this is just a launcher row so
          users who land in old bookmarks still find their way.
        */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <Link
            to="/app/catalog"
            className="group bg-surface-container-lowest border border-outline-variant/10 hover:border-primary/30 rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Package className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold font-headline text-on-surface text-base md:text-lg leading-tight">
                Catalogue
              </h3>
              <p className="text-xs md:text-sm text-on-surface-variant font-medium leading-snug">
                Vos prix pour que l'IA remplisse les factures.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            to="/app/design"
            className="group bg-surface-container-lowest border border-outline-variant/10 hover:border-primary/30 rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Palette className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold font-headline text-on-surface text-base md:text-lg leading-tight">
                Design
              </h3>
              <p className="text-xs md:text-sm text-on-surface-variant font-medium leading-snug">
                Modèle, logo, couleur appliqués à toutes vos factures.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        </section>

        <section className="bg-surface-container-lowest rounded-2xl p-4 md:p-10 shadow-sm border border-outline-variant/10 space-y-5 md:space-y-6">
          <h2 className="text-xl md:text-2xl font-extrabold font-headline text-on-surface">Facturation</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Régime de TVA</label>
              <select 
                value={formData.vatRegime}
                onChange={e => setFormData({...formData, vatRegime: e.target.value as any})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
              >
                <option value="standard">Standard (assujetti à la TVA)</option>
                <option value="franchise">Franchise en base de TVA (Auto-entrepreneur)</option>
                <option value="autoliquidation">Autoliquidation (Sous-traitance BTP)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Préfixe des factures</label>
              <input 
                type="text" 
                value={formData.invoicePrefix}
                onChange={e => setFormData({...formData, invoicePrefix: e.target.value})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium text-center md:text-left tracking-widest"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Délai par défaut (jours)</label>
              <input 
                type="number" 
                value={formData.defaultPaymentTerms}
                onChange={e => setFormData({...formData, defaultPaymentTerms: parseInt(e.target.value) || 0})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Devise par défaut</label>
              <select 
                value={formData.defaultCurrency}
                onChange={e => setFormData({...formData, defaultCurrency: e.target.value})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
              >
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar ($)</option>
                <option value="CHF">Franc Suisse (CHF)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">TVA par défaut (%)</label>
              <select 
                value={formData.defaultVat}
                onChange={e => setFormData({...formData, defaultVat: parseFloat(e.target.value) || 0})}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
              >
                <option value="20">20%</option>
                <option value="10">10%</option>
                <option value="5.5">5.5%</option>
                <option value="0">0%</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse sm:flex-row items-center gap-3 md:gap-4 pt-2 md:pt-4">
          {saved && (
             <span className="animate-fade-in flex items-center gap-2 text-tertiary font-bold text-sm bg-tertiary-container px-4 py-2 rounded-xl">
               <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
               Paramètres sauvegardés
             </span>
          )}
          <button 
            type="submit" 
            disabled={isSaving}
            className="btn-glow min-touch sm:ml-auto w-full sm:w-auto bg-primary text-on-primary px-7 md:px-10 py-3.5 md:py-4 rounded-xl font-bold text-base shadow-spark-cta hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:transform-none"
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
