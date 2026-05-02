import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Mic,
  Camera,
  Zap,
  Check,
  ArrowRight,
  FileText,
  Users,
  ShieldCheck,
  Send,
  Download,
  Star,
} from 'lucide-react';
import { TestimonialsColumn, type Testimonial } from '../components/TestimonialsColumn';

const testimonials: Testimonial[] = [
  {
    text: "Avant je passais 1h à faire mes factures le soir. Maintenant je dicte en 10 secondes depuis la camionnette.",
    image: 'https://randomuser.me/api/portraits/men/32.jpg',
    name: 'Karim B.',
    role: 'Carreleur · Paris',
  },
  {
    text: "Je prends en photo mon devis papier et tout est pré-rempli. Un gain de temps énorme, je recommande.",
    image: 'https://randomuser.me/api/portraits/women/44.jpg',
    name: 'Sophie L.',
    role: 'Électricienne · Lyon',
  },
  {
    text: "Enfin un outil qui comprend notre métier. Les suggestions de prestations sont hyper pratiques.",
    image: 'https://randomuser.me/api/portraits/men/15.jpg',
    name: 'Marc D.',
    role: 'Plombier · Marseille',
  },
  {
    text: "Le calculateur de surfaces m'a fait gagner un temps fou sur mes devis de chantier. Plus de calculs sur un coin de table.",
    image: 'https://randomuser.me/api/portraits/men/52.jpg',
    name: 'Julien R.',
    role: 'Maçon · Bordeaux',
  },
  {
    text: "Mes clients signent les devis directement depuis leur téléphone. Plus besoin d'imprimer ni de relancer.",
    image: 'https://randomuser.me/api/portraits/women/68.jpg',
    name: 'Aurélie M.',
    role: 'Peintre · Toulouse',
  },
  {
    text: "L'export Chorus Pro fonctionne du premier coup. Pour mes chantiers publics c'est exactement ce qu'il me fallait.",
    image: 'https://randomuser.me/api/portraits/men/76.jpg',
    name: 'Thomas G.',
    role: 'Couvreur · Nantes',
  },
  {
    text: "Interface ultra simple, même sur mon vieux téléphone. Mes factures sont conformes 2026 sans que j'aie rien à faire.",
    image: 'https://randomuser.me/api/portraits/men/41.jpg',
    name: 'Nicolas P.',
    role: 'Menuisier · Lille',
  },
  {
    text: "Les photos de chantier dans le PDF, c'est le détail qui change tout. Mes clients comprennent ce qu'ils paient.",
    image: 'https://randomuser.me/api/portraits/women/22.jpg',
    name: 'Léa V.',
    role: 'Plaquiste · Strasbourg',
  },
  {
    text: "Le support a répondu en 10 minutes un dimanche. J'ai jamais vu ça. L'app est pensée pour nous, pas pour des comptables.",
    image: 'https://randomuser.me/api/portraits/men/83.jpg',
    name: 'Mehdi A.',
    role: 'Chauffagiste · Nice',
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

interface LandingPageProps {
  profession?:
    | 'plombier'
    | 'electricien'
    | 'macon'
    | 'peintre'
    | 'carreleur'
    | 'couvreur'
    | 'menuisier'
    | 'serrurier'
    | 'plaquiste'
    | 'chauffagiste'
    | 'paysagiste';
}

export default function LandingPage({ profession }: LandingPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('photofacto_referral', ref);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  // SEO per profession
  useEffect(() => {
    const seoData: Record<string, { title: string; description: string }> = {
      plombier: {
        title: 'Photofacto — Logiciel de facturation pour plombiers | Facture en 10s',
        description:
          "L'app de facturation pour plombiers. Ajoutez une photo, décrivez l'intervention, obtenez une proposition de facture à vérifier. Essai gratuit 14 jours.",
      },
      electricien: {
        title: 'Photofacto — Logiciel de facturation pour électriciens | Facture en 10s',
        description:
          'Facturation simplifiée pour électriciens. Photo, dictée ou description rapide : préparez une proposition modifiable pour vos chantiers.',
      },
      macon: {
        title: 'Photofacto — Logiciel de facturation pour maçons | Facture en 10s',
        description:
          "L'outil de facturation conçu pour les maçons. Situations de travaux, acomptes, devis : tout se fait en 10 secondes par IA. Essai gratuit.",
      },
      peintre: {
        title: 'Photofacto — Logiciel de facturation pour peintres | Facture en 10s',
        description:
          "Facturez vos chantiers de peinture plus vite. Décrivez la prestation, ajoutez une photo si utile, vérifiez puis validez.",
      },
      carreleur: {
        title: 'Photofacto — Logiciel de facturation pour carreleurs | Facture en 10s',
        description:
          "Créez vos factures et devis de carrelage avec photo + description rapide. L'IA prépare un brouillon modifiable. Essai 14 jours gratuit.",
      },
      couvreur: {
        title: 'Photofacto — Logiciel de facturation pour couvreurs | Facture en 10s',
        description:
          "L'application de facturation pour couvreurs et zingueurs. Transformez vos notes de chantier en proposition de facture claire à vérifier.",
      },
      menuisier: {
        title: 'Photofacto — Logiciel de facturation pour menuisiers | Facture en 10s',
        description:
          "Simplifiez la facturation de votre menuiserie. L'IA prépare des brouillons à partir de vos descriptions, vous gardez la validation.",
      },
      serrurier: {
        title: 'Photofacto — Logiciel de facturation pour serruriers | Facture en 10s',
        description:
          'Gagnez du temps sur vos interventions avec Photofacto. Dépannage, ouverture de porte : chiffrez et facturez vos clients directement sur place.',
      },
      plaquiste: {
        title: 'Photofacto — Logiciel de facturation pour plaquistes | Facture en 10s',
        description:
          'Outil de facturation rapide pour les plaquistes. Pose de placo, joints, isolation : générez vos devis et factures en dictant vos dimensions.',
      },
      chauffagiste: {
        title: 'Photofacto — Logiciel de facturation pour chauffagistes | Facture en 10s',
        description:
          'Application de facturation pour chauffagistes. Entretien chaudière, pose PAC : transformez vos comptes rendus en facture conformes instantanément.',
      },
      paysagiste: {
        title: 'Photofacto — Logiciel de facturation pour paysagistes | Facture en 10s',
        description:
          "Logiciel de devis et factures pour espaces verts. Décrivez tonte, élagage ou aménagement : l'IA prépare une proposition modifiable.",
      },
    };

    const setMeta = (title: string, desc: string) => {
      document.title = title;
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', desc);
    };

    if (profession && seoData[profession]) {
      setMeta(seoData[profession].title, seoData[profession].description);
    } else {
      setMeta(
        'Photofacto — Facturation BTP pour artisans français',
        "Le logiciel de facturation pensé pour les artisans BTP qui veulent créer des devis, factures structurées et dossiers mieux préparés. Essai gratuit 14 jours.",
      );
    }
  }, [profession]);

  const getExample = () => {
    switch (profession) {
      case 'plombier':
        return 'remplacement robinet cuisine client Martin 150€';
      case 'electricien':
        return 'pose tableau électrique client Dupont 800€';
      case 'macon':
        return 'coulage dalle béton terrasse client Bernard 1200€';
      case 'peintre':
        return 'peinture salon 30m2 client Leroy 900€';
      case 'carreleur':
        return 'pose carrelage salle de bain client Petit 600€';
      case 'couvreur':
        return 'réparation fuite toiture tuiles cassées client Dubois 450€';
      case 'menuisier':
        return "pose porte d'entrée sur mesure client Blanc 1500€";
      case 'serrurier':
        return 'ouverture de porte blindée client Vidal 250€';
      case 'plaquiste':
        return 'pose cloisons placo BA13 40m2 client Moreau 1800€';
      case 'chauffagiste':
        return 'entretien annuel chaudière gaz client Girard 150€';
      case 'paysagiste':
        return 'tonte pelouse + taille haie 20ml client Roux 300€';
      default:
        return 'pose carrelage salon Karim 1200 euros';
    }
  };

  const heroTitle = profession ? (
    <>
      Facturation {profession}
      <br />
      <span className="text-primary">en 10 secondes.</span>
    </>
  ) : (
    <>
      Le logiciel de facturation
      <br />
      pensé pour les artisans BTP
      <br />
      <span className="text-primary">et les marchés publics.</span>
    </>
  );

  return (
    <div className="min-h-screen bg-background font-body text-on-surface">
      {/* ── Top accent ─────────────────────────────────────────── */}
      <div className="accent-bar-spark" />

      {/* ── Nav ────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between gap-2 px-3.5 md:px-14 py-2.5 md:py-4 bg-white border-b-spark">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-primary/5 flex items-center justify-center overflow-hidden shrink-0">
            <img src="/icons/icon-192.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="wordmark-photofacto text-[17px] md:text-xl min-w-0">
            <span className="wm-photo">PHOTO</span><span className="wm-facto">FACTO</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-7">
          {[
            { label: 'Fonctionnalités', href: '#features' },
            { label: 'Tarifs', href: '#pricing' },
            { label: 'Témoignages', href: '#testimonials' },
          ].map(l => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/connexion')}
            className="hidden sm:inline-flex bg-transparent border border-on-surface/15 text-on-surface px-5 py-2 rounded-[10px] text-[13px] font-semibold hover:bg-on-surface/5 transition-colors"
          >
            Se connecter
          </button>
          <button
            onClick={() => navigate('/inscription?mode=register')}
            className="inline-flex min-touch items-center gap-1.5 bg-primary text-white px-3.5 sm:px-5 py-2 rounded-[10px] text-xs sm:text-[13px] font-bold shadow-spark-cta active:scale-95 transition-transform whitespace-nowrap"
          >
            Essai gratuit →
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-14 py-6 md:py-20 grid md:grid-cols-[1fr_460px] gap-5 lg:gap-16 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-primary/[0.07] border border-primary/[0.18] rounded-full px-2.5 md:px-3 py-1.5 mb-4 md:mb-7">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-[11px] md:text-xs font-semibold text-primary-dim">
              Artisans BTP · Factur-X · Marchés publics
            </span>
          </div>
          <h1 className="font-headline font-extrabold text-[33px] sm:text-[52px] lg:text-[62px] leading-[1.04] text-secondary-dim mb-4 md:mb-5">
            {heroTitle}
          </h1>
          <p className="text-[15px] md:text-[17px] text-on-surface-variant leading-[1.55] md:leading-[1.7] max-w-[480px] mb-5 md:mb-8">
            Créez vos devis et factures BTP, vérifiez les mentions légales, exportez en{' '}
            <strong className="text-on-surface">Factur-X</strong> et préparez vos dépôts officiels
            sans tableur ni bricolage administratif.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/inscription?mode=register')}
              className="btn-glow min-touch inline-flex items-center justify-center gap-2 bg-primary text-white border-none px-4 sm:px-7 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[13px] sm:text-base shadow-spark-cta-lg w-full sm:w-fit active:scale-[0.98] transition-transform"
            >
              <Mic className="w-[18px] h-[18px]" />
              Démarrer l'essai gratuit — 14 jours
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="flex flex-wrap gap-3 sm:gap-5">
              {['Sans carte bancaire', 'Export structuré', 'Marchés publics'].map(t => (
                <div
                  key={t}
                  className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant"
                >
                  <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center shrink-0">
                    <Check className="w-2 h-2 text-white" strokeWidth={3} />
                  </div>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mockup card */}
        <div className="w-full max-w-[360px] md:max-w-[420px] mx-auto md:mx-0 bg-white rounded-[18px] md:rounded-[20px] shadow-spark-lg border-spark overflow-hidden">
          <div className="bg-primary px-4 md:px-5 py-3 md:py-3.5 flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-white fill-white" />
            <div className="flex-1">
              <div className="text-[10px] text-white/75 font-bold tracking-wide mb-1">
                IA GEMINI — ANALYSE EN COURS…
              </div>
              <div className="h-[3px] bg-white/20 rounded-full">
                <div className="w-4/5 h-full bg-white rounded-full" />
              </div>
            </div>
          </div>
          <div className="px-4 md:px-5 py-4 md:py-5">
            <div className="flex justify-between gap-3 mb-3.5">
              <div>
                <div className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wide">
                  Facture
                </div>
                <div className="font-headline font-bold text-lg text-secondary-dim">
                  FA-2026-043
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wide">
                  Date
                </div>
                <div className="text-[13px] font-semibold text-on-surface">24 avril 2026</div>
              </div>
            </div>
            <div className="bg-background rounded-[10px] px-3 py-2.5 mb-3 md:mb-4">
              <div className="text-[10px] text-on-surface-variant font-semibold mb-0.5">
                CLIENT
              </div>
              <div className="font-bold text-[13px] text-on-surface break-words">
                Karim Boulanger · Plomberie Boulanger
              </div>
              <div className="text-xs text-on-surface-variant break-words">
                12 rue des Lilas, 75013 Paris · SIREN 845 123 456
              </div>
            </div>
            {[
              ['Pose carrelage salon 45m²', '675,00 €'],
              ["Main d'œuvre", '480,00 €'],
              ['Ragréage préparatoire', '120,00 €'],
            ].map(([l, p]) => (
              <div
                key={l}
                className="flex justify-between gap-3 py-2 border-b border-background text-xs"
              >
                <span className="text-on-surface min-w-0">{l}</span>
                <span className="font-bold text-on-surface shrink-0">{p}</span>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-1.5 mt-2.5 md:mt-3 text-[10px] md:text-[11px] text-on-surface-variant">
              <div className="py-1.5">
                HT : <strong className="text-on-surface">1 062,50 €</strong>
              </div>
              <div className="py-1.5">
                TVA 20% : <strong className="text-on-surface">212,50 €</strong>
              </div>
            </div>
            <div className="flex flex-row justify-between items-center gap-2 mt-2 bg-primary/[0.06] rounded-[10px] px-3 py-2.5 border border-primary/[0.12]">
              <span className="font-extrabold text-[13px] text-on-surface">NET À PAYER</span>
              <span className="font-headline font-extrabold text-lg md:text-xl text-primary whitespace-nowrap">1 275,00 €</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => navigate('/inscription?mode=register')}
                className="min-touch bg-primary text-white rounded-[10px] py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Send className="w-3 h-3" /> Envoyer
              </button>
              <button
                onClick={() => navigate('/inscription?mode=register')}
                className="min-touch bg-background border-spark text-on-surface rounded-[10px] py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Download className="w-3 h-3" /> PDF
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section className="bg-white border-y-spark py-4 md:py-7">
        <div className="max-w-[1200px] mx-auto px-4 md:px-14 grid grid-cols-2 sm:grid-cols-5 gap-2.5 md:gap-3">
          {[
            ['BTP', 'spécial artisans'],
            ['Chorus', 'marchés publics'],
            ['Factur-X', 'export structuré'],
            ['SIRET', 'mentions vérifiées'],
            ['IA', 'brouillon à valider'],
          ].map(([v, l], i) => (
            <div key={v as string} className="flex items-center justify-center gap-5 rounded-xl md:rounded-2xl bg-background/70 px-2 py-2.5 sm:bg-transparent sm:px-0 sm:py-0">
              {i > 0 && <div className="hidden md:block w-px h-10 bg-outline-variant" />}
              <div className="text-center">
                <div className="font-headline text-[24px] md:text-[28px] font-bold text-primary">{v}</div>
                <div className="text-[10px] md:text-[11px] text-on-surface-variant font-medium mt-0.5">{l}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="py-10 md:py-16 px-4 md:px-14 bg-background">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-8 md:mb-11">
            <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim mb-2.5">
              Du chantier au dépôt Chorus
            </h2>
            <p className="text-[15px] text-on-surface-variant max-w-md mx-auto">
              Décrivez la prestation, vérifiez les mentions, exportez une facture prête pour vos clients publics.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                n: '01',
                icon: <Mic className="w-[22px] h-[22px] text-primary" />,
                t: 'Chantier décrit simplement',
                d: "Photo si utile, description rapide, catalogue de prix : l'IA prépare un brouillon réaliste.",
              },
              {
                n: '02',
                icon: <Zap className="w-[22px] h-[22px] text-primary fill-primary" />,
                t: 'Mentions vérifiées',
                d: 'SIRET, TVA, client, échéance et lignes restent visibles avant validation.',
              },
              {
                n: '03',
                icon: <Check className="w-[22px] h-[22px] text-primary" strokeWidth={3} />,
                t: 'Factur-X puis dépôt officiel',
                d: 'Préparez un export structuré et gardez un document propre pour vos marchés publics.',
              },
            ].map(({ n, icon, t, d }) => (
              <div
                key={n}
                className="bg-white rounded-[18px] p-5 md:p-7 border-spark shadow-spark-md relative overflow-hidden"
              >
                <div className="absolute top-3.5 right-4 font-headline font-extrabold text-[54px] text-primary/[0.06] leading-none">
                  {n}
                </div>
                <div className="w-[46px] h-[46px] bg-primary/[0.08] rounded-xl flex items-center justify-center mb-4">
                  {icon}
                </div>
                <div className="font-headline font-bold text-base text-secondary-dim mb-2">
                  {t}
                </div>
                <div className="text-[13px] text-on-surface-variant leading-relaxed">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="pb-10 md:pb-16 px-4 md:px-14 bg-background">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim mb-2 text-center">
            Pensé pour les factures BTP publiques
          </h2>
          <p className="text-[15px] text-on-surface-variant text-center mb-8 md:mb-10">
            Pas un logiciel généraliste : les bons garde-fous pour devis, factures, avoirs et marchés publics.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              {
                icon: <FileText className="w-[18px] h-[18px] text-primary" />,
                t: 'Factures & devis BTP',
                d: 'Créez factures, devis, acomptes et avoirs avec les infos légales visibles.',
              },
              {
                icon: <Users className="w-[18px] h-[18px] text-primary" />,
                t: 'Clients publics et privés',
                d: 'Gérez B2B, B2C et clients publics avec SIREN, TVA intra et historique.',
              },
              {
                icon: <ShieldCheck className="w-[18px] h-[18px] text-primary" />,
                t: 'Contrôles avant validation',
                d: 'Les mentions bloquantes sont signalées avant d’envoyer une facture officielle.',
              },
              {
                icon: <Send className="w-[18px] h-[18px] text-primary" />,
                t: 'Factur-X & dépôts officiels',
                d: "Préparez un export structuré et vos dossiers pour les marchés publics.",
              },
            ].map(({ icon, t, d }) => (
              <div
                key={t}
                className="bg-white rounded-2xl p-5 shadow-spark-sm border-spark"
              >
                <div className="w-10 h-10 bg-primary/[0.08] rounded-[10px] flex items-center justify-center mb-3">
                  {icon}
                </div>
                <div className="font-headline font-bold text-sm text-secondary-dim mb-1.5">{t}</div>
                <div className="text-xs text-on-surface-variant leading-relaxed">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────── */}
      <section id="testimonials" className="py-10 md:py-14 px-4 md:px-14 bg-white border-y-spark relative">
        <div className="max-w-[1200px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="flex flex-col items-center justify-center max-w-[540px] mx-auto"
          >
            <div className="flex justify-center">
              <div className="border-spark rounded-lg py-1 px-4 text-xs font-bold uppercase tracking-wider text-primary">
                Témoignages
              </div>
            </div>
            <h2 className="font-headline font-extrabold text-3xl md:text-4xl lg:text-5xl text-secondary-dim text-center mt-5 tracking-tight">
              Ils nous font confiance
            </h2>
            <p className="text-center mt-4 text-[15px] text-on-surface-variant">
              Des artisans dans toute la France utilisent Photofacto au quotidien.
            </p>
          </motion.div>

          <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
            <TestimonialsColumn testimonials={firstColumn} duration={15} />
            <TestimonialsColumn
              testimonials={secondColumn}
              className="hidden md:block"
              duration={19}
            />
            <TestimonialsColumn
              testimonials={thirdColumn}
              className="hidden lg:block"
              duration={17}
            />
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────── */}
      <section id="pricing" className="py-10 md:py-14 px-4 md:px-14 bg-background border-b-spark">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-8 md:mb-11">
            <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim mb-2.5">
              Démarrez gratuitement
            </h2>
            <p className="text-[15px] text-on-surface-variant">
              Un plan gratuit à vie, des plans pro quand vous grandissez.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 md:gap-5 max-w-[960px] mx-auto">
            {[
              {
                name: 'Gratuit',
                price: '0€',
                per: '/ toujours',
                features: [
                  '10 factures / mois',
                  '5 extractions IA / mois',
                  'PDF téléchargeable',
                  'Export Factur-X',
                ],
                cta: 'Commencer gratuitement',
                highlight: false,
              },
              {
                name: 'Solo',
                price: '14,90€',
                per: '/ mois',
                sub: 'ou 129€ / an',
                features: [
                  'Factures & Devis illimités',
                  '50 extractions IA / mois',
                  'Calculateur de surfaces',
                  'Contrôles mentions BTP',
                ],
                cta: "S'abonner à Solo",
                highlight: true,
              },
              {
                name: 'Pro',
                price: '29,90€',
                per: '/ mois',
                sub: 'ou 249€ / an',
                features: [
                  'Tout le plan Solo',
                  'IA en illimité',
                  'Photos chantier dans PDF',
                  'Préparation marchés publics',
                ],
                cta: 'Passer en Pro',
                highlight: false,
              },
            ].map(({ name, price, per, sub, features, cta, highlight }) => (
              <div
                key={name}
                className={`rounded-[18px] md:rounded-[20px] p-4 md:p-7 relative overflow-hidden ${
                  highlight
                    ? 'bg-primary text-white shadow-spark-cta-xl'
                    : 'bg-white border-spark shadow-spark-md'
                }`}
              >
                {highlight && (
                  <div className="absolute top-4 right-4 bg-white/20 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                    Populaire
                  </div>
                )}
                <div
                  className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                    highlight ? 'text-white/70' : 'text-on-surface-variant'
                  }`}
                >
                  {name}
                </div>
                <div className="mb-1.5">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`font-headline font-bold text-[34px] md:text-[40px] ${
                        highlight ? 'text-white' : 'text-secondary-dim'
                      }`}
                    >
                      {price}
                    </span>
                    <span
                      className={`text-[13px] ${
                        highlight ? 'text-white/60' : 'text-on-surface-variant'
                      }`}
                    >
                      {per}
                    </span>
                  </div>
                  {sub && (
                    <div
                      className={`text-[11px] mt-1 ${
                        highlight ? 'text-white/50' : 'text-on-surface-variant'
                      }`}
                    >
                      {sub}
                    </div>
                  )}
                </div>
                <div
                  className={`h-px my-4 ${highlight ? 'bg-white/15' : 'bg-outline-variant'}`}
                />
                <div className="flex flex-col gap-2 mb-4 md:mb-6">
                  {features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-[13px]">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                          highlight ? 'bg-white/20' : 'bg-primary/10'
                        }`}
                      >
                        <Check
                          className={`w-2 h-2 ${highlight ? 'text-white' : 'text-primary'}`}
                          strokeWidth={3}
                        />
                      </div>
                      <span className={highlight ? 'text-white/90' : 'text-on-surface'}>
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate('/inscription?mode=register')}
                  className={`w-full min-touch rounded-[10px] py-3 text-[13px] font-bold ${
                    highlight
                      ? 'bg-white text-primary'
                      : 'bg-primary text-white shadow-spark-cta'
                  }`}
                >
                  {cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ──────────────────────────────────────────── */}
      <section className="bg-secondary-dim py-8 md:py-14 px-4 md:px-6 text-center">
        <h2 className="font-headline font-extrabold text-[28px] md:text-[40px] text-white mb-2.5 leading-tight">
          Prêt à facturer vos marchés publics plus proprement ?
        </h2>
        <p className="text-sm md:text-[15px] text-white/50 mb-6 md:mb-8">
          Photofacto aide les artisans BTP à passer de la prestation terrain à une facture claire, vérifiable et mieux préparée pour les marchés publics.
        </p>
        <button
          onClick={() => navigate('/inscription?mode=register')}
          className="min-touch inline-flex items-center justify-center gap-2 bg-primary text-white px-5 sm:px-9 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[13px] sm:text-base shadow-spark-cta-lg active:scale-[0.98] transition-transform w-full sm:w-auto"
        >
          <Mic className="w-[18px] h-[18px]" />
          Créer mon compte gratuitement
          <ArrowRight className="w-4 h-4" />
        </button>
        {profession && (
          <p className="text-white/40 text-sm mt-6">
            Spécialement optimisé pour les {profession}s. Exemple : "{getExample()}"
          </p>
        )}
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-secondary-dim border-t border-white/10 px-4 md:px-14 py-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid md:grid-cols-[2fr_1fr_1fr_1fr] gap-10 mb-7">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center overflow-hidden">
                  <img
                    src="/icons/icon-192.png"
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="wordmark-photofacto on-dark text-base">
                  <span className="wm-photo">PHOTO</span><span className="wm-facto">FACTO</span>
                </span>
              </div>
              <p className="text-xs text-white/30 leading-relaxed">
                Le logiciel de facturation pensé pour les artisans BTP et les formats structurés.
              </p>
            </div>
            {[
              {
                t: 'Par métier',
                links: [
                  { l: 'Plombier', to: '/plombier' },
                  { l: 'Électricien', to: '/electricien' },
                  { l: 'Maçon', to: '/macon' },
                  { l: 'Peintre', to: '/peintre' },
                  { l: 'Carreleur', to: '/carreleur' },
                ],
              },
              {
                t: 'Produit',
                links: [
                  { l: 'Essai gratuit', to: '/inscription?mode=register' },
                  { l: 'Nouveautés', to: '/nouveautes' },
                  { l: 'Contact', to: '/contact' },
                ],
              },
              {
                t: 'Légal',
                links: [
                  { l: 'Mentions légales', to: '/mentions-legales' },
                  { l: 'CGV', to: '/cgv' },
                  { l: 'Confidentialité', to: '/confidentialite' },
                ],
              },
            ].map(({ t, links }) => (
              <div key={t}>
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-3">
                  {t}
                </div>
                {links.map(l => (
                  <a
                    key={l.l}
                    href={l.to}
                    onClick={e => {
                      if ((l as { onClick?: () => void }).onClick) {
                        e.preventDefault();
                        (l as unknown as { onClick: () => void }).onClick();
                      }
                    }}
                    className="block text-xs text-white/40 mb-2 hover:text-white/70 transition-colors"
                  >
                    {l.l}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-4 text-center text-[11px] text-white/20">
            © 2026 Photofacto. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
