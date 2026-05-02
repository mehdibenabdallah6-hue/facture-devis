import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import handler from '../../api/cron-reminders';
import { createMockResponse } from './testResponse';

const previousEnv = {
  NODE_ENV: process.env.NODE_ENV,
  CRON_SECRET: process.env.CRON_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
};

describe('api/cron-reminders auth', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.CRON_SECRET = 'cron-secret';
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('refuse une requête sans secret', async () => {
    const res = createMockResponse();

    await handler({ method: 'GET', headers: {}, query: {} }, res);

    expect(res.statusCode).toBe(401);
  });

  it('refuse une requête avec mauvais secret', async () => {
    const res = createMockResponse();

    await handler({ method: 'GET', headers: { authorization: 'Bearer wrong' }, query: {} }, res);

    expect(res.statusCode).toBe(401);
  });

  it('accepte le bon secret puis bloque sur la prochaine config manquante', async () => {
    const res = createMockResponse();

    await handler({ method: 'GET', headers: { authorization: 'Bearer cron-secret' }, query: {} }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Configuration manquante');
  });
});
