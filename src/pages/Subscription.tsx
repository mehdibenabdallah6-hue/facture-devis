import React from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '../hooks/usePlan';
import { ArrowLeft, Crown, CreditCard, AlertCircle, Mail, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

export default function Subscription() {
  const { company } = useData();
  const { user } = useAuth();
  const { plan, isPro, isStarter, isFree } = usePlan();
  const navigate = useNavigate();

  const planFeatures: Record<string, { name: string; features: string[]; price: string; current: boolean }> = {
    free: {
      name: 'Gratuit',
      price: '0€/mois',
      current: isFree,
      features: ['10 factures/mois', '5 usages IA/mois', 'Conformité de base', 'Pas de photos PDF'],
    },
    starter: {
      name: 'Starter',
      price: '9€/mois',
      current: isStarter,
      features: ['Factures illimitées', '20 usages IA/mois', 'Conformité Factur-X', 'Envoi emails auto'],
    },
    pro: {
      name: 'Pro',
      price: '29€/mois',
      current: isPro,
      features: ['Tout illimité', 'Photos dans PDF', 'Export CSV/FEC', 'Parrainage illimité'],
    },
  };

  const currentPlan = planFeatures[plan || 'free'];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back */}
      <button onClick={() => navigate('/app/settings')} className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface text-sm font-bold transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Retour aux paramètres
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isPro ? 'bg-tertiary/10 text-tertiary' : isStarter ? 'bg-secondary/10 text-secondary' : 'bg-surface-container-high text-on-surface-variant'}`}>
          <Crown className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">Mon abonnement</h1>
          <p className="text-on-surface-variant">Plan actuel : <span className="font-bold text-on-surface">{currentPlan.name} — {currentPlan.price}</span></p>
        </div>
      </div>

      {/* Current Plan Status */}
      <div className={`rounded-2xl p-6 md:p-8 shadow-sm border ${isFree ? 'bg-surface-container-lowest border-outline-variant/10' : 'bg-primary/5 border-primary/10'}`}>
        <div className="flex items-start gap-4 mb-6">
          {isFree ? (
            <AlertCircle className="w-6 h-6 text-on-surface-variant shrink-0 mt-1" />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-1" />
          )}
          <div>
            <h2 className="text-xl font-bold font-headline text-on-surface mb-2">
              {isFree ? 'Vous êtes sur le plan gratuit' : `Abonnement ${currentPlan.name} actif`}
            </h2>
            <p className="text-on-surface-variant text-sm">
              {isFree
                ? 'Passez à un plan supérieur pour débloquer toutes les fonctionnalités.'
                : `Votre abonnement ${company?.subscriptionStatus === 'active' ? 'est actif' : 'est en cours d\'activation'}. Vous pouvez le gérer ci-dessous.`
              }
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {currentPlan.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-on-surface-variant">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              {feature}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {isFree ? (
            <button
              onClick={() => navigate('/app/upgrade')}
              className="btn-glow flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary px-6 py-3.5 rounded-xl font-bold shadow-spark-cta active:scale-95 transition-all"
            >
              <Crown className="w-5 h-5" />
              Passer au plan supérieur
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/app/upgrade')}
                className="flex-1 flex items-center justify-center gap-2 bg-surface-container-high text-on-surface px-6 py-3.5 rounded-xl font-bold hover:bg-surface-container-highest active:scale-95 transition-all border border-outline-variant/10"
              >
                <CreditCard className="w-5 h-5" />
                Changer de plan
              </button>
              <button
                onClick={() => window.open('https://buyer.paddle.com', '_blank')}
                className="flex-1 flex items-center justify-center gap-2 bg-surface-container-high text-on-surface px-6 py-3.5 rounded-xl font-medium hover:bg-surface-container-highest active:scale-95 transition-all border border-outline-variant/10 text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Gérer via Paddle (CB, annulation)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Other Plans */}
      {!isFree && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold font-headline text-on-surface">Autres plans disponibles</h3>
          <div className="grid gap-4">
            {Object.entries(planFeatures)
              .filter(([key]) => key !== plan)
              .map(([key, p]) => (
                <div key={key} className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-on-surface text-lg">{p.name}</h4>
                    <p className="text-on-surface-variant text-sm">{p.price}</p>
                    <ul className="mt-2 space-y-1">
                      {p.features.slice(0, 2).map((f, i) => (
                        <li key={i} className="text-xs text-on-surface-variant">• {f}</li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => navigate('/app/upgrade')}
                    className="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shrink-0"
                  >
                    Choisir
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Cancel Info */}
      {!isFree && (
        <div className="bg-error-container/30 rounded-2xl p-5 border border-error/10">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-on-surface mb-1">Annuler mon abonnement</h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Vous pouvez annuler votre abonnement à tout moment depuis votre <strong>portail client Paddle</strong>. 
                L'annulation prend effet à la fin de votre période de facturation en cours. Aucun remboursement partiel n'est possible.
              </p>
              <p className="text-sm text-on-surface-variant mt-2">
                Vous avez reçu un lien de gestion par email lors de votre paiement (de la part de <strong>Paddle</strong>). 
                Si vous ne le retrouvez plus, contactez notre support à{' '}
                <a href="mailto:contact@photofacto.fr" className="text-primary hover:underline">contact@photofacto.fr</a> et nous vous le renverrons.
              </p>
              <button
                onClick={() => window.open('https://buyer.paddle.com', '_blank')}
                className="mt-3 inline-flex items-center gap-2 bg-error text-on-error px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Accéder au portail Paddle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Support */}
      <div className="text-center py-4">
        <p className="text-sm text-on-surface-variant">
          Une question sur votre abonnement ?{' '}
          <a href="mailto:contact@photofacto.fr?subject=Question sur mon abonnement" className="text-primary hover:underline font-medium">
            Contactez le support
          </a>
        </p>
      </div>
    </div>
  );
}
