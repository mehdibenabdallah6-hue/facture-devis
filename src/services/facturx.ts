/**
 * Factur-X / ZUGFeRD export helper.
 *
 * Generates UN/CEFACT CII XML and embeds it into a human-readable PDF as
 * `factur-x.xml`. The produced PDF includes the expected Factur-X XMP
 * metadata, Associated Files entries and an sRGB ICC OutputIntent.
 *
 * Important: PDF/A-3b is only reported as validated after an external veraPDF
 * pass on the generated file.
 */

import type { Invoice, CompanySettings, Client } from '../contexts/DataContext';
import { calculateInvoiceTotals, vatBreakdown, type VatRegime } from '../lib/invoiceTotals';

export type FacturXProfile = 'MINIMUM' | 'BASIC' | 'EN16931';

export interface FacturXOptions {
  invoice: Invoice;
  company: CompanySettings;
  client?: Client;
  profile?: FacturXProfile;
  iccProfileBytes?: Uint8Array | ArrayBuffer;
  fontBytes?: Uint8Array | ArrayBuffer;
}

export interface FacturXPackageInfo {
  hasFacturXXml: boolean;
  embeddedFileName?: string;
  embeddedXml?: string;
  hasCatalogAF: boolean;
  afRelationship?: string;
  hasOutputIntent: boolean;
  hasXmpMetadata: boolean;
  xmpMetadata?: string;
}

export const FACTURX_TECHNICAL_STATUS = {
  facturxStatus: 'generated' as const,
  pdfAStatus: 'not_validated' as const,
};

const PROFILE_LABEL: Record<FacturXProfile, string> = {
  MINIMUM: 'MINIMUM',
  BASIC: 'BASIC',
  EN16931: 'EN 16931',
};

const PROFILE_GUIDELINE_ID: Record<FacturXProfile, string> = {
  MINIMUM: 'urn:factur-x.eu:1p0:minimum',
  BASIC: 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic',
  EN16931: 'urn:cen.eu:en16931:2017',
};

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatAmount(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function formatDateCII(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) {
    throw new Error(`Date Factur-X invalide: ${dateStr || 'absente'}`);
  }
  return dateStr.replace(/-/g, '');
}

function getDocumentTypeCode(type: Invoice['type']): string {
  switch (type) {
    case 'credit': return '381';
    case 'deposit': return '386';
    case 'invoice':
    default: return '380';
  }
}

function getVatCategoryCode(vatRegime: VatRegime | undefined, vatRate: number): string {
  if (vatRegime === 'franchise') return 'E';
  if (vatRegime === 'autoliquidation') return 'AE';
  if (vatRate === 0) return 'Z';
  return 'S';
}

function getVatExemptionReason(vatRegime: VatRegime | undefined): string {
  if (vatRegime === 'franchise') return 'TVA non applicable, art. 293 B du CGI';
  if (vatRegime === 'autoliquidation') return 'Autoliquidation de la TVA (Art. 283-2 nonies du CGI)';
  return '';
}

function requireValue(label: string, value: unknown): string {
  const str = String(value ?? '').trim();
  if (!str) throw new Error(`Factur-X: ${label} obligatoire manquant.`);
  return str;
}

function normalizeFrenchSiret(value?: string): string {
  return String(value || '').replace(/\D/g, '');
}

function normalizeFrenchSiren(value?: string): string {
  return String(value || '').replace(/\D/g, '');
}

function normalizeVatNumber(value?: string): string {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function validateFrenchSiret(label: string, value: unknown, required: boolean): string {
  const normalized = normalizeFrenchSiret(String(value ?? ''));
  if (!normalized) {
    if (required) requireValue(label, value);
    return '';
  }
  if (!/^\d{14}$/.test(normalized)) {
    throw new Error(`Factur-X: ${label} invalide.`);
  }
  return normalized;
}

function validateFrenchSiren(label: string, value: unknown, required: boolean): string {
  const normalized = normalizeFrenchSiren(String(value ?? ''));
  if (!normalized) {
    if (required) requireValue(label, value);
    return '';
  }
  if (!/^\d{9}$/.test(normalized)) {
    throw new Error(`Factur-X: ${label} invalide.`);
  }
  return normalized;
}

function validateFrenchVatNumber(label: string, value: unknown, required: boolean): string {
  const normalized = normalizeVatNumber(String(value ?? ''));
  if (!normalized) {
    if (required) requireValue(label, value);
    return '';
  }
  if (!/^FR[A-Z0-9]{2}\d{9}$/.test(normalized)) {
    throw new Error(`Factur-X: ${label} invalide.`);
  }
  return normalized;
}

function validateEmailLike(label: string, value: unknown, required: boolean): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    if (required) requireValue(label, value);
    return '';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error(`Factur-X: ${label} invalide.`);
  }
  return normalized;
}

