import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Camera,
  Check,
  ClipboardList,
  FileText,
  Link as LinkIcon,
  MessageCircle,
  PenLine,
  Receipt,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { MiniDevisDemo } from '../components/MiniDevisDemo';

export type PublicSeoVariant =
  | 'generateur-devis-artisan'
  | 'signature-devis-en-ligne-artisan'
  | 'relance-facture-impayee-artisan'
  | 'logiciel-devis-facture-artisan'
  | 'logiciel-devis-facture-btp'
  | 'logiciel-facture-auto-entrepreneur-batiment'
  | 'alternative-excel-devis-artisan'
  | 'alternative-khosmos'
  | 'alternative-abby'
  | 'alternative-obat';

interface SeoPageData {
  title: string;
  description: string;
  eyebrow: string;
  h1: ReactNode;
  intro: string;
  bullets: string[];
  sections: Array<{ title: string; text: string; icon: ReactNode }>;
  comparison: { beforeTitle: string; before: string[]; afterTitle: string; after: string[] };
  faq: Array<{ q: string; a: string }>;
}

const pageData: Record<PublicSeoVariant, SeoPageData> = {
  'generateur-devis-artisan': {
    title: 'Générateur de devis artisan avec IA et catalogue intelligent | Photofacto',
    description:
      'Générez un brouillon de devis artisan depuis une photo, une dictée ou une description, réutilisez votre catalogue, puis faites signer et facturez.',
    eyebrow: 'Générateur de devis artisan',
    h1: <>Préparez un devis depuis une photo, une dictée ou quelques mots.</>,
    intro:
      'Photofacto aide les artisans à passer de la note terrain au devis prêt à corriger, tout en structurant leurs prix et prestations au fil des chantiers.',
    bullets: ['Photo ou dictée', 'Catalogue intelligent', 'Devis modifiable', 'Lien de signature'],
    sections: [
      { title: 'Brouillon IA', text: 'L’IA prépare une proposition à partir de votre description. Vous gardez la validation finale.', icon: <Sparkles className="w-5 h-5" /> },
      { title: 'Catalogue intelligent', text: 'Transformez Excel, anciens devis, carnet ou notes en prestations propres et réutilisables.', icon: <ClipboardList className="w-5 h-5" /> },
      { title: 'Devis prêt à envoyer', text: 'Corrigez les lignes, ajoutez vos mentions, puis envoyez au client.', icon: <FileText className="w-5 h-5" /> },
    ],
    comparison: {
      beforeTitle: 'Sans Photofacto',
      before: ['Notes dispersées', 'Prix dans Excel ou carnet', 'Devis refait le soir'],
      afterTitle: 'Avec Photofacto',
      after: ['Photo + description', 'Catalogue structuré', 'Prix catalogue réutilisés'],
    },
    faq: [
      { q: 'Est-ce que le devis est automatique ?', a: 'Non. Photofacto prépare un brouillon que vous vérifiez et modifiez avant envoi.' },
      { q: 'Puis-je utiliser mes prix ?', a: 'Oui. Le catalogue intelligent permet de réutiliser vos prestations, forfaits, déplacements, main-d’œuvre et prix habituels.' },
    ],
  },
  'signature-devis-en-ligne-artisan': {
    title: 'Signature devis en ligne artisan sur téléphone | Photofacto',
    description:
      'Envoyez un lien de signature au client par email ou WhatsApp. Le client signe le devis sur téléphone et la signature revient dans Photofacto.',
    eyebrow: 'Signature devis en ligne',
    h1: <>Le client signe votre devis directement sur son téléphone.</>,
    intro:
      'Plus besoin d’imprimer, scanner ou attendre que le client retrouve le PDF. Vous envoyez un lien, il consulte et signe.',
    bullets: ['Lien partageable', 'Signature mobile', 'Devis marqué signé', 'PDF avec signature'],
    sections: [
      { title: 'Lien simple', text: 'Envoyez le devis par email ou WhatsApp, selon l’habitude de votre client.', icon: <LinkIcon className="w-5 h-5" /> },
      { title: 'Signature sur téléphone', text: 'Le client signe depuis une page claire, pensée pour mobile.', icon: <Smartphone className="w-5 h-5" /> },
      { title: 'Suite plus rapide', text: 'Une fois accepté, le devis peut être transformé en facture plus vite.', icon: <Receipt className="w-5 h-5" /> },
    ],
    comparison: {
      beforeTitle: 'Avant',
      before: ['PDF oublié', 'Signature papier', 'Relance manuelle'],
      afterTitle: 'Après',
      after: ['Lien envoyé', 'Signature mobile', 'Devis suivi'],
    },
    faq: [
      { q: 'Le client doit-il créer un compte ?', a: 'Non. Il reçoit un lien et signe le devis depuis son téléphone.' },
      { q: 'Puis-je envoyer le lien par WhatsApp ?', a: 'Oui. Le lien peut être partagé par WhatsApp ou email.' },
    ],
  },
  'relance-facture-impayee-artisan': {
    title: 'Relance facture impayée artisan simple et visible | Photofacto',
    description:
      'Suivez les factures en retard, voyez le montant à récupérer et relancez vos clients sans repartir de zéro.',
    eyebrow: 'Relance facture impayée',
    h1: <>Voyez tout de suite qui vous doit encore de l’argent.</>,
    intro:
      'Photofacto rend les retards de paiement visibles pour éviter les oublis et protéger votre trésorerie.',
    bullets: ['Factures en retard', 'Montant à récupérer', 'Historique relance', 'Email ou message copiable'],
    sections: [
      { title: 'Retards visibles', text: 'Les factures envoyées et non payées ressortent clairement.', icon: <Bell className="w-5 h-5" /> },
      { title: 'Montant à récupérer', text: 'Le tableau de bord donne une vision simple de l’argent encore dehors.', icon: <Wallet className="w-5 h-5" /> },
      { title: 'Relance plus rapide', text: 'Préparez un message clair sans retrouver toutes les infos à la main.', icon: <MessageCircle className="w-5 h-5" /> },
    ],
    comparison: {
      beforeTitle: 'Sans suivi',
      before: ['Facture oubliée', 'Client non relancé', 'Trésorerie floue'],
      afterTitle: 'Avec Photofacto',
      after: ['Retard visible', 'Dernière relance connue', 'Action simple'],
    },
    faq: [
      { q: 'Photofacto relance-t-il automatiquement ?', a: 'Photofacto vous aide surtout à voir et lancer les relances simplement. Les actions restent sous votre contrôle.' },
      { q: 'Est-ce utile pour un artisan solo ?', a: 'Oui. C’est justement utile quand vous n’avez pas quelqu’un pour suivre les paiements à votre place.' },
    ],
  },
  'logiciel-devis-facture-artisan': {
    title: 'Logiciel devis facture artisan avec catalogue intelligent | Photofacto',
    description:
      'Un seul outil pour créer devis et factures, structurer votre catalogue, gérer clients, faire signer en ligne et suivre les paiements.',
    eyebrow: 'Logiciel devis facture artisan',
    h1: <>Vos devis, factures, clients et relances au même endroit.</>,
    intro:
      'Photofacto simplifie le tunnel commercial complet des artisans, depuis le chantier jusqu’au paiement, avec un catalogue qui se construit au fil de vos documents.',
    bullets: ['Devis IA', 'Catalogue intelligent', 'Signature en ligne', 'Suivi paiement'],
    sections: [
      { title: 'Devis plus rapides', text: 'Photo, dictée ou description : partez d’un brouillon et corrigez.', icon: <Camera className="w-5 h-5" /> },
      { title: 'Catalogue structuré', text: 'Importez vos prix existants et réutilisez vos prestations sans tout retaper.', icon: <ClipboardList className="w-5 h-5" /> },
      { title: 'Tout centralisé', text: 'Clients, prestations, devis, factures, signatures et relances restent dans le même outil.', icon: <Users className="w-5 h-5" /> },
    ],
    comparison: {
      beforeTitle: 'Outils séparés',
      before: ['Excel', 'Word', 'WhatsApp', 'Prix dispersés'],
      afterTitle: 'Photofacto',
      after: ['Catalogue', 'Devis', 'Signature', 'Relance'],
    },
    faq: [
      { q: 'Photofacto est-il fait pour tous les artisans ?', a: 'Oui, surtout les artisans solo et petites entreprises qui veulent aller vite sans logiciel compliqué.' },
      { q: 'Puis-je utiliser Photofacto sur mobile ?', a: 'Oui. L’expérience est pensée pour être utile depuis le terrain.' },
    ],
  },
  'logiciel-devis-facture-btp': {
    title: 'Logiciel devis facture BTP pour artisans français | Photofacto',
    description:
      'Créez devis et factures BTP, ajoutez photo ou dictée, faites signer en ligne et préparez des exports Factur-X.',
    eyebrow: 'Logiciel devis facture BTP',
    h1: <>Un logiciel BTP pour créer, signer, facturer et relancer.</>,
    intro:
      'Photofacto garde les usages terrain au centre : photo chantier, catalogue intelligent, PDF propre, signature client et suivi des paiements.',
    bullets: ['Chantiers BTP', 'Catalogue intelligent', 'Factur-X exportable', 'Marchés publics en secondaire'],
    sections: [
      { title: 'Terrain d’abord', text: 'Le point de départ peut être une photo, une dictée ou une note rapide.', icon: <Camera className="w-5 h-5" /> },
      { title: 'Prix réutilisables', text: 'Vos prestations BTP, forfaits, unités et tarifs deviennent un catalogue propre.', icon: <ClipboardList className="w-5 h-5" /> },
      { title: 'Marchés publics', text: 'Photofacto prépare les informations utiles pour vos démarches Chorus Pro.', icon: <FileText className="w-5 h-5" /> },
    ],
    comparison: {
      beforeTitle: 'BTP à l’ancienne',
      before: ['Photos dans le téléphone', 'Prix dans plusieurs fichiers', 'Relances oubliées'],
      afterTitle: 'BTP avec Photofacto',
      after: ['Photo exploitée', 'Catalogue réutilisé', 'Facture suivie'],
    },
    faq: [
      { q: 'Chorus Pro est-il la promesse principale ?', a: 'Non. Photofacto sert d’abord à gérer le tunnel devis, signature, facture et paiement. Chorus reste un cas d’usage marchés publics.' },
      { q: 'Est-ce compatible Factur-X ?', a: 'Photofacto prévoit l’export Factur-X pour préparer des documents structurés.' },
    ],
  },
  'logiciel-facture-auto-entrepreneur-batiment': {
    title: 'Logiciel facture auto-entrepreneur bâtiment simple | Photofacto',
    description:
      'Un logiciel simple pour auto-entrepreneurs du bâtiment : devis, factures, clients, signature en ligne, PDF et suivi des retards.',
    eyebrow: 'Auto-entrepreneur bâtiment',
    h1: <>Facturez plus proprement sans passer vos soirées sur l’administratif.</>,
    intro:
      'Photofacto aide les artisans solo à créer vite, garder leurs prix propres, envoyer clairement et suivre les paiements sans outil lourd.',
    bullets: ['Simple sur téléphone', 'Catalogue de prix', 'PDF propre', 'Relances visibles'],
    sections: [
      { title: 'Pas de logiciel compliqué', text: 'L’interface reste directe : client, lignes, prix, envoi.', icon: <Smartphone className="w-5 h-5" /> },
      { title: 'Prix réutilisables', text: 'Gardez vos prestations, déplacements et forfaits pour ne plus repartir de zéro.', icon: <ClipboardList className="w-5 h-5" /> },
      { title: 'Franchise TVA', text: 'Vous gardez vos paramètres et mentions à vérifier selon votre situation.', icon: <ShieldCheck className="w-5 h-5" /> },
    ],
    comparison: {
      beforeTitle: 'Solo débordé',
      before: ['Notes papier', 'Prix retapés', 'Paiements non suivis'],
      afterTitle: 'Solo organisé',
      after: ['Catalogue propre', 'Devis signé', 'Facture relancée'],
    },
    faq: [
      { q: 'Est-ce adapté à la micro-entreprise ?', a: 'Oui. Photofacto est pensé pour les artisans solo, auto-entrepreneurs et petites structures.' },
      { q: 'Puis-je commencer gratuitement ?', a: 'Oui. Le plan gratuit permet de tester avec quelques documents et usages IA.' },
    ],
  },
  'alternative-excel-devis-artisan': {
    title: 'Alternative Excel pour devis artisan avec catalogue intelligent | Photofacto',
    description:
      'Remplacez les devis Excel par un outil artisan avec catalogue intelligent, clients, signature en ligne, PDF et relances.',
    eyebrow: 'Alternative Excel devis artisan',
    h1: <>Arrêtez de refaire vos devis dans Excel à chaque chantier.</>,
    intro:
      'Excel dépanne au début, mais il ne structure pas votre catalogue, ne suit pas les signatures, les factures, les relances et les clients.',
    bullets: ['Import Excel', 'Catalogue intelligent', 'Signature client', 'Paiements suivis'],
    sections: [
      { title: 'Moins de retape', text: 'Vos prestations, unités, forfaits et clients reviennent d’un document à l’autre.', icon: <ClipboardList className="w-5 h-5" /> },
      { title: 'Moins d’oublis', text: 'Les statuts et relances ne dépendent plus d’un fichier perdu.', icon: <Bell className="w-5 h-5" /> },
      { title: 'Plus professionnel', text: 'Envoyez un lien de signature et un PDF propre.', icon: <FileText className="w-5 h-5" /> },
    ],
    comparison: {
      beforeTitle: 'Excel',
      before: ['Fichier copié', 'Erreurs de cellules', 'Aucune signature', 'Relance manuelle'],
      afterTitle: 'Photofacto',
      after: ['Catalogue intelligent', 'Devis modifiable', 'Signature mobile', 'Relance suivie'],
    },
    faq: [
      { q: 'Pourquoi quitter Excel ?', a: 'Pour gagner du temps sur les clients, les prix réutilisables, les signatures et les relances, sans garder votre activité commerciale dans plusieurs fichiers.' },
      { q: 'Puis-je garder mes habitudes ?', a: 'Oui. Vous pouvez continuer à décrire vos prestations simplement, Photofacto structure ensuite le document.' },
    ],
  },
  'alternative-khosmos': {
    title: 'Alternative Khosmos pour devis et factures artisans | Photofacto',
    description:
      'Photofacto est une alternative simple pour artisans : devis IA, signature mobile, factures PDF, clients, catalogue et relances.',
    eyebrow: 'Alternative Khosmos',
    h1: <>Une alternative simple pour gérer devis, factures, signatures et relances.</>,
    intro:
      'Khosmos est orienté devis/factures pour artisans. Photofacto se différencie par son workflow complet autour de l’IA, du catalogue intelligent, de la signature en ligne et des relances.',
    bullets: ['IA terrain', 'Catalogue intelligent', 'Signature mobile', 'Relances visibles'],
    sections: [
      { title: 'Démarrage terrain', text: 'Photo ou dictée avant de quitter le chantier.', icon: <Camera className="w-5 h-5" /> },
      { title: 'Catalogue vivant', text: 'Vos anciennes lignes de devis deviennent des prestations réutilisables.', icon: <ClipboardList className="w-5 h-5" /> },
      { title: 'Suivi simple', text: 'Devis, factures, clients et paiements restent visibles.', icon: <Search className="w-5 h-5" /> },
    ],
    comparison: {
      beforeTitle: 'Approche devis/facture',
      before: ['Document central', 'Catalogue à structurer', 'Suivi séparé'],
      afterTitle: 'Photofacto',
      after: ['Photo + description', 'Catalogue réutilisé', 'Facture suivie'],
    },
    faq: [
      { q: 'Photofacto est-il une copie de Khosmos ?', a: 'Non. Photofacto se positionne sur un flow plus terrain : IA, signature mobile, facture et relances.' },
      { q: 'Puis-je tester avant de changer ?', a: 'Oui. Vous pouvez commencer gratuitement et créer un premier document.' },
    ],
  },
  'alternative-abby': {
    title: 'Alternative Abby pour artisans : catalogue, devis IA, signature | Photofacto',
    description:
      'Photofacto est une alternative à Abby pensée pour les artisans du terrain : devis avec IA, signature mobile, factures PDF, relances et catalogue.',
    eyebrow: 'Alternative Abby',
    h1: <>Une alternative à Abby pensée d’abord pour les artisans.</>,
    intro:
      'Abby couvre beaucoup de profils indépendants. Photofacto se concentre davantage sur les usages terrain des artisans : catalogue, devis, signature mobile, facture et relance.',
    bullets: ['Devis IA terrain', 'Catalogue intelligent', 'Signature mobile', 'Relances visibles'],
    sections: [
      { title: 'Pensé pour le chantier', text: 'On part d’une photo ou d’une dictée, pas d’un formulaire générique de freelance.', icon: <Camera className="w-5 h-5" /> },
      { title: 'Signature mobile sans compte', text: 'Votre client signe le devis depuis son téléphone, sans créer de compte client.', icon: <PenLine className="w-5 h-5" /> },
      { title: 'Catalogue intelligent artisan', text: 'Réutilisez vos prestations habituelles, main-d’œuvre, forfaits, déplacements et anciens devis.', icon: <ClipboardList className="w-5 h-5" /> },
    ],
    comparison: {
      beforeTitle: 'Abby (positionnement large)',
      before: ['Indépendants variés', 'Usage chantier moins central', 'Signature parmi d’autres besoins', 'Vocabulaire plus généraliste'],
      afterTitle: 'Photofacto (artisans)',
      after: ['Devis depuis photo', 'Catalogue chantier', 'Signature mobile', 'Relances suivies'],
    },
    faq: [
      { q: 'Pourquoi quitter Abby pour Photofacto ?', a: 'Pour un outil construit autour des usages artisans : photo terrain, devis IA, signature client mobile et relances.' },
      { q: 'Puis-je migrer mes clients facilement ?', a: 'Oui. Vous pouvez recréer rapidement vos clients et votre catalogue à partir de vos habitudes existantes, puis continuer en parallèle le temps de la transition.' },
    ],
  },
  'alternative-obat': {
    title: 'Alternative Obat pour artisans : devis IA, signature, relances | Photofacto',
    description:
      'Photofacto est une alternative orientée terrain pour les artisans solo : devis IA, signature mobile, factures PDF, relances et suivi des impayés.',
    eyebrow: 'Alternative Obat',
    h1: <>Une alternative à Obat orientée terrain et téléphone.</>,
    intro:
      'Obat est une solution complète, adaptée à des besoins plus structurés. Photofacto privilégie une approche plus légère, pensée pour les artisans qui veulent créer, faire signer, facturer et relancer rapidement depuis leur téléphone.',
    bullets: ['Démarrage rapide', 'Catalogue intelligent', 'Signature mobile', 'Relances suivies'],
    sections: [
      { title: 'Léger sur le terrain', text: 'Pas de longue mise en route : un client, un devis, un envoi.', icon: <Smartphone className="w-5 h-5" /> },
      { title: 'Catalogue direct', text: 'Gardez vos prix, forfaits et prestations propres sans longue mise en place.', icon: <ClipboardList className="w-5 h-5" /> },
      { title: 'Suivi des impayés', text: 'Voyez clairement les factures en retard et préparez vos relances.', icon: <Bell className="w-5 h-5" /> },
    ],
    comparison: {
      beforeTitle: 'Obat (solution complète)',
      before: ['Besoins structurés', 'Mise en route plus progressive', 'Couverture large'],
      afterTitle: 'Photofacto (simple)',
      after: ['Catalogue → devis → relance', 'Démarrage rapide', 'Pensé téléphone et chantier'],
    },
    faq: [
      { q: 'Photofacto est-il aussi complet qu’Obat ?', a: 'Non, Photofacto reste volontairement plus simple. L’objectif est d’aller vite sur le tunnel devis-signature-facture-relance, pas de remplacer un ERP métier.' },
      { q: 'Pour quel profil c’est plus adapté ?', a: 'Photofacto convient surtout aux artisans solo, auto-entrepreneurs et petites équipes qui veulent un outil rapide depuis le téléphone.' },
    ],
  },
};

