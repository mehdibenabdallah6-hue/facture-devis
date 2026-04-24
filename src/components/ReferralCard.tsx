import React, { useState } from 'react';
import { UserPlus, Link, Copy, Check, MessageCircle, Gift, ArrowRight, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ReferralCardProps {
  userId: string;
  company?: any;
  referralCount?: number;
  className?: string;
}

export default function ReferralCard({ userId, company, referralCount, className = '' }: ReferralCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const referralLink = `${window.location.origin}/?ref=${userId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = referralLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
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

  return (
    <div className={`bg-surface-container-lowest rounded-[2rem] shadow-sm border border-outline-variant/10 p-6 md:p-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <UserPlus className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="font-headline font-bold text-on-surface text-lg">Inviter un confrère</h3>
          <p className="text-on-surface-variant text-sm">Partagez Photofacto et gagnez des mois gratuits</p>
        </div>
      </div>

      {/* Referral Link */}
      <div className="mb-6">
        <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 block">
          Votre lien de parrainage
        </label>
        <div className="flex items-center gap-2 bg-surface-container rounded-xl px-4 py-3 border border-outline-variant/10">
          <Link className="w-4 h-4 text-on-surface-variant shrink-0" />
          <span className="flex-1 text-on-surface text-sm font-mono truncate select-all">
            {referralLink}
          </span>
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 bg-primary text-on-primary font-semibold px-3 py-1.5 rounded-lg text-xs transition-all active:scale-95 hover:scale-[1.02]"
            aria-label={copied ? 'Lien copié' : 'Copier le lien'}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copié !
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copier
              </>
            )}
          </button>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleWhatsAppShare}
          className="flex items-center gap-2 bg-[#25D366] text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all active:scale-95 hover:scale-[1.02] shadow-sm"
          aria-label="Partager via WhatsApp"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </button>
        <button
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({
                  title: 'Photofacto - Facturation IA',
                  text: 'Découvre Photofacto, l\'app de facturation IA !',
                  url: referralLink,
                });
              } catch {
                // User cancelled share
              }
            }
          }}
          className="flex items-center gap-2 bg-surface-container-high text-on-surface font-semibold px-4 py-2.5 rounded-xl text-sm transition-all active:scale-95 hover:scale-[1.02] border border-outline-variant/10"
          aria-label="Partager le lien"
        >
          <Share2 className="w-4 h-4" />
          Partager
        </button>
      </div>

      {/* Reward Section */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-on-surface text-sm mb-1">Récompense de parrainage</p>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              Votre confrère et vous bénéficiez chacun de{' '}
              <span className="font-semibold text-primary">-50% sur le plan mensuel</span> ou{' '}
              <span className="font-semibold text-primary">-15% sur le plan annuel</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Referral Count + CTA */}
      <div className="flex items-center justify-between">
        <div>
          {referralCount !== undefined && referralCount > 0 ? (
            <>
              <span className="text-2xl font-headline font-extrabold text-primary">{referralCount}</span>
              <span className="text-on-surface-variant text-xs ml-2">{referralCount <= 1 ? 'confrère parrainé' : 'confrères parrainés'}</span>
            </>
          ) : (
            <span className="text-sm text-on-surface-variant">Aucun parrainage pour le moment</span>
          )}
        </div>
        <button
          onClick={() => navigate('/app/parrainage')}
          className="flex items-center gap-2 bg-primary text-on-primary font-semibold px-4 py-2 rounded-xl text-sm transition-all active:scale-95 hover:scale-[1.02]"
        >
          Gérer
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
