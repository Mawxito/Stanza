// Server-side HTML for the catalog slots (<div data-catalog="…">) of the pages.
// Prices, availability and descriptions come from the live catalog (set in the portal,
// see live-catalog.js), with catalog.js as the fallback; the checkout charges the same prices.
import { CATALOG, BY_KEY, TIERS, separatePrice, effectiveTier } from './catalog.js';

const UI = {
  fr: {
    locale: 'fr-FR',
    vat: 'HT',
    quote: 'Sur devis',
    quoteCta: 'Demander un devis',
    compare: (ref, save) => `<s>${ref}</s> HT en services séparés · <b>−${save}</b>`,
    details: 'Voir tout le détail',
    excluded: 'Non inclus',
    prereq: 'Prérequis',
    more: 'Détail et tarif',
    solution: 'Voir la solution',
    delay: { standard: (d) => `${d} jours ouvrés`, express: '48 h maximum', flash: '24 h maximum' },
    quoteDelay: "Délai estimé par l'expert avec votre devis",
    speedName: { standard: (d) => `la Standard (${d} jours ouvrés)`, express: () => "l'Express (48 h maximum)", flash: () => 'la Flash (24 h maximum)' },
    tierName: { standard: 'Standard', express: 'Express', flash: 'Flash' },
    unavailable: (from, to, faster) => `Ce service n'est pas disponible en option ${from}. L'option ${faster ? 'la plus rapide' : 'disponible la plus proche'} est ${to} : voici son prix.`,
    packDelay: 'Délai de livraison établi après commande',
    guarantee: { standard: 'Retard : 50 % remboursés (HT)', express: 'Retard : 100 % remboursé (HT)', flash: 'Retard : 100 % remboursé (HT)' },
    domains: 'Nombre de domaines',
    pillar: { compliance: 'Pilier 1 : Conformité', revenue: 'Pilier 2 : Revenue & Data', both: 'Les deux piliers' },
  },
  en: {
    locale: 'en-IE',
    vat: 'excl. VAT',
    quote: 'On quote',
    quoteCta: 'Request a quote',
    compare: (ref, save) => `<s>${ref}</s> excl. VAT bought separately · <b>save ${save}</b>`,
    details: 'See all the details',
    excluded: 'Not included',
    prereq: 'Prerequisites',
    more: 'Details and pricing',
    solution: 'See the solution',
    delay: { standard: (d) => `${d} business days`, express: '48 hours max', flash: '24 hours max' },
    quoteDelay: 'Delivery time estimated by the expert with your quote',
    speedName: { standard: (d) => `Standard (${d} business days)`, express: () => 'Express (48 hours max)', flash: () => 'Flash (24 hours max)' },
    tierName: { standard: 'Standard', express: 'Express', flash: 'Flash' },
    unavailable: (from, to, faster) => `This service is not available in ${from}. The ${faster ? 'fastest' : 'closest available'} option is ${to}: here is its price.`,
    packDelay: 'Delivery time set after the order',
    guarantee: { standard: 'Late: 50% refunded (excl. VAT)', express: 'Late: 100% refunded (excl. VAT)', flash: 'Late: 100% refunded (excl. VAT)' },
    domains: 'Number of domains',
    pillar: { compliance: 'Pillar 1: Compliance', revenue: 'Pillar 2: Revenue & Data', both: 'Both pillars' },
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = (id, size = 22) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}"/></svg>`;

export function formatPrice(cents, lang) {
  return new Intl.NumberFormat(UI[lang].locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export function productName(key, lang) {
  const item = BY_KEY[key];
  return item ? item[lang].name : '';
}

// Packs have a single price: no data-tier, so the delivery-speed selector never hides it.
const tierAttr = (item, tier) => (item.single ? '' : ` data-tier="${tier}"`);

// A speed the service doesn't offer shows the closest one it offers, with a red notice.
const SPEED_RANK = { standard: 0, express: 1, flash: 2 };
function unavailableNote(item, shownTier, tier, lang) {
  const ui = UI[lang];
  const faster = SPEED_RANK[tier] < SPEED_RANK[shownTier];
  return `<p class="offer__unavailable" role="note">${ui.unavailable(ui.tierName[shownTier], ui.speedName[tier](item.days), faster)}</p>`;
}

function priceBlock(item, shownTier, lang, byKey) {
  const ui = UI[lang];
  const tier = effectiveTier(item, shownTier);
  const amount = item.prices[tier];
  if (amount == null) {
    return `<div class="offer__price"${tierAttr(item, tier)}><p class="offer__amount offer__amount--quote"><span>${ui.quote}</span></p></div>`;
  }
  const ref = separatePrice(item, tier, byKey);
  const compare = ref && ref > amount
    ? `<p class="offer__compare">${ui.compare(formatPrice(ref, lang), formatPrice(ref - amount, lang))}</p>`
    : '';
  // Packs: no fixed delivery time and no late-delivery refund, the time is set after the order.
  if (item.group === 'packs') {
    return `<div class="offer__price"${tierAttr(item, tier)}>`
      + `<p class="offer__amount"><span>${formatPrice(amount, lang)}</span><small>${ui.vat}</small></p>`
      + compare
      + `<p class="offer__delay">${icon('i-clock', 16)}${ui.packDelay}</p>`
      + '</div>';
  }
  const delay = tier === 'standard' ? ui.delay.standard(item.days) : ui.delay[tier];
  return `<div class="offer__price"${tierAttr(item, shownTier)}>`
    + (tier !== shownTier ? unavailableNote(item, shownTier, tier, lang) : '')
    + `<p class="offer__amount"><span>${formatPrice(amount, lang)}</span><small>${ui.vat}</small></p>`
    + compare
    + `<p class="offer__delay">${icon('i-clock', 16)}${delay}</p>`
    + `<p class="offer__guarantee">${icon('i-shield-check', 16)}${ui.guarantee[tier]}</p>`
    + '</div>';
}

function ctaBlock(item, shownTier, lang) {
  const t = item[lang];
  const tier = effectiveTier(item, shownTier);
  const btn = item.featured ? 'btn--light' : 'btn--dark';
  if (item.prices[tier] == null) {
    return `<div class="offer__cta"${tierAttr(item, tier)}><a class="btn ${item.featured ? 'btn--outline-light' : 'btn--outline-dark'} btn--block" href="#" data-tally="contact">${UI[lang].quoteCta}</a></div>`;
  }
  return `<form class="offer__cta"${tierAttr(item, shownTier)} method="post" action="/api/checkout" data-checkout>`
    + `<input type="hidden" name="plan" value="${item.key}"><input type="hidden" name="speed" value="${tier}"><input type="hidden" name="lang" value="${lang}">`
    + `<button class="btn ${btn} btn--block" type="submit">${esc(t.cta)}</button></form>`;
}

// On-quote offer: same for every delivery speed. The client enters the number
// of domains; main.js opens the Tally "quote" form with it as a hidden field.
function quoteBlocks(item, lang) {
  const ui = UI[lang];
  return `<div class="offer__price"><p class="offer__amount offer__amount--quote"><span>${ui.quote}</span></p>`
    + `<p class="offer__delay">${icon('i-clock', 16)}${esc(ui.quoteDelay)}</p></div>`
    + `<form class="offer__quote" data-quote="${item.key}">`
    + `<label class="offer__field"><span>${ui.domains}</span>`
    + '<input type="number" name="domains" min="2" max="999" step="1" value="10" inputmode="numeric" required></label>'
    + `<button class="btn btn--dark btn--block" type="submit">${esc(item[lang].cta)}</button></form>`;
}

function offerCard(item, lang, byKey) {
  const t = item[lang];
  const ui = UI[lang];
  const list = (items, cls = '') => `<ul class="offer__list${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  return `<article class="offer${item.featured ? ' offer--featured' : ''}" id="${item.key}">`
    + (item.featured ? '<span class="offer__glow" aria-hidden="true"></span>' : '')
    + `<div class="offer__top"><span class="offer__icon">${icon(item.icon)}</span><p class="offer__pillar">${esc(ui.pillar[item.pillar])}</p>`
    + (t.badge ? `<i class="tag tag--glow">${esc(t.badge)}</i>` : '')
    + '</div>'
    // Packs already start their title with their name.
    + (t.title.toLowerCase().startsWith(t.name.toLowerCase()) ? '' : `<p class="offer__name">${esc(t.name)}</p>`)
    + `<h3 class="offer__title">${esc(t.title)}</h3>`
    + `<p class="offer__sub">${esc(t.subtitle)}</p>`
    + (item.quote
      ? quoteBlocks(item, lang)
      : (item.single ? ['standard'] : TIERS).map((tier) => priceBlock(item, tier, lang, byKey)).join('')
        + (item.single ? ['standard'] : TIERS).map((tier) => ctaBlock(item, tier, lang)).join(''))
    + `<p class="offer__short">${esc(t.short)}</p>`
    + list(t.included)
    + `<details class="offer__more"><summary>${ui.details}<span class="faq__icon" aria-hidden="true"></span></summary><div class="offer__more-body">`
    + `<p>${esc(t.long)}</p>`
    + `<p class="offer__h">${ui.excluded}</p>${list(t.excluded, ' offer__list--no')}`
    + `<p class="offer__h">${ui.prereq}</p><p>${esc(t.prereq)}</p>`
    + '</div></details>'
    + '</article>';
}

// Home page: one card per service: the problem as a question, the solution,
// an animated emblem, and a link down to the section that details it.
const MOTIFS = {
  consent: '<svg viewBox="0 0 120 80" class="sv sv--consent"><g class="sv-cookie"><circle cx="40" cy="40" r="21"/><circle class="sv-chip" cx="33" cy="33" r="2.6"/><circle class="sv-chip" cx="46" cy="36" r="2.2"/><circle class="sv-chip" cx="37" cy="48" r="2.4"/><circle class="sv-chip" cx="49" cy="47" r="1.8"/></g><g class="sv-lock"><rect x="50" y="49" width="16" height="13" rx="3"/><path class="sv-shackle" d="M53.5 49v-4a4.5 4.5 0 0 1 9 0v4"/></g><rect class="sv-track" x="76" y="31" width="30" height="18" rx="9"/><circle class="sv-knob" cx="85" cy="40" r="6.5"/></svg>',
  accessibility: '<svg viewBox="0 0 120 80" class="sv sv--a11y"><rect class="sv-page" x="30" y="10" width="60" height="60" rx="7"/><rect class="sv-line" x="38" y="20" width="30" height="4" rx="2"/><rect class="sv-line" x="38" y="32" width="44" height="4" rx="2"/><rect class="sv-line" x="38" y="44" width="38" height="4" rx="2"/><rect class="sv-line" x="38" y="56" width="26" height="4" rx="2"/><circle class="sv-ok sv-ok--1" cx="86" cy="22" r="4"/><circle class="sv-ok sv-ok--2" cx="86" cy="34" r="4"/><circle class="sv-ok sv-ok--3" cx="86" cy="46" r="4"/><g class="sv-lens"><circle cx="0" cy="0" r="11"/><path d="m8 8 9 9"/></g></svg>',
  inbox: '<svg viewBox="0 0 120 80" class="sv sv--inbox"><path class="sv-tray" d="M30 48h16l5 8h18l5-8h16v18a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4z"/><g class="sv-mail"><rect x="44" y="8" width="32" height="22" rx="3"/><path d="m44 10 16 11 16-11"/></g><circle class="sv-badge" cx="88" cy="46" r="7"/><path class="sv-tick" d="m84.5 46 2.5 2.5 4.5-5"/></svg>',
  tracking: '<svg viewBox="0 0 120 80" class="sv sv--track"><path class="sv-wire" d="M24 40h72"/><circle class="sv-node" cx="20" cy="40" r="10"/><rect class="sv-node sv-node--mid" x="50" y="28" width="20" height="24" rx="4"/><circle class="sv-node" cx="100" cy="40" r="10"/><path class="sv-bars" d="M96 44v-3M100 44v-7M104 44v-5"/><circle class="sv-dot sv-dot--1" cx="24" cy="40" r="3"/><circle class="sv-dot sv-dot--2" cx="24" cy="40" r="3"/><circle class="sv-dot sv-dot--3" cx="24" cy="40" r="3"/></svg>',
  leads: '<svg viewBox="0 0 120 80" class="sv sv--leads"><path class="sv-wave sv-wave--1" d="M38 26a26 26 0 0 0 0 28"/><path class="sv-wave sv-wave--2" d="M82 26a26 26 0 0 1 0 28"/><g class="sv-bell"><path d="M60 16c-9 0-15 7-15 16v8c0 4-2 7-5 9h40c-3-2-5-5-5-9v-8c0-9-6-16-15-16z"/><path d="M55 53a5 5 0 0 0 10 0"/></g><g class="sv-notif"><circle cx="74" cy="20" r="8"/><text x="74" y="23.5" text-anchor="middle">1</text></g></svg>',
};

function serviceCard(item, lang) {
  const t = item[lang];
  const question = lang === 'fr' ? esc(t.question).replace(/ ([?!:;])/g, '&nbsp;$1') : esc(t.question);
  return `<a class="svc" href="#${item.anchor}" data-glow>`
    + '<span class="svc__glow" aria-hidden="true"></span>'
    + `<span class="svc__visual" aria-hidden="true">${MOTIFS[item.key] || ''}</span>`
    + '<span class="svc__body">'
    + `<span class="svc__name">${esc(t.name)}</span>`
    + `<h3 class="svc__title">${question}</h3>`
    + `<p class="svc__text">${esc(t.answer)}</p>`
    + `<span class="svc__more">${UI[lang].solution} <span aria-hidden="true">↓</span></span>`
    + '</span></a>';
}

// Offers switched off in the portal are not shown (nor sold: see api/checkout.js).
const shown = (cat, group) => cat.list.filter((p) => p.group === group && p.active !== false);
const STATIC = { list: CATALOG, byKey: BY_KEY };

const SLOTS = {
  packs: (lang, cat) => shown(cat, 'packs').map((p) => offerCard(p, lang, cat.byKey)).join(''),
  compliance: (lang, cat) => shown(cat, 'compliance').map((p) => offerCard(p, lang, cat.byKey)).join(''),
  revenue: (lang, cat) => shown(cat, 'revenue').map((p) => offerCard(p, lang, cat.byKey)).join(''),
  multi: (lang, cat) => shown(cat, 'multi').map((p) => offerCard(p, lang, cat.byKey)).join(''),
  'overview-compliance': (lang, cat) => shown(cat, 'compliance').map((p) => serviceCard(p, lang)).join(''),
  'overview-revenue': (lang, cat) => shown(cat, 'revenue').map((p) => serviceCard(p, lang)).join(''),
};

export function renderSlot(name, lang, cat = STATIC) {
  const slot = SLOTS[name];
  return slot ? slot(lang, cat) : '';
}
