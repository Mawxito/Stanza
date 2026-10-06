// POST /api/checkout
//   plan:  a catalog key (consent, inbox, pack-complete…)
//   speed: standard | express | flash
//   lang:  fr | en (language of the Stripe Checkout page)
// Creates a Stripe Checkout Session and redirects the buyer to it.
// Price and availability come from the portal (live catalog), read again here, server side:
// the amount posted by the browser is never trusted.
import { TIERS, effectiveTier } from '../_lib/catalog.js';
import { getCatalogFresh } from '../_lib/live-catalog.js';
import { getStripe, lineItem, captureMethod } from '../_lib/stripe.js';

// Label shown in the Dashboard to compare checkout flows.
const INTEGRATION_IDENTIFIER = 'stanza_pricing_qhtzmwkr';

const SPEED_LABEL = {
  fr: { standard: (d) => `Standard, ${d} jours ouvrés`, express: () => 'Express, 48 h maximum', flash: () => 'Flash, 24 h maximum' },
  en: { standard: (d) => `Standard, ${d} business days`, express: () => 'Express, 48 hours max', flash: () => 'Flash, 24 hours max' },
};
const PACK_NOTE = {
  fr: 'Le délai de livraison sera établi après votre commande. Votre carte est autorisée maintenant et débitée seulement après validation de la livraison.',
  en: 'The delivery time will be set after your order. Your card is authorized now and charged only once the delivery is verified.',
};
const DELAY_NOTE = {
  fr: (s, refund) => `Délai de livraison : ${s}, garanti (en cas de retard, ${refund} du prix HT remboursé). Votre carte est autorisée maintenant et débitée seulement après validation de la livraison.`,
  en: (s, refund) => `Delivery time: ${s}, guaranteed (if we are late, ${refund} of the price excl. VAT is refunded). Your card is authorized now and charged only once the delivery is verified.`,
};
// Late-delivery refund promised on the site: half in Standard, everything in Express / Flash.
const LATE_REFUND = { standard: '50 %', express: '100 %', flash: '100 %' };

export async function onRequestPost({ request, env }) {
  const origin = new URL(request.url).origin;
  let form = null;
  try {
    form = await request.formData();
  } catch (_) {
    /* empty or invalid body */
  }
  const field = (name) => (form ? String(form.get(name) || '') : '');
  const plan = field('plan');
  const lang = field('lang') === 'fr' ? 'fr' : 'en';
  const catalog = await getCatalogFresh(env);
  const item = catalog.byKey[plan];
  if (!item || item.active === false || item.quote) return Response.redirect(`${origin}/pricing`, 303);
  // Packs have a single price (the Standard one). A speed that is not offered falls back to the closest one.
  const speed = item.single ? 'standard' : effectiveTier(item, TIERS.includes(field('speed')) ? field('speed') : 'standard');
  const amount = item.prices[speed];
  if (amount == null) return Response.redirect(`${origin}/pricing`, 303);

  try {
    const stripe = getStripe(env);
    const line = await lineItem(stripe, item, speed, amount);
    const speedLabel = SPEED_LABEL[lang][speed](item.days);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: lang,
      line_items: [line],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing#${plan}`,
      customer_creation: 'always',
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      custom_text: { submit: { message: item.group === 'packs' ? PACK_NOTE[lang] : DELAY_NOTE[lang](speedLabel, lang === 'fr' ? LATE_REFUND[speed] : LATE_REFUND[speed].replace(' ', '')) } },
      metadata: { plan, speed },
      payment_intent_data: {
        capture_method: captureMethod(env),
        description: `Stanza — ${item.en.name} (${speed})`,
        metadata: { plan, speed },
      },
      integration_identifier: INTEGRATION_IDENTIFIER,
    });

    return Response.redirect(session.url, 303);
  } catch (err) {
    console.error('[checkout] failed to create session:', err && err.message);
    return Response.redirect(`${origin}/pricing?checkout=error#${plan}`, 303);
  }
}

export function onRequestGet({ request }) {
  // Checkout Sessions are only created on POST; send stray GETs to the pricing page.
  return Response.redirect(`${new URL(request.url).origin}/pricing`, 303);
}
