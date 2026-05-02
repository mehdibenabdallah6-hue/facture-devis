export const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function planFromPriceId(priceId?: string | null): 'free' | 'starter' | 'pro' {
  if (!priceId) return 'free';
  const starter = [
    process.env.PADDLE_PRICE_ID_STARTER,
    process.env.PADDLE_PRICE_ID_STARTER_ANNUAL,
    process.env.VITE_PADDLE_PRICE_STARTER_ID,
    process.env.VITE_PADDLE_PRICE_STARTER_ANNUAL_ID,
  ].filter(Boolean);
  const pro = [
    process.env.PADDLE_PRICE_ID_PRO,
    process.env.PADDLE_PRICE_ID_PRO_ANNUAL,
    process.env.VITE_PADDLE_PRICE_PRO_ID,
    process.env.VITE_PADDLE_PRICE_PRO_ANNUAL_ID,
  ].filter(Boolean);
  if (pro.includes(priceId)) return 'pro';
  if (starter.includes(priceId)) return 'starter';
  return 'free';
}
