import Stripe from 'stripe';
import { TIERS, lookupKey } from './catalog.js';
import { listProducts, ensureProduct, ensurePrice } from './stripe-sync.js';

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
// Kept a minute per isolate: a price archived after an admin change must not be reused for long.
const PRICE_TTL_MS = 60_000;
const priceCache = new Map();
export const forgetStripePrices = () => priceCache.clear();
const remember = (key, p) => priceCache.set(key, { at: Date.now(), price: { id: p.id, amount: p.unit_amount, product: p.product, tax: p.tax_behavior } });
export async function getStripePrice(stripe, plan, tier) {
  const key = lookupKey(plan, tier);
  const hit = priceCache.get(key);
  if (hit && Date.now() - hit.at < PRICE_TTL_MS) return hit.price;
  const { data } = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (!data[0]) return null;
  remember(key, data[0]);
  return priceCache.get(key).price;
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

  // The portal's price changed and Stripe hasn't heard yet (the portal's call to /api/sync-prices
  // missed, or isn't wired): sync it now so Stripe's catalog shows what is charged. Only for a
  // regular price (never a discounted one whose promotion just ended) and never at the cost of the sale.
  const regular = item.regular && item.regular[tier];
  if (regular == null || regular === amount) {
    try {
      const target = price && price.product
        ? await stripe.products.retrieve(price.product)
        : await ensureProduct(stripe, item, await listProducts(stripe));
      const synced = await ensurePrice(stripe, item, tier, amount, target);
      if (synced.price) {
        remember(lookupKey(item.key, tier), synced.price);
        return { price: synced.price.id, quantity: 1 };
      }
    } catch (err) {
      console.warn('[checkout] Stripe price sync failed, charging an inline price instead:', err && err.message);
    }
  }
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
// (a card authorization lasts about 7 days; extended authorization is opt-in, see checkout.js).
// "automatic" = charge immediately.
export function captureMethod(env) {
  return env.CAPTURE_METHOD === 'automatic' ? 'automatic' : 'manual';
}
