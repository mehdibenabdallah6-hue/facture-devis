# 📋 PHOTOFACTO — Contexte Complet du Projet (MAJ Avril 2026)

> **DOCUMENT CRITIQUE POUR L'IA** : Ce fichier contient TOUT le contexte nécessaire pour comprendre, maintenir et faire évoluer Photofacto sans poser de questions inutiles.

---

## 1. VISION & PRODUIT
Photofacto est un **SaaS de facturation intelligente** dédié aux artisans (plombiers, électriciens, etc.). 
*   **Killer Feature** : L'IA (Gemini) transforme une photo de brouillon ou une dictée vocale en facture/devis conforme en 10 secondes.
*   **Conformité 2026** : Génère des PDF au format **Factur-X** (standard obligatoire en France) et gère l'envoi vers **Chorus Pro**.
*   **Modèle** : Freemium (10 factures/mois gratuites) puis abonnements Solo/Pro gérés par **Paddle**.

---

## 2. STACK TECHNIQUE (Dernière version)
*   **Frontend** : React 19 + Vite 6 + Tailwind CSS 4.
*   **Mobile** : Stratégie **PWA** (Progressive Web App). Le site est installable sur iOS/Android avec icône et mode plein écran.
*   **Backend** : Vercel Serverless Functions (API en TypeScript).
*   **Database & Auth** : Firebase Firestore (temps réel + offline) + Google Sign-In.
*   **IA** : Google Gemini (`gemini-3-flash-preview` / `gemini-2.0-flash`).
*   **Paiements** : Paddle.js (Compte validé, prêt pour la production).
*   **Marketing** : Vidéo de démo réalisée avec **Remotion** (située dans `~/Desktop/photofacto-video`).

---

## 3. ÉTAT DU DÉVELOPPEMENT & DÉCISIONS
*   **Mobile** : Le dossier `mobile/` (Expo) est **SUSPENDU**. Ne pas y toucher. Tout le développement se fait dans `src/` (Web Mobile-First).
*   **SEO** : Les pages métiers (`/plombier`, `/electricien`, etc.) sont optimisées avec des titres H1 dynamiques et des métadonnées spécifiques.
*   **PWA** : Activée via `vite-plugin-pwa` dans `vite.config.ts`.
*   **Marketing** : Un système de **parrainage** et de **réduction de bienvenue** (48h) est intégré dans `DataContext.tsx`.

---

## 4. STRUCTURE DES FICHIERS CLÉS
*   `src/pages/InvoiceCreate.tsx` : Le cœur de l'app (Capture IA + Formulaire + PDF). **Fichier complexe (>2000 lignes)**.
*   `src/contexts/DataContext.tsx` : Gestion des données Firestore et logique métier (sync articles, parrainage).
*   `api/gemini.ts` : Proxy sécurisé pour les appels à l'IA.
*   `api/paddle-webhook.ts` : Réception des paiements pour activer les plans.
*   `src/services/facturx.ts` : Logique de génération du XML Factur-X.
*   `MOBILE_STRATEGY.md` : Détails du pivot vers la PWA.

---

## 5. VARIABLES D'ENVIRONNEMENT (Vercel)
*   `GEMINI_API_KEY` : Clé API Google AI.
*   `PADDLE_WEBHOOK_SECRET` : Pour valider les paiements.
*   `VITE_PADDLE_CLIENT_TOKEN` : Token public pour le checkout.
*   `VITE_PADDLE_ENV` : `production` ou `sandbox`.
*   `VITE_PADDLE_PRICE_STARTER_ID` / `VITE_PADDLE_PRICE_PRO_ID` : IDs des produits.

---

## 6. PROCHAINES ÉTAPES (TODO)
1.  **Production Paddle** : Remplacer les IDs de test par les vrais IDs de production dans `Upgrade.tsx` et `PaddlePaywall.tsx`.
2.  **Vidéo** : Finir la voix-off ElevenLabs dans le projet `photofacto-video`.
3.  **Domaine** : Pointer `photofacto.fr` vers Vercel et configurer le webhook Paddle final.

---
*Dernière mise à jour par Gemini CLI : 24 avril 2026*
