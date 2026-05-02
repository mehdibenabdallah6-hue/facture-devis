/**
 * Factur-X / ZUGFeRD export helper.
 * 
 * Generates CII XML and embeds it into an existing jsPDF-generated PDF using
 * pdf-lib. This is an export aid, not a legal certification: full PDF/A-3b
 * conformance still needs external validation and an ICC OutputIntent.
 * 
 * References:
 * - https://fnfe-mpe.org/factur-x/
 * - UN/CEFACT CII D16B
 */

import { Invoice, InvoiceItem, CompanySettings, Client } from '../contexts/DataContext';

// ---------- Types ----------

export interface FacturXOptions {
  invoice: Invoice;
  company: CompanySettings;
  client?: Client;
  profile?: 'MINIMUM' | 'BASIC';
}

export const FACTURX_TECHNICAL_STATUS = {
  facturxStatus: 'generated' as const,
  pdfAStatus: 'not_validated' as const,
};

// ---------- XML Escaping ----------

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------- Helpers ----------

function formatDateCII(dateStr: string): string {
  // Input: "2026-04-10" → Output: "20260410" (CII DateString format 102)
  return dateStr.replace(/-/g, '');
}

function getDocumentTypeCode(type: Invoice['type']): string {
  switch (type) {
    case 'invoice': return '380'; // Commercial Invoice
    case 'credit': return '381';  // Credit Note
    case 'deposit': return '386'; // Prepayment Invoice
    default: return '380';
  }
}

function getVatCategoryCode(vatRegime: string | undefined, vatRate: number): string {
  if (vatRegime === 'franchise') return 'E';         // Exempt
  if (vatRegime === 'autoliquidation') return 'AE';  // Reverse charge
  if (vatRate === 0) return 'Z';                     // Zero rated
  return 'S';                                         // Standard
}

function getVatExemptionReason(vatRegime: string | undefined): string {
  if (vatRegime === 'franchise') return 'TVA non applicable, art. 293 B du CGI';
  if (vatRegime === 'autoliquidation') return 'Autoliquidation de la TVA (Art. 283-2 nonies du CGI)';
  return '';
}

/**
 * Parse a free-form French address into {street, postcode, city}.
 *
 * French postcodes are strictly 5 digits (incl. overseas 97xxx / 98xxx),
 * which lets us locate the postcode in any segment regardless of layout.
 * Supported inputs (all real-world artisan entries):
 *
 *   "12 rue Lafayette, 75001 Paris"          → 12 rue Lafayette / 75001 / Paris
 *   "12 rue Lafayette\n75001 Paris"          → 12 rue Lafayette / 75001 / Paris
 *   "12 rue Lafayette, 75001, Paris"         → 12 rue Lafayette / 75001 / Paris
 *   "75001 Paris"                            →                / 75001 / Paris
 *   "12 rue Lafayette"                       → 12 rue Lafayette /       /
 *
 * If no postcode is detected, the whole input is returned as street.
 */
export function parseFrenchAddress(raw: string): { street: string; postcode: string; city: string } {
  const trimmed = (raw || '').trim();
  if (!trimmed) return { street: '', postcode: '', city: '' };

  // Normalize separators (commas, line breaks) into a single split point.
  const segments = trimmed
    .split(/[,\n;]+/g)
    .map(s => s.trim())
    .filter(Boolean);

  // Find a segment containing a 5-digit chunk — that's our postcode line.
  const postcodeRegex = /\b(\d{5})\b/;
  const postcodeIndex = segments.findIndex(s => postcodeRegex.test(s));

  if (postcodeIndex === -1) {
    return { street: trimmed.replace(/\s*\n\s*/g, ' '), postcode: '', city: '' };
  }

  const postcodeSegment = segments[postcodeIndex];
  const match = postcodeSegment.match(postcodeRegex);
  const postcode = match ? match[1] : '';

  // City = remainder of the postcode segment after stripping the postcode,
  // optionally joined with whatever comes after on the next segment.
  let city = postcodeSegment.replace(postcode, '').trim();
  if (!city && segments[postcodeIndex + 1]) {
    city = segments[postcodeIndex + 1];
  } else if (segments[postcodeIndex + 1] && city) {
    // "75001, Paris" came in as two segments — fall back to the next one
    // only when the postcode segment was just digits.
    if (/^\d{5}$/.test(postcodeSegment)) city = segments[postcodeIndex + 1];
  }

  // Street = everything before the postcode segment, joined.
  const street = segments.slice(0, postcodeIndex).join(', ').trim();

  return { street, postcode, city };
}

// ---------- XML Generator ----------

