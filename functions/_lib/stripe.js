import Stripe from 'stripe';
import { TIERS, lookupKey } from './catalog.js';

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

// The Stripe price created by `npm run stripe:setup` for a plan and speed (lookup_key), or null.
const priceCache = new Map();
export async function getStripePrice(stripe, plan, tier) {
  const key = lookupKey(plan, tier);
  if (priceCache.has(key)) return priceCache.get(key);
  const { data } = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const price = data[0] ? { id: data[0].id, amount: data[0].unit_amount, product: data[0].product, tax: data[0].tax_behavior } : null;
  if (price) priceCache.set(key, price);
  return price;
}

// Checkout line for the amount set in the portal. The Stripe price is reused when it matches;
// otherwise an inline price is created on the same Stripe product (same reporting, same tax setup).
// During a promotion (`promo`: { id, name, description }), the line names the promotion: a Stripe
// product can't be renamed for one session, so the line gets its own product data, with the
// offer in metadata.plan (reporting by offer) and the promotion in metadata.promo.
export async function lineItem(stripe, item, tier, amount, promo = null) {
  const price = await getStripePrice(stripe, item.key, tier);
  if (promo) {
    return {
      price_data: {
        currency: 'eur',
        unit_amount: amount,
        tax_behavior: (price && price.tax) || 'exclusive',
        product_data: { name: promo.name, description: promo.description, metadata: { plan: item.key, promo: promo.id } },
      },
      quantity: 1,
    };
  }
  if (price && price.amount === amount) return { price: price.id, quantity: 1 };
  let product = price && price.product;
  if (!product) {
    for (const t of TIERS) {
      const other = await getStripePrice(stripe, item.key, t);
      if (other) { product = other.product; break; }
    }
  }
  const priceData = { currency: 'eur', unit_amount: amount, tax_behavior: (price && price.tax) || 'exclusive' };
  if (product) priceData.product = typeof product === 'string' ? product : product.id;
  else priceData.product_data = { name: item.en.name, metadata: { plan: item.key } };
  return { price_data: priceData, quantity: 1 };
}

// "manual" = authorize at checkout, capture after the acceptance gate passes
// (card authorizations stay valid for about 7 days). "automatic" = charge immediately.
export function captureMethod(env) {
  return env.CAPTURE_METHOD === 'automatic' ? 'automatic' : 'manual';
}
