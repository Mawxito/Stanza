// Single source of truth for everything sold on the site (from stanza_export_site.csv).
// The pricing page, the home page service cards, the checkout and the Stripe setup
// script all read from here. Amounts are in euro cents, excluding VAT.
//
// To change a price: edit `prices` below, then run `npm run stripe:setup`
// (a new Stripe price is created and the old one archived).

export const TIERS = ['standard', 'express', 'flash'];

const SERVICES = ['consent', 'accessibility', 'inbox', 'tracking', 'leads'];

export const CATALOG = [
  {
    key: 'consent', id: 'S1', group: 'compliance', pillar: 'compliance', icon: 'i-cookie', days: 5,
    prices: { standard: 49000, express: 59000, flash: 66000 },
    fr: {
      name: 'Consent Integration',
      title: 'Consentement cookies conforme (RGPD et Consent Mode v2)',
      subtitle: "Votre bannière bloque vraiment les traceurs tant que le visiteur n'a pas dit oui.",
      short: "Déploiement d'une plateforme de consentement (Axeptio, Cookiebot ou Didomi) avec blocage conditionnel des scripts non essentiels, testé page par page.",
      long: "Afficher une bannière ne suffit pas : encore faut-il que vos outils d'analyse et de publicité attendent réellement le choix du visiteur. Nous configurons votre plateforme de consentement, branchons Google Consent Mode v2 et vérifions que rien ne se déclenche avant l'accord. Vous recevez un rapport de tests que vous pouvez partager avec votre équipe ou votre DPO.",
      included: ['Configuration de la plateforme (catégories, textes, charte)', 'Blocage conditionnel des scripts non essentiels (analytics, pixels, widgets)', 'Google Consent Mode v2', 'Tests avant et après consentement', 'Rapport de tests partageable'],
      excluded: ["Licence de la plateforme (abonnement chez l'éditeur)", 'Rédaction de la politique de confidentialité', 'Conseil juridique'],
      prereq: 'Accès administrateur au site (Shopify, Webflow ou WordPress) et à Google Tag Manager si utilisé.',
      cta: 'Mettre mon site en conformité',
    },
    en: {
      name: 'Consent Integration',
      title: 'GDPR-compliant cookie consent (and Consent Mode v2)',
      subtitle: 'Your banner really blocks trackers until the visitor says yes.',
      short: 'Deployment of a consent platform (Axeptio, Cookiebot or Didomi) with conditional blocking of non-essential scripts, tested page by page.',
      long: "Showing a banner is not enough: your analytics and advertising tools must actually wait for the visitor's choice. We configure your consent platform, wire Google Consent Mode v2 and check that nothing fires before consent. You receive a test report you can share with your team or your DPO.",
      included: ['Platform configuration (categories, texts, branding)', 'Conditional blocking of non-essential scripts (analytics, pixels, widgets)', 'Google Consent Mode v2', 'Tests before and after consent', 'Shareable test report'],
      excluded: ['Platform licence (subscription with the vendor)', 'Writing your privacy policy', 'Legal advice'],
      prereq: 'Admin access to your site (Shopify, Webflow or WordPress) and to Google Tag Manager if you use it.',
      cta: 'Make my site compliant',
    },
  },
  {
    key: 'accessibility', id: 'S2', group: 'compliance', pillar: 'compliance', icon: 'i-scan-search', days: 5,
    prices: { standard: 29000, express: 35000, flash: 39000 },
    fr: {
      name: 'Accessibility Fast-Scan',
      title: "Diagnostic d'accessibilité de votre boutique",
      subtitle: "Depuis juin 2025, un site marchand non conforme s'expose à des amendes. Sachez où vous en êtes avant un contrôle.",
      short: "Diagnostic immédiat : votre site présente-t-il des anomalies techniques bloquantes, oui ou non ?",
      long: "Depuis juin 2025, la loi européenne sur l'accessibilité (European Accessibility Act, EAA) s'applique à de nombreux sites de vente en ligne de l'Union européenne, avec des exceptions pour les micro-entreprises. Un site non conforme risque des sanctions, dont des amendes financières : leur montant et leurs modalités sont fixés par chaque État membre de l'Union européenne, et la France en prévoit. Ce diagnostic automatisé vous donne une réponse claire : votre site présente-t-il des anomalies techniques bloquantes, oui ou non. Vous recevez un rapport qui indique si votre site est concerné par la loi, quels points contrôlés (contrastes, textes alternatifs, libellés de formulaires, navigation au clavier sur le parcours d'achat) ne posent pas de problème et lesquels sont à corriger, avec un plan de correction à transmettre à votre développeur. C'est une première étape : ce n'est ni un audit RGAA complet, ni une attestation de conformité.",
      included: ["Analyse d'éligibilité : votre site est-il concerné par la loi ?", "Réponse claire : anomalies techniques bloquantes, oui ou non", "Analyse automatisée des pages clés avec des outils standard (Lighthouse, axe)", "Contrôle rapide de la navigation au clavier sur le parcours d'achat", "Rapport complet daté : points conformes et non conformes", "Liste de correctifs priorisée"],
      excluded: ["Audit manuel complet (lecteur d'écran)", "Déclaration d'accessibilité", 'Corrections du site'],
      prereq: 'Adresses des pages clés à analyser.',
      cta: 'Scanner ma boutique',
    },
    en: {
      name: 'Accessibility Fast-Scan',
      title: 'Accessibility diagnostic for your online store',
      subtitle: "Since June 2025, a non-compliant online store risks fines. Know where you stand before an inspection.",
      short: "Immediate diagnostic: does your site have blocking technical anomalies, yes or no?",
      long: "Since June 2025, the European Accessibility Act (EAA) has applied to many online stores in the European Union, with exemptions for micro-enterprises. A non-compliant site risks penalties, including financial fines: their amount and rules are set by each EU member state, and France provides for them. This automated diagnostic gives you a clear answer: does your site have blocking technical anomalies, yes or no. You receive a report that says whether your site is subject to the law, which checked points (contrast, alt text, form labels, keyboard navigation through checkout) are fine and which need fixing, with a fix plan to hand to your developer. It is a first step: neither a full RGAA/WCAG audit nor a certificate of compliance.",
      included: ["Eligibility check: is your site subject to the law?", "Clear answer: blocking technical anomalies, yes or no", "Automated analysis of key pages with standard tools (Lighthouse, axe)", "Quick keyboard-navigation check of the checkout flow", "Complete dated report: compliant and non-compliant points", "Prioritized fix list"],
      excluded: ['Full manual audit (screen reader)', 'Accessibility statement', 'Fixing the site'],
      prereq: 'The addresses of the key pages to analyse.',
      cta: 'Scan my store',
    },
  },
  {
    key: 'inbox', id: 'S3', group: 'revenue', pillar: 'revenue', icon: 'i-mail-check', days: 5,
    prices: { standard: 39000, express: 47000, flash: 53000 },
    fr: {
      name: 'Inbox Protocol',
      title: 'Délivrabilité e-mail : SPF, DKIM, DMARC',
      subtitle: 'Vos devis, factures et relances arrivent chez vos clients, pas en spam.',
      short: "Configuration complète de l'authentification de votre domaine (SPF, DKIM, DMARC, BIMI, MX) avec vérification Google Postmaster.",
      long: "Google, Yahoo et Microsoft rejettent de plus en plus les e-mails non authentifiés. Nous configurons les enregistrements de votre domaine pour chaque service qui envoie en votre nom, montons la politique DMARC par étapes et mettons en place le reporting. Vous recevez un rapport de tests qui prouve que l'authentification fonctionne. Le placement en boîte principale dépend aussi du contenu et de la réputation d'envoi : le rapport contient des recommandations sur ces deux points.",
      included: ["SPF, DKIM et DMARC configurés pour tous vos services d'envoi", 'Enregistrements MX nettoyés', "BIMI (affichage du logo selon les messageries)", 'Vérification Google Postmaster', 'Mise en place des rapports DMARC', 'Rapport de tests'],
      excluded: ["Gestion de la réputation d'envoi", 'Rédaction des e-mails', 'Surveillance mensuelle'],
      prereq: 'Accès à la zone DNS et au fournisseur de messagerie (Google Workspace, Microsoft 365, etc.).',
      cta: 'Sécuriser mes e-mails',
    },
    en: {
      name: 'Inbox Protocol',
      title: 'Email deliverability: SPF, DKIM, DMARC',
      subtitle: 'Your quotes, invoices and follow-ups reach your customers, not their spam folder.',
      short: 'Full authentication of your domain (SPF, DKIM, DMARC, BIMI, MX) with Google Postmaster verification.',
      long: 'Google, Yahoo and Microsoft increasingly reject unauthenticated email. We configure your domain records for every service that sends in your name, raise the DMARC policy step by step and set up reporting. You receive a test report proving that authentication works. Inbox placement also depends on content and sending reputation: the report includes recommendations on both.',
      included: ['SPF, DKIM and DMARC configured for all your sending services', 'MX records cleaned up', 'BIMI (logo display, depending on the mailbox provider)', 'Google Postmaster verification', 'DMARC reporting set up', 'Test report'],
      excluded: ['Sending reputation management', 'Writing your emails', 'Monthly monitoring'],
      prereq: 'Access to your DNS zone and your email provider (Google Workspace, Microsoft 365, etc.).',
      cta: 'Secure my emails',
    },
  },
  {
    key: 'tracking', id: 'S4', group: 'revenue', pillar: 'revenue', icon: 'i-server', days: 5,
    prices: { standard: 59000, express: 71000, flash: 80000 },
    fr: {
      name: 'Server-Side Tracking',
      title: 'Suivi des conversions côté serveur (GTM Server et API Meta)',
      subtitle: 'Des conversions mieux remontées à vos outils publicitaires, dans le respect du consentement.',
      short: 'Conteneur GTM côté serveur, API Conversions Meta et déduplication des événements, branchés sur votre plateforme de consentement.',
      long: "Les bloqueurs de publicités et les restrictions des navigateurs empêchent une partie de vos conversions d'atteindre vos outils publicitaires. Le suivi côté serveur envoie ces événements depuis un sous-domaine qui vous appartient, avec déduplication pour éviter les doublons. Il ne remplace pas le consentement : nous le branchons sur votre plateforme de consentement pour que seules les données autorisées soient transmises.",
      included: ['Conteneur GTM côté serveur configuré', 'API Conversions Meta activée', 'Déduplication des événements navigateur et serveur', 'Sous-domaine first-party', 'Plan de tests : événements reçus et correspondance'],
      excluded: ['Hébergement du serveur (abonnement chez le fournisseur)', 'Gestion des campagnes publicitaires', "Garantie d'amélioration du retour publicitaire"],
      prereq: 'Plateforme de consentement conforme déjà en place (ou Pack Complet) ; accès à Google Tag Manager, Meta Business et à la zone DNS.',
      cta: 'Fiabiliser mon suivi',
    },
    en: {
      name: 'Server-Side Tracking',
      title: 'Server-side conversion tracking (GTM Server and Meta API)',
      subtitle: 'More of your conversions reach your ad tools, within the limits of consent.',
      short: 'Server-side GTM container, Meta Conversions API and event deduplication, wired to your consent platform.',
      long: 'Ad blockers and browser restrictions stop part of your conversions from reaching your ad tools. Server-side tracking sends those events from a subdomain you own, with deduplication to avoid double counting. It does not replace consent: we wire it to your consent platform so that only authorised data is sent.',
      included: ['Server-side GTM container configured', 'Meta Conversions API enabled', 'Browser and server event deduplication', 'First-party subdomain', 'Test plan: events received and match quality'],
      excluded: ['Server hosting (subscription with the provider)', 'Ad campaign management', 'Guaranteed improvement in return on ad spend'],
      prereq: 'A compliant consent platform already in place (or the Complete Pack); access to Google Tag Manager, Meta Business and your DNS zone.',
      cta: 'Make my tracking reliable',
    },
  },
  {
    key: 'leads', id: 'S5', group: 'revenue', pillar: 'revenue', icon: 'i-bell-ring', days: 5,
    prices: { standard: 39000, express: 47000, flash: 53000 },
    fr: {
      name: 'Lead Fast-Response',
      title: 'Alerte instantanée sur chaque nouveau prospect',
      subtitle: 'Votre équipe prévenue en quelques secondes, le prospect déjà dans votre CRM.',
      short: 'Scénario Make ou Zapier qui crée le contact dans votre CRM et alerte immédiatement votre équipe (WhatsApp, e-mail ou Slack).',
      long: "Un prospect qui attend une réponse est un prospect qui peut aller voir ailleurs. Nous connectons votre formulaire ou vos annonces à votre CRM et déclenchons une alerte interne instantanée pour que quelqu'un réponde vite. Les alertes sont envoyées à votre équipe. L'envoi automatique de messages aux prospects par WhatsApp demande leur consentement préalable et un compte WhatsApp Business API : ce n'est pas inclus.",
      included: ['Scénario Make ou Zapier testé de bout en bout', 'Création ou mise à jour du contact dans votre CRM', 'Alerte interne instantanée (WhatsApp, e-mail ou Slack)', 'Mini-documentation du scénario'],
      excluded: ['Abonnements Make, Zapier, CRM ou WhatsApp', 'Messages automatiques envoyés aux prospects', 'Rédaction de séquences de relance'],
      prereq: "Accès à votre formulaire, à votre CRM et à l'outil d'automatisation.",
      cta: 'Répondre plus vite',
    },
    en: {
      name: 'Lead Fast-Response',
      title: 'Instant alert on every new lead',
      subtitle: 'Your team notified within seconds, the lead already in your CRM.',
      short: 'A Make or Zapier scenario that creates the contact in your CRM and instantly alerts your team (WhatsApp, email or Slack).',
      long: 'A lead waiting for an answer is a lead that may look elsewhere. We connect your form or your ads to your CRM and trigger an instant internal alert so that someone replies fast. Alerts go to your team. Sending automatic WhatsApp messages to leads requires their prior consent and a WhatsApp Business API account: that is not included.',
      included: ['Make or Zapier scenario tested end to end', 'Contact created or updated in your CRM', 'Instant internal alert (WhatsApp, email or Slack)', 'Short scenario documentation'],
      excluded: ['Make, Zapier, CRM or WhatsApp subscriptions', 'Automatic messages sent to leads', 'Writing follow-up sequences'],
      prereq: 'Access to your form, your CRM and the automation tool.',
      cta: 'Answer faster',
    },
  },
  {
    key: 'pack-compliance', id: 'B1', group: 'packs', pillar: 'compliance', icon: 'i-shield-check', days: 5,
    bundle: ['consent', 'accessibility'],
    single: true, // one price; the delivery time is set after the order
    prices: { standard: 69000, express: null, flash: null },
    fr: {
      name: 'Pack Conformité',
      title: 'Pack Conformité : cookies et accessibilité',
      subtitle: "Le consentement et le diagnostic d'accessibilité, réglés en un seul passage.",
      short: 'Consent Integration et Accessibility Fast-Scan par un seul spécialiste, avec un rapport unique.',
      long: 'Deux chantiers réglementaires de votre site en un seul passage : la bannière de consentement qui bloque vraiment les traceurs, et le diagnostic de ce qui gêne vos visiteurs. Un seul interlocuteur, un seul rapport.',
      included: ['Tout Consent Integration', 'Tout Accessibility Fast-Scan', 'Un seul spécialiste', 'Un rapport regroupé'],
      excluded: ['Licence de la plateforme de consentement', "Audit d'accessibilité complet", 'Corrections du site'],
      prereq: 'Voir les fiches Consent Integration et Accessibility Fast-Scan.',
      cta: 'Régler ma conformité',
    },
    en: {
      name: 'Compliance Pack',
      title: 'Compliance Pack: cookies and accessibility',
      subtitle: 'Consent and the accessibility diagnostic, sorted in a single pass.',
      short: 'Consent Integration and Accessibility Fast-Scan by a single specialist, with one report.',
      long: "Two regulatory projects for your site in a single pass: the consent banner that really blocks trackers, and the diagnostic of what gets in your visitors' way. One point of contact, one report.",
      included: ['All of Consent Integration', 'All of Accessibility Fast-Scan', 'One specialist', 'One combined report'],
      excluded: ['Consent platform licence', 'Full accessibility audit', 'Fixing the site'],
      prereq: 'See the Consent Integration and Accessibility Fast-Scan details.',
      cta: 'Sort out my compliance',
    },
  },
  {
    key: 'pack-revenue', id: 'B2', group: 'packs', pillar: 'revenue', icon: 'i-chart-line', days: 5,
    bundle: ['inbox', 'tracking', 'leads'],
    single: true, // one price; the delivery time is set after the order
    prices: { standard: 119000, express: null, flash: null },
    fr: {
      name: 'Pack Revenue',
      title: 'Pack Revenue : e-mails, conversions, prospects',
      subtitle: 'Vos e-mails arrivent, vos conversions remontent, vos prospects sont traités vite.',
      short: 'Délivrabilité e-mail, suivi des conversions côté serveur et alerte instantanée sur les prospects.',
      long: 'Trois briques techniques qui alimentent vos ventes : des e-mails authentifiés, des conversions mieux suivies et une alerte immédiate sur chaque demande entrante. Le suivi côté serveur suppose un consentement conforme déjà en place ; sinon, choisissez le Pack Complet.',
      included: ['Tout Inbox Protocol', 'Tout Server-Side Tracking', 'Tout Lead Fast-Response', 'Un seul interlocuteur'],
      excluded: ['Hébergement du serveur', 'Abonnements Make, Zapier, CRM, WhatsApp', 'Licence de la plateforme de consentement'],
      prereq: 'Plateforme de consentement conforme déjà en place ; accès DNS, GTM, Meta Business, CRM.',
      cta: 'Booster mes ventes',
    },
    en: {
      name: 'Revenue Pack',
      title: 'Revenue Pack: emails, conversions, leads',
      subtitle: 'Your emails arrive, your conversions are counted, your leads are handled fast.',
      short: 'Email deliverability, server-side conversion tracking and instant lead alerts.',
      long: 'Three technical building blocks that feed your sales: authenticated emails, better-tracked conversions and an immediate alert on every incoming request. Server-side tracking requires compliant consent already in place; otherwise, choose the Complete Pack.',
      included: ['All of Inbox Protocol', 'All of Server-Side Tracking', 'All of Lead Fast-Response', 'One point of contact'],
      excluded: ['Server hosting', 'Make, Zapier, CRM, WhatsApp subscriptions', 'Consent platform licence'],
      prereq: 'A compliant consent platform already in place; access to DNS, GTM, Meta Business and your CRM.',
      cta: 'Boost my sales',
    },
  },
  {
    key: 'pack-complete', id: 'B3', group: 'packs', pillar: 'both', icon: 'i-sparkles', days: 5, featured: true,
    bundle: SERVICES,
    single: true, // one price; the delivery time is set after the order
    prices: { standard: 185000, express: null, flash: null },
    fr: {
      name: 'Pack Complet',
      title: 'Pack Complet : les 5 services',
      subtitle: 'Conformité et revenus, tout est réglé en un seul passage.',
      short: 'Consent Integration, Accessibility Fast-Scan, Inbox Protocol, Server-Side Tracking et Lead Fast-Response.',
      long: "Le Pack Complet règle d'un coup les cinq sujets : consentement, accessibilité, délivrabilité, suivi serveur et alerte prospects. Le consentement est posé en premier, ce qui permet de brancher le suivi côté serveur de façon conforme. Un seul spécialiste, un seul calendrier.",
      included: ['Les 5 services complets', "Ordre de mise en œuvre pensé (consentement d'abord)", 'Un seul spécialiste', 'Rapports regroupés'],
      excluded: ['Licence de la plateforme de consentement', 'Hébergement du serveur', 'Abonnements Make, Zapier, CRM, WhatsApp', "Audit d'accessibilité complet"],
      prereq: 'Accès au site, à Google Tag Manager, à Meta Business, à la zone DNS, au CRM.',
      badge: 'Le plus complet',
      cta: 'Tout régler en un seul passage',
    },
    en: {
      name: 'Complete Pack',
      title: 'Complete Pack: all 5 services',
      subtitle: 'Compliance and revenue, all sorted in a single pass.',
      short: 'Consent Integration, Accessibility Fast-Scan, Inbox Protocol, Server-Side Tracking and Lead Fast-Response.',
      long: 'The Complete Pack handles all five topics at once: consent, accessibility, deliverability, server-side tracking and lead alerts. Consent goes in first, so that server-side tracking can be wired compliantly. One specialist, one schedule.',
      included: ['All 5 services in full', 'Planned implementation order (consent first)', 'One specialist', 'Combined reports'],
      excluded: ['Consent platform licence', 'Server hosting', 'Make, Zapier, CRM, WhatsApp subscriptions', 'Full accessibility audit'],
      prereq: 'Access to your site, Google Tag Manager, Meta Business, your DNS zone and your CRM.',
      badge: 'Most complete',
      cta: 'Sort everything in one pass',
    },
  },
  {
    // On quote: the client gives the number of domains, the expert replies with
    // a quote and an estimated delivery time. Nothing is sold through Stripe.
    key: 'multi-domains', id: 'M1', group: 'multi', pillar: 'revenue', icon: 'i-mails', quote: true,
    prices: { standard: null, express: null, flash: null },
    fr: {
      name: 'Multi-domaines',
      title: 'Délivrabilité multi-domaines : sur devis',
      subtitle: "Indiquez le nombre de domaines à authentifier, un expert vous répond avec un devis.",
      short: 'Inbox Protocol sur tous vos domaines d\'envoi, avec un tarif de volume et un récapitulatif unique.',
      long: "Idéal pour les agences et les groupes multi-marques : le même travail de délivrabilité répété sur chaque domaine, avec un tarif de volume. Indiquez le nombre de domaines à traiter : un expert étudie votre demande et vous envoie un devis avec une estimation du délai de réalisation, à retrouver dans votre espace client. Vous recevez ensuite un rapport par domaine et un tableau récapitulatif.",
      included: ['Inbox Protocol sur chaque domaine', 'Un rapport par domaine', 'Tableau récapitulatif', 'Délai estimé par l\'expert selon le volume'],
      excluded: ["Gestion de la réputation d'envoi", 'Surveillance mensuelle'],
      prereq: 'Accès DNS et messagerie pour chaque domaine.',
      cta: 'Demander mon devis',
    },
    en: {
      name: 'Multi-domain',
      title: 'Multi-domain email deliverability: on quote',
      subtitle: 'Tell us how many domains to authenticate, an expert replies with a quote.',
      short: 'Inbox Protocol on all your sending domains, at a volume rate, with a single summary.',
      long: 'Ideal for agencies and multi-brand groups: the same deliverability work repeated on each domain, at a volume rate. Tell us how many domains to handle: an expert reviews your request and sends you a quote with an estimated delivery time, available in your client area. You then receive one report per domain and a summary table.',
      included: ['Inbox Protocol on every domain', 'One report per domain', 'Summary table', 'Delivery time estimated by the expert for your volume'],
      excluded: ['Sending reputation management', 'Monthly monitoring'],
      prereq: 'DNS and email access for each domain.',
      cta: 'Request my quote',
    },
  },
];

export const BY_KEY = Object.fromEntries(CATALOG.map((p) => [p.key, p]));

export const lookupKey = (key, tier) => `stanza_${key.replace(/-/g, '_')}_${tier}`;

// Prices and products replaced by this catalog: archived by `npm run stripe:setup`.
export const LEGACY_LOOKUP_KEYS = [
  'stanza_inbox_protocol', 'stanza_consent_integration', 'stanza_complete_compliance',
  'stanza_pack_6_domains_standard', 'stanza_pack_6_domains_express', 'stanza_pack_6_domains_flash',
];
export const LEGACY_PLANS = ['bundle', 'pack-6-domains'];

// Sum of the bundled services at a tier: the "bought separately" reference price.
export function separatePrice(item, tier) {
  if (!item.bundle) return null;
  let sum = 0;
  for (const k of item.bundle) {
    const amount = BY_KEY[k].prices[tier];
    if (amount == null) return null;
    sum += amount;
  }
  return sum;
}
