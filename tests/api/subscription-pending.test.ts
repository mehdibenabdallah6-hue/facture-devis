import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse } from './testResponse';

vi.mock('../../api/_lib/auth.js', () => ({
  verifyAuth: vi.fn(),
}));

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

import handler from '../../api/subscription-pending';
import { verifyAuth } from '../../api/_lib/auth.js';
import { ensureFirebaseAdmin } from '../../api/_lib/firebaseAdmin.js';

describe('api/subscription-pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyAuth).mockResolvedValue({ uid: 'user_1', email: 'artisan@example.fr' });
  });

  it('écrit le pending billing via Firebase Admin pour le uid authentifié', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const doc = vi.fn(() => ({ set }));
    const collection = vi.fn(() => ({ doc }));
    vi.mocked(ensureFirebaseAdmin).mockReturnValue({ db: { collection } } as any);

    const res = createMockResponse();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: {
        userId: 'attacker',
        pendingPlan: 'starter',
        billingCycle: 'annual',
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(collection).toHaveBeenCalledWith('companies');
    expect(doc).toHaveBeenCalledWith('user_1');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      subscriptionStatus: 'pending_activation',
      pendingPlan: 'starter',
      pendingBillingCycle: 'annual',
      updatedAt: expect.any(String),
    }), { merge: true });
  });

  it('refuse les plans et cycles invalides', async () => {
    const resPlan = createMockResponse();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { pendingPlan: 'free', billingCycle: 'annual' },
    }, resPlan);

    expect(resPlan.statusCode).toBe(400);

    const resCycle = createMockResponse();
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { pendingPlan: 'pro', billingCycle: 'lifetime' },
    }, resCycle);

    expect(resCycle.statusCode).toBe(400);
    expect(ensureFirebaseAdmin).not.toHaveBeenCalled();
  });

  it('refuse une requête non authentifiée', async () => {
    vi.mocked(verifyAuth).mockRejectedValue(Object.assign(new Error('Missing Authorization bearer token'), { status: 401 }));

    const res = createMockResponse();
    await handler({
      method: 'POST',
      headers: {},
      body: { pendingPlan: 'starter', billingCycle: 'monthly' },
    }, res);

    expect(res.statusCode).toBe(401);
  });
});
