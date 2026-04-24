import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, FileText, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Page introuvable — Photofacto";
  }, []);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* 404 Icon */}
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-surface-container-lowest flex items-center justify-center mx-auto shadow-sm border border-outline-variant/10">
            <span className="text-8xl font-headline font-extrabold text-on-surface/10">404</span>
          </div>
          <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7 text-primary" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-headline font-extrabold text-on-surface tracking-tight">
            Oups, page introuvable
          </h1>
          <p className="text-on-surface-variant text-lg max-w-sm mx-auto">
            La page que vous cherchez a été déplacée, supprimée ou n'a jamais existé.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/')}
            className="btn-glow flex items-center justify-center gap-2 bg-primary text-on-primary font-bold px-6 py-3.5 rounded-xl shadow-spark-cta hover:shadow-xl active:scale-95 transition-all text-sm"
          >
            <Home className="w-5 h-5" />
            Retour à l'accueil
          </button>
          <button
            onClick={() => navigate('/app/invoices/new')}
            className="flex items-center justify-center gap-2 bg-surface-container-high text-on-surface font-bold px-6 py-3.5 rounded-xl hover:bg-surface-container-highest active:scale-95 transition-all text-sm border border-outline-variant/10"
          >
            <FileText className="w-5 h-5" />
            Créer une facture
          </button>
        </div>

        {/* Debug */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Page précédente
        </button>
      </div>
    </div>
  );
}
