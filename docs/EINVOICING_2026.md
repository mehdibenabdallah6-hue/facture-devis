# Facturation électronique — réforme 2026/2027

> Document d'architecture interne pour Photofacto. Décrit l'état du
> code et le plan d'intégration côté PDP/PA. Mis à jour 2026-04.

---

## 1. Contexte réglementaire (rappel)

Calendrier officiel après les reports successifs (état actuel — à
re-confirmer auprès de la DGFIP avant chaque déploiement) :

- **Septembre 2026** : *réception* obligatoire de factures
  électroniques pour toutes les entreprises assujetties à la TVA en
  France (PME comprises).
- **Septembre 2027** : *émission* obligatoire pour toutes les
  entreprises (les grandes/intermédiaires l'étaient dès septembre
  2026 ; le décalage concerne les PME et microentreprises).

Le PPF (Portail Public de Facturation) joue le rôle d'annuaire et de
concentrateur. Les éditeurs comme Photofacto doivent passer par une
**PDP** (Plateforme de Dématérialisation Partenaire) immatriculée par
la DGFIP — ils ne peuvent pas dialoguer directement avec le PPF.

> Sources : [impots.gouv.fr/facturation électronique](https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique),
> communiqués DGFIP 2024-2025. **Les dates précises ont déjà bougé
> deux fois — vérifier le calendrier en cours avant chaque release.**

---

## 2. Choix de design dans Photofacto

### 2.1 Abstraction provider

Le code définit une interface `EInvoicingProvider` dans
[`src/lib/einvoicing/provider.ts`](../src/lib/einvoicing/provider.ts) avec :

- `healthCheck()` — vérification credentials + heartbeat PDP,
- `sendInvoice(payload)` — émission d'une facture validée (Factur-X
  PDF + CII XML),
- `getInvoiceStatus(externalId)` — pull du statut courant,
- `receiveInvoices(sinceIso?)` — pull des factures fournisseurs,
- `cancelOrCorrectInvoice(externalId, reason, replacement?)` —
  annulation/correction selon ce que la PDP supporte.

L'interface est volontairement minimaliste : on couvre le cycle de vie
d'une facture mais on ne *prescrit* pas un schéma exact (chaque PDP a
son SDK et ses contraintes).

### 2.2 État courant : seul le mock est implémenté

`mockProvider` :
- garde tout en mémoire,
- refuse une facture non validée (`isLocked === false`),
- simule un `submitted` immédiat puis ne progresse pas tout seul,
- expose `_injectInbound()` et `_setStatus()` pour les tests.

`getProvider('chorus' | 'pennylane' | 'sellsy' | 'qonto' | 'pdp-custom')`
**lève une erreur explicite** plutôt que de retourner un fake.
On évite ainsi de déployer en production en pensant que ça marche.

### 2.3 Champs persistés sur l'invoice

Voir `Invoice` dans `src/contexts/DataContext.tsx` :

| Champ | Type | Rôle |
|---|---|---|
| `eInvoiceStatus` | `EInvoiceStatus` | Statut PDP (pending → submitted → accepted/rejected/error) |
| `eInvoiceProvider` | `string` | Identifiant du provider qui a transmis (`chorus`, `mock`…) |
| `eInvoiceExternalId` | `string` | ID retourné par la PDP — clé pour requérir le statut |
| `eInvoiceLastSyncAt` | ISO string | Dernier pull du statut |
| `eInvoiceErrors` | `string` | Dernier message d'erreur PDP |
| `pdpTransmissionHistory` | `Array<…>` | Trace par tentative (timestamp, provider, status, externalId, error) |

Les anciens champs `chorusStatus`, `chorusFluxId`, `chorusSubmittedAt`,
`chorusError`, `pennylaneId`, `pennylaneStatus` sont conservés en
"compat" mais on ne les fait pas évoluer — toute nouvelle écriture doit
utiliser les champs `eInvoice*` génériques.

### 2.4 Réception de factures fournisseurs

Type `SupplierInvoice` dédié dans `DataContext`, collection
`supplierInvoices`. Champs minimum :
fournisseur, SIRET, numéro, date, dueDate, totaux, statut, providerId,
providerExternalId, originalFileUrl, facturxXml, receivedAt.

Distinction `providerId === 'manual'` vs PDP :
- les docs poussés par PDP sont **read-only côté client** (rules
  Firestore + garde dans `DataContext.updateSupplierInvoice` /
  `deleteSupplierInvoice`),
- les docs saisis à la main sont éditables librement par le user.

---

## 3. Plan d'intégration PDP (à exécuter par le founder)

### Étape 1 — Choisir une PDP

Critères suggérés :
- **Coût par flux** (envoi + réception, généralement 0,01-0,05 € l'unité),
- **Format API** (REST/JSON ≫ SOAP),
- **Support Factur-X / UBL** (Photofacto produit du Factur-X),
- **SLA + support FR**,
- **Référentiel d'annuaire** (capacité à résoudre les SIRET vers les
  PDP des destinataires).

Options à comparer :
- Pennylane (moderne, API REST, écosystème PME),
- Sellsy / Cegid (legacy mais répandu),
- Generix, Sage, Esker (entreprise lourde — overkill pour MVP),
- une PDP indépendante "PME-friendly" type Tiime / Yooz / Quadient.

