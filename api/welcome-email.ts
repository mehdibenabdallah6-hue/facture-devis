import { verifyAuth } from './_lib/auth.js';
import { ensureFirebaseAdmin } from './_lib/firebaseAdmin.js';
import {
  applyCors,
  badRequest,
  methodNotAllowed,
  ok,
  parseJsonBody,
  serverError,
  tooManyRequests,
  unauthorized,
} from './_lib/http.js';
import { checkRateLimit } from './_lib/rateLimit.js';
import { sendResendEmail } from './_lib/email.js';
import { escapeHtml, isEmail, sanitizeText } from './_lib/validators.js';

const RESEND_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return methodNotAllowed(res);

  let authCtx;
  try {
    authCtx = await verifyAuth(req);
  } catch (error: any) {
    return unauthorized(res, error?.message || 'Authentification requise.');
  }

  if (!isEmail(authCtx.email)) return badRequest(res, 'Email utilisateur introuvable.');

  try {
    const limited = await checkRateLimit(`uid:welcome-email:${authCtx.uid}`, 3, 24 * 60 * 60 * 1000);
    if (!limited.ok) return tooManyRequests(res, 'Email de bienvenue déjà demandé récemment.');

    const body = parseJsonBody(req);
    const requestedName = sanitizeText(body.name, 100);
    const { db } = ensureFirebaseAdmin();
    const companyRef = db.collection('companies').doc(authCtx.uid);
    const companySnap = await companyRef.get();
    const company = companySnap.exists ? (companySnap.data() as any) : {};

    const lastSentAt = Date.parse(company.welcomeEmailSentAt || '');
    if (Number.isFinite(lastSentAt) && Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
      return ok(res, { success: true, skipped: true });
    }

    const name = requestedName || company.name || authCtx.email.split('@')[0] || 'Artisan';
    const firstName = sanitizeText(String(name).split(' ')[0], 60) || 'Artisan';

    await sendResendEmail({
      to: [authCtx.email],
      subject: `Bienvenue sur Photofacto, ${firstName}`,
      fromName: 'Photofacto',
      html: buildWelcomeHtml(firstName),
    });

    await companyRef.set({
      ownerId: authCtx.uid,
      welcomeEmailSentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return ok(res, { success: true });
  } catch (error) {
    return serverError(res, error);
  }
}

function buildWelcomeHtml(firstName: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:620px">
      <h1 style="margin:0 0 12px;color:#0f766e">Bienvenue sur Photofacto, ${escapeHtml(firstName)}</h1>
      <p>Votre compte est activé. Photofacto vous aide à préparer des devis et factures plus vite, avec une validation finale toujours entre vos mains.</p>
      <ol>
        <li>Complétez vos informations entreprise.</li>
        <li>Ajoutez vos clients et vos tarifs habituels.</li>
        <li>Créez votre premier document et vérifiez les lignes avant validation.</li>
      </ol>
      <p><a href="${escapeHtml(process.env.APP_URL || 'https://photofacto.fr')}/app/invoices/new" style="display:inline-block;background:#0f766e;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Créer mon premier document</a></p>
      <p style="font-size:13px;color:#6b7280">Besoin d’aide ? Répondez simplement à cet email.</p>
    </div>
  `;
}
