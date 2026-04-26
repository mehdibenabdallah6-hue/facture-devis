# Firestore security rules — guide de référence

> Fichier source : [`firestore.rules`](../firestore.rules).
> Tester avant déploiement : `firebase emulators:start --only firestore`
> puis exécuter les scénarios listés en §4.

---

## 1. Principes

1. **Aucune fuite cross-tenant.** Tout document a un `ownerId` qui
   doit correspondre à `request.auth.uid`. Pas d'exception.
2. **Pas d'écriture client sur les données légales.** Le numéro de
   facture, l'audit trail, les compteurs, les factures fournisseurs
   reçues d'une PDP : toutes ces écritures passent par l'Admin SDK
   (qui contourne les rules — c'est le comportement voulu).
3. **Les factures validées sont scellées.** Les rules empêchent toute
   modification du contenu légal après `isLocked === true`.

---

## 2. Vue d'ensemble par collection

| Collection | Read | Create | Update | Delete |
|---|---|---|---|---|
| `companies/{uid}` | propriétaire | propriétaire (validé) | propriétaire (validé) | propriétaire |
| `companies/{uid}/counters/{type-year}` | propriétaire | ❌ | ❌ | ❌ |
| `companies/{uid}/articles/{id}` | propriétaire | propriétaire | propriétaire | propriétaire |
| `clients/{id}` | propriétaire | auth + valide | propriétaire (validé) | propriétaire |
| `invoices/{id}` (brouillon) | propriétaire | auth + non-locked | propriétaire (champs whitelist + validé) | propriétaire si non-locked |
| `invoices/{id}` (verrouillée) | propriétaire | n/a | propriétaire (whitelist seulement) | ❌ |
| `invoiceEvents/{id}` | propriétaire | ❌ (API only) | ❌ | ❌ |
| `supplierInvoices/{id}` (manual) | propriétaire | auth + manual | propriétaire (validé + manual) | propriétaire (manual) |
| `supplierInvoices/{id}` (PDP) | propriétaire | n/a | ❌ | ❌ |
| `sharedQuotes/{id}` | public (par ID) | propriétaire | public restreint signature | propriétaire |

❌ = `allow … : if false`. n/a = chemin impossible (ex. créer une
facture déjà locked est refusé par la rule de create).

---

## 3. Détails des règles non-triviales

### 3.1 `lockedFieldsUntouched()`

```
function lockedFieldsUntouched() {
  return resource.data.isLocked != true ||
         request.resource.data.diff(resource.data).affectedKeys()
                .hasOnly(postLockAllowedKeys());
}
```

- Si la facture n'est pas verrouillée, la règle est satisfaite par
  court-circuit.
- Sinon on calcule la liste des clés *modifiées* entre le doc actuel
  et le doc proposé, et on vérifie qu'elles sont *toutes* dans la
  whitelist `postLockAllowedKeys()`.
- La whitelist couvre : statut downstream (paid/overdue/cancelled),
  paiement, signature, partage, métadonnées PDP, photos chantier,
  `creditedBy/creditedAt` (mis à jour par la création d'avoir),
  `updatedAt`.
- **Ne couvre pas** : items, totaux, dates, numéro, régime TVA, notes
  → toute modif lève une rule violation.

### 3.2 `lockNotRemoved()`

```
function lockNotRemoved() {
  return resource.data.isLocked != true ||
         request.resource.data.isLocked == true;
}
```

Empêche un client de désactiver `isLocked`. Combiné avec la règle
`create`, garantit qu'une facture ne peut être créée déjà locked
(le serveur en mode Admin pose le flag) ni délockée plus tard.

### 3.3 `counters` — read-only

```
match /counters/{counterId} {
  allow read: if isOwner(companyId);
  allow write: if false;
}
```

Aucun client ne peut incrémenter un compteur. Seul `api/invoice-validate`
ou `api/invoice-credit-note` (Admin SDK → bypass rules) peut écrire.
Ce verrou est *la* garantie de la continuité du numéro légal.

### 3.4 `invoiceEvents` — read-only

```
match /invoiceEvents/{eventId} {
  allow read: if isDocOwner();
  allow write: if false;
}
```

Toutes les écritures passent par les routes API. Si un attaquant
trouve un moyen d'écrire un event depuis le client, l'audit trail
perd toute valeur probatoire — d'où le `false` strict.

### 3.5 `supplierInvoices` — distinction manual vs PDP

```
function isManualSupplierDoc()  { /* providerId absent ou 'manual' */ }
function isManualSupplierWrite() { /* idem sur la nouvelle valeur */ }

allow create: … && isManualSupplierWrite();
allow update: … && isManualSupplierDoc();
allow delete: … && isManualSupplierDoc();
```

Un user peut écrire une facture fournisseur saisie à la main, mais
les docs poussés par la PDP (qui auront `providerId === 'chorus'` ou
similaire) sont read-only. Cohérent avec la garde côté
`DataContext.updateSupplierInvoice`.

### 3.6 `sharedQuotes` — lien public restreint

```
match /sharedQuotes/{shareId} {
  allow read: if true;
  allow create: if isAuthenticated() &&
                   request.resource.data.ownerId == request.auth.uid;
  allow update: if request.resource.data.diff(resource.data)
                       .affectedKeys()
                       .hasOnly(['signature', 'signedAt', 'signedByName',
                                 'status', 'updatedAt']);
  allow delete: if isAuthenticated() && resource.data.ownerId == request.auth.uid;
}
```

Le lien `/sign/{shareId}` est partagé hors-app — le client signataire
n'est pas authentifié mais peut signer. Le `update` est volontairement
restreint à la whitelist signature pour qu'on ne puisse pas réécrire
les montants. Le partage n'est *pas* une mention légale — c'est juste
un workflow de signature préalable au devis.

---

## 4. Scénarios à tester avant chaque déploiement

Liste minimale à exécuter dans l'émulateur Firestore :

1. ✅ User A peut lire ses propres factures.
2. ❌ User A ne peut PAS lire les factures de User B.
3. ✅ User A peut créer une facture brouillon (`isLocked` absent).
4. ❌ User A ne peut PAS créer une facture déjà locked.
5. ❌ User A ne peut PAS modifier `items`, `number`, `totalTTC` après lock.
6. ✅ User A peut modifier `status` d'une facture verrouillée (sent → paid).
7. ❌ User A ne peut PAS supprimer une facture verrouillée.
8. ❌ User A ne peut PAS désactiver `isLocked` (le repasser à false).
9. ❌ User A ne peut PAS écrire dans `invoiceEvents`.
10. ❌ User A ne peut PAS écrire dans `companies/A/counters/...`.
11. ✅ User A peut écrire une `supplierInvoices` avec `providerId === 'manual'`.
12. ❌ User A ne peut PAS modifier une `supplierInvoices` poussée par PDP.
13. ✅ Visiteur public peut lire un `sharedQuotes` connaissant l'ID.
14. ❌ Visiteur public ne peut PAS modifier les montants d'un `sharedQuotes`.
15. ✅ Visiteur public peut écrire les champs signature dans un `sharedQuotes`.

Idéalement → écrire ces scénarios dans `firestore-tests.spec.ts` avec
`@firebase/rules-unit-testing`. **Pas encore fait.**

---

## 5. Déploiement

```bash
# Vérification syntaxique
firebase firestore:rules

# Déploiement
firebase deploy --only firestore:rules

# Rollback en cas de souci (Firebase garde l'historique)
firebase firestore:rules:get > rollback.rules
firebase firestore:rules:set rollback.rules
```

> **Important** : sans `firebase deploy --only firestore:rules`, la
> conformité côté code est inopérante en production — Firestore
> appliquera les rules par défaut (généralement permissives) ou les
> rules précédentes. Ajouter ce déploiement dans le pipeline CI/CD.

---

## 6. Limitations honnêtes

- **Pas de tests automatisés** des rules dans le repo. À écrire.
- **Pas d'audit Firestore activé** — Firebase n'expose pas un journal
  des accès par défaut. Pour une preuve d'accès à 10 ans, prévoir un
  export régulier vers BigQuery + archivage froid.
- **L'Admin SDK contourne les rules** — par design. Toute route
  serveur qui écrit doit donc faire **elle-même** les vérifications
  qu'elle aurait dû déléguer aux rules. C'est ce que font
  `verifyAuth()` + le check `ownerId === uid` dans chaque endpoint.
  Si un nouveau endpoint oublie ces gardes, c'est un trou de sécurité.
