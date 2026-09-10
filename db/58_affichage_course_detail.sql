-- 58_affichage_course_detail.sql
-- Detail d'un cours pour l'ecran du club : encadrants et joueurs, NOMS SEULEMENT.
--
-- Pourquoi une fonction et pas un elargissement de people_read_affichage :
-- la RLS filtre les LIGNES, pas les COLONNES. Donner acces aux lignes des
-- enfants exposerait avs, address, parent1, parent2, phone, email — et pour les
-- encadrants, iban et salary_monthly. Un poste en libre acces dans le club ne
-- doit rien voir de tout cela. Cette fonction ne renvoie que « Nom Prenom ».
create or replace function public.affichage_course_detail(p_course uuid)
returns table(role text, nom text)
language sql stable security definer set search_path = public as $$
  select 'coach'::text, p.last_name || ' ' || p.first_name
    from course_coaches cc join people p on p.id = cc.coach_person_id
   where cc.course_id = p_course
     and (has_role(auth.uid(), 'affichage') or is_staff(auth.uid()))
  union all
  select 'joueur'::text, p.last_name || ' ' || p.first_name
    from course_participants cp join people p on p.id = cp.child_person_id
   where cp.course_id = p_course
     and (has_role(auth.uid(), 'affichage') or is_staff(auth.uid()))
$$;
revoke all on function public.affichage_course_detail(uuid) from public, anon;
grant execute on function public.affichage_course_detail(uuid) to authenticated;
