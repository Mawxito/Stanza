# À ajouter dans le portail (`Mawxito/stanza-portal`)

Ces fichiers ne sont **pas** dans le site : ils vont dans le dépôt du portail, qui est déployé sur Vercel.

## 1. Le point d'entrée (nouveau fichier)

Créez le fichier `src/app/api/checkout-token/route.ts` dans `stanza-portal` avec le contenu de
`docs/portal/checkout-token-route.ts` (ce dossier).

Sur GitHub : stanza-portal → *Add file* → *Create new file*, tapez le nom `src/app/api/checkout-token/route.ts`
(les `/` créent les dossiers), collez le contenu, puis *Commit changes*.

## 2. Le test (facultatif, recommandé)

Même chose pour `tests/checkout-token.test.mjs` avec le contenu de `docs/portal/checkout-token.test.mjs`.

## 3. Une ligne à modifier dans `src/proxy.ts`

Tout en bas du fichier, ajoutez `api/checkout-token` à la liste des routes exclues (comme `api/session`
et `api/site-request`, que le site appelle aussi) :

```diff
-    { source: '/((?!_next/static|_next/image|icon.svg|favicon.ico|api/intake|api/jobs|api/catalog|api/blog|api/session|api/site-request).*)' },
+    { source: '/((?!_next/static|_next/image|icon.svg|favicon.ico|api/intake|api/jobs|api/catalog|api/blog|api/session|api/site-request|api/checkout-token).*)' },
```

## 4. Variable d'environnement (Vercel)

`INTAKE_SIGNING_SECRET` doit déjà exister (32 caractères minimum) et être **identique** à `PORTAL_SIGNING_SECRET`
du site sur Cloudflare. Rien d'autre à ajouter.

## 5. Vérifier après le déploiement

```
curl -i -X POST -H "Origin: https://stanzafix.com" -H "Content-Type: application/json" -d '{}' https://portail.stanzafix.com/api/checkout-token
```

Attendu : `401` avec `{"error":"unauthenticated"}` (pas de session dans cette commande). Une page HTML ou un 404 veut dire
que le fichier n'est pas déployé. Connecté dans le navigateur, le bouton d'achat du site renvoie la réponse `{"token": …}`.

Déployez le portail **avant** de fusionner la branche du site.
