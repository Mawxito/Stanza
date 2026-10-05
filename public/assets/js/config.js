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
    start: 'REPLACE_TALLY_ONBOARDING_FORM_ID',     // Get started (domain + stack intake)
    specialist: 'REPLACE_TALLY_SPECIALIST_FORM_ID', // Become a Stanza specialist
    dnsCheck: 'REPLACE_TALLY_DNS_CHECK_FORM_ID',   // Free deliverability check
    newsletter: 'REPLACE_TALLY_NEWSLETTER_FORM_ID',
  },

  loginUrl: '/login',

  // Client area sign-in (/login and /signup). Until the client area exists,
  // `ready: false` makes the buttons show a "coming soon" message instead.
  auth: {
    ready: false,
    googleUrl: '',        // OAuth start URL for "Continue with Google"
    microsoftUrl: '',     // OAuth start URL for "Continue with Microsoft"
    loginEndpoint: '',    // POST {email, password} → 200 when signed in
    signupEndpoint: '',   // POST {name, company, email, password, marketing} → 200 when created
    redirect: '/',        // where to go once signed in
  },
};