/**
 * Parse a free-form French address into {street, postcode, city}.
 */
export function parseFrenchAddress(raw: string): { street: string; postcode: string; city: string } {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { street: '', postcode: '', city: '' };

  const segments = trimmed
    .split(/[,\n;]+/g)
    .map(s => s.trim())
    .filter(Boolean);

  const postcodeRegex = /\b(\d{5})\b/;
  const postcodeIndex = segments.findIndex(s => postcodeRegex.test(s));

  if (postcodeIndex === -1) {
    return { street: trimmed.replace(/\s*\n\s*/g, ' '), postcode: '', city: '' };
  }

  const postcodeSegment = segments[postcodeIndex];
  const match = postcodeSegment.match(postcodeRegex);
  const postcode = match ? match[1] : '';
  let city = postcodeSegment.replace(postcode, '').trim();

  if (!city && segments[postcodeIndex + 1]) {
    city = segments[postcodeIndex + 1];
  } else if (segments[postcodeIndex + 1] && /^\d{5}$/.test(postcodeSegment)) {
    city = segments[postcodeIndex + 1];
  }

  return {
    street: segments.slice(0, postcodeIndex).join(', ').trim(),
    postcode,
    city,
  };
}

function validatePartyAddress(label: string, rawAddress?: string) {
  const parsed = parseFrenchAddress(requireValue(`${label} adresse`, rawAddress));
  requireValue(`${label} code postal`, parsed.postcode);
  requireValue(`${label} ville`, parsed.city);
  return parsed;
}

function validateInvoiceForFacturX(options: FacturXOptions, profile: FacturXProfile) {
  const { invoice, company, client } = options;
  const vatRegime = (invoice.vatRegime || company.vatRegime || 'standard') as VatRegime;
  requireValue('numéro de document', invoice.number);
  requireValue('date du document', invoice.date);
  requireValue('nom vendeur', company.name);
  validatePartyAddress('vendeur', company.address);
  validateFrenchSiret('SIRET vendeur', company.siret, true);
  requireValue('nom acheteur', client?.name || invoice.clientName);
  validatePartyAddress('acheteur', client?.address);
  validateFrenchSiren('SIREN acheteur', client?.siren, client?.type === 'B2B');

  const items = invoice.items || [];
  if (profile !== 'MINIMUM' && items.length === 0) {
    throw new Error('Factur-X: au moins une ligne est obligatoire pour BASIC/EN16931.');
  }
  const hasVatLine = vatRegime === 'standard' && items.some(item => Number(item.vatRate) > 0);
  validateFrenchVatNumber('TVA vendeur', company.vatNumber, hasVatLine);
  validateFrenchVatNumber('TVA acheteur', client?.vatNumber, false);
  validateEmailLike('email vendeur', company.email, false);
  validateEmailLike('email acheteur', client?.email, false);
  for (const [index, item] of items.entries()) {
    requireValue(`ligne ${index + 1} description`, item.description);
    if (!Number.isFinite(item.quantity) || item.quantity === 0) {
      throw new Error(`Factur-X: quantité invalide ligne ${index + 1}.`);
    }
    if (!Number.isFinite(item.unitPrice)) {
      throw new Error(`Factur-X: prix HT invalide ligne ${index + 1}.`);
    }
    if (!Number.isFinite(item.vatRate)) {
      throw new Error(`Factur-X: TVA invalide ligne ${index + 1}.`);
    }
  }
}

function assertTotalsConsistent(invoice: Invoice, vatRegime: VatRegime) {
  const totals = calculateInvoiceTotals(invoice.items, vatRegime);
  const source = {
    totalHT: Number(invoice.totalHT),
    totalVAT: Number(invoice.totalVAT),
    totalTTC: Number(invoice.totalTTC),
  };
  for (const key of ['totalHT', 'totalVAT', 'totalTTC'] as const) {
    if (Number.isFinite(source[key]) && Math.abs(source[key] - totals[key]) > 0.02) {
      throw new Error(`Factur-X: total ${key} incohérent avec les lignes.`);
    }
  }
  return totals;
}

