-- 233 — Passerelle Prospects › Suivi ↔ Répertoire (09.11.2026)
--
-- Demande de Raphael : une famille repérée dans le répertoire doit pouvoir
-- passer en prospection, et un prospect qui s'inscrit doit devenir une fiche.
-- Dans les deux sens, sans ressaisir.
--
-- Les deux lignes COEXISTENT et se relient, elles ne se remplacent pas. Le
-- suivi raconte comment la famille est arrivée — la source, les échanges, le
-- programme visé ; la fiche porte sa vie au club. Supprimer le suivi à la
-- conversion aurait vidé l'entonnoir de ses inscrits, c'est-à-dire du seul
-- chiffre qui dit si la prospection sert à quelque chose.
--
-- « on delete set null » et non « cascade » : si la fiche est supprimée, le
-- suivi reste. L'historique de prospection ne doit pas partir avec une fiche
-- effacée par erreur.

alter table public.prospect_followups
  add column if not exists person_id uuid references public.people(id) on delete set null;

create index if not exists pf_person on public.prospect_followups (person_id)
  where person_id is not null;

comment on column public.prospect_followups.person_id is
  'Fiche du repertoire correspondante, quand la famille a ete convertie (ou qu''elle venait de la). Les deux lignes coexistent.';

-- ---------------------------------------------------------------------------
-- CE QUI SE JOUE CÔTÉ CONSOLE, et qu'il faut savoir avant d'y toucher.
--
-- Avant de créer une fiche depuis un suivi, admin.js cherche si la personne
-- existe déjà (fichePossible). La règle a été écrite APRÈS l'avoir essayée
-- sur les 17 suivis réels, et le premier jet était faux :
--
--   rapprocher par e-mail seul donnait 5 correspondances, dont 3 FAUSSES :
--   deux fois un enfant relié à la fiche de son frère, une fois à une famille
--   entièrement différente. Dans une famille, tout le monde partage l'adresse
--   des parents : un e-mail ne désigne personne.
--   (Les noms restent en base — des mineurs n'ont rien à faire dans un dépôt.
--    La requête ci-dessous les retrouve en deux secondes si besoin.)
--
-- La règle retenue :
--   · le numéro de licence seul fait foi (il est par joueur) ;
--   · l'e-mail ne compte que si le prénom ET le nom concordent aussi ;
--   · le nom seul est proposé, mais annoncé comme le plus faible des trois ;
--   · plusieurs fiches du même nom → on ne propose rien, l'humain va voir.
--
-- Rejouée sur les mêmes 17 suivis : 4 rapprochements, tous justes.
--
-- Pour la rejouer un jour :
--   select coalesce(f.first_name,'')||' '||coalesce(f.last_name,'') as suivi,
--     (select count(*) from people p where p.license_no ilike f.license_no) as par_licence,
--     (select count(*) from people p where p.email ilike f.email
--        and lower(p.first_name)=lower(f.first_name) and lower(p.last_name)=lower(f.last_name)) as par_email_et_nom,
--     (select count(*) from people p where lower(p.first_name)=lower(f.first_name)
--        and lower(p.last_name)=lower(f.last_name)) as par_nom
--   from prospect_followups f order by suivi;
--
-- Droits : écrire dans prospect_followups = can_prospects (superadmin, admin,
-- head_coach, secrétariat) ; écrire dans people = is_admin ou secrétariat. Un
-- head coach voit donc le Suivi mais ne peut pas créer de fiche — le bouton ne
-- lui est pas affiché, plutôt que de lui servir une erreur de la base.
