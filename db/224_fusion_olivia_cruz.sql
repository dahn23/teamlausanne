-- 224 — Fusion des deux fiches d'Olivia Cruz (05.11.2026).
--
-- La même enfant existait deux fois, les deux avec l'adresse fatimiu@gmail.com :
--   · À GARDER   c59353af-2ffd-452d-80ba-aa757dc83b84  « Olivia Cruz »       créée le 04.08.2026
--                photo, téléphone, adresse, Parent 1, 8 cours, 7 présences,
--                1 remarque de cours, 1 média, filière kidstennis 2026/27,
--                facture 2026-0138 (490.00, annulée).
--   · DOUBLON    44032aed-b3d6-4843-91ea-a59853d580d1  « Olivia Cruz Amaya » créée le 01.10.2026
--                née de l'inscription publique au stage d'automne. Fiche vide
--                par ailleurs (ni photo, ni adresse, ni téléphone).
--
-- Le doublon ne portait PAS que le stage. Il portait aussi une facture PAYÉE.
-- Or out_invoices.person_id est en SET NULL : une suppression sans précaution
-- n'aurait rien signalé — la facture serait restée en base, simplement
-- détachée de l'enfant, et plus personne n'aurait su à qui elle se rapportait.
-- D'où le déplacement explicite ci-dessous, et le garde-fou avant le DELETE.
--
-- Trois choses déplacées :
--   1. l'inscription au stage d'automne (semaine 1, 12→16.10.2026) ;
--   2. la facture 2026-0313 (250.00, payée) — ses deux liens, person_id et
--      debtor_person_id ;
--   3. la pastille de rôle « stage ».
--
-- NON modifié, volontairement : out_invoices.debtor_name reste « Olivia Cruz
-- Amaya » et le nom saisi sur l'inscription aussi. Une facture émise et payée
-- est une pièce comptable : on recolle son lien vers la bonne fiche, on ne
-- réécrit pas ce qui était imprimé dessus.

begin;

-- ---- 1. L'inscription au stage ----
update stage_registrations
   set person_id = 'c59353af-2ffd-452d-80ba-aa757dc83b84'
 where person_id = '44032aed-b3d6-4843-91ea-a59853d580d1';

-- ---- 2. La facture payée (les deux liens) ----
update out_invoices
   set person_id = 'c59353af-2ffd-452d-80ba-aa757dc83b84'
 where person_id = '44032aed-b3d6-4843-91ea-a59853d580d1';

update out_invoices
   set debtor_person_id = 'c59353af-2ffd-452d-80ba-aa757dc83b84'
 where debtor_person_id = '44032aed-b3d6-4843-91ea-a59853d580d1';

-- ---- 3. La pastille « stage » (sans doublonner si la fiche l'a déjà) ----
insert into person_roles (person_id, role)
select 'c59353af-2ffd-452d-80ba-aa757dc83b84', pr.role
  from person_roles pr
 where pr.person_id = '44032aed-b3d6-4843-91ea-a59853d580d1'
   and not exists (select 1 from person_roles k
                    where k.person_id = 'c59353af-2ffd-452d-80ba-aa757dc83b84'
                      and k.role = pr.role);

-- ---- Garde-fou : rien de précieux ne doit plus pendre au doublon ----
-- Les tables en SET NULL sont les dangereuses : elles se laissent supprimer
-- sans bruit en laissant une ligne orpheline. On refuse de continuer si l'une
-- d'elles pointe encore sur le doublon.
do $$
declare n integer;
begin
  select (select count(*) from stage_registrations where person_id = '44032aed-b3d6-4843-91ea-a59853d580d1')
       + (select count(*) from out_invoices where person_id = '44032aed-b3d6-4843-91ea-a59853d580d1')
       + (select count(*) from out_invoices where debtor_person_id = '44032aed-b3d6-4843-91ea-a59853d580d1')
       + (select count(*) from profiles where person_id = '44032aed-b3d6-4843-91ea-a59853d580d1')
       + (select count(*) from gz_participants where person_id = '44032aed-b3d6-4843-91ea-a59853d580d1')
       + (select count(*) from player_matches where person_id = '44032aed-b3d6-4843-91ea-a59853d580d1')
    into n;
  if n > 0 then
    raise exception 'Fusion interrompue : % référence(s) pendent encore au doublon. Rien n''a été supprimé.', n;
  end if;
end $$;

-- ---- Suppression du doublon ----
-- Ne reste que la pastille de rôle, recopiée ci-dessus : elle part en cascade.
delete from people where id = '44032aed-b3d6-4843-91ea-a59853d580d1';

commit;
