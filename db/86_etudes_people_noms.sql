-- 86 — Profs : accès aux NOMS des jeunes sport-études, plus à leur fiche entière (21.09.2026).
-- Même principe que db/85 (coach mental) : fonction etudes_people() + suppression de la policy people_read_prof.
create or replace function public.etudes_people()
 returns table(id uuid, first_name text, last_name text, is_active boolean)
 language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not (is_staff(auth.uid()) or has_role(auth.uid(), 'prof')) then
    raise exception 'non autorisé';
  end if;
  return query
  select p.id, p.first_name, p.last_name, p.is_active
  from people p
  where is_role_period(p.id, array['sport-etudes']) or has_person_role(p.id, 'prof');
end $$;
revoke all on function public.etudes_people() from public, anon;
grant execute on function public.etudes_people() to authenticated;

-- Une fois la console publiée avec l'appel à etudes_people() :
drop policy if exists people_read_prof on public.people;
