/**
 * Pennylane API integration — Vercel Serverless Function
 * 
 * Alternative to Chorus Pro. Pennylane is a candidate PDP (Plateforme de
 * Dématérialisation Partenaire) that handles Factur-X conversion and PPF
 * transmission on behalf of the supplier.
 * 
 * Endpoints:
 *   POST /api/pennylane — Create an invoice on Pennylane
 * 
 * Required env vars:
 *   PENNYLANE_API_KEY
 * 
 * Docs: https://pennylane.readme.io/reference
 */

const PENNYLANE_BASE_URL = 'https://app.pennylane.com/api/external/v2';

interface PennylaneInvoicePayload {
  invoice: {
    number: string;
    type: string;
    date: string;
    dueDate: string;
    clientName: string;
    clientSiren?: string;
    clientVatNumber?: string;
    clientAddress?: string;
    vatRegime?: string;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      vatRate: number;
    }>;
    totalHT: number;
    totalVAT: number;
    totalTTC: number;
    notes?: string;
  };
  company: {
    name: string;
    siret?: string;
    vatNumber?: string;
    address?: string;
    legalForm?: string;
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY;

  if (!PENNYLANE_API_KEY) {
    console.error('Missing PENNYLANE_API_KEY');
    return res.status(500).json({ error: 'Clé API Pennylane manquante. Configurez PENNYLANE_API_KEY dans Vercel.' });
  }

  try {
    const { invoice, company } = req.body as PennylaneInvoicePayload;

    if (!invoice || !company) {
      return res.status(400).json({ error: 'Missing invoice or company data' });
    }

    // Build Pennylane invoice payload
    const pennylanePayload = {
      invoice: {
        date: invoice.date,
        deadline: invoice.dueDate,
        label: `Facture ${invoice.number}`,
        external_id: invoice.number,
        currency: 'EUR',
        customer: {
          name: invoice.clientName,
          address: invoice.clientAddress || '',
          country_alpha2: 'FR',
          ...(invoice.clientSiren && { reg_no: invoice.clientSiren }),
          ...(invoice.clientVatNumber && { vat_number: invoice.clientVatNumber }),
        },
        line_items: invoice.items.map((item, idx) => ({
          label: item.description,
          quantity: item.quantity,
          unit: 'piece',
          vat_rate: `FR_${item.vatRate === 20 ? '200' : item.vatRate === 10 ? '100' : item.vatRate === 5.5 ? '55' : '0'}`,
          currency_amount: item.unitPrice,
          currency_price_before_tax: item.unitPrice,
          plan_item_number: `411000`, // Default accounts receivable
        })),
        // Pennylane-specific options
        paid: false,
        is_draft: false,
        special_mention: invoice.vatRegime === 'franchise' 
          ? 'TVA non applicable, art. 293 B du CGI' 
          : invoice.vatRegime === 'autoliquidation'
          ? 'Autoliquidation de la TVA (Art. 283-2 nonies du CGI)'
          : undefined,
      }
    };

    // Submit to Pennylane
    const response = await fetch(`${PENNYLANE_BASE_URL}/customer_invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${PENNYLANE_API_KEY}`,
      },
      body: JSON.stringify(pennylanePayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Pennylane] API Error:', data);
      return res.status(response.status).json({
        error: 'Erreur Pennylane',
        details: data.message || data.error || JSON.stringify(data),
      });
    }

    return res.status(200).json({
      success: true,
      pennylaneInvoiceId: data.invoice?.id || data.id,
      pennylaneStatus: data.invoice?.status || 'created',
      pennylaneUrl: data.invoice?.public_url || null,
      rawResponse: data,
    });

  } catch (error: any) {
    console.error('[Pennylane] Error:', error);
    return res.status(500).json({
      error: error.message,
      details: 'La soumission à Pennylane a échoué.',
    });
  }
}
