// Runs in front of every HTML page (see public/_routes.json).
// The pages are written in English; for French visitors the texts marked with
// data-i18n are swapped at the edge from strings-fr.js, so there is no flash
// of English and search engines get real French HTML. The catalog slots are
// filled from the live catalog (set in the portal, catalog.js as fallback) in both languages.
// The old /login and /signup pages now live in the client area (Stanza portal).
import { detectLang, langCookie } from './_lib/i18n.js';
import { FR } from './_lib/strings-fr.js';
import { renderSlot, productName } from './_lib/render.js';
import { getCatalog } from './_lib/live-catalog.js';
import { portalOrigin } from './_lib/portal.js';

const PORTAL_PAGES = { '/login': '/login', '/login.html': '/login', '/signup': '/signup', '/signup.html': '/signup' };

export async function onRequest({ request, next, env, waitUntil }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || (request.method !== 'GET' && request.method !== 'HEAD')) return next();
  const portalPath = PORTAL_PAGES[url.pathname.replace(/\/$/, '') || '/'];
  if (portalPath) return Response.redirect(`${portalOrigin(env)}${portalPath}`, 301);

  // The same URL serves two languages: always fetch the full page, never a 304.
  const headers = new Headers(request.headers);
  headers.delete('if-none-match');
  headers.delete('if-modified-since');
  const res = await next(new Request(request, { headers }));
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;

  const { lang, chosen } = detectLang(request);
  const out = new Response(res.body, res);
  out.headers.delete('etag');
  out.headers.delete('last-modified');
  out.headers.set('cache-control', 'private, no-cache');
  out.headers.set('vary', 'Cookie, Accept-Language');
  out.headers.set('content-language', lang);
  if (chosen) out.headers.append('set-cookie', langCookie(lang));
  const catalog = await getCatalog(env, waitUntil);
  out.headers.set('x-stanza-catalog', catalog.live ? 'portal' : 'static');
  return translate(out, lang, url, env, catalog);
}

// The CSS and JS keep the same file names between deployments, so browsers and
// Cloudflare's browser cache could serve an old copy with new HTML. Their URLs
// get ?v=<content hash> (the asset's ETag), which changes whenever the file does.
// One lookup per file and isolate; a new deployment starts new isolates.
const versions = new Map();
function assetVersion(env, origin, path) {
  if (!env || !env.ASSETS) return Promise.resolve('');
  if (!versions.has(path)) {
    versions.set(path, env.ASSETS.fetch(new Request(origin + path, { method: 'HEAD' }))
      .then((r) => (r.ok ? (r.headers.get('etag') || '').replace(/[^\w]/g, '').slice(-16) : ''))
      .catch(() => ''));
  }
  return versions.get(path);
}
const versioned = (env, origin, attr) => ({
  element: async (el) => {
    const path = el.getAttribute(attr);
    const v = await assetVersion(env, origin, path);
    if (v) el.setAttribute(attr, `${path}?v=${v}`);
  },
});

function translate(res, lang, url, env, catalog) {
  const page = `${url.origin}${url.pathname}`;
  const rewriter = new HTMLRewriter()
    .on('html', { element: (el) => el.setAttribute('lang', lang) })
    .on('link[rel="stylesheet"][href^="/assets/"]', versioned(env, url.origin, 'href'))
    .on('script[src^="/assets/"]', versioned(env, url.origin, 'src'))
    .on('head', {
      element: (el) => el.append(
        `<link rel="alternate" hreflang="en" href="${page}?lang=en">`
        + `<link rel="alternate" hreflang="fr" href="${page}?lang=fr">`
        + `<link rel="alternate" hreflang="x-default" href="${page}">`,
        { html: true },
      ),
    })
    .on('[data-lang]', {
      element: (el) => {
        if (el.getAttribute('data-lang') === lang) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      },
    })
    .on('[data-catalog]', { element: (el) => el.setInnerContent(renderSlot(el.getAttribute('data-catalog'), lang, catalog), { html: true }) })
    .on('[data-product-name]', { element: (el) => el.setInnerContent(productName(el.getAttribute('data-product-name'), lang)) });

  if (lang === 'fr') {
    rewriter
      .on('[data-i18n]', {
        element: (el) => {
          const key = el.getAttribute('data-i18n');
          if (key in FR) el.setInnerContent(FR[key], { html: true });
          else console.warn(`[i18n] missing FR string: ${key}`);
        },
      })
      .on('[data-i18n-attr]', {
        // data-i18n-attr="content:meta.desc; aria-label:nav.menu"
        element: (el) => {
          for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
            const [attr, key] = pair.split(':').map((s) => s.trim());
            if (attr && key in FR) el.setAttribute(attr, FR[key]);
          }
        },
      });
  }
  return rewriter.transform(res);
}
