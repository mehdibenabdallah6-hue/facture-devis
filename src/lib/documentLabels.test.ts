import { describe, expect, it } from 'vitest';
import {
  getDocumentDateLabel,
  getDocumentDueDateLabel,
  getDocumentNumberLabel,
  getDocumentTitle,
  getDocumentTotalLabel,
  getTypedStatusLabel,
  shouldShowDueDate,
  shouldShowPaymentDetails,
} from './documentLabels';

describe('documentLabels', () => {
  it('sépare clairement les libellés devis / facture / avoir', () => {
    expect(getDocumentTitle('quote')).toBe('Devis');
    expect(getDocumentTitle('invoice')).toBe('Facture');
    expect(getDocumentTitle('credit')).toBe('Avoir');

    expect(getDocumentNumberLabel('quote')).toBe('N° de devis');
    expect(getDocumentNumberLabel('invoice')).toBe('N° de facture');
    expect(getDocumentNumberLabel('credit')).toBe("N° d'avoir");

    expect(getDocumentDateLabel('quote')).toBe('Date du devis');
    expect(getDocumentDateLabel('invoice')).toBe("Date d'émission");
    expect(getDocumentDateLabel('credit')).toBe("Date de l'avoir");
  });

  it("utilise dueDate comme validité pour un devis, pas comme échéance d'avoir", () => {
    expect(getDocumentDueDateLabel('quote')).toBe("Valable jusqu'au");
    expect(getDocumentDueDateLabel('invoice')).toBe("Date d'échéance de paiement");
    expect(getDocumentDueDateLabel('credit')).toBeNull();

    expect(shouldShowDueDate('quote')).toBe(true);
    expect(shouldShowDueDate('invoice')).toBe(true);
    expect(shouldShowDueDate('credit')).toBe(false);
  });

  it('limite les détails de paiement aux factures', () => {
    expect(shouldShowPaymentDetails('invoice')).toBe(true);
    expect(shouldShowPaymentDetails('deposit')).toBe(true);
    expect(shouldShowPaymentDetails('quote')).toBe(false);
    expect(shouldShowPaymentDetails('credit')).toBe(false);
  });

  it('adapte les statuts au type de document', () => {
    expect(getTypedStatusLabel('quote', 'sent')).toBe("En attente d'acceptation");
    expect(getTypedStatusLabel('quote', 'accepted')).toBe('Accepté / signé');
    expect(getTypedStatusLabel('quote', 'converted')).toBe('Converti en facture');

    expect(getTypedStatusLabel('invoice', 'validated')).toBe('À payer');
    expect(getTypedStatusLabel('invoice', 'sent')).toBe('À payer');
    expect(getTypedStatusLabel('invoice', 'overdue')).toBe('En retard');

    expect(getTypedStatusLabel('credit', 'validated')).toBe('Avoir');
  });

  it('adapte le libellé du total', () => {
    expect(getDocumentTotalLabel('quote')).toBe('TOTAL ESTIMÉ');
    expect(getDocumentTotalLabel('invoice')).toBe('NET À PAYER');
    expect(getDocumentTotalLabel('credit')).toBe('TOTAL CRÉDIT');
  });
});
