/**
 * Chorus Pro (PPF) — Vercel Serverless Function
 * 
 * Submits invoices to the French public e-invoicing platform (PPF) via 
 * the PISTE API gateway (api.piste.gouv.fr).
 * 
 * Endpoints:
 *   POST /api/chorus — Submit a Factur-X invoice
 *   GET  /api/chorus?action=status&fluxId=xxx — Check submission status
 * 
 * Required env vars:
 *   CHORUS_LOGIN, CHORUS_PASSWORD, CHORUS_PISTE_CLIENT_ID, CHORUS_PISTE_SECRET
 */

// ---------- Types ----------

interface ChorusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

interface InvoicePayload {
  id: string;
  number: string;
  type: 'invoice' | 'quote' | 'deposit' | 'credit';
  date: string;
  dueDate: string;
  clientName: string;
  clientSiren?: string;
  clientVatNumber?: string;
  clientAddress?: string;
  vatRegime?: 'standard' | 'franchise' | 'autoliquidation';
  items: InvoiceItem[];
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
}

interface CompanyPayload {
  name: string;
  siret?: string;
  vatNumber?: string;
  address?: string;
  legalForm?: string;
  capital?: number;
  defaultCurrency?: string;
  vatRegime?: 'standard' | 'franchise' | 'autoliquidation';
}

// ---------- Config ----------

const IS_SANDBOX = process.env.USE_CHORUS_SANDBOX !== 'false'; // Default to true if not set to false

const PISTE_TOKEN_URL = IS_SANDBOX 
  ? 'https://sandbox-oauth.piste.gouv.fr/api/oauth/token'
  : 'https://oauth.piste.gouv.fr/api/oauth/token';

const CHORUS_BASE_URL = IS_SANDBOX
  ? 'https://cpro.sandbox.developer.aife.economie.gouv.fr/cpro/transverses/v1'
  : 'https://chorus-pro.gouv.fr/cpro/transverses/v1';

const CHORUS_FLUX_URL = IS_SANDBOX
  ? 'https://cpro.sandbox.developer.aife.economie.gouv.fr/cpro/factures/v1/deposer/flux'
  : 'https://chorus-pro.gouv.fr/cpro/factures/v1/deposer/flux';

// ---------- Auth ----------

async function getChorusToken(): Promise<string> {
  const clientId = process.env.CHORUS_PISTE_CLIENT_ID;
  const clientSecret = process.env.CHORUS_PISTE_SECRET;
  const login = process.env.CHORUS_LOGIN;
  const password = process.env.CHORUS_PASSWORD;

  if (!clientId || !clientSecret || !login || !password) {
    throw new Error('Missing Chorus Pro credentials in environment variables');
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'openid',
  });

  const response = await fetch(PISTE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 400 && text.includes('invalid_client')) {
      throw new Error('Chorus Pro: identifiants non configurés. Configurez CHORUS_PISTE_CLIENT_ID, CHORUS_PISTE_SECRET, CHORUS_LOGIN et CHORUS_PASSWORD dans les variables d\'environnement Vercel.');
    }
    throw new Error(`Chorus Pro auth failed (${response.status}): ${text}`);
  }

  const data: ChorusTokenResponse = await response.json();
  return data.access_token;
}

// ---------- XML escaping ----------

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------- CII XML Generator ----------

