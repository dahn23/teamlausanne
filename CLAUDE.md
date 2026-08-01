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
- **Déploiement** : **Git push → Netlify auto-deploy**. La machine de Dan n'a NI Node/npx, NI CLI, NI token → ne pas tenter de déploiement CLI. (dépôt GitHub + site Netlify : à créer.)

## Rôles (app_role)
`superadmin, admin, secretaire, head_coach, coach, membre, junior, parent, organisateur, officiel` (cumulables). Table `user_roles`. Helper SQL `has_role(uid, role)`.

## Courts (saisonniers)
- **Été** (mi-avril → mi-octobre) : 10 outdoor + 2 indoor = 12.
- **Hiver** (mi-octobre → mi-avril) : 6 indoor, 0 outdoor.
- Modèle : chaque court a `open_summer` / `open_winter`. Helper SQL `season_of(date)`.
- ⚠️ **Config exacte des courts à confirmer avec Dan** avant de seeder (bulle hiver sur des outdoor ?).

## Finances = bexio (ne PAS réinventer)
Académie facture via **bexio** (facturation + vérif « payé » par connecteur). On se **connecte à l'API bexio** (contacts, factures, statut de paiement). Lien : `people.bexio_contact_id`. Caisse secrétariat + budget tournoi = construits chez nous.

## Roadmap (3 couches)
1. **Socle** (en cours) : comptes + rôles, fichier people (membres/juniors/parents/staff) + liens parent-junior, **réservation des courts**, cours.
2. **Gestion interne** : finances/factures (bexio) + caisse secrétariat ; module **tournoi Lausanne Open** (budget, VIP, to-do).
3. **Intégrations externes** (chacune = chantier + setup/matériel) : banque (API/agrégateur ou import CAMT — JAMAIS d'identifiants bancaires côté Claude), **Gmail/Google Workspace** (OAuth, accès selon droits), réseaux sociaux, **arrosage + capteurs d'humidité**, **serrures connectées**.

## État
- Schéma socle **appliqué** : `db/01_socle.sql`.
- Courts **seedés** (`db/02_seed_courts.sql`) : 10 outdoor (courts 1-4 sous bulle l'hiver) + 2 indoor fixes = 12 été / 6 hiver.
- **RLS par rôle appliquée** (`db/03_rls.sql`) : helpers `is_admin`/`is_staff` ; courts en lecture pour tout connecté ; réservations lisibles par tous, créées/annulées par leur auteur ou le staff ; `people` réservé au staff + sa propre fiche.
- **Anti-chevauchement** (`db/04_no_overlap.sql`) : impossible de double-réserver un court.
- **Architecture front = 2 surfaces distinctes** :
  - **Site public** (`index.html`/`index.js`) : infos académie + fenêtre de connexion → redirige les membres vers la réservation.
  - **Réservation** (`reservation.html`/`reservation.js`) : grille des courts, login membre requis, filtre saison auto ; lien « Console admin » visible si staff.
  - **Console admin** (`admin.html`/`admin.js`) : réservée au staff (garde de rôle), 1er module = **CRM membres** (liste + ajout/édition/suppression de `people`). Menu latéral avec Finances/Cours « bientôt ».
  - `common.js` = client Supabase + gardes d'accès partagés. `config.js` = URL + clé publiable. `style.css` = tout le style. `netlify.toml` = déploiement statique.
- **En ligne** : `https://teamlausanne.netlify.app` (Netlify auto-deploy sur push, Pretty URLs actif). Parcours complet testé OK (login → réservation → admin → création membre sous RLS).
- **Compte de test superadmin** : `dan.hafner23@gmail.com` / `TeamLausanne1!` (créé en SQL, email confirmé).
- Dépôt GitHub : `github.com/dahn23/teamlausanne`.
- **À faire ensuite** : (1) **Comptes & rôles** = donner un login aux membres + attribuer les rôles → nécessite une **edge function** Supabase (service role, jamais côté front) pour créer/inviter les comptes ; écran de gestion des rôles dans l'admin. (2) Liens parent↔junior dans le CRM. (3) Module **Cours** (lessons + inscriptions). (4) Contenu réel du site public (adresse, horaires, photos). (5) Couche 2 (bexio, caisse, tournoi).

## Conventions
- Français, réponses concises et décisives.
- Autorisations : régler des règles **larges** d'emblée, ne pas faire réautoriser Dan sans cesse.
- Dan n'est pas développeur pur : expliquer simplement.
