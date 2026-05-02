import * as crypto from 'crypto';

export function createShareToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashShareToken(token: string) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function safeCompare(a: string, b: string) {
  try {
    const aa = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

