export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.error('send-email: RESEND_API_KEY missing on Vercel.');
    return res.status(500).json({
      error: 'La clé API Resend est manquante sur Vercel. Demandez au support.',
    });
  }

  try {
    let body: any = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e: any) {
        return res.status(400).json({ error: 'Corps JSON invalide.', detail: e.message });
      }
    }
    body = body || {};

    const { to, subject, attachments, fromEmail, fromName, message } = body;
    const recipients = Array.isArray(to) ? to : [to];
    const cleanRecipients = recipients.filter((email) => typeof email === 'string' && email.trim());
    if (cleanRecipients.length === 0) {
      return res.status(400).json({ error: 'Adresse e-mail destinataire manquante.' });
    }
    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({ error: 'Sujet de l’e-mail manquant.' });
    }

    const html = typeof body.html === 'string' && body.html.trim()
      ? body.html
      : buildContactHtml({ fromName, fromEmail, message });
    if (!html) {
      return res.status(400).json({ error: 'Contenu de l’e-mail manquant.' });
    }

    const verifiedFrom = extractEmailAddress(process.env.RESEND_FROM_EMAIL || 'factures@photofacto.fr');
    const senderName = sanitizeEmailName(fromName || 'Photofacto');
    const emailPayload: Record<string, any> = {
      from: `${senderName}${senderName.toLowerCase().includes('photofacto') ? '' : ' via Photofacto'} <${verifiedFrom}>`,
      to: cleanRecipients,
      subject,
      html,
    };
    if (fromEmail && typeof fromEmail === 'string') {
      emailPayload.reply_to = fromEmail;
    }
    if (Array.isArray(attachments) && attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = data?.message || data?.error?.message || data?.error || JSON.stringify(data);
      console.error('send-email: Resend error', response.status, detail);
      return res.status(response.status).json({
        error: humanResendError(detail),
        detail,
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: err.message || 'Erreur serveur lors de l’envoi.' });
  }
}

function sanitizeEmailName(value: string): string {
  return String(value || '')
    .replace(/[<>"\r\n]/g, '')
    .trim()
    .slice(0, 80) || 'Photofacto';
}

function extractEmailAddress(value: string): string {
  const raw = String(value || '').trim();
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw || 'factures@photofacto.fr').trim();
}

function buildContactHtml({ fromName, fromEmail, message }: Record<string, any>): string {
  if (!message || typeof message !== 'string') return '';
  const safeName = escapeHtml(fromName || 'Visiteur');
  const safeEmail = escapeHtml(fromEmail || '');
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
      <p><strong>Nouveau message Photofacto</strong></p>
      <p><strong>Nom :</strong> ${safeName}</p>
      ${safeEmail ? `<p><strong>Email :</strong> ${safeEmail}</p>` : ''}
      <p><strong>Message :</strong></p>
      <p>${safeMessage}</p>
    </div>
  `;
}

function escapeHtml(value: any): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function humanResendError(detail: string): string {
  const lower = String(detail || '').toLowerCase();
  if (lower.includes('domain') && (lower.includes('verify') || lower.includes('verified'))) {
    return 'Le domaine d’envoi Resend n’est pas encore vérifié. Vérifiez RESEND_FROM_EMAIL / le domaine dans Resend.';
  }
  if (lower.includes('api key') || lower.includes('unauthorized')) {
    return 'La clé Resend est invalide ou non autorisée.';
  }
  if (lower.includes('to') || lower.includes('recipient') || lower.includes('email')) {
    return 'Adresse e-mail destinataire invalide ou refusée par Resend.';
  }
  if (lower.includes('attachment')) {
    return 'La pièce jointe PDF est invalide ou trop lourde pour l’envoi.';
  }
  return detail || 'Resend a refusé l’envoi de l’e-mail.';
}
