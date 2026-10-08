/*
 * Stanza — site configuration
 * ---------------------------------------------------------------
 * Every outbound action of the site is wired from this file.
 *
 * FORMS  — the site's own forms (data-form="…" buttons) post to
 *          /api/forms, which forwards them to the portal (Admin → Formulaires).
 * STRIPE — checkout buttons POST to /api/checkout (functions/api/checkout.js).
 *          Prices are read from Stripe by lookup_key; no keys live here.
 *          After payment Stripe returns to /success?session_id=….
 *
 */
window.STANZA_CONFIG = {
  brand: 'Stanza',
  currency: 'EUR',


  // Client area (Stanza portal): "Log in" and "Get started" link there directly,
  // and the old /login and /signup URLs redirect to it (functions/_middleware.js).
  portalUrl: 'https://portail.stanzafix.com',
};
