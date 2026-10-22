# Hemicycle

Site qui suit les votes nominatifs du Parlement européen depuis juillet 2024, eurodéputé par eurodéputé.

- **Navigation** : chaque rubrique du menu s'ouvre sur ses sous-rubriques (menu déroulant sur ordinateur, barre de sous-rubriques en haut de chaque page)
- **Accueil** : composition de l'hémicycle, les derniers votes finaux
- **Eurodéputés** : les 745 élus de la législature, filtrables par pays et groupe, triables par présence et fidélité au groupe
- **Fiche eurodéputé** : présence, fidélité au groupe, votes contre son groupe, et la liste de tous ses votes
  (filtres par thème, position, votes « dissidents », recherche)
- **Votes** : les 6 000+ votes, filtrables par thème, pays concerné, résultat, année
- **Fiche vote** : une explication « En bref » en langage courant (ce qui est voté, la portée du texte, ce que change le résultat, qui a voté quoi), résultat, hémicycle coloré siège par siège, détail par groupe et par pays,
  liste complète, liens vers les textes officiels
- **Hémicycle cliquable** : un clic sur un siège ouvre la fiche rapide de l'eurodéputé
- **Biographie et parcours** de chaque élu (mandats, formation, professions, partis, courants politiques), chargés
  depuis Wikipédia et Wikidata au moment de la visite, et ses **positions par thème**
- **Classements** (présence, votes contre son groupe), **votes les plus serrés**, **qui vote avec qui** entre groupes
- **Groupes politiques** et **comparateur** : taux d'accord entre deux eurodéputés et votes où ils se sont opposés
- **Archives** : les dix législatures depuis 1979 ; au survol, chacune déploie son hémicycle et ses chiffres clés.
  2019–2024 : votes finaux, eurodéputés, groupes ; 1979–2019 : hémicycle au début du mandat et liste complète des eurodéputés
- Disponible en anglais (par défaut), français et néerlandais, via le menu à drapeau en haut à droite
- **Thèmes** : 12 grands sujets (climat, migration, Ukraine…), avec la position de chaque groupe et les votes les plus serrés
- **Pays** : chaque délégation nationale, sa composition, ses votes les plus divisés et ceux où elle s'est opposée à la majorité
- **Agenda** : les prochaines sessions plénières et, dès sa publication, l'ordre du jour (textes à voter, débats), mis à jour chaque jour
- **Partis nationaux** : une page par parti (ses élus, sa cohésion, son accord avec son groupe, ses votes à contre-courant)
- **Carte d'Europe** sur chaque vote, colorée selon le vote de chaque délégation
- **Bilan de chaque session** : ce qui a été adopté ou rejeté, les votes serrés, la position des groupes
- **Intégration** : un code à copier pour afficher l'hémicycle d'un vote sur un autre site (menu Partager → Intégrer)
- **Guide** : comment fonctionne le Parlement et comment lire les chiffres du site
- **Analyses** : dernière session plénière à l'accueil, vote par parti national et parcours du texte sur chaque vote,
  présence mois par mois sur chaque fiche, majorités gagnantes, cohésion mois par mois et changements de groupe
- **Outils** : export CSV des listes, flux RSS (derniers votes finaux, votes de chaque eurodéputé), installable comme une application
- Thème clair ou sombre (automatique ou au choix avec le bouton en haut), adapté au téléphone

Le site est **statique** : de simples fichiers HTML, CSS, JS et JSON. Pas de serveur, pas de base de données,
hébergement gratuit.

## Voir le site sur votre ordinateur

