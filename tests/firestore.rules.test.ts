import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const rulesDescribe = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const alice = 'artisan-alice';
const bob = 'artisan-bob';

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: alice,
    type: 'invoice',
    clientId: 'client-1',
    clientName: 'Mairie de Lyon',
    date: '2026-04-29',
    dueDate: '2026-05-29',
    status: 'draft',
    vatRegime: 'franchise',
    items: [{ description: 'Réparation fuite toiture', quantity: 1, unitPrice: 800, vatRate: 0 }],
    totalHT: 800,
    totalVAT: 0,
    totalTTC: 800,
    isLocked: false,
    ...overrides,
  };
}

function verifiedDb(uid: string) {
  return testEnv.authenticatedContext(uid, {
    email_verified: true,
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

function unverifiedPasswordDb(uid: string) {
  return testEnv.authenticatedContext(uid, {
    email_verified: false,
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

function googleDb(uid: string) {
  return testEnv.authenticatedContext(uid, {
    email_verified: false,
    firebase: { sign_in_provider: 'google.com' },
  }).firestore();
}

rulesDescribe('firestore.rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'photofacto-rules-test',
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('bloque un compte email/password non vérifié', async () => {
    const aliceDb = unverifiedPasswordDb(alice);

    await assertFails(setDoc(doc(aliceDb, 'companies', alice), {
      ownerId: alice,
      name: 'Toiture Alice',
      address: '12 rue des Lilas, 75013 Paris',
      siret: '12345678900011',
      vatRegime: 'franchise',
    }));
  });

  it('autorise Google même si le claim email_verified est absent ou faux', async () => {
    const aliceDb = googleDb(alice);

    await assertSucceeds(setDoc(doc(aliceDb, 'companies', alice), {
      ownerId: alice,
      name: 'Toiture Alice',
      address: '12 rue des Lilas, 75013 Paris',
      siret: '12345678900011',
      vatRegime: 'franchise',
    }));
  });

  it('isole les entreprises par ownerId', async () => {
    const aliceDb = verifiedDb(alice);
    const bobDb = verifiedDb(bob);

    await assertSucceeds(setDoc(doc(aliceDb, 'companies', alice), {
      ownerId: alice,
      name: 'Toiture Alice',
      address: '12 rue des Lilas, 75013 Paris',
      siret: '12345678900011',
      vatRegime: 'franchise',
    }));

    await assertFails(getDoc(doc(bobDb, 'companies', alice)));
    await assertFails(setDoc(doc(bobDb, 'companies', alice), {
      ownerId: bob,
      name: 'Intrusion',
    }));
  });

  it('refuse les écritures client sur les compteurs légaux', async () => {
    const aliceDb = verifiedDb(alice);

    await assertFails(setDoc(doc(aliceDb, 'companies', alice, 'counters', 'invoice-2026'), {
      next: 12,
    }));
  });

  it('empêche un utilisateur de se donner un plan payant', async () => {
    const aliceDb = verifiedDb(alice);

    await assertSucceeds(setDoc(doc(aliceDb, 'companies', alice), {
      ownerId: alice,
      name: 'Toiture Alice',
      subscriptionStatus: 'trial',
    }));

    await assertFails(updateDoc(doc(aliceDb, 'companies', alice), {
      plan: 'pro',
      subscriptionStatus: 'active',
    }));
  });

  it('empêche un utilisateur de réinitialiser ses quotas', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'companies', alice), {
        ownerId: alice,
        name: 'Toiture Alice',
        monthlyAiUsageCount: 4,
        monthlyInvoiceCount: 7,
      });
    });

    const aliceDb = verifiedDb(alice);

    await assertFails(updateDoc(doc(aliceDb, 'companies', alice), {
      monthlyAiUsageCount: 0,
    }));
    await assertFails(updateDoc(doc(aliceDb, 'companies', alice), {
      monthlyInvoiceCount: 0,
    }));
  });

  it('empêche de créer directement une facture verrouillée', async () => {
    const aliceDb = verifiedDb(alice);

    await assertFails(setDoc(doc(aliceDb, 'invoices', 'invoice-locked'), invoice({ isLocked: true })));
    await assertFails(setDoc(doc(aliceDb, 'invoices', 'invoice-validated'), invoice({
      status: 'validated',
      isLocked: false,
      validatedAt: '2026-04-29T10:00:00.000Z',
    })));
  });

  it('verrouille le contenu légal après validation mais autorise le statut', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invoices', 'invoice-1'), invoice({
        status: 'sent',
        isLocked: true,
        number: 'F-2026-0001',
      }));
    });

    const aliceDb = verifiedDb(alice);

    await assertSucceeds(updateDoc(doc(aliceDb, 'invoices', 'invoice-1'), {
      status: 'paid',
      updatedAt: '2026-04-29T10:00:00.000Z',
    }));

    await assertFails(updateDoc(doc(aliceDb, 'invoices', 'invoice-1'), {
      totalTTC: 100,
      items: [{ description: 'Montant modifié', quantity: 1, unitPrice: 100, vatRate: 0 }],
    }));
    await assertFails(updateDoc(doc(aliceDb, 'invoices', 'invoice-1'), {
      signature: 'data:image/png;base64,abc',
      signedAt: '2026-04-29T10:00:00.000Z',
    }));
  });

  it('interdit la suppression d’une facture verrouillée', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invoices', 'invoice-2'), invoice({
        status: 'sent',
        isLocked: true,
        number: 'F-2026-0002',
      }));
    });

    const aliceDb = verifiedDb(alice);

    await assertFails(deleteDoc(doc(aliceDb, 'invoices', 'invoice-2')));
  });

  it('empêche un artisan de lire la facture d’un autre', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invoices', 'private-invoice'), invoice());
    });

    const bobDb = verifiedDb(bob);

    await assertFails(getDoc(doc(bobDb, 'invoices', 'private-invoice')));
  });

  it('interdit toute écriture publique ou client dans sharedQuotes', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sharedQuotes', 'share-1'), {
        ownerId: alice,
        originalInvoiceId: 'invoice-1',
        tokenHash: 'abc',
        status: 'pending_signature',
      });
    });

    const publicDb = testEnv.unauthenticatedContext().firestore();
    const aliceDb = verifiedDb(alice);

    await assertFails(getDoc(doc(publicDb, 'sharedQuotes', 'share-1')));
    await assertFails(setDoc(doc(publicDb, 'sharedQuotes', 'share-2'), {
      ownerId: alice,
      status: 'pending_signature',
    }));
    await assertFails(updateDoc(doc(aliceDb, 'sharedQuotes', 'share-1'), {
      signedAt: '2026-04-29T10:00:00.000Z',
      signedByName: 'Client',
    }));
  });

  it('interdit toute lecture/écriture client dans paddleEvents et rateLimits', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'paddleEvents', 'evt_1'), {
        eventId: 'evt_1',
        eventType: 'subscription.created',
      });
      await setDoc(doc(ctx.firestore(), 'rateLimits', 'ip:test'), {
        count: 1,
      });
    });

    const publicDb = testEnv.unauthenticatedContext().firestore();
    const aliceDb = verifiedDb(alice);

    await assertFails(getDoc(doc(publicDb, 'paddleEvents', 'evt_1')));
    await assertFails(getDoc(doc(aliceDb, 'paddleEvents', 'evt_1')));
    await assertFails(setDoc(doc(aliceDb, 'paddleEvents', 'evt_2'), { eventId: 'evt_2' }));

    await assertFails(getDoc(doc(publicDb, 'rateLimits', 'ip:test')));
    await assertFails(getDoc(doc(aliceDb, 'rateLimits', 'ip:test')));
    await assertFails(setDoc(doc(aliceDb, 'rateLimits', 'uid:test'), { count: 0 }));
  });
});
