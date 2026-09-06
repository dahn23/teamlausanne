-- 29_mental_comp_forms.sql
-- Onglet Mental / Compétition : 2 formulaires remplis par le JEUNE depuis le portail
-- (Préparation compétition = avant, Analyse compétition = après). Une ligne par compétition.
-- Le coach mental les consulte dans la console (onglet Mental). Écriture via RPC portal_* uniquement.
create table if not exists public.mental_comp_forms (
  id uuid primary key default gen_random_uuid(),
  youth_person_id uuid not null references public.people(id) on delete cascade,
  competition text, comp_date date, lieu text,
  prep jsonb not null default '{}'::jsonb,      -- réponses « préparation »
  bilan jsonb not null default '{}'::jsonb,    -- réponses « bilan »
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists mcf_youth_idx on public.mental_comp_forms(youth_person_id, comp_date desc);

alter table public.mental_comp_forms enable row level security;
-- Lecture console : staff + coach mental. Écriture : via RPC SECURITY DEFINER seulement.
drop policy if exists mcf_read on public.mental_comp_forms;
create policy mcf_read on public.mental_comp_forms for select using (
  is_staff(auth.uid()) or exists (select 1 from user_roles where user_id = auth.uid() and role = 'coach_mental')
);
grant select on public.mental_comp_forms to authenticated;

-- ---- RPC portail (le jeune / son parent) ----
create or replace function public.portal_comp_forms(p_youth uuid)
returns setof public.mental_comp_forms language plpgsql stable security definer set search_path = public as $$
begin
  if not can_read_public_of(p_youth) then raise exception 'Accès refusé pour ce jeune'; end if;
  return query select * from public.mental_comp_forms where youth_person_id = p_youth
               order by comp_date desc nulls last, created_at desc;
end;$$;

create or replace function public.portal_save_comp_form(p_youth uuid, p_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not can_read_public_of(p_youth) then raise exception 'Accès refusé pour ce jeune'; end if;
  if p_id is null then
    insert into public.mental_comp_forms(youth_person_id, competition, comp_date, lieu, prep, bilan, created_by)
    values (p_youth, nullif(p_data->>'competition',''), nullif(p_data->>'comp_date','')::date, nullif(p_data->>'lieu',''),
            coalesce(p_data->'prep','{}'::jsonb), coalesce(p_data->'bilan','{}'::jsonb), auth.uid())
    returning id into v_id;
  else
    update public.mental_comp_forms set
      competition = nullif(p_data->>'competition',''), comp_date = nullif(p_data->>'comp_date','')::date,
      lieu = nullif(p_data->>'lieu',''), prep = coalesce(p_data->'prep','{}'::jsonb),
      bilan = coalesce(p_data->'bilan','{}'::jsonb), updated_at = now()
    where id = p_id and youth_person_id = p_youth
    returning id into v_id;
  end if;
  return v_id;
end;$$;

create or replace function public.portal_delete_comp_form(p_youth uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_read_public_of(p_youth) then raise exception 'Accès refusé pour ce jeune'; end if;
  delete from public.mental_comp_forms where id = p_id and youth_person_id = p_youth;
end;$$;

grant execute on function public.portal_comp_forms(uuid) to authenticated;
grant execute on function public.portal_save_comp_form(uuid, uuid, jsonb) to authenticated;
grant execute on function public.portal_delete_comp_form(uuid, uuid) to authenticated;
