// The catalog as set in the Stanza portal (Admin → Services & models): prices per speed
// (null = speed not offered), availability, Standard delay and the description shown on
// each offer card. Read from PORTAL_URL/api/catalog, kept one minute per isolate and
// refreshed in the background. If the portal can't be reached, catalog.js is used as is.
//
// Promotions (Admin → Promotions): `prices` is then the effective price, already discounted;
// `regular_prices` is the price before the promotion and `promo` describes it (label, −% or
// −€, end date). The top-level `promotions` lists the promotions running now (promo banner).
// An older portal sends neither: every offer then has `promo: null` and regular = effective.
import { CATALOG, BY_KEY, TIERS } from './catalog.js';

const FRESH_MS = 60_000;
const RETRY_MS = 15_000;
const STATIC = { list: CATALOG, byKey: BY_KEY, promotions: [], live: false };

let current = null; // { at, catalog }
let failedAt = 0;
let inflight = null;
let lastError = '';

// A price under 1 € is not a real price (Stripe refuses under 0.50 €): treated as "not offered".
const cents = (v) => (Number.isInteger(v) && v >= 100 && v <= 10_000_000 ? v : null);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 2000) : '');
const date = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const label = (l) => {
  const fr = text(l && l.fr).slice(0, 80);
  const en = text(l && l.en).slice(0, 80);
  return fr || en ? { fr: fr || en, en: en || fr } : null;
};
const promoId = (v) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : null);

// A service's promotion, or null. Only one of percent / amount_cents is shown (percent first).
export function parsePromo(p, now = Date.now()) {
  if (!p || typeof p !== 'object') return null;
  const id = promoId(p.id);
  const name = label(p.label);
  const endsAt = date(p.ends_at);
  if (!id || !name || (endsAt && Date.parse(endsAt) <= now)) return null;
  const percent = Number.isInteger(p.percent) && p.percent > 0 && p.percent < 100 ? p.percent : null;
  const amount = percent == null && Number.isInteger(p.amount_cents) && p.amount_cents > 0 ? p.amount_cents : null;
  return { id, label: name, percent, amount_cents: amount, ends_at: endsAt };
}

// The promotions running now (top of the pricing and home pages), soonest ending first.
export function parsePromotions(list, now = Date.now()) {
  return (Array.isArray(list) ? list : [])
    .map((p) => {
      const id = promoId(p && p.id);
      const name = label(p && p.label);
      const endsAt = date(p && p.ends_at);
      const startsAt = date(p && p.starts_at);
      if (!id || !name || !endsAt || Date.parse(endsAt) <= now || (startsAt && Date.parse(startsAt) > now)) return null;
      const services = p.scope === 'services' && Array.isArray(p.services) ? p.services.filter((k) => typeof k === 'string' && BY_KEY[k]) : [];
      return { id, label: name, scope: services.length ? 'services' : 'all', services, starts_at: startsAt, ends_at: endsAt };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(a.ends_at) - Date.parse(b.ends_at));
}

export function mergeCatalog(remote, promotions) {
  const byRemote = new Map((Array.isArray(remote) ? remote : []).filter((s) => s && typeof s.key === 'string').map((s) => [s.key, s]));
  const list = CATALOG.map((item) => {
    const r = byRemote.get(item.key);
    if (!r) return item;
    const p = r.prices || {};
    // Quotes keep no price; packs keep their single (Standard) price.
    const prices = item.quote ? item.prices
      : item.single ? { standard: cents(p.standard), express: null, flash: null }
      : Object.fromEntries(TIERS.map((t) => [t, cents(p[t])]));
    const offered = item.quote || TIERS.some((t) => prices[t] != null);
    const d = r.description || {};
    // Price before the promotion, per speed; missing (older portal) = the effective price.
    const rp = r.regular_prices && typeof r.regular_prices === 'object' ? r.regular_prices : {};
    const regular = Object.fromEntries(TIERS.map((t) => [t, prices[t] == null ? null : cents(rp[t]) || prices[t]]));
    const promo = item.quote ? null : parsePromo(r.promo);
    return {
      ...item,
      prices,
      regular,
      promo,
      days: Number.isInteger(r.days) && r.days > 0 && r.days <= 60 ? r.days : item.days,
      active: r.active !== false && offered,
      fr: text(d.fr) ? { ...item.fr, short: text(d.fr) } : item.fr,
      en: text(d.en) ? { ...item.en, short: text(d.en) } : item.en,
    };
  });
  return { list, byKey: Object.fromEntries(list.map((p) => [p.key, p])), promotions: parsePromotions(promotions), live: true };
}

async function load(env) {
  try {
    const res = await fetch(`${String(env.PORTAL_URL).replace(/\/$/, '')}/api/catalog`, {
      headers: { accept: 'application/json', 'user-agent': 'stanzafix-site/1.0 (+https://stanzafix.com)' },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`portal responded ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body.services) || body.services.length === 0) throw new Error('empty catalog');
    current = { at: Date.now(), catalog: mergeCatalog(body.services, body.promotions) };
    failedAt = 0;
    lastError = '';
  } catch (err) {
    failedAt = Date.now();
    lastError = String((err && err.message) || err).slice(0, 200);
    console.warn('[catalog] portal unavailable, using the last known catalog:', err && err.message);
  } finally {
    inflight = null;
  }
}

/** Live catalog; `waitUntil` (from the Pages context) lets a stale copy refresh after the response. */
export async function getCatalog(env, waitUntil) {
  if (!env || !env.PORTAL_URL) return STATIC;
  const now = Date.now();
  const stale = !current || now - current.at > FRESH_MS;
  if (stale && now - failedAt > RETRY_MS && !inflight) inflight = load(env);
  if (!current && inflight) await inflight; // first request of the isolate
  else if (inflight && waitUntil) waitUntil(inflight);
  return current ? current.catalog : STATIC;
}

/** Same, but always as fresh as possible: used by the checkout, where the price is charged. */
export async function getCatalogFresh(env) {
  if (!env || !env.PORTAL_URL) return STATIC;
  if (!current || Date.now() - current.at > 10_000) {
    if (!inflight) inflight = load(env);
    await inflight;
  }
  return current ? current.catalog : STATIC;
}

/**
 * The portal's catalog read again right now (the cache is skipped), or null if the portal
 * could not be reached: nothing is ever synced to Stripe from a stale or fallback catalog.
 */
export async function getCatalogNow(env) {
  if (!env || !env.PORTAL_URL) return null;
  if (inflight) await inflight; // a load already running may predate the change: read again after it
  const since = Date.now();
  inflight = load(env);
  await inflight;
  return current && current.at >= since ? current.catalog : null;
}

/** For /api/portal-status: where the prices shown right now come from. */
export function catalogStatus(env) {
  return {
    source: !env || !env.PORTAL_URL ? 'static (PORTAL_URL not set)' : current ? 'portal' : 'static (portal unreachable)',
    fetched_at: current ? new Date(current.at).toISOString() : null,
    last_error: lastError || null,
  };
}
