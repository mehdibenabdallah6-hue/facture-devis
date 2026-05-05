import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function CGV() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Conditions Générales de Vente — Photofacto";
  }, []);

  return (
    <div className="min-h-screen bg-surface font-body">
      <nav className="flex items-center gap-4 p-5 md:px-12 max-w-4xl mx-auto">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-surface-container-high transition-colors">
          <ArrowLeft className="w-5 h-5 text-on-surface" />
        </button>
        <h1 className="font-headline font-extrabold text-xl text-on-surface">Conditions Générales de Vente</h1>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pb-20">
        <section className="bg-surface-container-lowest rounded-3xl p-8 md:p-12 shadow-sm border border-outline-variant/10 space-y-8">

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">Article 1 — Objet</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent l'accès et l'utilisation du service <strong>Photofacto</strong>, accessible à l'adresse <strong>photofacto.fr</strong> (ci-après le « Service »). Le Service propose un outil de facturation en ligne assisté par intelligence artificielle, destiné aux artisans du bâtiment et travailleurs indépendants.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              L'accès au Service implique l'acceptation sans réserve des présentes CGV. L'utilisateur est invité à les lire attentivement avant toute utilisation.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">Article 2 — Inscription et Accès au Service</h2>
            <p className="text-on-surface-variant leading-relaxed">
              L'inscription au Service s'effectue exclusivement via un compte Google (Google Sign-In). L'utilisateur doit être majeur et disposer d'une capacité juridique pleine et entière.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              À l'issue de l'inscription, l'utilisateur est invité à renseigner les informations relatives à son entreprise (nom, adresse, SIRET, profession) afin de personnaliser le Service. Ces informations sont obligatoires pour utiliser les fonctionnalités de facturation.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              L'utilisateur est responsable de la confidentialité de ses identifiants de connexion Google. Toute utilisation du Service sous son compte est réputée effectuée par lui.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">Article 3 — Plan Gratuit Permanent</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Photofacto propose un <strong>plan gratuit permanent</strong>, sans limite de durée et sans carte bancaire requise. Ce plan est limité à environ 10 documents par mois et 5 utilisations de l'IA par mois. Il ne donne pas accès aux photos de chantier dans les PDF ni aux exports comptables.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Les abonnements payants sont disponibles à tout moment depuis l'interface. Une <strong>offre de bienvenue</strong> (réduction limitée dans le temps) peut être proposée lors de la création du compte ; cette offre est valable pendant 48 heures et ne peut être cumulée avec d'autres codes promotionnels.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">Article 4 — Plans et Tarifs</h2>
            <p className="text-on-surface-variant leading-relaxed">
              L'utilisateur peut souscrire à l'un des plans payants suivants à tout moment :
            </p>
            <div className="mt-4 space-y-4">
              <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant/10">
                <h3 className="font-bold text-on-surface text-lg mb-2">Plan Gratuit — 0€/an</h3>
                <ul className="text-on-surface-variant text-sm space-y-1">
                  <li>• 10 factures par mois</li>
                  <li>• 5 utilisations de l'IA par mois</li>
                  <li>• Pas de photos de chantier dans les PDF</li>
                  <li>• Pas d'export CSV/FEC</li>
                </ul>
              </div>
              <div className="bg-surface-container rounded-2xl p-5 border border-primary/20">
                <h3 className="font-bold text-on-surface text-lg mb-2">Plan Solo — 14,90€/mois ou 129€/an</h3>
                <ul className="text-on-surface-variant text-sm space-y-1">
                  <li>• Factures et devis illimités</li>
                  <li>• 50 utilisations de l'IA par mois</li>
                  <li>• Export Factur-X</li>
                  <li>• Envoi d'emails automatique</li>
                </ul>
              </div>
              <div className="bg-surface-container rounded-2xl p-5 border border-tertiary/20">
                <h3 className="font-bold text-on-surface text-lg mb-2">Plan Pro — 29,90€/mois ou 249€/an</h3>
                <ul className="text-on-surface-variant text-sm space-y-1">
                  <li>• Tout illimité (factures, IA, stockage)</li>
                  <li>• Photos de chantier dans les PDF</li>
                  <li>• Export CSV et FEC</li>
                  <li>• Support prioritaire</li>
                </ul>
              </div>
            </div>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Les prix sont exprimés en euros et s'entendent toutes taxes comprises (TTC). Le paiement est effectué via <strong>Paddle</strong> (carte bancaire, Apple Pay, Google Pay). L'abonnement mensuel est sans engagement. L'abonnement annuel est facturé en une fois. L'annulation peut être effectuée à tout moment depuis l'interface de gestion et prend effet à la fin de la période de facturation en cours.
            </p>
          </div>

          <div id="remboursement">
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">Article 5 — Politique de Remboursement et Rétractation</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux contenus numériques fournis sur un support immatériel dont l'exécution a commencé avec l'accord du consommateur. 
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3 font-bold">
              En souscrivant à un abonnement payant, l'utilisateur accepte l'exécution immédiate du service et renonce expressément à son droit de rétractation. En conséquence, aucun remboursement ne sera effectué une fois le paiement validé.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Le plan gratuit permanent permet à l'utilisateur de tester le Service avant tout achat.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">Article 6 — Responsabilité</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Photofacto fournit un <strong>outil d'aide à la facturation</strong>. <strong>L'utilisateur reste seul responsable</strong> de l'exactitude des informations saisies ou validées dans ses documents et de la conformité de ses factures avec la législation en vigueur (mentions légales obligatoires, taux de TVA, numérotation séquentielle, etc.).
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Photofacto ne se substitue en aucun cas à un expert-comptable ou à un conseiller juridique. En cas de doute sur la conformité de ses documents, l'utilisateur est invité à consulter un professionnel qualifié.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">Article 7 — Propriété des Données</h2>
            <p className="text-on-surface-variant leading-relaxed">
              L'utilisateur reste propriétaire de l'ensemble de ses données (factures, devis, clients, articles, photos de chantier). En cas de résiliation de son abonnement, l'utilisateur peut demander l'export de ses données à tout moment par email à <a href="mailto:contact@photofacto.fr" className="text-primary hover:underline">contact@photofacto.fr</a>.
            </p>
            <p className="text-on-surface-variant leading-relaxed mt-3">
              Les données sont conservées pendant toute la durée du compte. En cas de suppression du compte, les données sont supprimées sous 30 jours, sous réserve des obligations légales de conservation des documents comptables (10 ans).
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">Article 8 — Support et Contact</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Le support utilisateur est accessible par email à l'adresse <a href="mailto:contact@photofacto.fr" className="text-primary hover:underline">contact@photofacto.fr</a>.
            </p>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-on-surface mb-4">Article 9 — Droit Applicable</h2>
            <p className="text-on-surface-variant leading-relaxed">
              Les présentes CGV sont soumises au droit français. Tout litige relatif à leur interprétation ou leur exécution sera soumis aux tribunaux compétents.
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
