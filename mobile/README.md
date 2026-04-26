# Photofacto Mobile — React Native Expo

## Installation

```bash
cd mobile
npm install
npx expo prebuild  # Crée les dossiers ios/ et android/
```

## Développement

```bash
npx expo start
```

Puis :
- **`i`** → ouvre sur simulateur iOS (Mac uniquement)
- **`a`** → ouvre sur émulateur Android
- Scan le QR code avec l'app **Expo Go** sur ton téléphone

## Build production

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

## Structure

```
mobile/
├── app/                    # Expo Router (file-based routing)
│   ├── _layout.tsx         # Root layout (providers, status bar)
│   ├── index.tsx           # Splash/Login screen
│   ├── (auth)/             # Auth group (non protégé)
│   │   ├── _layout.tsx
│   │   └── onboarding.tsx  # Premier lancement
│   └── (app)/              # App group (protégé par auth)
│       ├── _layout.tsx     # Tab navigation
│       ├── index.tsx       # Dashboard
│       ├── invoices.tsx    # Liste factures
│       ├── camera.tsx      # Photo/Dictée/Import
│       ├── clients.tsx     # Liste clients
│       └── settings.tsx    # Paramètres
├── src/
│   ├── firebase.ts         # Config Firebase RN
│   └── contexts/
│       └── AuthContext.tsx # Auth provider
├── app.json                # Config Expo
├── package.json
└── .env                    # Variables Firebase
```

## À faire

- [ ] Ajouter Google Sign-In natif (`expo-auth-session`)
- [ ] Intégrer caméra (`expo-camera`)
- [ ] Intégrer dictée vocale (`expo-av`)
- [ ] DataContext Firebase Firestore
- [ ] Écran création facture avec formulaire
- [ ] Génération PDF
- [ ] Partage via Share API
