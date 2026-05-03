import React, { useState, useRef } from 'react';
import { initializePaddle, Paddle } from '@paddle/paddle-js';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Sparkles, ArrowRight, ShieldCheck, Check, Loader2 } from 'lucide-react';
import { formatEuroPrice, PLAN_PRICING } from '../lib/billing';

interface PaddlePaywallProps {
  onSuccess: () => void;
  onCancel?: () => void;
  pendingActivation?: boolean;
}

export default function PaddlePaywall({ onSuccess, onCancel, pendingActivation = false }: PaddlePaywallProps) {
  const { user } = useAuth();
  const { activateSubscription } = useData();
  // Lazy: Paddle SDK is initialised only when the user clicks "Débloquer".
  // Initialising on mount could let Paddle's URL-recovery / transaction
  // resume features re-open a checkout overlay without explicit consent.
  const paddleRef = useRef<Paddle | null>(null);
  const [loading, setLoading] = useState(false);

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
            setLoading(true);
            await activateSubscription('starter', 'annual');
            onSuccess();
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

  const openCheckout = async () => {
    setLoading(true);
    const paddle = await ensurePaddle();
    if (!paddle) {
      setLoading(false);
      alert("Erreur de chargement de la plateforme de paiement. Veuillez réessayer.");
      return;
    }

    // Default to Solo Annual (129€/year) as it's the best value
    const priceId = import.meta.env.VITE_PADDLE_PRICE_STARTER_ANNUAL_ID;
    if (!priceId) {
      console.error('VITE_PADDLE_PRICE_STARTER_ANNUAL_ID missing — set it in your .env / Vercel env vars.');
      setLoading(false);
      alert("Configuration de paiement incomplète. Contactez le support.");
      return;
    }

    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: user?.email || '' },
      customData: {
        userId: user?.uid || '',
        planId: 'starter',
        billingCycle: 'annual',
      },
    });

    // Loading state is reset by the checkout UI taking over (or the user
    // cancelling). We reset it here defensively so a second click works.
    setLoading(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-surface/60 overflow-y-auto">
      <div className="relative bg-surface border-2 border-primary shadow-2xl shadow-primary/20 rounded-[3rem] p-8 md:p-12 w-full max-w-lg flex flex-col items-center animate-scale-in my-auto mx-auto mt-20 md:mt-auto">
        {onCancel && (
          <button 
            onClick={onCancel}
            className="absolute top-6 right-6 text-on-surface-variant hover:text-on-surface p-2 bg-surface-container rounded-full"
          >
            ✕
          </button>
        )}
        
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>

        <h2 className="text-3xl font-headline font-extrabold text-on-surface text-center mb-4">
          Votre document est prêt !
        </h2>
        
        <p className="text-center text-on-surface-variant mb-8 text-lg">
          {pendingActivation ? (
            <>
              Paiement reçu. Nous confirmons votre abonnement avec Paddle.
              Cette étape prend généralement quelques secondes.
            </>
          ) : (
            <>
              Débloquez le résultat et profitez de Photofacto en illimité.
              Offre Solo à seulement{' '}
              <strong className="text-primary">
                {formatEuroPrice(PLAN_PRICING.starter.annual / 12)}/mois
              </strong>{' '}
              (payé annuellement).
            </>
          )}
        </p>

        <ul className="space-y-4 mb-10 w-full text-left">
          {[
            "Factures & devis illimités",
            "50 Extractions IA / mois",
            "Catalogue intelligent",
            "Factur-X exportable"
          ].map((feature, idx) => (
             <li key={idx} className="flex items-start gap-4">
               <div className="bg-primary/10 p-1 rounded-full text-primary mt-0.5">
                 <Check className="w-4 h-4" />
               </div>
               <span className="font-medium text-on-surface">{feature}</span>
             </li>
          ))}
        </ul>

        <button
          onClick={openCheckout}
          disabled={loading || pendingActivation}
          className="w-full btn-glow bg-primary text-on-primary py-4 px-6 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-3 text-lg shadow-spark-cta-lg hover:scale-[1.02] disabled:opacity-50"
        >
          {loading || pendingActivation ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Débloquer maintenant'}
          {!loading && !pendingActivation && <ArrowRight className="w-5 h-5" />}
        </button>

        <div className="mt-6 flex items-center gap-2 text-xs text-on-surface-variant">
          <ShieldCheck className="w-4 h-4" />
          <span>Paiement annuel ({formatEuroPrice(PLAN_PRICING.starter.annual)}). Sécurisé par Paddle.</span>
        </div>
      </div>
    </div>
  );
}
