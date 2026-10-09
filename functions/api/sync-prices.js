// POST /api/sync-prices — called by the portal right after an admin changes a price.
// Signed like every portal request (x-stanza-timestamp + x-stanza-signature, see portal.js).
// The body is ignored: the site reads the catalog from the portal itself (the one source of truth)
// and brings Stripe's products and prices in line with it, so a replayed or forged body can't set a price.
//
// Response: { ok: true, changed: [...] } listing only what moved in Stripe.
import { getStripe, forgetStripePrices } from '../_lib/stripe.js';
import { verifyPortalRequest } from '../_lib/portal.js';
import { getCatalogNow } from '../_lib/live-catalog.js';
import { syncCatalog } from '../_lib/stripe-sync.js';

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (!(await verifyPortalRequest(env, request, body))) return json(401, { ok: false, error: 'invalid signature' });

  const catalog = await getCatalogNow(env);
  if (!catalog || !catalog.live) return json(503, { ok: false, error: 'portal catalog unavailable: nothing was changed in Stripe' });

  try {
    const report = await syncCatalog(getStripe(env), catalog.list);
    forgetStripePrices();
    const changed = report.filter((l) => l.status !== 'unchanged' && l.status !== 'none');
    if (changed.length) console.log('[sync-prices]', JSON.stringify(changed));
    return json(200, { ok: true, changed });
  } catch (err) {
    console.error('[sync-prices] failed:', err && err.message);
    return json(500, { ok: false, error: 'stripe sync failed' }); // the portal can retry
  }
}

export function onRequestGet() {
  return json(405, { ok: false, error: 'POST only' });
}
