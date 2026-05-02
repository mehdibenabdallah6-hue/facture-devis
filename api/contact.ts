import { applyCors, badRequest, methodNotAllowed, ok, parseJsonBody, serverError, tooManyRequests } from './_lib/http.js';
import { buildContactHtml, sendResendEmail } from './_lib/email.js';
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js';
import { isEmail, sanitizeText } from './_lib/validators.js';

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const ip = getClientIp(req);
    const limited = await checkRateLimit(`ip:contact:${ip}`, 5, 60 * 60 * 1000);
    if (!limited.ok) return tooManyRequests(res, 'Trop de messages envoyés. Réessayez plus tard.');

    const body = parseJsonBody(req);
    if (body.website || body.companyWebsite) return ok(res, { success: true });

    const name = sanitizeText(body.name || body.fromName, 120);
    const email = sanitizeText(body.email || body.fromEmail, 254);
    const phone = sanitizeText(body.phone, 50);
    const message = sanitizeText(body.message, 3000);
    const subject = sanitizeText(body.subject, 120) || 'Message Photofacto';
    const to = process.env.CONTACT_TO_EMAIL || 'contact@photofacto.fr';

    if (!name || !isEmail(email) || !message) {
      return badRequest(res, 'Nom, email valide et message sont requis.');
    }

    await sendResendEmail({
      to: [to],
      fromName: 'Photofacto',
      replyTo: email,
      subject: `[Photofacto] ${subject}`,
      html: buildContactHtml({ name, email, phone, message }),
    });

    return ok(res, { success: true });
  } catch (error) {
    return serverError(res, error);
  }
}

