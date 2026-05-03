import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

export default function OnboardingSuccess() {
  const { company } = useData();
  const navigate = useNavigate();

  const profession = company?.profession?.toLowerCase() || '';

  let exampleInput = "remplacement robinet cuisine client Martin 150€";
  let exampleOutput = "Remplacement robinet cuisine";
  let examplePrice = "150.00";

  if (profession.includes('électricien') || profession.includes('electricien')) {
    exampleInput = "pose tableau électrique client Dupont 800€";
    exampleOutput = "Pose tableau électrique";
    examplePrice = "800.00";
  } else if (profession.includes('maçon') || profession.includes('macon')) {
    exampleInput = "coulage dalle béton terrasse client Bernard 1200€";
    exampleOutput = "Coulage dalle béton terrasse";
    examplePrice = "1200.00";
  } else if (profession.includes('peintre')) {
    exampleInput = "peinture salon 30m2 client Leroy 900€";
    exampleOutput = "Peinture salon 30m2";
    examplePrice = "900.00";
  } else if (profession.includes('carreleur')) {
    exampleInput = "pose carrelage salle de bain client Petit 600€";
    exampleOutput = "Pose carrelage salle de bain";
    examplePrice = "600.00";
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-xl w-full space-y-10">
        {/* Success header */}
        <div className="text-center space-y-4 animate-fade-in-up">
          <div className="w-20 h-20 bg-tertiary/10 text-tertiary rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold text-on-surface tracking-tight">
            C'est tout bon ! 🎉
          </h1>
          <p className="text-lg text-on-surface-variant">
            Commencez par un devis, ou importez vos anciens prix pour ne pas repartir de zéro.
          </p>
        </div>

        {/* Demo */}
        <div className="animate-fade-in-up animation-delay-200 bg-surface-container-lowest p-6 md:p-8 rounded-2xl shadow-xl border border-outline-variant/10 space-y-6">
          {/* Step 1: Input */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-extrabold">1</span>
              Vous dictez ou écrivez :
            </div>
            <div className="bg-surface-container-high p-4 rounded-xl text-on-surface font-medium italic text-sm border border-outline-variant/10">
              "{exampleInput}"
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-secondary animate-pulse" />
            </div>
          </div>

          {/* Step 2: Output */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              <span className="w-6 h-6 rounded-lg bg-tertiary/10 text-tertiary flex items-center justify-center text-[10px] font-extrabold">2</span>
              Photofacto prépare un devis à vérifier :
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-outline-variant/10 text-on-surface">
              <div className="flex justify-between border-b border-outline-variant/10 pb-3 mb-3">
                <div>
                  <div className="font-bold text-base font-headline">DEVIS À VÉRIFIER</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    Client : {exampleInput.includes('Dupont') ? 'Dupont' : exampleInput.includes('Bernard') ? 'Bernard' : exampleInput.includes('Leroy') ? 'Leroy' : exampleInput.includes('Petit') ? 'Petit' : 'Martin'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-on-surface-variant">Date : {new Date().toLocaleDateString('fr-FR')}</div>
                </div>
              </div>
              <div className="flex justify-between font-medium text-sm">
                <span>{exampleOutput}</span>
                <span>{examplePrice} €</span>
              </div>
              <div className="flex justify-between font-extrabold text-primary mt-3 pt-3 border-t border-outline-variant/10 font-headline">
                <span>Total TTC</span>
                <span>{examplePrice} €</span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="animate-fade-in-up animation-delay-400 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
          <button
            onClick={() => navigate('/app/invoices/new')}
            className="btn-glow w-full bg-primary text-on-primary px-8 py-4 rounded-xl font-bold text-lg hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-spark-cta cursor-pointer"
          >
            Créer mon premier devis
            <ArrowRight className="w-6 h-6" />
          </button>
          <button
            onClick={() => navigate('/app/catalog')}
            className="w-full bg-white text-on-surface border border-outline-variant/20 px-6 py-4 rounded-xl font-bold text-sm hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Importer mon catalogue
          </button>
        </div>
      </div>
    </div>
  );
}
