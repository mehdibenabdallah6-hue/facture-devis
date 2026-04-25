import React from 'react';
import { Camera, X, Check } from 'lucide-react';

interface CameraGuideProps {
  onAccept: () => void;
  onCancel: () => void;
}

export default function CameraGuide({ onAccept, onCancel }: CameraGuideProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface w-full max-w-sm max-h-[calc(100dvh-24px)] rounded-t-2xl sm:rounded-[2rem] overflow-y-auto shadow-2xl animate-fade-in-up">
        <div className="relative h-36 sm:h-48 bg-primary/10 flex items-center justify-center">
          <button 
            onClick={onCancel}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 min-touch rounded-full bg-surface/70 backdrop-blur text-on-surface flex items-center justify-center focus:outline-none active:scale-95 transition-transform"
            aria-label="Fermer le guide photo"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="relative w-24 h-32 sm:w-32 sm:h-40 border-4 border-primary border-dashed rounded-xl flex items-center justify-center p-2 opacity-80">
            <div className="w-full h-full bg-white rounded-lg shadow-sm"></div>
            {/* Guide corners */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-primary"></div>
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-primary"></div>
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-primary"></div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-primary"></div>
          </div>
        </div>
        
        <div className="p-5 sm:p-6 text-center pb-safe">
          <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Prenez une photo nette</h3>
          <p className="text-on-surface-variant text-sm mb-5 sm:mb-6 leading-relaxed">
            Pour que l'IA fonctionne parfaitement, veuillez suivre ces conseils simples :
          </p>
          
          <div className="space-y-3 text-left mb-6 sm:mb-8">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <p className="text-sm text-on-surface">Posez le document bien à plat</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <p className="text-sm text-on-surface">Évitez les ombres et les reflets</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <p className="text-sm text-on-surface">Cadrez le document en entier</p>
            </div>
          </div>
          
          <button 
            onClick={onAccept}
            className="w-full min-touch btn-glow flex items-center justify-center gap-2 bg-primary text-on-primary font-bold py-3.5 px-4 rounded-xl active:scale-95 transition-all shadow-spark-cta"
          >
            <Camera className="w-5 h-5" />
            C'est compris, photographier
          </button>
        </div>
      </div>
    </div>
  );
}
