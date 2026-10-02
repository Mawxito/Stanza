// Creates (or updates) Stanza's products and prices in Stripe.
// Idempotent: prices are found by lookup_key, so it is safe to re-run.
//
//   STRIPE_SECRET_KEY=rk_test_... node scripts/setup-stripe.mjs
//
// Run it once per environment (sandbox, then live).
import Stripe from 'stripe';
import { PLANS } from '../functions/_lib/plans.js';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY (a restricted key with write access to Products and Prices).');
  process.exit(1);
}
// fetch-based client: works on any Node >= 18 and honours NODE_USE_ENV_PROXY.
const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });

for (const [plan, def] of Object.entries(PLANS)) {
  const existing = await stripe.prices.list({ lookup_keys: [def.lookupKey], expand: ['data.product'], limit: 1 });
  const current = existing.data[0];

  if (current && current.unit_amount === def.amount && current.currency === def.currency) {
    await stripe.products.update(current.product.id, { name: def.name, description: def.description, metadata: { plan } });
    console.log(`✓ ${def.name}: ${current.id} (unchanged)`);
    continue;
  }

  const productId = current
    ? current.product.id
    : (await stripe.products.create({ name: def.name, description: def.description, metadata: { plan } })).id;

  // A price amount can't be edited: create a new one and move the lookup_key to it.
  const price = await stripe.prices.create({
    product: productId,
    currency: def.currency,
    unit_amount: def.amount,
    lookup_key: def.lookupKey,
    transfer_lookup_key: true,
    metadata: { plan },
  });
  await stripe.products.update(productId, { default_price: price.id });
  if (current) await stripe.prices.update(current.id, { active: false });
  console.log(`✓ ${def.name}: ${price.id} (${current ? 'new price' : 'created'})`);
}
