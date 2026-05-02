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
import { verifyAuth } from './_lib/auth.js';
import { ensureFirebaseAdmin } from './_lib/firebaseAdmin.js';
import { parseJsonBody } from './_lib/http.js';
import { checkRateLimit } from './_lib/rateLimit.js';
import { writeAuditEvent } from './_lib/audit.js';
import { sanitizeText } from './_lib/validators.js';

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

  let authCtx: { uid: string; email?: string };
  try {
    authCtx = await verifyAuth(req);
  } catch (e: any) {
    return res.status(e.status || 401).json({ error: e.message || 'Unauthorized' });
  }

  try {
    const limited = await checkRateLimit(`uid:pennylane:${authCtx.uid}`, 10, 60 * 60 * 1000);
    if (!limited.ok) return res.status(429).json({ error: 'Trop de demandes Pennylane récemment.' });

    const PENNYLANE_API_KEY = process.env.PENNYLANE_API_KEY;
    const body = parseJsonBody(req);
    const invoiceId = sanitizeText(body.invoiceId, 120);
    if (!invoiceId) return res.status(400).json({ error: 'invoiceId requis' });

    const { invoice } = await loadOwnedPennylanePayload(invoiceId, authCtx.uid);

    if (!PENNYLANE_API_KEY) {
      await writeAuditEvent({
        ownerId: authCtx.uid,
        actorUid: authCtx.uid,
        type: 'integration_export_requested',
        resourceType: 'invoice',
        resourceId: invoiceId,
        metadata: { integration: 'pennylane', status: 'not_configured' },
      });
      return res.status(501).json({ error: 'Connecteur Pennylane non encore activé.', prepared: true });
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
      await writeAuditEvent({
        ownerId: authCtx.uid,
        actorUid: authCtx.uid,
        type: 'integration_export_failed',
        resourceType: 'invoice',
        resourceId: invoiceId,
        metadata: { integration: 'pennylane', status: response.status },
      }).catch(() => undefined);
      return res.status(response.status).json({
        error: 'Erreur Pennylane',
        details: data.message || data.error || JSON.stringify(data),
      });
    }

    await writeAuditEvent({
      ownerId: authCtx.uid,
      actorUid: authCtx.uid,
      type: 'integration_export_succeeded',
      resourceType: 'invoice',
      resourceId: invoiceId,
      metadata: { integration: 'pennylane', pennylaneInvoiceId: data.invoice?.id || data.id || '' },
    });

    return res.status(200).json({
      success: true,
      pennylaneInvoiceId: data.invoice?.id || data.id,
      pennylaneStatus: data.invoice?.status || 'created',
      pennylaneUrl: data.invoice?.public_url || null,
      rawResponse: data,
    });

  } catch (error: any) {
    console.error('[Pennylane] Error:', error);
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({
      error: error.message,
      details: 'La soumission à Pennylane a échoué.',
    });
  }
}

async function loadOwnedPennylanePayload(invoiceId: string, uid: string): Promise<PennylaneInvoicePayload> {
  const { db } = ensureFirebaseAdmin();
  const invoiceSnap = await db.collection('invoices').doc(invoiceId).get();
  if (!invoiceSnap.exists) throw Object.assign(new Error('Facture introuvable.'), { status: 404 });
  const rawInvoice = invoiceSnap.data() as any;
  if (rawInvoice.ownerId !== uid) throw Object.assign(new Error('Accès interdit.'), { status: 403 });

  const companySnap = await db.collection('companies').doc(uid).get();
  const company = companySnap.exists ? (companySnap.data() as any) : {};
  const clientSnap = rawInvoice.clientId ? await db.collection('clients').doc(rawInvoice.clientId).get() : null;
  const client = clientSnap?.exists ? (clientSnap.data() as any) : {};

  return {
    invoice: {
      number: rawInvoice.number || '',
      type: rawInvoice.type || 'invoice',
      date: rawInvoice.date || '',
      dueDate: rawInvoice.dueDate || rawInvoice.date || '',
      clientName: rawInvoice.clientName || client.name || '',
      clientSiren: client.siren || '',
      clientVatNumber: client.vatNumber || '',
      clientAddress: client.address || '',
      vatRegime: rawInvoice.vatRegime || company.vatRegime || 'standard',
      items: Array.isArray(rawInvoice.items) ? rawInvoice.items : [],
      totalHT: Number(rawInvoice.totalHT || 0),
      totalVAT: Number(rawInvoice.totalVAT || 0),
      totalTTC: Number(rawInvoice.totalTTC || 0),
      notes: rawInvoice.notes || '',
    },
    company: {
      name: company.name || company.legalName || '',
      siret: company.siret || '',
      vatNumber: company.vatNumber || '',
      address: company.address || '',
      legalForm: company.legalForm || '',
    },
  };
}
