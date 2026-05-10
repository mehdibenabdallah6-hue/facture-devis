import * as crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockResponse } from './testResponse';

vi.mock('../../api/_lib/firebaseAdmin.js', () => ({
  ensureFirebaseAdmin: vi.fn(),
}));

import handler from '../../api/paddle-webhook';
import { ensureFirebaseAdmin } from '../../api/_lib/firebaseAdmin.js';

const previousEnv = {
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET,
  PADDLE_PRICE_ID_STARTER: process.env.PADDLE_PRICE_ID_STARTER,
  PADDLE_PRICE_ID_STARTER_ANNUAL: process.env.PADDLE_PRICE_ID_STARTER_ANNUAL,
  PADDLE_PRICE_ID_PRO: process.env.PADDLE_PRICE_ID_PRO,
  PADDLE_PRICE_ID_PRO_ANNUAL: process.env.PADDLE_PRICE_ID_PRO_ANNUAL,
};

describe('api/paddle-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PADDLE_WEBHOOK_SECRET = 'webhook-secret';
    process.env.PADDLE_PRICE_ID_STARTER = 'pri_starter_month';
    process.env.PADDLE_PRICE_ID_STARTER_ANNUAL = 'pri_starter_year';
    process.env.PADDLE_PRICE_ID_PRO = 'pri_pro_month';
    process.env.PADDLE_PRICE_ID_PRO_ANNUAL = 'pri_pro_year';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('journalise explicitement un priceId inconnu sur subscription active', async () => {
    const txSet = vi.fn();
    const eventRef = { id: 'evt_1', kind: 'event' };
    const companyRef = { id: 'user_1', kind: 'company' };
    const auditRef = { id: 'audit_1', kind: 'audit' };
    const db = {
      collection: vi.fn((name: string) => ({
        doc: vi.fn((id?: string) => {
          if (name === 'paddleEvents') return eventRef;
          if (name === 'companies') return companyRef;
          return { id, kind: name };
        }),
      })),
      runTransaction: vi.fn(async (fn: any) => fn({
        get: vi.fn(async (ref: any) => {
          if (ref === eventRef) return { exists: false };
          if (ref === companyRef) return { exists: true, data: () => ({ plan: 'starter', subscriptionStatus: 'active' }) };
          return { exists: false };
        }),
        set: txSet,
      })),
    };
    vi.mocked(ensureFirebaseAdmin).mockReturnValue({ db } as any);
    db.collection.mockImplementation((name: string) => ({
      doc: vi.fn((id?: string) => {
        if (name === 'paddleEvents') return eventRef;
        if (name === 'companies') return companyRef;
        if (name === 'invoiceEvents') return auditRef;
        return { id, kind: name };
      }),
    }));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const body = JSON.stringify({
      event_id: 'evt_1',
      event_type: 'subscription.created',
      occurred_at: '2026-05-10T10:00:00.000Z',
      data: {
        id: 'sub_1',
        status: 'active',
        customer_id: 'ctm_1',
        items: [{ price: { id: 'pri_unknown' } }],
        custom_data: { userId: 'user_1', billingCycle: 'monthly' },
      },
    });

    const res = createMockResponse();
    await handler({
      method: 'POST',
      headers: { 'paddle-signature': sign(body, 'webhook-secret') },
      rawBody: body,
    }, res);

    expect(res.statusCode).toBe(200);
    expect(consoleError).toHaveBeenCalledWith(
      '[paddle-webhook] active subscription uses unknown priceId',
      expect.objectContaining({ priceId: 'pri_unknown', userId: 'user_1', status: 'active' }),
    );
    expect(txSet).toHaveBeenCalledWith(eventRef, expect.objectContaining({
      eventId: 'evt_1',
      eventType: 'subscription.created',
      userId: 'user_1',
      priceId: 'pri_unknown',
      plan: 'free',
      status: 'active',
    }));
  });
});

function sign(body: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const h1 = crypto.createHmac('sha256', secret).update(`${timestamp}:${body}`, 'utf8').digest('hex');
  return `ts=${timestamp};h1=${h1}`;
}
