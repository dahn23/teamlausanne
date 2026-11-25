-- 201 — Mon espace : le parent garde l'accès quand le jeune a sa propre adresse (22.10.2026).
-- Avant : un compte voyait un jeune SEULEMENT si son e-mail = l'e-mail principal de la fiche. Mettre l'adresse du
-- jeune sur sa fiche (pour qu'il ait l'app sur son téléphone) coupait donc le parent.
-- Maintenant : une adresse écrite dans « Parent 1 » / « Parent 2 » donne aussi l'accès — jeune ET parents, chacun
-- avec son compte. Limite : jeunes MINEURS (ou sans date de naissance) ; à 18 ans, l'adresse des parents
-- n'ouvre plus l'espace du joueur.
-- Touché : my_family_ids, family_ids_of_user, push_users_for_person (notifications), portal_family_of_email
-- (invitations), portal_access_list (+ colonne « source » : 'fiche' ou 'parent').

-- Adresses e-mail lues dans les champs parent (« Prénom Nom · 079 … · adresse@x.ch »), vides si le jeune est majeur.
create or replace function public.emails_parents(p_parent1 text, p_parent2 text, p_birthdate date)
returns setof text language sql stable set search_path = public as $$
  select distinct lower(m[1])
  from regexp_matches(coalesce(p_parent1, '') || ' ' || coalesce(p_parent2, ''),
                      '([A-Za-z0-9._%+''-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})', 'g') m
  where p_birthdate is null or p_birthdate > current_date - interval '18 years';
$$;
revoke all on function public.emails_parents(text, text, date) from public, anon;

create or replace function public.my_family_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select pr.person_id from profiles pr where pr.user_id = auth.uid() and pr.person_id is not null
  union
  select g.child_id from guardianships g join profiles pr on pr.person_id = g.guardian_id where pr.user_id = auth.uid()
  union
  select p.id from people p join auth.users u on u.id = auth.uid()
  where u.email_confirmed_at is not null
    and coalesce(trim(p.email), '') <> ''
    and lower(trim(p.email)) = lower(trim(u.email))
  union
  select p.id from people p join auth.users u on u.id = auth.uid()
  where u.email_confirmed_at is not null
    and coalesce(trim(u.email), '') <> ''
    and lower(trim(u.email)) in (select emails_parents(p.parent1, p.parent2, p.birthdate));
$$;

create or replace function public.family_ids_of_user(p_user uuid)
returns table(person_id uuid, label text) language sql stable security definer set search_path = public as $$
  with ids as (
    select pr.person_id as id from profiles pr where pr.user_id = p_user and pr.person_id is not null
    union
    select g.child_id from guardianships g join profiles pr on pr.person_id = g.guardian_id where pr.user_id = p_user
    union
    select p.id from people p join auth.users u on u.id = p_user
    where u.email_confirmed_at is not null and coalesce(trim(p.email), '') <> '' and lower(trim(p.email)) = lower(trim(u.email))
    union
    select p.id from people p join auth.users u on u.id = p_user
    where u.email_confirmed_at is not null and coalesce(trim(u.email), '') <> ''
      and lower(trim(u.email)) in (select emails_parents(p.parent1, p.parent2, p.birthdate))
  )
  select p.id, p.first_name || ' ' || p.last_name from ids join people p on p.id = ids.id;
$$;

create or replace function public.push_users_for_person(p uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select pr.user_id from profiles pr where pr.person_id = p
  union
  select pr.user_id from guardianships g join profiles pr on pr.person_id = g.guardian_id where g.child_id = p
  union
  select u.id from people pe join auth.users u on lower(trim(u.email)) = lower(trim(pe.email))
   where pe.id = p and coalesce(trim(pe.email), '') <> '' and u.email_confirmed_at is not null
  union
  select u.id from people pe join auth.users u on lower(trim(u.email)) in (select emails_parents(pe.parent1, pe.parent2, pe.birthdate))
   where pe.id = p and u.email_confirmed_at is not null
$$;

-- Invitations : un parent dont l'adresse n'est que dans « Parent 1/2 » retrouve ses enfants.
create or replace function public.portal_family_of_email(p_email text)
returns table(person_id uuid, first_name text, last_name text) language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.last_name
  from people p
  where coalesce(trim(p_email), '') <> ''
    and (lower(trim(p.email)) = lower(trim(p_email))
         or lower(trim(p_email)) in (select emails_parents(p.parent1, p.parent2, p.birthdate)))
    and exists (select 1 from role_periods rp join seasons s on s.id = rp.season_id
                where rp.person_id = p.id and s.kind = 'juniors' and current_date between s.start_date and s.end_date)
  order by p.first_name;
$$;

-- Liste « Accès Mon espace » : les adresses parents y apparaissent aussi, marquées source = 'parent'.
drop function if exists public.portal_access_list(text[]);
create function public.portal_access_list(p_roles text[])
returns table(email text, person_ids uuid[], children text, filieres text, source text, has_account boolean,
              last_sign_in timestamp with time zone, invited_at timestamp with time zone, activated boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin(auth.uid()) or has_role(auth.uid(), 'secretaire')) then
    raise exception 'non autorisé';
  end if;
  return query
  with cur as (select s.id from seasons s where s.kind = 'juniors' and current_date between s.start_date and s.end_date limit 1),
  yp as (
    select p.id, p.email, p.parent1, p.parent2, p.birthdate, p.first_name, p.last_name,
           string_agg(distinct rp.role, ', ') as roles
    from people p join role_periods rp on rp.person_id = p.id join cur on cur.id = rp.season_id
    where rp.role = any(p_roles)
    group by p.id
  ),
  y as (
    select yp.id, lower(trim(yp.email)) as em, 1 as src, yp.first_name, yp.last_name, yp.roles
    from yp where coalesce(trim(yp.email), '') <> ''
    union
    select yp.id, e.em, 2, yp.first_name, yp.last_name, yp.roles
    from yp cross join lateral emails_parents(yp.parent1, yp.parent2, yp.birthdate) as e(em)
  ),
  y1 as (  -- une seule ligne par (adresse, jeune) : « fiche » l'emporte sur « parent »
    select distinct on (y.em, y.id) y.* from y order by y.em, y.id, y.src
  ),
  fam as (
    select y1.em, array_agg(y1.id order by y1.first_name) as ids,
           string_agg(y1.first_name || ' ' || y1.last_name, ', ' order by y1.first_name) as kids,
           string_agg(distinct y1.roles, ', ') as fil,
           case when min(y1.src) = 1 then 'fiche' else 'parent' end as source
    from y1 group by y1.em
  )
  select f.em, f.ids, f.kids, f.fil, f.source,
    (u.id is not null),
    u.last_sign_in_at,
    (select max(i.sent_at) from portal_invites i where lower(i.email) = f.em),
    (u.id is not null and u.email_confirmed_at is not null and u.encrypted_password is not null and u.encrypted_password <> '')
  from fam f left join auth.users u on lower(u.email) = f.em
  order by f.kids, f.source;
end $$;
revoke all on function public.portal_access_list(text[]) from public, anon;
grant execute on function public.portal_access_list(text[]) to authenticated;
