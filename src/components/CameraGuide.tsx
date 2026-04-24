import React, { useState } from 'react';
import { Camera, X, Check, FileText } from 'lucide-react';

interface CameraGuideProps {
  onAccept: () => void;
  onCancel: () => void;
}

export default function CameraGuide({ onAccept, onCancel }: CameraGuideProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-fade-in-up">
        <div className="relative h-48 bg-primary/10 flex items-center justify-center">
          <button 
            onClick={onCancel}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface/50 backdrop-blur text-on-surface flex items-center justify-center focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="relative w-32 h-40 border-4 border-primary border-dashed rounded-xl flex items-center justify-center p-2 opacity-80">
            <div className="w-full h-full bg-white rounded-lg shadow-sm"></div>
            {/* Guide corners */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-primary"></div>
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-primary"></div>
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-primary"></div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-primary"></div>
          </div>
        </div>
        
        <div className="p-6 text-center">
          <h3 className="text-xl font-headline font-bold text-on-surface mb-2">Prenez une photo nette</h3>
          <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
            Pour que l'IA fonctionne parfaitement, veuillez suivre ces conseils simples :
          </p>
          
          <div className="space-y-3 text-left mb-8">
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
            className="w-full btn-glow flex items-center justify-center gap-2 bg-primary text-on-primary font-bold py-3.5 px-4 rounded-xl active:scale-95 transition-all shadow-spark-cta"
          >
            <Camera className="w-5 h-5" />
            C'est compris, photographier
          </button>
        </div>
      </div>
    </div>
  );
}
