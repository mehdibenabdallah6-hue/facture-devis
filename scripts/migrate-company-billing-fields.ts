import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    initializeApp({ credential: cert(JSON.parse(raw)) });
    return;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials missing');
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

async function main() {
  initAdmin();
  const dryRun = !process.argv.includes('--write');
  const db = getFirestore();
  const snap = await db.collection('companies').get();
  let updated = 0;

  for (const doc of snap.docs) {
    const company = doc.data();
    const patch: Record<string, unknown> = {};

    if (!company.plan) patch.plan = 'free';
    if (!company.subscriptionStatus) patch.subscriptionStatus = 'trial';
    if (typeof company.monthlyInvoiceCount !== 'number') patch.monthlyInvoiceCount = 0;
    if (typeof company.monthlyAiUsageCount !== 'number') patch.monthlyAiUsageCount = 0;
    if (!company.monthlyInvoiceResetAt) patch.monthlyInvoiceResetAt = new Date().toISOString();
    if (!company.monthlyResetAt) patch.monthlyResetAt = new Date().toISOString();

    if (company.subscriptionStatus === 'active' || company.subscriptionStatus === 'trialing') {
      delete patch.plan;
      delete patch.subscriptionStatus;
    }

    if (Object.keys(patch).length === 0) continue;
    updated++;
    console.log(`${dryRun ? '[dry-run]' : '[write]'} ${doc.id}`, patch);
    if (!dryRun) {
      await doc.ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
    }
  }

  console.log(`${updated} entreprise(s) à migrer. Mode: ${dryRun ? 'dry-run' : 'write'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
