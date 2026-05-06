# Pricing et quotas Photofacto

Source de vérité produit : `src/lib/billing.ts`.

## Plans

- `free` : 5 devis/factures par mois, 3 clients, 3 usages IA, 1 lien de signature, 1 import catalogue IA, PDF avec branding Photofacto.
- `starter` affiché `Solo` : devis/factures et clients illimités, 30 usages IA, 20 liens de signature, 5 imports catalogue IA, PDF personnalisé, relances manuelles.
- `pro` : 500 usages IA, signatures et imports catalogue IA illimités, relances automatiques si le cron est actif, Factur-X exportable, exports CSV/FEC.

Les prix affichés sont TTC. L’identifiant technique `starter` est conservé pour éviter une migration Paddle/Firestore ; l’interface affiche `Solo`.

## Guards serveur

- IA facture : `api/gemini.ts`.
- Import catalogue IA image/PDF : `api/catalog-import-ai.ts`.
- Validation devis/factures : `api/invoice-validate.ts`.
- Liens de signature : `api/quote.ts`.
- Connecteurs structurés : `api/chorus.ts` et `api/pennylane.ts`.
- Relances automatiques : `api/cron-reminders.ts` limite l’envoi automatique au plan Pro.

## Risques connus

La création de clients et la création de brouillons restent principalement côté client/Firestore. L’UI bloque les limites Free, et `firestore.rules` empêche la modification client des champs plan/quota/billing, mais une vraie garantie anti-contournement complète demanderait de déplacer ces créations dans des routes API transactionnelles.
