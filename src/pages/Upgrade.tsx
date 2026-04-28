import React, { useState, useRef } from 'react';
import { Crown, Zap, Check, Sparkles, ArrowRight, X, Tag, Gift, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { initializePaddle, Paddle } from '@paddle/paddle-js';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { usePlan } from '../hooks/usePlan';
import { BillingCycle, PLAN_PRICING, formatEuroPrice, getMonthlyEquivalent } from '../lib/billing';
import { track } from '../services/analytics';

export default function Upgrade() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activateSubscription, company } = useData();
  const { activeDiscount, isPendingActivation } = usePlan();
  // Lazy: Paddle SDK is initialized only when the user clicks an Upgrade
  // button — never on mount. This prevents Paddle's transaction-recovery
  // / URL-fragment behaviours from ever auto-opening a checkout window
  // when the page loads.
  const paddleRef = useRef<Paddle | null>(null);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const pendingCheckoutRef = useRef<{ planId: 'starter' | 'pro'; billingCycle: BillingCycle } | null>(null);

  // Calculate discounted prices
  const getDiscountedPrice = (basePrice: number): number => {
    if (!activeDiscount) return basePrice;
    if (activeDiscount.type === '50_monthly_or_15_annual') {
      return billingCycle === 'monthly' ? basePrice * 0.5 : basePrice * 0.85;
    }
    if (activeDiscount.type === '20_annual') {
      return billingCycle === 'annual' ? basePrice * 0.8 : basePrice;
    }
    return basePrice;
  };

  // Initialise Paddle on demand (first click). Cached in paddleRef so a
  // second click within the same session reuses the existing instance.
  const ensurePaddle = async (): Promise<Paddle | null> => {
    if (paddleRef.current) return paddleRef.current;
    const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
    if (!clientToken) {
      console.error('VITE_PADDLE_CLIENT_TOKEN missing — set it in your .env / Vercel env vars.');
      return null;
    }
    try {
      const instance = await initializePaddle({
        environment:
          import.meta.env.VITE_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
        token: clientToken,
        eventCallback: async (event) => {
          if (event.name === 'checkout.completed') {
            if (pendingCheckoutRef.current) {
              setLoadingCode(pendingCheckoutRef.current.planId);
              await activateSubscription(
                pendingCheckoutRef.current.planId,
                pendingCheckoutRef.current.billingCycle,
              );
              navigate('/app/abonnement');
            }
          }
        },
      });
      if (instance) paddleRef.current = instance;
      return instance ?? null;
    } catch (err) {
      console.error('Failed to load Paddle', err);
      return null;
    }
  };

  const openCheckout = async (planId: 'starter' | 'pro') => {
    setLoadingCode(planId);
    const paddle = await ensurePaddle();
    if (!paddle) {
      setLoadingCode(null);
      alert("Erreur de chargement de la plateforme de paiement. Veuillez réessayer.");
      return;
    }

    pendingCheckoutRef.current = { planId, billingCycle };

    const starterMonthlyId = import.meta.env.VITE_PADDLE_PRICE_STARTER_ID;
    const proMonthlyId = import.meta.env.VITE_PADDLE_PRICE_PRO_ID;
    const starterAnnualId = import.meta.env.VITE_PADDLE_PRICE_STARTER_ANNUAL_ID;
    const proAnnualId = import.meta.env.VITE_PADDLE_PRICE_PRO_ANNUAL_ID;

    let priceId = '';
    if (planId === 'starter') priceId = (billingCycle === 'monthly' ? starterMonthlyId : starterAnnualId) || '';
    if (planId === 'pro') priceId = (billingCycle === 'monthly' ? proMonthlyId : proAnnualId) || '';

    if (!priceId) {
      console.error(`Paddle price ID missing for plan=${planId} cycle=${billingCycle}. Set VITE_PADDLE_PRICE_* env vars.`);
      setLoadingCode(null);
      alert("Configuration de paiement incomplète. Contactez le support.");
      return;
    }

    // Funnel signal: free → checkout. Fired before opening so we capture it
    // even if Paddle fails to render (network blocked, ad-blocker, etc.).
    track('checkout_opened', {
      plan: planId,
      billing: billingCycle,
      has_discount: !!activeDiscount,
      discount_code: activeDiscount?.code,
    });

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: user?.email || '' },
      customData: {
        userId: user?.uid || '',
        planId: planId,
        billingCycle: billingCycle,
      },
    });

    setLoadingCode(null);
  };

  const PriceDisplay = ({ planId }: { planId: 'starter' | 'pro' }) => {
    const basePrice = PLAN_PRICING[planId][billingCycle];
    const discountedPrice = getDiscountedPrice(basePrice);
    const monthlyEquivalent =
      billingCycle === 'annual' ? discountedPrice / 12 : getMonthlyEquivalent(planId, billingCycle);

    return (
      <div className="flex flex-col items-center mb-6">
        <div className="flex items-baseline gap-1">
          {activeDiscount && (
             <span className="text-lg line-through font-headline mr-2 text-on-surface-variant/40">
               {formatEuroPrice(basePrice / (billingCycle === 'annual' ? 12 : 1))}
             </span>
          )}
          <span className="text-5xl font-extrabold tracking-tight font-headline text-on-surface">
            {formatEuroPrice(monthlyEquivalent)}
          </span>
          <span className="font-medium text-sm text-on-surface-variant">/mois</span>
        </div>

        {billingCycle === 'annual' && (
          <div className="mt-1 flex flex-col items-center">
            <span className="text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full mb-1">
              Paiement annuel
            </span>
            <span className="text-sm font-medium text-on-surface-variant">
              soit {formatEuroPrice(discountedPrice)} / an
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-8 md:py-16 px-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold mb-2">
          <Sparkles className="w-4 h-4" />
          <span>Surclassez votre entreprise</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-headline font-extrabold text-on-surface tracking-tight leading-tight">
          Passez à la vitesse supérieure.
        </h1>
        <p className="text-lg text-on-surface-variant font-medium text-balance">
          Choisissez l'offre qui correspond à vos besoins. <br className="hidden md:block" />
          Économisez jusqu'à 50€ avec l'abonnement annuel.
        </p>

        {/* Active Discount Banner */}
        {activeDiscount && (
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-tertiary/10 border border-tertiary/20 text-on-surface text-sm font-medium shadow-sm">
            <Gift className="w-5 h-5 text-tertiary shrink-0" />
            <span className="font-bold text-tertiary">
              {activeDiscount.source === 'referral'
                ? '🎉 Parrainage actif : -50% mensuel ou -15% annuel'
                : `⏰ Offre bienvenue : -20% sur le plan annuel (expire dans ${Math.max(0, Math.round((new Date(company?.welcomeDiscountExpiry || '').getTime() - Date.now()) / (1000 * 60 * 60)))}h)`}
            </span>
          </div>
        )}

        {isPendingActivation && (
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-secondary/10 border border-secondary/20 text-on-surface text-sm font-medium shadow-sm">
            <Loader2 className="w-5 h-5 text-secondary animate-spin shrink-0" />
            <span className="font-bold text-secondary">
              Paiement reçu. Activation de votre abonnement en cours...
            </span>
          </div>
        )}

        {/* Toggle */}
        <div className="flex justify-center items-center mt-8">
          <div className="bg-surface-container border border-outline-variant/30 rounded-full p-1 flex items-center shadow-inner relative">
            <div 
              className={`absolute top-1 bottom-1 w-32 md:w-36 rounded-full bg-primary shadow-sm transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-full' : 'translate-x-0'}`}
            />
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={`relative z-10 w-32 md:w-36 py-2 text-sm font-bold transition-colors ${billingCycle === 'monthly' ? 'text-on-primary' : 'text-on-surface-variant'}`}
            >
              Mensuel
            </button>
            <button 
              onClick={() => setBillingCycle('annual')}
              className={`relative z-10 w-32 md:w-36 py-2 text-sm font-bold transition-colors flex items-center justify-center gap-1 ${billingCycle === 'annual' ? 'text-on-primary' : 'text-on-surface-variant'}`}
            >
              Annuel <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${billingCycle === 'annual' ? 'bg-on-primary/20' : 'bg-primary/20 text-primary'}`}>Économisez</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
        {/* Free Plan */}
        <div className="bg-surface border border-outline-variant/30 rounded-2xl p-8 flex flex-col items-center opacity-80 hover:opacity-100 transition-opacity relative">
          <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl font-black text-on-surface-variant">0€</span>
          </div>
          <h2 className="text-2xl font-headline font-bold mb-2 text-on-surface">Gratuit</h2>
          <p className="text-sm text-on-surface-variant mb-8 text-center h-10">Pour découvrir l'application.</p>
          
          <div className="w-full text-left space-y-3 mb-8 flex-1">
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20 pb-2 mb-4">
              <span>Limites mensuelles</span>
            </div>
            <li className="flex items-start gap-2 text-sm text-on-surface">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>10 Factures / mois</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-on-surface">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>5 Extractions IA / mois</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-on-surface-variant opacity-50">
              <X className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Photos chantier & Export FEC</span>
            </li>
          </div>
          <button disabled className="w-full bg-surface-container-high text-on-surface py-3 rounded-xl font-bold cursor-not-allowed mt-auto">
            Plan Actuel
          </button>
        </div>

        {/* SOLO Plan */}
        <div className="bg-surface border-2 border-primary shadow-xl rounded-2xl p-8 flex flex-col items-center relative transform lg:-translate-y-4">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
            Recommandé
          </div>
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl font-black text-primary"><Zap className="w-8 h-8" /></span>
          </div>
          <h2 className="text-2xl font-headline font-bold mb-2 text-on-surface">Solo</h2>
          <p className="text-sm text-on-surface-variant mb-6 text-center">Idéal pour les micro-entrepreneurs.</p>
          
          <PriceDisplay planId="starter" />
          
          <div className="w-full text-left space-y-3 mb-8 flex-1">
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20 pb-2 mb-4">
              <span>Inclus</span>
            </div>
            <li className="flex items-start gap-2 text-sm text-on-surface">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>Factures & Devis illimités</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-on-surface font-bold">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>50 Extractions IA / mois</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-on-surface">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>Calculateur de surfaces</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-on-surface-variant opacity-50">
              <X className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Photos chantier & Export FEC</span>
            </li>
          </div>
          <button 
            onClick={() => openCheckout('starter')}
            disabled={loadingCode !== null}
            className="w-full btn-glow bg-primary text-on-primary py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-spark-cta mt-auto"
          >
            {loadingCode === 'starter' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'S\'abonner à Solo'}
            {!loadingCode && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Pro Plan — same light styling as Solo */}
        <div className="bg-surface border border-outline-variant/30 shadow-xl rounded-2xl p-8 flex flex-col items-center relative">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-headline font-bold mb-2 text-on-surface">Pro</h2>
          <p className="text-sm text-on-surface-variant mb-6 text-center">Pour les entreprises établies.</p>

          <PriceDisplay planId="pro" />

          <div className="w-full text-left space-y-3 mb-8 flex-1">
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/20 pb-2 mb-4">
              <span>Le pack complet</span>
            </div>
            <li className="flex items-start gap-2 text-sm text-on-surface font-bold">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>Facturation illimitée</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-on-surface font-bold">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>IA en illimité</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-on-surface font-bold">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>Photos de chantier (PDF)</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-on-surface font-bold">
              <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <span>Export FEC & Chorus Pro <span className="text-[10px] text-on-surface-variant">(Bientôt)</span></span>
            </li>
          </div>
          <button
            onClick={() => openCheckout('pro')}
            disabled={loadingCode !== null}
            className="w-full btn-glow bg-primary text-on-primary py-4 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-spark-cta mt-auto"
          >
            {loadingCode === 'pro' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Passer en Pro'}
            {!loadingCode && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
