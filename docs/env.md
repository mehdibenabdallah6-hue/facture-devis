# Variables d’environnement

Règle principale : les secrets serveur ne doivent jamais commencer par `VITE_`. Les variables `VITE_` sont exposées au navigateur.

## Variables publiques navigateur

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_PADDLE_CLIENT_TOKEN`
- `VITE_PADDLE_ENV`
- `VITE_PADDLE_PRICE_STARTER_ID`
- `VITE_PADDLE_PRICE_STARTER_ANNUAL_ID`
- `VITE_PADDLE_PRICE_PRO_ID`
- `VITE_PADDLE_PRICE_PRO_ANNUAL_ID`
- `VITE_POSTHOG_KEY`
- `VITE_POSTHOG_HOST`
- `VITE_SENTRY_DSN`

## Secrets serveur

- `FIREBASE_SERVICE_ACCOUNT` ou `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CONTACT_TO_EMAIL`
- `GEMINI_API_KEY`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_PRICE_ID_STARTER`
- `PADDLE_PRICE_ID_STARTER_ANNUAL`
- `PADDLE_PRICE_ID_PRO`
- `PADDLE_PRICE_ID_PRO_ANNUAL`
- `PADDLE_PRICE_ID_PREMIUM` et `PADDLE_PRICE_ID_PREMIUM_ANNUAL` sont d’anciens noms dépréciés. Ne pas les utiliser pour une nouvelle configuration.
- `APP_URL`
- `ALLOWED_ORIGINS`
- `AUDIT_IP_SALT`
- `CRON_SECRET`
- `CHORUS_LOGIN`
- `CHORUS_PASSWORD`
- `CHORUS_PISTE_CLIENT_ID`
- `CHORUS_PISTE_SECRET`
- `USE_CHORUS_SANDBOX`
- `PENNYLANE_API_KEY`

`NODE_ENV` est fourni par Node/Vercel selon l’environnement d’exécution. Il ne doit généralement pas être configuré manuellement.

Ne commitez jamais de vraie clé API, service account Firebase, secret Paddle ou clé Resend.
