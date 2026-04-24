import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function MentionsLegales() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Mentions Légales — Photofacto";
  }, []);

  return (
    <div className="min-h-screen bg-surface font-body">
      <nav className="flex items-center gap-4 p-5 md:px-12 max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-surface-container-high transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface" />
        </button>
        <h1 className="font-headline font-extrabold text-xl text-on-surface">Mentions Légales</h1>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pb-20 prose prose-slate">
        <section className="bg-surface-container-lowest rounded-3xl p-8 md:p-12 shadow-sm border border-outline-variant/10 space-y-8">

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">1. Éditeur du site</h2>
            <p className="text-on-surface-variant leading-relaxed">
              L'application <strong>Photofacto</strong> et le site <a href="https://photofacto.fr" className="text-primary hover:underline">photofacto.fr</a> sont édités par l'entreprise Photofacto.<br />
              Email : <a href="mailto:contact@photofacto.fr" className="text-primary hover:underline">contact@photofacto.fr</a><br />
              Directeur de la publication : Équipe Photofacto
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">2. Hébergement</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Le site est hébergé par :<br />
              <strong>Vercel Inc.</strong><br />
              440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
              Site web : <a href="https://vercel.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">vercel.com</a>
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Les données sont stockées sur l'infrastructure <strong>Google Cloud Platform</strong> (Firebase Firestore), dans des datacenters situés en Europe.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">3. Protection des données (RGPD)</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679), vous disposez des droits suivants :
            </p>
            <ul className="text-on-surface-variant leading-relaxed mt-3 space-y-2">
              <li><strong>Droit d'accès :</strong> obtenir la confirmation que vos données sont traitées et accéder à ces données</li>
              <li><strong>Droit de rectification :</strong> corriger des données inexactes ou incomplètes</li>
              <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données personnelles</li>
              <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré et lisible (export JSON/CSV disponible dans l'application)</li>
              <li><strong>Droit à la limitation :</strong> demander la limitation du traitement de vos données</li>
              <li><strong>Droit d'opposition :</strong> vous opposer au traitement de vos données</li>
            </ul>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              <strong>Données collectées :</strong> nom, adresse email (via Google Sign-In), données de facturation saisies par l'utilisateur (clients, prestations, montants), photo de profil Google.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              <strong>Finalités :</strong> fourniture du service de facturation, amélioration de l'expérience utilisateur, gestion de l'abonnement.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              <strong>Durée de conservation :</strong> les données sont conservées tant que le compte est actif. Après résiliation, elles sont supprimées sous 30 jours, sauf obligation légale de conservation (3 ans pour les données comptables).
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              <strong>Sous-traitants :</strong> Firebase/Google Cloud (hébergement et base de données), Paddle (paiements), Resend (emails transactionnels), Google Gemini (traitement IA des documents).
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Pour exercer vos droits : <a href="mailto:contact@photofacto.fr" className="text-primary hover:underline">contact@photofacto.fr</a>
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              <strong>Droit de recours :</strong> si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la <a href="https://www.cnil.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">CNIL</a> (Commission Nationale de l'Informatique et des Libertés).
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">4. Cookies</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Ce site utilise uniquement des cookies <strong>strictement nécessaires</strong> au fonctionnement du service :
            </p>
            <ul className="text-on-surface-variant leading-relaxed mt-3 space-y-2">
              <li><strong>Authentification Firebase :</strong> cookies de session pour maintenir la connexion Google</li>
              <li><strong>Local Storage :</strong> mémorisation de l'état du tutoriel d'onboarding par utilisateur</li>
              <li><strong>IndexedDB :</strong> persistance locale des données en mode hors-ligne (fonctionnalité PWA)</li>
            </ul>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Aucun cookie de tracking publicitaire, d'analyse d'audience ou de réseaux sociaux n'est déposé sur votre appareil.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">5. Propriété intellectuelle</h2>
            <p className="text-on-surface-variant leading-relaxed">
              L'ensemble du contenu de ce site et de l'application Photofacto (textes, graphismes, logo, icônes, images, logiciels, base de données, architecture, design) est la propriété exclusive de l'éditeur. Toute reproduction, représentation, modification ou adaptation, même partielle, par quelque procédé que ce soit, est interdite sans autorisation écrite préalable.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Toute contrefaçon est passible des sanctions prévues aux articles L.335-2 et suivants du Code de la propriété intellectuelle.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">6. Limitation de responsabilité</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Photofacto fournit un <strong>outil d'aide à la facturation</strong> assisté par intelligence artificielle. <strong>L'utilisateur reste seul responsable</strong> de l'exactitude des informations saisies ou validées dans ses factures et de la conformité de ses documents avec la législation en vigueur.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Photofacto ne se substitue en aucun cas à un expert-comptable ou à un conseiller juridique. L'utilisateur est invité à vérifier la conformité de ses documents auprès d'un professionnel qualifié.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
