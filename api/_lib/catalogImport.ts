export interface ExistingCatalogArticle {
  id: string;
  description: string;
  unitPrice: number;
  vatRate: number;
  unit?: string;
  category?: string;
  notes?: string;
}

export interface RawCatalogImportItem {
  name?: unknown;
  description?: unknown;
  unit?: unknown;
  priceHT?: unknown;
  unitPrice?: unknown;
  price?: unknown;
  vatRate?: unknown;
  category?: unknown;
  notes?: unknown;
  confidence?: unknown;
}

export interface CatalogImportPreviewItem {
  id: string;
  name: string;
  description: string;
  unit: string;
  priceHT: number;
  vatRate: number;
  category: string;
  notes: string;
  confidence: number;
  needsReview: boolean;
  selected: boolean;
  duplicateOfId?: string;
  duplicateReason?: string;
}

const DEFAULT_UNIT = 'unité';
const REVIEW_CONFIDENCE_THRESHOLD = 0.75;

export function articleIdFromDescription(description: string): string {
  const slug = normalizeComparableText(description)
    .replace(/€/g, '')
    .replace(/m²|m 2|m\\^2/g, 'm2')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);

  return slug || `article_${Date.now()}`;
}

export function normalizeComparableText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeCatalogText(value: unknown, max = 220): string {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function parseCatalogNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return fallback;

  const cleaned = value
    .replace(/\s/g, '')
    .replace(/[€$]/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCatalogUnit(value: unknown): string {
  const raw = normalizeComparableText(value);
  if (!raw) return DEFAULT_UNIT;
  if (['h', 'heure', 'heures', 'hr'].includes(raw)) return 'heure';
  if (['m2', 'm²', 'metre carre', 'metres carres', 'm carre'].includes(raw)) return 'm²';
  if (['ml', 'metre lineaire', 'metres lineaires', 'm lineaire'].includes(raw)) return 'mètre linéaire';
  if (['forfait', 'forfaits', 'ff'].includes(raw)) return 'forfait';
  if (['unite', 'unites', 'u', 'piece', 'pieces'].includes(raw)) return 'unité';
  if (['m', 'metre', 'metres'].includes(raw)) return 'mètre';
  return DEFAULT_UNIT;
}

function clampVatRate(value: unknown): number {
  const parsed = parseCatalogNumber(value, 20);
  if ([0, 2.1, 5.5, 10, 20].includes(parsed)) return parsed;
  if (parsed < 0 || parsed > 100) return 20;
  return Math.round(parsed * 100) / 100;
}

function normalizeConfidence(value: unknown): number {
  const parsed = parseCatalogNumber(value, 0.7);
  if (parsed > 1 && parsed <= 100) return Math.round(parsed) / 100;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return Math.round(parsed * 100) / 100;
}

export function normalizeCatalogImportItems(
  rawItems: RawCatalogImportItem[],
  existingArticles: ExistingCatalogArticle[],
): CatalogImportPreviewItem[] {
  return rawItems
    .map((raw, index) => {
      const name = sanitizeCatalogText(raw.name || raw.description, 140);
      const description = sanitizeCatalogText(raw.description || raw.name, 260);
      if (!name && !description) return null;

      const priceHT = roundMoney(parseCatalogNumber(raw.priceHT ?? raw.unitPrice ?? raw.price, 0));
      const vatRate = clampVatRate(raw.vatRate);
      const confidence = normalizeConfidence(raw.confidence);
      const item: CatalogImportPreviewItem = {
        id: `${articleIdFromDescription(name || description)}_${index}`,
        name: name || description,
        description: description || name,
        unit: parseCatalogUnit(raw.unit),
        priceHT,
        vatRate,
        category: sanitizeCatalogText(raw.category, 80),
        notes: sanitizeCatalogText(raw.notes, 500),
        confidence,
        needsReview: confidence < REVIEW_CONFIDENCE_THRESHOLD || priceHT <= 0,
        selected: true,
      };

      const duplicate = detectDuplicate(item, existingArticles);
      if (duplicate) {
        item.duplicateOfId = duplicate.id;
        item.duplicateReason = 'Cette prestation existe déjà dans votre catalogue.';
        item.selected = false;
      }

      return item;
    })
    .filter((item): item is CatalogImportPreviewItem => item !== null)
    .slice(0, 60);
}

function detectDuplicate(
  item: Pick<CatalogImportPreviewItem, 'name' | 'priceHT' | 'vatRate'>,
  existingArticles: ExistingCatalogArticle[],
): ExistingCatalogArticle | null {
  const itemId = articleIdFromDescription(item.name);
  const itemComparable = normalizeComparableText(item.name);

  return existingArticles.find(article => {
    const existingId = article.id || articleIdFromDescription(article.description);
    const existingComparable = normalizeComparableText(article.description);
    if (existingId === itemId || existingComparable === itemComparable) return true;

    const samePrice = Math.abs(Number(article.unitPrice || 0) - Number(item.priceHT || 0)) <= 0.01;
    const sameVat = Math.abs(Number(article.vatRate || 0) - Number(item.vatRate || 0)) <= 0.01;
    const nameOverlap = hasStrongTokenOverlap(itemComparable, existingComparable);
    return samePrice && sameVat && nameOverlap;
  }) || null;
}

function hasStrongTokenOverlap(left: string, right: string): boolean {
  const leftTokens = left.split(/[^a-z0-9]+/).filter(token => token.length >= 3);
  const rightTokens = new Set(right.split(/[^a-z0-9]+/).filter(token => token.length >= 3));
  if (leftTokens.length === 0 || rightTokens.size === 0) return false;
  const matches = leftTokens.filter(token => rightTokens.has(token)).length;
  return matches >= Math.min(2, leftTokens.length);
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
