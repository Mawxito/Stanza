/*
 * Stanza — site configuration
 * ---------------------------------------------------------------
 * Every outbound action of the site is wired from this file.
 *
 * TALLY  — paste the form ID (the part after https://tally.so/r/).
 *          Buttons open the form as a Tally popup; if the Tally
 *          script is blocked they fall back to the hosted form URL.
 * STRIPE — paste each Stripe Payment Link (https://buy.stripe.com/…).
 *          In Stripe, set the link's "After payment" redirect to
 *          https://<your-domain>/success.html?session_id={CHECKOUT_SESSION_ID}
 *          (the session ID is forwarded to the Tally onboarding form as
 *          the hidden field "session_id").
 *          Fulfillment must run from a webhook, not from success.html.
 *
 * While a value still starts with "REPLACE_", the button falls back
 * to the Tally "contact" form so nothing on the site is a dead end.
 */
window.STANZA_CONFIG = {
  brand: 'Stanza',
  currency: 'EUR',

  tally: {
    contact: 'REPLACE_TALLY_CONTACT_FORM_ID',      // Contact sales / questions
    start: 'REPLACE_TALLY_ONBOARDING_FORM_ID',     // Get started (domain + stack intake)
    specialist: 'REPLACE_TALLY_SPECIALIST_FORM_ID', // Become a Stanza specialist
    dnsCheck: 'REPLACE_TALLY_DNS_CHECK_FORM_ID',   // Free deliverability check
    newsletter: 'REPLACE_TALLY_NEWSLETTER_FORM_ID',
  },

  stripe: {
    inbox: 'REPLACE_STRIPE_PAYMENT_LINK_INBOX',       // Inbox Protocol — €450
    consent: 'REPLACE_STRIPE_PAYMENT_LINK_CONSENT',   // Consent Integration — €550
    bundle: 'REPLACE_STRIPE_PAYMENT_LINK_BUNDLE',     // Complete Compliance — €800
  },

  loginUrl: '#', // Client / specialist dashboard (when available)
};
