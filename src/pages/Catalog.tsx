import React, { useState, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import {
  Package,
  Sparkles,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  Lightbulb,
} from 'lucide-react';
import * as XLSX from 'xlsx';

/**
 * Catalogue page — top-level (was previously a section inside Settings).
 *
 * Goal: get a tradesman to ADD A FEW PRICES as fast as possible so the AI
 * can recognise their products in voice/photo flows. Three on-ramps:
 *
 *  1. Hero + value prop      → why this exists
 *  2. Quick add (3 fields)   → fastest path, no Excel needed
 *  3. Excel/CSV import       → for migrating an existing price list
 *
 * Table below = full CRUD on what's already saved.
 */
export default function Catalog() {
  const { articles, addArticle, updateArticle, deleteArticle, importCatalog } = useData();

  const catalogRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success?: string; error?: string } | null>(null);

  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editArticleData, setEditArticleData] = useState<Partial<any>>({});

  const [newArticleData, setNewArticleData] = useState({ description: '', unitPrice: 0, vatRate: 20 });
  const [quickAddBusy, setQuickAddBusy] = useState(false);
  const [quickAddOk, setQuickAddOk] = useState(false);

  const [search, setSearch] = useState('');

  const handleCatalogImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        const validItems: { description: string; unitPrice: number; vatRate: number }[] = [];
        for (const row of json) {
          const keys = Object.keys(row);
          const descKey = keys.find(
            k =>
              k.toLowerCase().includes('desc') ||
              k.toLowerCase().includes('nom') ||
              k.toLowerCase().includes('art') ||
              k.toLowerCase().includes('prod'),
          );
          const priceKey = keys.find(
            k =>
              k.toLowerCase().includes('prix') ||
              k.toLowerCase().includes('tarif') ||
              k.toLowerCase().includes('ht') ||
              k.toLowerCase().includes('amount'),
          );
          const vatKey = keys.find(
            k => k.toLowerCase().includes('tva') || k.toLowerCase().includes('tax'),
          );

          if (descKey && row[descKey]) {
            validItems.push({
              description: String(row[descKey]),
              unitPrice: priceKey ? parseFloat(String(row[priceKey]).replace(',', '.')) || 0 : 0,
              vatRate: vatKey ? parseFloat(String(row[vatKey]).replace(',', '.')) || 20 : 20,
            });
          }
        }

        if (validItems.length > 0) {
          await importCatalog(validItems);
          setImportResult({ success: `${validItems.length} articles importés avec succès !` });
        } else {
          setImportResult({
            error: 'Aucun article trouvé. Vérifiez les colonnes (Description, Prix).',
          });
        }
      } catch (err) {
        setImportResult({ error: 'Erreur lors de la lecture du fichier.' });
      } finally {
        setIsImporting(false);
        if (catalogRef.current) catalogRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArticleData.description.trim()) return;
    setQuickAddBusy(true);
    try {
      await addArticle(newArticleData as any);
      setNewArticleData({ description: '', unitPrice: 0, vatRate: 20 });
      setQuickAddOk(true);
      setTimeout(() => setQuickAddOk(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setQuickAddBusy(false);
    }
  };

  const handleUpdateArticle = async (id: string) => {
    try {
      await updateArticle(id, editArticleData);
      setEditingArticleId(null);
      setEditArticleData({});
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditArticle = (article: any) => {
    setEditingArticleId(article.id);
    setEditArticleData({
      description: article.description,
      unitPrice: article.unitPrice,
      vatRate: article.vatRate,
    });
  };

  const handleDeleteArticle = async (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer cet article de votre catalogue ?')) {
      await deleteArticle(id);
    }
  };

  const filteredArticles = search.trim()
    ? articles.filter(a => a.description.toLowerCase().includes(search.toLowerCase()))
    : articles;

  const isEmpty = articles.length === 0;

  return (
    <div className="space-y-5 md:space-y-8 max-w-5xl mx-auto min-w-0 w-full">
      {/* Hero */}
      <header className="animate-fade-in-up min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-primary">
            Catalogue produits
          </span>
        </div>
        <h1 className="font-headline text-[26px] md:text-4xl font-extrabold text-on-surface tracking-tight mb-2 leading-tight">
          Ajoutez vos prix pour que l'IA génère automatiquement vos factures.
        </h1>
        <p className="text-on-surface-variant font-medium text-sm md:text-lg leading-snug max-w-3xl">
          Quand vous dictez ou photographiez un chantier, Photofacto retrouve vos tarifs
          exacts dans votre catalogue — plus besoin de retaper les prix.
        </p>
      </header>

      {/* Empty state nudge */}
      {isEmpty && (
        <div className="animate-fade-in-up animation-delay-100 bg-amber-50 border-2 border-amber-200 p-4 md:p-5 rounded-2xl flex items-start gap-3">
          <Lightbulb className="w-5 h-5 md:w-6 md:h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-amber-900 text-sm md:text-base mb-1">
              Votre catalogue est vide.
            </p>
            <p className="text-amber-800 text-sm">
              Ajoutez 5 ou 10 prix pour démarrer — l'IA pourra ensuite reconnaître vos
              prestations dès que vous dictez "Pose chauffe-eau" ou "20 m² de carrelage".
            </p>
          </div>
        </div>
      )}

      {/* Two on-ramps */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 animate-fade-in-up animation-delay-200">
        {/* Quick add */}
        <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 md:p-7 shadow-sm">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-extrabold font-headline text-on-surface leading-tight">
                Ajout rapide
              </h2>
              <p className="text-xs md:text-sm text-on-surface-variant font-medium">
                Description + prix + TVA. C'est tout.
              </p>
            </div>
          </div>

          <form onSubmit={handleQuickAdd} className="mt-4 space-y-3">
            <input
              type="text"
              placeholder='Ex : "Pose chauffe-eau 200 L"'
              value={newArticleData.description}
              onChange={e =>
                setNewArticleData({ ...newArticleData, description: e.target.value })
              }
              className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                  Prix HT (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newArticleData.unitPrice || ''}
                  onChange={e =>
                    setNewArticleData({
                      ...newArticleData,
                      unitPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">
                  TVA (%)
                </label>
                <select
                  value={newArticleData.vatRate}
                  onChange={e =>
                    setNewArticleData({
                      ...newArticleData,
                      vatRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                >
                  <option value="20">20%</option>
                  <option value="10">10%</option>
                  <option value="5.5">5.5%</option>
                  <option value="0">0%</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={quickAddBusy || !newArticleData.description.trim()}
              className="btn-glow min-touch w-full bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm shadow-spark-cta hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2"
            >
              {quickAddOk ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Ajouté !
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {quickAddBusy ? 'Ajout...' : 'Ajouter au catalogue'}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Import */}
        <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-5 md:p-7 shadow-sm">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-extrabold font-headline text-on-surface leading-tight">
                Importez votre ancien catalogue en 1 clic
              </h2>
              <p className="text-xs md:text-sm text-on-surface-variant font-medium">
                Excel ou CSV — colonnes "Description" et "Prix" suffisent.
              </p>
            </div>
          </div>

          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            ref={catalogRef}
            onChange={handleCatalogImport}
          />
          <button
            type="button"
            disabled={isImporting}
            onClick={() => catalogRef.current?.click()}
            className="mt-4 min-touch w-full border-2 border-dashed border-secondary/30 hover:border-secondary bg-secondary/5 hover:bg-secondary/10 rounded-2xl p-5 md:p-6 flex flex-col items-center justify-center gap-2 transition-colors text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-7 h-7" />
            <div className="text-center">
              <p className="font-bold text-sm">
                {isImporting ? 'Importation en cours...' : 'Choisir un fichier'}
              </p>
              <p className="text-xs opacity-80 font-medium">.xlsx, .xls, .csv</p>
            </div>
          </button>

          {importResult?.success && (
            <div className="mt-3 p-3 bg-tertiary/10 text-tertiary rounded-xl text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              {importResult.success}
            </div>
          )}
          {importResult?.error && (
            <div className="mt-3 p-3 bg-error/10 text-error rounded-xl text-sm font-bold flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              {importResult.error}
            </div>
          )}

          <p className="mt-3 text-[11px] text-on-surface-variant">
            <strong>Bientôt :</strong> import direct depuis un PDF de tarif.
          </p>
        </div>
      </section>

      {/* "How it works" pill */}
      <div className="animate-fade-in-up animation-delay-300 bg-primary/5 border border-primary/15 rounded-2xl p-4 md:p-5 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-on-surface">
          <p className="font-bold mb-1">Comment l'IA utilise votre catalogue</p>
          <p className="text-on-surface-variant">
            Dictez{' '}
            <span className="italic bg-surface-container-highest px-1.5 py-0.5 rounded">
              "Ajoute pose chauffe-eau"
            </span>{' '}
            — Photofacto retrouve dans votre catalogue le prix HT et la TVA exacts. Pas
            besoin de répéter les montants.
          </p>
        </div>
      </div>

      {/* List */}
      <section className="animate-fade-in-up animation-delay-300 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg md:text-xl font-extrabold font-headline text-on-surface flex items-center gap-2">
            Vos articles
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
              {articles.length}
            </span>
          </h2>
          {articles.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Rechercher un article..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-surface-container-high border-none rounded-xl pl-9 pr-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>

        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-surface-container border-b border-outline-variant/10 text-on-surface-variant font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4">Description</th>
                <th className="p-4 w-28">Prix HT (€)</th>
                <th className="p-4 w-24">TVA (%)</th>
                <th className="p-4 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 md:p-10 text-center text-on-surface-variant text-sm">
                    {isEmpty
                      ? 'Aucun article. Utilisez "Ajout rapide" ou "Importer" ci-dessus.'
                      : 'Aucun résultat pour cette recherche.'}
                  </td>
                </tr>
              ) : (
                filteredArticles.map(article => (
                  <tr key={article.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="p-3">
                      {editingArticleId === article.id ? (
                        <input
                          type="text"
                          value={editArticleData.description ?? ''}
                          onChange={e =>
                            setEditArticleData({
                              ...editArticleData,
                              description: e.target.value,
                            })
                          }
                          className="w-full bg-surface-container-high rounded-lg px-3 py-1.5 text-sm border-none focus:ring-1 focus:ring-primary"
                        />
                      ) : (
                        <span className="font-medium text-on-surface">{article.description}</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {editingArticleId === article.id ? (
                        <input
                          type="number"
                          value={editArticleData.unitPrice ?? 0}
                          onChange={e =>
                            setEditArticleData({
                              ...editArticleData,
                              unitPrice: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-surface-container-high rounded-lg px-2 py-1.5 text-sm border-none focus:ring-1 focus:ring-primary text-right"
                        />
                      ) : (
                        <span className="text-on-surface-variant font-mono">
                          {Number(article.unitPrice).toFixed(2)} €
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {editingArticleId === article.id ? (
                        <input
                          type="number"
                          value={editArticleData.vatRate ?? 20}
                          onChange={e =>
                            setEditArticleData({
                              ...editArticleData,
                              vatRate: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-surface-container-high rounded-lg px-2 py-1.5 text-sm border-none focus:ring-1 focus:ring-primary text-right"
                        />
                      ) : (
                        <span className="text-on-surface-variant">{article.vatRate || 0}%</span>
                      )}
                    </td>
                    <td className="p-3 flex justify-end gap-2">
                      {editingArticleId === article.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateArticle(article.id)}
                            className="min-touch bg-tertiary/10 text-tertiary hover:bg-tertiary/20 rounded-lg transition-colors flex items-center justify-center"
                            aria-label="Enregistrer"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingArticleId(null)}
                            className="min-touch bg-surface-container-high text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors flex items-center justify-center"
                            aria-label="Annuler"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditArticle(article)}
                            className="min-touch bg-surface-container text-on-surface-variant hover:text-on-surface rounded-lg transition-colors flex items-center justify-center"
                            aria-label="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteArticle(article.id)}
                            className="min-touch bg-error/5 text-error/70 hover:text-error hover:bg-error/10 rounded-lg transition-colors flex items-center justify-center"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
