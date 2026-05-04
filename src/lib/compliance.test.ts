import { describe, expect, it } from 'vitest';
import type { Client, CompanySettings, Invoice } from '../contexts/DataContext';
import { checkInvoiceCompliance } from './compliance';

const company: CompanySettings = {
  ownerId: 'uid',
  name: 'Artisan Test',
  address: '1 rue du Test, 75000 Paris',
  siret: '12345678901234',
  vatNumber: 'FR12345678901',
  vatRegime: 'standard',
  profession: 'plombier',
  defaultPaymentTerms: 30,
  decennale: 'Police décennale',
  rcPro: 'Police RC Pro',
};

const b2bClient: Client = {
  id: 'client_1',
  ownerId: 'uid',
  type: 'B2B',
  name: 'Client Pro',
  siren: '123456789',
};

const baseInvoice: Invoice = {
  id: 'invoice_1',
  ownerId: 'uid',
  type: 'invoice',
  clientId: b2bClient.id,
  clientName: b2bClient.name,
  number: '',
  date: '2026-05-04',
  dueDate: '2026-06-03',
  status: 'draft',
  vatRegime: 'standard',
  items: [{ description: 'Main-d’œuvre', quantity: 1, unitPrice: 100, vatRate: 20 }],
  totalHT: 100,
  totalVAT: 20,
  totalTTC: 120,
  notes: "En cas de retard de paiement, des pénalités seront appliquées.\nIndemnité forfaitaire pour frais de recouvrement de 40 €.",
};

describe('checkInvoiceCompliance document types', () => {
  it("ne demande pas d'échéance de paiement pour un devis", () => {
    const quote: Invoice = {
      ...baseInvoice,
      type: 'quote',
      dueDate: '',
      notes: '',
    };

    const report = checkInvoiceCompliance(quote, company, b2bClient);

    expect(report.issues.some(issue => issue.code === 'invoice.dueDate')).toBe(false);
    expect(report.issues.some(issue => issue.code === 'quote.validity')).toBe(true);
  });

  it("accepte la date de validité d'un devis via dueDate", () => {
    const quote: Invoice = {
      ...baseInvoice,
      type: 'quote',
      dueDate: '2026-06-04',
      notes: '',
    };

    const report = checkInvoiceCompliance(quote, company, b2bClient);

    expect(report.issues.some(issue => issue.code === 'quote.validity')).toBe(false);
  });

  it("ne demande pas de mentions de paiement classiques pour un avoir", () => {
    const credit: Invoice = {
      ...baseInvoice,
      type: 'credit',
      dueDate: '',
      linkedInvoiceId: 'invoice_source',
      linkedInvoiceNumber: 'F-2026-0001',
      items: [{ description: 'Avoir main-d’œuvre', quantity: -1, unitPrice: 100, vatRate: 20 }],
      totalHT: -100,
      totalVAT: -20,
      totalTTC: -120,
      notes: '',
    };

    const report = checkInvoiceCompliance(credit, company, b2bClient);

    expect(report.issues.some(issue => issue.code === 'invoice.dueDate')).toBe(false);
    expect(report.issues.some(issue => issue.code === 'mention.latePenalties')).toBe(false);
    expect(report.issues.some(issue => issue.code === 'mention.indemnity40')).toBe(false);
    expect(report.issues.some(issue => issue.code === 'credit.linkedInvoice')).toBe(false);
  });
});
