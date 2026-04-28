import React from 'react';
import { Invoice, CompanySettings } from '../contexts/DataContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PDFPreviewProps {
  formData: Partial<Invoice>;
  company: CompanySettings | null;
}

const formatCurrency = (amount: number, currency = 'EUR') => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
};

export default function PDFPreview({ formData, company }: PDFPreviewProps) {
  const items = formData.items || [];
  const totalHT = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalVAT = formData.vatRegime === 'franchise'
    ? 0
    : items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.vatRate / 100)), 0);
  const totalTTC = totalHT + totalVAT;

  const accentColor = company?.pdfAccentColor || '#6750A4';
  const visibleItems = items.filter(i => i.description).slice(0, 7);
  const hiddenItemsCount = Math.max(0, items.filter(i => i.description).length - visibleItems.length);

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden w-full h-full min-h-0 flex">
      {/* PDF Content */}
      <div className="p-2 sm:p-3 bg-white overflow-hidden flex-1 min-h-0 flex items-center justify-center">
        <div className="border border-gray-200 rounded-lg overflow-hidden mx-auto h-full max-h-full aspect-[210/297] max-w-full bg-white flex flex-col">
          {/* Header band */}
          <div className="h-2 shrink-0 relative" style={{ backgroundColor: accentColor }} />

          <div className="p-3 xl:p-4 flex-1 min-h-0 flex flex-col">
            {/* Company header */}
            <div className="flex justify-between items-start gap-2 mb-3 min-w-0 shrink-0">
              <div className="min-w-0">
                {company?.logoUrl ? (
                  <img src={company.logoUrl} alt="Logo" className="h-8 mb-1 rounded object-contain" />
                ) : (
                  <div className="font-bold text-gray-900 text-sm xl:text-base">{company?.name || 'Mon Entreprise'}</div>
                )}
                {!company?.hideCompanyInfo && (
                  <div className="text-[9px] xl:text-[10px] text-gray-500 mt-1 space-y-0.5 break-words leading-tight">
                    {company?.address && <div>{company.address}</div>}
                    {company?.siret && <div>SIRET: {company.siret}</div>}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-base xl:text-lg font-bold leading-tight" style={{ color: accentColor }}>
                  {formData.type === 'quote' ? 'DEVIS' : formData.type === 'deposit' ? 'FACTURE D\'ACOMPTE' : formData.type === 'credit' ? 'AVOIR' : 'FACTURE'}
                </div>
                <div className="text-[10px] xl:text-xs text-gray-600 mt-0.5">{formData.number || 'N° en attente'}</div>
                {formData.date && <div className="text-[9px] xl:text-[10px] text-gray-500 mt-0.5">{format(new Date(formData.date), 'dd MMM yyyy', { locale: fr })}</div>}
              </div>
            </div>

            {/* Client */}
            <div className="bg-gray-50 rounded-lg p-2 mb-3 shrink-0">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Facturé à</div>
              <div className="font-semibold text-gray-900 text-xs xl:text-sm truncate">{formData.clientName || '—'}</div>
            </div>

            {/* Items table */}
            {items.length > 0 && items[0].description ? (
              <table className="w-full table-fixed mb-2 text-xs shrink-0">
                <thead>
                  <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="pb-1.5">Description</th>
                    <th className="pb-1.5 text-center w-9">Qté</th>
                    <th className="pb-1.5 text-right w-14">P.U.</th>
                    <th className="pb-1.5 text-right w-14">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-1 pr-2 text-gray-900 text-[10px] xl:text-[11px] leading-tight break-words">{item.description}</td>
                      <td className="py-1 text-center text-gray-600 text-[10px]">{item.quantity}</td>
                      <td className="py-1 text-right text-gray-600 text-[9px] xl:text-[10px] tabular-nums">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-1 text-right font-medium text-gray-900 text-[9px] xl:text-[10px] tabular-nums">{formatCurrency(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center mb-4">
                <div className="text-gray-400 text-xs">Ajoutez des prestations pour voir l'aperçu</div>
              </div>
            )}
            {hiddenItemsCount > 0 && (
              <div className="text-[9px] text-gray-500 mb-1 shrink-0">
                + {hiddenItemsCount} ligne{hiddenItemsCount > 1 ? 's' : ''} dans le PDF complet
              </div>
            )}

            {/* Totals */}
            {totalHT > 0 && (
              <div className="flex justify-end mt-auto shrink-0">
                <div className="w-40">
                  <div className="flex justify-between py-0.5 text-[10px] xl:text-xs text-gray-600">
                    <span>Total HT</span>
                    <span>{formatCurrency(totalHT)}</span>
                  </div>
                  {formData.vatRegime !== 'franchise' && totalVAT > 0 && (
                    <div className="flex justify-between py-0.5 text-[10px] xl:text-xs text-gray-600 border-b border-gray-200">
                      <span>TVA</span>
                      <span>{formatCurrency(totalVAT)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 text-xs xl:text-sm font-bold border-t border-gray-300 mt-1" style={{ color: accentColor }}>
                    <span>Total TTC</span>
                    <span>{formatCurrency(totalTTC)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {formData.notes && (
              <div className="mt-2 pt-2 border-t border-gray-200 shrink-0">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Notes</div>
                <div className="text-[9px] xl:text-[10px] text-gray-600 leading-snug line-clamp-3">{formData.notes}</div>
              </div>
            )}
          </div>

          {/* Footer band */}
          <div className="h-1.5 shrink-0" style={{ backgroundColor: accentColor }} />
        </div>
      </div>
    </div>
  );
}
