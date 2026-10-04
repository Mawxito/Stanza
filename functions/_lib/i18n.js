// Language selection. Order of precedence:
//   1. ?lang=fr|en in the URL (the EN / FR switch in the header; also remembered in a cookie)
//   2. the stanza_lang cookie (a previous choice)
//   3. the visitor's country from Cloudflare: France (overseas included) → French, elsewhere → English
//   4. no country available (local dev): the browser language
export const LANGS = ['en', 'fr'];
export const COOKIE = 'stanza_lang';

const FRENCH_COUNTRIES = new Set(['FR', 'GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'BL', 'MF', 'WF', 'PF', 'NC']);

export function detectLang(request) {
  const param = new URL(request.url).searchParams.get('lang');
  if (LANGS.includes(param)) return { lang: param, chosen: true };

  const cookie = new RegExp(`(?:^|;\\s*)${COOKIE}=(en|fr)(?:;|$)`).exec(request.headers.get('cookie') || '');
  if (cookie) return { lang: cookie[1], chosen: false };

  const country = request.cf && request.cf.country;
  if (country) return { lang: FRENCH_COUNTRIES.has(country) ? 'fr' : 'en', chosen: false };

  return { lang: /^fr\b/i.test(request.headers.get('accept-language') || '') ? 'fr' : 'en', chosen: false };
}

// A language preference set at the visitor's request is exempt from cookie consent.
export const langCookie = (lang) => `${COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
