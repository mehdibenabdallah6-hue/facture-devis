# Rapport validation externe Factur-X

Date : 2026-05-09

## Statut produit

Les fixtures Photofacto passent la validation externe PDF/A-3b et Factur-X/ZUGFeRD BASIC.

Wording autorisé après cette passe :
- "Export Factur-X validé"
- "PDF avec XML Factur-X embarqué"
- "Préparation à la facturation électronique"

Wording toujours interdit :
- "Photofacto remplace une plateforme agréée/PDP"
- "Envoi officiel plateforme agréée"
- "100 % conforme réforme"

## Environnement

- Java : Temurin JRE 21.0.11
- veraPDF : 1.30.1
- Mustangproject CLI : 2.23.0
- Profil testé : PDF/A-3b + Factur-X/ZUGFeRD BASIC
- Fixtures : `tests/fixtures/facturx/`
- Rapports bruts : `docs/facturx-validation/reports/`

## Commandes

```bash
npm run facturx:fixtures
for f in tests/fixtures/facturx/*.xml; do xmllint --noout "$f"; done
JAVA_HOME=/Users/mehdi/photofacto-pricing-work/scratch/validators/jdk-21.0.11+10-jre/Contents/Home scratch/validators/verapdf/verapdf --format text --flavour 3b tests/fixtures/facturx/standard-tva-20.pdf
scratch/validators/jdk-21.0.11+10-jre/Contents/Home/bin/java -jar scratch/validators/Mustang-CLI-2.23.0.jar --action validate --source tests/fixtures/facturx/standard-tva-20.pdf --no-notices --disable-file-logging
```

## Résultats

| Fixture | XML bien formé | XML embarqué | PDF/A-3b veraPDF | Mustang Factur-X/ZUGFeRD | Erreurs restantes |
| --- | --- | --- | --- | --- | --- |
| `standard-tva-20.pdf` | oui | oui | oui | oui | aucune |
| `standard-tva-10.pdf` | oui | oui | oui | oui | aucune |
| `franchise-tva.pdf` | oui | oui | oui | oui | aucune |
| `autoliquidation.pdf` | oui | oui | oui | oui | aucune |
| `multi-lignes-b2b.pdf` | oui | oui | oui | oui | aucune |
| `avoir.pdf` | oui | oui | oui | oui | aucune |
| `acompte.pdf` | oui | oui | oui | oui | aucune |

## Corrections appliquées

- Génération d’un PDF humain dédié avec police NotoSans embarquée, au lieu de réutiliser le PDF jsPDF en Helvetica non embarquée.
- Ajout du trailer `/ID`, de l’OutputIntent ICC sRGB, des métadonnées XMP PDF/A-3b/Factur-X, de `EmbeddedFiles`, du catalogue `AF`, et de `AFRelationship Alternative`.
- Correction de l’identifiant de profil BASIC : `urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic`.
- Correction de l’ordre XML CII des adresses, des communications électroniques, des taxes et de la livraison.
- Ajout des notes réglementaires françaises `PMT`, `PMD`, `AAB`.
- Ajout des identifiants vendeur/acheteur : SIREN, endpoint, TVA ou immatriculation fiscale `FC` en franchise.
- Ajout d’une référence de facture antérieure pour les avoirs via `InvoiceReferencedDocument`.

## Limite restante

La validation prouve que les fixtures générées par le code passent veraPDF et Mustangproject. Elle ne transforme pas Photofacto en plateforme agréée/PDP et ne valide pas chaque facture réelle possible sans données obligatoires complètes.
