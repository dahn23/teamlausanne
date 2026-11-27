# Site du club — Lausanne-Sports Tennis (BROUILLON)

Atelier pour reprendre le site du club que Dan avait commencé, avant de le
mettre en ligne. **Rien ici n'est public** : `noindex` dans la page, dans
`netlify.toml` et dans `robots.txt`, et le site Netlify est protégé par mot
de passe.

## D'où ça vient
De l'ancienne vitrine de la racine du dépôt (`index.html` / `index.js`), qui
portait quatre mondes : Club, Academy, Lausanne Open, Business. Elle n'est
plus servie — `app.teamlausanne.ch` redirige tout vers la page de connexion.
Seul le monde **Club** a été repris ici ; l'académie et le tournoi ont leur
propre site et sont de simples liens sortants, pour ne pas publier deux fois
le même contenu.

## Ce qui a été retiré, et pourquoi
- **La connexion.** Les comptes et la réservation vivent dans l'application :
  « Réserver un court » renvoie vers `app.teamlausanne.ch`. Un second écran
  de login sur un second domaine, c'est un mot de passe perdu de plus.
- **Les stages et la GameZone.** Ce sont des écrans de l'académie.
- `common.js` / `config.js` de la racine ne sont **jamais** importés : ce
  dossier est publié seul (base directory = `club`), l'autre site ne les sert
  pas. Même règle que `open/` — cf. CLAUDE.md.

## Mise en ligne, le jour venu
1. Retirer `<meta name="robots" content="noindex">` de `index.html`.
2. Retirer la règle `X-Robots-Tag` de `netlify.toml`.
3. Supprimer `robots.txt`.
4. Retirer le mot de passe du site dans Netlify.
5. Brancher le domaine.

## Ce qui reste à faire
- **Le contenu est figé là où Dan s'est arrêté** : l'agenda annonce « 2 mai
  Apéro d'ouverture » et « 23–30 août Lausanne Open » sans année, l'histoire
  s'arrête en 2004, le comité et les horaires du restaurant sont à vérifier.
- **Les entrées du menu déroulant ne descendent pas toujours** jusqu'à leur
  section. Deux causes trouvées et corrigées (le `querySelector` tombait sur
  le lien du menu, qui porte lui aussi `data-anchor` ; et la page grandit
  après le rendu, d'où `allerAAncre` qui vise trois fois) — il en reste une
  troisième, non identifiée : depuis le menu, Comité, Restaurant et Contact
  ne bougent pas, alors que viser la même section à la main fonctionne.
- `style.css` est la feuille **entière** du projet (460 Ko) : elle porte la
  console et les trois sites. À dégraisser si ce site part pour de bon.
