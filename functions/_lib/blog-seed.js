// Articles shown by the journal (/journal) when the portal has none to serve: PORTAL_URL not set,
// portal unreachable, or no article published there yet. Same shape as PORTAL_URL/api/blog.
// Once articles are published from the portal, these are no longer shown.
export const SEED_POSTS = [
  {
    slug: 'spf-dkim-dmarc-checklist-2026',
    lang: 'fr',
    title: 'SPF, DKIM, DMARC : la checklist 2026 pour que vos e-mails arrivent',
    excerpt: "Gmail, Yahoo puis Outlook refusent désormais les envois mal authentifiés. Les trois enregistrements DNS à vérifier, dans le bon ordre, avant de durcir votre politique DMARC.",
    body: `Depuis février 2024, Gmail et Yahoo exigent des expéditeurs en volume (plus de 5 000 messages par jour vers leurs boîtes) une authentification complète. Outlook.com applique les mêmes règles depuis mai 2025. Dans les faits, même une PME qui envoie peu est concernée : un devis ou une facture mal authentifiés finissent de plus en plus souvent en spam, voire sont rejetés.

## 1. Faites l'inventaire de vos expéditeurs

Avant de toucher au DNS, listez **tout ce qui envoie des e-mails avec votre domaine** : votre messagerie (Google Workspace, Microsoft 365…), votre outil d'e-mailing, votre CRM, votre logiciel de facturation, votre site (formulaires, e-commerce). Un service oublié, c'est un service dont les messages seront bloqués quand DMARC passera en \`reject\`.

## 2. SPF : un seul enregistrement, moins de 10 requêtes

SPF déclare les serveurs autorisés à envoyer pour votre domaine.

- **Un seul** enregistrement \`v=spf1\` par domaine : deux enregistrements SPF invalident les deux.
- **10 requêtes DNS au maximum** (chaque \`include:\` compte, ainsi que ceux qu'il contient). Au-delà, SPF échoue en \`permerror\`.
- Terminez par \`~all\` pendant la mise en place, puis \`-all\` quand l'inventaire est complet.

\`\`\`
votredomaine.fr.  TXT  "v=spf1 include:_spf.google.com include:sendinblue.com -all"
\`\`\`

## 3. DKIM : une signature par service

DKIM signe chaque message avec une clé dont la partie publique est publiée dans votre DNS. Activez-le **dans chaque outil** qui envoie pour vous : chacun a son propre sélecteur (\`google._domainkey\`, \`s1._domainkey\`…). Préférez des clés de **2048 bits** et vérifiez que la signature porte bien sur *votre* domaine, pas sur celui du prestataire.

## 4. DMARC : commencer par observer

DMARC indique aux messageries quoi faire d'un message qui échoue, et vous envoie des rapports. Démarrez sans rien bloquer :

\`\`\`
_dmarc.votredomaine.fr.  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@votredomaine.fr; adkim=r; aspf=r"
\`\`\`

Lisez les rapports agrégés pendant deux à quatre semaines. Chaque source légitime doit passer SPF **ou** DKIM *avec alignement* (le domaine vérifié doit correspondre à celui de l'adresse d'expédition).

## 5. Durcir progressivement

1. \`p=none\` : observation, aucun impact sur la distribution.
2. \`p=quarantine\` : les messages non conformes vont en spam. Vous pouvez commencer avec \`pct=25\`.
3. \`p=reject\` : les usurpations de votre domaine sont refusées. C'est aussi le prérequis de BIMI (votre logo dans la boîte de réception).

> Ne passez jamais directement en \`reject\` sans avoir lu vos rapports : c'est la première cause de factures qui « disparaissent ».

## Les autres exigences des grandes messageries

- un lien de **désinscription en un clic** dans les e-mails marketing (en-têtes \`List-Unsubscribe\` et \`List-Unsubscribe-Post\`) ;
- un taux de plaintes pour spam **sous 0,3 %** (visez moins de 0,1 %) ;
- un DNS inverse (PTR) cohérent pour vos serveurs d'envoi.

Pour vérifier votre domaine, Google Postmaster Tools et les rapports DMARC sont vos meilleurs alliés. Si vous préférez déléguer, notre [Inbox Protocol](https://stanzafix.com/pricing#inbox) configure et vérifie tout, rapport à l'appui.`,
    category: { key: 'deliverability', label: { fr: 'Délivrabilité', en: 'Deliverability' } },
    tags: ['DMARC', 'SPF', 'DKIM', 'Gmail'],
    author: { name: 'Rédaction Stanza', role: 'writer', avatar_url: null },
    cover_url: null,
    published_at: '2026-09-15T08:00:00.000Z',
    reading_minutes: 6,
  },
  {
    slug: 'google-consent-mode-v2-guide',
    lang: 'fr',
    title: 'Google Consent Mode v2 : ce qui change vraiment pour vos mesures',
    excerpt: "Deux nouveaux signaux, deux modes de fonctionnement et une règle d'or : rien ne se déclenche avant le choix du visiteur. Le point pour garder vos conversions sans risque RGPD.",
    body: `Depuis mars 2024, Google exige des signaux de consentement pour les visiteurs de l'Espace économique européen. Sans eux, le remarketing, les audiences et une partie de la mesure des conversions Google Ads ne fonctionnent plus correctement. C'est la conséquence directe du Digital Markets Act.

## Ce que la v2 ajoute

Le Consent Mode transmet aux balises Google l'état du consentement. La version 2 ajoute deux paramètres aux deux existants :

- \`ad_storage\` et \`analytics_storage\` : dépôt de cookies publicitaires et de mesure ;
- \`ad_user_data\` (**nouveau**) : envoi de données utilisateur à Google à des fins publicitaires ;
- \`ad_personalization\` (**nouveau**) : utilisation pour la publicité personnalisée (remarketing).

## Mode basique ou mode avancé ?

**Basique** : les balises Google ne se chargent qu'après acceptation. Rien n'est envoyé en cas de refus. C'est le plus simple à rendre conforme, mais Google ne peut pas modéliser les conversions manquantes.

**Avancé** : les balises se chargent avec un consentement refusé par défaut et envoient des signaux sans cookie. Google modélise alors une partie des conversions des visiteurs qui ont refusé. Plus de données, mais à documenter dans votre politique de confidentialité et à valider avec votre DPO.

## L'ordre compte

L'état par défaut doit être déclaré **avant** toute balise, puis mis à jour quand le visiteur choisit :

\`\`\`
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
\`\`\`

Votre plateforme de consentement (CMP) envoie ensuite la commande \`update\` avec les choix du visiteur. Axeptio, Cookiebot et Didomi le font nativement une fois correctement configurés.

## Les erreurs les plus fréquentes

1. Une balise codée en dur dans le thème, qui part avant la CMP.
2. Un état par défaut déclaré trop tard, après le chargement de Google Tag Manager.
3. Un bouton « Refuser » moins visible que « Accepter » : la CNIL exige qu'il soit aussi simple de refuser que d'accepter.
4. Des pixels tiers (Meta, LinkedIn, TikTok) qui ignorent le Consent Mode : ils doivent être bloqués par la CMP elle-même.

## Comment vérifier

Ouvrez votre site en navigation privée, refusez tout, puis observez l'onglet Réseau : aucune requête publicitaire ne doit déposer de cookie. Dans les requêtes Google, le paramètre \`gcd\` reflète l'état du consentement transmis. Google Tag Assistant affiche aussi l'état par défaut et chaque mise à jour.

> Un consentement mal câblé expose à une sanction CNIL **et** fausse vos statistiques. Les deux se corrigent en même temps.

Notre [Consent Integration](https://stanzafix.com/pricing#consent) installe la CMP, branche le Consent Mode v2 et vous remet un rapport de tests page par page.`,
    category: { key: 'consent', label: { fr: 'Consentement', en: 'Consent' } },
    tags: ['Consent Mode v2', 'RGPD', 'Google Ads', 'CMP'],
    author: { name: 'Rédaction Stanza', role: 'writer', avatar_url: null },
    cover_url: null,
    published_at: '2026-08-28T08:00:00.000Z',
    reading_minutes: 5,
  },
  {
    slug: 'european-accessibility-act-site-concerne',
    lang: 'fr',
    title: "European Accessibility Act : votre site est-il concerné depuis le 28 juin 2025 ?",
    excerpt: "E-commerce, banque, billetterie, livres numériques : l'accessibilité n'est plus réservée au secteur public. Qui est concerné, ce qu'il faut publier et par où commencer.",
    body: `La directive européenne 2019/882, dite **European Accessibility Act** (EAA), s'applique depuis le 28 juin 2025. En France, elle a été transposée par la loi du 9 mars 2023 et son décret d'application d'octobre 2023. Pour la première fois, des entreprises privées doivent rendre leurs services numériques accessibles aux personnes en situation de handicap.

## Qui est concerné ?

Les entreprises qui proposent aux consommateurs, notamment :

- des **sites et applications de commerce en ligne** ;
- des services bancaires ;
- des services de transport (billetterie, information voyageurs) ;
- des livres numériques et les logiciels qui permettent de les lire ;
- des services de communications électroniques.

Les **microentreprises** qui fournissent des services (moins de 10 salariés **et** un chiffre d'affaires ou un bilan annuel de 2 millions d'euros au plus) en sont exemptées. Elles restent encouragées à s'y conformer : l'accessibilité profite à tous vos clients.

## Quel niveau d'exigence ?

En pratique, la référence est la norme européenne EN 301 549, qui reprend les critères **WCAG 2.1 niveau AA**. En France, le RGAA en est la déclinaison opérationnelle. Quelques exemples concrets :

- un contraste d'au moins **4,5:1** pour le texte courant ;
- une alternative textuelle pour chaque image porteuse d'information ;
- un site entièrement **utilisable au clavier**, avec un focus visible ;
- des champs de formulaire étiquetés et des messages d'erreur explicites ;
- des vidéos sous-titrées.

## Ce qu'il faut publier

Le service doit être accompagné d'informations sur la façon dont il répond aux exigences d'accessibilité, en général sous la forme d'une **déclaration d'accessibilité** accessible depuis toutes les pages, et mentionnées dans vos conditions générales. Les contrôles et les éventuelles sanctions relèvent des autorités de surveillance du marché.

## Par où commencer ?

1. **Mesurer** : un diagnostic sur vos parcours clés (accueil, fiche produit, panier, paiement, formulaire de contact) révèle l'essentiel des blocages.
2. **Prioriser** : corrigez d'abord ce qui empêche d'acheter ou de vous contacter.
3. **Documenter** : publiez votre déclaration et un plan d'action daté.
4. **Intégrer** : ajoutez l'accessibilité à la recette de chaque nouvelle page.

> Un outil automatique ne détecte qu'une partie des problèmes. Les tests au clavier et au lecteur d'écran restent indispensables.

Notre [Accessibility Fast-Scan](https://stanzafix.com/pricing#accessibility) analyse vos parcours clés et vous remet une liste priorisée des corrections, prête à transmettre à votre équipe ou à votre agence.`,
    category: { key: 'accessibility', label: { fr: 'Accessibilité', en: 'Accessibility' } },
    tags: ['EAA', 'RGAA', 'WCAG 2.1', 'E-commerce'],
    author: { name: 'Rédaction Stanza', role: 'writer', avatar_url: null },
    cover_url: null,
    published_at: '2026-07-10T08:00:00.000Z',
    reading_minutes: 6,
  },
];
