# CLAUDE.md — Académie de tennis (plateforme de gestion)

Guide pour toute session Claude Code sur ce projet. **À lire en premier.**

## Le projet
Plateforme de gestion **complète** d'une académie de tennis (Lausanne, org Supabase **Katapult SA**).
Grand chantier construit **par couches**. Données sensibles : **mineurs + finances** → sécurité (Auth + RLS, moindre privilège) dès le départ.

## Stack
- **Front** : pages web statiques **responsives mobile** (comme PandaFit) déployées sur **Netlify**.
- **Backend** : **Supabase dédié** (séparé de PandaFit).
  - project_id : `lnrmtwamuaqcubohontn` — région eu-central-1
  - URL : `https://lnrmtwamuaqcubohontn.supabase.co`
  - clé publique : `sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK`
- **Déploiement** : **Git push → Netlify auto-deploy**. Les machines de l'équipe n'ont NI Node/npx, NI CLI, NI token → ne pas tenter de déploiement CLI. Dépôt : `github.com/dahn23/teamlausanne`. Sites Netlify : `teamlausanne.netlify.app` (console + portail) et `lausanneopen.ch` (dossier `open/`).
- **Travail à plusieurs** (Dan + Raphael, chacun sur son Claude Code) : `main` = production. Pour une modif à risque, passer par une **branche + Pull Request** → Netlify génère une **URL de préview** pour tester avant de fusionner. `git pull` avant de commencer. Changements de **schéma DB** = coordonnés (une seule base partagée).

## Rôles (app_role)
`superadmin, admin, secretaire, head_coach, coach, membre, junior, parent, organisateur, officiel` (cumulables). Table `user_roles`. Helper SQL `has_role(uid, role)`.

## Courts (saisonniers)
- **Été** (mi-avril → mi-octobre) : 10 outdoor + 2 indoor = 12.
- **Hiver** (mi-octobre → mi-avril) : 6 indoor, 0 outdoor.
- Modèle : chaque court a `open_summer` / `open_winter`. Helper SQL `season_of(date)`.
- ⚠️ **Config exacte des courts à confirmer avec Dan** avant de seeder (bulle hiver sur des outdoor ?).

