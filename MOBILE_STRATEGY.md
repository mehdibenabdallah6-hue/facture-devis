# Stratégie Mobile - Photofacto

## Décision Stratégique (Avril 2026)
Suite à des problèmes de synchronisation et de maintenance d'une base de code double (React Web vs React Native/Expo), la décision a été prise de **suspendre le développement du dossier `mobile/`**.

Le maintien d'un monorepo avec deux technologies front-end distinctes n'est pas viable ni efficace pour un développeur solo. L'objectif principal est de se concentrer sur la création de valeur et l'acquisition des premiers clients.

## Plan d'action pour le Mobile

### Phase 1 : Lancement (Actuelle)
L'application principale web (dossier `src/`) est **Mobile-First**. 
La stratégie retenue pour le lancement est d'utiliser la technologie **PWA (Progressive Web App)**.
*   **Avantages** : 0 ligne de code supplémentaire à maintenir. Le site `photofacto.fr` peut être installé directement sur l'écran d'accueil des smartphones (iOS/Android) via le navigateur, offrant une expérience "App-like" (plein écran).
*   **Action requise** : S'assurer que le fichier `manifest.json` et le Service Worker (si hors-ligne nécessaire) sont optimisés. Encourager les utilisateurs à "Ajouter à l'écran d'accueil" dans l'onboarding.

### Phase 2 : Distribution App Store / Play Store (Future)
Si les utilisateurs exigent une présence sur les stores officiels, nous **ne recoderons pas l'application en React Native ou Flutter**.
Nous utiliserons **Capacitor** (par Ionic).
*   **Concept** : Capacitor permet d'"emballer" l'application web React existante dans une coquille native (WebView optimisée) avec un accès total aux API natives (Appareil photo, fichiers, notifications push).
*   **Avantages** : Une seule base de code à maintenir (`src/`). Toute mise à jour de l'interface web mettra automatiquement à jour l'application mobile.

## Règles pour l'Assistant IA
1.  **Ne plus proposer de modifications sur le dossier `mobile/`**.
2.  Toute nouvelle fonctionnalité (UI, IA, Paiement) doit être développée **exclusivement** dans le dossier web (`src/` ou `api/`).
3.  Veiller à ce que l'interface web (`src/`) reste toujours parfaitement responsive et fluide sur les écrans tactiles.
