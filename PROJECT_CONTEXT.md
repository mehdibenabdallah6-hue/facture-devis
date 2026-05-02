# 📋 PHOTOFACTO — Contexte Complet du Projet

> **DOCUMENT CRITIQUE POUR L'IA** : Ce fichier contient tout le contexte nécessaire pour reprendre le projet sans poser de questions inutiles. Lis-le en entier avant d'agir.
>
> **Dernière MAJ** : 24 avril 2026 (après redesign "Spark" + nouveau logo hexagonal PF)

---

## 0. RÉPONSE EXPRESS — « De quoi s'occupe cette app ? »

**Photofacto** est un SaaS de facturation pour artisans français (plombiers, électriciens, maçons, peintres, etc.).
**Killer feature** : l'utilisateur prend une photo d'un brouillon (bloc-note, post-it) ou dicte à l'oral → l'IA Gemini extrait les lignes et prépare un brouillon de devis/facture modifiable, exportable en **Factur-X**.

- Owner / dev : **Mehdi Ben Abdallah** (`mehdibenabdallah6@gmail.com`)
- Repo : https://github.com/mehdibenabdallah6-hue/facture-devis (branche `main`)
- Hosting : Vercel (auto-deploy sur push main)
- Domaine cible : `photofacto.fr` (pas encore pointé en prod)

---

## 1. STACK TECHNIQUE

| Couche | Techno |
|---|---|
| Frontend | **React 19 + Vite 6 + Tailwind CSS 4** (config via `@theme` dans `src/index.css`) |
| Router | `react-router-dom` v7 (lazy routes) |
| Animations | `motion` (Framer Motion) + `lucide-react` |
| Backend | **Vercel Serverless Functions** (`api/*.ts`) |
| Database | **Firebase Firestore** (offline persistence activée) |
| Auth | Firebase Auth + Google Sign-In |
| IA | **Google Gemini** via `@google/genai` (proxy sécurisé dans `api/gemini.ts`) |
| Paiements | **Paddle.js** (Billing) |
| PDF | `jspdf` + `jspdf-autotable` + `pdf-lib` (pour embedding XML Factur-X) |
| PWA | `vite-plugin-pwa` (service worker + manifest auto-générés) |
| Analytics | PostHog + Sentry |
| Mobile | **PWA uniquement** (le dossier `mobile/` est un ancien Expo → ne PAS toucher) |

### Versions clés
- Node 22+ requis
- TypeScript 5.8
- Tailwind CSS 4 — **syntaxe nouvelle** : tokens via `@theme { --color-xxx }` dans `src/index.css`, pas de `tailwind.config.js`
- esbuild **pinned à 0.25.12** (aligné avec vite 6) — si tu vois une erreur esbuild version mismatch, `npm i -D esbuild@0.25.12`

---

## 2. DESIGN SYSTEM — Direction "Spark" (actuelle)

**Palette** :
- Primary Orange : `#E8621A` (`--color-primary`)
- Charcoal : `#2E3440` (`--color-secondary`, `--color-on-surface`)
- Background : `#FAFAF9`
- Success green : `#15803d`

**Typographie** :
- Titres : **Space Grotesk** (`var(--font-headline)`)
- Body : **DM Sans** (`var(--font-body)`)
- Wordmark "PHOTOFACTO" : **Anton** (condensé chunky, `var(--font-wordmark)`)

