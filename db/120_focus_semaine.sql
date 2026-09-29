-- 29.09.2026 (décision Dan) : « Le focus de la semaine » remplace « Après séance — 3 fiertés » dans Mental.
--  • Le jeune (ou son parent) le remplit dans Mon espace › Mental : UN focus par semaine (lundi → dimanche, heure suisse),
--    daté. Une fois rempli, la semaine est bloquée (« tu as déjà rempli ton focus »).
--  • Le jeune peut le modifier / supprimer pendant 24 h (le sien seulement) ; après, il est figé.
--  • Coach mental, head coach, coach, admin et superadmin le voient (console › Mental › Participants et fiche › Mental)
--    et peuvent le modifier / supprimer à tout moment.
-- Les anciennes « 3 fiertés » (mental_proud) restent en base, simplement plus affichées.

create or replace function public.can_focus_staff(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
                 and role::text in ('coach_mental', 'head_coach', 'coach', 'admin', 'superadmin'));
$$;

create table if not exists public.mental_focus (
  id uuid primary key default gen_random_uuid(),
  youth_person_id uuid not null references public.people(id) on delete cascade,
  week_start date not null,                 -- lundi de la semaine (heure suisse)
  body text not null check (length(btrim(body)) > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz,
  unique (youth_person_id, week_start)
);
alter table public.mental_focus enable row level security;
-- Staff : tout. Jeune / parent : lecture seule en direct (écritures via les RPC ci-dessous, qui gardent la règle des 24 h).
drop policy if exists mf_staff on public.mental_focus;
create policy mf_staff on public.mental_focus for all to authenticated
  using (can_focus_staff(auth.uid())) with check (can_focus_staff(auth.uid()));
drop policy if exists mf_mine on public.mental_focus;
create policy mf_mine on public.mental_focus for select to authenticated using (can_read_public_of(youth_person_id));
grant select, insert, update, delete on public.mental_focus to authenticated;

create or replace function public.focus_week_start()
returns date language sql stable set search_path = public as $$
  select (date_trunc('week', now() at time zone 'Europe/Zurich'))::date;
$$;

-- Liste des focus d'un jeune (du plus récent au plus ancien), avec « modifiable par moi » calculé en base.
create or replace function public.portal_focus_list(p_youth uuid)
returns table(id uuid, week_start date, body text, created_at timestamptz, updated_at timestamptz, can_edit boolean, is_current boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (can_focus_staff(auth.uid()) or can_read_public_of(p_youth)) then raise exception 'Accès refusé'; end if;
  return query select f.id, f.week_start, f.body, f.created_at, f.updated_at,
      (can_focus_staff(auth.uid()) or (f.created_by = auth.uid() and f.created_at > now() - interval '24 hours')),
      f.week_start = focus_week_start()
    from mental_focus f where f.youth_person_id = p_youth order by f.week_start desc;
end $$;

-- Écrire le focus de la semaine en cours (nouveau) ou modifier un focus (p_id) dans la limite des 24 h.
create or replace function public.portal_focus_save(p_youth uuid, p_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_staff boolean := can_focus_staff(auth.uid()); r mental_focus;
begin
  if not (v_staff or can_read_public_of(p_youth)) then raise exception 'Accès refusé'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'Écris ton focus.'; end if;
  if p_id is null then
    if exists (select 1 from mental_focus where youth_person_id = p_youth and week_start = focus_week_start()) then
      raise exception 'Tu as déjà rempli ton focus cette semaine.';
    end if;
    insert into mental_focus(youth_person_id, week_start, body, created_by)
      values (p_youth, focus_week_start(), left(btrim(p_body), 4000), auth.uid()) returning id into v_id;
    return v_id;
  end if;
  select * into r from mental_focus where id = p_id and youth_person_id = p_youth;
  if not found then raise exception 'Focus introuvable.'; end if;
  if not (v_staff or (r.created_by = auth.uid() and r.created_at > now() - interval '24 hours')) then
    raise exception 'Ce focus ne se modifie plus (24 h dépassées).';
  end if;
  update mental_focus set body = left(btrim(p_body), 4000), updated_by = auth.uid(), updated_at = now() where id = p_id;
  return p_id;
end $$;

create or replace function public.portal_focus_delete(p_youth uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r mental_focus;
begin
  select * into r from mental_focus where id = p_id and youth_person_id = p_youth;
  if not found then return; end if;
  if not (can_focus_staff(auth.uid())
          or (can_read_public_of(p_youth) and r.created_by = auth.uid() and r.created_at > now() - interval '24 hours')) then
    raise exception 'Ce focus ne se supprime plus (24 h dépassées).';
  end if;
  delete from mental_focus where id = p_id;
end $$;

revoke all on function public.portal_focus_list(uuid), public.portal_focus_save(uuid, uuid, text),
  public.portal_focus_delete(uuid, uuid), public.can_focus_staff(uuid), public.focus_week_start() from public, anon;
grant execute on function public.portal_focus_list(uuid), public.portal_focus_save(uuid, uuid, text),
  public.portal_focus_delete(uuid, uuid), public.can_focus_staff(uuid), public.focus_week_start() to authenticated;
