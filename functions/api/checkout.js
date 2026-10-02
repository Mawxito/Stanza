// POST /api/checkout  (form field "plan": inbox | consent | bundle)
// Creates a Stripe Checkout Session and redirects the buyer to it.
import { PLANS } from '../_lib/plans.js';
import { getStripe, getPriceId, captureMethod } from '../_lib/stripe.js';

// Label shown in the Dashboard to compare checkout flows.
const INTEGRATION_IDENTIFIER = 'stanza_pricing_qhtzmwkr';

export async function onRequestPost({ request, env }) {
  const origin = new URL(request.url).origin;
  let plan = '';
  try {
    const form = await request.formData();
    plan = String(form.get('plan') || '');
  } catch (_) {
    /* empty or invalid body */
  }
  if (!PLANS[plan]) return Response.redirect(`${origin}/#pricing`, 303);

  try {
    const stripe = getStripe(env);
    const price = await getPriceId(stripe, plan);
    if (!price) throw new Error(`No active price for lookup_key ${PLANS[plan].lookupKey}`);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      customer_creation: 'always',
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      metadata: { plan },
      payment_intent_data: {
        capture_method: captureMethod(env),
        description: `Stanza — ${PLANS[plan].name}`,
        metadata: { plan },
      },
      integration_identifier: INTEGRATION_IDENTIFIER,
    });

    return Response.redirect(session.url, 303);
  } catch (err) {
    console.error('[checkout] failed to create session:', err && err.message);
    return Response.redirect(`${origin}/?checkout=error#pricing`, 303);
  }
}

export function onRequestGet({ request }) {
  // Checkout Sessions are only created on POST; send stray GETs to the pricing section.
  return Response.redirect(`${new URL(request.url).origin}/#pricing`, 303);
}
