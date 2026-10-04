// Creates (or updates) Stanza's products and prices in Stripe from functions/_lib/catalog.js.
// One product per catalog item, one price per delivery speed (standard / express / flash).
// Idempotent: prices are found by lookup_key, so it is safe to re-run.
//
//   STRIPE_SECRET_KEY=rk_test_... node scripts/setup-stripe.mjs
//
// Run it once per environment (sandbox, then live).
import Stripe from 'stripe';
import { CATALOG, TIERS, lookupKey, LEGACY_LOOKUP_KEYS, LEGACY_PLANS } from '../functions/_lib/catalog.js';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY (a restricted key with write access to Products and Prices).');
  process.exit(1);
}
// fetch-based client: works on any Node >= 18 and honours NODE_USE_ENV_PROXY.
const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });

// Products are matched on metadata.plan (list, not search: search results can lag behind writes).
const existing = await stripe.products.list({ limit: 100 }).autoPagingToArray({ limit: 1000 });
const findProduct = (plan) => existing.find((p) => p.metadata && p.metadata.plan === plan) || null;

for (const item of CATALOG) {
  if (item.quote) continue; // quoted on request, not sold through Stripe
  const info = { name: item.en.name, description: item.en.short, metadata: { plan: item.key, id: item.id } };
  let product = await findProduct(item.key);
  if (product) {
    product = await stripe.products.update(product.id, { ...info, active: true });
  } else {
    product = await stripe.products.create(info);
  }

  for (const tier of TIERS) {
    const amount = item.prices[tier];
    const lk = lookupKey(item.key, tier);
    const { data } = await stripe.prices.list({ lookup_keys: [lk], limit: 1 });
    const current = data[0];

    if (amount == null) {
      // Quoted on request: no price to sell.
      if (current && current.active) await stripe.prices.update(current.id, { active: false });
      continue;
    }
    if (current && current.active && current.unit_amount === amount && current.currency === 'eur' && current.product === product.id) {
      console.log(`✓ ${item.en.name} · ${tier}: ${current.id} (unchanged)`);
      continue;
    }
    // A price amount can't be edited: create a new one and move the lookup_key to it.
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
    if (current) await stripe.prices.update(current.id, { active: false });
    if (tier === 'standard') await stripe.products.update(product.id, { default_price: price.id });
    console.log(`✓ ${item.en.name} · ${tier}: ${price.id} (${current ? 'new price' : 'created'})`);
  }
}

// Archive the prices of previous offers (Inbox Protocol €450, Consent €550, Complete €800, fixed 6-domain pack).
const legacy = await stripe.prices.list({ lookup_keys: LEGACY_LOOKUP_KEYS, active: true, limit: 20 });
for (const price of legacy.data) {
  await stripe.prices.update(price.id, { active: false });
  console.log(`✗ archived legacy price ${price.lookup_key} (${price.id})`);
}
// Products with no equivalent in the catalog any more (old bundle, fixed 6-domain pack).
for (const product of existing.filter((p) => p.active && p.metadata && LEGACY_PLANS.includes(p.metadata.plan))) {
  await stripe.products.update(product.id, { active: false });
  console.log(`✗ archived legacy product ${product.name} (${product.id})`);
}
