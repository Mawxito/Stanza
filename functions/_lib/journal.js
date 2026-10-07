// The journal pages, rendered server side from public/journal.html (same head, header and
// footer as the rest of the site; the middleware then translates them like any page):
//   /journal          list of articles, with filters read from the URL (shareable, works without JS)
//   /journal/<slug>   one article (Markdown from the portal, rendered safely), or a 404
// The list filters again in the browser without reloading (public/assets/js/journal.js,
// same rules as filterPosts below: keep both in step).
import { detectLang } from './i18n.js';
import { getBlog, CATEGORIES, fold } from './blog.js';
import { renderMarkdown } from './markdown.js';
import { MOTIFS } from './render.js';

const UI = {
  fr: {
    locale: 'fr-FR',
    all: 'Toutes',
    count: (n, total) => (n === total ? `${n} article${n > 1 ? 's' : ''}` : n ? `${n} article${n > 1 ? 's' : ''} sur ${total}` : 'Aucun article'),
    role: { specialist: 'Spécialiste', writer: 'Rédaction' },
    read: (m) => `${m} min de lecture`,
    back: 'Retour au journal',
    related: 'À lire aussi',
    relatedLead: 'Sur les mêmes sujets, par nos spécialistes.',
    remove: (l) => `Retirer le filtre : ${l}`,
    pill: { q: 'Recherche', category: 'Catégorie', tag: 'Mot-clé', author: 'Auteur', language: 'Langue', sort: 'Tri' },
    langName: { fr: 'Français', en: 'Anglais' },
    sortName: { newest: "Plus récents d'abord", oldest: "Plus anciens d'abord" },
    inLang: { fr: 'Article en français', en: 'Article en anglais' },
    published: 'Publié le',
    tags: 'Mots-clés',
    notFound: {
      title: 'Article introuvable — Stanza',
      eyebrow: 'Erreur 404',
      h1: "Cet article n'existe pas, ou plus.",
      text: "Il a peut-être été renommé ou retiré. Les derniers articles du journal sont juste en dessous.",
      latest: 'Derniers articles',
    },
  },
  en: {
    locale: 'en-IE',
    all: 'All',
    count: (n, total) => (n === total ? `${n} article${n > 1 ? 's' : ''}` : n ? `${n} of ${total} articles` : 'No article'),
    role: { specialist: 'Specialist', writer: 'Editorial team' },
    read: (m) => `${m} min read`,
    back: 'Back to the journal',
    related: 'Read next',
    relatedLead: 'On the same topics, by our specialists.',
    remove: (l) => `Remove filter: ${l}`,
    pill: { q: 'Search', category: 'Category', tag: 'Tag', author: 'Author', language: 'Language', sort: 'Sort' },
    langName: { fr: 'French', en: 'English' },
    sortName: { newest: 'Newest first', oldest: 'Oldest first' },
    inLang: { fr: 'Article in French', en: 'Article in English' },
    published: 'Published on',
    tags: 'Tags',
    notFound: {
      title: 'Article not found — Stanza',
      eyebrow: 'Error 404',
      h1: "This article doesn't exist, or not any more.",
      text: 'It may have been renamed or taken down. The latest articles of the journal are just below.',
      latest: 'Latest articles',
    },
  },
};

const CAT_ICON = { deliverability: 'i-mail-check', consent: 'i-cookie', tracking: 'i-server', accessibility: 'i-scan-search', automation: 'i-zap', news: 'i-newspaper' };
const CAT_MOTIF = { deliverability: 'inbox', consent: 'consent', tracking: 'tracking', accessibility: 'accessibility', automation: 'leads' };
const NEWS_MOTIF = '<svg viewBox="0 0 120 80" class="sv sv--news"><rect class="sv-page" x="34" y="12" width="52" height="58" rx="6"/><rect class="sv-head" x="42" y="21" width="36" height="7" rx="2"/><rect class="sv-line" x="42" y="35" width="36" height="3" rx="1.5"/><rect class="sv-line" x="42" y="43" width="28" height="3" rx="1.5"/><rect class="sv-line" x="42" y="51" width="32" height="3" rx="1.5"/><circle class="sv-dot" cx="88" cy="16" r="5"/></svg>';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const icon = (id, size = 16) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"/></svg>`;
const fmtDate = (iso, lang) => new Intl.DateTimeFormat(UI[lang].locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(iso));
const catLabel = (post, lang) => post.category.label[lang] || CATEGORIES[post.category.key][lang];
const initials = (name) => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/* ------------------------------------------------------------------
 * Filters (URL ⇄ state). Same rules in assets/js/journal.js.
 * ------------------------------------------------------------------ */
