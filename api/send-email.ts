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
    console.error("No RESEND_API_KEY provided in Vercel.");
    return res.status(500).json({ error: 'La clé API Resend est manquante sur Vercel. Demandez au support.' });
  }

  try {
    const { to, subject, html, attachments } = req.body;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Photofacto <contact@photofacto.fr>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        attachments // expected [{ filename: 'facture.pdf', content: 'base64string' }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
