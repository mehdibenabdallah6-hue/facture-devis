import { ArrowLeft, Star, Wrench, CheckCircle2, Bug, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

interface ChangelogEntry {
  type: 'feat' | 'fix' | 'improvement';
  text: string;
}

interface Release {
  version: string;
  date: string;
  entries: ChangelogEntry[];
}

const releases: Release[] = [
  {
    version: 'v2.5',
    date: 'Avril 2026',
    entries: [
      { type: 'feat', text: 'Système de parrainage avec réductions -50% mensuel / -15% annuel' },
      { type: 'feat', text: 'Page de gestion d\'abonnement in-app' },
      { type: 'feat', text: 'Menu profil avec dropdown' },
      { type: 'improvement', text: 'Animations de page (Framer Motion)' },
      { type: 'feat', text: 'Page de contact' },
      { type: 'improvement', text: 'Export comptable amélioré' },
    ],
  },
  {
    version: 'v2.4',
    date: 'Avril 2026',
    entries: [
      { type: 'feat', text: 'Page détail client' },
      { type: 'improvement', text: 'Autocomplete client' },
      { type: 'feat', text: 'Suggestions contextuelles par historique' },
      { type: 'improvement', text: 'Badge factures impayées' },
      { type: 'improvement', text: 'Empty states guidants' },
    ],
  },
  {
    version: 'v2.3',
    date: 'Avril 2026',
    entries: [
      { type: 'feat', text: 'Toast notifications' },
      { type: 'fix', text: 'Fallback modèle Gemini' },
      { type: 'fix', text: 'Reset mensuel des compteurs' },
      { type: 'improvement', text: 'Code-splitting' },
      { type: 'improvement', text: 'Free tier augmenté (10 factures, 5 IA)' },
    ],
  },
  {
    version: 'v2.2',
    date: 'Mars 2026',
    entries: [
      { type: 'feat', text: 'Préparation Factur-X + connecteurs publics' },
      { type: 'feat', text: 'Système de plans Freemium + Paddle' },
      { type: 'feat', text: 'Signature électronique de devis' },
    ],
  },
  {
    version: 'v2.1',
    date: 'Mars 2026',
    entries: [
      { type: 'feat', text: 'Extraction IA multi-source (photo, dictée, document)' },
      { type: 'feat', text: 'Auto-apprentissage catalogue' },
      { type: 'feat', text: 'Import Excel' },
    ],
  },
  {
    version: 'v2.0',
    date: 'Fév 2026',
    entries: [
      { type: 'feat', text: 'Landing pages SEO par métier' },
      { type: 'feat', text: 'Mode offline' },
      { type: 'feat', text: 'Onboarding interactif' },
    ],
  },
];

const typeConfig = {
  feat: {
    label: 'feat',
    bgClass: 'bg-[#4CAF50]/15',
    textClass: 'text-[#4CAF50]',
    icon: Sparkles,
  },
  fix: {
    label: 'fix',
    bgClass: 'bg-[#2196F3]/15',
    textClass: 'text-[#2196F3]',
    icon: Bug,
  },
  improvement: {
    label: 'improvement',
    bgClass: 'bg-[#9C27B0]/15',
    textClass: 'text-[#9C27B0]',
    icon: Wrench,
  },
};

export default function Changelog() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-surface-variant/50 flex items-center justify-center hover:bg-surface-variant transition-colors"
            aria-label="Retour"
          >
            <ArrowLeft size={20} className="text-on-surface" />
          </button>
          <h1 className="text-2xl font-headline text-on-surface">Nouveautés</h1>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-outline-variant/20" />

          <div className="space-y-10">
            {releases.map((release, releaseIdx) => (
              <div key={release.version} className="relative">
                {/* Timeline dot */}
                <div className="absolute left-4 -translate-x-1/2 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center z-10 ring-4 ring-surface">
                  <Star size={16} className="text-primary" />
                </div>

                {/* Content */}
                <div className="ml-16">
                  {/* Version header */}
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-lg font-headline font-semibold text-on-surface">
                      {release.version}
                    </span>
                    <span className="text-sm text-on-surface-variant">
                      {release.date}
                    </span>
                  </div>

                  {/* Changes list */}
                  <div className="bg-surface rounded-[1.5rem] border border-outline-variant/10 p-5 space-y-3">
                    {release.entries.map((entry, entryIdx) => {
                      const config = typeConfig[entry.type];
                      const Icon = config.icon;
                      return (
                        <div key={entryIdx} className="flex items-start gap-3">
                          <span className={`mt-0.5 flex-shrink-0 ${config.textClass}`}>
                            <Icon size={16} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgClass} ${config.textClass} mb-1`}>
                              {config.label}
                            </span>
                            <p className="text-sm text-on-surface">{entry.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
