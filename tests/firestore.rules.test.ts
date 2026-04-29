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

  it('isole les entreprises par ownerId', async () => {
    const aliceDb = testEnv.authenticatedContext(alice).firestore();
    const bobDb = testEnv.authenticatedContext(bob).firestore();

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
    const aliceDb = testEnv.authenticatedContext(alice).firestore();

    await assertFails(setDoc(doc(aliceDb, 'companies', alice, 'counters', 'invoice-2026'), {
      next: 12,
    }));
  });

  it('empêche de créer directement une facture verrouillée', async () => {
    const aliceDb = testEnv.authenticatedContext(alice).firestore();

    await assertFails(setDoc(doc(aliceDb, 'invoices', 'invoice-locked'), invoice({ isLocked: true })));
  });

  it('verrouille le contenu légal après validation mais autorise le statut', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invoices', 'invoice-1'), invoice({
        status: 'sent',
        isLocked: true,
        number: 'F-2026-0001',
      }));
    });

    const aliceDb = testEnv.authenticatedContext(alice).firestore();

    await assertSucceeds(updateDoc(doc(aliceDb, 'invoices', 'invoice-1'), {
      status: 'paid',
      updatedAt: '2026-04-29T10:00:00.000Z',
    }));

    await assertFails(updateDoc(doc(aliceDb, 'invoices', 'invoice-1'), {
      totalTTC: 100,
      items: [{ description: 'Montant modifié', quantity: 1, unitPrice: 100, vatRate: 0 }],
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

    const aliceDb = testEnv.authenticatedContext(alice).firestore();

    await assertFails(deleteDoc(doc(aliceDb, 'invoices', 'invoice-2')));
  });

  it('empêche un artisan de lire la facture d’un autre', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invoices', 'private-invoice'), invoice());
    });

    const bobDb = testEnv.authenticatedContext(bob).firestore();

    await assertFails(getDoc(doc(bobDb, 'invoices', 'private-invoice')));
  });
});