export function generateFacturXXML(options: FacturXOptions): string {
  const { invoice, company, client, profile = 'MINIMUM' } = options;
  
  const items = invoice.items || [];
  const vatRegime = invoice.vatRegime || company.vatRegime || 'standard';
  
  // Group items by VAT rate for tax summary
  const vatGroups = new Map<number, { baseAmount: number; taxAmount: number }>();
  items.forEach(item => {
    const lineTotal = item.quantity * item.unitPrice;
    const effectiveRate = vatRegime === 'standard' ? item.vatRate : 0;
    const existing = vatGroups.get(effectiveRate) || { baseAmount: 0, taxAmount: 0 };
    existing.baseAmount += lineTotal;
    existing.taxAmount += lineTotal * (effectiveRate / 100);
    vatGroups.set(effectiveRate, existing);
  });

  const totalHT = invoice.totalHT;
  const totalVAT = invoice.totalVAT;
  const totalTTC = invoice.totalTTC;

  // Build line items XML (BASIC profile only)
  let lineItemsXml = '';
  if (profile === 'BASIC') {
    items.forEach((item, index) => {
      const lineTotal = item.quantity * item.unitPrice;
      const effectiveRate = vatRegime === 'standard' ? item.vatRate : 0;
      const lineTax = lineTotal * (effectiveRate / 100);
      
      lineItemsXml += `
        <ram:IncludedSupplyChainTradeLineItem>
          <ram:AssociatedDocumentLineDocument>
            <ram:LineID>${index + 1}</ram:LineID>
          </ram:AssociatedDocumentLineDocument>
          <ram:SpecifiedTradeProduct>
            <ram:Name>${xmlEscape(item.description)}</ram:Name>
          </ram:SpecifiedTradeProduct>
          <ram:SpecifiedLineTradeAgreement>
            <ram:NetPriceProductTradePrice>
              <ram:ChargeAmount>${item.unitPrice.toFixed(2)}</ram:ChargeAmount>
            </ram:NetPriceProductTradePrice>
          </ram:SpecifiedLineTradeAgreement>
          <ram:SpecifiedLineTradeDelivery>
            <ram:BilledQuantity unitCode="C62">${item.quantity.toFixed(2)}</ram:BilledQuantity>
          </ram:SpecifiedLineTradeDelivery>
          <ram:SpecifiedLineTradeSettlement>
            <ram:ApplicableTradeTax>
              <ram:TypeCode>VAT</ram:TypeCode>
              <ram:CategoryCode>${getVatCategoryCode(vatRegime, effectiveRate)}</ram:CategoryCode>
              <ram:RateApplicablePercent>${effectiveRate.toFixed(2)}</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>
            <ram:SpecifiedTradeSettlementLineMonetarySummation>
              <ram:LineTotalAmount>${lineTotal.toFixed(2)}</ram:LineTotalAmount>
            </ram:SpecifiedTradeSettlementLineMonetarySummation>
          </ram:SpecifiedLineTradeSettlement>
        </ram:IncludedSupplyChainTradeLineItem>`;
    });
  }

  // Build VAT breakdown
  let taxBreakdownXml = '';
  vatGroups.forEach((amounts, rate) => {
    const exemptionReason = getVatExemptionReason(vatRegime);
    taxBreakdownXml += `
          <ram:ApplicableTradeTax>
            <ram:CalculatedAmount>${amounts.taxAmount.toFixed(2)}</ram:CalculatedAmount>
            <ram:TypeCode>VAT</ram:TypeCode>${exemptionReason ? `
            <ram:ExemptionReason>${xmlEscape(exemptionReason)}</ram:ExemptionReason>` : ''}
            <ram:BasisAmount>${amounts.baseAmount.toFixed(2)}</ram:BasisAmount>
            <ram:CategoryCode>${getVatCategoryCode(vatRegime, rate)}</ram:CategoryCode>
            <ram:RateApplicablePercent>${rate.toFixed(2)}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>`;
  });

  // Parse address into components.
  // The previous implementation assumed a 3-part comma-separated layout
  // ("rue, code postal, ville") which broke for the much more common French
  // 2-part form "12 rue X, 75001 Paris" — postcode then ended up empty and
  // the city captured the whole "75001 Paris" string. We now use a postcode
  // detector that scans every segment for a 5-digit chunk (FR postcodes are
  // strictly 5 digits, including overseas: 97xxx / 98xxx).
  const company_ = parseFrenchAddress(company.address || '');
  const companyStreet = company_.street;
  const companyCity = company_.city;
  const companyPostcode = company_.postcode;

  const clientName = client?.name || invoice.clientName || 'Client';
  const client_ = parseFrenchAddress(client?.address || '');
  const clientStreet = client_.street;
  const clientCity = client_.city;
  const clientPostcode = client_.postcode;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:${profile.toLowerCase()}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${xmlEscape(invoice.number)}</ram:ID>
    <ram:TypeCode>${getDocumentTypeCode(invoice.type)}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDateCII(invoice.date)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>${lineItemsXml}

    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${xmlEscape(invoice.number)}</ram:BuyerReference>

      <ram:SellerTradeParty>
        <ram:Name>${xmlEscape(company.name)}</ram:Name>${company.siret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${xmlEscape(company.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          <ram:LineOne>${xmlEscape(companyStreet)}</ram:LineOne>${companyPostcode ? `
          <ram:PostcodeCode>${xmlEscape(companyPostcode)}</ram:PostcodeCode>` : ''}
          <ram:CityName>${xmlEscape(companyCity)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${company.vatNumber ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${xmlEscape(company.vatNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>

      <ram:BuyerTradeParty>
        <ram:Name>${xmlEscape(clientName)}</ram:Name>${client?.siren ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${xmlEscape(client.siren)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          <ram:LineOne>${xmlEscape(clientStreet)}</ram:LineOne>${clientPostcode ? `
          <ram:PostcodeCode>${xmlEscape(clientPostcode)}</ram:PostcodeCode>` : ''}
          <ram:CityName>${xmlEscape(clientCity)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${client?.vatNumber ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${xmlEscape(client.vatNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${company.defaultCurrency || 'EUR'}</ram:InvoiceCurrencyCode>
${taxBreakdownXml}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${totalHT.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${totalHT.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${company.defaultCurrency || 'EUR'}">${totalVAT.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${totalTTC.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${totalTTC.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  return xml;
}

// ---------- PDF Embedding via pdf-lib ----------

/**
 * Takes a jsPDF-generated PDF as ArrayBuffer and embeds the Factur-X XML as an attachment.
 * Returns a new ArrayBuffer with the embedded XML (valid Factur-X PDF).
 */
export async function embedFacturXInPDF(
  pdfBytes: ArrayBuffer,
  xmlString: string,
  profile: 'MINIMUM' | 'BASIC' = 'MINIMUM'
): Promise<Uint8Array> {
  // Dynamic import pdf-lib to keep bundle size reasonable
  const { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, AFRelationship } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Encode XML as UTF-8 bytes
  const encoder = new TextEncoder();
  const xmlBytes = encoder.encode(xmlString);

  // Attach the XML file
  await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Factur-X XML invoice data (CII)',
    afRelationship: AFRelationship.Alternative,
    creationDate: new Date(),
    modificationDate: new Date(),
  });

  // Set PDF metadata for Factur-X conformance
  pdfDoc.setTitle('Factur-X Invoice');
  pdfDoc.setSubject(`Factur-X ${profile} profile`);
  pdfDoc.setProducer('Photofacto - photofacto.fr');
  pdfDoc.setCreator('Photofacto');

  // ---- XMP metadata block ----
  // Full PDF/A-3b conformance also requires an OutputIntents entry with an
  // ICC colour profile, which we don't ship yet (would add ~500 KB). For
  // 2026 e-reporting / Factur-X exchange, the *attached* XML is what gets
  // ingested; conformant XMP gives readers the right namespace hints so
  // they auto-detect the embedded invoice without parsing the PDF body.
  // See https://fnfe-mpe.org/factur-x/ "PDF/A-3 et XMP".
  const xmp = buildFacturXmp(profile);
  const xmpBytes = encoder.encode(xmp);
  const metadataStream = pdfDoc.context.stream(xmpBytes, {
    Type: 'Metadata',
    Subtype: 'XML',
  });
  const metadataRef = pdfDoc.context.register(metadataStream);
  pdfDoc.catalog.set(PDFName.of('Metadata'), metadataRef);

  // Suppress unused-import warning for symbols kept for future PDF/A-3b ICC work.
  void PDFRawStream;
  void decodePDFRawStream;

  const savedPdf = await pdfDoc.save();
  return savedPdf;
}

/**
 * Build a minimal but conformant Factur-X XMP metadata packet.
 * The Factur-X namespace `urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#`
 * lets readers identify the profile/level without opening the attachment.
 */
function buildFacturXmp(profile: 'MINIMUM' | 'BASIC'): string {
  const isoNow = new Date().toISOString();
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
      <fx:ConformanceLevel>${profile}</fx:ConformanceLevel>
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

/**
 * High-level function: takes a jsPDF doc, generates the Factur-X XML,
 * embeds it into the PDF, and returns the final bytes.
 */
export async function generateFacturXPDF(
  jsPdfDoc: any, // jsPDF instance
  options: FacturXOptions
): Promise<Uint8Array> {
  const profile = options.profile ?? 'MINIMUM';

  // 1. Generate CII XML
  const xmlString = generateFacturXXML(options);

  // 2. Get PDF bytes from jsPDF
  const pdfArrayBuffer = jsPdfDoc.output('arraybuffer');

  // 3. Embed XML + write the matching XMP metadata block
  const facturxPdf = await embedFacturXInPDF(pdfArrayBuffer, xmlString, profile);

  return facturxPdf;
}
