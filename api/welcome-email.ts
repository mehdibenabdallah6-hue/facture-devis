/**
 * Welcome email endpoint — sends a warm onboarding email via Resend
 * POST /api/welcome-email
 * Body: { email: string, name?: string }
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY manquant' });

  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const firstName = name ? name.split(' ')[0] : 'Artisan';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#F5F5F5;font-family:Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F5F5;padding:40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:40px 32px;text-align:center;">
                  <h1 style="color:#FFFFFF;font-size:32px;font-weight:800;margin:0 0 8px;">Photofacto</h1>
                  <p style="color:#ccfbf1;font-size:16px;margin:0;">Photo + description rapide = facture prête à valider</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding:40px 32px;">
                  <h2 style="color:#1c1917;font-size:24px;font-weight:700;margin:0 0 16px;">
                    Bienvenue sur Photofacto, ${firstName} ! 🎉
                  </h2>
                  <p style="color:#44403c;font-size:16px;line-height:1.6;margin:0 0 24px;">
                    Votre compte est activé. Vous avez <strong>14 jours d'essai gratuit</strong> pour découvrir toutes les fonctionnalités. Voici comment démarrer :
                  </p>
                  
                  <!-- Steps -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                    <tr>
                      <td style="padding:16px 0;border-bottom:1px solid #e7e5e4;">
                        <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background-color:#0d9488;color:#FFFFFF;border-radius:50%;font-weight:700;font-size:14px;margin-right:12px;">1</span>
                        <strong style="color:#1c1917;">Complétez votre profil entreprise</strong>
                        <p style="color:#44403c;font-size:14px;margin:4px 0 0 44px;">Nom, SIRET, adresse — pour des factures conformes.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 0;border-bottom:1px solid #e7e5e4;">
                        <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background-color:#0d9488;color:#FFFFFF;border-radius:50%;font-weight:700;font-size:14px;margin-right:12px;">2</span>
                        <strong style="color:#1c1917;">Ajoutez une photo et une description</strong>
                        <p style="color:#44403c;font-size:14px;margin:4px 0 0 44px;">L'IA prépare une proposition de facture à vérifier.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 0;">
                        <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background-color:#0d9488;color:#FFFFFF;border-radius:50%;font-weight:700;font-size:14px;margin-right:12px;">3</span>
                        <strong style="color:#1c1917;">Ou dictez votre facture à voix haute</strong>
                        <p style="color:#44403c;font-size:14px;margin:4px 0 0 44px;">Parlez, l'IA remplit le formulaire pour vous.</p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- CTA Button -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding:16px 0 32px;">
                        <a href="https://photofacto.fr/app/invoices/new" style="display:inline-block;background-color:#0d9488;color:#FFFFFF;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;">
                          Créer ma première facture →
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Help section -->
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;border-radius:12px;">
                    <tr>
                      <td style="padding:20px 24px;">
                        <p style="color:#1c1917;font-size:14px;font-weight:600;margin:0 0 4px;">💬 Besoin d'aide ?</p>
                        <p style="color:#44403c;font-size:14px;margin:0;">
                          Contactez-nous à <a href="mailto:contact@photofacto.fr" style="color:#0d9488;text-decoration:underline;">contact@photofacto.fr</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color:#f5f5f4;padding:24px 32px;text-align:center;border-top:1px solid #e7e5e4;">
                  <p style="color:#78716c;font-size:12px;margin:0 0 8px;">
                    Photofacto — Facturation intelligente pour artisans
                  </p>
                  <p style="color:#78716c;font-size:11px;margin:0;">
                    <a href="https://photofacto.fr/confidentialite" style="color:#78716c;text-decoration:underline;">Politique de confidentialité</a>
                    &nbsp;·&nbsp;
                    <a href="https://photofacto.fr/mentions-legales" style="color:#78716c;text-decoration:underline;">Mentions légales</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Photofacto <contact@photofacto.fr>',
        to: [email],
        subject: `Bienvenue sur Photofacto, ${firstName} ! 🎉`,
        html
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
