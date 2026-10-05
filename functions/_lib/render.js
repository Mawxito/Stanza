// Server-side HTML for the catalog slots (<div data-catalog="…">) of the pages.
// Prices and texts come from catalog.js, so the site always matches Stripe.
import { CATALOG, BY_KEY, TIERS, separatePrice } from './catalog.js';

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
    delay: { standard: (d) => `${d} jours ouvrés`, express: '48 h maximum', flash: '24 h maximum' },
    quoteDelay: "Délai estimé par l'expert avec votre devis",
    noFlash: "Ce service n'est pas disponible en option Flash. L'option la plus rapide est l'Express (48 h maximum) : voici son prix.",
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
    delay: { standard: (d) => `${d} business days`, express: '48 hours max', flash: '24 hours max' },
    quoteDelay: 'Delivery time estimated by the expert with your quote',
    noFlash: 'This service is not available in Flash. The fastest option is Express (48 hours max): here is its price.',
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

// Services without a Flash option show the Express offer (and a red notice) under "Flash".
const effectiveTier = (item, tier) => (tier === 'flash' && item.noFlash ? 'express' : tier);

function priceBlock(item, shownTier, lang) {
  const ui = UI[lang];
  const tier = effectiveTier(item, shownTier);
  const amount = item.prices[tier];
  if (amount == null) {
    return `<div class="offer__price"${tierAttr(item, tier)}><p class="offer__amount offer__amount--quote"><span>${ui.quote}</span></p></div>`;
  }
  const ref = separatePrice(item, tier);
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
    + (tier !== shownTier ? `<p class="offer__unavailable" role="note">${ui.noFlash}</p>` : '')
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

function offerCard(item, lang) {
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
      : (item.single ? ['standard'] : TIERS).map((tier) => priceBlock(item, tier, lang)).join('')
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

// Home page: what each service does, without any price.
function serviceCard(item, lang) {
  const t = item[lang];
  return `<a class="svc" href="/pricing#${item.key}">`
    + `<span class="icon-box">${icon(item.icon, 24)}</span>`
    + `<span class="svc__name">${esc(t.name)}</span>`
    + `<h3 class="svc__title">${esc(t.subtitle)}</h3>`
    + `<p class="svc__text">${esc(t.short)}</p>`
    + `<span class="svc__more">${UI[lang].more} <span aria-hidden="true">→</span></span>`
    + '</a>';
}

const SLOTS = {
  packs: (lang) => CATALOG.filter((p) => p.group === 'packs').map((p) => offerCard(p, lang)).join(''),
  compliance: (lang) => CATALOG.filter((p) => p.group === 'compliance').map((p) => offerCard(p, lang)).join(''),
  revenue: (lang) => CATALOG.filter((p) => p.group === 'revenue').map((p) => offerCard(p, lang)).join(''),
  multi: (lang) => CATALOG.filter((p) => p.group === 'multi').map((p) => offerCard(p, lang)).join(''),
  'overview-compliance': (lang) => CATALOG.filter((p) => p.group === 'compliance').map((p) => serviceCard(p, lang)).join(''),
  'overview-revenue': (lang) => CATALOG.filter((p) => p.group === 'revenue').map((p) => serviceCard(p, lang)).join(''),
};

export function renderSlot(name, lang) {
  const slot = SLOTS[name];
  return slot ? slot(lang) : '';
}
