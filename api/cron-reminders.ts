import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: any, res: any) {
  // Authorization check for Vercel Cron
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!FIREBASE_SERVICE_ACCOUNT || !RESEND_API_KEY) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT or RESEND_API_KEY");
    return res.status(500).json({ error: 'Configuration manquante (Firebase ou Resend)' });
  }

  try {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error("FIREBASE_SERVICE_ACCOUNT n'est pas un JSON valide");
      return res.status(500).json({ error: 'Invalid Firebase credentials format' });
    }

    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    }

    const db = getFirestore();
    const now = new Date();
    
    // In a real production scenario, you would query all 'sent' invoices and math out J+7, J+15, J+30.
    // Firebase limitations: you cannot query mathematical differences directly.
    // So we query root invoices that are:
    // status == 'sent' AND type == 'invoice' AND dueDate < now
    
    const overdueInvoicesSnapshot = await db.collection('invoices')
      .where('type', '==', 'invoice')
      .where('status', '==', 'sent')
      .where('dueDate', '<', now.toISOString())
      .get();
      
    if (overdueInvoicesSnapshot.empty) {
       return res.status(200).json({ success: true, message: 'No overdue invoices found' });
    }

    const emailsToSend: any[] = [];
    const updatePromises: Promise<any>[] = [];

    overdueInvoicesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const dueDate = new Date(data.dueDate);
      const diffTime = Math.abs(now.getTime() - dueDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const remindersSent = data.remindersSent || 0;
      let shouldSend = false;
      let typeText = "";

      // Trigger rules (J+7, J+15, J+30)
      if (diffDays >= 7 && diffDays < 15 && remindersSent < 1) {
        shouldSend = true;
        typeText = "Première relance";
        data.remindersSent = 1;
      } else if (diffDays >= 15 && diffDays < 30 && remindersSent < 2) {
        shouldSend = true;
        typeText = "Deuxième relance";
        data.remindersSent = 2;
      } else if (diffDays >= 30 && remindersSent < 3) {
        shouldSend = true;
        typeText = "Dernière relance avant recouvrement";
        data.remindersSent = 3;
      }

      updatePromises.push(doc.ref.update({
        status: 'overdue',
        updatedAt: now.toISOString(),
        remindersSent: data.remindersSent || remindersSent,
      }));

      if (shouldSend && data.clientEmail) {
        // Prepare email
        const emailBody = {
          from: 'Photofacto <factures@photofacto.fr>',
          to: [data.clientEmail],
          subject: `${typeText} : Facture n°${data.number} impayée`,
          html: `
            <p>Bonjour,</p>
            <p>Sauf erreur ou omission de notre part, la facture <strong>${data.number}</strong> d'un montant de <strong>${data.totalTTC} €</strong> parvenue à échéance le ${dueDate.toLocaleDateString('fr-FR')} n'a pas encore été réglée.</p>
            <p>Merci de bien vouloir procéder à son règlement dans les plus brefs délais.</p>
            <p>Cordialement.</p>
          `
        };
        emailsToSend.push(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify(emailBody)
          }).then(r => r.json())
        );

        updatePromises.push(doc.ref.update({
          remindersSent: data.remindersSent,
          updatedAt: now.toISOString(),
        }));
      }
    });

    if (emailsToSend.length > 0) {
      await Promise.all([...emailsToSend, ...updatePromises]);
    }

    return res.status(200).json({ 
      success: true, 
      processed: overdueInvoicesSnapshot.docs.length,
      emailsSent: emailsToSend.length
    });

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
