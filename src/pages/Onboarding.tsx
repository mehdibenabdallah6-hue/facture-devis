import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, processReferral } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, ArrowRight, Camera, AlertCircle } from 'lucide-react';

const PROFESSIONS = [
  { name: 'Plombier', emoji: '🔧' },
  { name: 'Électricien', emoji: '⚡' },
  { name: 'Maçon', emoji: '🧱' },
  { name: 'Peintre', emoji: '🎨' },
  { name: 'Menuisier', emoji: '🪚' },
  { name: 'Chauffagiste', emoji: '🔥' },
  { name: 'Serrurier', emoji: '🔑' },
  { name: 'Couvreur', emoji: '🏠' },
  { name: 'Carreleur', emoji: '🏗️' },
  { name: 'Plaquiste', emoji: '🛠️' },
  { name: 'Paysagiste', emoji: '🌳' },
  { name: 'Autre', emoji: '✨' }
];

/**
 * Quick onboarding — only name + profession.
 * Legal info (SIRET, address, TVA) is collected later via LegalInfoModal
 * when the user tries to create their first invoice.
 */
export default function Onboarding() {
  const { user } = useAuth();
  const { company, saveCompany } = useData();
  const { success } = useToast();

  const [companyName, setCompanyName] = useState(company?.name || user?.displayName || '');
  const [profession, setProfession] = useState('');
  const [customProfession, setCustomProfession] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const finalProfession = profession === 'Autre' ? customProfession : profession;

  const handleSave = async () => {
    if (!companyName.trim() || !finalProfession || !user) return;
    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      await saveCompany({
        ...company,
        ownerId: user.uid,
        name: companyName.trim(),
        profession: finalProfession,
        trialStartedAt: company?.trialStartedAt || now,
        subscriptionStatus: company?.subscriptionStatus || 'trial',
        createdAt: company?.createdAt || now,
        updatedAt: now,
        welcomeDiscountExpiry: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });

      // Send welcome email (best effort)
      if (user.email) {
        try {
          const token = await user.getIdToken();
          await fetch('/api/welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              name: user.displayName || companyName.trim(),
            }),
          });
        } catch { /* ignore */ }
      }

      // Process referral
      const referrerId = localStorage.getItem('photofacto_referral');
      if (referrerId && referrerId !== user.uid) {
        await processReferral(user.uid, referrerId);
        localStorage.removeItem('photofacto_referral');
      }

      success('Bienvenue !', `Votre profil "${companyName.trim()}" est configuré.`);
      navigate('/app');
    } catch (err) {
      console.error(err);
      setError('Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-10 h-10 bg-white border border-outline-variant/20 rounded-xl flex items-center justify-center shadow-lg shadow-black/5 overflow-hidden">
            <img src="/icons/icon-192.png" alt="Logo" className="w-full h-full object-contain p-1" />
          </div>
          <span className="wordmark-photofacto text-xl">
            <span className="wm-photo">PHOTO</span><span className="wm-facto">FACTO</span>
          </span>
        </div>

        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-xl border border-outline-variant/10 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">Bienvenue ! 👋</h1>
            <p className="text-on-surface-variant text-sm">Dites-nous en plus sur votre activité pour personnaliser l'expérience.</p>
          </div>

          {error && (
            <div className="bg-error-container text-on-error-container p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Company name */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Nom de l'entreprise <span className="text-error">*</span></label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Ex: Dubois Plomberie"
              maxLength={100}
              className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-base font-medium"
            />
          </div>

          {/* Profession */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Votre métier <span className="text-error">*</span></label>
            <div className="grid grid-cols-1 gap-2">
              {PROFESSIONS.map(p => (
                <button
                  key={p.name}
                  onClick={() => setProfession(p.name)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all active:scale-[0.98] ${
                    profession === p.name
                      ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm'
                      : 'border-outline-variant/20 hover:border-primary/30 text-on-surface bg-surface'
                  }`}
                >
                  <span className="text-xl">{p.emoji}</span>
                  <span className="flex-1 text-left text-sm">{p.name}</span>
                  {profession === p.name && <CheckCircle2 className="w-5 h-5 text-primary" />}
                </button>
              ))}
            </div>

            {profession === 'Autre' && (
              <input
                type="text"
                placeholder="Précisez votre métier..."
                value={customProfession}
                onChange={e => setCustomProfession(e.target.value)}
                className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm mt-2"
                autoFocus
              />
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!companyName.trim() || !finalProfession || loading}
            className="btn-glow w-full bg-primary text-on-primary px-6 py-4 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-spark-cta text-base"
          >
            {loading ? 'Configuration...' : 'Commencer'}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
