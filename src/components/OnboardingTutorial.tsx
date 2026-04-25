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
    title: 'Bienvenue sur Photofacto ! 👋',
    description: "Cet assistant interactif va vous montrer l'essentiel en 5 étapes. Vous pouvez ignorer ce tutoriel à tout moment.",
    placement: 'center'
  },
  {
    id: '#tour-new-doc',
    title: 'Créer votre premier document',
    description: "C'est ici que la magie opère ! Cliquez ici pour tester notre IA en scannant un brouillon ou en dictant votre facture.",
    placement: 'right'
  },
  {
    id: '#tour-documents',
    title: 'Vos Factures et Devis',
    description: "Retrouvez ici tout votre historique. Vous pouvez transformer un devis en facture en un seul clic.",
    placement: 'right'
  },
  {
    id: '#tour-clients',
    title: 'Vos Clients',
    description: "Votre répertoire. Entrez vos contacts réguliers ici pour gagner encore plus de temps.",
    placement: 'right'
  },
  {
    id: '#tour-settings',
    title: 'Vos Paramètres Pro',
    description: "Dernière étape indispensable : remplissez vos informations légales (SIRET, Adresse) pour que vos exports PDF soient conformes à la loi !",
    placement: 'right'
  }
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
      if (window.innerWidth < 768) {
        const mobileFallback = document.querySelector(`${currentStep.id}-mobile`);
        if (mobileFallback) {
          targetId = `${currentStep.id}-mobile`;
        }
      }
      const el = document.querySelector(targetId);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
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

  // On mobile, force center or bottom to avoid overflow
  if (isMobile) {
    popupStyle = {
      bottom: 'calc(env(safe-area-inset-bottom) + 66px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100vw - 20px)',
      maxWidth: 360,
      maxHeight: 'calc(100dvh - 92px)',
      overflowY: 'auto',
    };
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dark Backdrop with 'hole' for target */}
      <div 
        className="absolute inset-0 bg-black/50 md:bg-black/60 backdrop-blur-[2px] transition-all duration-500 pointer-events-auto"
        style={targetRect && !isMobile ? {
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
      
      {/* Target Highlight Outline (optional, nice visual effect) */}
      {targetRect && !isMobile && (
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