## Finances (on REFAIT la facturation — on quitte bexio)
Décision revue : on **construit notre propre facturation** (QR-facture suisse + rapprochement par import **CAMT** ; JAMAIS d'identifiants bancaires côté Claude). L'onglet Finances (console) gère déjà les **heures des coachs/profs** + un sous-onglet Coach (IBAN/tarifs). À venir : budget, banque, export Cresus. (bexio = abandonné ; ignorer les anciennes mentions.)

## Roadmap (3 couches)
1. **Socle** (en cours) : comptes + rôles, fichier people (membres/juniors/parents/staff) + liens parent-junior, **réservation des courts**, cours.
2. **Gestion interne** : finances/factures (**notre facturation maison**, cf. section Finances) + caisse secrétariat ; module **tournoi Lausanne Open** (budget, VIP, to-do).
3. **Intégrations externes** (chacune = chantier + setup/matériel) : banque (API/agrégateur ou import CAMT — JAMAIS d'identifiants bancaires côté Claude), **Gmail/Google Workspace** (OAuth, accès selon droits), réseaux sociaux, **arrosage + capteurs d'humidité**, **serrures connectées**.

## État
- Schéma socle **appliqué** : `db/01_socle.sql`.
- Courts **seedés** (`db/02_seed_courts.sql`) : 10 outdoor (courts 1-4 sous bulle l'hiver) + 2 indoor fixes = 12 été / 6 hiver.
- **RLS par rôle appliquée** (`db/03_rls.sql`) : helpers `is_admin`/`is_staff` ; courts en lecture pour tout connecté ; réservations lisibles par tous, créées/annulées par leur auteur ou le staff ; `people` réservé au staff + sa propre fiche.
- **Anti-chevauchement** (`db/04_no_overlap.sql`) : impossible de double-réserver un court.
- **Architecture front = 3 surfaces** :
  - **Site public** (`index.html`/`index.js`) : vitrine + connexion. Aiguillage par rôle à la connexion (`landingFor(roles)` dans `common.js`).
  - **Réservation** (`reservation.html`/`reservation.js`) : grille des courts, **publique** (visible sans login ; login requis pour réserver), filtre saison auto.
  - **Console** (`admin.html`/`admin.js`) : staff/encadrement. Servie sur **`/console`** (réécriture Netlify ; `/admin` → 301 vers `/console`). Entête dynamique selon le rôle (Console / Espace coach / Espace prof / Espace mental).
  - **Portail membre** (`espace.html`/`espace.js`) : app jeunes/parents (« Mon espace »), **PWA installable**.
  - `common.js` = client Supabase + gardes/aiguillage. `config.js` = URL + clé publiable. `style.css` = tout le style. `pretty-select.js` / `pretty-date.js` = embellissent selects et champs date. `sw.js` = service worker (PWA). `netlify.toml` = déploiement statique.
- **Comptes de test / réels** : voir la note mémoire `comptes-test-acces` (superadmin `dan.hafner23@gmail.com`, + secrétaire/admin/coach réels). Création d'un compte = **via SQL** (piège GoTrue : colonnes token à `''`) tant que l'edge function d'invitation n'existe pas.

## Modules construits (carte pour une nouvelle session)
Tout est dans la **console** (`admin.html`) sauf mention, menu latéral groupé. Les migrations SQL sont dans `db/`.
- **Membres / CRM** : fiche `people`, rôles/tags **cumulables**. ⚠️ **3 tables de rôles** : `person_roles` (chips de la fiche) · `user_roles` (accès réel, lu par RLS/`myRoles`) · `role_periods` (rôle de filière **par saison** : kidstennis/club/competition/performance/sport-etudes/pro/pro-u18/adultes). La fiche **synchronise** l'accès (`syncAccessRoles` : person_roles → user_roles).
- **Réservation** + **Cours** (Planning + Types de cours) : leçons au ¼h qui **bloquent les courts**, présences, copier-semaine, sélecteur de joueurs par filière (+ adultes).
- **Stages** (camps) · **GameZone** (tournois juniors + caisse + site public classement) · **Tests physiques** · **Feuille de match** (coach côté console / joueur côté portail).
- **Suivi du jeune unifié** : un seul fil `youth_notes` avec badges de rôle (remplace les canaux Mental/Études séparés). Calendriers **Mental** et **Études** par saison.
- **Prospects** (scouting) · **Inscriptions** (formulaire public → onglet console) · **Finances** (voir section dédiée).
- **Couche 3 (squelettes)** : **Arrosage** et **Serrures** (onglets + edge functions *mock* à brancher sur le vrai matériel plus tard).
- **Saisons / annualité** : `role_periods` = source de vérité de l'historique par saison ; onglet Saisons dans la fiche.

## Conventions techniques (pièges à connaître)
- **CSS cache-bust** : `style.css?v=N` est incrémenté à **chaque** changement CSS, sur **tous** les HTML. (Sinon les navigateurs gardent l'ancien style.)
- **Champs date** : `pretty-date.js` cache l'`<input type=date>` natif et affiche un widget `.pd-wrap`. Pour contraindre sa largeur, viser `.pd-wrap`, pas l'input natif.
- **Selects de saison** : après avoir réinjecté les `<option>`, **forcer** `el.value = …` (sinon pretty-select n'applique pas la valeur au 1er rendu).
- **Encodage** : éditer les fichiers avec les outils d'édition — **ne jamais réécrire les HTML via PowerShell `Set-Content`** (ça ajoute un BOM et double-encode les accents). Avant de committer, vérifier qu'aucun HTML n'a pris de BOM.
- **Commits en français**, finir par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Conventions
- Français, réponses concises et décisives.
- Autorisations : régler des règles **larges** d'emblée, ne pas faire réautoriser Dan sans cesse.
- Dan n'est pas développeur pur : expliquer simplement.

## Lausanne Open — Player Hub (app des joueurs du tournoi)
App mobile pour les joueurs de l'ITF M25 Lausanne Open. **Site Netlify séparé** :
les joueurs ne doivent pas tomber sur teamlausanne.netlify.app.

- **Code** : dossier `open/` du même dépôt, **totalement autonome**
  (`index.html` = app joueurs, `admin.html` = backend, `app.js`, `admin.js`,
  `style.css`, `sb.js` = client Supabase local, `assets/`, `netlify.toml`).
  Ne jamais y importer `common.js`/`config.js` de la racine : l'autre site ne les sert pas.
- **Déploiement** : 2ᵉ site Netlify sur le même dépôt GitHub, **base directory = `open`**.
  → app joueurs à la racine du site, backend sur `/admin`. Un seul `git push` déploie les deux sites.
- **Langue** : app joueurs en **anglais**, backend en **français**.
- **Base** : `db/06_lausanne_open.sql`, tables `lo_*`, **même projet Supabase**.
  Lecture publique (anon), **aucune policy d'écriture** : tout passe par des fonctions
  SECURITY DEFINER (`lo_book_practice`, `lo_post`, `lo_admin`, `lo_admin_list`).
  Mot de passe du backend en hash bcrypt dans `lo_secret` (RLS sans policy = illisible).
- **7 onglets** joueurs : Welcome (6 sous-onglets), Official info, Hotel & Food
  (hôtel/navette/restaurant), Order of play (PDF par jour, stocké en base64),
  Practice (grille courts × créneaux, `visible_from` pour ouvrir la veille à 18h),
  Sparring, Roommate. Chaque onglet est **blocable** depuis le backend.
- **5 langues** : EN/FR/DE/IT/ES. `open/i18n.js` = libelles d interface + drapeaux SVG ; `open/content.js` = contenu des pages Welcome, ecrit en DONNEES (titres, listes, kv) et pas en HTML -> traduire = traduire du texte. Langue detectee au 1er lancement puis memorisee. Le contenu venu du backend nest PAS traduit.
- **Photos** : `open/assets/visit/*.jpg` (Wikimedia Commons, licences libres, credits affiches). Une carte sans photo bascule sur un degrade + icone en filigrane : rien ne casse si un fichier manque. Manquent : `cathedral.jpg` et `evening.jpg`.
- Barre donglets = **grille** (pas de defilement) : icone + libelle court sur 2 lignes max.
