// POST /api/checkout
//   plan:  a catalog key (consent, inbox, pack-complete…)
//   speed: standard | express | flash
//   lang:  fr | en (language of the Stripe Checkout page)
// Creates a Stripe Checkout Session and redirects the buyer to it.
import { BY_KEY, TIERS } from '../_lib/catalog.js';
import { getStripe, getPriceId, captureMethod } from '../_lib/stripe.js';

// Label shown in the Dashboard to compare checkout flows.
const INTEGRATION_IDENTIFIER = 'stanza_pricing_qhtzmwkr';

const SPEED_LABEL = {
  fr: { standard: (d) => `Standard, ${d} jours ouvrés`, express: () => 'Express, 48 h maximum', flash: () => 'Flash, 24 h maximum' },
  en: { standard: (d) => `Standard, ${d} business days`, express: () => 'Express, 48 hours max', flash: () => 'Flash, 24 hours max' },
};
const DELAY_NOTE = {
  fr: (s) => `Délai de livraison : ${s}. Votre carte est autorisée maintenant et débitée seulement après validation de la livraison.`,
  en: (s) => `Delivery time: ${s}. Your card is authorized now and charged only once the delivery is verified.`,
};

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
  const speed = TIERS.includes(field('speed')) ? field('speed') : 'standard';
  const lang = field('lang') === 'fr' ? 'fr' : 'en';
  const item = BY_KEY[plan];
  if (!item || item.prices[speed] == null) return Response.redirect(`${origin}/pricing`, 303);

  try {
    const stripe = getStripe(env);
    const price = await getPriceId(stripe, plan, speed);
    if (!price) throw new Error(`No active price for ${plan} (${speed})`);
    const speedLabel = SPEED_LABEL[lang][speed](item.days);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: lang,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing#${plan}`,
      customer_creation: 'always',
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      custom_text: { submit: { message: DELAY_NOTE[lang](speedLabel) } },
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
