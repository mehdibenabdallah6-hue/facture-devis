import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
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
          'Facturation simplifiée pour électriciens. Photo, dictée ou description rapide : préparez une proposition modifiable. Conforme réforme 2026.',
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
        'Photofacto — Photo + description = facture à valider | Facturation IA pour artisans',
        "Photofacto : ajoutez une photo, décrivez le chantier en quelques mots, l'IA prépare une proposition de facture modifiable. Essai gratuit 14 jours.",
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
      Photo + description
      <br />
      rapide
      <br />
      <span className="text-primary">facture à valider.</span>
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
              + de 500 artisans · Conforme Factur-X 2026
            </span>
          </div>
          <h1 className="font-headline font-extrabold text-[33px] sm:text-[52px] lg:text-[62px] leading-[1.04] text-secondary-dim mb-4 md:mb-5">
            {heroTitle}
          </h1>
          <p className="text-[15px] md:text-[17px] text-on-surface-variant leading-[1.55] md:leading-[1.7] max-w-[480px] mb-5 md:mb-8">
            Artisans — dictez votre prestation depuis le chantier. L'IA Gemini génère une{' '}
            <strong className="text-on-surface">facture conforme</strong> instantanément. Fini
            l'Excel et le papier.
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
              {['Sans carte bancaire', 'Annulation facile', 'Mentions FR & Factur-X'].map(t => (
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
            ['500+', 'artisans actifs'],
            ['10s', 'par facture'],
            ['2h', 'gagnées / semaine'],
            ['4.9/5', 'note moyenne'],
            ['Factur-X', 'PDF/A-3 + CII'],
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
              La facturation sans effort
            </h2>
            <p className="text-[15px] text-on-surface-variant max-w-md mx-auto">
              Photo + description rapide : l'IA prépare une proposition, vous vérifiez et validez.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                n: '01',
                icon: <Mic className="w-[22px] h-[22px] text-primary" />,
                t: 'Photo + description',
                d: "Ajoutez une photo du chantier, puis décrivez ou dictez la prestation en quelques mots.",
              },
              {
                n: '02',
                icon: <Zap className="w-[22px] h-[22px] text-primary fill-primary" />,
                t: "L'IA prépare un brouillon",
                d: "Elle s'appuie d'abord sur votre description et vos tarifs catalogue quand ils existent.",
              },
              {
                n: '03',
                icon: <Check className="w-[22px] h-[22px] text-primary" strokeWidth={3} />,
                t: 'Validez et envoyez',
                d: 'PDF professionnel, conforme Factur-X 2026, envoyé en un clic depuis votre téléphone.',
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
            Tout ce qu'il vous faut
          </h2>
          <p className="text-[15px] text-on-surface-variant text-center mb-8 md:mb-10">
            Un outil complet, pensé par et pour les artisans.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              {
                icon: <FileText className="w-[18px] h-[18px] text-primary" />,
                t: 'Factures & Devis',
                d: 'Créez factures, devis, acomptes et avoirs conformes en quelques secondes.',
              },
              {
                icon: <Users className="w-[18px] h-[18px] text-primary" />,
                t: 'Fichier clients',
                d: 'Gérez votre carnet B2B et B2C avec SIREN, TVA intra et historique.',
              },
              {
                icon: <ShieldCheck className="w-[18px] h-[18px] text-primary" />,
                t: 'Conforme 2026',
                d: 'Toutes les mentions légales obligatoires, vérifiées automatiquement.',
              },
              {
                icon: <Send className="w-[18px] h-[18px] text-primary" />,
                t: 'Envoi par email',
                d: "Envoyez vos PDF directement depuis l'app, avec signature électronique.",
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
      <section id="testimonials" className="py-10 md:py-12 px-4 md:px-14 bg-white border-y-spark">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-headline font-extrabold text-3xl md:text-4xl text-secondary-dim text-center mb-8">
            Ils nous font confiance
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                name: 'Karim B.',
                job: 'Carreleur · Paris',
                q: 'Avant je passais 1h à faire mes factures le soir. Maintenant je dicte en 10 secondes depuis la camionnette.',
              },
              {
                name: 'Sophie L.',
                job: 'Électricienne · Lyon',
                q: "Je prends en photo mon devis papier et tout est pré-rempli. Un gain de temps énorme, je recommande.",
              },
              {
                name: 'Marc D.',
                job: 'Plombier · Marseille',
                q: "Enfin un outil qui comprend notre métier. Les suggestions de prestations sont hyper pratiques.",
              },
            ].map(({ name, job, q }) => (
              <div key={name} className="border-spark rounded-2xl p-5 shadow-spark-sm">
                <div className="flex gap-0.5 mb-2.5">
                  {[0, 1, 2, 3, 4].map(i => (
                    <Star key={i} className="w-3.5 h-3.5 text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-[13px] text-on-surface-variant leading-relaxed mb-4 italic">
                  "{q}"
                </p>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-on-surface">{name}</div>
                    <div className="text-[10px] text-on-surface-variant">{job}</div>
                  </div>
                </div>
              </div>
            ))}
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
                  'Conformité Factur-X 2026',
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
                  'Conformité Factur-X 2026',
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
                  'Export FEC & Chorus Pro',
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
          Prêt à gagner 2h par semaine ?
        </h2>
        <p className="text-sm md:text-[15px] text-white/50 mb-6 md:mb-8">
          Rejoignez 500+ artisans qui ont simplifié leur facturation.
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
                Photo + description rapide = facture prête à valider. L'IA au service des artisans.
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
