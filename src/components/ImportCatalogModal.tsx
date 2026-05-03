import React, { useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Camera, FileText, Loader2, RefreshCw, Table2, Upload, X } from 'lucide-react';
import { auth } from '../firebase';
import type { Article } from '../contexts/DataContext';
import {
  normalizeCatalogImportItems,
  previewItemToArticle,
  type CatalogArticleDraft,
  type CatalogImportPreviewItem,
  type CatalogImportSourceType,
  type RawCatalogImportItem,
} from '../lib/catalogImport';
import { CatalogImportPreview } from './CatalogImportPreview';
import { track } from '../services/analytics';

type XLSXModule = typeof import('xlsx');
let xlsxPromise: Promise<XLSXModule> | null = null;
const loadXlsx = async (): Promise<XLSXModule> => {
  if (!xlsxPromise) xlsxPromise = import('xlsx');
  return xlsxPromise;
};

interface ImportCatalogModalProps {
  isOpen: boolean;
  articles: Article[];
  onClose: () => void;
  onImport: (items: Array<CatalogArticleDraft & { duplicateOfId?: string; selected?: boolean }>) => Promise<void>;
  onSuccess: (message: string) => void;
}

type ImportOption = {
  key: 'spreadsheet' | 'photo' | 'old_quote';
  title: string;
  description: string;
  accept: string;
  icon: React.ReactNode;
  sourceType: CatalogImportSourceType | 'old_quote';
};

const IMPORT_OPTIONS: ImportOption[] = [
  {
    key: 'spreadsheet',
    title: 'Excel / CSV',
    description: 'Importez un fichier avec colonnes description, prix, TVA.',
    accept: '.xlsx,.xls,.csv',
    icon: <Table2 className="w-5 h-5" />,
    sourceType: 'spreadsheet',
  },
  {
    key: 'photo',
    title: 'Photo de carnet ou liste de prix',
    description: 'Prenez en photo vos notes ou votre grille de tarifs.',
    accept: 'image/jpeg,image/png,image/webp',
    icon: <Camera className="w-5 h-5" />,
    sourceType: 'photo',
  },
  {
    key: 'old_quote',
    title: 'Ancien devis PDF / image',
    description: 'Récupérez les lignes utiles depuis un ancien devis.',
    accept: 'application/pdf,image/jpeg,image/png,image/webp',
    icon: <FileText className="w-5 h-5" />,
    sourceType: 'old_quote',
  },
];

