# Stanza — site vitrine

Site marketing de **Stanza**, en français et en anglais. Cinq services techniques à prix fixe, répartis en deux piliers, plus des packs :

- **Pilier 1 : Conformité** : consentement cookies (Consent Integration), diagnostic d'accessibilité (Accessibility Fast-Scan)
- **Pilier 2 : Revenue & Data** : délivrabilité e-mail (Inbox Protocol), suivi côté serveur (Server-Side Tracking), alerte prospects (Lead Fast-Response)
- **Packs** : Conformité, Revenue, Complet (les 5)
- **Multi-domaines** : sur devis ; le client indique le nombre de domaines, l'expert répond avec un devis et une estimation du délai

Chaque service à l'unité existe en délai **Standard** (5 jours ouvrés), **Express** (48 h) ou **Flash** (24 h). Les **packs** n'ont qu'un prix (celui du Standard), sans délai fixe ni remboursement : leur délai est établi après la commande. Les délais sont **garantis** (services à l'unité) : en cas de retard, le client est remboursé de 50 % du prix HT en Standard et de 100 % du prix HT en Express ou Flash (délai compté à partir de la réception des accès ; les devis multi-domaines ne sont pas concernés). En capture manuelle, il suffit de capturer la moitié du montant (Standard) ou d'annuler l'autorisation (Express/Flash) ; si le paiement est déjà capturé, faites un remboursement depuis le Dashboard Stripe.

Le site est en HTML / CSS / JS vanilla, hébergé sur **Cloudflare Pages**. Un middleware Pages choisit la langue et insère les fiches produits ; les paiements passent par **Stripe Checkout**, les formulaires par **Tally**.

## Structure

```
public/                       Site publié par Cloudflare Pages (textes en anglais)
  index.html                  Accueil : description des services, sans aucun prix
  pricing.html                Page Tarifs (/pricing) : packs, services, délais, FAQ
  success.html                Retour après paiement
  help.html, free-check.html, contact.html, guarantees.html, security.html,
  who-its-for.html, specialists.html, newsletter.html, glossary.html
                              Pages Ressources (/help, /free-check…), liées depuis le menu Ressources et le pied de page
  journal.html                Gabarit du journal (/journal et /journal/<slug>, remplis par functions/journal/)
  assets/js/journal.js        Filtres du journal sans rechargement, animations, barre de lecture
  assets/js/auth.js           Comportement de ces deux pages
  _routes.json                Le middleware ne tourne pas sur /assets/*
  assets/js/config.js         ← IDs des formulaires Tally
functions/_middleware.js      Langue + traduction FR + fiches produits, côté serveur
functions/_lib/catalog.js     ← LES PRODUITS : textes FR/EN, prix, délais (source unique)
functions/_lib/strings-fr.js  ← Traductions françaises des textes des pages
functions/_lib/render.js      HTML des fiches produits (page Tarifs et accueil), promotions
functions/_lib/blog.js        Articles du journal (PORTAL_URL/api/blog, 1 min de cache ; blog-seed.js en secours)
functions/_lib/journal.js     Pages du journal : liste filtrée, article, 404
functions/_lib/markdown.js    Rendu Markdown sûr des articles (tout le HTML est échappé)
functions/journal/            Routes /journal et /journal/<slug>
functions/_lib/i18n.js        Choix de la langue (pays, cookie, ?lang=)
functions/api/checkout.js     POST /api/checkout → crée la Checkout Session Stripe
functions/api/stripe-webhook.js  POST /api/stripe-webhook → traitement des commandes
functions/api/sync-prices.js  POST /api/sync-prices → le portail y signale un changement de prix, Stripe est mis à jour
functions/_lib/stripe-sync.js Synchronisation produits / prix Stripe (script, portail et paiement)
scripts/setup-stripe.mjs      Crée/met à jour produits et prix dans Stripe
scripts/check-i18n.mjs        Vérifie qu'aucun texte n'est sans traduction
wrangler.toml                 Config Cloudflare Pages
```

## Langues (FR / EN)

