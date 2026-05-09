import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Client, CompanySettings, Invoice } from '../src/contexts/DataContext';
import { generateFacturXPDF, generateFacturXXML } from '../src/services/facturx';

const outputDir = resolve(process.cwd(), process.argv[2] || 'tests/fixtures/facturx');
const iccProfileBytes = readFileSync(resolve(process.cwd(), 'public/color/sRGB2014.icc'));
const fontBytes = readFileSync(resolve(process.cwd(), 'public/fonts/NotoSans-Regular.ttf'));
const emptyPdf = { output: () => new ArrayBuffer(0) };

const company: CompanySettings = {
  ownerId: 'fixture_user',
  name: 'Artisan Test',
  address: '12 rue Artisan, 75001 Paris',
  email: 'contact@artisan.test',
  siret: '12345678900012',
  vatNumber: 'FR12345678901',
  vatRegime: 'standard',
  defaultCurrency: 'EUR',
};

const client: Client = {
  id: 'fixture_client',
  ownerId: 'fixture_user',
  type: 'B2B',
  name: 'Client B2B',
  address: '4 avenue Client, 69002 Lyon',
  email: 'factures@client.test',
  siren: '987654321',
  vatNumber: 'FR98765432100',
};

async function writeFixture(name: string, invoice: Invoice, fixtureCompany = company) {
  const options = {
    invoice,
    company: fixtureCompany,
    client,
    profile: 'BASIC' as const,
    iccProfileBytes,
    fontBytes,
  };
  writeFileSync(resolve(outputDir, `${name}.xml`), generateFacturXXML(options));
  writeFileSync(resolve(outputDir, `${name}.pdf`), await generateFacturXPDF(emptyPdf, options));
}

const baseInvoice: Invoice = {
  id: 'fixture_invoice',
  ownerId: 'fixture_user',
  type: 'invoice',
  clientId: client.id,
  clientName: client.name,
  number: 'F-2026-0001',
  date: '2026-05-08',
  dueDate: '2026-06-08',
  status: 'validated',
  vatRegime: 'standard',
  items: [{ description: 'Prestation plomberie', quantity: 1, unitPrice: 1000, vatRate: 20 }],
  totalHT: 1000,
  totalVAT: 200,
  totalTTC: 1200,
};

mkdirSync(outputDir, { recursive: true });

await writeFixture('standard-tva-20', baseInvoice);
await writeFixture('standard-tva-10', {
  ...baseInvoice,
  number: 'F-2026-0002',
  items: [{ description: 'Travaux TVA 10', quantity: 1, unitPrice: 1000, vatRate: 10 }],
  totalHT: 1000,
  totalVAT: 100,
  totalTTC: 1100,
});
await writeFixture('franchise-tva', {
  ...baseInvoice,
  number: 'F-2026-0003',
  vatRegime: 'franchise',
  items: [{ description: 'Prestation franchise TVA', quantity: 1, unitPrice: 1000, vatRate: 20 }],
  totalHT: 1000,
  totalVAT: 0,
  totalTTC: 1000,
}, { ...company, vatRegime: 'franchise', vatNumber: '' });
await writeFixture('autoliquidation', {
  ...baseInvoice,
  number: 'F-2026-0004',
  vatRegime: 'autoliquidation',
  items: [{ description: 'Sous-traitance autoliquidée', quantity: 1, unitPrice: 1000, vatRate: 20 }],
  totalHT: 1000,
  totalVAT: 0,
  totalTTC: 1000,
}, { ...company, vatRegime: 'autoliquidation' });
await writeFixture('multi-lignes-b2b', {
  ...baseInvoice,
  number: 'F-2026-0005',
  items: [
    { description: 'Prestation plomberie', quantity: 2, unitPrice: 100, vatRate: 20 },
    { description: 'Déplacement', quantity: 1, unitPrice: 50, vatRate: 10 },
  ],
  totalHT: 250,
  totalVAT: 45,
  totalTTC: 295,
});
await writeFixture('avoir', {
  ...baseInvoice,
  type: 'credit',
  number: 'A-2026-0001',
  dueDate: '',
  linkedInvoiceNumber: 'F-2026-0001',
  items: [{ description: 'Avoir prestation plomberie', quantity: -1, unitPrice: 100, vatRate: 20 }],
  totalHT: -100,
  totalVAT: -20,
  totalTTC: -120,
});
await writeFixture('acompte', {
  ...baseInvoice,
  type: 'deposit',
  number: 'AC-2026-0001',
  items: [{ description: 'Acompte chantier', quantity: 1, unitPrice: 500, vatRate: 10 }],
  totalHT: 500,
  totalVAT: 50,
  totalTTC: 550,
});

console.log(`Factur-X fixtures generated in ${outputDir}`);
