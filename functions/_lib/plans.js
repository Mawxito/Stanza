// Single source of truth for the packages sold on the site.
// Prices live in Stripe; the site and the checkout reference them by lookup_key.
export const PLANS = {
  inbox: {
    lookupKey: 'stanza_inbox_protocol',
    name: 'Inbox Protocol',
    description: 'SPF, DKIM, DMARC, BIMI & MX configuration, Postmaster verification and acceptance report. Delivered in 24–48 hours.',
    amount: 45000,
    currency: 'eur',
  },
  consent: {
    lookupKey: 'stanza_consent_integration',
    name: 'Consent Integration',
    description: 'CMP deployment (Axeptio, Cookiebot or Didomi), conditional script blocking and Google Consent Mode v2. Delivered in 24–48 hours.',
    amount: 55000,
    currency: 'eur',
  },
  bundle: {
    lookupKey: 'stanza_complete_compliance',
    name: 'Complete Compliance',
    description: 'Inbox Protocol + Consent Integration, one specialist, one acceptance gate. Delivered in 24–48 hours.',
    amount: 80000,
    currency: 'eur',
  },
};