export function parseFilters(params) {
  const clean = (v, max) => String(v || '').replace(/["<>]/g, '').trim().slice(0, max);
  const tags = [];
  for (const t of params.getAll('tag')) {
    const tag = clean(t, 40);
    if (tag && !tags.some((x) => fold(x) === fold(tag))) tags.push(tag);
  }
  const category = params.get('category');
  const language = params.get('language');
  return {
    q: clean(params.get('q'), 80),
    category: CATEGORIES[category] ? category : '',
    tags: tags.slice(0, 12),
    author: /^[a-z0-9-]{1,60}$/.test(params.get('author') || '') ? params.get('author') : '',
    language: language === 'fr' || language === 'en' ? language : '',
    sort: params.get('sort') === 'oldest' ? 'oldest' : 'newest',
  };
}

export const haystack = (post) => fold([post.title, post.excerpt, post.tags.join(' '), post.author.name, post.category.label.fr, post.category.label.en].join(' '));

export function matches(post, f) {
  if (f.category && post.category.key !== f.category) return false;
  if (f.author && post.author.key !== f.author) return false;
  if (f.language && post.lang !== f.language) return false;
  // Tags: any of the selected ones.
  if (f.tags.length && !post.tags.some((t) => f.tags.some((x) => fold(x) === fold(t)))) return false;
  if (f.q) {
    const text = haystack(post);
    if (!fold(f.q).split(/\s+/).filter(Boolean).every((w) => text.includes(w))) return false;
  }
  return true;
}

/** Matching articles in display order: the page language first (unless a language is chosen), then by date. */
export function filterPosts(posts, f, pageLang) {
  const dir = f.sort === 'oldest' ? 1 : -1;
  return posts.filter((p) => matches(p, f)).sort((a, b) => {
    if (!f.language && a.lang !== b.lang) return a.lang === pageLang ? -1 : b.lang === pageLang ? 1 : 0;
    return dir * (Date.parse(a.published_at) - Date.parse(b.published_at));
  });
}

export function filtersQuery(f, extra = {}) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.category) p.set('category', f.category);
  for (const t of f.tags) p.append('tag', t);
  if (f.author) p.set('author', f.author);
  if (f.language) p.set('language', f.language);
  if (f.sort === 'oldest') p.set('sort', 'oldest');
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/* ------------------------------------------------------------------
 * Pieces
 * ------------------------------------------------------------------ */
function avatar(author) {
  return author.avatar_url
    ? `<span class="jr-avatar"><img src="${esc(author.avatar_url)}" alt="" width="36" height="36" loading="lazy" decoding="async"></span>`
    : `<span class="jr-avatar" aria-hidden="true">${esc(initials(author.name))}</span>`;
}

function byline(post, lang, cls = '') {
  const ui = UI[lang];
  return `<div class="jr-byline${cls}">${avatar(post.author)}`
    + `<span class="jr-byline__who"><b>${esc(post.author.name)}</b><small class="jr-role jr-role--${post.author.role}">${ui.role[post.author.role]}</small></span>`
    + `<span class="jr-byline__when"><time datetime="${post.published_at}">${fmtDate(post.published_at, lang)}</time>`
    + `<span aria-hidden="true">·</span><span>${icon('i-clock', 14)}${ui.read(post.reading_minutes)}</span></span>`
    + '</div>';
}

const tagList = (post, cls = '') => (post.tags.length
  ? `<ul class="jr-tags${cls}">${post.tags.map((t) => `<li><a href="/journal${esc(filtersQuery({ q: '', category: '', tags: [t], author: '', language: '', sort: 'newest' }))}">#${esc(t)}</a></li>`).join('')}</ul>`
  : '');

function visual(post) {
  if (post.cover_url) return `<span class="jr-card__visual jr-card__visual--cover"><img src="${esc(post.cover_url)}" alt="" loading="lazy" decoding="async"></span>`;
  const motif = MOTIFS[CAT_MOTIF[post.category.key]] || NEWS_MOTIF;
  return `<span class="jr-card__visual" aria-hidden="true">${motif}</span>`;
}

export function card(post, lang, { index = 0, hidden = false, filterable = false } = {}) {
  const data = filterable
    ? ` data-jr-card data-lang="${post.lang}" data-category="${post.category.key}" data-author="${esc(post.author.key)}"`
      + ` data-tags="${esc(post.tags.map(fold).join('|'))}" data-date="${Date.parse(post.published_at)}" data-text="${esc(haystack(post))}"`
    : '';
  return `<article class="jr-card"${data} style="--i:${index}"${hidden ? ' hidden' : ''}>`
    + `<a class="jr-card__link" href="/journal/${post.slug}" data-glow>`
    + '<span class="jr-card__glow" aria-hidden="true"></span>'
    + visual(post)
    + '<span class="jr-card__body">'
    + `<span class="jr-card__meta"><span class="jr-cat">${icon(CAT_ICON[post.category.key], 14)}${esc(catLabel(post, lang))}</span>`
    + `<span class="jr-lang" title="${UI[lang].inLang[post.lang]}">${post.lang.toUpperCase()}</span></span>`
    + `<h3 class="jr-card__title" lang="${post.lang}">${esc(post.title)}</h3>`
    + `<span class="jr-card__excerpt" lang="${post.lang}">${esc(post.excerpt)}</span>`
    + '</span></a>'
    + tagList(post, ' jr-tags--card')
    + byline(post, lang, ' jr-byline--card')
    + '</article>';
}

/* ------------------------------------------------------------------
 * List page
 * ------------------------------------------------------------------ */
function facets(posts, lang) {
  const cats = Object.keys(CATEGORIES)
    .map((key) => {
      const inCat = posts.filter((p) => p.category.key === key);
      return inCat.length ? { key, label: catLabel(inCat[0], lang), n: inCat.length } : null;
    })
    .filter(Boolean);
  const tagCount = new Map();
  for (const p of posts) for (const t of p.tags) {
    const k = fold(t);
    const cur = tagCount.get(k) || { label: t, n: 0 };
    cur.n += 1;
    tagCount.set(k, cur);
  }
  const tags = [...tagCount.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, 30);
  const authors = new Map();
  for (const p of posts) if (!authors.has(p.author.key)) authors.set(p.author.key, p.author);
  return { cats, tags, authors: [...authors.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

const CHECK = '<svg class="jr-chip__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function categoryChips(fc, f, lang) {
  const chip = (value, label, n, ic) => `<label class="jr-chip"><input type="radio" name="category" value="${value}"${f.category === value ? ' checked' : ''}>`
    + `<span class="jr-chip__face">${ic ? icon(ic, 14) : ''}<span class="jr-chip__label">${esc(label)}</span>${n ? `<i class="jr-chip__n">${n}</i>` : ''}</span></label>`;
  return chip('', UI[lang].all, 0, null) + fc.cats.map((c) => chip(c.key, c.label, c.n, CAT_ICON[c.key])).join('');
}

function tagChips(fc, f) {
  return fc.tags.map((t) => `<label class="jr-chip jr-chip--tag"><input type="checkbox" name="tag" value="${esc(t.label)}"${f.tags.some((x) => fold(x) === fold(t.label)) ? ' checked' : ''}>`
    + `<span class="jr-chip__face">${CHECK}<span class="jr-chip__label">${esc(t.label)}</span></span></label>`).join('');
}

const authorOptions = (fc, f, lang) => fc.authors.map((a) => `<option value="${esc(a.key)}"${f.author === a.key ? ' selected' : ''}>${esc(a.name)} · ${UI[lang].role[a.role]}</option>`).join('');

// Active filters as removable pills (links: they work without JavaScript too).
function activePills(f, fc, lang) {
  const ui = UI[lang];
  const pill = (kind, value, label, without) => `<li data-key="${esc(`${kind}:${fold(value)}`)}"><a class="jr-pill" href="/journal${esc(filtersQuery(without))}" aria-label="${esc(ui.remove(label))}">`
    + `<small>${ui.pill[kind]}</small><span>${esc(label)}</span>${icon('i-x', 14)}</a></li>`;
  const out = [];
  if (f.q) out.push(pill('q', f.q, `“${f.q}”`, { ...f, q: '' }));
  if (f.category) {
    const c = fc.cats.find((x) => x.key === f.category);
    out.push(pill('category', f.category, c ? c.label : CATEGORIES[f.category][lang], { ...f, category: '' }));
  }
  for (const t of f.tags) out.push(pill('tag', t, `#${t}`, { ...f, tags: f.tags.filter((x) => x !== t) }));
  if (f.author) {
    const a = fc.authors.find((x) => x.key === f.author);
    out.push(pill('author', f.author, a ? a.name : f.author, { ...f, author: '' }));
  }
  if (f.language) out.push(pill('language', f.language, ui.langName[f.language], { ...f, language: '' }));
  if (f.sort === 'oldest') out.push(pill('sort', 'oldest', ui.sortName.oldest, { ...f, sort: 'newest' }));
  return out.join('');
}

const isFiltered = (f) => Boolean(f.q || f.category || f.tags.length || f.author || f.language || f.sort === 'oldest');

/* ------------------------------------------------------------------
 * Head of the page: the template's description / Open Graph tags are replaced.
 * ------------------------------------------------------------------ */
function headTags({ description, canonical, ogTitle, ogType = 'website', image = null, extra = '' }) {
  return `<meta name="description" content="${esc(description)}">`
    + `<link rel="canonical" href="${esc(canonical)}">`
    + `<meta property="og:title" content="${esc(ogTitle)}">`
    + `<meta property="og:description" content="${esc(description)}">`
    + `<meta property="og:type" content="${ogType}">`
    + `<meta property="og:url" content="${esc(canonical)}">`
    + (image ? `<meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">')
    + extra;
}

// Replaces the template's <title>, description and Open Graph tags (translated keys removed,
// so the middleware leaves them alone).
function withHead(rewriter, { title, head }) {
  return rewriter
    .on('title', { element: (el) => { el.removeAttribute('data-i18n'); el.setInnerContent(title); } })
    .on('meta[name="description"], meta[property^="og:"]:not([property="og:site_name"])', { element: (el) => el.remove() })
    .on('head', { element: (el) => el.append(head, { html: true }) });
}

async function template(env, url) {
  if (!env || !env.ASSETS) throw new Error('ASSETS binding missing');
  const res = await env.ASSETS.fetch(new Request(`${url.origin}/journal`, { method: 'GET' }));
  if (!res.ok) throw new Error(`template responded ${res.status}`);
  return res;
}

const html = (res, status) => new Response(res.body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

export async function journalList({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const { lang } = detectLang(request);
  const ui = UI[lang];
  const [{ posts }, tpl] = await Promise.all([getBlog(env, waitUntil), template(env, url)]);
  const f = parseFilters(url.searchParams);
  const fc = facets(posts, lang);
  const shown = filterPosts(posts, f, lang);
  const rest = posts.filter((p) => !shown.includes(p));
  const list = shown.map((p, i) => card(p, lang, { index: i, filterable: true })).join('')
    + rest.map((p) => card(p, lang, { hidden: true, filterable: true })).join('');
  const canonical = `${url.origin}/journal`;
  const filtered = isFiltered(f);

  // The list keeps its translated title and description (data-i18n): only canonical and og:url are added.
  const out = new HTMLRewriter()
    .on('head', { element: (el) => el.append(`<link rel="canonical" href="${esc(canonical)}"><meta property="og:url" content="${esc(canonical)}">`, { html: true }) })
    .on('[data-jr-slot="list"]', { element: (el) => el.setInnerContent(list, { html: true }) })
    .on('[data-jr-slot="categories"]', { element: (el) => el.setInnerContent(categoryChips(fc, f, lang), { html: true }) })
    .on('[data-jr-slot="tags"]', { element: (el) => el.setInnerContent(tagChips(fc, f), { html: true }) })
    .on('[data-jr-slot="authors"]', { element: (el) => el.append(authorOptions(fc, f, lang), { html: true }) })
    .on('[data-jr-slot="count"]', { element: (el) => el.setInnerContent(ui.count(shown.length, posts.length)) })
    .on('[data-jr-slot="active"]', { element: (el) => el.setInnerContent(activePills(f, fc, lang), { html: true }) })
    .on('.jr-bar [data-jr-reset]', { element: (el) => { if (!filtered) el.setAttribute('hidden', ''); } })
    .on('[data-jr-empty]', { element: (el) => { if (shown.length) el.setAttribute('hidden', ''); else el.removeAttribute('hidden'); } })
    .on('input[name="q"]', { element: (el) => { if (f.q) el.setAttribute('value', f.q); } })
    .on('select[name="language"] option', { element: (el) => { if (el.getAttribute('value') === f.language) el.setAttribute('selected', ''); } })
    .on('select[name="sort"] option', { element: (el) => { if (el.getAttribute('value') === f.sort) el.setAttribute('selected', ''); } })
    // The EN / FR switch keeps the filters.
    .on('a[data-lang]', { element: (el) => el.setAttribute('href', filtersQuery(f, { lang: el.getAttribute('data-lang') })) });
  return html(out.transform(tpl), 200);
}

/* ------------------------------------------------------------------
 * Article page
 * ------------------------------------------------------------------ */
function related(post, posts) {
  const tags = new Set(post.tags.map(fold));
  const scored = posts
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ p, score: (p.category.key === post.category.key ? 3 : 0) + p.tags.filter((t) => tags.has(fold(t))).length + (p.lang === post.lang ? 0.5 : 0) }))
    .sort((a, b) => b.score - a.score || Date.parse(b.p.published_at) - Date.parse(a.p.published_at));
  return scored.slice(0, 3).map((s) => s.p);
}

function relatedSection(list, lang, title, lead) {
  if (!list.length) return '';
  return '<section class="jr-related"><div class="container">'
    + `<div class="jr-related__head" data-reveal><h2 class="h2">${esc(title)}</h2>${lead ? `<p class="body-lg">${esc(lead)}</p>` : ''}</div>`
    + `<div class="jr-grid jr-grid--related">${list.map((p, i) => card(p, lang, { index: i })).join('')}</div>`
    + '</div></section>';
}

function articleMain(post, posts, lang) {
  const ui = UI[lang];
  return '<div class="jr-progress" aria-hidden="true"><span data-jr-progress></span></div>'
    + `<article class="jr-article" data-jr-article>`
    + '<header class="jr-article__head u-dark">'
    + '<canvas class="pr-hero__stars" data-stars data-stars-pace="slow" aria-hidden="true"></canvas>'
    + '<div class="container jr-article__head-inner">'
    + `<a class="jr-back" href="/journal" data-intro>${icon('i-arrow-left', 16)}<span>${ui.back}</span></a>`
    + `<p class="jr-article__kicker" data-intro><a class="jr-cat jr-cat--dark" href="/journal?category=${post.category.key}">${icon(CAT_ICON[post.category.key], 14)}${esc(catLabel(post, lang))}</a>`
    + (post.lang !== lang ? `<span class="jr-lang jr-lang--dark">${ui.inLang[post.lang]}</span>` : '')
    + '</p>'
    + `<h1 class="display display--md jr-article__title" lang="${post.lang}" data-split>${esc(post.title)}</h1>`
    + `<p class="hero__lead jr-article__lead" lang="${post.lang}" data-intro>${esc(post.excerpt)}</p>`
    + `<div data-intro>${byline(post, lang, ' jr-byline--dark')}</div>`
    + '</div></header>'
    + (post.cover_url ? `<figure class="jr-article__cover container"><img src="${esc(post.cover_url)}" alt="" decoding="async"></figure>` : '')
    + '<div class="container container--sm jr-article__body">'
    + `<div class="jr-prose" lang="${post.lang}">${renderMarkdown(post.body)}</div>`
    + '<footer class="jr-article__foot">'
    + (post.tags.length ? `<p class="jr-article__foot-label">${icon('i-tag', 16)}${ui.tags}</p>${tagList(post)}` : '')
    + `<a class="arrow-link jr-article__back" href="/journal"><span aria-hidden="true">←</span> ${ui.back}</a>`
    + '</footer></div></article>'
    + relatedSection(related(post, posts), lang, ui.related, ui.relatedLead);
}

function jsonLd(post, canonical, origin) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published_at,
    dateModified: post.published_at,
    inLanguage: post.lang,
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    author: { '@type': 'Person', name: post.author.name },
    publisher: { '@type': 'Organization', name: 'Stanza', url: origin, logo: { '@type': 'ImageObject', url: `${origin}/assets/img/favicon.svg` } },
    articleSection: post.category.label[post.lang],
    keywords: post.tags.join(', '),
    timeRequired: `PT${post.reading_minutes}M`,
  };
  if (post.cover_url) ld.image = post.cover_url;
  // No "</script>" can close the tag early.
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

export async function journalArticle({ request, env, waitUntil, params }) {
  const url = new URL(request.url);
  const { lang } = detectLang(request);
  const [{ posts }, tpl] = await Promise.all([getBlog(env, waitUntil), template(env, url)]);
  const slug = String(params.slug || '').toLowerCase();
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    const nf = UI[lang].notFound;
    const main = '<section class="jr-404 u-dark">'
      + '<canvas class="pr-hero__stars" data-stars data-stars-pace="slow" aria-hidden="true"></canvas>'
      + '<div class="container jr-404__inner">'
      + `<p class="eyebrow eyebrow--dark" data-intro>${nf.eyebrow}</p>`
      + `<h1 class="display display--md" data-split>${esc(nf.h1)}</h1>`
      + `<p class="hero__lead" data-intro>${esc(nf.text)}</p>`
      + `<a class="btn btn--light" href="/journal" data-intro>${icon('i-arrow-left', 16)}${UI[lang].back}</a>`
      + '</div></section>'
      + relatedSection(posts.slice(0, 3), lang, nf.latest, '');
    const rw = withHead(new HTMLRewriter(), {
      title: nf.title,
      head: headTags({ description: nf.text, canonical: `${url.origin}/journal`, ogTitle: nf.title }) + '<meta name="robots" content="noindex">',
    }).on('main', { element: (el) => el.setInnerContent(main, { html: true }) });
    return html(rw.transform(tpl), 404);
  }

  const canonical = `${url.origin}/journal/${post.slug}`;
  const extra = `<meta property="article:published_time" content="${post.published_at}">`
    + `<meta property="article:section" content="${esc(post.category.label[post.lang])}">`
    + post.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join('')
    + jsonLd(post, canonical, url.origin);
  const rw = withHead(new HTMLRewriter(), {
    title: `${post.title} — Stanza`,
    head: headTags({ description: post.excerpt, canonical, ogTitle: post.title, ogType: 'article', image: post.cover_url, extra }),
  }).on('main', { element: (el) => el.setInnerContent(articleMain(post, posts, lang), { html: true }) });
  return html(rw.transform(tpl), 200);
}
