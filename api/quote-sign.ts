import { ensureFirebaseAdmin } from './_firebase-admin.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '3mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body: any = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e: any) {
      res.status(400).json({ error: 'Invalid JSON body', detail: e.message });
      return;
    }
  }
  body = body || {};

  const quoteId = typeof body.quoteId === 'string' ? body.quoteId.trim() : '';
  const signerName = typeof body.signerName === 'string' ? body.signerName.trim().slice(0, 120) : '';
  const signatureDataUrl = typeof body.signatureDataUrl === 'string' ? body.signatureDataUrl : '';

  if (!quoteId || !signerName || !signatureDataUrl) {
    res.status(400).json({ error: 'quoteId, signerName and signatureDataUrl are required' });
    return;
  }
  if (!signatureDataUrl.startsWith('data:image/png;base64,')) {
    res.status(400).json({ error: 'Invalid signature format' });
    return;
  }
  if (signatureDataUrl.length > 2_500_000) {
    res.status(413).json({ error: 'Signature trop lourde.' });
    return;
  }

  let db: ReturnType<typeof ensureFirebaseAdmin>['db'];
  try {
    ({ db } = ensureFirebaseAdmin());
  } catch (e: any) {
    console.error('quote-sign: Firebase Admin init failed:', e);
    res.status(500).json({
      error: 'Firebase Admin not configured on the server.',
      detail: e?.message,
    });
    return;
  }

  try {
    const nowIso = new Date().toISOString();
    const sharedRef = db.collection('sharedQuotes').doc(quoteId);

    const result = await db.runTransaction(async tx => {
      const sharedSnap = await tx.get(sharedRef);
      if (!sharedSnap.exists) {
        throw Object.assign(new Error('Quote not found'), { status: 404 });
      }

      const shared = sharedSnap.data() as any;
      const invoiceId = shared.originalInvoiceId;
      const ownerId = shared.ownerId;
      if (!invoiceId || !ownerId) {
        throw Object.assign(new Error('Shared quote is incomplete'), { status: 400 });
      }

      const invoiceRef = db.collection('invoices').doc(invoiceId);
      const eventRef = db.collection('invoiceEvents').doc();

      tx.update(sharedRef, {
        signature: signatureDataUrl,
        signedAt: nowIso,
        signedByName: signerName,
        status: 'accepted',
      });

      tx.update(invoiceRef, {
        status: 'accepted',
        signature: signatureDataUrl,
        signedAt: nowIso,
        signedByName: signerName,
        updatedAt: nowIso,
      });

      tx.set(eventRef, {
        invoiceId,
        ownerId,
        type: 'sign',
        actorId: `public:${quoteId}`,
        timestamp: nowIso,
        metadata: {
          signerName,
          clientName: shared.clientName || '',
          source: 'public_signature_page',
        },
      });

      return {
        invoiceId,
        ownerId,
        number: shared.number || '',
        clientName: shared.clientName || '',
        companyName: shared.companyName || '',
        companyEmail: shared.companyEmail || '',
        totalTTC: shared.totalTTC || 0,
      };
    });

    const notification = await sendSignatureNotification({
      to: result.companyEmail,
      companyName: result.companyName,
      clientName: result.clientName,
      signerName,
      quoteNumber: result.number,
      totalTTC: result.totalTTC,
    });

    res.status(200).json({
      ok: true,
      signedAt: nowIso,
      notification,
      invoiceId: result.invoiceId,
    });
  } catch (e: any) {
    console.error('quote-sign error:', e);
    res.status(e.status || 500).json({ error: e.message || 'Server error' });
  }
}

async function sendSignatureNotification(opts: {
  to: string;
  companyName: string;
  clientName: string;
  signerName: string;
  quoteNumber: string;
  totalTTC: number;
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY || !opts.to) {
    return { sent: false, reason: !opts.to ? 'missing_company_email' : 'missing_resend_key' };
  }

  const verifiedFrom = extractEmailAddress(process.env.RESEND_FROM_EMAIL || 'factures@photofacto.fr');
  const companyName = opts.companyName || 'Votre entreprise';
  const subject = `Devis ${opts.quoteNumber || ''} signé par ${opts.signerName}`.trim();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Photofacto <${verifiedFrom}>`,
      to: [opts.to],
      subject,
      html: buildNotificationHtml({ ...opts, companyName }),
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    console.error('quote-sign: Resend notification failed', response.status, data);
    return { sent: false, reason: 'resend_error', status: response.status };
  }

  return { sent: true };
}

function buildNotificationHtml(opts: {
  companyName: string;
  clientName: string;
  signerName: string;
  quoteNumber: string;
  totalTTC: number;
}) {
  const amount = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(opts.totalTTC || 0);
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:560px">
      <p>Bonjour ${escapeHtml(opts.companyName)},</p>
      <h2 style="margin:0 0 12px;color:#111827">Votre devis a été signé</h2>
      <p>Le devis <strong>${escapeHtml(opts.quoteNumber || 'sans numéro')}</strong> a été signé par <strong>${escapeHtml(opts.signerName)}</strong>.</p>
      <ul>
        <li><strong>Client :</strong> ${escapeHtml(opts.clientName || 'Client')}</li>
        <li><strong>Montant :</strong> ${amount}</li>
      </ul>
      <p>La signature a été ajoutée automatiquement au devis dans Photofacto.</p>
    </div>
  `;
}

function extractEmailAddress(value: string): string {
  const raw = String(value || '').trim();
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw || 'factures@photofacto.fr').trim();
}

function escapeHtml(value: any): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
