// Creates (or updates) Stanza's products and prices in Stripe from functions/_lib/catalog.js.
// One product per catalog item, one price per delivery speed (standard / express / flash).
// Idempotent: prices are found by lookup_key, so it is safe to re-run.
//
//   STRIPE_SECRET_KEY=rk_test_... node scripts/setup-stripe.mjs
//
// Run it once per environment (sandbox, then live). Afterwards the portal keeps Stripe in line
// by itself (POST /api/sync-prices, and the checkout syncs a price that changed).
import Stripe from 'stripe';
import { CATALOG, LEGACY_LOOKUP_KEYS, LEGACY_PLANS } from '../functions/_lib/catalog.js';
import { syncCatalog, listProducts } from '../functions/_lib/stripe-sync.js';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY (a restricted key with write access to Products and Prices).');
  process.exit(1);
}
// fetch-based client: works on any Node >= 18 and honours NODE_USE_ENV_PROXY.
const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });

const names = Object.fromEntries(CATALOG.map((i) => [i.key, i.en.name]));
for (const line of await syncCatalog(stripe, CATALOG)) {
  if (line.status === 'none') continue;
  console.log(`✓ ${names[line.plan]} · ${line.speed}: ${line.price} (${line.status === 'unchanged' ? 'unchanged' : line.status})`);
}

// Archive the prices of previous offers (Inbox Protocol €450, Consent €550, Complete €800, fixed 6-domain pack).
const legacy = await stripe.prices.list({ lookup_keys: LEGACY_LOOKUP_KEYS, active: true, limit: 20 });
for (const price of legacy.data) {
  await stripe.prices.update(price.id, { active: false });
  console.log(`✗ archived legacy price ${price.lookup_key} (${price.id})`);
}
// Products with no equivalent in the catalog any more (old bundle, fixed 6-domain pack).
const products = await listProducts(stripe);
for (const plan of LEGACY_PLANS) {
  const product = products.get(plan);
  if (product && product.active) {
    await stripe.products.update(product.id, { active: false });
    console.log(`✗ archived legacy product ${product.name} (${product.id})`);
  }
}
