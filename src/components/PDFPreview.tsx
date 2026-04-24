import React from 'react';
import { Invoice, InvoiceItem, CompanySettings } from '../contexts/DataContext';
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

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
      {/* PDF Content */}
      <div className="p-3 bg-white">
        <div className="border border-gray-200 rounded-lg overflow-hidden mx-auto" style={{ maxWidth: '100%' }}>
          {/* Header band */}
          <div className="h-3 relative" style={{ backgroundColor: accentColor }} />

          <div className="p-5">
            {/* Company header */}
            <div className="flex justify-between items-start mb-5">
              <div>
                {company?.logoUrl ? (
                  <img src={company.logoUrl} alt="Logo" className="h-10 mb-2 rounded" />
                ) : (
                  <div className="font-bold text-gray-900 text-lg">{company?.name || 'Mon Entreprise'}</div>
                )}
                {!company?.hideCompanyInfo && (
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    {company?.address && <div>{company.address}</div>}
                    {company?.siret && <div>SIRET: {company.siret}</div>}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className="text-xl font-bold" style={{ color: accentColor }}>
                  {formData.type === 'quote' ? 'DEVIS' : formData.type === 'deposit' ? 'FACTURE D\'ACOMPTE' : formData.type === 'credit' ? 'AVOIR' : 'FACTURE'}
                </div>
                <div className="text-sm text-gray-600 mt-1">{formData.number || 'N° en attente'}</div>
                {formData.date && <div className="text-xs text-gray-500 mt-0.5">{format(new Date(formData.date), 'dd MMMM yyyy', { locale: fr })}</div>}
              </div>
            </div>

            {/* Client */}
            <div className="bg-gray-50 rounded-lg p-3 mb-5">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Facturé à</div>
              <div className="font-semibold text-gray-900 text-sm">{formData.clientName || '—'}</div>
            </div>

            {/* Items table */}
            {items.length > 0 && items[0].description ? (
              <table className="w-full mb-4 text-sm">
                <thead>
                  <tr className="text-left text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="pb-2">Description</th>
                    <th className="pb-2 text-center w-12">Qté</th>
                    <th className="pb-2 text-right w-20">P.U. HT</th>
                    <th className="pb-2 text-right w-20">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {items.filter(i => i.description).map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-1.5 text-gray-900 text-xs">{item.description}</td>
                      <td className="py-1.5 text-center text-gray-600 text-xs">{item.quantity}</td>
                      <td className="py-1.5 text-right text-gray-600 text-xs">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-1.5 text-right font-medium text-gray-900 text-xs">{formatCurrency(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="bg-gray-50 rounded-lg p-6 text-center mb-4">
                <div className="text-gray-400 text-xs">Ajoutez des prestations pour voir l'aperçu</div>
              </div>
            )}

            {/* Totals */}
            {totalHT > 0 && (
              <div className="flex justify-end">
                <div className="w-44">
                  <div className="flex justify-between py-1 text-xs text-gray-600">
                    <span>Total HT</span>
                    <span>{formatCurrency(totalHT)}</span>
                  </div>
                  {formData.vatRegime !== 'franchise' && totalVAT > 0 && (
                    <div className="flex justify-between py-1 text-xs text-gray-600 border-b border-gray-200">
                      <span>TVA</span>
                      <span>{formatCurrency(totalVAT)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 text-sm font-bold border-t border-gray-300 mt-1" style={{ color: accentColor }}>
                    <span>Total TTC</span>
                    <span>{formatCurrency(totalTTC)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {formData.notes && (
              <div className="mt-5 pt-3 border-t border-gray-200">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Notes</div>
                <div className="text-xs text-gray-600 leading-relaxed">{formData.notes}</div>
              </div>
            )}
          </div>

          {/* Footer band */}
          <div className="h-2" style={{ backgroundColor: accentColor }} />
        </div>
      </div>
    </div>
  );
}
