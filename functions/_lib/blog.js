// The journal's articles (/journal), written and published in the Stanza portal.
// Read from PORTAL_URL/api/blog, kept one minute per isolate and refreshed in the background,
// like the catalog (live-catalog.js). Every field is checked here: a malformed article is
// left out rather than breaking the page. When the portal can't be reached, PORTAL_URL is not
// set or no article is published there yet, the articles of blog-seed.js are shown.
import { SEED_POSTS } from './blog-seed.js';
import { plainText } from './markdown.js';

const FRESH_MS = 60_000;
const RETRY_MS = 15_000;

export const CATEGORIES = {
  deliverability: { fr: 'Délivrabilité', en: 'Deliverability' },
  consent: { fr: 'Consentement', en: 'Consent' },
  tracking: { fr: 'Suivi & mesure', en: 'Tracking' },
  accessibility: { fr: 'Accessibilité', en: 'Accessibility' },
  automation: { fr: 'Automatisation', en: 'Automation' },
  news: { fr: 'Actualités', en: 'News' },
};

const SLUG = /^[a-z0-9-]{3,80}$/;
const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const httpsUrl = (v) => {
  if (typeof v !== 'string' || v.length > 2000) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.href : null;
  } catch (_) {
    return null;
  }
};

/** Lower case, no accents, one dash between words: author keys and search. */
export const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const slugify = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export function normalizePost(p, now = Date.now()) {
  if (!p || typeof p !== 'object') return null;
  const slug = typeof p.slug === 'string' && SLUG.test(p.slug) ? p.slug : null;
  const title = text(p.title, 200);
  const published = typeof p.published_at === 'string' ? Date.parse(p.published_at) : NaN;
  if (!slug || !title || Number.isNaN(published) || published > now) return null; // scheduled: not yet
  const body = typeof p.body === 'string' ? p.body.slice(0, 100_000) : '';
  const words = plainText(body).split(' ').filter(Boolean).length;
  const c = p.category || {};
  const key = CATEGORIES[c.key] ? c.key : 'news';
  const tags = [];
  for (const t of Array.isArray(p.tags) ? p.tags : []) {
    const tag = text(t, 40);
    if (tag && !tags.some((x) => fold(x) === fold(tag))) tags.push(tag);
    if (tags.length === 12) break;
  }
  const a = p.author || {};
  const name = text(a.name, 80) || 'Stanza';
  return {
    slug,
    lang: p.lang === 'en' ? 'en' : 'fr',
    title,
    excerpt: text(p.excerpt, 400) || plainText(body).slice(0, 220),
    body,
    category: { key, label: { fr: text(c.label && c.label.fr, 40) || CATEGORIES[key].fr, en: text(c.label && c.label.en, 40) || CATEGORIES[key].en } },
    tags,
    author: { name, key: slugify(name) || 'stanza', role: a.role === 'specialist' ? 'specialist' : 'writer', avatar_url: httpsUrl(a.avatar_url) },
    cover_url: httpsUrl(p.cover_url),
    published_at: new Date(published).toISOString(),
    reading_minutes: Number.isInteger(p.reading_minutes) && p.reading_minutes > 0 && p.reading_minutes <= 120
      ? p.reading_minutes
      : Math.max(1, Math.round(words / 220)),
  };
}

/** Valid articles, one per slug, newest first. */
export function normalizePosts(list, now = Date.now()) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((p) => normalizePost(p, now))
    .filter((p) => p && !seen.has(p.slug) && seen.add(p.slug))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

// Built on first use: in Workers the clock reads 0 at module load, which would hide every article.
let seed = null;
const SEED = () => seed || (seed = { posts: normalizePosts(SEED_POSTS), live: false });

let current = null; // { at, blog }
let failedAt = 0;
let inflight = null;
let lastError = '';

async function load(env) {
  try {
    const res = await fetch(`${String(env.PORTAL_URL).replace(/\/$/, '')}/api/blog`, {
      headers: { accept: 'application/json', 'user-agent': 'stanzafix-site/1.0 (+https://stanzafix.com)' },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`portal responded ${res.status}`);
    const body = await res.json();
    if (!body || !Array.isArray(body.posts)) throw new Error('no posts array');
    current = { at: Date.now(), blog: { posts: normalizePosts(body.posts), live: true } };
    failedAt = 0;
    lastError = '';
  } catch (err) {
    failedAt = Date.now();
    lastError = String((err && err.message) || err).slice(0, 200);
    console.warn('[blog] portal unavailable, using the last known articles:', err && err.message);
  } finally {
    inflight = null;
  }
}

/** { posts, live }; `waitUntil` (from the Pages context) lets a stale copy refresh after the response. */
export async function getBlog(env, waitUntil) {
  if (!env || !env.PORTAL_URL) return SEED();
  const now = Date.now();
  const stale = !current || now - current.at > FRESH_MS;
  if (stale && now - failedAt > RETRY_MS && !inflight) inflight = load(env);
  if (!current && inflight) await inflight; // first request of the isolate
  else if (inflight && waitUntil) waitUntil(inflight);
  // Nothing published in the portal yet: the journal is never empty.
  return current && current.blog.posts.length ? current.blog : SEED();
}

/** For /api/portal-status. */
export function blogStatus(env) {
  return {
    source: !env || !env.PORTAL_URL ? 'seed (PORTAL_URL not set)'
      : !current ? 'seed (portal unreachable)'
      : current.blog.posts.length ? 'portal' : 'seed (no article published in the portal)',
    posts: current ? current.blog.posts.length : 0,
    fetched_at: current ? new Date(current.at).toISOString() : null,
    last_error: lastError || null,
  };
}
