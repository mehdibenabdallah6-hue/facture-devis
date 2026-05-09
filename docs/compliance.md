# Photofacto — état réel de conformité

Photofacto aide les artisans français à préparer des devis, factures, avoirs et exports structurés. Ce document sert de garde-fou marketing et produit : il précise ce qui existe déjà et ce qui ne doit pas être promis comme acquis.

## Ce qui existe déjà

- Numérotation serveur des factures validées avec compteur transactionnel.
- Verrouillage des factures validées côté API et règles Firestore.
- Création d’avoirs liée à la facture source.
- Journal d’audit écrit côté serveur.
- Génération PDF avec XML CII Factur-X embarqué sous `factur-x.xml`.
- Métadonnées XMP Factur-X, entrée Associated Files et OutputIntent ICC sRGB ajoutés au PDF généré.
- Tests automatisés internes sur XML CII, montants, régimes TVA, fichier embarqué, XMP et OutputIntent.
- Validation externe des fixtures Factur-X par veraPDF 1.30.1 et Mustangproject CLI 2.23.0.
- Préparation d’un modèle d’intégration pour plateformes de facturation électronique.

## Ce qui reste à valider ou connecter

- Validation sur des factures réelles clients avant toute promesse de conformité générale.
- Connexion réelle à une plateforme agréée ou à Chorus Pro avec contrat/credentials de production.
- Audit juridique/comptable des mentions, exports FEC et archivage.
- Certification ou auto-certification 88-VI si Photofacto entre dans le périmètre applicable.

## Formulations autorisées

- “Préparé pour la réforme de la facturation électronique.”
- “Aide à générer des factures structurées.”
- “Factur-X exportable.”
- “Export Factur-X validé.”
- “PDF avec XML Factur-X embarqué.”
- “Export Factur-X et connexion à une plateforme agréée en préparation.”
- “Connexion plateforme agréée à venir.”
- “Pensé pour les artisans français.”

## Formulations interdites tant que non audité

- “100% conforme.”
- “Certifié anti-fraude.”
- “Conforme réforme 2026.”
- “PDP intégrée.”
- “Envoi officiel Chorus Pro.”
- “PDF/A-3 garanti.”
- “Prêt contrôle fiscal.”