- Les pages sont écrites en anglais. Pour un visiteur français, `functions/_middleware.js` remplace à la volée chaque texte marqué `data-i18n="clé"` par sa traduction de `functions/_lib/strings-fr.js`. Le HTML arrive déjà traduit : pas de « flash » d'anglais, et Google voit les deux versions.
- **Langue choisie** : le bouton EN / FR (à gauche de « Log in ») pointe vers `?lang=en` / `?lang=fr` et mémorise le choix dans un cookie `stanza_lang` (cookie de préférence, exempté de consentement).
- **Sans choix** : visiteur situé en France (DOM-TOM compris, d'après Cloudflare) → français ; ailleurs → anglais.
- **Modifier un texte** : l'anglais dans le HTML, le français dans `strings-fr.js` (même clé). Puis `npm run check:i18n` signale les traductions manquantes.

## Visiteur connecté au portail

`assets/js/main.js` appelle `https://portail.stanzafix.com/api/session` (cookies du portail, CORS limité à stanzafix.com) : connecté, « Connexion » devient le prénom du visiteur et « Commencer » devient « Portail ». Les liens « Connexion » pointent vers `/login?next=<page courante>` : après connexion, le visiteur revient sur la page qu'il quittait. Connecté, la demande de devis multi-domaines part directement vers `POST /api/site-request` du portail, rattachée à son compte (sinon, formulaire Tally comme avant). En cas d'échec, rien ne change.

## Produits et prix

Tout est dans `functions/_lib/catalog.js` : textes FR/EN, inclus / non inclus, prérequis, prix HT en centimes pour chaque délai. La page Tarifs et les cartes de l'accueil sont générées depuis ce fichier, donc le site affiche toujours les mêmes prix que Stripe. Le prix barré des packs est calculé automatiquement (somme des services séparés, pour le même délai).

Le choix Standard / Express / Flash en haut de la page Tarifs bascule tous les prix et boutons, en CSS (sans JavaScript).

## Paiement : comment ça marche

1. Le bouton d'une fiche envoie un formulaire `POST /api/checkout` avec l'offre (`plan`), le délai (`speed`) et la langue.
2. La fonction relit le catalogue du portail (prix et disponibilité, côté serveur), réutilise le prix Stripe `lookup_key` s'il a le même montant, sinon crée un prix à la volée sur le même produit Stripe. Le prix Stripe par défaut se trouve par `lookup_key` (`stanza_<offre>_<délai>`, ex. `stanza_pack_complete_express`) et crée une **Checkout Session** dans la langue du visiteur (moyens de paiement dynamiques, adresse de facturation, numéro de TVA, délai rappelé sous le bouton, métadonnées `plan` et `speed`), puis redirige vers Stripe.
3. Avec `CAPTURE_METHOD = "manual"` (par défaut), la carte est **autorisée** au paiement mais **débitée seulement après l'acceptance gate**. Vous capturez le paiement depuis le Dashboard Stripe (Paiements → « Capturer »), sous 5 jours ouvrés. Une autorisation de carte dure environ 7 jours, ce que 5 jours ouvrés plus la validation peuvent dépasser : capturez sans attendre. L’autorisation étendue (`request_extended_authorization`, jusqu’à 30 jours) n’est pas activée sur le compte Stripe (Stripe refuse alors la session) ; une fois Stripe l’ayant activée, ajoutez la variable `STRIPE_EXTENDED_AUTH=on` dans Cloudflare Pages. Avec `"automatic"`, le client est débité immédiatement.
4. Stripe renvoie le client sur `/success?session_id=…`, qui transmet l'ID au formulaire d'onboarding Tally (champ caché `session_id`).
5. Le **webhook** (et non la page de succès) envoie chaque commande et chaque événement de paiement au **portail Stanza** (requête signée) dès que `PORTAL_URL` et `PORTAL_SIGNING_SECRET` sont définis : la commande, le compte client et la liste des éléments à fournir y sont créés. Sans ces secrets, l'ancien comportement s'applique : il stocke la commande dans le KV `ORDERS` s'il est lié, et l'envoie en JSON à `ORDER_NOTIFY_URL` (Slack, Make, Zapier…) si elle est définie.

## Connexion obligatoire avant de payer

Acheter exige un compte du portail : le paiement est rattaché à un **client Stripe** créé à partir de ce compte (nom, e-mail, société), réutilisé à chaque commande, avec l'identifiant du compte dans `metadata.portal_user` et `client_reference_id`. Checkout s'ouvre avec l'e-mail verrouillé et l'adresse et le numéro de TVA enregistrés sur la fiche.

1. Au clic sur un bouton d'offre, `main.js` demande au portail `POST /api/checkout-token` (cookies de session, CORS limité au site). Le portail répond `{ token }` : `base64url(JSON {v, uid, email, name, company, locale, exp})` + `.` + HMAC-SHA256 hex de `checkout.<base64url>` avec `INTAKE_SIGNING_SECRET`, valable 10 minutes. Si le visiteur n'est pas connecté (401), il est envoyé à `portail/login?next=<offre>` puis revient sur l'offre.
2. `POST /api/checkout` vérifie le jeton (`verifyCheckoutToken`). Sans jeton valide, il redirige vers la connexion et ne crée rien dans Stripe. Il retrouve ou crée le client Stripe (`stripe-customer.js`), puis crée la Checkout Session.
3. Tant que `PORTAL_URL` et `PORTAL_SIGNING_SECRET` ne sont pas définis (développement local), le paiement sans compte fonctionne comme avant.

**Côté portail** : le point d'entrée n'existe pas encore dans `stanza-portal`. Le code prêt à copier (route, test) est dans `docs/portal/` : copier `checkout-token-route.ts` vers `src/app/api/checkout-token/route.ts` et `checkout-token.test.mjs` vers `tests/`, puis déployer le portail **avant** ce site, sinon chaque achat échoue.

## Mise en route

### 1. Stripe

```bash
npm install
STRIPE_SECRET_KEY=rk_test_... npm run stripe:setup   # crée les 8 produits et 16 prix (idempotent)
```

- Utilisez une **clé restreinte** (`rk_`) plutôt que la clé secrète. Permissions : Checkout Sessions (écriture), Prices (lecture), Products (lecture ; écriture uniquement pour le script de setup), Payment Intents (lecture).
- Dans **Paramètres → Informations publiques**, réglez le nom d'entreprise affiché sur Checkout (« Stanza »).
- Le script archive aussi les anciens prix (Inbox 450 €, Consent 550 €, Complete 800 €, pack 6 domaines). Relancez-le à chaque changement de prix dans `catalog.js`.
- Dans **Développeurs → Webhooks**, ajoutez l'endpoint `https://<votre-domaine>/api/stripe-webhook` avec les événements :
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.succeeded`, `payment_intent.canceled`.

### 2. Cloudflare Pages

- Connectez le dépôt GitHub dans Cloudflare Pages : commande de build `npm install`, répertoire de sortie `public` (déjà défini dans `wrangler.toml`).
- Ajoutez les secrets (Paramètres → Variables et secrets, type « Secret ») : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PORTAL_URL` (`https://portail.stanzafix.com`) et `PORTAL_SIGNING_SECRET` (même valeur que `INTAKE_SIGNING_SECRET` du portail). `ORDER_NOTIFY_URL` n'est plus utile une fois le portail branché.
- Facultatif : créez un namespace KV et liez-le sous le nom `ORDERS` pour garder un journal des commandes.

### 3. Espace client (portail Stanza)

« Log in » et « Get started » mènent à `https://portail.stanzafix.com/login` et `/signup` ; les anciennes adresses `/login` et `/signup` du site y redirigent (`functions/_middleware.js`). Après paiement, `success.html` envoie le client vers son espace (`/client`).

**Catalogue piloté depuis le portail** : prix, description et disponibilité de chaque offre (Admin → Services & modèles) sont lus sur `PORTAL_URL/api/catalog`, gardés une minute, et utilisés pour l'affichage comme pour le paiement. Prix vide = vitesse non proposée (le site affiche l'option la plus proche avec une note rouge) ; offre inactive = retirée du site et refusée au paiement. Si le portail ne répond pas, `functions/_lib/catalog.js` sert de secours.

