// Bridge to the Stanza portal (client area, https://portail.stanzafix.com).
// Two Cloudflare Pages secrets:
//   PORTAL_URL             e.g. https://portail.stanzafix.com   (no trailing slash)
//   PORTAL_SIGNING_SECRET  same value as INTAKE_SIGNING_SECRET in the portal
//
// Signature: hex HMAC-SHA256 of `${timestamp}.${body}`. The portal rejects requests older
// than 5 minutes and deduplicates on `event_id`: a Stripe retry has no effect.

const encoder = new TextEncoder();

export const portalOrigin = (env) => String((env && env.PORTAL_URL) || 'https://portail.stanzafix.com').replace(/\/$/, '');

export const portalConfigured = (env) => Boolean(env && env.PORTAL_URL && env.PORTAL_SIGNING_SECRET);

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sendToPortal(env, path, payload) {
  if (!portalConfigured(env)) throw new Error('PORTAL_URL / PORTAL_SIGNING_SECRET are not configured');
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${portalOrigin(env)}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-stanza-timestamp': timestamp,
      'x-stanza-signature': await hmacHex(env.PORTAL_SIGNING_SECRET, `${timestamp}.${body}`),
    },
    body,
  });
  // 422 = data refused (unknown offer, invalid email): no point retrying, but worth watching.
  if (res.status === 422) {
    console.error('[portal] refused:', await res.text());
    return { ok: false, status: 422 };
  }
  if (!res.ok) throw new Error(`portal responded ${res.status}`); // 5xx: Stripe will retry the event
  return res.json();
}
