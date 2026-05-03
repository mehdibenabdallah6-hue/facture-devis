import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Step = {
  id: string; // The CSS selector or ID of the element to highlight
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
};

const steps: Step[] = [
  {
    id: '#tour-welcome',
    title: 'Bienvenue sur Photofacto 👋',
    description:
      "Un tour rapide pour comprendre l'app en 1 minute. Direct, sans bla-bla. Vous pouvez sortir à tout moment.",
    placement: 'center',
  },
  {
    id: '#tour-new-doc',
    title: 'Créez une facture en 1 minute',
    description:
      "Le bouton à utiliser quand vous rentrez du chantier. Photo d'un brouillon, dictée vocale, ou tape libre — l'IA remplit la facture pour vous. Ex : « Pose chauffe-eau 200 L, M. Martin, 850 € » → facture prête.",
    placement: 'right',
  },
  {
    id: '#tour-documents',
    title: 'Vos factures et devis',
    description:
      "Tout votre historique au même endroit. Devis accepté ? 1 clic pour le transformer en facture. Vous voyez d'un coup d'œil ce qui est payé et ce qui ne l'est pas.",
    placement: 'right',
  },
  {
    id: '#tour-clients',
    title: 'Vos clients',
    description:
      "Votre carnet d'adresses. Pour vos clients réguliers, l'IA reconnaît le nom et pré-remplit l'adresse — plus besoin de retaper à chaque facture.",
    placement: 'right',
  },
  {
    id: '#tour-settings',
    title: 'Vos infos légales',
    description:
      "À remplir une fois pour toutes : SIRET, adresse, RIB. Vos PDF reprendront les mentions obligatoires sans que vous les retapiez.",
    placement: 'right',
  },
  // ── Nouvelles étapes ajoutées à la fin du guide ──────────────────
  {
    id: '#tour-catalog',
    title: 'Ajoutez vos prix au catalogue',
    description:
      "Photofacto utilise vos tarifs pour remplir automatiquement vos factures. Ajoutez quelques prestations pour commencer — ex : Pose carrelage, Main d'œuvre, Déplacement.",
    placement: 'right',
  },
  {
    id: '#tour-design',
    title: 'Personnalisez votre design',
    description:
      "Choisissez un modèle, ajoutez votre logo et vos couleurs. Votre design sera automatiquement appliqué à toutes vos factures et devis.",
    placement: 'right',
  },
  {
    id: '#tour-documents',
    title: 'Suivez et relancez vos paiements',
    description:
      "Vous voyez facilement les factures en retard, et vous pouvez relancer vos clients en 1 clic. C'est là que vous récupérez votre argent.",
    placement: 'right',
  },
];