> Décision documentée du founder requise avant d'écrire l'adapter.

### Étape 2 — Créer l'adapter

Fichier `api/einvoice/<providerId>.ts` côté serveur uniquement (les
credentials ne doivent jamais atteindre le client) :

```ts
// Pseudocode
import type { EInvoicingProvider } from '../../src/lib/einvoicing/provider';

export const pennylaneProvider: EInvoicingProvider = {
  id: 'pennylane',
  name: 'Pennylane PDP',
  async healthCheck() { /* GET /v1/health */ },
  async sendInvoice(payload) { /* POST /v1/invoices */ },
  async getInvoiceStatus(externalId) { /* GET /v1/invoices/{id}/status */ },
  async receiveInvoices(since) { /* GET /v1/invoices/inbox?since=… */ },
  async cancelOrCorrectInvoice(externalId, reason) { /* POST /v1/invoices/{id}/cancel */ },
};
```

Côté serveur on remplace `getProvider()` par une factory qui pioche
l'adapter actif depuis l'env (`E_INVOICING_PROVIDER=pennylane`).

### Étape 3 — Routes API serveur

À créer dans `api/` :

- `POST /api/einvoice-send` — envoi d'une facture validée,
- `GET  /api/einvoice-status?invoiceId=…` — pull du statut,
- `POST /api/einvoice-pull` — cron/webhook pour récupérer les factures
  fournisseurs entrantes,
- `POST /api/einvoice-webhook` — endpoint que la PDP appelle pour les
  changements de statut (à brancher dans la console PDP).

Toutes ces routes doivent :
1. Vérifier l'auth Firebase (`verifyAuth`),
2. Vérifier l'ownership de l'invoice,
3. Mettre à jour `eInvoice*` + `pdpTransmissionHistory`,
4. Logger un `invoiceEvents` `pdp_send` ou `pdp_status_update`.

### Étape 4 — Cron Vercel pour le pull

```jsonc
// vercel.json
{
  "crons": [
    { "path": "/api/einvoice-pull", "schedule": "0 */6 * * *" }
  ]
}
```

Toutes les 6 h on appelle `receiveInvoices(lastSync)` et on déverse
dans `supplierInvoices`. Le cron doit utiliser un service-account ou
un secret partagé pour s'authentifier — pas un user.

### Étape 5 — Bascule progressive

1. Garder le mock comme provider par défaut en dev/test.
2. En staging, activer le vrai provider sur 1-2 tenants pilotes.
3. Mesurer : taux de rejet, temps de réponse, erreurs typées.
4. Bascule globale uniquement après 2 semaines sans incident bloquant.

---

## 4. Limitations honnêtes du code actuel

- **Le mock n'a pas de progression de statut** — il faut appeler
  `_setStatus()` à la main dans une console pour simuler un cycle de
  vie réel. Suffisant pour démontrer l'UX, pas pour tester le flow
  complet.
- **Aucune route serveur PDP** n'est encore écrite. L'utilisateur final
  ne peut pas envoyer une facture vers une vraie PDP aujourd'hui.
- **Pas de retry / dead-letter queue** côté `sendInvoice`. Le caller
  doit gérer les erreurs (cf. les contraintes documentées dans
  l'interface).
- **Pas de mapping Chorus Pro → e-invoicing générique** : le code legacy
  qui parle à Chorus Pro continue de tourner en parallèle. À moyen
  terme, l'adapter Chorus doit devenir une implémentation de
  `EInvoicingProvider` parmi d'autres.

---

## 5. Risques business à surveiller

| Risque | Impact | Mitigation |
|---|---|---|
| La DGFIP bouge encore les dates / le périmètre | Moyen | Re-vérifier le calendrier à chaque release ; abstraction provider permet de ne pas réécrire l'app |
| La PDP retenue ferme ou se fait racheter | Moyen | L'abstraction permet le swap, mais la migration des `eInvoiceExternalId` reste manuelle |
| Le PPF rejette le format Factur-X | Élevé | Tester en staging contre le sandbox PDP avant production ; garder le pipeline Factur-X validé |
| Les utilisateurs reçoivent des factures fournisseurs en formats variés | Moyen | Notre type `SupplierInvoice` est minimal — étendre si besoin (UBL XRechnung, Peppol BIS) |
| Un user veut utiliser sa propre PDP (déjà sous contrat) | Faible | Implémenter `pdp-custom` avec auth pluggable |

---

## 6. Pour décision

- [ ] **Founder** : choisir la PDP cible et signer le contrat sandbox.
- [ ] **Founder** : valider que le mode "logiciel utilisateur connecté à
      une PDP partenaire" suffit, ou si Photofacto doit lui-même
      candidater à l'immatriculation PDP DGFIP (lourd, plusieurs mois,
      audit obligatoire).
- [ ] **Tech** : écrire le premier adapter réel + les 4 routes API.
- [ ] **Tech** : ajouter une page Réglages > Facturation électronique
      pour exposer le statut PDP, le compteur de transmissions et les
      éventuelles erreurs.
