// GET /api/portal-status — is the site wired to the Stanza portal?
// Shows which settings are present (never their values) and where the prices come from.
import { catalogStatus, getCatalogFresh } from '../_lib/live-catalog.js';
import { portalOrigin } from '../_lib/portal.js';

export async function onRequestGet({ env }) {
  await getCatalogFresh(env);
  const body = {
    portal_url: env.PORTAL_URL ? portalOrigin(env) : null,
    signing_secret_set: Boolean(env.PORTAL_SIGNING_SECRET),
    stripe_key_set: Boolean(env.STRIPE_SECRET_KEY),
    webhook_secret_set: Boolean(env.STRIPE_WEBHOOK_SECRET),
    catalog: catalogStatus(env),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
