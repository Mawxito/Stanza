# Stanza — site vitrine

Site marketing de **Stanza** : déploiement des protocoles de délivrabilité email (SPF, DKIM, DMARC, BIMI) et intégrations RGPD / cookies clés en main (CMP + blocage conditionnel des scripts), vendus en packages à prix fixe, livrés en 24–48 h.

Le site est statique (HTML / CSS / JS vanilla) et hébergé sur **Cloudflare Workers** (assets statiques). Les paiements passent par **Stripe Checkout** via deux routes API du Worker, les formulaires par **Tally**.

## Structure

```
public/                       Site statique (assets du Worker)
  index.html, success.html
  assets/css · js · fonts · img
  assets/js/config.js         ← IDs des formulaires Tally
src/index.js                  Point d'entrée du Worker : route /api/* vers functions/
functions/api/checkout.js     POST /api/checkout → crée la Checkout Session Stripe
functions/api/stripe-webhook.js  POST /api/stripe-webhook → traitement des commandes
functions/_lib/plans.js       Les 3 packages (nom, prix, lookup_key)
scripts/setup-stripe.mjs      Crée/met à jour produits et prix dans Stripe
wrangler.toml                 Config du Worker (main + [assets])
```

## Paiement : comment ça marche

1. Le bouton « Buy … » envoie un formulaire `POST /api/checkout` avec le package choisi.
2. La fonction récupère le prix par `lookup_key` et crée une **Checkout Session** (moyens de paiement dynamiques, adresse de facturation, numéro de TVA, métadonnée `plan`), puis redirige vers Stripe.
3. Avec `CAPTURE_METHOD = "manual"` (par défaut), la carte est **autorisée** au paiement mais **débitée seulement après l'acceptance gate**. Vous capturez le paiement depuis le Dashboard Stripe (Paiements → « Capturer »), dans un délai de 7 jours, sinon l'autorisation expire. Avec `"automatic"`, le client est débité immédiatement.
4. Stripe renvoie le client sur `/success?session_id=…`, qui transmet l'ID au formulaire d'onboarding Tally (champ caché `session_id`).
5. Le **webhook** (et non la page de succès) enregistre la commande : `authorized` → `paid` à la capture, ou `canceled` si l'autorisation est libérée. Il stocke la commande dans le KV `ORDERS` s'il est lié, et l'envoie en JSON à `ORDER_NOTIFY_URL` (Slack, Make, Zapier…) si elle est définie.

## Mise en route

### 1. Stripe

```bash
npm install
STRIPE_SECRET_KEY=rk_test_... npm run stripe:setup   # crée les 3 produits/prix (idempotent)
```

- Utilisez une **clé restreinte** (`rk_`) plutôt que la clé secrète. Permissions : Checkout Sessions (écriture), Prices (lecture), Products (lecture ; écriture uniquement pour le script de setup), Payment Intents (lecture).
- Dans **Paramètres → Informations publiques**, réglez le nom d'entreprise affiché sur Checkout (« Stanza »).
- Dans **Développeurs → Webhooks**, ajoutez l'endpoint `https://<votre-domaine>/api/stripe-webhook` avec les événements :
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.succeeded`, `payment_intent.canceled`.

### 2. Cloudflare Workers

- Connectez le dépôt GitHub dans Cloudflare (Workers & Pages → Créer → Worker → Importer un dépôt). Commande de build : aucune ; commande de déploiement : `npx wrangler deploy` (`main` et `[assets]` sont définis dans `wrangler.toml`).
- Ajoutez les secrets (Worker → Paramètres → Variables et secrets, type « Secret ») : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, et éventuellement `ORDER_NOTIFY_URL`.
- Facultatif : créez un namespace KV et liez-le sous le nom `ORDERS` (bloc `[[kv_namespaces]]` de `wrangler.toml`) pour garder un journal des commandes.

### 3. Tally

Collez les IDs des formulaires dans `public/assets/js/config.js`. Dans le formulaire d'onboarding, ajoutez un champ caché `session_id`.

### Développement local

```bash
cp .dev.vars.example .dev.vars        # renseignez vos clés de test
npm run dev                           # http://localhost:8787
stripe listen --forward-to localhost:8787/api/stripe-webhook
```

Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.

Un hook git (`.githooks/pre-commit`, activé par `npm install`) bloque tout commit contenant une clé `sk_`/`rk_` ou un `whsec_`.

## Sections

| Section | Contenu |
|---|---|
| Header + méga-menus | Solutions (services, plateformes, packages), Resources, Pricing |
| Hero | Titre animé mot par mot, 3 onglets Deliver / Comply / Verify avec barre de progression et défilement auto (9 s), maquettes animées |
| Délivrabilité (clair) | SPF/DKIM/DMARC, BIMI & MX, Postmaster |
| Conformité RGPD (sombre) | Déploiement CMP (Axeptio, Cookiebot, Didomi), blocage des scripts, Shopify / Webflow / WordPress |
| Livraison vérifiée (sombre) | Acceptance gate, contrôles automatisés, escrow Stripe |
| Standards | Gmail, Outlook, RGPD, CNIL, IAB TCF, DMARC… (fondu en cascade) |
| Pourquoi Stanza | Slider : la carte active s'agrandit, fondu du contenu, boucle infinie |
| Intégrations | Deux marquees en sens opposé, logo en couleur au survol |
| Tarifs + FAQ | 3 packages reliés à Stripe |
| CTA + footer | Fond étoilé animé, footer en accordéons |

La section « Platform » du site de référence n'a pas été reproduite.

## Personnalisation

- **Couleurs** : variables `--blue-*`, `--dark`, `--light` en haut de `stanza.css`.
- **Prix** : modifiez `functions/_lib/plans.js` **et** les montants affichés dans `public/index.html`, puis relancez `npm run stripe:setup` (un nouveau prix est créé et l'ancien archivé).
- **Accessibilité** : `prefers-reduced-motion` coupe les animations ; onglets et slider utilisables au clavier.

## À valider avant mise en ligne

- Pages légales (mentions légales, confidentialité, CGV) : les liens du footer pointent vers `#`.
- Les chiffres affichés dans les maquettes (98 % de placement, « matched in 6 minutes »…) sont illustratifs : remplacez-les par des données réelles ou gardez-les clairement comme exemples.
- Les logos de marques servent uniquement à indiquer la compatibilité ; ils restent la propriété de leurs détenteurs.
- **TVA** : les prix sont créés sans taxe. N'activez `automatic_tax` (Stripe Tax) qu'après avoir enregistré votre immatriculation TVA dans Stripe, sinon aucune taxe n'est collectée.
- **Clés** : passez en clés live (restreintes) seulement après la [checklist de mise en production Stripe](https://docs.stripe.com/get-started/checklist/go-live.md).