export function generateFacturXXML(options: FacturXOptions): string {
  const { invoice, company, client, profile = 'BASIC' } = options;
  const vatRegime = (invoice.vatRegime || company.vatRegime || 'standard') as VatRegime;
  validateInvoiceForFacturX(options, profile);

  const totals = assertTotalsConsistent(invoice, vatRegime);
  const currency = company.defaultCurrency || 'EUR';
  const companyAddress = parseFrenchAddress(company.address || '');
  const clientAddress = parseFrenchAddress(client?.address || '');
  const clientName = client?.name || invoice.clientName;
  const vatRows = vatBreakdown(invoice.items, vatRegime);
  const profileGuideline = PROFILE_GUIDELINE_ID[profile];
  const exemptionReason = getVatExemptionReason(vatRegime);

  const lineItemsXml = profile === 'MINIMUM' ? '' : (invoice.items || []).map((item, index) => {
    const effectiveRate = vatRegime === 'standard' ? item.vatRate : 0;
    const lineTotal = item.quantity * item.unitPrice;
    const categoryCode = getVatCategoryCode(vatRegime, effectiveRate);
    return `
        <ram:IncludedSupplyChainTradeLineItem>
          <ram:AssociatedDocumentLineDocument>
            <ram:LineID>${index + 1}</ram:LineID>
          </ram:AssociatedDocumentLineDocument>
          <ram:SpecifiedTradeProduct>
            <ram:Name>${xmlEscape(item.description)}</ram:Name>
          </ram:SpecifiedTradeProduct>
          <ram:SpecifiedLineTradeAgreement>
            <ram:NetPriceProductTradePrice>
              <ram:ChargeAmount>${formatAmount(item.unitPrice)}</ram:ChargeAmount>
            </ram:NetPriceProductTradePrice>
          </ram:SpecifiedLineTradeAgreement>
          <ram:SpecifiedLineTradeDelivery>
            <ram:BilledQuantity unitCode="C62">${formatAmount(item.quantity)}</ram:BilledQuantity>
          </ram:SpecifiedLineTradeDelivery>
          <ram:SpecifiedLineTradeSettlement>
            <ram:ApplicableTradeTax>
              <ram:TypeCode>VAT</ram:TypeCode>
              <ram:CategoryCode>${categoryCode}</ram:CategoryCode>
              <ram:RateApplicablePercent>${formatAmount(effectiveRate)}</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>
            <ram:SpecifiedTradeSettlementLineMonetarySummation>
              <ram:LineTotalAmount>${formatAmount(lineTotal)}</ram:LineTotalAmount>
            </ram:SpecifiedTradeSettlementLineMonetarySummation>
          </ram:SpecifiedLineTradeSettlement>
        </ram:IncludedSupplyChainTradeLineItem>`;
  }).join('');

  const taxBreakdownXml = vatRows.map(row => `
          <ram:ApplicableTradeTax>
            <ram:CalculatedAmount>${formatAmount(row.vatAmount)}</ram:CalculatedAmount>
            <ram:TypeCode>VAT</ram:TypeCode>${exemptionReason ? `
            <ram:ExemptionReason>${xmlEscape(exemptionReason)}</ram:ExemptionReason>` : ''}
            <ram:BasisAmount>${formatAmount(row.baseHT)}</ram:BasisAmount>
            <ram:CategoryCode>${getVatCategoryCode(vatRegime, row.rate)}</ram:CategoryCode>
            <ram:RateApplicablePercent>${formatAmount(row.rate)}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>`).join('');

  const sellerSiret = validateFrenchSiret('SIRET vendeur', company.siret, true);
  const sellerSiren = sellerSiret.slice(0, 9);
  const buyerSiren = validateFrenchSiren('SIREN acheteur', client?.siren, client?.type === 'B2B');
  const sellerVat = validateFrenchVatNumber('TVA vendeur', company.vatNumber, vatRegime === 'standard' && (invoice.items || []).some(item => Number(item.vatRate) > 0));
  const buyerVat = validateFrenchVatNumber('TVA acheteur', client?.vatNumber, false);
  const sellerEmail = validateEmailLike('email vendeur', company.email, false);
  const buyerEmail = validateEmailLike('email acheteur', client?.email, false);
  const sellerEndpoint = sellerEmail || sellerSiren;
  const sellerEndpointScheme = sellerEmail ? 'EM' : '0002';
  const buyerEndpoint = buyerEmail || buyerSiren;
  const buyerEndpointScheme = buyerEmail ? 'EM' : '0002';
  const legalNotesXml = `
    <ram:IncludedNote>
      <ram:Content>Indemnite forfaitaire pour frais de recouvrement de 40 euros.</ram:Content>
      <ram:SubjectCode>PMT</ram:SubjectCode>
    </ram:IncludedNote>
    <ram:IncludedNote>
      <ram:Content>Penalites de retard applicables selon les conditions de paiement.</ram:Content>
      <ram:SubjectCode>PMD</ram:SubjectCode>
    </ram:IncludedNote>
    <ram:IncludedNote>
      <ram:Content>Aucun escompte pour paiement anticipe.</ram:Content>
      <ram:SubjectCode>AAB</ram:SubjectCode>
    </ram:IncludedNote>`;
  const dueDateXml = invoice.type !== 'credit' && invoice.dueDate ? `
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatDateCII(invoice.dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : '';

  const sellerTaxRegistrationXml = sellerVat ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${xmlEscape(sellerVat)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : vatRegime === 'franchise' ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">${xmlEscape(sellerSiren)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : '';
  const creditReferenceXml = invoice.type === 'credit' && invoice.linkedInvoiceNumber ? `
      <ram:InvoiceReferencedDocument>
        <ram:IssuerAssignedID>${xmlEscape(invoice.linkedInvoiceNumber)}</ram:IssuerAssignedID>
        <ram:FormattedIssueDateTime>
          <qdt:DateTimeString format="102">${formatDateCII((invoice as Invoice & { linkedInvoiceDate?: string }).linkedInvoiceDate || invoice.date)}</qdt:DateTimeString>
        </ram:FormattedIssueDateTime>
      </ram:InvoiceReferencedDocument>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${profileGuideline}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xmlEscape(invoice.number)}</ram:ID>
    <ram:TypeCode>${getDocumentTypeCode(invoice.type)}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDateCII(invoice.date)}</udt:DateTimeString>
    </ram:IssueDateTime>${legalNotesXml}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lineItemsXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${xmlEscape(invoice.number)}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${xmlEscape(company.name)}</ram:Name>${sellerSiret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${xmlEscape(sellerSiren)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${xmlEscape(companyAddress.postcode)}</ram:PostcodeCode>
          <ram:LineOne>${xmlEscape(companyAddress.street)}</ram:LineOne>
          <ram:CityName>${xmlEscape(companyAddress.city)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="${xmlEscape(sellerEndpointScheme)}">${xmlEscape(sellerEndpoint)}</ram:URIID>
        </ram:URIUniversalCommunication>${sellerTaxRegistrationXml}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xmlEscape(clientName)}</ram:Name>${buyerSiren ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${xmlEscape(buyerSiren)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${xmlEscape(clientAddress.postcode)}</ram:PostcodeCode>
          <ram:LineOne>${xmlEscape(clientAddress.street)}</ram:LineOne>
          <ram:CityName>${xmlEscape(clientAddress.city)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="${xmlEscape(buyerEndpointScheme)}">${xmlEscape(buyerEndpoint)}</ram:URIID>
        </ram:URIUniversalCommunication>${buyerVat ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${xmlEscape(buyerVat)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${formatDateCII(invoice.serviceDate || invoice.date)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${xmlEscape(currency)}</ram:InvoiceCurrencyCode>
${taxBreakdownXml}${dueDateXml}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${formatAmount(totals.totalHT)}</ram:LineTotalAmount>
        <ram:ChargeTotalAmount>0.00</ram:ChargeTotalAmount>
        <ram:AllowanceTotalAmount>0.00</ram:AllowanceTotalAmount>
        <ram:TaxBasisTotalAmount>${formatAmount(totals.totalHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${xmlEscape(currency)}">${formatAmount(totals.totalVAT)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${formatAmount(totals.totalTTC)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${formatAmount(totals.totalTTC)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>${creditReferenceXml}
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

async function resolveIccProfileBytes(provided?: Uint8Array | ArrayBuffer): Promise<Uint8Array | null> {
  if (provided) return provided instanceof Uint8Array ? provided : new Uint8Array(provided);
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch('/color/sRGB2014.icc');
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function resolveFontBytes(provided?: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  if (provided) return provided instanceof Uint8Array ? provided : new Uint8Array(provided);
  if (typeof fetch !== 'function') {
    throw new Error('Factur-X: police PDF/A introuvable.');
  }
  const res = await fetch('/fonts/NotoSans-Regular.ttf');
  if (!res.ok) {
    throw new Error('Factur-X: police PDF/A introuvable.');
  }
  return new Uint8Array(await res.arrayBuffer());
}

function documentIdHex(seed: string): string {
  const source = new TextEncoder().encode(seed);
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (source[index % Math.max(source.length, 1)] + index * 31) % 256;
  }
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function wrapPdfText(text: string, maxChars: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

async function createReadableInvoicePdf(options: FacturXOptions): Promise<Uint8Array> {
  const { invoice, company, client } = options;
  const { PDFDocument, rgb } = await import('pdf-lib');
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const font = await pdfDoc.embedFont(await resolveFontBytes(options.fontBytes), { subset: true });
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 48;
  const orange = rgb(0.9, 0.28, 0.06);
  const dark = rgb(0.08, 0.08, 0.1);
  const muted = rgb(0.36, 0.39, 0.45);
  const light = rgb(0.94, 0.95, 0.96);
  const vatRegime = (invoice.vatRegime || company.vatRegime || 'standard') as VatRegime;
  const totals = calculateInvoiceTotals(invoice.items, vatRegime);
  const title = invoice.type === 'credit'
    ? 'Avoir'
    : invoice.type === 'deposit'
      ? "Facture d'acompte"
      : 'Facture';

  let cursorY = height - margin;
  const draw = (text: string, x: number, y: number, size = 10, color = dark) => {
    page.drawText(text, { x, y, size, font, color });
  };
  const drawRight = (text: string, xRight: number, y: number, size = 10, color = dark) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    draw(text, xRight - textWidth, y, size, color);
  };

  draw('PHOTOFACTO', margin, cursorY, 18, orange);
  drawRight(`${title} ${invoice.number}`, width - margin, cursorY, 16, dark);
  cursorY -= 30;
  draw(`Date : ${invoice.date}`, width - margin - 170, cursorY, 10, muted);
  if (invoice.dueDate) draw(`Echeance : ${invoice.dueDate}`, width - margin - 170, cursorY - 14, 10, muted);

  draw(company.name, margin, cursorY, 12, dark);
  cursorY -= 15;
  for (const line of wrapPdfText(company.address || '', 54).slice(0, 2)) {
    draw(line, margin, cursorY, 9, muted);
    cursorY -= 12;
  }
  if (company.siret) {
    draw(`SIRET : ${normalizeFrenchSiret(company.siret)}`, margin, cursorY, 9, muted);
    cursorY -= 12;
  }
  if (company.vatNumber) {
    draw(`TVA : ${normalizeVatNumber(company.vatNumber)}`, margin, cursorY, 9, muted);
  }

  cursorY = height - 150;
  draw('Client', width - margin - 170, cursorY, 12, dark);
  cursorY -= 15;
  draw(client?.name || invoice.clientName, width - margin - 170, cursorY, 10, dark);
  cursorY -= 13;
  for (const line of wrapPdfText(client?.address || '', 38).slice(0, 3)) {
    draw(line, width - margin - 170, cursorY, 9, muted);
    cursorY -= 12;
  }
  if (client?.siren) {
    draw(`SIREN : ${normalizeFrenchSiren(client.siren)}`, width - margin - 170, cursorY, 9, muted);
  }

  cursorY = height - 255;
  page.drawRectangle({ x: margin, y: cursorY - 8, width: width - margin * 2, height: 24, color: light });
  draw('Description', margin + 10, cursorY, 9, muted);
  drawRight('Qté', width - margin - 220, cursorY, 9, muted);
  drawRight('PU HT', width - margin - 140, cursorY, 9, muted);
  drawRight('TVA', width - margin - 75, cursorY, 9, muted);
  drawRight('Total HT', width - margin - 10, cursorY, 9, muted);
  cursorY -= 30;

  for (const item of invoice.items || []) {
    const lineTotal = item.quantity * item.unitPrice;
    const lines = wrapPdfText(item.description, 44).slice(0, 2);
    draw(lines[0], margin + 10, cursorY, 9, dark);
    if (lines[1]) draw(lines[1], margin + 10, cursorY - 12, 8, muted);
    drawRight(formatAmount(item.quantity), width - margin - 220, cursorY, 9, dark);
    drawRight(`${formatAmount(item.unitPrice)} €`, width - margin - 140, cursorY, 9, dark);
    drawRight(`${formatAmount(vatRegime === 'standard' ? item.vatRate : 0)} %`, width - margin - 75, cursorY, 9, dark);
    drawRight(`${formatAmount(lineTotal)} €`, width - margin - 10, cursorY, 9, dark);
    cursorY -= lines[1] ? 34 : 24;
  }

  cursorY -= 12;
  page.drawLine({ start: { x: margin, y: cursorY }, end: { x: width - margin, y: cursorY }, thickness: 1, color: light });
  cursorY -= 26;
  drawRight('Total HT', width - margin - 100, cursorY, 10, muted);
  drawRight(`${formatAmount(totals.totalHT)} €`, width - margin, cursorY, 10, dark);
  cursorY -= 18;
  drawRight('TVA', width - margin - 100, cursorY, 10, muted);
  drawRight(`${formatAmount(totals.totalVAT)} €`, width - margin, cursorY, 10, dark);
  cursorY -= 20;
  drawRight('Total TTC', width - margin - 100, cursorY, 12, orange);
  drawRight(`${formatAmount(totals.totalTTC)} €`, width - margin, cursorY, 12, orange);

  cursorY -= 42;
  if (vatRegime === 'franchise') {
    draw('TVA non applicable, art. 293 B du CGI.', margin, cursorY, 9, muted);
  } else if (vatRegime === 'autoliquidation') {
    draw('Autoliquidation de la TVA par le client.', margin, cursorY, 9, muted);
  }
  draw('PDF avec XML Factur-X embarqué. Connexion à une plateforme agréée en préparation.', margin, 42, 8, muted);

  return pdfDoc.save({ useObjectStreams: false });
}

export async function embedFacturXInPDF(
  pdfBytes: ArrayBuffer | Uint8Array,
  xmlString: string,
  profile: FacturXProfile = 'BASIC',
  iccProfileBytes?: Uint8Array | ArrayBuffer,
): Promise<Uint8Array> {
  const {
    PDFDocument,
    PDFHexString,
    PDFName,
    PDFString,
    AFRelationship,
  } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const encoder = new TextEncoder();
  const now = new Date();
  const xmlBytes = encoder.encode(xmlString);

  await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Factur-X XML invoice data (CII)',
    afRelationship: AFRelationship.Alternative,
    creationDate: now,
    modificationDate: now,
  });

  pdfDoc.setTitle('Factur-X Invoice');
  pdfDoc.setSubject(`Factur-X ${PROFILE_LABEL[profile]} profile`);
  pdfDoc.setProducer('Photofacto - photofacto.fr');
  pdfDoc.setCreator('Photofacto');
  pdfDoc.setCreationDate(now);
  pdfDoc.setModificationDate(now);
  const trailerId = documentIdHex(`${xmlString}:${now.toISOString()}`);
  pdfDoc.context.trailerInfo.ID = pdfDoc.context.obj([PDFHexString.of(trailerId), PDFHexString.of(trailerId)]);

  const xmp = buildFacturXmp(profile, now);
  const metadataStream = pdfDoc.context.stream(encoder.encode(xmp), {
    Type: 'Metadata',
    Subtype: 'XML',
  });
  pdfDoc.catalog.set(PDFName.of('Metadata'), pdfDoc.context.register(metadataStream));

  const icc = await resolveIccProfileBytes(iccProfileBytes);
  if (icc) {
    const iccStream = pdfDoc.context.flateStream(icc, {
      N: 3,
      Alternate: PDFName.of('DeviceRGB'),
    });
    const iccRef = pdfDoc.context.register(iccStream);
    const outputIntent = pdfDoc.context.obj({
      Type: 'OutputIntent',
      S: PDFName.of('GTS_PDFA1'),
      OutputConditionIdentifier: PDFString.of('sRGB2014'),
      Info: PDFString.of('sRGB2014 ICC profile'),
      RegistryName: PDFString.of('https://registry.color.org'),
      DestOutputProfile: iccRef,
    });
    pdfDoc.catalog.set(PDFName.of('OutputIntents'), pdfDoc.context.obj([pdfDoc.context.register(outputIntent)]));
  }

  return pdfDoc.save({ useObjectStreams: false });
}

function buildFacturXmp(profile: FacturXProfile, date = new Date()): string {
  const isoNow = date.toISOString();
  const level = PROFILE_LABEL[profile];
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Photofacto Factur-X">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"
      xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
      xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
      xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Factur-X Invoice</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>Photofacto</rdf:li></rdf:Seq></dc:creator>
      <pdf:Producer>Photofacto - photofacto.fr</pdf:Producer>
      <xmp:CreatorTool>Photofacto</xmp:CreatorTool>
      <xmp:CreateDate>${isoNow}</xmp:CreateDate>
      <xmp:ModifyDate>${isoNow}</xmp:ModifyDate>
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${level}</fx:ConformanceLevel>
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description></rdf:li>
                <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>INVOICE</pdfaProperty:description></rdf:li>
                <rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Factur-X version</pdfaProperty:description></rdf:li>
                <rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Factur-X conformance level</pdfaProperty:description></rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function generateFacturXPDF(
  _jsPdfDoc: { output: (type: 'arraybuffer') => ArrayBuffer },
  options: FacturXOptions,
): Promise<Uint8Array> {
  const profile = options.profile ?? 'BASIC';
  const xmlString = generateFacturXXML({ ...options, profile });
  const readablePdf = await createReadableInvoicePdf({ ...options, profile });
  return embedFacturXInPDF(readablePdf, xmlString, profile, options.iccProfileBytes);
}

export async function inspectFacturXPDF(pdfBytes: Uint8Array | ArrayBuffer): Promise<FacturXPackageInfo> {
  const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, PDFHexString, decodePDFRawStream } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const catalog = pdfDoc.catalog;
  const result: FacturXPackageInfo = {
    hasFacturXXml: false,
    hasCatalogAF: catalog.has(PDFName.of('AF')),
    hasOutputIntent: catalog.has(PDFName.of('OutputIntents')),
    hasXmpMetadata: catalog.has(PDFName.of('Metadata')),
  };

  if (result.hasXmpMetadata) {
    const metadata = pdfDoc.context.lookup(catalog.get(PDFName.of('Metadata')));
    if (metadata instanceof PDFRawStream) {
      result.xmpMetadata = new TextDecoder().decode(metadata.getContents());
    }
  }

  const namesMaybe = catalog.get(PDFName.of('Names'));
  if (!namesMaybe) return result;
  const names = pdfDoc.context.lookup(namesMaybe, PDFDict);
  const embeddedFilesMaybe = names.get(PDFName.of('EmbeddedFiles'));
  if (!embeddedFilesMaybe) return result;
  const embeddedFiles = pdfDoc.context.lookup(embeddedFilesMaybe, PDFDict);
  const efNames = embeddedFiles.lookup(PDFName.of('Names'), PDFArray);

  for (let index = 0; index < efNames.size(); index += 2) {
    const nameObj = efNames.get(index);
    const fileName = nameObj instanceof PDFHexString ? nameObj.decodeText() : String(nameObj);
    const fileSpec = pdfDoc.context.lookup(efNames.get(index + 1), PDFDict);
    if (fileName !== 'factur-x.xml') continue;

    result.embeddedFileName = fileName;
    result.hasFacturXXml = true;
    const af = fileSpec.get(PDFName.of('AFRelationship'));
    result.afRelationship = af ? af.toString().replace(/^\//, '') : undefined;
    const ef = fileSpec.lookup(PDFName.of('EF'), PDFDict);
    const xmlStream = pdfDoc.context.lookup(ef.get(PDFName.of('F')));
    if (xmlStream instanceof PDFRawStream) {
      result.embeddedXml = new TextDecoder().decode(decodePDFRawStream(xmlStream).decode());
    }
    break;
  }

  return result;
}
