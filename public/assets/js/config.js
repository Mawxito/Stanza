/*
 * Stanza — site configuration
 * ---------------------------------------------------------------
 * Every outbound action of the site is wired from this file.
 *
 * TALLY  — paste the form ID (the part after https://tally.so/r/).
 *          Buttons open the form as a Tally popup; if the Tally
 *          script is blocked they fall back to the hosted form URL.
 * STRIPE — checkout buttons POST to /api/checkout (functions/api/checkout.js).
 *          Prices are read from Stripe by lookup_key; no keys live here.
 *          After payment Stripe returns to /success?session_id=…, and the
 *          session ID is forwarded to the Tally onboarding form.
 *
 * While a value still starts with "REPLACE_", the button falls back
 * to the Tally "contact" form so nothing on the site is a dead end.
 */
window.STANZA_CONFIG = {
  brand: 'Stanza',
  currency: 'EUR',

  tally: {
    contact: 'REPLACE_TALLY_CONTACT_FORM_ID',      // Contact sales / questions
    quote: 'REPLACE_TALLY_QUOTE_FORM_ID',          // Multi-domain quote (hidden field "domains")
    specialist: 'REPLACE_TALLY_SPECIALIST_FORM_ID', // Become a Stanza specialist
    dnsCheck: 'REPLACE_TALLY_DNS_CHECK_FORM_ID',   // Free deliverability check
    newsletter: 'REPLACE_TALLY_NEWSLETTER_FORM_ID',
  },

  // Client area (Stanza portal): "Log in" and "Get started" link there directly,
  // and the old /login and /signup URLs redirect to it (functions/_middleware.js).
  portalUrl: 'https://portail.stanzafix.com',
};
