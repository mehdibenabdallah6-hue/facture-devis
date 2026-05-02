import { describe, expect, it } from 'vitest';
import {
  base64ByteLength,
  isAllowedImage,
  isEmail,
  isFrenchVatNumber,
  isSiren,
  isSiret,
  isValidPdfAttachment,
  sanitizeText,
} from '../api/_lib/validators';
import { createShareToken, hashShareToken, safeCompare } from '../api/_lib/quoteShare';
import { verifyPaddleSignature } from '../api/_lib/paddle';
import { createHmac } from 'node:crypto';

describe('security validators', () => {
  it('valide email, SIREN/SIRET et TVA FR sans accepter les valeurs faibles', () => {
    expect(isEmail('artisan@example.fr')).toBe(true);
    expect(isEmail('bad-email')).toBe(false);
    expect(isSiren('732829320')).toBe(true);
    expect(isSiret('73282932000074')).toBe(true);
    expect(isSiret('12345678900000')).toBe(false);
    expect(isFrenchVatNumber('FR40303265045')).toBe(true);
  });

  it('limite les images, PDF et textes entrants', () => {
    const pngBase64 = Buffer.from('image').toString('base64');
    expect(base64ByteLength(pngBase64)).toBeGreaterThan(0);
    expect(isAllowedImage('image/png', pngBase64)).toBe(true);
    expect(isAllowedImage('application/pdf', pngBase64)).toBe(false);
    expect(isValidPdfAttachment({ filename: 'facture.pdf', content: Buffer.from('pdf').toString('base64') })).toBe(true);
    expect(isValidPdfAttachment({ filename: 'facture.html', content: '<h1>x</h1>' })).toBe(false);
    expect(sanitizeText('hello\u0000world', 20)).toBe('hello world');
  });
});

describe('quote share token helpers', () => {
  it('ne compare que les hashes valides en temps constant', () => {
    const token = createShareToken();
    const hash = hashShareToken(token);
    expect(token).not.toBe(hash);
    expect(safeCompare(hash, hashShareToken(token))).toBe(true);
    expect(safeCompare(hash, hashShareToken(`${token}x`))).toBe(false);
  });
});

describe('Paddle webhook signature', () => {
  it('refuse les signatures rejouées hors fenêtre', () => {
    const body = JSON.stringify({ event_id: 'evt_1' });
    const secret = 'secret';
    const oldTs = Math.floor((Date.now() - 10 * 60 * 1000) / 1000);
    const signature = createHmac('sha256', secret).update(`${oldTs}:${body}`).digest('hex');
    expect(verifyPaddleSignature(body, `ts=${oldTs};h1=${signature}`, secret)).toBe(false);
  });

  it('accepte une signature Paddle récente valide', () => {
    const body = JSON.stringify({ event_id: 'evt_2' });
    const secret = 'secret';
    const ts = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${signature}`, secret)).toBe(true);
  });
});
