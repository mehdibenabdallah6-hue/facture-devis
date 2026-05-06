import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Camera,
  Check,
  ClipboardList,
  FileText,
  MessageCircle,
  Mic,
  Package,
  Palette,
  PenLine,
  Receipt,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react';
import { TestimonialColumn, type Testimonial } from '../components/TestimonialColumn';
import { MiniDevisDemo } from '../components/MiniDevisDemo';
import { FOUNDER_PRICE_NOTICE, PRICE_TAX_LABEL } from '../lib/billing';

type ProfessionKey =
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

interface LandingPageProps {
  profession?: ProfessionKey;
}

interface ProfessionCopy {
  title: string;
  description: string;
  hero: ReactNode;
  subtitle: string;
  example: string;
  specialty: string;
}

const professionCopy: Record<ProfessionKey, ProfessionCopy> = {
  plombier: {
    title: 'Logiciel devis facture plombier avec signature en ligne | Photofacto',
    description:
      "Créez vos devis plomberie depuis photo ou dictée, envoyez un lien de signature au client, transformez en facture et suivez les paiements.",
    hero: <>Devis et factures plombier, prêts à envoyer et à signer.</>,
    subtitle:
      "Prenez une photo, dictez l'intervention, préparez le devis, envoyez-le au client pour signature, puis transformez-le en facture.",
    example: 'remplacement robinet cuisine + déplacement + raccordement',
    specialty: 'Dépannage, remplacement, entretien, urgence, facture rapide.',
  },
  electricien: {
    title: 'Logiciel devis facture électricien depuis téléphone | Photofacto',
    description:
      'Photofacto aide les électriciens à créer leurs devis, les faire signer en ligne, générer les factures et suivre les paiements.',
    hero: <>Devis et factures électricien depuis votre téléphone.</>,
    subtitle:
      'Tableau, prises, mise aux normes ou dépannage : décrivez le chantier, vérifiez le devis, faites signer puis facturez.',
    example: 'pose tableau électrique + 6 prises + déplacement',
    specialty: 'Tableau, prises, mise aux normes, dépannage.',
  },
  macon: {
    title: 'Logiciel devis facture maçon avec IA et signature | Photofacto',
    description:
      'Préparez des devis de maçonnerie plus vite, faites signer le client en ligne et gardez vos factures au même endroit.',
    hero: <>Devis maçonnerie prêts à corriger, envoyer et signer.</>,
    subtitle:
      'Décrivez la prestation comme sur chantier. Photofacto prépare un brouillon de devis que vous gardez toujours sous contrôle.',
    example: 'dalle béton terrasse 18m² + préparation + évacuation',
    specialty: 'Dalles, murets, reprises, situations de travaux.',
  },
  peintre: {
    title: 'Logiciel de devis peinture avec IA, signature et relances | Photofacto',
    description:
      'Décrivez surfaces, préparation, peinture et fournitures. Le client signe en ligne, vous facturez plus vite.',
    hero: <>Logiciel de devis peinture avec IA, signature et relances.</>,
    subtitle:
      'Décrivez les surfaces, prestations et fournitures. Photofacto prépare le devis, le client signe en ligne, vous facturez plus vite.',
    example: 'peinture murs salon 32m² + enduit + protection chantier',
    specialty: 'Surfaces, préparation, main-d’œuvre, fournitures.',
  },
  carreleur: {
    title: 'Logiciel devis facture carreleur avec catalogue de prix | Photofacto',
    description:
      'Créez vos devis carrelage avec photo, description, catalogue de prix, signature client et facture PDF.',
    hero: <>Devis carrelage plus rapides, du chantier à la signature.</>,
    subtitle:
      'Ragréage, pose, plinthes, joints : réutilisez vos prix habituels et envoyez un devis clair au client.',
    example: 'pose carrelage salon 45m² + ragréage + plinthes',
    specialty: 'Pose, ragréage, plinthes, joints, dépose.',
  },
  couvreur: {
    title: 'Logiciel devis facture couvreur avec photo de notes | Photofacto',
    description:
      'Transformez vos notes et photos de toiture en devis modifiables, envoyez le lien au client et suivez les paiements.',
    hero: <>Devis toiture clairs, photo de notes et signature mobile.</>,
    subtitle:
      'Réparation, zinguerie, fuite ou entretien : préparez un devis propre sans repartir de zéro le soir.',
    example: 'réparation fuite toiture + remplacement 8 tuiles + nacelle',
    specialty: 'Fuites, tuiles, zinguerie, entretien toiture.',
  },
  menuisier: {
    title: 'Logiciel devis facture menuisier avec PDF personnalisé | Photofacto',
    description:
      'Préparez vos devis menuiserie, ajoutez votre design, envoyez pour signature et transformez en facture.',
    hero: <>Devis menuiserie propres, signés et prêts à facturer.</>,
    subtitle:
      'Pose, fabrication, ajustements et fournitures restent centralisés dans vos devis, clients et factures.',
    example: "pose porte d'entrée + ajustement dormant + quincaillerie",
    specialty: 'Pose, fabrication, ajustements, quincaillerie.',
  },
  serrurier: {
    title: 'Logiciel devis facture serrurier pour interventions rapides | Photofacto',
    description:
      'Créez devis et factures de serrurerie sur téléphone, envoyez au client, faites signer et gardez l’historique.',
    hero: <>Serrurerie : devis rapide, signature client, facture propre.</>,
    subtitle:
      'Dépannage, ouverture, remplacement ou urgence : préparez le document pendant que tout est encore frais.',
    example: 'ouverture porte + remplacement cylindre + déplacement urgence',
    specialty: 'Ouverture, dépannage, remplacement, urgence.',
  },
  plaquiste: {
    title: 'Logiciel devis facture plaquiste avec IA et relances | Photofacto',
    description:
      'Préparez vos devis placo, isolation et joints avec description rapide, puis suivez signature, facture et paiements.',
    hero: <>Devis plaquiste plus simples, lignes claires et client signé.</>,
    subtitle:
      'Cloisons, doublage, joints, isolation : Photofacto prépare un brouillon à vérifier et envoyer.',
    example: 'pose cloisons BA13 40m² + bandes + isolation',
    specialty: 'Placo, joints, doublage, isolation.',
  },
  chauffagiste: {
    title: 'Logiciel devis facture chauffagiste avec signature en ligne | Photofacto',
    description:
      'Entretien, dépannage, chaudière ou PAC : créez, envoyez, signez et facturez depuis Photofacto.',
    hero: <>Chauffage : devis signé en ligne, facture prête à envoyer.</>,
    subtitle:
      'Décrivez l’intervention, réutilisez vos prestations, envoyez au client et suivez les retards de paiement.',
    example: 'entretien chaudière gaz + déplacement + remplacement joint',
    specialty: 'Entretien, dépannage, chaudière, pompe à chaleur.',
  },
  paysagiste: {
    title: 'Logiciel devis facture paysagiste pour espaces verts | Photofacto',
    description:
      'Devis espaces verts depuis photo ou dictée, signature client, facture PDF et suivi des paiements.',
    hero: <>Devis paysagiste depuis le terrain, sans retaper le soir.</>,
    subtitle:
      'Tonte, taille, élagage, aménagement : gardez vos clients, prestations et relances au même endroit.',
    example: 'taille haie 20ml + évacuation déchets verts + déplacement',
    specialty: 'Tonte, taille, élagage, entretien, aménagement.',
  },
};

