import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { Client, CompanySettings, Invoice } from '../src/contexts/DataContext';
import {
  embedFacturXInPDF,
  generateFacturXPDF,
  generateFacturXXML,
  inspectFacturXPDF,
} from '../src/services/facturx';

const company: CompanySettings = {
  ownerId: 'user_1',
  name: 'Artisan Test',
  address: '12 rue Artisan, 75001 Paris',
  email: 'contact@artisan.test',
  phone: '0102030405',
  siret: '12345678900012',
  vatNumber: 'FR12345678901',
  vatRegime: 'standard',
  defaultCurrency: 'EUR',
};

const b2bClient: Client = {
  id: 'client_1',
  ownerId: 'user_1',
  type: 'B2B',
  name: 'Client B2B',
  address: '4 avenue Client, 69002 Lyon',
  siren: '987654321',
  vatNumber: 'FR98765432100',
};

const standardInvoice: Invoice = {
  id: 'invoice_1',
  ownerId: 'user_1',
  type: 'invoice',
  clientId: 'client_1',
  clientName: 'Client B2B',
  number: 'F-2026-0001',
  date: '2026-05-08',
  dueDate: '2026-06-08',
  status: 'validated',
  vatRegime: 'standard',
  items: [
    { description: 'Prestation plomberie', quantity: 2, unitPrice: 100, vatRate: 20 },
    { description: 'Déplacement', quantity: 1, unitPrice: 50, vatRate: 10 },
  ],
  totalHT: 250,
  totalVAT: 45,
  totalTTC: 295,
};

async function createTinyPdfBytes(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 180]);
  page.drawText('Facture de test Photofacto', { x: 24, y: 120, size: 14 });
  return pdf.save({ useObjectStreams: false });
}

function iccProfileBytes(): Uint8Array {
  return readFileSync(resolve(process.cwd(), 'public/color/sRGB2014.icc'));
}

function fontBytes(): Uint8Array {
  return readFileSync(resolve(process.cwd(), 'public/fonts/NotoSans-Regular.ttf'));
}

describe('generateFacturXXML', () => {
  it('génère un XML CII BASIC avec montants, TVA, vendeur et acheteur', () => {
    const xml = generateFacturXXML({
      invoice: standardInvoice,
      company,
      client: b2bClient,
      profile: 'BASIC',
    });

    expect(xml).toContain('<rsm:CrossIndustryInvoice');
    expect(xml).toContain('<ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>');
    expect(xml).toContain('<ram:ID>F-2026-0001</ram:ID>');
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>');
    expect(xml).toContain('<ram:LineTotalAmount>250.00</ram:LineTotalAmount>');
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">45.00</ram:TaxTotalAmount>');
    expect(xml).toContain('<ram:GrandTotalAmount>295.00</ram:GrandTotalAmount>');
    expect(xml).toContain('<ram:ID schemeID="0002">123456789</ram:ID>');
    expect(xml).toContain('<ram:ID schemeID="VA">FR12345678901</ram:ID>');
    expect(xml).toContain('<ram:ID schemeID="0002">987654321</ram:ID>');
    expect(xml).toContain('<ram:ID schemeID="VA">FR98765432100</ram:ID>');
    expect(xml).toContain('<ram:PostcodeCode>75001</ram:PostcodeCode>');
    expect(xml).toContain('<ram:PostcodeCode>69002</ram:PostcodeCode>');
    expect(xml).toContain('<ram:RateApplicablePercent>10.00</ram:RateApplicablePercent>');
    expect(xml).toContain('<ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>');
  });

  it('supporte le profil EN16931 dans le contexte documentaire', () => {
    const xml = generateFacturXXML({
      invoice: standardInvoice,
      company,
      client: b2bClient,
      profile: 'EN16931',
    });

    expect(xml).toContain('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>');
  });

  it('gère la franchise en base TVA avec catégorie E et TVA à zéro', () => {
    const invoice: Invoice = {
      ...standardInvoice,
      vatRegime: 'franchise',
      items: [{ description: 'Prestation sans TVA', quantity: 1, unitPrice: 100, vatRate: 20 }],
      totalHT: 100,
      totalVAT: 0,
      totalTTC: 100,
    };

    const xml = generateFacturXXML({
      invoice,
      company: { ...company, vatRegime: 'franchise', vatNumber: '' },
      client: b2bClient,
      profile: 'BASIC',
    });

    expect(xml).toContain('<ram:CategoryCode>E</ram:CategoryCode>');
    expect(xml).toContain('<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>');
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>');
    expect(xml).toContain('<ram:GrandTotalAmount>100.00</ram:GrandTotalAmount>');
  });

  it('gère l’autoliquidation avec catégorie AE et TVA à zéro', () => {
    const invoice: Invoice = {
      ...standardInvoice,
      vatRegime: 'autoliquidation',
      items: [{ description: 'Sous-traitance autoliquidée', quantity: 1, unitPrice: 500, vatRate: 20 }],
      totalHT: 500,
      totalVAT: 0,
      totalTTC: 500,
    };

    const xml = generateFacturXXML({
      invoice,
      company: { ...company, vatRegime: 'autoliquidation' },
      client: b2bClient,
      profile: 'BASIC',
    });

    expect(xml).toContain('<ram:CategoryCode>AE</ram:CategoryCode>');
    expect(xml).toContain('<ram:ExemptionReason>Autoliquidation de la TVA (Art. 283-2 nonies du CGI)</ram:ExemptionReason>');
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>');
  });

  it('génère une référence de facture source pour un avoir', () => {
    const credit: Invoice = {
      ...standardInvoice,
      type: 'credit',
      number: 'A-2026-0001',
      dueDate: '',
      linkedInvoiceNumber: 'F-2026-0001',
      items: [{ description: 'Avoir prestation plomberie', quantity: -1, unitPrice: 100, vatRate: 20 }],
      totalHT: -100,
      totalVAT: -20,
      totalTTC: -120,
    };

    const xml = generateFacturXXML({
      invoice: credit,
      company,
      client: b2bClient,
      profile: 'BASIC',
    });

    expect(xml).toContain('<ram:TypeCode>381</ram:TypeCode>');
    expect(xml).toContain('<ram:IssuerAssignedID>F-2026-0001</ram:IssuerAssignedID>');
    expect(xml).toContain('<ram:GrandTotalAmount>-120.00</ram:GrandTotalAmount>');
  });

  it('génère le code document attendu pour une facture d’acompte', () => {
    const deposit: Invoice = {
      ...standardInvoice,
      type: 'deposit',
      number: 'AC-2026-0001',
      items: [{ description: 'Acompte chantier', quantity: 1, unitPrice: 500, vatRate: 10 }],
      totalHT: 500,
      totalVAT: 50,
      totalTTC: 550,
    };

    const xml = generateFacturXXML({
      invoice: deposit,
      company,
      client: b2bClient,
      profile: 'BASIC',
    });

    expect(xml).toContain('<ram:TypeCode>386</ram:TypeCode>');
    expect(xml).toContain('<ram:RateApplicablePercent>10.00</ram:RateApplicablePercent>');
    expect(xml).toContain('<ram:GrandTotalAmount>550.00</ram:GrandTotalAmount>');
  });

  it('échoue proprement si une donnée obligatoire manque', () => {
    expect(() => generateFacturXXML({
      invoice: standardInvoice,
      company,
      client: { ...b2bClient, address: '' },
      profile: 'BASIC',
    })).toThrow(/acheteur adresse/);
  });

  it('contrôle les identifiants français nécessaires au XML', () => {
    expect(() => generateFacturXXML({
      invoice: standardInvoice,
      company: { ...company, siret: '123' },
      client: b2bClient,
      profile: 'BASIC',
    })).toThrow(/SIRET vendeur invalide/);

    expect(() => generateFacturXXML({
      invoice: standardInvoice,
      company,
      client: { ...b2bClient, siren: '' },
      profile: 'BASIC',
    })).toThrow(/SIREN acheteur obligatoire/);

    expect(() => generateFacturXXML({
      invoice: standardInvoice,
      company: { ...company, vatNumber: '' },
      client: b2bClient,
      profile: 'BASIC',
    })).toThrow(/TVA vendeur obligatoire/);
  });

  it('échoue si les totaux fournis ne correspondent pas aux lignes', () => {
    expect(() => generateFacturXXML({
      invoice: { ...standardInvoice, totalTTC: 999 },
      company,
      client: b2bClient,
      profile: 'BASIC',
    })).toThrow(/total totalTTC incohérent/);
  });
});

