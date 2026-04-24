import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Politique de Confidentialité — Photofacto";
  }, []);

  return (
    <div className="min-h-screen bg-surface font-body">
      <nav className="flex items-center gap-4 p-5 md:px-12 max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-surface-container-high transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface" />
        </button>
        <h1 className="font-headline font-extrabold text-xl text-on-surface">Politique de Confidentialité</h1>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pb-20 prose prose-slate">
        <section className="bg-surface-container-lowest rounded-3xl p-8 md:p-12 shadow-sm border border-outline-variant/10 space-y-8">

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">1. Introduction</h2>
            <p className="text-on-surface-variant leading-relaxed">
              <strong>Photofacto</strong> (ci-après « nous » ou « le Service ») s'engage à protéger la vie privée de ses utilisateurs. La présente Politique de Confidentialité décrit la manière dont nous collectons, utilisons, stockons et partageons vos données personnelles, conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679) et à la loi Informatique et Libertés modifiée.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              <strong>Responsable du traitement :</strong> Photofacto (En cours d'immatriculation). Contact : <a href="mailto:contact@photofacto.fr" className="text-primary hover:underline">contact@photofacto.fr</a>
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">2. Données Collectées</h2>
            <p className="text-on-surface-variant leading-relaxed mb-3">Nous collectons les catégories de données suivantes :</p>

            <div className="space-y-3">
              <div className="bg-surface-container rounded-xl p-4">
                <h3 className="font-bold text-on-surface text-sm mb-1">🔐 Données de compte</h3>
                <p className="text-on-surface-variant text-sm">Nom, adresse email et photo de profil fournis via Google Sign-In. Ces données sont nécessaires à la création et à la gestion de votre compte.</p>
              </div>
              <div className="bg-surface-container rounded-xl p-4">
                <h3 className="font-bold text-on-surface text-sm mb-1">📄 Données de facturation</h3>
                <p className="text-on-surface-variant text-sm">Informations relatives à votre entreprise (nom, adresse, SIRET, TVA), vos clients (nom, adresse, email, téléphone), vos factures et devis (montants, prestations, dates), votre catalogue d'articles. Ces données sont saisies volontairement par l'utilisateur.</p>
              </div>
              <div className="bg-surface-container rounded-xl p-4">
                <h3 className="font-bold text-on-surface text-sm mb-1">📷 Données traitées par l'IA</h3>
                <p className="text-on-surface-variant text-sm">Photos de brouillons, documents PDF/Excel et transcriptions vocales envoyés à Google Gemini pour extraction automatique. <strong>Ces données ne sont pas stockées</strong> par Photofacto ; elles sont transmises à Google Gemini via un appel API sécurisé et ne sont conservées que le temps du traitement.</p>
              </div>
              <div className="bg-surface-container rounded-xl p-4">
                <h3 className="font-bold text-on-surface text-sm mb-1">📊 Données techniques</h3>
                <p className="text-on-surface-variant text-sm">Adresse IP (anonymisée), logs de connexion Firebase, type de navigateur, date et heure des requêtes. Ces données sont utilisées à des fins de sécurité et de débogage.</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">3. Finalités du Traitement</h2>
            <p className="text-on-surface-variant leading-relaxed">Vos données sont traitées aux finalités suivantes :</p>
            <ul className="text-on-surface-variant leading-relaxed mt-3 space-y-2">
              <li><strong>Fourniture du service :</strong> création et gestion de factures, devis, avoirs, clients, catalogue d'articles</li>
              <li><strong>Extraction IA :</strong> analyse de photos, documents et dictées vocales pour pré-remplir les formulaires</li>
              <li><strong>Gestion de l'abonnement :</strong> facturation SaaS via Paddle, suivi des plans (Free/Starter/Pro)</li>
              <li><strong>Communication transactionnelle :</strong> envoi de factures par email via Resend, rappels de factures impayées</li>
              <li><strong>Amélioration du service :</strong> analyse anonymisée des usages, correction de bugs, développement de nouvelles fonctionnalités</li>
              <li><strong>Sécurité :</strong> détection et prévention des fraudes, monitoring des accès non autorisés</li>
            </ul>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">4. Base Légale du Traitement</h2>
            <p className="text-on-surface-variant leading-relaxed">Le traitement de vos données repose sur les bases légales suivantes :</p>
            <ul className="text-on-surface-variant leading-relaxed mt-3 space-y-2">
              <li><strong>Exécution du contrat (Art. 6.1.b RGPD) :</strong> les données de facturation et de compte sont nécessaires à la fourniture du Service</li>
              <li><strong>Consentement (Art. 6.1.a RGPD) :</strong> l'utilisation de l'IA pour l'analyse de documents repose sur votre consentement, donné lors de votre première utilisation</li>
              <li><strong>Intérêt légitime (Art. 6.1.f RGPD) :</strong> l'amélioration du service et la sécurité reposent sur notre intérêt légitime</li>
              <li><strong>Obligation légale (Art. 6.1.c RGPD) :</strong> la conservation des données comptables pendant 3 ans est une obligation légale (Code de commerce)</li>
            </ul>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">5. Sous-Traitants et Transferts de Données</h2>
            <p className="text-on-surface-variant leading-relaxed mb-3">Nous faisons appel aux sous-traitants suivants :</p>
            <div className="space-y-3">
              <div className="bg-surface-container rounded-xl p-4">
                <h3 className="font-bold text-on-surface text-sm mb-1">Firebase / Google Cloud Platform</h3>
                <p className="text-on-surface-variant text-sm">Hébergement de la base de données Firestore et authentification. Données hébergées en Europe. Transferts hors UE encadrés par les Clauses Contractuelles Types (CCT) de la Commission européenne.</p>
              </div>
              <div className="bg-surface-container rounded-xl p-4">
                <h3 className="font-bold text-on-surface text-sm mb-1">Paddle</h3>
                <p className="text-on-surface-variant text-sm">Traitement des paiements. Les données de carte bancaire ne transitent jamais par nos serveurs. Paddle est certifié PCI DSS Niveau 1.</p>
              </div>
              <div className="bg-surface-container rounded-xl p-4">
                <h3 className="font-bold text-on-surface text-sm mb-1">Resend</h3>
                <p className="text-on-surface-variant text-sm">Envoi d'emails transactionnels (factures PDF, rappels). Les adresses email des destinataires sont transmises de manière sécurisée.</p>
              </div>
              <div className="bg-surface-container rounded-xl p-4">
                <h3 className="font-bold text-on-surface text-sm mb-1">Google Gemini</h3>
                <p className="text-on-surface-variant text-sm">Traitement IA des documents (photos, dictées, PDF/Excel). Les documents envoyés ne sont pas stockés par Google à des fins d'entraînement des modèles, conformément aux conditions d'utilisation de l'API Gemini.</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">6. Durée de Conservation</h2>
            <p className="text-on-surface-variant leading-relaxed">Vos données sont conservées selon les durées suivantes :</p>
            <ul className="text-on-surface-variant leading-relaxed mt-3 space-y-2">
              <li><strong>Données de compte :</strong> durée de l'abonnement + 30 jours après résiliation</li>
              <li><strong>Données de facturation :</strong> durée de l'abonnement + 3 ans (obligation comptable, Art. L123-22 du Code de commerce)</li>
              <li><strong>Données envoyées à l'IA :</strong> non stockées, traitées en temps réel uniquement</li>
              <li><strong>Logs techniques :</strong> 12 mois maximum, à des fins de sécurité</li>
            </ul>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              À l'issue de ces durées, vos données sont supprimées de manière sécurisée ou anonymisées.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">7. Vos Droits</h2>
            <p className="text-on-surface-variant leading-relaxed mb-3">Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="text-on-surface-variant leading-relaxed mt-3 space-y-2">
              <li><strong>Droit d'accès :</strong> obtenir la confirmation que vos données sont traitées et accéder à ces données</li>
              <li><strong>Droit de rectification :</strong> corriger des données inexactes (directement dans l'application)</li>
              <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données en contactant <a href="mailto:contact@photofacto.fr" className="text-primary hover:underline">contact@photofacto.fr</a></li>
              <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré (export JSON/CSV disponible dans l'application)</li>
              <li><strong>Droit à la limitation et à l'opposition :</strong> demander la limitation du traitement ou vous y opposer</li>
              <li><strong>Droit de retrait du consentement :</strong> retirer votre consentement à tout moment (désactivation de l'IA dans les paramètres)</li>
            </ul>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Nous nous engageons à répondre à toute demande dans un délai de <strong>30 jours</strong>. Ce délai peut être prolongé de 2 mois en cas de complexité, avec notification à l'utilisateur.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              <strong>Droit de recours :</strong> si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la <a href="https://www.cnil.fr" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">CNIL</a> (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07).
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">8. Cookies</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Ce site utilise uniquement des cookies <strong>strictement nécessaires</strong> au fonctionnement du service :
            </p>
            <ul className="text-on-surface-variant leading-relaxed mt-3 space-y-2">
              <li><strong>Firebase Authentication :</strong> cookies de session pour maintenir la connexion Google (durée : jusqu'à déconnexion)</li>
              <li><strong>Local Storage :</strong> mémorisation de l'état du tutoriel d'onboarding (par UID utilisateur, pas de cookie)</li>
              <li><strong>IndexedDB :</strong> persistance locale des données en mode hors-ligne (fonctionnalité PWA)</li>
            </ul>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Aucun cookie de tracking publicitaire (Google Ads, Facebook Pixel), d'analyse d'audience (Google Analytics) ou de réseaux sociaux n'est déposé sur votre appareil. Un bandeau de consentement n'est donc pas requis conformément aux recommandations de la CNIL.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">9. Sécurité</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Nous mettons en œuvre les mesures de sécurité suivantes pour protéger vos données :
            </p>
            <ul className="text-on-surface-variant leading-relaxed mt-3 space-y-2">
              <li><strong>Chiffrement en transit :</strong> toutes les communications sont chiffrées en TLS 1.3</li>
              <li><strong>Chiffrement au repos :</strong> les données Firestore sont chiffrées par Google Cloud Platform (AES-256)</li>
              <li><strong>Contrôle d'accès :</strong> les règles de sécurité Firestore garantissent que chaque utilisateur ne peut accéder qu'à ses propres données</li>
              <li><strong>Clés API protégées :</strong> la clé API Gemini est stockée côté serveur (Vercel Serverless Function) et n'est jamais exposée au navigateur</li>
              <li><strong>Accès restreint :</strong> seul l'éditeur du Service a accès aux données d'administration (logs, configurations)</li>
            </ul>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">10. Modifications de la Politique</h2>
            <p className="text-on-surface-variant leading-relaxed">
              La présente Politique de Confidentialité peut être modifiée à tout moment. En cas de changement substantiel, les utilisateurs seront notifiés par email et par notification in-app au moins 15 jours avant l'entrée en vigueur des modifications. La version en vigueur est toujours accessible à l'adresse <strong>photofacto.fr/confidentialite</strong>.
            </p>
          </div>

          <p className="text-xs text-on-surface-variant/50 pt-4 border-t border-outline-variant/10">
            Dernière mise à jour : 12 avril 2026
          </p>
        </section>
      </main>
    </div>
  );
}
