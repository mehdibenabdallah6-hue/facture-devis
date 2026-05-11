import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateInvoicePdfAttachment } from '../../api/_lib/invoicePdf';

describe('api/_lib/invoicePdf', () => {
  it('génère une pièce jointe PDF base64 depuis les données Firestore', async () => {
    const attachment = await generateInvoicePdfAttachment({
      invoice: {
        type: 'invoice',
        number: 'F-2026-001',
        date: '2026-05-11',
        dueDate: '2026-06-10',
        clientName: 'Client Test',
        clientEmail: 'client@example.fr',
        totalHT: 1062.5,
        totalTVA: 212.5,
        totalTTC: 1275,
        items: [
          { description: 'Pose meuble vasque', quantity: 1, unitPrice: 1062.5, vatRate: 20 },
        ],
      },
      company: {
        name: 'Nom Artisan',
        email: 'artisan@example.fr',
        phone: '0600000000',
        siret: '12345678900010',
        address: '12 rue des Artisans, 75000 Paris',
      },
    });

    expect(attachment.filename).toBe('Facture_F-2026-001.pdf');
    expect(attachment.content).toMatch(/^[A-Za-z0-9+/=]+$/);

    const bytes = Buffer.from(attachment.content, 'base64');
    expect(bytes.subarray(0, 5).toString('utf8')).toBe('%PDF-');

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });
});
