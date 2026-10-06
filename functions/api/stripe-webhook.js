// POST /api/stripe-webhook
// Fulfillment runs here, never on success.html: buyers don't always reach the return page.
//
// With PORTAL_URL and PORTAL_SIGNING_SECRET set, every order and payment event goes to the
// Stanza portal (signed): the order, the client account and the checklist are created there.
// Without them (before the portal is wired), the previous behaviour below applies.
//
// Optional bindings (previous behaviour):
//   ORDERS            KV namespace — stores one record per order (idempotent)
//   ORDER_NOTIFY_URL  URL that receives a JSON POST for each order event
//                     (Slack incoming webhook, Make, Zapier, n8n…)
import { getStripe } from '../_lib/stripe.js';
import { portalConfigured, sendToPortal } from '../_lib/portal.js';

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return new Response('Webhook not configured', { status: 500 });
  }
  const stripe = getStripe(env);
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn('[webhook] signature verification failed:', err && err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await confirmOrder(stripe, env, event);
        break;
      case 'checkout.session.async_payment_failed':
        if (portalConfigured(env)) await portalPayment(env, event, event.data.object.payment_intent, 'failed');
        else await recordOrder(env, event.data.object.payment_intent, { status: 'payment_failed', session: event.data.object.id });
        break;
      case 'payment_intent.succeeded':
        // With manual capture this fires when you capture after the acceptance gate.
        if (portalConfigured(env)) await portalPayment(env, event, event.data.object.id, 'paid');
        else await recordOrder(env, event.data.object.id, { status: 'paid' });
        break;
      case 'payment_intent.canceled':
        // Authorization released (cancelled or expired before capture).
        if (portalConfigured(env)) await portalPayment(env, event, event.data.object.id, 'cancelled');
        else await recordOrder(env, event.data.object.id, { status: 'canceled' });
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[webhook] ${event.type} ${event.id} failed:`, err && err.message);
    return new Response('Handler error', { status: 500 }); // Stripe retries
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'content-type': 'application/json' },
  });
}

async function confirmOrder(stripe, env, event) {
  const session = await stripe.checkout.sessions.retrieve(event.data.object.id, { expand: ['payment_intent'] });
  const pi = session.payment_intent;
  const authorized = pi && typeof pi === 'object' && pi.status === 'requires_capture';

  // Delayed payment methods complete the session while still unpaid: wait for async_payment_succeeded.
  if (session.payment_status === 'unpaid' && !authorized) return;

  const piId = typeof pi === 'string' ? pi : pi && pi.id;
  if (portalConfigured(env)) {
    const details = session.customer_details || {};
    await sendToPortal(env, '/api/intake/orders', {
      event_id: event.id,
      order: {
        external_ref: piId,
        session: session.id,
        plan: session.metadata && session.metadata.plan, // catalog key: inbox, consent, pack-complete…
        speed: (session.metadata && session.metadata.speed) || 'standard',
        amount_cents: session.amount_total,
        payment_status: session.payment_status === 'paid' ? 'paid' : 'authorized',
        // Quote paid from the portal (/devis/…): the order takes the quote's estimated timeline.
        ...(session.metadata && session.metadata.quote ? { quote: session.metadata.quote } : {}),
      },
      // The client area opens in the language the client paid in.
      customer: { email: details.email, name: details.name || '', locale: session.locale === 'en' ? 'en' : 'fr' },
    });
    return;
  }
  await recordOrder(env, piId, {
    status: session.payment_status === 'paid' ? 'paid' : 'authorized',
    session: session.id,
    plan: session.metadata && session.metadata.plan,
    speed: session.metadata && session.metadata.speed,
    amount: session.amount_total,
    currency: session.currency,
    email: session.customer_details && session.customer_details.email,
    name: session.customer_details && session.customer_details.name,
    customer: session.customer,
  }, true);
}

async function recordOrder(env, paymentIntentId, data, isNew = false) {
  if (!paymentIntentId) return;
  const key = `order:${paymentIntentId}`;
  let existing = null;
  if (env.ORDERS) {
    existing = await env.ORDERS.get(key, 'json');
    if (isNew && existing && existing.session) return; // already confirmed (webhook retry)
    if (!isNew && !existing) return; // not one of our checkout orders
  }
  const order = { ...(existing || {}), ...data, payment_intent: paymentIntentId, updated: new Date().toISOString() };
  console.log('[order]', JSON.stringify(order));

  // Notify before persisting: if the notification fails, Stripe retries the event
  // and the order is not yet marked as handled.
  if (env.ORDER_NOTIFY_URL) {
    const res = await fetch(env.ORDER_NOTIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `Stanza order ${order.status}: ${order.plan || ''}${order.speed ? ` (${order.speed})` : ''} ${order.email || ''} (${paymentIntentId})`,
        order,
      }),
    });
    if (!res.ok) throw new Error(`notify failed with ${res.status}`);
  }
  if (env.ORDERS) await env.ORDERS.put(key, JSON.stringify(order));
}

// The portal updates the matching order, or ignores the event if it doesn't know it.
async function portalPayment(env, event, paymentIntentId, status) {
  if (!paymentIntentId) return;
  await sendToPortal(env, '/api/intake/orders', {
    event_id: event.id,
    order: { external_ref: paymentIntentId, payment_status: status },
  });
}
