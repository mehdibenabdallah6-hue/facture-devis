# Photofacto

SaaS de facturation/devis pour les artisans français. React 19 + Vite +
Firebase + Vercel Functions.

> ⚠️ **À lire** : Photofacto fournit un *socle* de conformité légale
> française (numérotation server-side, verrouillage, avoirs, audit
> trail, mentions obligatoires). Il **n'est pas** un logiciel certifié
> anti-fraude (LF 88-VI), n'a pas été audité par un expert-comptable,
> et n'est pas relié à une PDP réelle pour la réforme 2026/2027 (mock
> seulement). Avant toute communication "100 % conforme", lire
> [`docs/CONFORMITE_FACTURATION_FR.md`](docs/CONFORMITE_FACTURATION_FR.md).

---

## Prérequis

- Node.js 22+ recommandé (CI actuelle)
- compte Firebase (Firestore + Auth)
- compte Vercel pour le déploiement
- compte Paddle pour le billing (sandbox suffit en dev)
- clé Gemini API pour les fonctions IA

---

## Installation

```bash
npm install
cp .env.example .env.local
# remplir les valeurs — voir .env.example pour le détail
npm run dev
```

L'app tourne sur `http://localhost:5173`.

---

## Architecture

```
photofacto/
├── api/                       # Vercel serverless functions
│   ├── _firebase-admin.ts     # Singleton Firebase Admin
│   ├── _verify-auth.ts        # Vérification ID token Firebase
│   ├── invoice-validate.ts    # Validation + numérotation légale (transaction)
│   ├── invoice-credit-note.ts # Création d'avoir (transaction)
│   └── invoice-event.ts       # Append audit trail
├── src/
│   ├── components/            # UI réutilisable
│   ├── contexts/DataContext.tsx  # Source de vérité Firestore
│   ├── lib/
│   │   ├── compliance.ts      # Checker mentions obligatoires FR
│   │   └── einvoicing/        # Abstraction PDP (mock pour le moment)
│   └── pages/                 # Routes
├── docs/
│   ├── CONFORMITE_FACTURATION_FR.md  # ✱ À lire avant tout
│   ├── EINVOICING_2026.md            # Plan PDP/PA
│   └── FIREBASE_RULES.md             # Guide des rules
├── firestore.rules            # Sécurité Firestore
└── vercel.json                # Config déploiement
```

---

## Conformité française — points clés

| Aspect | Implémentation | Statut |
|---|---|---|
| Numéros de facture continus & uniques | Compteur atomique server-side | ✅ |
| Verrouillage des factures validées | `isLocked` + rules + guards client | ✅ |
| Avoirs liés à la facture source | Endpoint dédié + transaction | ✅ |
| Audit trail (`invoiceEvents`) | Server-only writes | ✅ |
| Mentions obligatoires (293B, autoliq, BTP) | Checklist bloquante | ⚠️ Couvert MVP, à valider par CPA |
| Export Factur-X / CII | Généré, à valider techniquement | ⚠️ |
| Émission via plateforme agréée | Abstraction + mock | ❌ Vrai provider à brancher |
| Logiciel certifié 88-VI | Non | ❌ |
| Archivage 10 ans | Repose sur Firebase | ⚠️ |

Détails dans [`docs/CONFORMITE_FACTURATION_FR.md`](docs/CONFORMITE_FACTURATION_FR.md).

---

## Scripts npm

- `npm run dev` — serveur Vite + API émulée
- `npm run build` — build production
- `npm run preview` — prévisualiser le build
- `npm run typecheck` — TypeScript strict (s'il existe — sinon `npx tsc --noEmit`)

---

## Déploiement

### Firestore rules

**Étape critique** — la conformité côté code repose sur les rules :

```bash
firebase deploy --only firestore:rules
```

À mettre dans la pipeline CI avant chaque déploiement Vercel. Voir
[`docs/FIREBASE_RULES.md`](docs/FIREBASE_RULES.md).

### Vercel

```bash
vercel
# ou via Git, push sur main → déploiement auto
```

Les variables d'environnement doivent être configurées côté Vercel
(dashboard → Project → Settings → Environment Variables). Voir
`.env.example` pour la liste complète. Notamment :

- `FIREBASE_SERVICE_ACCOUNT` (ou `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL`
  + `FIREBASE_PRIVATE_KEY`) — sans ça, les routes serveur ne peuvent
  pas s'authentifier auprès de Firestore.
- `PADDLE_WEBHOOK_SECRET` — pour vérifier les webhooks de billing.
- `GEMINI_API_KEY` — pour les fonctions IA (analyse de photos, dictée).
- `CRON_SECRET` — secret long et aléatoire pour `/api/cron-reminders`.
- `AUDIT_IP_SALT` — sel unique production pour hasher les IP dans les traces sécurité/audit.

Le projet reste compatible Vercel Hobby : `vercel.json` ne déclare pas de cron
natif. Les relances automatiques doivent être déclenchées par un cron externe
qui appelle `/api/cron-reminders` avec `Authorization: Bearer ${CRON_SECRET}`,
ou par Vercel Cron après passage sur un plan compatible.

### Plans et quotas

Source de vérité : [`src/lib/billing.ts`](src/lib/billing.ts).

- Gratuit : 5 devis/factures par mois, 3 clients, 3 usages IA, 1 lien de signature, 1 import catalogue IA, PDF avec branding Photofacto.
- Solo (`starter` technique) : documents et clients illimités, 30 usages IA/mois, 20 liens de signature/mois, 5 imports catalogue IA/mois, PDF personnalisé, relances manuelles.
- Pro : 500 usages IA/mois, signatures/imports catalogue IA illimités, relances automatiques si le cron est actif, Factur-X exportable, exports CSV/FEC.

Les prix affichés sont TTC.

---

## Tests

- Type-check : `npm run lint`
- Tests unitaires/API : `npm run test`
- Tests rules Firestore : `JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:rules` en local si Java 21 n’est pas le Java par défaut.
- Build production : `npm run build`
- Tests E2E : non en place.

---

## Liens utiles

- [Conformité facturation FR](docs/CONFORMITE_FACTURATION_FR.md)
- [Plan e-invoicing 2026](docs/EINVOICING_2026.md)
- [Guide Firestore rules](docs/FIREBASE_RULES.md)
- [Code de commerce — Article L.441-9](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044120066/) (mentions facture)
- [BOI-TVA-DECLA-30-20-20](https://bofip.impots.gouv.fr/bofip/289-PGP.html) (facturation TVA)