**Prix du portail → Stripe** : Stripe garde toujours le prix **habituel** de chaque offre et vitesse (produit `metadata.plan`, prix `lookup_key` `stanza_<offre>_<vitesse>`, HT, EUR). Quand un admin change un prix dans le portail, Stripe suit de deux façons :
1. **Immédiatement** : le portail envoie `POST https://stanzafix.com/api/sync-prices` (corps libre, ex. `{}`), signé comme ses autres échanges (en-têtes `x-stanza-timestamp` et `x-stanza-signature` = HMAC-SHA256 hex de `${timestamp}.${corps}` avec `INTAKE_SIGNING_SECRET`, moins de 5 minutes). Le site relit lui-même `PORTAL_URL/api/catalog` (le corps n'est jamais cru), crée le nouveau prix Stripe, archive l'ancien et archive les vitesses retirées. Réponse `{ ok, changed }` ; 503 si le portail ne répond pas (rien n'est alors modifié dans Stripe) ; le portail peut réessayer.
2. **Au paiement, en filet de sécurité** : si le prix du portail diffère de celui de Stripe, `checkout` crée le nouveau prix Stripe avant d'encaisser (jamais un prix remisé, jamais au détriment de la vente).
Une promotion ne crée aucun prix Stripe : la ligne de paiement porte le prix remisé, le nom de la promotion et `metadata.promo`. Les offres sur devis (Atelier, Multi-domaines) n'ont pas de prix Stripe.

**Promotions** (Admin → Promotions du portail) : `/api/catalog` envoie alors, pour chaque offre, le prix effectif (déjà remisé) dans `prices`, le prix habituel dans `regular_prices` et la promotion dans `promo` ; la liste `promotions` donne les promotions en cours. Le site barre le prix habituel, affiche un badge (« Soldes d'hiver −20 % », « jusqu'au … ») et, en haut de l'accueil et de la page Tarifs, un bandeau animé avec compte à rebours. Le paiement débite le prix effectif : la ligne Stripe porte le nom de la promotion et `metadata.promo` (identifiant de la promotion) est ajouté à la session et au paiement. La comparaison « en services séparés » des packs compare toujours des prix effectifs entre eux. Un portail qui n'envoie pas ces champs reste compatible (aucune promotion).

**Journal** (`/journal`) : les articles sont écrits et publiés dans le portail et lus sur `PORTAL_URL/api/blog` (une minute de cache). Sans portail, s'il ne répond pas ou s'il n'a encore aucun article publié, les trois articles de `functions/_lib/blog-seed.js` sont affichés. `GET /api/portal-status` indique la source des articles.

**Pages légales** : le lien « Confidentialité et conditions » du footer (et les liens Mentions légales / Confidentialité / CGV) mène à `PORTAL_URL/legal?lang=<langue de la page>` (attribut `data-portal-href`, réécrit par le middleware).

**Factures** : Stripe refuse `invoice_creation` quand la carte est seulement autorisée (`CAPTURE_METHOD = "manual"`, le réglage par défaut) : **aucune facture Stripe n'est alors créée automatiquement pour les offres de la boutique**. Elles ne le sont qu'avec `CAPTURE_METHOD = "automatic"`, et pour les devis du portail (débités immédiatement). Avec la capture manuelle, émettez la facture après la capture (Dashboard Stripe → Factures, ou depuis le portail). Pour couper les factures Stripe dans tous les cas, ajoutez `STRIPE_INVOICES=off` dans Cloudflare Pages.

**Conservation** : les données d'une commande sont supprimées 30 jours après sa clôture (ou plus tôt par l'admin) ; la page de succès et la FAQ tarifs le rappellent au client.

### 3. Tally

Collez les IDs des formulaires dans `public/assets/js/config.js`. Dans le formulaire d'onboarding, ajoutez un champ caché `session_id`. Dans le formulaire de devis multi-domaines (`quote`), ajoutez les champs cachés `domains`, `offer` et `lang` : le nombre de domaines saisi sur la page Tarifs y arrive automatiquement.

### Développement local

```bash
cp .dev.vars.example .dev.vars        # renseignez vos clés de test
npm run dev                           # http://localhost:8788
stripe listen --forward-to localhost:8788/api/stripe-webhook
```

Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.

Un hook git (`.githooks/pre-commit`, activé par `npm install`) bloque tout commit contenant une clé `sk_`/`rk_` ou un `whsec_`.

## Pages et sections

**Accueil** (`/`, aucun prix) : en-tête avec méga-menus et bouton EN / FR · hero avec ciel étoilé au ralenti et onglets animés (Délivrer / Se conformer / Vérifier) · « Deux piliers, cinq services » (cartes générées depuis le catalogue) · délivrabilité · conformité (cookies + accessibilité) · Revenue & Data (suivi serveur + alerte prospects) · livraison vérifiée · **Pourquoi c'est important** (enjeux 2024-2025 et cartes par profil : grandes entreprises, PME, e-commerçants, indépendants et particuliers, agences, associations et startups) · standards · slider · intégrations · FAQ · CTA étoilé.

**Tarifs** (`/pricing`) : hero · sélecteur de délai collant · services du pilier 1 · services du pilier 2 · multi-domaines sur devis (champ « nombre de domaines ») · packs · étapes de commande · FAQ tarifs · CTA. Chaque fiche a une ancre (`/pricing#consent`, `/pricing#pack-complete`…) utilisée par les liens de l'accueil.

**Journal** (`/journal`) : hero avec illustration animée · filtres combinables (recherche, catégorie, mots-clés multiples, auteur et son rôle, langue, tri par date) reflétés dans l'URL (liens partageables, bouton Retour), compteur, filtres actifs retirables, réinitialisation, état vide · cartes animées à l'arrivée et à chaque filtrage. Par défaut, les articles dans la langue de la page passent en premier. **Article** (`/journal/<slug>`) : barre de progression de lecture, catégorie, mots-clés (liens vers la liste filtrée), auteur, date, temps de lecture, articles liés ; balises canonical, Open Graph et JSON-LD `BlogPosting` ; page 404 si l'article n'existe pas.

## Personnalisation

- **Couleurs** : variables `--blue-*`, `--dark`, `--light` en haut de `stanza.css`.
- **Prix, description et disponibilité** : depuis le portail (Admin → Services & modèles). Les autres textes des offres (titre, liste incluse, détail) restent dans `functions/_lib/catalog.js`, qui sert aussi de secours si le portail ne répond pas.
- **Textes des pages** : anglais dans `public/*.html`, français dans `functions/_lib/strings-fr.js`, puis `npm run check:i18n`.
- **Accessibilité** : `prefers-reduced-motion` coupe les animations ; onglets et slider utilisables au clavier.

## À valider avant mise en ligne

- Pages légales : hébergées par le portail (`/legal`) ; vérifiez qu'elle est en ligne avant la mise en production.
- Les chiffres affichés dans les maquettes (100 % d'authentification, « 12 scripts bloqués »…) sont illustratifs : remplacez-les par des données réelles ou gardez-les clairement comme exemples.
- Les logos de marques servent uniquement à indiquer la compatibilité ; ils restent la propriété de leurs détenteurs.
- **TVA et particuliers** : le site affiche des prix HT et Stripe facture exactement ces montants (prix créés en `tax_behavior: exclusive`, sans taxe ajoutée). Si vous êtes assujetti à la TVA, il faut la collecter ; et la vente à des particuliers impose en France d'afficher des prix TTC. Validez ce point avec votre comptable. N'activez `automatic_tax` (Stripe Tax) qu'après avoir enregistré votre immatriculation TVA dans Stripe, sinon aucune taxe n'est collectée.
- **Clés** : passez en clés live (restreintes) seulement après la [checklist de mise en production Stripe](https://docs.stripe.com/get-started/checklist/go-live.md).
