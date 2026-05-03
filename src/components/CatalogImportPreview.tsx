import React from 'react';
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type { CatalogImportPreviewItem } from '../lib/catalogImport';

interface CatalogImportPreviewProps {
  items: CatalogImportPreviewItem[];
  onChange: (items: CatalogImportPreviewItem[]) => void;
}

const UNIT_OPTIONS = ['unité', 'heure', 'm²', 'forfait', 'mètre linéaire', 'mètre'];
const VAT_OPTIONS = [20, 10, 5.5, 2.1, 0];

export function CatalogImportPreview({ items, onChange }: CatalogImportPreviewProps) {
  const updateItem = (id: string, patch: Partial<CatalogImportPreviewItem>) => {
    onChange(items.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  const addLine = () => {
    const id = `manual_${Date.now()}`;
    onChange([
      ...items,
      {
        id,
        name: 'Nouvelle prestation',
        description: 'Nouvelle prestation',
        unit: 'unité',
        priceHT: 0,
        vatRate: 20,
        category: '',
        notes: '',
        confidence: 1,
        needsReview: true,
        selected: true,
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Vérifiez les noms, unités et prix avant import. Les doublons probables sont décochés par défaut.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/15 bg-surface-container-lowest">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-surface-container text-xs uppercase tracking-wider text-on-surface-variant">
            <tr>
              <th className="p-3 text-left w-12">OK</th>
              <th className="p-3 text-left">Prestation</th>
              <th className="p-3 text-left w-32">Unité</th>
              <th className="p-3 text-left w-32">Prix HT</th>
              <th className="p-3 text-left w-28">TVA</th>
              <th className="p-3 text-left w-36">Catégorie</th>
              <th className="p-3 text-left w-48">Statut</th>
              <th className="p-3 text-right w-16">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {items.map(item => (
              <tr
                key={item.id}
                className={`transition-colors ${item.needsReview ? 'bg-amber-50/55' : 'bg-white'} ${item.duplicateOfId ? 'opacity-85' : ''}`}
              >
                <td className="p-3 align-top">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={event => updateItem(item.id, { selected: event.target.checked })}
                    className="w-4 h-4 accent-primary cursor-pointer"
                    aria-label="Importer cette ligne"
                  />
                </td>
                <td className="p-3 align-top">
                  <input
                    type="text"
                    value={item.description}
                    onChange={event => updateItem(item.id, {
                      description: event.target.value,
                      name: event.target.value,
                    })}
                    className="w-full min-w-[220px] rounded-xl bg-surface-container-high px-3 py-2 border-none focus:ring-2 focus:ring-primary/20 font-medium"
                  />
                  <input
                    type="text"
                    value={item.notes}
                    onChange={event => updateItem(item.id, { notes: event.target.value })}
                    placeholder="Notes optionnelles"
                    className="mt-2 w-full min-w-[220px] rounded-xl bg-surface-container px-3 py-2 border-none focus:ring-2 focus:ring-primary/20 text-xs text-on-surface-variant"
                  />
                </td>
                <td className="p-3 align-top">
                  <select
                    value={item.unit}
                    onChange={event => updateItem(item.id, { unit: event.target.value })}
                    className="w-full rounded-xl bg-surface-container-high px-3 py-2 border-none focus:ring-2 focus:ring-primary/20"
                  >
                    {UNIT_OPTIONS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </td>
                <td className="p-3 align-top">
                  <input
                    type="number"
                    step="0.01"
                    value={item.priceHT || ''}
                    onChange={event => {
                      const priceHT = Number.parseFloat(event.target.value) || 0;
                      updateItem(item.id, {
                        priceHT,
                        needsReview: priceHT <= 0 || item.confidence < 0.75,
                      });
                    }}
                    className="w-full rounded-xl bg-surface-container-high px-3 py-2 border-none focus:ring-2 focus:ring-primary/20 text-right"
                  />
                </td>
                <td className="p-3 align-top">
                  <select
                    value={item.vatRate}
                    onChange={event => updateItem(item.id, { vatRate: Number.parseFloat(event.target.value) || 0 })}
                    className="w-full rounded-xl bg-surface-container-high px-3 py-2 border-none focus:ring-2 focus:ring-primary/20"
                  >
                    {VAT_OPTIONS.map(vat => <option key={vat} value={vat}>{vat}%</option>)}
                  </select>
                </td>
                <td className="p-3 align-top">
                  <input
                    type="text"
                    value={item.category}
                    onChange={event => updateItem(item.id, { category: event.target.value })}
                    placeholder="Catégorie"
                    className="w-full rounded-xl bg-surface-container-high px-3 py-2 border-none focus:ring-2 focus:ring-primary/20"
                  />
                </td>
                <td className="p-3 align-top">
                  <div className="flex flex-wrap gap-1.5">
                    {item.duplicateOfId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-1 text-[10px] font-bold text-on-surface-variant">
                        Doublon probable
                      </span>
                    )}
                    {item.needsReview && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                        À vérifier
                      </span>
                    )}
                    {!item.needsReview && !item.duplicateOfId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-tertiary/10 px-2 py-1 text-[10px] font-bold text-tertiary">
                        <CheckCircle2 className="w-3 h-3" />
                        Prêt
                      </span>
                    )}
                    <span className="inline-flex rounded-full bg-secondary/10 px-2 py-1 text-[10px] font-bold text-secondary">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>
                  {item.duplicateReason && (
                    <p className="mt-1 text-[11px] text-on-surface-variant">{item.duplicateReason}</p>
                  )}
                </td>
                <td className="p-3 align-top text-right">
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="min-touch inline-flex items-center justify-center rounded-xl bg-error/5 text-error/75 hover:bg-error/10 hover:text-error hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer"
                    aria-label="Supprimer cette ligne"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addLine}
        className="min-touch inline-flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-2.5 text-sm font-bold text-on-surface hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Ajouter une ligne
      </button>
    </div>
  );
}
