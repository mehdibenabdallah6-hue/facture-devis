const DEFAULT_ALLOWED_ORIGINS = ['https://www.photofacto.fr', 'https://photofacto.fr'];

export function applyCors(req: any, res: any) {
  const origin = req.headers?.origin;
  const configured = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowed = configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
  const isLocal = process.env.NODE_ENV !== 'production' && origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  if (origin && (allowed.includes(origin) || isLocal)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Paddle-Signature');
}

export function ok(res: any, data: any = {}) { return res.status(200).json(data); }
export function created(res: any, data: any = {}) { return res.status(201).json(data); }
export function badRequest(res: any, message = 'Bad request') { return res.status(400).json({ error: message }); }
export function unauthorized(res: any, message = 'Unauthorized') { return res.status(401).json({ error: message }); }
export function forbidden(res: any, message = 'Forbidden') { return res.status(403).json({ error: message }); }
export function notFound(res: any, message = 'Not found') { return res.status(404).json({ error: message }); }
export function conflict(res: any, message = 'Conflict', extra: any = {}) { return res.status(409).json({ error: message, ...extra }); }
export function tooManyRequests(res: any, message = 'Too many requests') { return res.status(429).json({ error: message }); }
export function methodNotAllowed(res: any) { return res.status(405).json({ error: 'Method not allowed' }); }
export function serverError(res: any, error: any) {
  console.error(error);
  return res.status(500).json({ error: 'Erreur serveur. Veuillez réessayer.' });
}

export function parseJsonBody(req: any) {
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body || {};
}

