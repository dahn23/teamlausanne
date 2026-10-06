-- 135 — Un accès GameZone en lecture seule, et Séline Rivaroli l'obtient.
--
-- Demande de Raphael le 06.10.2026 : Séline doit voir l'onglet GameZone — les
-- participants, les vainqueurs, l'info — sans rien pouvoir changer.
--
-- Les deux rôles existants ne faisaient ni l'un ni l'autre :
--   · organisateur  → tout GameZone en écriture, caisse et réglages compris ;
--   · responsable   → le seul sous-onglet Tournois, et uniquement les
--                     tournois où la personne est nommée (gz_managers) —
--                     donc un onglet vide tant qu'elle n'est nommée nulle part.
--
-- D'où un troisième rôle : gz_lecture. Il ouvre l'onglet et tous ses
-- sous-onglets, sans aucune commande d'écriture dans l'interface.
--
-- ⚠️ À SAVOIR, et ce n'est pas un détail : ce rôle est un garde-fou
-- d'interface, PAS un verrou. Presque toutes les tables gz_* portent une
-- policy « ALL » ouverte à is_staff(), et is_staff() comprend secretaire,
-- moniteur, coach, coach_physique et head_coach. Séline étant secrétaire et
-- monitrice, la base l'autorise déjà à écrire partout dans GameZone — seul
-- l'onglet caché l'en empêchait. Le rôle gz_lecture évite donc la
-- modification *accidentelle*, il n'interdit pas la modification *voulue*.
--
-- Resserrer ces policies demanderait de savoir qui doit vraiment écrire quoi :
-- le secrétariat tient légitimement la caisse GameZone (gz_caisse_ledger lui
-- est ouvert nommément), et passer is_staff en lecture seule casserait ce
-- travail. À reprendre avec Dan si un vrai verrou est voulu, table par table.

alter type public.app_role add value if not exists 'gz_lecture';

-- ---------------------------------------------------------------------------
-- Séline Rivaroli : secrétaire + monitrice + coach mental, et maintenant
-- GameZone en lecture. Le chip de la fiche et le rôle d'accès, les deux :
-- la fiche est ce que l'équipe lit, user_roles ce que la console applique.

begin;

insert into public.person_roles (person_id, role)
values ('4d6083e5-413f-4072-ad40-7a83be675ba2', 'gz-lecture')
on conflict do nothing;

insert into public.user_roles (user_id, role)
select '21c6acc5-abc9-4b5a-945f-7b03ac96dec7'::uuid, 'gz_lecture'::public.app_role
on conflict do nothing;

commit;
