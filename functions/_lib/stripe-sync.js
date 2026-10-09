// Keeps Stripe's products and prices in line with the catalog (the portal's, or catalog.js as a fallback).
// Used by `npm run stripe:setup`, by POST /api/sync-prices (called by the portal when an admin
// changes a price) and by the checkout (a price that changed is synced before it is charged).
//
// Rules:
//  - one Stripe product per offer (metadata.plan), one price per speed (lookup_key stanza_<offer>_<speed>);
//  - Stripe holds the REGULAR price, never a promotion's: a promotion is charged through an inline
//    price on the checkout line (see lineItem in stripe.js), so ending it needs no Stripe change;
//  - a price amount can't be edited: a new price takes over the lookup_key, the old one is archived.
import { TIERS, lookupKey } from './catalog.js';

/** Regular (pre-promotion) amount in cents per speed; null = speed not sold. */
export function regularAmounts(item) {
  if (item.single) return { standard: item.regular ? item.regular.standard ?? item.prices.standard : item.prices.standard, express: null, flash: null };
  return Object.fromEntries(TIERS.map((t) => [t, (item.regular && item.regular[t]) ?? item.prices[t] ?? null]));
}

/** Every product of the account by metadata.plan (a list, not a search: search can lag behind writes). */
export async function listProducts(stripe) {
  const all = await stripe.products.list({ limit: 100 }).autoPagingToArray({ limit: 1000 });
  return new Map(all.filter((p) => p.metadata && p.metadata.plan).map((p) => [p.metadata.plan, p]));
}

/** The Stripe product of an offer, created or brought up to date. */
export async function ensureProduct(stripe, item, products) {
  const info = { name: item.en.name, description: item.en.short, metadata: { plan: item.key, id: item.id } };
  const product = products.get(item.key);
  if (!product) {
    const created = await stripe.products.create(info);
    products.set(item.key, created);
    return created;
  }
  const same = product.active && product.name === info.name && product.description === info.description
    && product.metadata.id === info.metadata.id;
  if (same) return product;
  const updated = await stripe.products.update(product.id, { ...info, active: true });
  products.set(item.key, updated);
  return updated;
}

/**
 * The Stripe price of an offer at a speed, created when the amount changed.
 * Returns { status: 'unchanged' | 'created' | 'updated' | 'archived' | 'none', price }.
 */
export async function ensurePrice(stripe, item, tier, amount, product) {
  const lk = lookupKey(item.key, tier);
  const { data } = await stripe.prices.list({ lookup_keys: [lk], limit: 1 });
  const current = data[0];

  if (amount == null) {
    // Speed not sold: archive its price (a product's default price can't be archived: left as is).
    if (current && current.active && product.default_price !== current.id) {
      await stripe.prices.update(current.id, { active: false });
      return { status: 'archived', price: current };
    }
    return { status: 'none', price: null };
  }
  if (current && current.active && current.unit_amount === amount && current.currency === 'eur' && current.product === product.id) {
    return { status: 'unchanged', price: current };
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'eur',
    unit_amount: amount,
    nickname: `${item.en.name} · ${tier}`,
    lookup_key: lk,
    transfer_lookup_key: true,
    tax_behavior: 'exclusive',
    metadata: { plan: item.key, speed: tier },
  });
  // The default price is moved first: Stripe refuses to archive a product's current default price.
  if (tier === 'standard') {
    const updated = await stripe.products.update(product.id, { default_price: price.id });
    product.default_price = updated.default_price;
  }
  if (current && current.active && current.id !== price.id) await stripe.prices.update(current.id, { active: false });
  return { status: current ? 'updated' : 'created', price };
}

/** Syncs one offer (product + the price of every speed). Returns one report line per speed. */
export async function syncItem(stripe, item, products) {
  const product = await ensureProduct(stripe, item, products);
  const amounts = regularAmounts(item);
  const report = [];
  for (const tier of TIERS) {
    const { status, price } = await ensurePrice(stripe, item, tier, amounts[tier], product);
    report.push({ plan: item.key, speed: tier, status, amount: amounts[tier], price: price ? price.id : null });
  }
  return report;
}

/** Syncs the whole catalog (offers sold through Stripe only: quotes have no price). */
export async function syncCatalog(stripe, items) {
  const products = await listProducts(stripe);
  const report = [];
  for (const item of items) {
    if (item.quote) continue;
    report.push(...(await syncItem(stripe, item, products)));
  }
  return report;
}
