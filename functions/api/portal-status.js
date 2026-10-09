// GET /api/portal-status — is the site wired to the Stanza portal?
// Shows which settings are present (never their values), whether the Stripe key works, and where the prices and articles come from.
import { catalogStatus, getCatalogFresh } from '../_lib/live-catalog.js';
import { blogStatus, getBlog } from '../_lib/blog.js';
import { portalOrigin } from '../_lib/portal.js';
import { getStripe } from '../_lib/stripe.js';

// Stripe test: can the key read the prices the checkout uses? Answers « ok » or Stripe's reason
// (missing permission, revoked key…), with any key in the message masked.
async function stripeCheck(env) {
  const key = env.STRIPE_SECRET_KEY || '';
  if (!key) return { ok: false, error: 'STRIPE_SECRET_KEY absente' };
  const kind = /^rk_/.test(key) ? 'restricted' : /^sk_/.test(key) ? 'secret' : 'unknown';
  const mode = /_live_/.test(key) ? 'live' : /_test_/.test(key) ? 'test' : 'unknown';
  try {
    const { data } = await getStripe(env).prices.list({ lookup_keys: ['stanza_consent_standard'], active: true, limit: 1 });
    return { ok: true, kind, mode, consent_price_found: data.length > 0 };
  } catch (err) {
    const message = String((err && err.message) || 'erreur').replace(/\b[rs]k_(live|test)_\S+/g, '***');
    return { ok: false, kind, mode, error: message };
  }
}

export async function onRequestGet({ env }) {
  const [, , stripe] = await Promise.all([getCatalogFresh(env), getBlog(env), stripeCheck(env)]);
  const body = {
    portal_url: env.PORTAL_URL ? portalOrigin(env) : null,
    signing_secret_set: Boolean(env.PORTAL_SIGNING_SECRET),
    stripe_key_set: Boolean(env.STRIPE_SECRET_KEY),
    webhook_secret_set: Boolean(env.STRIPE_WEBHOOK_SECRET),
    stripe,
    catalog: catalogStatus(env),
    blog: blogStatus(env),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