export default function PublicSeoPage({ variant }: { variant: PublicSeoVariant }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const page = pageData[variant];

  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  useEffect(() => {
    document.title = page.title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', page.description);
  }, [page]);

  const goRegister = () => navigate('/inscription?mode=register');

  return (
    <div className="min-h-screen bg-background font-body text-on-surface">
      <div className="accent-bar-spark" />
      <nav className="flex items-center justify-between gap-2 px-3.5 md:px-14 py-2.5 md:py-4 bg-white border-b-spark">
        <a href="/" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-primary/5 flex items-center justify-center overflow-hidden shrink-0">
            <img src="/icons/icon-192.png" alt="Logo Photofacto" className="w-full h-full object-contain" />
          </div>
          <span className="wordmark-photofacto text-[17px] md:text-xl min-w-0">
            <span className="wm-photo">PHOTO</span><span className="wm-facto">FACTO</span>
          </span>
        </a>
        <button
          onClick={goRegister}
          className="inline-flex min-touch items-center gap-1.5 bg-primary text-white px-3.5 sm:px-5 py-2 rounded-[10px] text-xs sm:text-[13px] font-bold shadow-spark-cta hover:-translate-y-0.5 hover:shadow-spark-cta-lg active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
        >
          Créer mon premier devis
        </button>
      </nav>

      <main>
        <section className="relative overflow-hidden px-4 md:px-14 py-10 md:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(232,98,26,0.13),transparent_30%),radial-gradient(circle_at_90%_20%,rgba(46,52,64,0.08),transparent_28%)]" />
          <div className="relative max-w-[1120px] mx-auto grid lg:grid-cols-[1fr_380px] gap-8 md:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/[0.07] border border-primary/[0.18] rounded-full px-3 py-1.5 mb-5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] md:text-xs font-semibold text-primary-dim">{page.eyebrow}</span>
              </div>
              <h1 className="font-headline font-extrabold text-[34px] sm:text-[52px] lg:text-[62px] leading-[1.04] text-secondary-dim mb-5">
                {page.h1}
              </h1>
              <p className="text-[15px] md:text-[17px] text-on-surface-variant leading-[1.65] max-w-[620px] mb-7">
                {page.intro}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={goRegister}
                  className="btn-glow min-touch inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3.5 rounded-xl font-bold text-sm shadow-spark-cta-lg hover:-translate-y-0.5 hover:shadow-spark-cta-xl active:scale-[0.98] transition-all cursor-pointer"
                >
                  Créer mon premier devis
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="/"
                  className="min-touch inline-flex items-center justify-center gap-2 bg-white border-spark text-on-surface px-6 py-3.5 rounded-xl font-bold text-sm shadow-spark-sm hover:-translate-y-0.5 hover:shadow-spark-md active:scale-[0.98] transition-all cursor-pointer"
                >
                  Voir Photofacto
                </a>
              </div>
            </div>

            <div className="bg-white rounded-[24px] border-spark shadow-spark-lg p-5">
              <div className="font-headline font-bold text-xl text-secondary-dim mb-4">Ce que vous gagnez</div>
              <div className="grid gap-3">
                {page.bullets.map(item => (
                  <div key={item} className="flex items-center gap-3 bg-background rounded-xl px-3 py-3">
                    <Check className="w-4 h-4 text-primary shrink-0" strokeWidth={3} />
                    <span className="text-sm font-semibold text-on-surface">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {variant === 'generateur-devis-artisan' && (
          <section className="px-4 md:px-14 py-10 md:py-14 bg-background">
            <div className="max-w-[960px] mx-auto bg-white rounded-[24px] border-spark shadow-spark-lg p-5 md:p-8">
              <MiniDevisDemo
                examplePlaceholder="Ex : pose carrelage salle de bain 8m² + ragréage + plinthes"
                helper="Tapez ou dictez votre prestation comme à un collègue."
              />
            </div>
          </section>
        )}

        <section className="px-4 md:px-14 py-10 md:py-16 bg-white border-y-spark">
          <div className="max-w-[1120px] mx-auto grid md:grid-cols-3 gap-4">
            {page.sections.map(section => (
              <div key={section.title} className="bg-background rounded-2xl border-spark p-5 shadow-spark-sm hover:-translate-y-1 hover:shadow-spark-md hover:border-primary/30 transition-all duration-200 ease-out">
                <div className="w-10 h-10 bg-primary/[0.08] text-primary rounded-xl flex items-center justify-center mb-3">
                  {section.icon}
                </div>
                <h2 className="font-headline font-bold text-lg text-secondary-dim mb-2">{section.title}</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed">{section.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-4 md:px-14 py-10 md:py-16 bg-background">
          <div className="max-w-[980px] mx-auto grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-[22px] border-spark p-5 shadow-spark-md">
              <h2 className="font-headline font-bold text-xl text-secondary-dim mb-4">{page.comparison.beforeTitle}</h2>
              {page.comparison.before.map(item => (
                <div key={item} className="flex items-center gap-2 py-2 text-sm text-on-surface-variant">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  {item}
                </div>
              ))}
            </div>
            <div className="bg-secondary-dim rounded-[22px] p-5 shadow-spark-lg text-white">
              <h2 className="font-headline font-bold text-xl mb-4">{page.comparison.afterTitle}</h2>
              {page.comparison.after.map(item => (
                <div key={item} className="flex items-center gap-2 py-2 text-sm text-white/75">
                  <Check className="w-4 h-4 text-primary" strokeWidth={3} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 md:px-14 py-10 md:py-16 bg-white border-y-spark">
          <div className="max-w-[920px] mx-auto">
            <h2 className="font-headline font-extrabold text-3xl md:text-[40px] text-secondary-dim text-center mb-8">
              Questions fréquentes
            </h2>
            <div className="grid gap-3">
              {page.faq.map(({ q, a }) => (
                <div key={q} className="bg-background rounded-2xl border-spark p-5">
                  <h3 className="font-headline font-bold text-secondary-dim mb-2">{q}</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-secondary-dim py-8 md:py-14 px-4 md:px-6 text-center">
          <h2 className="font-headline font-extrabold text-[28px] md:text-[40px] text-white mb-2.5 leading-tight">
            Commencez par un vrai devis.
          </h2>
          <p className="text-sm md:text-[15px] text-white/55 mb-6 md:mb-8">
            Photo, catalogue, signature, facture et relance : testez le tunnel complet sans vous compliquer la vie.
          </p>
          <button
            onClick={goRegister}
            className="min-touch inline-flex items-center justify-center gap-2 bg-primary text-white px-5 sm:px-9 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-[13px] sm:text-base shadow-spark-cta-lg hover:-translate-y-0.5 hover:shadow-spark-cta-xl active:scale-[0.98] transition-all cursor-pointer w-full sm:w-auto"
          >
            Créer mon compte gratuitement
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </main>

      <footer className="bg-secondary-dim border-t border-white/10 px-4 md:px-14 py-6 text-center text-[11px] text-white/25">
        © 2026 Photofacto · Devis, factures, signature en ligne et relances pour artisans.
      </footer>
    </div>
  );
}
