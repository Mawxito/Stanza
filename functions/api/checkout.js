// POST /api/checkout
//   plan:  a catalog key (consent, inbox, pack-complete…)
//   speed: standard | express | flash
//   lang:  fr | en (language of the Stripe Checkout page)
// Creates a Stripe Checkout Session and redirects the buyer to it.
// Price and availability come from the portal (live catalog), read again here, server side:
// the amount posted by the browser is never trusted. During a promotion (set in the portal) the
// catalog price is already the discounted one: that is what is charged, and the line says why.
import { TIERS, effectiveTier, activePromo } from '../_lib/catalog.js';
import { formatPrice, discountText, promoUntil } from '../_lib/render.js';
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
  fr: (s, refund) => `Délai de livraison : ${s}, garanti (en cas de retard, ${refund} du prix HT remboursé ; délai suspendu seulement si un élément manque ou, en Express et Flash, pendant une urgence signalée par votre expert : voir la FAQ). Votre carte est autorisée maintenant et débitée seulement après validation de la livraison.`,
  en: (s, refund) => `Delivery time: ${s}, guaranteed (if we are late, ${refund} of the price excl. VAT is refunded; the clock pauses only if an item is missing or, in Express and Flash, during an urgent issue reported by your expert: see the FAQ). Your card is authorized now and charged only once the delivery is verified.`,
};
const PROMO_TEXT = {
  fr: (regular, label, off, until) => `Prix habituel ${regular} HT · ${label}${off ? ` ${off}` : ''}${until ? `, ${until}` : ''}`,
  en: (regular, label, off, until) => `Regular price ${regular} excl. VAT · ${label}${off ? ` ${off}` : ''}${until ? `, ${until}` : ''}`,
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

  const promo = activePromo(item, speed);
  const promoLine = promo && {
    id: promo.id,
    name: `${item[lang].name} — ${promo.label[lang]}${discountText(promo, lang) ? ` (${discountText(promo, lang)})` : ''}`,
    description: PROMO_TEXT[lang](formatPrice(item.regular[speed], lang), promo.label[lang], discountText(promo, lang), promoUntil(promo, lang)),
  };
  // metadata.promo: the promotion behind the price, on the session and the payment.
  const metadata = promo ? { plan, speed, promo: promo.id } : { plan, speed };

  try {
    const stripe = getStripe(env);
    const line = await lineItem(stripe, item, speed, amount, promoLine);
    const speedLabel = SPEED_LABEL[lang][speed](item.days);

    const params = {
      mode: 'payment',
      locale: lang,
      line_items: [line],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing#${plan}`,
      customer_creation: 'always',
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      custom_text: { submit: { message: item.group === 'packs' ? PACK_NOTE[lang] : DELAY_NOTE[lang](speedLabel, lang === 'fr' ? LATE_REFUND[speed] : LATE_REFUND[speed].replace(' ', '')) } },
      metadata,
      // A plain card authorization lasts about 7 days, which 5 business days plus the sign-off can exceed.
      // STRIPE_EXTENDED_AUTH=on asks the card network for an extended one (up to 30 days) when the card
      // allows it. Off by default: Stripe refuses the option (and so the whole session) for an account
      // that is not enabled for it. Turn it on only once Stripe has enabled extended authorizations.
      ...(captureMethod(env) === 'manual' && env.STRIPE_EXTENDED_AUTH === 'on'
        ? { payment_method_options: { card: { request_extended_authorization: 'if_available' } } } : {}),
      payment_intent_data: {
        capture_method: captureMethod(env),
        description: `Stanza — ${item.en.name} (${speed})${promo ? ` · ${promo.label.en}` : ''}`,
        metadata,
      },
      integration_identifier: INTEGRATION_IDENTIFIER,
    };
    // Stripe invoice after payment (listed in the portal, Admin → Invoices). STRIPE_INVOICES=off disables it.
    // If Stripe refuses the option for this payment, the session is created again without it: checkout never breaks.
    let session;
    if (env.STRIPE_INVOICES !== 'off') {
      try {
        session = await stripe.checkout.sessions.create({
          ...params,
          invoice_creation: {
            enabled: true,
            invoice_data: { description: `Stanza — ${item[lang].name}${promo ? ` · ${promo.label[lang]}` : ''}`, metadata },
          },
        });
      } catch (err) {
        console.warn('[checkout] invoice_creation refused, retrying without it:', err && err.message);
      }
    }
    if (!session) session = await stripe.checkout.sessions.create(params);

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
