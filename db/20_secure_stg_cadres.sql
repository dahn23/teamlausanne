-- 20_secure_stg_cadres.sql
-- Alerte CRITIQUE de l'advisor Supabase (31/08/2026) : "Table publicly accessible"
-- sur stg_cadres (rls_disabled_in_public). La table contient des donnees personnelles
-- sensibles (nom, naissance, AVS, adresse, parent, email, tel) et avait la RLS DESACTIVEE
-- => lisible/modifiable/supprimable par n'importe qui avec la cle publique.
-- Table de staging/import (J+S) NON utilisee par le front (aucune reference dans le code).
-- Fix non destructif : RLS activee SANS policy => plus aucun acces anon/authenticated ;
-- seul le service_role (edge/SQL) y accede. Donnees conservees.
alter table public.stg_cadres enable row level security;
revoke all on table public.stg_cadres from anon, authenticated;

-- Puis, apres confirmation de Dan : la table etant vide (0 ligne) et sans dependance,
-- on la SUPPRIME carrement (import J+S termine, plus aucune raison de garder ces donnees perso).
drop table if exists public.stg_cadres;
