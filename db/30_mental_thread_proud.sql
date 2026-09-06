-- 30_mental_thread_proud.sql
-- (A) Canal de discussion mental jeune <-> encadrement (message / lien / document).
-- (B) 3e formulaire : « 3 points dont je suis fier après l'entraînement ».
-- Accès : le jeune (ou son parent lié) + coach_mental / head_coach / admin / superadmin.

create or replace function public.can_mental_of(p_youth uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid()
                 and role in ('coach_mental','head_coach','admin','superadmin'))
      or can_read_public_of(p_youth);
$$;
-- Aligne aussi la lecture des formulaires compétition (migration 29) sur le même accès mental.
drop policy if exists mcf_read on public.mental_comp_forms;
create policy mcf_read on public.mental_comp_forms for select using (can_mental_of(youth_person_id));

-- ---- (A) Discussion ----
create table if not exists public.mental_thread (
  id uuid primary key default gen_random_uuid(),
  youth_person_id uuid not null references public.people(id) on delete cascade,
  author_is_staff boolean not null,
  author_person_id uuid, author_name text,
  body text, link_url text, file_path text, file_name text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists mth_youth_idx on public.mental_thread(youth_person_id, created_at);
alter table public.mental_thread enable row level security;
drop policy if exists mth_read on public.mental_thread;
create policy mth_read on public.mental_thread for select using (can_mental_of(youth_person_id));
grant select on public.mental_thread to authenticated;

create or replace function public.mental_thread_list(p_youth uuid)
returns setof public.mental_thread language plpgsql stable security definer set search_path = public as $$
begin
  if not can_mental_of(p_youth) then raise exception 'Accès refusé'; end if;
  return query select * from public.mental_thread where youth_person_id = p_youth order by created_at;
end;$$;

create or replace function public.mental_thread_post(p_youth uuid, p_body text, p_link text, p_file_path text, p_file_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_staff boolean; v_name text; v_id uuid;
begin
  if not can_mental_of(p_youth) then raise exception 'Accès refusé'; end if;
  v_staff := is_staff(auth.uid()) or exists (select 1 from user_roles where user_id = auth.uid()
             and role in ('coach_mental','head_coach','admin','superadmin'));
  if v_staff then
    select trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) into v_name
      from people pe join profiles pr on pr.person_id = pe.id where pr.user_id = auth.uid() limit 1;
  else
    select trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) into v_name from people where id = p_youth;
  end if;
  insert into public.mental_thread(youth_person_id, author_is_staff, author_person_id, author_name, body, link_url, file_path, file_name, created_by)
  values (p_youth, v_staff, null, coalesce(nullif(v_name,''),'—'), nullif(p_body,''), nullif(p_link,''), nullif(p_file_path,''), nullif(p_file_name,''), auth.uid())
  returning id into v_id;
  return v_id;
end;$$;

create or replace function public.mental_thread_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.mental_thread where id = p_id
    and (created_by = auth.uid() or is_staff(auth.uid())
         or exists (select 1 from user_roles where user_id = auth.uid() and role in ('coach_mental','head_coach','admin','superadmin')));
end;$$;

grant execute on function public.mental_thread_list(uuid) to authenticated;
grant execute on function public.mental_thread_post(uuid, text, text, text, text) to authenticated;
grant execute on function public.mental_thread_delete(uuid) to authenticated;

-- Bucket privé des pièces jointes (chemin = <youth_person_id>/<fichier>)
insert into storage.buckets (id, name, public) values ('mental', 'mental', false) on conflict (id) do nothing;
drop policy if exists mental_files_all on storage.objects;
create policy mental_files_all on storage.objects for all
  using (bucket_id = 'mental' and can_mental_of(nullif((storage.foldername(name))[1],'')::uuid))
  with check (bucket_id = 'mental' and can_mental_of(nullif((storage.foldername(name))[1],'')::uuid));

-- ---- (B) 3 fiertés après l'entraînement ----
create table if not exists public.mental_proud (
  id uuid primary key default gen_random_uuid(),
  youth_person_id uuid not null references public.people(id) on delete cascade,
  entry_date date not null default current_date,
  p1 text, p2 text, p3 text,
  created_at timestamptz not null default now(), created_by uuid
);
create index if not exists mpr_youth_idx on public.mental_proud(youth_person_id, entry_date desc);
alter table public.mental_proud enable row level security;
drop policy if exists mpr_read on public.mental_proud;
create policy mpr_read on public.mental_proud for select using (can_mental_of(youth_person_id));
grant select on public.mental_proud to authenticated;

create or replace function public.portal_proud_list(p_youth uuid)
returns setof public.mental_proud language plpgsql stable security definer set search_path = public as $$
begin
  if not can_mental_of(p_youth) then raise exception 'Accès refusé'; end if;
  return query select * from public.mental_proud where youth_person_id = p_youth order by entry_date desc, created_at desc;
end;$$;

create or replace function public.portal_proud_save(p_youth uuid, p_id uuid, p_date date, p1 text, p2 text, p3 text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not can_mental_of(p_youth) then raise exception 'Accès refusé'; end if;
  if p_id is null then
    insert into public.mental_proud(youth_person_id, entry_date, p1, p2, p3, created_by)
    values (p_youth, coalesce(p_date, current_date), nullif(p1,''), nullif(p2,''), nullif(p3,''), auth.uid())
    returning id into v_id;
  else
    update public.mental_proud set entry_date = coalesce(p_date, current_date),
      p1 = nullif(p1,''), p2 = nullif(p2,''), p3 = nullif(p3,'')
    where id = p_id and youth_person_id = p_youth returning id into v_id;
  end if;
  return v_id;
end;$$;

create or replace function public.portal_proud_delete(p_youth uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_mental_of(p_youth) then raise exception 'Accès refusé'; end if;
  delete from public.mental_proud where id = p_id and youth_person_id = p_youth;
end;$$;

grant execute on function public.portal_proud_list(uuid) to authenticated;
grant execute on function public.portal_proud_save(uuid, uuid, date, text, text, text) to authenticated;
grant execute on function public.portal_proud_delete(uuid, uuid) to authenticated;