export function OnboardingTutorial() {
  const { user } = useAuth();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    if (!user) return;
    const hasSeen = localStorage.getItem(`photofacto_tutorial_${user.uid}`);
    if (!hasSeen) {
      // Small timeout to allow the app to render totally
      setTimeout(() => setIsActive(true), 1500);
    }
  }, [user]);

  const updateTargetRect = useCallback(() => {
    if (!isActive) return;
    const currentStep = steps[currentStepIndex];
    if (currentStep.placement === 'center') {
      setTargetRect(null);
      return;
    }

    window.setTimeout(() => {
      let targetId = currentStep.id;
      const onMobile = window.innerWidth < 768;
      if (onMobile) {
        const mobileFallback = document.querySelector(`${currentStep.id}-mobile`);
        if (mobileFallback) {
          targetId = `${currentStep.id}-mobile`;
        }
      }
      // Some IDs (e.g. tour-design-mobile) are duplicated across surfaces —
      // a hidden profile-menu link plus a dashboard checklist button. Pick
      // the first match that's actually rendered (non-zero size) so we
      // highlight the visible one rather than falling back to centered.
      const candidates = document.querySelectorAll(targetId);
      let el: Element | null = null;
      for (const candidate of Array.from(candidates)) {
        const r = candidate.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          el = candidate;
          break;
        }
      }
      if (!el && candidates.length > 0) el = candidates[0];
      if (el) {
        // On mobile, scroll non-fixed targets into view so the highlight is
        // actually visible. Fixed elements (bottom nav, header) ignore this.
        if (onMobile) {
          try {
            const r = el.getBoundingClientRect();
            const inView =
              r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
            if (!inView) {
              el.scrollIntoView({ block: 'center', inline: 'center' });
            }
          } catch {
            /* ignore */
          }
        }

        const rect = el.getBoundingClientRect();
        // Element is in DOM but not rendered (e.g. tour-design lives in
        // the desktop sidebar and is `display:none` on mobile). A 0×0
        // rect would push the popup off-screen — fall back to centered.
        if (rect.width === 0 && rect.height === 0) {
          setTargetRect(null);
        } else {
          setTargetRect(rect);
        }
      } else {
        setTargetRect(null);
      }
    }, 80);
  }, [currentStepIndex, isActive]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      updateTargetRect();
    };

    updateTargetRect();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('scroll', updateTargetRect, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [updateTargetRect]);

  if (!isActive) return null;

  const currentStep = steps[currentStepIndex];
  
  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsActive(false);
    if (user) {
      localStorage.setItem(`photofacto_tutorial_${user.uid}`, 'true');
    }
  };

  // Determine popup placement based on target rectangle
  let popupStyle: React.CSSProperties = {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };

  if (targetRect && !isMobile) {
    if (currentStep.placement === 'right') {
      popupStyle = {
        top: targetRect.top + targetRect.height / 2,
        left: targetRect.right + 20,
        transform: 'translateY(-50%)',
      };
    } else if (currentStep.placement === 'bottom') {
      popupStyle = {
        top: targetRect.bottom + 20,
        left: targetRect.left + targetRect.width / 2,
        transform: 'translateX(-50%)',
      };
    }
  }

  // On mobile, smartly anchor the popup to the opposite side of the target
  // so it never sits on top of the element being highlighted. Falls back to
  // centered when there's no target (e.g. welcome step).
  if (isMobile) {
    const baseMobileStyle: React.CSSProperties = {
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100vw - 20px)',
      maxWidth: 360,
      maxHeight: 'calc(100dvh - 32px)',
      overflowY: 'auto',
    };
    if (targetRect) {
      const targetCenter = targetRect.top + targetRect.height / 2;
      // Target in upper half → popup at bottom, otherwise popup at top.
      const placeAtBottom = targetCenter < window.innerHeight / 2;
      popupStyle = placeAtBottom
        ? {
            ...baseMobileStyle,
            bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
          }
        : {
            ...baseMobileStyle,
            top: 'calc(env(safe-area-inset-top) + 12px)',
          };
    } else {
      popupStyle = {
        ...baseMobileStyle,
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dark Backdrop with 'hole' for target */}
      <div
        className="absolute inset-0 bg-black/50 md:bg-black/60 backdrop-blur-[2px] transition-all duration-500 pointer-events-auto"
        style={targetRect ? {
          clipPath: `polygon(
            0% 0%, 0% 100%,
            ${targetRect.left - 10}px 100%,
            ${targetRect.left - 10}px ${targetRect.top - 10}px,
            ${targetRect.right + 10}px ${targetRect.top - 10}px,
            ${targetRect.right + 10}px ${targetRect.bottom + 10}px,
            ${targetRect.left - 10}px ${targetRect.bottom + 10}px,
            ${targetRect.left - 10}px 100%,
            100% 100%, 100% 0%
          )`
        } : undefined}
      />

      {/* Target Highlight Outline (also visible on mobile so the user
          can actually see what's being pointed at) */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-xl animate-pulse pointer-events-none"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Tutorial Card */}
      <div 
        className="absolute w-[350px] max-w-[calc(100vw_-_20px)] bg-surface-container-lowest rounded-2xl p-4 md:p-6 shadow-2xl transition-all duration-300 pointer-events-auto flex flex-col gap-3 md:gap-4 border border-outline-variant/20"
        style={popupStyle}
      >
        <button 
          onClick={handleComplete}
          className="absolute top-3 right-3 min-touch text-on-surface-variant hover:text-on-surface rounded-lg transition-colors flex items-center justify-center"
          aria-label="Fermer le tutoriel"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-primary mb-2 block">Étape {currentStepIndex + 1} sur {steps.length}</span>
          <h3 className="text-base md:text-xl font-bold font-headline text-on-surface mb-1.5 md:mb-2 leading-tight flex items-center pr-8">
            {currentStep.title}
          </h3>
          <p className="text-on-surface-variant text-xs md:text-sm leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 mt-1 md:mt-2">
          <button 
            onClick={handleComplete}
            className="min-touch text-[11px] md:text-xs font-bold text-on-surface-variant hover:text-on-surface px-2 underline underline-offset-4"
          >
            Sortir du guide
          </button>
          
          <button 
            onClick={handleNext}
            className="btn-glow min-touch flex items-center gap-1.5 md:gap-2 bg-primary text-on-primary px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-sm shadow-spark-cta active:scale-95 transition-all"
          >
            {currentStepIndex === steps.length - 1 ? (
              <>Terminer <Check className="w-4 h-4" /></>
            ) : (
              <>Suivant <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
