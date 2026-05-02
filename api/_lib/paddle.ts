import * as crypto from 'crypto';

export function parsePaddleSignature(header: string): { timestamp: string | null; signatures: string[] } {
  const parts = header.split(';').map(part => part.trim());
  return {
    timestamp: parts.find(part => part.startsWith('ts='))?.slice(3) ?? null,
    signatures: parts.filter(part => part.startsWith('h1=')).map(part => part.slice(3)).filter(Boolean),
  };
}

export function verifyPaddleSignature(rawBody: string, header: string, secret: string, toleranceMs = 5 * 60 * 1000) {
  const { timestamp, signatures } = parsePaddleSignature(header);
  if (!timestamp || signatures.length === 0) return false;
  const ts = Number(timestamp) * 1000;
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > toleranceMs) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}:${rawBody}`, 'utf8').digest('hex');
  return signatures.some(signature => {
    try {
      const expectedBuffer = Buffer.from(expected, 'hex');
      const receivedBuffer = Buffer.from(signature, 'hex');
      return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch {
      return false;
    }
  });
}

