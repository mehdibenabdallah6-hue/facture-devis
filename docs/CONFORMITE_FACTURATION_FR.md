# Conformité facturation française — état des lieux et limites

> **À lire d'abord — message au founder.**
>
> Cette note décrit *exactement* ce que Photofacto implémente côté
> conformité, et ce qu'il n'implémente *pas* encore. Elle n'est **pas**
> un avis juridique. Avant de revendiquer publiquement une conformité
> légale, faites valider la liste ci-dessous par un expert-comptable
> ou un avocat fiscaliste familier de la facturation BTP/artisans.
>
> Les références au Code de commerce, au CGI et aux directives sont
> données à titre indicatif pour la traçabilité réglementaire des choix
> d'architecture, pas comme garantie d'exhaustivité.

---

## 1. Ce que le code applique aujourd'hui

### 1.1 Numérotation légale (Art. L.441-9 Code de commerce, Art. 242 nonies A annexe II CGI)

- **Génération côté serveur uniquement** via [`api/invoice-validate.ts`](../api/invoice-validate.ts).
- Compteur `companies/{ownerId}/counters/{type}-{year}` incrémenté
  atomiquement dans une transaction Firestore : pas de course possible
  entre deux validations simultanées.
- **Une séquence par type et par année** :
  - `F-AAAA-NNNN` factures (préfixe configurable, max 8 caractères, MAJ),
  - `D-AAAA-NNNN` devis,
  - `AV-AAAA-NNNN` avoirs,
  - `AC-AAAA-NNNN` acomptes.
- L'année est extraite de `invoice.date` (date d'émission), **pas** de
  `Date.now()`, pour qu'une facture antidatée se rattache à la bonne
  série annuelle.
- Idempotence : appeler le endpoint deux fois sur la même facture déjà
  validée renvoie le numéro existant, ne ré-incrémente pas.

### 1.2 Verrouillage post-validation (Art. 1376 Code civil — force probatoire)

- Une facture validée porte `isLocked === true` + `status === 'validated'`.
- Côté client (`DataContext.updateInvoice`) : whitelist stricte des champs
  modifiables après verrouillage (status downstream, métadonnées PDP,
  signature, partage). Toute modification du contenu légal lève
  `InvoiceLockedError`.
- Côté serveur (`firestore.rules`) : mêmes règles via
  `lockedFieldsUntouched()` et `lockNotRemoved()`. Le client ne peut **pas**
  désactiver `isLocked`.
- Suppression d'une facture verrouillée : refusée côté client *et* côté
  rules. Pour annuler, seul l'avoir est valide.

### 1.3 Avoirs (notes de crédit)

- Implémenté dans [`api/invoice-credit-note.ts`](../api/invoice-credit-note.ts).
- Source obligatoire : facture `isLocked && type === 'invoice'`.
- Lignes inversées (quantités négatives), totaux **recalculés côté
  serveur** — pas confiance au client.
- Numéro attribué dans la séquence `credit-{year}`, indépendante des
  factures.
- Lien bidirectionnel : la facture source reçoit `creditedBy` +
  `creditedAt`, l'avoir reçoit `linkedInvoiceId` + `linkedInvoiceNumber`.
- Événement `credit_note_created` écrit dans `invoiceEvents` dans la
  même transaction.

### 1.4 Audit trail / journal d'événements

- Collection `invoiceEvents`, schéma dans `src/contexts/DataContext.tsx`.
- **Toutes les écritures passent par l'API serveur** ([`api/invoice-event.ts`](../api/invoice-event.ts)).
  Les rules Firestore refusent toute écriture client (`allow write: if false`).
- Types couverts : `create`, `update`, `validate`, `send`, `mark_paid`,
  `mark_unpaid`, `cancel`, `credit_note_created`, `export_pdf`,
  `export_facturx`, `pdp_send`, `pdp_status_update`, `view`, `sign`.
- Métadonnées passées au log sont *prunées* : on rejette toute clé
  matchant `password|secret|token|api[_-]?key`, on cape les valeurs.
- Affiché en lecture seule via `<InvoiceHistoryPanel>` sur la page
  d'édition.

### 1.5 Mentions obligatoires — checklist

- Implémentée dans [`src/lib/compliance.ts`](../src/lib/compliance.ts), affichée
  via `<ComplianceChecklist>` dans la modale "Valider la facture".
- Sévérité graduée : `error` (bloquant), `warning` (recommandé), `info`
  (suggéré).
- Couvre :
  - SIRET 14 chiffres + n° TVA intracom (FR + 11 chiffres) ;
  - adresse émetteur + adresse client ;
  - SIREN client B2B ;
  - date d'émission + date d'échéance ;
  - mentions de pénalités de retard et indemnité forfaitaire 40 € (B2B) ;
  - franchise 293 B CGI (TVA = 0 + mention obligatoire) ;
  - autoliquidation BTP (TVA = 0 + mention obligatoire + B2B uniquement) ;
  - décennale + RC pro pour les professions BTP ;
  - durée de validité + "bon pour accord" pour devis BTP > 1 500 € ;
  - référence à la facture d'origine pour les avoirs ;
  - signe négatif pour le total d'un avoir.
- **Limitation honnête** : la détection "BTP" se fait par mot-clé sur
  le champ `profession`. Un artisan qui n'a pas renseigné une
  profession reconnaissable ne déclenchera pas les warnings BTP.

### 1.6 Régime de TVA

- Trois régimes supportés : `standard`, `franchise`, `autoliquidation`.
- En mode `franchise` ou `autoliquidation`, la checklist **bloque** la
  validation tant que la TVA n'est pas à 0 et que la mention textuelle
  obligatoire n'est pas dans les notes.
