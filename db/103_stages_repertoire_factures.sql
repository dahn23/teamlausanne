-- Stages : inscrits reliés au répertoire + factures dans l'onglet Factures (25.09.2026).
--
-- 1. Rapprochement inscrit ↔ fiche (même logique que GameZone, db/101, sans licence) :
--    a. même nom + prénom (sans accents ni tirets) ET même date de naissance        → même personne
--    b. inscrit sans naissance : même nom + prénom ET même e-mail                    → même personne
--    c. ressemblance sans certitude (même nom+prénom, ou même nom + même naissance) → liste « à vérifier »
--       (stage_link_review, bandeau du Répertoire), JAMAIS de fusion automatique
--    d. sinon                                                                        → nouvelle fiche
--    Toute fiche reliée reçoit le tag « stage ». Lien à l'inscription (déclencheur) et rattrapage via stage_link_all().
-- 2. Fiche « externe seulement » (tags gamezone / stage, aucun autre rôle ni filière) : people_external_only()
--    remplace people_gz_only() pour les anniversaires du Dashboard et la newsletter « tout le répertoire ».
-- 3. Facture d'un inscrit = vraie facture de l'onglet Factures (out_invoices, filière « stage ») :
--    stage_registrations.out_invoice_id ; quand la facture passe « payée » (rapprochement bancaire ou à la main),
--    l'inscription passe payée elle aussi (déclencheur), et inversement si on l'annule.

alter table public.stage_registrations add column if not exists out_invoice_id uuid references public.out_invoices(id) on delete set null;
create index if not exists stage_registrations_person_idx on public.stage_registrations(person_id);
create index if not exists stage_registrations_invoice_idx on public.stage_registrations(out_invoice_id);

