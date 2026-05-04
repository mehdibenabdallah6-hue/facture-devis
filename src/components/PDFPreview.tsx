import React from 'react';
import { Invoice, CompanySettings } from '../contexts/DataContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  getDocumentDateLabel,
  getDocumentDueDateLabel,
  getDocumentNumberLabel,
  getDocumentTitle,
  getDocumentTotalLabel,
  shouldShowDueDate,
  shouldShowPaymentDetails,
} from '../lib/documentLabels';

interface PDFPreviewProps {
  formData: Partial<Invoice>;
  company: CompanySettings | null;
}

const formatCurrency = (amount: number, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount || 0);

function getTemplate(company: CompanySettings | null) {
  return company?.pdfTemplate || 'moderne';
}

function getAccent(company: CompanySettings | null) {
  return company?.pdfAccentColor || (getTemplate(company) === 'chantier' ? '#F59E0B' : getTemplate(company) === 'classique' ? '#1F2937' : '#E8621A');
}

export default function PDFPreview({ formData, company }: PDFPreviewProps) {
  const items = formData.items || [];
  const visibleItems = items.filter(i => i.description).slice(0, 8);
  const hiddenItemsCount = Math.max(0, items.filter(i => i.description).length - visibleItems.length);
  const totalHT = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalVAT = formData.vatRegime === 'franchise' || formData.vatRegime === 'autoliquidation'
    ? 0
    : items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.vatRate / 100)), 0);
  const totalTTC = totalHT + totalVAT;
  const template = getTemplate(company);
  const accentColor = getAccent(company);
  const title = getDocumentTitle(formData.type, true);
  const numberLabel = getDocumentNumberLabel(formData.type);
  const dateLabel = getDocumentDateLabel(formData.type);
  const dueDateLabel = getDocumentDueDateLabel(formData.type);
  const signedDate = formData.signedAt
    ? format(new Date(formData.signedAt), 'dd MMM yyyy', { locale: fr })
    : null;

  const pageClass =
    template === 'classique'
      ? 'border-[1.5px] border-gray-900'
      : template === 'chantier'
        ? 'border border-amber-200'
        : 'border border-gray-200';

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden w-full">
      <div className="p-3 sm:p-4 bg-neutral-100 overflow-hidden flex items-start justify-center">
        <div className={`mx-auto w-full max-w-[520px] aspect-[210/297] bg-white overflow-hidden flex flex-col shadow-xl ${pageClass}`}>
          {template === 'moderne' && <div className="h-2.5 shrink-0" style={{ backgroundColor: accentColor }} />}
          {template === 'chantier' && (
            <div className="h-10 shrink-0 flex items-center px-4 text-[10px] font-black uppercase tracking-[0.22em] text-white" style={{ backgroundColor: accentColor }}>
              Document chantier
            </div>
          )}

          <div className="p-4 flex-1 min-h-0 flex flex-col">
            <header className={`shrink-0 flex justify-between gap-3 ${template === 'classique' ? 'border-b border-gray-900 pb-3 mb-4' : 'mb-4'}`}>
              <div className="min-w-0">
                {company?.logoUrl ? (
                  <img src={company.logoUrl} alt="Logo" className="h-9 max-w-[120px] object-contain mb-1" />
                ) : (
                  <div className="font-black text-gray-950 text-sm leading-tight">{company?.name || 'Mon Entreprise'}</div>
                )}
                {!company?.hideCompanyInfo && (
                  <div className="text-[9px] text-gray-500 leading-tight space-y-0.5">
                    {company?.address && <div className="line-clamp-2">{company.address}</div>}
                    {company?.siret && <div>SIRET: {company.siret}</div>}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-black leading-none" style={{ color: template === 'classique' ? '#111827' : accentColor }}>
                  {title}
                </div>
                <div className="text-[10px] font-bold text-gray-600 mt-1">
                  {numberLabel} : {formData.number || 'en attente'}
                </div>
                {formData.date && (
                  <div className="text-[9px] text-gray-500 mt-0.5">
                    {dateLabel} : {format(new Date(formData.date), 'dd MMM yyyy', { locale: fr })}
                  </div>
                )}
                {shouldShowDueDate(formData.type) && dueDateLabel && formData.dueDate && (
                  <div className="text-[9px] text-gray-500 mt-0.5">
                    {dueDateLabel} : {format(new Date(formData.dueDate), 'dd MMM yyyy', { locale: fr })}
                  </div>
                )}
              </div>
            </header>

            <section className={`shrink-0 rounded-lg p-2 mb-3 ${template === 'classique' ? 'border border-gray-300' : 'bg-gray-50'}`}>
              <div className="text-[8px] text-gray-500 uppercase tracking-widest mb-0.5">
                {formData.type === 'quote' ? 'Client' : formData.type === 'credit' ? 'Client crédité' : 'Facturé à'}
              </div>
              <div className="font-bold text-gray-950 text-xs truncate">{formData.clientName || '—'}</div>
            </section>

            {formData.type === 'credit' && formData.linkedInvoiceNumber && (
              <div className="shrink-0 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[9px] font-bold text-amber-900">
                Avoir lié à la facture {formData.linkedInvoiceNumber}
              </div>
            )}

            {visibleItems.length > 0 ? (
              <table className="w-full table-fixed text-[10px] shrink-0">
                <thead>
                  <tr className={`${template === 'classique' ? 'border-y border-gray-900 text-gray-950' : 'text-white'} uppercase tracking-wider`}>
                    <th className="py-1.5 px-1 text-left" style={{ backgroundColor: template === 'classique' ? 'transparent' : accentColor }}>Description</th>
                    <th className="py-1.5 px-1 text-center w-8" style={{ backgroundColor: template === 'classique' ? 'transparent' : accentColor }}>Qté</th>
                    <th className="py-1.5 px-1 text-right w-12" style={{ backgroundColor: template === 'classique' ? 'transparent' : accentColor }}>P.U.</th>
                    <th className="py-1.5 px-1 text-right w-14" style={{ backgroundColor: template === 'classique' ? 'transparent' : accentColor }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-1.5 pr-1 text-gray-900 leading-tight break-words">{item.description}</td>
                      <td className="py-1.5 text-center text-gray-600">{item.quantity}</td>
                      <td className="py-1.5 text-right text-gray-600 tabular-nums">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-1.5 text-right font-bold text-gray-950 tabular-nums">{formatCurrency(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="bg-gray-50 rounded-lg p-5 text-center mb-3 text-gray-400 text-xs">Ajoutez des prestations pour voir l’aperçu</div>
            )}

            {hiddenItemsCount > 0 && <div className="text-[9px] text-gray-500 mt-1">+ {hiddenItemsCount} ligne{hiddenItemsCount > 1 ? 's' : ''} dans le PDF complet</div>}

            <div className="mt-auto flex justify-end shrink-0 pt-2">
              <div className={`w-40 rounded-lg ${template === 'chantier' ? 'bg-amber-50 p-2' : ''}`}>
                <div className="flex justify-between py-0.5 text-[10px] text-gray-600"><span>Total HT</span><span>{formatCurrency(totalHT)}</span></div>
                {formData.vatRegime === 'standard' && totalVAT > 0 && <div className="flex justify-between py-0.5 text-[10px] text-gray-600"><span>TVA</span><span>{formatCurrency(totalVAT)}</span></div>}
                <div className="flex justify-between py-1 text-xs font-black border-t border-gray-300 mt-1" style={{ color: template === 'classique' ? '#111827' : accentColor }}>
                  <span>{getDocumentTotalLabel(formData.type)}</span><span>{formatCurrency(totalTTC)}</span>
                </div>
                {shouldShowPaymentDetails(formData.type) && formData.paymentMethod && (
                  <div className="pt-1 text-[9px] text-gray-500 text-right">Paiement : {formData.paymentMethod}</div>
                )}
              </div>
            </div>

            {(formData.notes || company?.pdfFooterText) && (
              <footer className="mt-2 pt-2 border-t border-gray-200 text-[9px] text-gray-500 leading-snug line-clamp-3 shrink-0">
                {formData.notes || company?.pdfFooterText}
              </footer>
            )}

            {formData.type === 'quote' && formData.signature && formData.signedByName && signedDate && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] text-emerald-900 shrink-0">
                <div className="font-black uppercase tracking-wider">Acceptation du devis</div>
                <div>Bon pour accord</div>
                <div>Signé par {formData.signedByName} le {signedDate}</div>
                <img src={formData.signature} alt="Signature" className="mt-1 h-8 max-w-[120px] object-contain opacity-80" />
              </div>
            )}
          </div>

          {template === 'moderne' && <div className="h-1.5 shrink-0" style={{ backgroundColor: accentColor }} />}
        </div>
      </div>
    </div>
  );
}
