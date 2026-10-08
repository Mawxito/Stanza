// POST /api/forms — the site's own forms (contact, quote, specialist application, free check, newsletter).
// Answers are checked here, then forwarded, signed, to the portal (Admin → Formulaires).
//
// Spam protection: same-origin check, a honeypot field, a minimum fill time and a per-IP hourly limit (KV).
// Nothing is stored on the site itself.
import { portalConfigured, sendToPortal } from '../_lib/portal.js';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const URLISH = /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i;

// Allowed fields per form: [type, max length, required]. Anything else is dropped.
const FORMS = {
  contact: {
    kind: 'contact',
    fields: { name: ['text', 120, true], email: ['email', 254, true], company: ['text', 160], topic: ['choice', 40], message: ['long', 4000, true] },
  },
  quote: {
    kind: 'quote',
    fields: {
      name: ['text', 120, true], email: ['email', 254, true], company: ['text', 160], offer: ['choice', 40],
      domains: ['int', 5], need: ['long', 3000], deadline: ['choice', 20], message: ['long', 3000],
    },
  },
  specialist: {
    kind: 'specialist',
    fields: {
      name: ['text', 120, true], email: ['email', 254, true], phone: ['text', 40], city: ['text', 120],
      areas: ['list', 400, true], other: ['text', 300], experience: ['choice', 20, true], time: ['choice', 20, true],
      links: ['long', 1000], message: ['long', 3000, true], consent: ['bool', 5, true],
    },
  },
  consentCheck: {
    kind: 'consent_check',
    fields: {
      name: ['text', 120, true], email: ['email', 254, true], company: ['text', 160], site: ['url', 300, true],
      cmp: ['choice', 40], pages: ['long', 1000], message: ['long', 2000],
    },
  },
  newsletter: {
    kind: 'newsletter',
    fields: { email: ['email', 254, true], name: ['text', 120], topics: ['list', 200], consent: ['bool', 5, true] },
  },
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

function clean(def, raw) {
  const out = {};
  const missing = [];
  for (const [key, [type, max, required]] of Object.entries(def.fields)) {
    let v = raw ? raw[key] : undefined;
    if (Array.isArray(v)) v = v.filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean).join(', ');
    if (typeof v === 'number') v = String(v);
    if (type === 'bool') v = v === true || v === 'true' || v === 'on' ? 'oui' : '';
    if (typeof v !== 'string') v = '';
    v = v.replace(/\u0000/g, '').trim();
    if (type !== 'long') v = v.replace(/\s+/g, ' ');
    if (v.length > max) v = v.slice(0, max);
    if (v && type === 'email' && !EMAIL.test(v)) return { error: key };
    if (v && type === 'url' && !URLISH.test(v)) return { error: key };
    if (v && type === 'int' && !/^\d{1,5}$/.test(v)) return { error: key };
    if (!v && required) missing.push(key);
    if (v) out[key] = v;
  }
  return missing.length ? { error: missing[0] } : { data: out };
}

async function limited(env, ip) {
  if (!env.ORDERS || !ip) return false;
  const key = `rl:forms:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
  const n = Number((await env.ORDERS.get(key)) || 0) + 1;
  await env.ORDERS.put(key, String(n), { expirationTtl: 3700 });
  return n > 8;
}

export async function onRequestPost({ request, env }) {
  // Same-origin only (the site's own pages).
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'forbidden' }, 403);
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: 'unsupported' }, 415);

  let body;
  try {
    const text = await request.text();
    if (text.length > 20_000) return json({ error: 'too_large' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'invalid' }, 400);
  }
  const def = FORMS[body && body.form];
  if (!def) return json({ error: 'unknown_form' }, 422);

  // Robots: the hidden field is filled, or the form was sent faster than a human could. Pretend it worked.
  const elapsed = Date.now() - Number(body.started_at || 0);
  if (body.hp || !(elapsed > 2500 && elapsed < 6 * 3_600_000)) return json({ ok: true });

  if (await limited(env, request.headers.get('cf-connecting-ip'))) return json({ error: 'too_many' }, 429);

  const { data, error } = clean(def, body.fields);
  if (error) return json({ error: 'invalid_field', field: error }, 422);
  if (!portalConfigured(env)) return json({ error: 'unavailable' }, 503);

  // The portal keeps free text in « message » (5 000 characters) and short values in the payload (1 000 each).
  const { email, name = '', company = '', message: note = '', need = '', ...rest } = data;
  const message = [need, note].filter(Boolean).join('\n\n').slice(0, 5000);
  const payload = { ...rest, page: String(body.page || '').slice(0, 200), lang: body.lang === 'en' ? 'en' : 'fr' };
  try {
    const res = await sendToPortal(env, '/api/intake/requests', {
      event_id: `form_${crypto.randomUUID()}`,
      kind: def.kind,
      email, name, company, message,
      payload,
    });
    if (res && res.ok === false) return json({ error: 'refused' }, 422);
  } catch (err) {
    console.error('[forms] portal:', err && err.message);
    return json({ error: 'unavailable' }, 502);
  }
  return json({ ok: true });
}