create table if not exists public.stage_link_review (
  registration_id uuid primary key references public.stage_registrations(id) on delete cascade,
  candidate_ids uuid[] not null default '{}',
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.stage_link_review enable row level security;
drop policy if exists stage_link_review_staff on public.stage_link_review;
create policy stage_link_review_staff on public.stage_link_review for all using (is_staff(auth.uid())) with check (is_staff(auth.uid()));
grant select, insert, update, delete on public.stage_link_review to authenticated;

create or replace function public.stage_attach(p_reg uuid, p_person uuid) returns void
language sql security definer set search_path = public as $$
  update stage_registrations set person_id = p_person where id = p_reg;
  insert into person_roles(person_id, role) values (p_person, 'stage') on conflict do nothing;
  delete from stage_link_review where registration_id = p_reg;
$$;
revoke all on function public.stage_attach(uuid, uuid) from public, anon, authenticated;

create or replace function public.stage_link_one(p_reg uuid) returns text
language plpgsql security definer set search_path = public as $$
declare r record; cand uuid[]; pid uuid; how text; mail text;
begin
  select * into r from stage_registrations where id = p_reg;
  if not found then return 'introuvable'; end if;
  if r.person_id is not null then perform stage_attach(p_reg, r.person_id); return 'deja'; end if;
  mail := lower(btrim(coalesce(r.email, '')));

  -- a. nom + prénom + naissance
  if r.birth_date is not null then
    select array_agg(id) into cand from people
     where name_key(last_name || first_name) = name_key(r.last_name || r.first_name) and birthdate = r.birth_date;
    if coalesce(array_length(cand, 1), 0) = 1 then pid := cand[1]; how := 'nom+naissance';
    elsif coalesce(array_length(cand, 1), 0) > 1 then
      insert into stage_link_review(registration_id, candidate_ids, reason) values (p_reg, cand, 'Plusieurs fiches même nom et même naissance')
        on conflict (registration_id) do update set candidate_ids = excluded.candidate_ids, reason = excluded.reason;
      return 'a_verifier';
    end if;
  -- b. sans naissance : nom + prénom + e-mail
  elsif mail <> '' then
    select array_agg(id) into cand from people
     where name_key(last_name || first_name) = name_key(r.last_name || r.first_name)
       and (lower(btrim(coalesce(email, ''))) = mail or exists (select 1 from unnest(coalesce(emails, '{}')) e where lower(btrim(e)) = mail));
    if coalesce(array_length(cand, 1), 0) = 1 then pid := cand[1]; how := 'nom+email'; end if;
  end if;

  -- c. ressemblance sans certitude
  if pid is null then
    select array_agg(id) into cand from people
     where name_key(last_name || first_name) = name_key(r.last_name || r.first_name)
        or (r.birth_date is not null and name_key(last_name) = name_key(r.last_name) and birthdate = r.birth_date);
    if coalesce(array_length(cand, 1), 0) > 0 then
      insert into stage_link_review(registration_id, candidate_ids, reason) values (p_reg, cand, 'Même nom, mais naissance ou e-mail différent / inconnu')
        on conflict (registration_id) do update set candidate_ids = excluded.candidate_ids, reason = excluded.reason;
      return 'a_verifier';
    end if;
  end if;

  -- d. nouvelle fiche
  if pid is null then
    insert into people(first_name, last_name, birthdate, email, is_active)
    values (btrim(r.first_name), btrim(r.last_name), r.birth_date, nullif(mail, ''), true)
    returning id into pid;
    how := 'nouvelle';
  end if;
  perform stage_attach(p_reg, pid);
  return how;
end $$;
revoke all on function public.stage_link_one(uuid) from public, anon, authenticated;

create or replace function public.stage_link_all() returns jsonb
language plpgsql security definer set search_path = public as $$
declare x record; res text; out jsonb := '{}'::jsonb;
begin
  if auth.uid() is not null and not is_staff(auth.uid()) then raise exception 'réservé au secrétariat'; end if;
  for x in select id from stage_registrations r
            where not exists (select 1 from stage_link_review v where v.registration_id = r.id)
              and (r.person_id is null or not exists (select 1 from person_roles pr where pr.person_id = r.person_id and pr.role = 'stage'))
            order by created_at loop
    res := stage_link_one(x.id);
    out := jsonb_set(out, array[res], to_jsonb(coalesce((out->>res)::int, 0) + 1));
  end loop;
  return out;
end $$;
revoke all on function public.stage_link_all() from public, anon;
grant execute on function public.stage_link_all() to authenticated;

-- Décision à la main : p_person = fiche choisie, ou null = nouvelle fiche. Sert aussi au bouton « Lier » des Stages.
create or replace function public.stage_link_resolve(p_reg uuid, p_person uuid) returns text
language plpgsql security definer set search_path = public as $$
declare r record; pid uuid;
begin
  if not is_staff(auth.uid()) then raise exception 'réservé au secrétariat'; end if;
  select * into r from stage_registrations where id = p_reg;
  if not found then return 'introuvable'; end if;
  if p_person is not null then perform stage_attach(p_reg, p_person); return 'relie'; end if;
  insert into people(first_name, last_name, birthdate, email, is_active)
  values (btrim(r.first_name), btrim(r.last_name), r.birth_date, nullif(lower(btrim(coalesce(r.email, ''))), ''), true)
  returning id into pid;
  perform stage_attach(p_reg, pid);
  return 'nouvelle';
end $$;
revoke all on function public.stage_link_resolve(uuid, uuid) from public, anon;
grant execute on function public.stage_link_resolve(uuid, uuid) to authenticated;

create or replace function public.stage_registrations_link_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin perform stage_link_one(new.id); exception when others then null; end;
  return null;
end $$;
drop trigger if exists stage_registrations_link on public.stage_registrations;
create trigger stage_registrations_link after insert on public.stage_registrations for each row execute function public.stage_registrations_link_trg();

create or replace function public.stage_link_review_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_staff(auth.uid()) then coalesce((
    select jsonb_agg(jsonb_build_object(
      'registration_id', v.registration_id, 'reason', v.reason,
      'player', jsonb_build_object('last_name', r.last_name, 'first_name', r.first_name, 'born', r.birth_date, 'email', r.email,
                                   'stage', (select s.title from stage_sessions s where s.id = r.stage_id)),
      'candidates', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'last_name', p.last_name, 'first_name', p.first_name,
                                   'birthdate', p.birthdate, 'email', p.email)), '[]'::jsonb)
                     from people p where p.id = any(v.candidate_ids)))
      order by r.last_name)
    from stage_link_review v join stage_registrations r on r.id = v.registration_id), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.stage_link_review_list() from public, anon;
grant execute on function public.stage_link_review_list() to authenticated;

-- ---------- Fiche « externe seulement » (GameZone / stage) ----------
create or replace function public.people_external_only(p_person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from person_roles where person_id = p_person and role in ('gamezone', 'stage'))
     and not exists (select 1 from person_roles where person_id = p_person and role not in ('gamezone', 'stage'))
     and not exists (select 1 from role_periods where person_id = p_person);
$$;
grant execute on function public.people_external_only(uuid) to authenticated;
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.dash_general'::regproc);
  n := replace(d, 'not people_gz_only(pe.id)', 'not people_external_only(pe.id)');
  if n <> d then execute n; end if;
  d := pg_get_functiondef('public.newsletter_audience(jsonb)'::regprocedure);
  n := replace(d, 'not people_gz_only(p.id)', 'not people_external_only(p.id)');
  if n <> d then execute n; end if;
end $$;

-- ---------- Facture payée ⇄ inscription payée ----------
create or replace function public.out_invoices_stage_paid_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'payee' and old.status is distinct from 'payee' then
    update stage_registrations set paid = true, paid_at = coalesce(new.paid_at, now()) where out_invoice_id = new.id;
  elsif old.status = 'payee' and new.status is distinct from 'payee' then
    update stage_registrations set paid = false, paid_at = null where out_invoice_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists out_invoices_stage_paid on public.out_invoices;
create trigger out_invoices_stage_paid after update of status on public.out_invoices for each row execute function public.out_invoices_stage_paid_trg();
