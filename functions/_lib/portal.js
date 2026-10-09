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

const MAX_AGE_S = 300;

/**
 * Checks a request signed by the portal (same scheme as sendToPortal, in the other direction):
 * hex HMAC-SHA256 of `${timestamp}.${body}`, timestamp at most 5 minutes old.
 */
export async function verifyPortalRequest(env, request, body) {
  if (!env.PORTAL_SIGNING_SECRET) return false;
  const timestamp = request.headers.get('x-stanza-timestamp') || '';
  const signature = request.headers.get('x-stanza-signature') || '';
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!/^\d{9,12}$/.test(timestamp) || !(age <= MAX_AGE_S) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return sameHex(await hmacHex(env.PORTAL_SIGNING_SECRET, `${timestamp}.${body}`), signature);
}

function sameHex(expected, given) {
  if (expected.length !== given.length) return false;
  let diff = 0; // constant-time comparison
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/**
 * The signed-in buyer, from the checkout token the portal issues (POST /api/checkout-token) to a
 * visitor who has a session: `<base64url(JSON)>.<hex HMAC-SHA256 of "checkout.<base64url>">`,
 * valid ten minutes. The "checkout." prefix keeps it from being confused with an intake signature.
 * Returns { uid, email, name, company, locale } or null (missing, forged, expired).
 */
export async function verifyCheckoutToken(env, token) {
  if (!env.PORTAL_SIGNING_SECRET || typeof token !== 'string' || token.length > 2000) return null;
  const [body, signature] = token.split('.');
  if (!body || !/^[0-9a-f]{64}$/.test(signature || '') || !/^[A-Za-z0-9_-]+$/.test(body)) return null;
  if (!sameHex(await hmacHex(env.PORTAL_SIGNING_SECRET, `checkout.${body}`), signature)) return null;
  let data;
  try {
    const bin = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch (_) {
    return null;
  }
  if (!data || data.v !== 1 || !(data.exp > Date.now() / 1000)) return null;
  if (typeof data.uid !== 'string' || !/^[\w-]{8,64}$/.test(data.uid) || typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(data.email)) return null;
  return {
    uid: data.uid,
    email: data.email.slice(0, 254),
    name: typeof data.name === 'string' ? data.name.slice(0, 200) : '',
    company: typeof data.company === 'string' ? data.company.slice(0, 200) : '',
    locale: data.locale === 'en' ? 'en' : 'fr',
  };
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
