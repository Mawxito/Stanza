# Stanza — site vitrine

Site marketing de **Stanza** : déploiement des protocoles de délivrabilité email (SPF, DKIM, DMARC, BIMI) et intégrations RGPD / cookies clés en main (CMP + blocage conditionnel des scripts), vendus en packages à prix fixe, livrés en 24–48 h.

Le site est statique (HTML / CSS / JS vanilla, aucune dépendance, aucun build). Les ventes passent par **Stripe Payment Links**, les formulaires par **Tally**.

## Structure

```
index.html              Page d'accueil
success.html            Page de retour après paiement Stripe (onboarding Tally)
assets/css/stanza.css   Styles (tokens couleurs en tête de fichier)
assets/js/config.js     ← liens Tally et Stripe à renseigner
assets/js/main.js       Interactions et animations
assets/js/brands.js     Logos des intégrations (Simple Icons, CC0)
assets/fonts/           Newsreader + Geist (SIL Open Font License)
assets/img/favicon.svg
```

## Mise en route

1. **Tally** : créez les formulaires (contact, onboarding, devenir spécialiste, audit gratuit, newsletter) et collez leur ID (`https://tally.so/r/<ID>`) dans `assets/js/config.js`. Les boutons ouvrent le formulaire en popup Tally.
2. **Stripe** : créez trois Payment Links (Inbox Protocol 450 €, Consent Integration 550 €, Complete Compliance 800 €), collez les URLs dans `config.js`, et réglez la redirection après paiement sur `https://<votre-domaine>/success.html`.
3. Tant qu'une valeur commence par `REPLACE_`, le bouton concerné bascule sur le formulaire de contact (ou sur la section tarifs) : aucun lien mort.
4. Déployez le dossier tel quel (Netlify, Vercel, Cloudflare Pages, GitHub Pages…).

Test en local :

```bash
python3 -m http.server 8080
# puis http://localhost:8080
```

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
- **Prix et textes** : directement dans `index.html` (section `#pricing`). Pensez aussi à `config.js` et aux Payment Links Stripe.
- **Accessibilité** : `prefers-reduced-motion` coupe les animations ; onglets et slider utilisables au clavier.

## À valider avant mise en ligne

- Pages légales (mentions légales, confidentialité, CGV) : les liens du footer pointent vers `#`.
- Les chiffres affichés dans les maquettes (98 % de placement, « matched in 6 minutes »…) sont illustratifs : remplacez-les par des données réelles ou gardez-les clairement comme exemples.
- Les logos de marques servent uniquement à indiquer la compatibilité ; ils restent la propriété de leurs détenteurs.
