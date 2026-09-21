-- 85 — Coach mental : accès aux NOMS des jeunes suivis, plus à leur fiche entière (21.09.2026).
-- Avant : la policy people_read_mental laissait lire toute la ligne `people` (téléphone, parents, adresse…)
-- des jeunes sport-études / pro / pro U18, alors que l'écran Mental n'affiche que le nom.
-- Maintenant : fonction mental_people() (id, prénom, nom, actif) + suppression de la policy.
create or replace function public.mental_people()
 returns table(id uuid, first_name text, last_name text, is_active boolean)
 language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not (is_staff(auth.uid()) or has_role(auth.uid(), 'coach_mental')) then
    raise exception 'non autorisé';
  end if;
  return query
  select p.id, p.first_name, p.last_name, p.is_active
  from people p
  where is_role_period(p.id, array['sport-etudes', 'pro', 'pro-u18']) or has_person_role(p.id, 'coach_mental');
end $$;
revoke all on function public.mental_people() from public, anon;
grant execute on function public.mental_people() to authenticated;

-- À exécuter UNE FOIS la console publiée avec l'appel à mental_people() (sinon la liste Mental serait vide) :
drop policy if exists people_read_mental on public.people;