- **Limitation** : la TVA n'est pas figée par ligne — un utilisateur
  peut saisir 20 % puis basculer en franchise. La checklist détecte
  l'incohérence avant validation, mais ne corrige pas automatiquement.

### 1.7 Factur-X / e-invoicing

- Génération PDF Factur-X (CII XML embarqué) via
  `src/services/facturx.ts` — déjà présent dans le code legacy, non
  modifié dans cette passe.
- Prep PDP/PA 2026 : abstraction dans
  [`src/lib/einvoicing/provider.ts`](../src/lib/einvoicing/provider.ts) —
  voir [`docs/EINVOICING_2026.md`](EINVOICING_2026.md).

### 1.8 Sécurité Firestore

- Voir [`docs/FIREBASE_RULES.md`](FIREBASE_RULES.md).
- Toute la conformité ci-dessus s'effondre si les rules ne sont pas
  déployées en production. Vérifier `firebase deploy --only firestore:rules`.

---

## 2. Ce que le code N'IMPLÉMENTE PAS encore

| Domaine | État | Risque |
|---|---|---|
| Validation manuelle par expert-comptable des mentions exactes | ❌ Non fait | Élevé — la checklist couvre les cas courants mais pas tous |
| Archivage légal 10 ans (durée minimum CGI art. L.123-22) | ⚠️ Repose sur Firebase | Moyen — pas de scellé qualifié, pas d'export normalisé |
| Signature électronique qualifiée eIDAS | ❌ Non | Moyen — la signature actuelle est une image canvas, sans valeur eIDAS |
| FEC (Fichier des Écritures Comptables) certifié | ⚠️ Export CSV existant | À auditer — format non vérifié contre BOI-CF-IOR-60-40-20 |
| Détection des gaps de séquence (facture supprimée avant validation) | ✅ Pas possible | Le compteur n'est incrémenté qu'à la validation, donc une suppression de brouillon ne crée pas de gap |
| Logiciel certifié anti-fraude (LF 88-VI) | ❌ Non auto-certifié | Élevé — Photofacto n'est pas (encore) déclaré logiciel de caisse certifié |
| PDP retenue / immatriculée DGFIP | ❌ Non | Bloquant à terme — voir EINVOICING_2026.md |
| Conformité RGPD complète (DPO, DPA fournisseurs, registre) | ⚠️ Partiel | Moyen — politique de confidentialité présente, registre non documenté |

---

## 3. Décisions à valider avec un expert-comptable

1. **Préfixe configurable de facture** — la loi exige *unicité et
   continuité* mais n'impose pas un format. On laisse le founder choisir
   son préfixe dans les réglages (`F`, `FA`, `INV`…). À confirmer qu'on
   n'autorise pas un préfixe trop exotique.

2. **Année dans le numéro** — beaucoup d'éditeurs incluent l'année,
   d'autres non. On fait `F-AAAA-NNNN`. À confirmer qu'on ne pénalise
   pas les utilisateurs qui veulent une séquence 100 % continue
   (NNNNN sans année).

3. **Reset annuel du compteur** — actuellement on commence à 1 chaque
   1ᵉʳ janvier. L'administration accepte cette pratique mais certains
   experts préfèrent une séquence continue inter-années.

4. **Avoir total vs. partiel** — l'avoir actuel est *toujours* un miroir
   complet de la facture source. Pas d'avoir partiel. À discuter avec
   le founder : un MVP simple peut suffire, mais les artisans BTP
   créditent souvent uniquement la prestation contestée.

5. **Mention décennale** — exigée pour les artisans bâtiment. Notre
   détection par mot-clé sur la profession est imparfaite : un
   "rénovation maison" ne matche pas "bâtiment". À renforcer en
   demandant explicitement à l'utilisateur lors de l'onboarding s'il
   travaille dans le BTP.

---

## 4. Pour aller plus loin

- BOI-TVA-DECLA-30-20-20 (Bulletin officiel des finances publiques,
  facturation) — référentiel principal côté impôts.
- DGFIP — fiche pratique factures électroniques :
  https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique
- Article D.441-5 Code de commerce — indemnité forfaitaire de 40 €.
- Loi 88-VI (LFR 2018) — logiciels de caisse certifiés.
- Code des assurances L.241-1 — décennale BTP.

---

## 5. TL;DR — niveau de conformité visé vs. atteint

| Métrique | Cible | Actuel |
|---|---|---|
| Numérotation légale | Continue, unique, server-side | ✅ Conforme |
| Verrouillage post-validation | Immutabilité contenu légal | ✅ Conforme côté code, **à vérifier en prod** que les rules sont déployées |
| Avoirs | Type dédié + lien bi-dir + numéro propre | ✅ Conforme MVP |
| Audit trail | Server-only, exhaustif | ✅ Conforme MVP — types listés, pas tous écrits depuis le client encore |
| Mentions obligatoires | Bloquantes avant validation | ⚠️ Couvertes mais à valider par CPA |
| Factur-X | PDF/A-3 + CII | ✅ Présent (legacy) |
| PDP 2026 | Adapter retenu, intégration testée | ❌ Mock seulement |
| Archivage 10 ans | Service tiers qualifié | ❌ Repose sur Firebase |
| Logiciel certifié 88-VI | Auto-certification ou audit | ❌ Non |
| RGPD | Registre + DPO + DPA | ⚠️ Politique présente, gouvernance non documentée |

**Verdict honnête** : Photofacto a aujourd'hui un *socle* de conformité
juridique qui le distingue de l'usine à PDF naïve, mais il n'est pas
légalement audité et n'est pas un logiciel certifié anti-fraude. Le
founder peut l'utiliser pour ses propres factures et pour des artisans
solo qui prennent leurs responsabilités, mais ne doit **pas** revendiquer
sur le site une conformité totale tant que les points en ❌ et ⚠️ ne
sont pas levés.
