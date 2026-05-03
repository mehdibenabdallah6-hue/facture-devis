import { describe, expect, it } from 'vitest';
import {
  articleIdFromDescription,
  detectDuplicate,
  normalizeCatalogImportItems,
  parseCatalogNumber,
  parseCatalogUnit,
  previewItemToArticle,
} from './catalogImport';

const existingArticles = [
  {
    id: 'deplacement',
    description: 'Déplacement',
    unitPrice: 45,
    vatRate: 20,
    usageCount: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pose_prise_electrique',
    description: 'Pose prise électrique',
    unitPrice: 85,
    vatRate: 20,
    usageCount: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('catalogImport helpers', () => {
  it('crée un slug stable avec accents et caractères spéciaux', () => {
    expect(articleIdFromDescription('Déplacement chantier')).toBe('deplacement_chantier');
    expect(articleIdFromDescription('Peinture mur 22€/m²')).toBe('peinture_mur_22_m2');
  });

  it('parse les prix français', () => {
    expect(parseCatalogNumber('45 €', 0)).toBe(45);
    expect(parseCatalogNumber('1 250,50 €', 0)).toBe(1250.5);
    expect(parseCatalogNumber(undefined, 20)).toBe(20);
  });

  it('normalise les unités métier courantes', () => {
    expect(parseCatalogUnit('h')).toBe('heure');
    expect(parseCatalogUnit('m2')).toBe('m²');
    expect(parseCatalogUnit('ml')).toBe('mètre linéaire');
    expect(parseCatalogUnit('forfait')).toBe('forfait');
    expect(parseCatalogUnit('inconnue')).toBe('unité');
  });

  it('marque les lignes faibles ou sans prix comme à vérifier', () => {
    const [item] = normalizeCatalogImportItems(
      [{ name: 'Fournitures', priceHT: 0, vatRate: undefined, confidence: 0.4 }],
      existingArticles,
    );

    expect(item.name).toBe('Fournitures');
    expect(item.priceHT).toBe(0);
    expect(item.vatRate).toBe(20);
    expect(item.needsReview).toBe(true);
    expect(item.selected).toBe(true);
  });

  it('détecte les doublons et les décoche par défaut', () => {
    const [item] = normalizeCatalogImportItems(
      [{ name: 'Déplacement', unit: 'forfait', priceHT: '45 €', vatRate: 20, confidence: 0.95 }],
      existingArticles,
    );

    expect(item.duplicateOfId).toBe('deplacement');
    expect(item.duplicateReason).toContain('prestation existe');
    expect(item.selected).toBe(false);
  });

  it('détecte un doublon par nom proche et prix proche', () => {
    const duplicate = detectDuplicate(
      { name: 'pose prise electrique', priceHT: 85, vatRate: 20 },
      existingArticles,
    );

    expect(duplicate?.id).toBe('pose_prise_electrique');
  });

  it('convertit une ligne preview validée en article compatible', () => {
    const [item] = normalizeCatalogImportItems(
      [{
        name: 'Peinture mur',
        description: 'Peinture mur intérieur',
        unit: 'm2',
        priceHT: '22',
        vatRate: 10,
        category: 'Peinture',
        notes: 'Prix hors fournitures',
        confidence: 0.9,
      }],
      [],
    );

    expect(previewItemToArticle(item)).toMatchObject({
      description: 'Peinture mur intérieur',
      unitPrice: 22,
      vatRate: 10,
      unit: 'm²',
      category: 'Peinture',
      notes: 'Prix hors fournitures',
      source: 'ai_import',
    });
  });
});
