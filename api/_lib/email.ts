import { escapeHtml, isEmail, sanitizeText } from './validators.js';

export function verifiedFromEmail() {
  return extractEmailAddress(process.env.RESEND_FROM_EMAIL || 'factures@photofacto.fr');
}

export async function sendResendEmail(payload: {
  to: string[];
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string }>;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY missing');
  const cleanTo = payload.to.filter(isEmail);
  if (!cleanTo.length) throw new Error('No valid recipient');
  const senderName = sanitizeEmailName(payload.fromName || 'Photofacto');
  const body: Record<string, any> = {
    from: `${senderName}${senderName.toLowerCase().includes('photofacto') ? '' : ' via Photofacto'} <${verifiedFromEmail()}>`,
    to: cleanTo,
    subject: sanitizeText(payload.subject, 160),
    html: payload.html,
  };
  if (payload.replyTo && isEmail(payload.replyTo)) body.reply_to = payload.replyTo;
  if (payload.attachments?.length) body.attachments = payload.attachments;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || data?.error?.message || data?.error || 'Resend refused email');
    (error as any).status = response.status;
    throw error;
  }
  return data;
}

export function buildContactHtml(input: { name: string; email: string; phone?: string; message: string }) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937">
      <p><strong>Nouveau message Photofacto</strong></p>
      <p><strong>Nom :</strong> ${escapeHtml(input.name)}</p>
      <p><strong>Email :</strong> ${escapeHtml(input.email)}</p>
      ${input.phone ? `<p><strong>Téléphone :</strong> ${escapeHtml(input.phone)}</p>` : ''}
      <p><strong>Message :</strong></p>
      <p>${escapeHtml(input.message).replace(/\n/g, '<br/>')}</p>
    </div>
  `;
}

function sanitizeEmailName(value: string): string {
  return String(value || '').replace(/[<>"\r\n]/g, '').trim().slice(0, 80) || 'Photofacto';
}

function extractEmailAddress(value: string): string {
  const raw = String(value || '').trim();
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw || 'factures@photofacto.fr').trim();
}

