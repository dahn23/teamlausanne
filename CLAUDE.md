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
- Schéma socle **appliqué** : `db/01_socle.sql` (people, profiles, user_roles, guardianships, courts, court_bookings, lessons, lesson_enrollments + helpers + RLS activé).
- **À faire ensuite** : règles RLS détaillées par rôle, seed des courts, 1er écran (login + grille de réservation des courts), dépôt GitHub + site Netlify.

## Conventions
- Français, réponses concises et décisives.
- Autorisations : régler des règles **larges** d'emblée, ne pas faire réautoriser Dan sans cesse.
- Dan n'est pas développeur pur : expliquer simplement.
