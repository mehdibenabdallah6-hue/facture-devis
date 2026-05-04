import type { Invoice } from '../contexts/DataContext';

type DocumentType = Invoice['type'] | undefined;
type DocumentStatus = Invoice['status'] | undefined;

export function getDocumentTitle(type: DocumentType, uppercase = false): string {
  const title =
    type === 'quote'
      ? 'Devis'
      : type === 'credit'
        ? 'Avoir'
        : type === 'deposit'
          ? "Facture d'acompte"
          : 'Facture';
  return uppercase ? title.toUpperCase() : title;
}

export function getDocumentNumberLabel(type: DocumentType): string {
  if (type === 'quote') return 'N° de devis';
  if (type === 'credit') return "N° d'avoir";
  return 'N° de facture';
}

export function getDocumentDateLabel(type: DocumentType): string {
  if (type === 'quote') return 'Date du devis';
  if (type === 'credit') return "Date de l'avoir";
  return "Date d'émission";
}

export function getDocumentDueDateLabel(type: DocumentType): string | null {
  if (type === 'quote') return "Valable jusqu'au";
  if (type === 'credit') return null;
  return "Date d'échéance de paiement";
}

export function shouldShowDueDate(type: DocumentType): boolean {
  return type !== 'credit';
}

export function shouldShowPaymentDetails(type: DocumentType): boolean {
  return type !== 'quote' && type !== 'credit';
}

export function getDocumentTotalLabel(type: DocumentType): string {
  if (type === 'quote') return 'TOTAL ESTIMÉ';
  if (type === 'credit') return 'TOTAL CRÉDIT';
  return 'NET À PAYER';
}

export function getTypedStatusLabel(
  type: DocumentType,
  status: DocumentStatus,
  effectiveStatus: DocumentStatus = status
): string {
  if (type === 'credit') return 'Avoir';

  if (type === 'quote') {
    switch (status) {
      case 'sent':
      case 'validated':
        return "En attente d'acceptation";
      case 'accepted':
        return 'Accepté / signé';
      case 'converted':
        return 'Converti en facture';
      case 'cancelled':
        return 'Annulé';
      case 'draft':
      default:
        return 'Brouillon';
    }
  }

  switch (effectiveStatus) {
    case 'paid':
      return 'Payée';
    case 'sent':
    case 'validated':
      return 'À payer';
    case 'overdue':
      return 'En retard';
    case 'cancelled':
      return 'Annulée';
    case 'draft':
    default:
      return 'Brouillon';
  }
}