**Logo** (`/public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `/public/logo-full.png`) : hexagone orange avec "P" charbon + "F" orange à l'intérieur. **Ne pas le remplacer sans demande explicite** — l'utilisateur a déjà rejeté plusieurs versions.

**Classes CSS custom** (dans `src/index.css`) :
- `.wordmark-photofacto` → affiche "PHOTOFACTO" en typo logo. Utilisation :
  ```tsx
  <span className="wordmark-photofacto text-xl">
    <span className="wm-photo">PHOTO</span><span className="wm-facto">FACTO</span>
  </span>
  ```
  Variante sombre : ajouter la classe `on-dark` (PHOTO devient blanc).
- `.wordmark-tagline` → tagline "DOCUMENTER. VERIFIER. AVANCER." entourée de 2 tirets orange, points finaux orange.
- Composant prêt à l'emploi : `<PhotofactoWordmark tagline onDark className="text-5xl" />` dans `src/components/PhotofactoWordmark.tsx`.
- `shadow-spark-sm` / `-md` / `-lg` / `-cta` / `-cta-lg` / `-cta-xl` → shadows du design system
- `border-spark` / `border-b-spark` / `border-r-spark` → borders subtiles cohérentes
- `text-gradient-spark` → dégradé orange pour titres
- `accent-bar-spark` → petite barre orange en haut de page (sur landing)
- `animate-pulse-soft` → pulse plus doux que `animate-pulse` par défaut

**Radius** : la plupart des cartes utilisent `rounded-2xl`. Les boutons CTA utilisent `rounded-[10px]` ou `rounded-xl`.

**Règle d'or** : pour adapter un nouveau composant au design Spark, utilise les tokens existants (classes Tailwind standard → elles pointent vers les variables CSS) plutôt que des hex codés en dur.

---

## 3. STRUCTURE DES FICHIERS

```
/
├── api/                          # Vercel Serverless Functions
│   ├── gemini.ts                 # Proxy Gemini (extraction photo/voix → facture)
│   ├── paddle-webhook.ts         # Reçoit les events Paddle (activation plans)
│   ├── cron-reminders.ts         # Relances impayées (actuellement PAS branché en cron — cf §7)
│   ├── chorus.ts                 # Envoi vers Chorus Pro (stub à finaliser)
│   ├── pennylane.ts              # Intégration Pennylane (stub)
│   ├── send-email.ts             # Email transactionnel
│   └── welcome-email.ts
├── src/
│   ├── pages/
│   │   ├── LandingPage.tsx       # Marketing public (SEO pages métier + nav + footer)
│   │   ├── Dashboard.tsx         # Accueil app après login
│   │   ├── InvoiceCreate.tsx     # ⚠️ CŒUR DE L'APP >2000 lignes — capture IA + formulaire + PDF + email
│   │   ├── InvoicesList.tsx      # Liste docs + export ZIP mensuel + FEC
│   │   ├── ClientsList.tsx, ClientDetail.tsx
│   │   ├── Settings.tsx          # Société, logo papier-en-tête, TVA, signature mail
│   │   ├── Onboarding.tsx, OnboardingSuccess.tsx
│   │   ├── Upgrade.tsx, Subscription.tsx, PaddlePaywall.tsx
│   │   ├── PublicSignature.tsx   # Lien public client → signer un devis
│   │   ├── ReferralPage.tsx      # Parrainage
│   │   ├── CGV.tsx, MentionsLegales.tsx, PrivacyPolicy.tsx
│   │   └── NotFound.tsx, Contact.tsx, Changelog.tsx
│   ├── components/
│   │   ├── Layout.tsx            # Sidebar desktop + header mobile (auth pages)
│   │   ├── PhotofactoWordmark.tsx  # Logo texte réutilisable
│   │   ├── PDFPreview.tsx
│   │   ├── LegalInfoModal.tsx    # Modale obligatoire pour compléter les infos société
│   │   ├── OnboardingTutorial.tsx
│   │   ├── PaddlePaywall.tsx
│   │   ├── ReferralCard.tsx
│   │   └── EmptyStates.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx       # Firebase Auth + persistent session
│   │   └── DataContext.tsx       # Firestore sync (factures, clients, articles, société, parrainage, réduction 48h)
│   ├── services/
│   │   ├── facturx.ts            # Génération XML + embedding PDF/A-3 Factur-X
│   │   └── ... (gemini, email, etc.)
│   ├── App.tsx                   # Routes + providers
│   ├── main.tsx
│   └── index.css                 # 🎨 DESIGN TOKENS (Tailwind 4 @theme)
├── public/
│   ├── icons/icon-192.png, icon-512.png, apple-touch-icon.png  # ← logo PF hexagonal
│   ├── logo-full.png             # Version haute résolution
│   ├── manifest.json, sw.js (généré par vite-plugin-pwa, pas tracké)
│   └── favicon.svg, og-image.svg, robots.txt, sitemap.xml
├── index.html                    # Meta SEO + fonts Google (Space Grotesk, DM Sans, Anton, Archivo Black, Material Symbols)
├── vite.config.ts                # React + Tailwind + vercelApiPlugin (simule API en dev) + VitePWA
├── vercel.json                   # Rewrites SPA (exclut /api/)
├── tsconfig.json
├── firestore.rules
├── firebase-blueprint.json
├── .env.example                  # Template variables
└── package.json
```

### Fichiers à NE PAS toucher sans raison
- `mobile/` → ancien projet Expo suspendu
- `dist/`, `node_modules/` → générés
- `api/*.ts` en signature de handler : format Vercel `export default async function handler(req, res)`

---

## 4. LOGIQUE MÉTIER — ce qu'il faut savoir

### Modèle freemium
- Plan **Free** : 10 factures/mois max
- Plan **Solo** (Paddle) : factures illimitées, PDF Factur-X, export ZIP mensuel
- Plan **Pro** (Paddle) : + multi-utilisateurs, intégration Chorus Pro / Pennylane

Le flag `isFree` / `plan` est dans `DataContext.tsx`. Les paywalls sont dans `PaddlePaywall.tsx` et `Upgrade.tsx`.

### Parrainage
- Code généré pour chaque utilisateur → **-50% abonnement mensuel (ou -15% annuel) pour les 2 parties**
- Logique dans `DataContext.tsx` + UI dans `ReferralCard.tsx` et `ReferralPage.tsx`
- Réduction de bienvenue **48h** pour les nouveaux inscrits (flag dans `DataContext.tsx`)

### Factur-X / Chorus Pro
- `src/services/facturx.ts` génère le XML CII (Cross Industry Invoice)
- Le XML est embeddé dans le PDF via `pdf-lib` en PDF/A-3
- Envoi Chorus Pro via `api/chorus.ts` → **actuellement stub**, affiche "Bientôt disponible" dans Settings.tsx

### Extraction IA
- Route : `POST /api/gemini` avec `{ type: 'photo'|'voice'|'pdf', data: base64|text }`
- Réponse : lignes de facture structurées (description, quantité, PU, TVA)
- Le modèle utilisé est `gemini-2.0-flash` (configurable côté serveur)
- **Les données ne sont PAS stockées** — c'est un proxy stateless (conforme RGPD, mentionné dans PrivacyPolicy.tsx)

---

## 5. VARIABLES D'ENVIRONNEMENT

### Sur Vercel (Production)
```
# Firebase (client — exposées au bundle, VITE_*)
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID

# Paddle
VITE_PADDLE_CLIENT_TOKEN           # Token public checkout
VITE_PADDLE_ENV                    # 'production' ou 'sandbox'
VITE_PADDLE_PRICE_STARTER_ID       # ID produit Solo
VITE_PADDLE_PRICE_PRO_ID           # ID produit Pro
PADDLE_WEBHOOK_SECRET              # Vérif signature webhook

# IA
GEMINI_API_KEY                     # Server-side uniquement

# Firebase Admin (serverless)
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY                # ⚠️ avec les \n échappés

# Email (si utilisé)
RESEND_API_KEY  ou  SENDGRID_API_KEY
```

### En local (`.env.local`, gitignoré)
Pour preview sans backend réel, on peut mettre des valeurs dummy Firebase :
```
VITE_FIREBASE_API_KEY=AIzaSyDUMMY_KEY_FOR_LOCAL_PREVIEW_000000000
VITE_FIREBASE_AUTH_DOMAIN=dummy.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dummy-project
VITE_FIREBASE_STORAGE_BUCKET=dummy.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
```

---

## 6. COMMANDES FRÉQUENTES

```bash
# Dev local
npm run dev                       # Vite sur http://localhost:3000

# Build
npm run build                     # vite build (inclut génération PWA sw.js)
npm run preview                   # Sert dist/ localement

# Lint (TypeScript)
npm run lint                      # tsc --noEmit

# Nettoyage
npm run clean                     # rm -rf dist
```

### Reset node_modules en cas de soucis esbuild/vite
```bash
rm -rf node_modules package-lock.json
npm install
npm install --save-dev esbuild@0.25.12
```

---

## 7. DÉPLOIEMENT & CI/CD

- **Push sur `main` → auto-deploy Vercel en production**
- Preview deploys sur toutes les autres branches
- **Crons Vercel désactivés** : le projet est en plan Hobby → `vercel.json` ne contient PAS de `crons` (c'était une source d'échec de build). Si tu veux réactiver `api/cron-reminders` :
  1. Upgrade Vercel Pro, ou
  2. Utiliser un cron externe gratuit (cron-job.org) qui tape `https://photofacto.fr/api/cron-reminders` chaque jour à 8h

### Points d'attention build
- **Workbox limit** : la config `workbox.maximumFileSizeToCacheInBytes` est à 4 MiB dans `vite.config.ts`. Si un asset dépasse ça, le build casse → soit réduire l'asset, soit augmenter la limite
- **Manifest PWA** vs `public/manifest.json` : vite-plugin-pwa génère son propre `manifest.webmanifest`. Le `public/manifest.json` legacy peut rester mais c'est le webmanifest qui fait foi
- **`public/sw.js` n'est PAS tracké** (gitignoré) — il est généré par vite-plugin-pwa à chaque build

### Vérif rapide build avant push
```bash
cd /Users/mehdi/Desktop/saas\ facture\ et\ devis
npm run build
```

---

## 8. HISTORIQUE RÉCENT & ÉTAT ACTUEL

### Sprint "Redesign Spark" (avril 2026)
- Migration du design de la version "Aurora" (vert teal) vers **"Spark"** (orange + charbon)
- Tokens CSS refaits dans `src/index.css` → toutes les classes Tailwind existantes ont été remappées automatiquement
- Nouveaux shadows `shadow-spark-*` et utilitaires
- Sweep sur `src/pages/*.tsx` et `src/components/*.tsx` via sed :
  - `rounded-[2rem]` → `rounded-2xl`
  - `shadow-lg shadow-primary/20` → `shadow-spark-cta`
  - etc.
- Headers de pages tightened (text-3xl md:text-4xl au lieu de 4xl/5xl)

### Sprint logo + wordmark (24 avril)
- Nouveau logo hexagonal PF installé dans `public/icons/*` et `public/logo-full.png`
- Wordmark "PHOTOFACTO" en Anton (condensé) avec PHOTO charbon + FACTO orange + tagline "DOCUMENTER. VERIFIER. AVANCER." entre deux tirets orange
- Composant réutilisable : `src/components/PhotofactoWordmark.tsx`
- Appliqué dans : Layout (sidebar + header mobile), LandingPage (nav + footer), Onboarding, PublicSignature

### Commits récents sur `main`
```
b5bdbb5 style(wordmark): switch to Anton (condensed) + proper tagline style
357959c fix: replace logo with correct hexagonal PF mark
74ff99a fix(pwa): raise workbox precache limit to 4MiB + shrink logo-full
5d85104 fix(vercel): remove cron (Hobby plan) and stop tracking generated sw.js
5183de2 chore: track project config, public assets, docs and gitignore tooling dirs
318f8bd feat: wordmark Photofacto en style logo
1a3c324 fix: update logo to new Photofacto PF hexagonal design
f044657 chore: fix package.json truncation + pin esbuild 0.25.12
43129ed feat: reconstruction de l'index (force-push)
```

### ⚠️ Pièges déjà rencontrés
1. **Fichier corrompu** : `src/App.tsx` peut sembler non-vide (taille correcte) mais en réalité être vide (md5 = `d41d8cd98f00b204e9800998ecf8427e`). Fix : `git checkout HEAD -- src/App.tsx`.
2. **Port dev** : le script `npm run dev` utilise `--port=3000 --host=0.0.0.0` (pas le 5173 par défaut)
3. **Firebase init plante sans env vars** → écran blanc. Toujours vérifier `.env.local` avant de débugger
4. **Cache PWA agressif** : après déploiement, toujours tester avec Cmd+Shift+R (hard refresh) sinon le SW sert l'ancienne version

---

## 9. TODO / BACKLOG PRIORITAIRE

### Urgent
- [ ] Finaliser l'intégration **Paddle en production** : remplacer les IDs sandbox par les IDs prod dans `Upgrade.tsx` et `PaddlePaywall.tsx` (via env vars)
- [ ] Configurer le **webhook Paddle** sur le domaine prod pour activer les plans automatiquement
- [ ] Pointer **photofacto.fr** vers Vercel (DNS)

### Moyen terme
- [ ] Brancher `api/cron-reminders` (cron externe ou upgrade Pro)
- [ ] Finir l'intégration **Chorus Pro** dans `api/chorus.ts` (actuellement stub)
- [ ] Finir l'intégration **Pennylane** dans `api/pennylane.ts`
- [ ] Vidéo de démo : voix-off ElevenLabs dans `~/Desktop/photofacto-video` (projet Remotion séparé)

### Nice to have
- [ ] Dashboard admin (voir les métriques d'utilisation)
- [ ] Export FEC annuel en un clic
- [ ] App mobile native (reprendre `mobile/` ou faire un wrapper Capacitor sur la PWA — Capacitor est déjà installé)

---

## 10. CONVENTIONS DE CODE

- **Commits** : style Conventional Commits (`feat:`, `fix:`, `chore:`, `style:`, `docs:`, `refactor:`)
- **Langue** : UI en français, noms de variables/fonctions en anglais, commentaires en français acceptés
- **Types** : TypeScript strict, pas de `any` sauf nécessité
- **Imports** : alias `@/*` pointe vers la racine du projet
- **Style** : tout passe par Tailwind, **pas de CSS inline** sauf exceptions (variables dynamiques)
- **React** : composants fonctionnels + hooks, pas de class components
- **Pas de commentaires inutiles** — le code doit parler de lui-même

---

## 11. CONTACTS & COMPTES

- **Email contact** : `contact@photofacto.fr`
- **Repo** : https://github.com/mehdibenabdallah6-hue/facture-devis
- **Vercel** : projet `facture-devis` (équipe `lasergaimeur10-1241s-projects`)
- **Firebase** : à configurer / projet prod à créer si pas déjà fait
- **Paddle** : compte validé, prêt pour production

---

*Dernière mise à jour : 24 avril 2026 — après sprint logo + wordmark Anton.*
*Si tu reprends le projet : commence par `git pull`, `npm install`, puis lis ce fichier en entier.*