Il faut [Node.js](https://nodejs.org) (version LTS). Dans le dossier `hemicycle` :

```
node serve.js
```

puis ouvrez <http://localhost:8080>.
(Ouvrir `index.html` en double-cliquant ne marche pas : le navigateur bloque la lecture des données.)

## Le mettre en ligne gratuitement (GitHub Pages)

1. Créez un compte sur <https://github.com>.
2. Créez un nouveau dépôt public, par exemple `hemicycle` (bouton **New repository**).
3. Envoyez-y le contenu du dossier `hemicycle` : le plus simple est [GitHub Desktop](https://desktop.github.com)
   (« Add local repository », puis « Publish repository »). Le glisser-déposer sur le site web marche aussi,
   mais il est limité à 100 fichiers par envoi.
4. Dans le dépôt : **Settings → Pages → Source : GitHub Actions**.
5. Onglet **Actions** → « Mise à jour et publication » → **Run workflow**.

Quelques minutes plus tard, le site est en ligne à l'adresse `https://votre-pseudo.github.io/hemicycle/`.
Ensuite, **chaque samedi**, les nouveaux votes sont téléchargés et le site se met à jour tout seul.

Alternatives : Netlify ou Cloudflare Pages (glisser-déposer le dossier `site`), mais sans la mise à jour
automatique.

## Agenda des sessions plénières

`scripts/build-agenda.js` récupère chaque jour les dates des prochaines sessions (HowTheyVote.eu) et l'ordre du jour
provisoire publié par le Parlement européen (API de données ouvertes), et écrit `site/data/agenda.json`.
Le fichier livré contient un aperçu relevé à la main ; il est remplacé dès le premier passage du workflow.
À la main : `node scripts/build-agenda.js site/data/agenda.json`.

## Application (mise de côté pour le lancement)

La version « application » (installation sur l'écran d'accueil, hors connexion, barre d'onglets en bas) est
**désactivée** : le site est lancé comme un site web classique. Le code est gardé pour plus tard
(`site/sw.js`, `site/manifest.webmanifest`, partie « application » de `site/app.js`).

Pour la réactiver : `window.HEMI_APP = true` dans `site/about.js`, et remettre dans `site/index.html`
la ligne `<link rel="manifest" href="manifest.webmanifest">` (avec les balises `apple-mobile-web-app-capable`).

## Avant le lancement (à faire une fois)

1. **Adresse de contact** : indiquez-la en haut de `site/about.js` (`window.HEMI_CONTACT = 'vous@exemple.eu'`).
   Elle s'affichera sur la page « À propos ». Les mentions légales y sont déjà rédigées.
   **Compteur de visites (facultatif)** : créez un compte gratuit sur goatcounter.com (par exemple « hemicycle »),
   puis indiquez son code juste en dessous : `window.HEMI_STATS = 'hemicycle'`. La page Vie privée s'adapte toute seule.
2. **Nom de domaine `hemicycle.be` (OVHcloud)** : dans l'espace client OVH, **Web Cloud → Noms de domaine →
   hemicycle.be → Zone DNS** :
   - supprimez les enregistrements `A` et `AAAA` du domaine nu (`hemicycle.be.`) et le `CNAME`/`A` de `www`
     créés par OVH ;
   - ajoutez quatre enregistrements `A` (sous-domaine vide) vers 185.199.108.153, 185.199.109.153,
     185.199.110.153 et 185.199.111.153, et un `CNAME` `www` vers `votre-nom.github.io.` ;
   - **ne touchez pas** aux enregistrements `MX`, `SPF` (TXT) ni `autoconfig`/`autodiscover` : ce sont ceux
     de l'adresse e-mail.
3. Sur GitHub : **Settings → Pages → Custom domain**, saisissez le domaine, puis cochez **Enforce HTTPS**
   (le certificat est gratuit et automatique, comptez jusqu'à une heure).
4. Sur GitHub : **Settings → Secrets and variables → Actions → Variables → New repository variable**,
   nom `SITE_URL`, valeur `https://hemicycle.be`. Puis relancez le workflow (**Actions → Run workflow**) : les liens de partage, le sitemap et les flux RSS
   utiliseront la nouvelle adresse.
5. **Google** : ajoutez le site dans [Google Search Console](https://search.google.com/search-console)
   et soumettez `https://votre-domaine/sitemap.xml`. Faites de même sur [Bing Webmaster Tools](https://www.bing.com/webmasters).

Ce que la publication fait déjà automatiquement : scripts et styles minifiés et versionnés (les visiteurs
reçoivent toujours la dernière version), police hébergée sur le site (aucune requête vers Google), page 404,
pages statiques et images de partage pour chaque eurodéputé, vote final, thème, pays et parti, sitemap,
robots.txt, flux RSS et données structurées pour les moteurs de recherche.

## Référencement Google et partage

À chaque publication, `scripts/build-pages.js` crée une vraie page par eurodéputé et par vote final
(`depute/<id>/`, `vote/<id>/`, et `archive/9/…` pour 2019–2024), avec son titre, sa description et
son image d'aperçu (`og/…png`), ainsi que `sitemap.xml` et `robots.txt`. Google peut ainsi trouver
chaque fiche, et un lien partagé sur WhatsApp, LinkedIn ou X affiche un aperçu propre à la page.
Le bouton « Partager » des fiches utilise ces adresses.

Pour tester ce site complet sur votre ordinateur :

```
npm install
SITE_URL=http://localhost:8080 node scripts/build-pages.js site _site
ROOT=_site node serve.js
```

Sur GitHub, rien à faire : l'adresse publique (y compris un nom de domaine personnalisé comme
`myhemicycle.eu`, réglé dans **Settings → Pages → Custom domain**) est détectée automatiquement.
Pensez ensuite à déclarer le site dans [Google Search Console](https://search.google.com/search-console)
et à y soumettre `sitemap.xml`.

## Mettre à jour les données à la main

```
curl -L -o export.zip https://github.com/HowTheyVote/data/releases/latest/download/export.zip
unzip export.zip -d export
node scripts/build-data.js export site/data --term 10
node scripts/build-data.js export site/data/t9 --term 9 --main-only   # archives 2019–2024
```

Les législatures 1979–2019 ne changent plus ; leur fichier a été généré une fois avec
`scripts/build-old-terms.py` (voir l'en-tête du script).

## Personnaliser

- Le nom de l'auteur figure dans le pied de page (`site/index.html`).
- Couleurs et polices : variables en haut de `site/styles.css`.

## Organisation

```
site/
  index.html, styles.css, app.js   le site
  data/meta.json                   pays, groupes, thèmes, date de mise à jour
  data/members.json                eurodéputés et indicateurs calculés
  data/votes.json                  liste des votes
  data/v/<id>.json                 position de chaque eurodéputé pour un vote
  data/m/<id>.json                 tous les votes d'un eurodéputé
  data/t9/                         mêmes fichiers pour la législature 2019–2024 (votes finaux)
  data/old.json                    eurodéputés et groupes des législatures 1979–2019
  groups-info.js                   présentation des groupes politiques actuels
  groups-old.js                    présentation des groupes politiques de 1979 à 2019
  i18n.js                          textes en français, anglais et néerlandais
  explain.js                       explications « En bref » des votes, dans les trois langues
scripts/build-data.js              transforme l'export CSV en ces fichiers JSON
scripts/build-pages.js             pages statiques, images de partage, sitemap (dossier _site/)
serve.js                           serveur local pour tester
.github/workflows/                 mise à jour hebdomadaire et publication
```

## Sources et licence des données

- Carte : Natural Earth (domaine public), via le paquet world-atlas ; générée une fois dans `site/europe.js`.

- Votes : [HowTheyVote.eu](https://howtheyvote.eu), sous licence Open Database License (ODbL 1.0).
  La licence impose de citer la source (fait dans le pied de page)
  et de garder les données dérivées sous la même licence.
- Eurodéputés 1979–2019 : jeu de données [meps](https://github.com/expersso/meps) d'E. Persson et al. (licence MIT),
  établi à partir du site du Parlement européen.
- Biographies : Wikipédia (licence CC BY-SA 4.0) et Wikidata (domaine public), chargées en direct par le
  navigateur du visiteur. La source est citée sous chaque biographie.
- Photos : site du Parlement européen, © Union européenne, réutilisation autorisée avec mention de la source.
- Les indicateurs (présence, fidélité, cohésion) sont calculés par `scripts/build-data.js` ; la méthode est
  expliquée dans les notes du site.
