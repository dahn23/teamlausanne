-- ===================================================================
--  Deux corrections de db/174, trouvées en vérifiant (16.10.2026)
-- ===================================================================

-- 1) UNE SOUS-REQUÊTE DANS UNE POLICY SUBIT AUSSI LA RLS.
-- people_read_collegues interrogeait profiles et user_roles pour reconnaître un
-- encadrant — or sur ces deux tables chacun ne voit que SA ligne. L'EXISTS ne
-- pouvait donc jamais désigner quelqu'un d'autre que soi : les noms des
-- collègues restaient invisibles, et la grille du planning se serait vidée des
-- coachs des autres cours. Mesuré : 107 fiches visibles au lieu de 134.
--
-- Le test passe donc par une fonction SECURITY DEFINER, comme is_staff() et
-- comme toutes les autres portes du projet. À retenir : dans une policy, toute
-- table lue doit être soit ouverte, soit atteinte via SECURITY DEFINER.
create or replace function public.person_is_staff(p_person uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join user_roles r on r.user_id = p.user_id
     where p.person_id = p_person
       and r.role in ('superadmin','admin','secretaire','head_coach','coach',
                      'coach_physique','moniteur','prof','coach_mental'));
$$;
revoke all on function public.person_is_staff(uuid) from public, anon;
grant execute on function public.person_is_staff(uuid) to authenticated;

drop policy if exists people_read_collegues on public.people;
create policy people_read_collegues on public.people
  for select using (is_staff(auth.uid()) and person_is_staff(people.id));

-- 2) LES NOTES TECHNIQUES SONT DES NOTES SUR DES ENFANTS.
-- can_tennis_view() inclut volontairement les coachs et les moniteurs, mais
-- donnait les 38 notes de tout le club. Un coach lit désormais celles de SES
-- joueurs. L'écriture ne change pas : noter son cours est le geste qui fait
-- vivre la table, et le lui retirer viderait la fonctionnalité.
create or replace function public.mon_joueur(p_person uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from course_participants cp
      join course_coaches cc on cc.course_id = cp.course_id
      join profiles pr       on pr.person_id = cc.coach_person_id
     where cp.child_person_id = p_person and pr.user_id = auth.uid());
$$;
revoke all on function public.mon_joueur(uuid) from public, anon;
grant execute on function public.mon_joueur(uuid) to authenticated;

alter policy tennis_notes_select on public.tennis_notes
  using (can_read_all_people(auth.uid()) or mon_joueur(player_person_id));
