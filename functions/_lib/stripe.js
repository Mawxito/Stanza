import Stripe from 'stripe';
import { BY_KEY, lookupKey } from './catalog.js';

// One client per isolate. The fetch client runs on Workers and on Node >= 18 (for local tests).
let client;
let clientKey;
export function getStripe(env) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  if (!client || clientKey !== env.STRIPE_SECRET_KEY) {
    client = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 2,
      appInfo: { name: 'stanza-site' },
    });
    clientKey = env.STRIPE_SECRET_KEY;
  }
  return client;
}

const priceCache = new Map();
export async function getPriceId(stripe, plan, tier) {
  const item = BY_KEY[plan];
  if (!item || item.prices[tier] == null) return null;
  const key = lookupKey(plan, tier);
  if (priceCache.has(key)) return priceCache.get(key);
  const { data } = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const id = data[0] ? data[0].id : null;
  if (id) priceCache.set(key, id);
  return id;
}

// "manual" = authorize at checkout, capture after the acceptance gate passes
// (card authorizations stay valid for about 7 days). "automatic" = charge immediately.
export function captureMethod(env) {
  return env.CAPTURE_METHOD === 'automatic' ? 'automatic' : 'manual';
}