const testimonials: Testimonial[] = [
  {
    quote:
      "Je fais souvent mes devis le soir après les chantiers. Pouvoir préparer un devis depuis mes notes et l’envoyer à signer directement, ça me fait gagner du temps.",
    name: 'Artisan multiservices',
    role: 'Retour bêta anonymisé',
    image: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    quote:
      "Le lien de signature est super pratique. Le client reçoit le devis, le signe sur son téléphone, et je peux passer à la facture sans relancer trois fois.",
    name: 'Électricien',
    role: 'Retour bêta anonymisé',
    image: 'https://randomuser.me/api/portraits/men/52.jpg',
  },
  {
    quote:
      "Avant je gardais mes prix dans plusieurs fichiers. Là j’ai mes clients, mes prestations et mes factures au même endroit.",
    name: 'Peintre',
    role: 'Retour bêta anonymisé',
    image: 'https://randomuser.me/api/portraits/men/41.jpg',
  },
  {
    quote:
      "La relance des factures en retard, c’est exactement le genre de truc que j’oubliais de faire.",
    name: 'Plombier',
    role: 'Retour bêta anonymisé',
    image: 'https://randomuser.me/api/portraits/men/15.jpg',
  },
  {
    quote:
      "Je dicte la prestation en sortant de chez le client, je corrige plus tard à la maison. C’est plus rapide que de tout taper le soir.",
    name: 'Plombier dépannage',
    role: 'Retour bêta anonymisé',
    image: 'https://randomuser.me/api/portraits/men/76.jpg',
  },
  {
    quote:
      "Le PDF est sobre, ça fait sérieux. Mes clients voient tout de suite à quoi correspond chaque ligne.",
    name: 'Carreleur',
    role: 'Retour bêta anonymisé',
    image: 'https://randomuser.me/api/portraits/men/83.jpg',
  },
  {
    quote:
      "Les pages de signature sont claires, le client comprend ce qu’il signe sans que j’aie à expliquer au téléphone.",
    name: 'Couvreur',
    role: 'Retour bêta anonymisé',
    image: 'https://randomuser.me/api/portraits/men/64.jpg',
  },
  {
    quote:
      "J’avais peur de l’IA pour les devis. Au final ça me sort un brouillon que je modifie en deux minutes, c’est juste plus rapide qu’écrire de zéro.",
    name: 'Menuisier',
    role: 'Retour bêta anonymisé',
    image: 'https://randomuser.me/api/portraits/men/27.jpg',
  },
  {
    quote:
      "Sur les chantiers, je fais beaucoup de devis qui se ressemblent. Le catalogue qu’on retrouve d’un devis à l’autre m’évite de tout retaper.",
    name: 'Maçon',
    role: 'Retour bêta anonymisé',
    image: 'https://randomuser.me/api/portraits/men/19.jpg',
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

const stats = [
  ['IA', 'devis depuis photo ou dictée'],
  ['Signature', 'client signe sur téléphone'],
  ['Relances', 'impayés visibles'],
  ['Catalogue', 'prix propres et réutilisables'],
  ['Factur-X', 'export prêt pour la suite'],
];

const workflowSteps = [
  {
    n: '01',
    icon: <Camera className="w-[22px] h-[22px] text-primary" />,
    t: 'Photo du carnet ou dictée',
    d: 'Photographiez vos notes terrain ou dictez la prestation comme à un collègue. Aucune saisie complexe, pas de formulaire à remplir.',
  },
  {
    n: '02',
    icon: <Sparkles className="w-[22px] h-[22px] text-primary" />,
    t: 'Extraction par l’IA',
    d: 'L’IA reconnaît les prestations dans vos notes et les structure en lignes propres : libellés, quantités, unités.',
  },
  {
    n: '03',
    icon: <ClipboardList className="w-[22px] h-[22px] text-primary" />,
    t: 'Vos prix, votre catalogue',
    d: 'Photofacto applique automatiquement les prix de votre catalogue. L’IA ne devine rien, elle structure ce que vous avez déjà.',
  },
  {
    n: '04',
    icon: <Receipt className="w-[22px] h-[22px] text-primary" />,
    t: 'Devis prêt, signature, facture',
    d: 'Vous vérifiez le devis, l’envoyez à signer en ligne, puis le transformez en facture en un clic.',
  },
];

const features = [
  {
    icon: <Mic className="w-[18px] h-[18px] text-primary" />,
    t: 'IA photo & dictée',
    d: 'Prenez une photo du chantier ou dictez la prestation. Photofacto prépare un devis modifiable.',
  },
  {
    icon: <FileText className="w-[18px] h-[18px] text-primary" />,
    t: 'Devis & factures',
    d: 'Créez des devis, factures, acomptes et avoirs avec des documents propres et professionnels.',
  },
  {
    icon: <Smartphone className="w-[18px] h-[18px] text-primary" />,
    t: 'Signature en ligne',
    d: 'Envoyez un lien au client. Il consulte et signe le devis directement sur son téléphone.',
  },
  {
    icon: <Bell className="w-[18px] h-[18px] text-primary" />,
    t: 'Relances clients',
    d: 'Suivez les factures en retard et relancez les clients sans avoir à tout retenir.',
  },
  {
    icon: <Users className="w-[18px] h-[18px] text-primary" />,
    t: 'Clients & historique',
    d: 'Retrouvez les coordonnées, documents, devis, factures et échanges par client.',
  },
  {
    icon: <Package className="w-[18px] h-[18px] text-primary" />,
    t: 'Catalogue intelligent',
    d: 'Importez vos prix depuis Excel, anciens devis, carnet ou notes. Photofacto les rend propres, cohérents et réutilisables.',
  },
  {
    icon: <Palette className="w-[18px] h-[18px] text-primary" />,
    t: 'PDF personnalisé',
    d: 'Ajoutez logo, couleurs, design et informations légales sur vos documents.',
  },
  {
    icon: <ShieldCheck className="w-[18px] h-[18px] text-primary" />,
    t: 'Factur-X exportable',
    d: 'Préparez des documents structurés. La connexion à une plateforme agréée est en préparation.',
  },
];

const trades = [
  ['Plombier', 'Dépannage, remplacement, entretien, urgence, facture rapide.'],
  ['Peintre', 'Devis de surface, préparation, main-d’œuvre, fournitures.'],
  ['Électricien', 'Tableau, prises, mise aux normes, dépannage.'],
  ['Multiservices', 'Petites interventions, devis rapides, relances simples.'],
  ['Carreleur', 'Pose, ragréage, plinthes, joints, dépose ancien carrelage.'],
  ['Chauffagiste', 'Entretien, dépannage, chaudière, pompe à chaleur.'],
  ['Menuisier', 'Pose, fabrication, ajustements, quincaillerie.'],
  ['Paysagiste', 'Tonte, taille, élagage, entretien, aménagement.'],
];

const catalogSources = ['Excel', 'Carnet papier', 'Ancien devis', 'Photo de notes', 'Notes WhatsApp'];

const catalogBenefits = [
  {
    t: 'Vous ne repartez plus de zéro',
    d: 'Vos anciens prix, prestations et habitudes deviennent une base de travail propre.',
  },
  {
    t: 'Vos devis deviennent cohérents',
    d: 'Même nom de prestation, même unité, même prix de départ : moins d’oublis et moins d’écarts.',
  },
  {
    t: 'Votre activité se structure toute seule',
    d: 'À chaque client, devis, facture, signature ou relance, Photofacto enrichit votre espace commercial.',
  },
];

const faq = [
  {
    q: 'Photofacto remplace-t-il mon logiciel de facturation ?',
    a: 'Oui, Photofacto permet de créer des devis et factures, gérer les clients, générer des PDF et suivre les paiements. Selon vos besoins comptables, vous pouvez aussi exporter vos documents.',
  },
  {
    q: 'Le client peut-il signer un devis sur téléphone ?',
    a: 'Oui. Vous générez un lien de signature et vous l’envoyez par email ou WhatsApp. Le client signe en ligne.',
  },
  {
    q: 'Puis-je relancer les factures impayées ?',
    a: 'Oui. Photofacto affiche les factures en retard et vous aide à relancer vos clients.',
  },
  {
    q: 'Puis-je réutiliser mes anciens prix et prestations ?',
    a: 'Oui. L’objectif du catalogue intelligent est de partir de ce que vous avez déjà — Excel, carnet, anciens devis ou notes — pour créer une base propre et réutilisable.',
  },
  {
    q: "Est-ce que l'IA décide à ma place ?",
    a: 'Non. L’IA prépare un brouillon. Vous vérifiez, corrigez et validez toujours avant d’envoyer.',
  },
  {
    q: 'Est-ce compatible Factur-X ?',
    a: 'Photofacto prévoit l’export Factur-X pour préparer des documents structurés.',
  },
  {
    q: 'Est-ce conforme à la réforme de la facturation électronique ?',
    a: 'Photofacto prépare la transition avec Factur-X et prévoit une connexion à une plateforme agréée partenaire. Nous ne promettons pas une conformité complète tant que cette connexion n’est pas active.',
  },
  {
    q: 'Est-ce adapté aux auto-entrepreneurs ?',
    a: 'Oui, Photofacto est pensé pour les artisans solo, auto-entrepreneurs et petites entreprises.',
  },
  {
    q: 'Puis-je utiliser Photofacto sur téléphone ?',
    a: 'Oui, l’interface est pensée pour créer, envoyer et suivre les devis depuis le terrain.',
  },
];

export default function LandingPage({ profession }: LandingPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const copy = profession ? professionCopy[profession] : null;

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

  useEffect(() => {
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

    if (copy) {
      setMeta(copy.title, copy.description);
    } else {
      setMeta(
        'Photofacto — Devis, catalogue intelligent, signature et relances pour artisans',
        "Créez vos devis avec l’IA, structurez votre catalogue de prix, faites signer vos clients, générez vos factures et relancez les impayés.",
      );
    }
  }, [copy]);

  const goRegister = () => navigate('/inscription?mode=register');
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const heroTitle = copy ? (
    copy.hero
  ) : (
    <>
      Prenez vos notes en photo,
      <br />
      <span className="text-primary">Photofacto prépare le devis.</span>
    </>
  );

  const heroSubtitle =
    copy?.subtitle ||
    "L’IA structure le devis à partir de vos notes ou de votre dictée. Vos prix viennent de votre catalogue, pas de l’IA. Vous vérifiez, envoyez, faites signer, puis transformez en facture.";

  // Common reveal-on-scroll motion props for section intros. Centralised so
  // we keep the same easing/timing across the page and don't accidentally
  // drift into a noisier feel.
  const fadeInUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
    viewport: { once: true, amount: 0.2 },
  };

  return (
    <div className="min-h-screen bg-background font-body text-on-surface">
      <div className="accent-bar-spark" />

      <nav className="flex items-center justify-between gap-2 px-3.5 md:px-14 py-2.5 md:py-4 bg-white border-b-spark sticky top-0 z-40 backdrop-blur">
        <a href="/" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-primary/5 flex items-center justify-center overflow-hidden shrink-0">
            <img src="/icons/icon-192.png" alt="Logo Photofacto" className="w-full h-full object-contain" />
          </div>
          <span className="wordmark-photofacto text-[17px] md:text-xl min-w-0">
            <span className="wm-photo">PHOTO</span><span className="wm-facto">FACTO</span>
          </span>
        </a>
        <div className="hidden lg:flex items-center gap-7">
          {[
            { label: 'Fonctionnalités', href: '#features' },
            { label: 'Catalogue', href: '#catalogue' },
            { label: 'Signature', href: '#signature' },
            { label: 'Relances', href: '#relances' },
            { label: 'Tarifs', href: '#pricing' },
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
            onClick={goRegister}
            className="inline-flex min-touch items-center gap-1.5 bg-primary text-white px-3.5 sm:px-5 py-2 rounded-[10px] text-xs sm:text-[13px] font-bold shadow-spark-cta hover:shadow-spark-cta-lg active:scale-95 transition-all duration-200 ease-out cursor-pointer whitespace-nowrap"
          >
            Créer un devis
          </button>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(232,98,26,0.13),transparent_32%),radial-gradient(circle_at_90%_20%,rgba(46,52,64,0.09),transparent_26%)]" />
        <div className="relative max-w-[1200px] mx-auto px-4 md:px-14 py-8 md:py-20 grid md:grid-cols-[1fr_460px] gap-7 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/[0.07] border border-primary/[0.18] rounded-full px-2.5 md:px-3 py-1.5 mb-4 md:mb-7">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-[11px] md:text-xs font-semibold text-primary-dim">
                Photo ou dictée · Catalogue intelligent · Signature mobile
              </span>
            </div>
            <h1 className="font-headline font-extrabold text-[34px] sm:text-[52px] lg:text-[62px] leading-[1.04] text-secondary-dim mb-4 md:mb-5">
              {heroTitle}
            </h1>
            <p className="text-[15px] md:text-[17px] text-on-surface-variant leading-[1.55] md:leading-[1.7] max-w-[560px] mb-5 md:mb-8">
              {heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-col">
                <button
                  onClick={goRegister}
                  className="btn-glow min-touch inline-flex items-center justify-center gap-2 bg-primary text-white border-none px-4 sm:px-7 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[13px] sm:text-base shadow-spark-cta-lg hover:-translate-y-0.5 hover:shadow-spark-cta-xl active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer"
                >
                  <FileText className="w-[18px] h-[18px]" />
                  Créer mon premier devis
                  <ArrowRight className="w-4 h-4" />
                </button>
                <span className="mt-2 text-[11px] font-medium text-on-surface-variant text-center sm:text-left">
                  Gratuit · sans carte bancaire
                </span>
              </div>
              <button
                onClick={() => scrollTo('demo')}
                className="min-touch inline-flex items-center justify-center gap-2 bg-white border-spark text-on-surface px-4 sm:px-7 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[13px] sm:text-base shadow-spark-sm hover:-translate-y-0.5 hover:shadow-spark-cta-xl active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer self-start"
              >
                <Zap className="w-[18px] h-[18px] text-primary" />
                Voir une démo en 30s
              </button>
            </div>
            <div className="flex flex-col gap-2.5 mt-6">
              {[
                'Vos prix, votre catalogue — l’IA ne devine rien',
                'Photo ou dictée, vous gardez la main sur chaque ligne',
                'Du devis signé à la relance, tout reste dans Photofacto',
              ].map(t => (
                <div
                  key={t}
                  className="flex items-start gap-2 text-[13px] font-medium text-on-surface-variant"
                >
                  <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </div>
                  {t}
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: [0, -6, 0], scale: 1 }}
            transition={{
              opacity: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
              y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="relative w-full max-w-[500px] md:max-w-[660px] lg:max-w-[720px] mx-auto md:mx-0 md:scale-[1.04] lg:scale-[1.08] transition-transform duration-300"
          >
            <div className="absolute -inset-6 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(232,98,26,0.16),transparent_42%),radial-gradient(circle_at_75%_75%,rgba(46,52,64,0.10),transparent_38%)] rounded-[36px]" />
            <img
              src="/hero-photo-to-devis.jpg"
              alt="Carnet manuscrit avec les notes d'un chantier salle de bain, photographié avec un téléphone, à côté du devis structuré généré par Photofacto avec les prix issus du catalogue intelligent"
              width={1280}
              height={960}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="relative w-full h-auto rounded-[24px] shadow-spark-lg border-spark"
            />
          </motion.div>
        </div>
      </section>

      <section className="bg-white border-y-spark py-4 md:py-7">
        <div className="max-w-[1200px] mx-auto px-4 md:px-14 grid grid-cols-2 sm:grid-cols-5 gap-2.5 md:gap-3">
          {stats.map(([v, l], i) => (
            <div key={v} className="flex items-center justify-center gap-5 rounded-xl md:rounded-2xl bg-background/70 px-2 py-2.5 sm:bg-transparent sm:px-0 sm:py-0">
              {i > 0 && <div className="hidden md:block w-px h-10 bg-outline-variant" />}
              <div className="text-center">
                <div className="font-headline text-[24px] md:text-[28px] font-bold text-primary">{v}</div>
                <div className="text-[10px] md:text-[11px] text-on-surface-variant font-medium mt-0.5">{l}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-10 md:py-16 px-4 md:px-14 bg-background">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-6 md:gap-10 items-center">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-3">
              Argent qui dort
            </div>
            <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim mb-3 leading-tight">
              Vous ne perdez pas seulement du temps. Vous perdez aussi des chantiers et des paiements.
            </h2>
            <p className="text-[15px] text-on-surface-variant leading-relaxed">
              Un devis envoyé trop tard, un client qui oublie de signer, une facture impayée non relancée… à la fin, c’est de l’argent qui dort.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white border-spark rounded-[20px] p-5 shadow-spark-md">
              <div className="font-headline font-bold text-secondary-dim mb-4">Avant Photofacto</div>
              {['Notes dans WhatsApp', 'Devis dans Word ou Excel', 'PDF perdu dans les mails', 'Relances oubliées', 'Client jamais signé'].map(item => (
                <div key={item} className="flex items-center gap-2 py-2 text-sm text-on-surface-variant">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  {item}
                </div>
              ))}
            </div>
            <div className="bg-secondary-dim text-white rounded-[20px] p-5 shadow-spark-lg">
              <div className="font-headline font-bold mb-4">Avec Photofacto</div>
              {['Photo + dictée', 'Catalogue propre', 'Devis prêt à corriger', 'Lien de signature', 'Facture générée', 'Relance suivie'].map(item => (
                <div key={item} className="flex items-center gap-2 py-2 text-sm text-white/75">
                  <Check className="w-4 h-4 text-primary" strokeWidth={3} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-10 md:py-16 px-4 md:px-14 bg-white border-y-spark">
        <div className="max-w-[1200px] mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-8 md:mb-11">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-3">
              Comment ça marche
            </div>
            <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim mb-2.5">
              De vos notes au devis prêt à envoyer, en 4 étapes.
            </h2>
            <p className="text-[15px] text-on-surface-variant max-w-2xl mx-auto">
              Vous capturez votre prestation, l’IA structure les lignes, votre catalogue applique vos prix, puis vous envoyez à signer et facturez.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {workflowSteps.map(({ n, icon, t, d }, i) => (
              <motion.div
                key={n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="bg-background rounded-[18px] p-5 border-spark shadow-spark-sm relative overflow-hidden hover:-translate-y-1 hover:shadow-spark-md hover:border-primary/30 transition-all duration-200 ease-out"
              >
                <div className="absolute top-3 right-4 font-headline font-extrabold text-[42px] text-primary/[0.06] leading-none">
                  {n}
                </div>
                <div className="w-[44px] h-[44px] bg-primary/[0.08] rounded-xl flex items-center justify-center mb-4">
                  {icon}
                </div>
                <div className="font-headline font-bold text-sm text-secondary-dim mb-2">{t}</div>
                <div className="text-[12px] text-on-surface-variant leading-relaxed">{d}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-10 md:py-16 px-4 md:px-14 bg-background">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim mb-2 text-center">
            Tout ce qu’il faut pour gérer vos devis et factures artisan.
          </h2>
          <p className="text-[15px] text-on-surface-variant text-center mb-8 md:mb-10">
            Pas un outil de plus à ouvrir : clients, catalogue, devis, signature, factures, PDF et relances restent dans le même espace.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {features.map(({ icon, t, d }) => (
              <div key={t} className="bg-white rounded-2xl p-5 shadow-spark-sm border-spark hover:-translate-y-1 hover:shadow-spark-md hover:border-primary/30 transition-all duration-200 ease-out">
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

      <section id="catalogue" className="py-10 md:py-16 px-4 md:px-14 bg-white border-y-spark overflow-hidden">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-[0.95fr_1.05fr] gap-8 md:gap-12 items-center">
          <motion.div {...fadeInUp}>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-3">
              Pourquoi le catalogue intelligent
            </div>
            <h2 className="font-headline font-extrabold text-3xl md:text-[42px] text-secondary-dim mb-3 leading-tight">
              Comment l’IA connaît vos prix ? Elle ne les connaît pas. Vous, oui.
            </h2>
            <p className="text-[15px] md:text-base text-on-surface-variant leading-relaxed max-w-2xl mb-5">
              L’IA reconnaît <strong>les prestations</strong> dans vos notes (« pose meuble vasque », « mitigeur », « déplacement »). C’est <strong>votre catalogue</strong> qui applique <strong>vos prix</strong>, vos unités, vos forfaits. Photofacto vous aide à le construire à partir de ce que vous avez déjà — Excel, carnet, anciens devis, photos ou notes.
            </p>
            <div className="bg-primary/[0.06] border border-primary/[0.18] rounded-2xl p-4 mb-6 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <div className="font-headline font-bold text-sm text-secondary-dim mb-0.5">L’IA ne fixe jamais vos prix.</div>
                <p className="text-[13px] text-on-surface-variant leading-relaxed">
                  Sans prix dans votre catalogue, la ligne reste à compléter. Vous gardez la main sur chaque tarif et chaque marge.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {catalogSources.map(source => (
                <span
                  key={source}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.08] border border-primary/[0.16] px-3 py-1.5 text-xs font-bold text-primary-dim"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  {source}
                </span>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {catalogBenefits.map(({ t, d }) => (
                <div key={t} className="bg-background rounded-2xl border-spark p-4">
                  <div className="font-headline font-bold text-sm text-secondary-dim mb-1.5">{t}</div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, rotate: 1 }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="relative mx-auto w-full max-w-[760px] rounded-[28px] border border-outline-variant/10 bg-white p-2.5 shadow-spark-lg md:p-3">
              <img
                src="/catalogue-intelligent-visual.png"
                alt="Schéma du catalogue intelligent Photofacto : sources existantes, organisation par Photofacto puis catalogue réutilisable"
                loading="lazy"
                className="block h-auto w-full rounded-[22px] object-contain"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section id="du-devis-a-la-facture" className="py-10 md:py-16 px-4 md:px-14 bg-background border-y-spark">
        <div className="max-w-[1200px] mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-8 md:mb-10 max-w-[680px] mx-auto">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-3">
              Du devis à la facture
            </div>
            <h2 className="font-headline font-extrabold text-3xl md:text-[42px] text-secondary-dim mb-3 leading-tight">
              Un seul flux : signer, facturer, relancer.
            </h2>
            <p className="text-[15px] text-on-surface-variant leading-relaxed">
              Une fois le devis envoyé, la suite reste fluide. Pas d’outil supplémentaire à ouvrir, pas de re-saisie : Photofacto enchaîne les étapes pour vous.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-4 md:gap-5">
            {[
              {
                icon: <PenLine className="w-5 h-5 text-primary" />,
                t: 'Signature en ligne',
                d: 'Le client reçoit un lien par email ou WhatsApp et signe sur son téléphone, sans imprimer ni scanner.',
                href: '#signature',
                cta: 'Voir la signature',
              },
              {
                icon: <Receipt className="w-5 h-5 text-primary" />,
                t: 'Facture en un clic',
                d: 'Le devis signé devient une facture PDF propre, avec votre numérotation, vos mentions et votre design.',
                href: '#features',
                cta: 'Voir la facturation',
              },
              {
                icon: <Bell className="w-5 h-5 text-primary" />,
                t: 'Relances suivies',
                d: 'Les factures en retard ressortent dans votre tableau de bord, avec un message de relance prêt à envoyer.',
                href: '#relances',
                cta: 'Voir les relances',
              },
            ].map(({ icon, t, d, href, cta }, i) => (
              <motion.a
                key={t}
                href={href}
                onClick={e => { e.preventDefault(); scrollTo(href.replace('#', '')); }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="group bg-white rounded-3xl border-spark shadow-spark-sm p-5 md:p-6 hover:-translate-y-1 hover:shadow-spark-md hover:border-primary/30 transition-all duration-200 ease-out cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/[0.08] flex items-center justify-center shrink-0">
                    {icon}
                  </div>
                  <div className="font-headline font-extrabold text-base md:text-lg text-secondary-dim">
                    {`${i + 1}. ${t}`}
                  </div>
                </div>
                <p className="text-[13px] md:text-sm text-on-surface-variant leading-relaxed mb-4">
                  {d}
                </p>
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-primary group-hover:gap-2.5 transition-all">
                  {cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      <section id="signature" className="py-10 md:py-16 px-4 md:px-14 bg-secondary-dim text-white overflow-hidden">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-[1fr_390px] gap-8 md:gap-12 items-center">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-3">
              Signature en ligne
            </div>
            <h2 className="font-headline font-extrabold text-3xl md:text-[42px] mb-3 leading-tight">
              Le client signe le devis sur son téléphone.
            </h2>
            <p className="text-white/65 text-[15px] md:text-base leading-relaxed max-w-2xl mb-6">
              Envoyez un lien par WhatsApp ou email. Le client consulte le devis, signe en ligne, et la signature revient automatiquement dans Photofacto.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {['Lien partageable', 'Signature mobile', 'Devis marqué comme signé', 'PDF avec signature', 'Transformation en facture plus rapide'].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-white/75">
                  <Check className="w-4 h-4 text-primary" strokeWidth={3} />
                  {item}
                </div>
              ))}
            </div>
            <button
              onClick={goRegister}
              className="min-touch inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3.5 rounded-xl font-bold text-sm shadow-spark-cta-lg hover:-translate-y-0.5 hover:shadow-spark-cta-xl active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer"
            >
              Tester la signature en ligne
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white text-on-surface rounded-[24px] p-5 shadow-spark-lg rotate-[-1deg]">
            <div className="flex justify-between border-b border-outline-variant/20 pb-4 mb-4">
              <div>
                <div className="font-headline font-bold text-lg text-secondary-dim">Devis n°DEV-2026-014</div>
                <div className="text-xs text-on-surface-variant">Montant : 1 275,00 €</div>
              </div>
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <div className="rounded-2xl bg-background border-spark p-4 mb-4">
              <div className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-2">
                Signature du client
              </div>
              <div className="h-20 rounded-xl bg-white border border-dashed border-primary/40 flex items-center justify-center">
                <span className="font-headline text-2xl text-primary -rotate-6">M. Martin</span>
              </div>
            </div>
            <button
              onClick={goRegister}
              className="w-full min-touch bg-primary text-white rounded-xl py-3 text-sm font-bold"
            >
              Signer le devis
            </button>
          </div>
        </div>
      </section>

      <section id="relances" className="py-10 md:py-16 px-4 md:px-14 bg-white border-b-spark">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-[390px_1fr] gap-8 md:gap-12 items-center">
          <div className="bg-background rounded-[24px] p-5 border-spark shadow-spark-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                  Tableau de bord
                </div>
                <div className="font-headline font-bold text-xl text-secondary-dim">Paiements à suivre</div>
              </div>
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-2xl p-4 border-spark">
                <div className="text-2xl font-headline font-extrabold text-red-600">3</div>
                <div className="text-xs text-on-surface-variant">factures en retard</div>
              </div>
              <div className="bg-white rounded-2xl p-4 border-spark">
                <div className="text-2xl font-headline font-extrabold text-primary">2 840 €</div>
                <div className="text-xs text-on-surface-variant">à récupérer</div>
              </div>
            </div>
            {['F-2026-018 · en retard depuis 9 jours', 'F-2026-021 · envoyée il y a 5 jours'].map(item => (
              <div key={item} className="bg-white rounded-xl border-spark px-3 py-3 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-xs font-semibold text-on-surface">{item}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-3">
              Trésorerie
            </div>
            <h2 className="font-headline font-extrabold text-3xl md:text-[42px] text-secondary-dim mb-3 leading-tight">
              N’oubliez plus les factures impayées.
            </h2>
            <p className="text-[15px] md:text-base text-on-surface-variant leading-relaxed max-w-2xl mb-6">
              Une facture oubliée, c’est de la trésorerie qui dort. Photofacto vous montre les factures en retard et vous aide à relancer vos clients au bon moment.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {['Factures en retard visibles', 'Montant total à récupérer', 'Historique des relances', 'Relance email', 'Message WhatsApp copiable'].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <Check className="w-4 h-4 text-primary" strokeWidth={3} />
                  {item}
                </div>
              ))}
            </div>
            <button
              onClick={goRegister}
              className="min-touch inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3.5 rounded-xl font-bold text-sm shadow-spark-cta-lg hover:-translate-y-0.5 hover:shadow-spark-cta-xl active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer"
            >
              Voir comment relancer mes clients
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section id="demo" className="py-10 md:py-16 px-4 md:px-14 bg-background">
        <div className="max-w-[960px] mx-auto bg-white rounded-[24px] border-spark shadow-spark-lg p-5 md:p-8">
          <MiniDevisDemo page="home" />
        </div>
      </section>

      <section className="py-10 md:py-16 px-4 md:px-14 bg-white border-y-spark">
        <div className="max-w-[1200px] mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-8">
            <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim mb-2.5">
              Pensé pour les artisans qui veulent passer moins de temps sur l’administratif.
            </h2>
            <p className="text-[15px] text-on-surface-variant">
              BTP, dépannage, petits chantiers ou interventions rapides : le but reste le même, envoyer plus vite et encaisser mieux.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {trades.map(([name, desc]) => (
              <div key={name} className="bg-background rounded-2xl p-5 border-spark hover:-translate-y-1 hover:shadow-spark-md hover:border-primary/30 transition-all duration-200 ease-out">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="w-4 h-4 text-primary" />
                  <div className="font-headline font-bold text-secondary-dim">{name}</div>
                </div>
                <div className="text-xs text-on-surface-variant leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 md:py-16 px-4 md:px-14 bg-background">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-[1fr_360px] gap-8 items-center">
          <div>
            <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim mb-3">
              Factur-X exportable, conformité progressive.
            </h2>
            <p className="text-[15px] text-on-surface-variant leading-relaxed max-w-2xl">
              Photofacto vous aide à préparer des documents structurés, propres et mieux rangés. La connexion à une plateforme agréée partenaire est prévue pour accompagner la réforme de la facturation électronique.
            </p>
          </div>
          <div className="bg-white rounded-[22px] p-5 border-spark shadow-spark-md">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-primary" />
              <div className="font-headline font-bold text-secondary-dim">Marchés publics</div>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Pour les artisans qui travaillent avec des collectivités ou organismes publics, Photofacto prépare les informations utiles pour vos démarches Chorus Pro.
            </p>
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-10 md:py-14 px-4 md:px-14 bg-white border-y-spark relative">
        <div className="max-w-[1200px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="flex flex-col items-center justify-center max-w-[580px] mx-auto"
          >
            <div className="flex justify-center">
              <div className="border-spark rounded-lg py-1 px-4 text-xs font-bold uppercase tracking-wider text-primary">
                Cas d’usage artisans
              </div>
            </div>
            <h2 className="font-headline font-extrabold text-3xl md:text-4xl lg:text-5xl text-secondary-dim text-center mt-5 tracking-tight">
              Retours terrain, sans promesse magique.
            </h2>
            <p className="text-center mt-4 text-[15px] text-on-surface-variant">
              Des exemples anonymisés de situations où le catalogue, la signature et les relances font gagner du temps.
            </p>
          </motion.div>

          <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[680px] overflow-hidden">
            <TestimonialColumn testimonials={firstColumn} duration={26} />
            <TestimonialColumn testimonials={secondColumn} className="hidden md:block" duration={32} />
            <TestimonialColumn testimonials={thirdColumn} className="hidden lg:block" duration={29} />
          </div>
        </div>
      </section>

      <section id="pricing" className="py-10 md:py-14 px-4 md:px-14 bg-background border-b-spark">
        <div className="max-w-[1200px] mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-8 md:mb-11">
            <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim mb-2.5">
              Démarrez gratuitement
            </h2>
            <p className="text-[15px] text-on-surface-variant">
              Testez le tunnel complet, puis passez sur un plan plus confortable quand vous en avez besoin.
            </p>
            <p className="mt-3 inline-flex rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs md:text-sm font-bold text-primary">
              {FOUNDER_PRICE_NOTICE}
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-4 md:gap-5 max-w-[960px] mx-auto">
            {[
              {
                name: 'Gratuit',
                price: '0 €',
                per: '/ toujours',
                features: ['5 devis/factures par mois', '3 clients', '3 usages IA par mois', '1 lien de signature par mois', 'PDF avec branding Photofacto'],
                cta: 'Commencer gratuitement',
                highlight: false,
              },
              {
                name: 'Solo',
                price: '14,90 €',
                per: `${PRICE_TAX_LABEL} / mois`,
                sub: `ou 129 € ${PRICE_TAX_LABEL} / an`,
                features: ['Devis & factures illimités', 'Clients illimités', 'Catalogue intelligent', '30 usages IA / mois', '20 liens de signature / mois', 'Relances simples', 'PDF personnalisé'],
                cta: 'Commencer avec Solo',
                highlight: true,
              },
              {
                name: 'Pro',
                price: '29,90 €',
                per: `${PRICE_TAX_LABEL} / mois`,
                sub: `ou 249 € ${PRICE_TAX_LABEL} / an · pour encaisser plus vite`,
                features: [
                  'Tout Solo',
                  'IA avancée : audio, photo de notes, anciens devis',
                  'Import catalogue photo/PDF/Excel',
                  'Signatures de devis illimitées',
                  'Relances avancées d’impayés',
                  'Suivi des factures en retard',
                  'Factur-X exportable',
                  'Exports comptables (FEC, CSV)',
                ],
                cta: 'Passer en Pro',
                highlight: false,
              },
            ].map(({ name, price, per, sub, features: planFeatures, cta, highlight }) => (
              <div
                key={name}
                className={`rounded-[18px] md:rounded-[20px] p-4 md:p-7 relative overflow-hidden transition-all duration-200 ease-out hover:-translate-y-1 ${
                  highlight
                    ? 'bg-primary text-white shadow-spark-cta-xl hover:shadow-[0_24px_64px_-12px_rgba(232,98,26,0.45)]'
                    : 'bg-white border-spark shadow-spark-md hover:shadow-spark-lg hover:border-primary/30'
                }`}
              >
                {highlight && (
                  <div className="absolute top-4 right-4 bg-white/20 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                    Populaire
                  </div>
                )}
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${highlight ? 'text-white/70' : 'text-on-surface-variant'}`}>
                  {name}
                </div>
                <div className="mb-1.5">
                  <div className="flex items-baseline gap-1">
                    <span className={`font-headline font-bold text-[34px] md:text-[40px] ${highlight ? 'text-white' : 'text-secondary-dim'}`}>
                      {price}
                    </span>
                    <span className={`text-[13px] ${highlight ? 'text-white/60' : 'text-on-surface-variant'}`}>
                      {per}
                    </span>
                  </div>
                  {sub && <div className={`text-[11px] mt-1 ${highlight ? 'text-white/50' : 'text-on-surface-variant'}`}>{sub}</div>}
                </div>
                <div className={`h-px my-4 ${highlight ? 'bg-white/15' : 'bg-outline-variant'}`} />
                <div className="flex flex-col gap-2 mb-4 md:mb-6">
                  {planFeatures.map(f => (
                    <div key={f} className="flex items-center gap-2 text-[13px]">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${highlight ? 'bg-white/20' : 'bg-primary/10'}`}>
                        <Check className={`w-2 h-2 ${highlight ? 'text-white' : 'text-primary'}`} strokeWidth={3} />
                      </div>
                      <span className={highlight ? 'text-white/90' : 'text-on-surface'}>{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={goRegister}
                  className={`w-full min-touch rounded-[10px] py-3 text-[13px] font-bold ${
                    highlight ? 'bg-white text-primary' : 'bg-primary text-white shadow-spark-cta'
                  }`}
                >
                  {cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 md:py-16 px-4 md:px-14 bg-white">
        <div className="max-w-[920px] mx-auto">
          <motion.div {...fadeInUp} className="text-center mb-8">
            <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim mb-2.5">
              Questions fréquentes
            </h2>
            <p className="text-[15px] text-on-surface-variant">
              Des réponses simples, sans jargon.
            </p>
          </motion.div>
          <div className="grid gap-3">
            {faq.map(({ q, a }) => (
              <div key={q} className="bg-background rounded-2xl border-spark p-5 hover:shadow-spark-sm hover:border-primary/25 transition-all duration-200 ease-out">
                <h3 className="font-headline font-bold text-secondary-dim mb-2">{q}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary-dim py-8 md:py-14 px-4 md:px-6 text-center">
        <h2 className="font-headline font-extrabold text-[28px] md:text-[40px] text-white mb-2.5 leading-tight">
          Vos devis, factures, clients et relances au même endroit.
        </h2>
        <p className="text-sm md:text-[15px] text-white/55 mb-6 md:mb-8">
          Faites votre devis avant même de quitter le chantier, enrichissez votre catalogue, envoyez le lien au client, puis suivez ce qui reste à encaisser.
        </p>
        <button
          onClick={goRegister}
          className="min-touch inline-flex items-center justify-center gap-2 bg-primary text-white px-5 sm:px-9 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[13px] sm:text-base shadow-spark-cta-lg hover:-translate-y-0.5 hover:shadow-spark-cta-xl active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer w-full sm:w-auto"
        >
          <FileText className="w-[18px] h-[18px]" />
          Créer mon compte gratuitement
          <ArrowRight className="w-4 h-4" />
        </button>
        {copy && (
          <p className="text-white/45 text-sm mt-6">
            Exemple {copy.specialty.toLowerCase()} “{copy.example}”
          </p>
        )}
      </section>

      <footer className="bg-secondary-dim border-t border-white/10 px-4 md:px-14 py-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-10 mb-7">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center overflow-hidden">
                  <img src="/icons/icon-192.png" alt="Logo Photofacto" className="w-full h-full object-contain" />
                </div>
                <span className="wordmark-photofacto on-dark text-base">
                  <span className="wm-photo">PHOTO</span><span className="wm-facto">FACTO</span>
                </span>
              </div>
              <p className="text-xs text-white/35 leading-relaxed">
                Le logiciel de devis et factures pensé pour les artisans français : IA, catalogue intelligent, signature en ligne, relances, PDF et Factur-X exportable.
              </p>
            </div>
            {[
              {
                t: 'Produit',
                links: [
                  { l: 'Devis & factures', to: '/logiciel-devis-facture-artisan' },
                  { l: 'Signature en ligne', to: '/signature-devis-en-ligne-artisan' },
                  { l: 'Relances clients', to: '/relance-facture-impayee-artisan' },
                  { l: 'Catalogue intelligent', to: '#catalogue' },
                  { l: 'Factur-X', to: '#features' },
                  { l: 'Tarifs', to: '#pricing' },
                ],
              },
              {
                t: 'Guides artisans',
                links: [
                  { l: 'Logiciel devis facture artisan', to: '/logiciel-devis-facture-artisan' },
                  { l: 'Signature devis en ligne', to: '/signature-devis-en-ligne-artisan' },
                  { l: 'Relance facture impayée', to: '/relance-facture-impayee-artisan' },
                  { l: 'Facture auto-entrepreneur bâtiment', to: '/logiciel-facture-auto-entrepreneur-batiment' },
                ],
              },
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
                t: 'Comparatifs',
                links: [
                  { l: 'Alternative Excel', to: '/alternative-excel-devis-artisan' },
                  { l: 'Alternative Khosmos', to: '/alternative-khosmos' },
                  { l: 'Alternative Abby', to: '/alternative-abby' },
                  { l: 'Alternative Obat', to: '/alternative-obat' },
                  { l: 'Contact', to: '/contact' },
                ],
              },
            ].map(({ t, links }) => (
              <div key={t}>
                <div className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-3">{t}</div>
                {links.map(l => (
                  <a key={l.l} href={l.to} className="block text-xs text-white/40 mb-2 hover:text-white/70 transition-colors">
                    {l.l}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row gap-2 items-center justify-between text-[11px] text-white/25">
            <span>© 2026 Photofacto. Tous droits réservés.</span>
            <span>Factur-X exportable · Connexion plateforme agréée en préparation.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