describe('embedFacturXInPDF', () => {
  it('embarque factur-x.xml avec AFRelationship Alternative, XMP et OutputIntent ICC', async () => {
    const xml = generateFacturXXML({
      invoice: standardInvoice,
      company,
      client: b2bClient,
      profile: 'BASIC',
    });

    const embedded = await embedFacturXInPDF(
      await createTinyPdfBytes(),
      xml,
      'BASIC',
      iccProfileBytes(),
    );
    const info = await inspectFacturXPDF(embedded);

    expect(info.hasFacturXXml).toBe(true);
    expect(info.embeddedFileName).toBe('factur-x.xml');
    expect(info.embeddedXml).toBe(xml);
    expect(info.hasCatalogAF).toBe(true);
    expect(info.afRelationship).toBe('Alternative');
    expect(info.hasOutputIntent).toBe(true);
    expect(info.hasXmpMetadata).toBe(true);
    expect(info.xmpMetadata).toContain('<pdfaid:part>3</pdfaid:part>');
    expect(info.xmpMetadata).toContain('<pdfaid:conformance>B</pdfaid:conformance>');
    expect(info.xmpMetadata).toContain('<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>');
    expect(info.xmpMetadata).toContain('<fx:ConformanceLevel>BASIC</fx:ConformanceLevel>');
  });
});

describe('generateFacturXPDF', () => {
  it('produit un PDF inspectable avec XML embarqué depuis un document jsPDF-like', async () => {
    const basePdf = await createTinyPdfBytes();
    const pdf = await generateFacturXPDF(
      { output: () => basePdf.buffer.slice(basePdf.byteOffset, basePdf.byteOffset + basePdf.byteLength) as ArrayBuffer },
      {
        invoice: standardInvoice,
        company,
        client: b2bClient,
        profile: 'BASIC',
        iccProfileBytes: iccProfileBytes(),
        fontBytes: fontBytes(),
      },
    );

    const info = await inspectFacturXPDF(pdf);
    expect(info.hasFacturXXml).toBe(true);
    expect(info.hasOutputIntent).toBe(true);
    expect(info.embeddedXml).toContain('<ram:ID>F-2026-0001</ram:ID>');
  });
});