function generateCIIXml(invoice: InvoicePayload, company: CompanyPayload): string {
  const vatRegime = invoice.vatRegime || company.vatRegime || 'standard';
  
  function getTypeCode(type: string): string {
    switch (type) {
      case 'credit': return '381';
      case 'deposit': return '386';
      default: return '380';
    }
  }

  function getVatCategoryCode(rate: number): string {
    if (vatRegime === 'franchise') return 'E';
    if (vatRegime === 'autoliquidation') return 'AE';
    if (rate === 0) return 'Z';
    return 'S';
  }

  const dateFormatted = invoice.date.replace(/-/g, '');
  const dueDateFormatted = invoice.dueDate.replace(/-/g, '');
  const currency = company.defaultCurrency || 'EUR';

  // Line items
  let linesXml = '';
  invoice.items.forEach((item, idx) => {
    const lineTotal = item.quantity * item.unitPrice;
    const effectiveRate = vatRegime === 'standard' ? item.vatRate : 0;

    linesXml += `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
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
          <ram:CategoryCode>${getVatCategoryCode(effectiveRate)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${effectiveRate.toFixed(2)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${lineTotal.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  });

  // VAT summary
  const vatGroups = new Map<number, { base: number; tax: number }>();
  invoice.items.forEach(item => {
    const effectiveRate = vatRegime === 'standard' ? item.vatRate : 0;
    const lineTotal = item.quantity * item.unitPrice;
    const existing = vatGroups.get(effectiveRate) || { base: 0, tax: 0 };
    existing.base += lineTotal;
    existing.tax += lineTotal * (effectiveRate / 100);
    vatGroups.set(effectiveRate, existing);
  });

  let taxXml = '';
  vatGroups.forEach((amounts, rate) => {
    taxXml += `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amounts.tax.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${amounts.base.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>${getVatCategoryCode(rate)}</ram:CategoryCode>
        <ram:RateApplicablePercent>${rate.toFixed(2)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`;
  });

  // Company address
  const companyParts = (company.address || '').split(',').map(s => s.trim());

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xmlEscape(invoice.number)}</ram:ID>
    <ram:TypeCode>${getTypeCode(invoice.type)}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dateFormatted}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${linesXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${xmlEscape(invoice.number)}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${xmlEscape(company.name)}</ram:Name>${company.siret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${xmlEscape(company.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          <ram:LineOne>${xmlEscape(companyParts[0] || '')}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${company.vatNumber ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${xmlEscape(company.vatNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xmlEscape(invoice.clientName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${xmlEscape((invoice.clientAddress || '').split(',')[0] || '')}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${invoice.clientVatNumber ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${xmlEscape(invoice.clientVatNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>${taxXml}
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDateFormatted}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${invoice.totalHT.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${invoice.totalHT.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${invoice.totalVAT.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${invoice.totalTTC.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${invoice.totalTTC.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

// ---------- Submit to Chorus Pro ----------

async function submitToChorusPro(xmlContent: string, token: string): Promise<any> {
  // Convert XML to Base64
  const xmlBase64 = Buffer.from(xmlContent, 'utf-8').toString('base64');

  const payload = {
    fichierFlux: xmlBase64,
    nomFichier: 'factur-x.xml',
    syntaxeFlux: 'IN_DP_E2_CII_FACTURX',
    avecSignature: false,
  };

  const response = await fetch(CHORUS_FLUX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'cpro-account': process.env.CHORUS_LOGIN || '',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Chorus Pro submission failed (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

// ---------- Check Flux Status ----------

async function checkFluxStatus(fluxId: string, token: string): Promise<any> {
  const response = await fetch(`${CHORUS_BASE_URL}/consulterCR?identifiantFlux=${fluxId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'cpro-account': process.env.CHORUS_LOGIN || '',
    },
    body: JSON.stringify({ identifiantFlux: fluxId }),
  });

  const data = await response.json();
  return data;
}

// ---------- Handler ----------

export default async function handler(req: any, res: any) {
  // POST: Submit invoice
  if (req.method === 'POST') {
    try {
      const { invoice, company } = req.body as {
        invoice: InvoicePayload;
        company: CompanyPayload;
      };

      if (!invoice || !company) {
        return res.status(400).json({ error: 'Missing invoice or company data' });
      }

      // Validate: only invoices subject to e-invoicing
      if (invoice.type === 'quote') {
        return res.status(400).json({ error: 'Les devis ne sont pas concern\u00e9s par la facturation \u00e9lectronique' });
      }
      if (invoice.vatRegime === 'franchise') {
        return res.status(400).json({ error: 'Les entreprises en franchise de TVA sont exempt\u00e9es du d\u00e9p\u00f4t Chorus Pro' });
      }

      // 1. Get auth token
      const token = await getChorusToken();

      // 2. Generate CII XML
      const xml = generateCIIXml(invoice, company);

      // 3. Submit to Chorus Pro
      const result = await submitToChorusPro(xml, token);

      return res.status(200).json({
        success: true,
        identifiantFlux: result.identifiantFlux || result.numeroFluxDepot,
        codeRetour: result.codeRetour || 0,
        dateDepot: new Date().toISOString(),
        rawResponse: result,
      });
    } catch (error: any) {
      console.error('[Chorus Pro] Error:', error);
      return res.status(500).json({
        error: error.message,
        details: 'La soumission à Chorus Pro a échoué. Vérifiez vos identifiants.',
      });
    }
  }

  // GET: Check status
  if (req.method === 'GET') {
    const { action, fluxId } = req.query;

    if (action === 'status' && fluxId) {
      try {
        const token = await getChorusToken();
        const result = await checkFluxStatus(fluxId as string, token);
        return res.status(200).json({ success: true, ...result });
      } catch (error: any) {
        return res.status(500).json({ error: error.message });
      }
    }

    return res.status(400).json({ error: 'Missing action or fluxId parameter' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
