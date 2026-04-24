import React from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, Copy, Check, MessageCircle, Gift, Share2, Users } from 'lucide-react';
import { useState } from 'react';

export default function ReferralPage() {
  const { user } = useAuth();
  const { company } = useData();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const referralLink = user ? `${window.location.origin}/?ref=${user.uid}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = referralLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `Découvre Photofacto, l'app de facturation IA qui me fait gagner un temps fou ! Inscris-toi via mon lien et on bénéficie chacun de -50% sur l'abonnement mensuel (ou -15% sur l'annuel) : ${referralLink}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Photofacto — Facturation IA',
          text: 'Découvre Photofacto, l\'app de facturation IA pour artisans !',
          url: referralLink,
        });
      } catch { /* cancelled */ }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Back */}
      <button onClick={() => navigate('/app/settings')} className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface text-sm font-bold transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Retour aux paramètres
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <UserPlus className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">Parrainer un confrère</h1>
          <p className="text-on-surface-variant">Partagez Photofacto et gagnez ensemble</p>
        </div>
      </div>

      {/* Referral Link Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-sm border border-outline-variant/10 space-y-6">
        {/* Link */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">
            Votre lien de parrainage
          </label>
          <div className="flex items-center gap-2 bg-surface-container rounded-xl px-4 py-3 border border-outline-variant/10">
            <span className="flex-1 text-on-surface text-sm font-mono truncate select-all">{referralLink}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-primary text-on-primary font-semibold px-3 py-1.5 rounded-lg text-xs transition-all active:scale-95 hover:scale-[1.02]"
            >
              {copied ? <><Check className="w-3.5 h-3.5" /> Copié !</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
            </button>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleWhatsAppShare}
            className="flex items-center gap-2 bg-[#25D366] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all active:scale-95 hover:scale-[1.02]"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </button>
          {navigator.share && (
            <button
              onClick={handleNativeShare}
              className="flex items-center gap-2 bg-surface-container-high text-on-surface font-semibold px-5 py-2.5 rounded-xl text-sm transition-all active:scale-95 border border-outline-variant/10"
            >
              <Share2 className="w-4 h-4" />
              Partager
            </button>
          )}
        </div>

        {/* Reward */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-on-surface text-sm mb-1">Récompense mutuelle</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Votre confrère et vous bénéficiez chacun de{' '}
                <span className="font-semibold text-primary">-50% sur le plan mensuel</span> ou{' '}
                <span className="font-semibold text-primary">-15% sur le plan annuel</span>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Count */}
      {company?.referralCount !== undefined && company.referralCount > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" />
              <div>
                <p className="font-bold text-on-surface">Parrainages réussis</p>
                <p className="text-xs text-on-surface-variant">Confrères ayant rejoint Photofacto via votre lien</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-4xl font-headline font-extrabold text-primary">{company.referralCount}</span>
              <p className="text-xs text-on-surface-variant">{company.referralCount <= 1 ? 'confrère' : 'confrères'}</p>
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-sm border border-outline-variant/10 space-y-4">
        <h2 className="text-xl font-bold font-headline text-on-surface">Comment ça marche ?</h2>
        <div className="space-y-4">
          {[
            { step: '1', title: 'Partagez votre lien', desc: 'Envoyez votre lien unique à un confrère artisan par WhatsApp, SMS ou email.' },
            { step: '2', title: 'Il s\'inscrit gratuitement', desc: 'Votre confrère crée son compte et bénéficie de 14 jours d\'essai gratuit.' },
            { step: '3', title: 'Vous gagnez tous les deux', desc: 'Dès qu\'il complète son inscription, vous bénéficiez chacun de la réduction de parrainage.' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm shrink-0">
                {item.step}
              </div>
              <div>
                <p className="font-bold text-on-surface text-sm">{item.title}</p>
                <p className="text-on-surface-variant text-sm mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