export function ImportCatalogModal({ isOpen, articles, onClose, onImport, onSuccess }: ImportCatalogModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedOption, setSelectedOption] = useState<ImportOption | null>(null);
  const [items, setItems] = useState<CatalogImportPreviewItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setSelectedOption(null);
    setItems([]);
    setWarnings([]);
    setIsAnalyzing(false);
    setIsSaving(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  const chooseFile = (option: ImportOption) => {
    setSelectedOption(option);
    setError(null);
    setWarnings([]);
    if (fileRef.current) {
      fileRef.current.accept = option.accept;
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedOption) return;
    setIsAnalyzing(true);
    setError(null);
    setWarnings([]);
    setItems([]);

    try {
      if (selectedOption.key === 'spreadsheet') {
        const parsedItems = await parseSpreadsheet(file, articles);
        setItems(parsedItems);
      } else {
        track('ai_extraction_started', {
          surface: 'catalog',
          ai_source: 'catalog_import',
          source: selectedOption.key,
          has_catalog: articles.length > 0,
        });
        const parsedItems = await analyzeWithAI(file, selectedOption);
        setItems(parsedItems.items);
        setWarnings(parsedItems.warnings);
        track('ai_extraction_succeeded', {
          surface: 'catalog',
          ai_source: 'catalog_import',
          source: selectedOption.key,
          line_count: parsedItems.items.length,
          has_catalog: articles.length > 0,
        });
      }
    } catch (err: any) {
      if (selectedOption.key !== 'spreadsheet') {
        const message = String(err?.message || '');
        track('ai_extraction_failed', {
          surface: 'catalog',
          ai_source: 'catalog_import',
          source: selectedOption.key,
          error_type: message.includes('quota') || message.includes('429') ? 'quota' : 'catalog_import_failed',
        });
        if (message.includes('quota') || message.includes('429')) {
          track('quota_limit_reached', {
            surface: 'catalog',
            quota_resource: 'ai',
          });
        }
      }
      setError(err.message || 'Impossible d’analyser ce fichier. Réessayez avec un document plus lisible.');
    } finally {
      setIsAnalyzing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleImport = async () => {
    const selected = items.filter(item => item.selected);
    if (selected.length === 0) {
      setError('Sélectionnez au moins une prestation à importer.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onImport(selected.map(item => ({
        ...previewItemToArticle(item, selectedOption?.key === 'spreadsheet' ? 'spreadsheet_import' : 'ai_import'),
        duplicateOfId: item.duplicateOfId,
        selected: item.selected,
      })));
      onSuccess(`${selected.length} prestation${selected.length > 1 ? 's' : ''} ajoutée${selected.length > 1 ? 's' : ''} à votre catalogue.`);
      close();
    } catch (err: any) {
      setError(err.message || 'Erreur pendant l’import du catalogue.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-[28px] bg-surface shadow-2xl border border-outline-variant/20 flex flex-col">
        <div className="p-5 md:p-6 border-b border-outline-variant/10 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-2">
              Catalogue intelligent
            </div>
            <h2 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface">
              Importer mes anciens prix
            </h2>
            <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
              Partez de vos fichiers, carnets ou anciens devis. Photofacto prépare une preview : vous vérifiez avant d’ajouter au catalogue.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="min-touch rounded-xl bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 md:p-6 overflow-y-auto">
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />

          {items.length === 0 && !isAnalyzing && (
            <div className="grid md:grid-cols-3 gap-3">
              {IMPORT_OPTIONS.map(option => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => chooseFile(option)}
                  className="group text-left rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm hover:-translate-y-1 hover:shadow-spark-md hover:border-primary/35 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    {option.icon}
                  </div>
                  <h3 className="font-headline font-extrabold text-on-surface mb-1">{option.title}</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{option.description}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">
                    Choisir un fichier
                    <Upload className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {isAnalyzing && (
            <div className="rounded-3xl border border-primary/15 bg-primary/5 p-8 md:p-12 flex flex-col items-center text-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <h3 className="font-headline font-extrabold text-xl text-on-surface">Analyse de vos anciens prix…</h3>
              <p className="text-sm text-on-surface-variant mt-2 max-w-lg">
                Photofacto extrait les prestations, unités, prix et TVA. Rien n’est ajouté au catalogue sans votre validation.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl bg-error/10 text-error p-4 flex items-start gap-3 font-bold text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setItems([]);
                }}
                className="inline-flex items-center gap-1 text-xs underline cursor-pointer"
              >
                Réessayer
              </button>
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-4">
              {warnings.length > 0 && (
                <div className="rounded-2xl bg-surface-container-high p-4 text-sm text-on-surface-variant">
                  <strong className="text-on-surface">Notes d’analyse :</strong> {warnings.join(' · ')}
                </div>
              )}
              <CatalogImportPreview items={items} onChange={setItems} />
            </div>
          )}
        </div>

        <div className="p-5 md:p-6 border-t border-outline-variant/10 flex flex-col sm:flex-row justify-between gap-3 bg-surface-container-lowest">
          <button
            type="button"
            onClick={() => {
              setItems([]);
              setWarnings([]);
              setError(null);
            }}
            className="min-touch inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface px-5 py-3 text-sm font-bold text-on-surface hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Recommencer
          </button>
          <button
            type="button"
            disabled={items.length === 0 || isSaving}
            onClick={handleImport}
            className="min-touch inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary shadow-spark-cta hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:transform-none transition-all cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Valider l’import
          </button>
        </div>
      </div>
    </div>
  );
}

async function parseSpreadsheet(file: File, existingArticles: Article[]): Promise<CatalogImportPreviewItem[]> {
  const XLSX = await loadXlsx();
  const data = new Uint8Array(await file.arrayBuffer());
  const workbook = XLSX.read(data, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

  const rawItems: RawCatalogImportItem[] = rows.map(row => {
    const keys = Object.keys(row);
    const descKey = keys.find(key => /desc|nom|art|prod|presta|libell/i.test(key));
    const unitKey = keys.find(key => /unit|unité|unite|u\.?$/i.test(key));
    const priceKey = keys.find(key => /prix|tarif|ht|amount|montant/i.test(key));
    const vatKey = keys.find(key => /tva|tax/i.test(key));
    const categoryKey = keys.find(key => /cat|famille|type/i.test(key));
    return {
      name: descKey ? row[descKey] : '',
      description: descKey ? row[descKey] : '',
      unit: unitKey ? row[unitKey] : '',
      priceHT: priceKey ? row[priceKey] : 0,
      vatRate: vatKey ? row[vatKey] : undefined,
      category: categoryKey ? row[categoryKey] : '',
      confidence: 0.95,
    };
  });

  const items = normalizeCatalogImportItems(rawItems, existingArticles);
  if (items.length === 0) {
    throw new Error('Aucune prestation trouvée. Vérifiez les colonnes description/prix.');
  }
  return items;
}

async function analyzeWithAI(file: File, option: ImportOption): Promise<{ items: CatalogImportPreviewItem[]; warnings: string[] }> {
  const current = auth.currentUser;
  if (!current) throw new Error('Session expirée. Veuillez vous reconnecter.');
  const token = await current.getIdToken();
  const base64Data = await fileToBase64(file);
  const sourceType = option.key === 'old_quote' && file.type === 'application/pdf' ? 'pdf' : option.sourceType;

  const response = await fetch('/api/catalog-import-ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      base64Data,
      sourceType,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Analyse impossible (${response.status}).`);
  }
  if (!Array.isArray(data?.items) || data.items.length === 0) {
    throw new Error('Aucune prestation exploitable détectée.');
  }
  return { items: data.items, warnings: Array.isArray(data.warnings) ? data.warnings : [] };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.readAsDataURL(file);
  });
}
