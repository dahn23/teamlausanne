-- Calendrier d'équipe
--
-- Un seul fil d'événements pour tout ce qui occupe une période : vacances de
-- l'équipe, fermetures du club, camps, tournois.
--
-- Les vacances SCOLAIRES ne sont pas recopiées ici : elles vivent déjà dans
-- school_holidays. Les dupliquer aurait garanti qu'un jour les deux ne disent
-- plus la même chose. cal_semaines() les lit à la source.
--
-- Seules les VACANCES d'un membre passent par une validation. Fermetures, camps
-- et événements s'ajoutent directement : ce sont des faits d'organisation, pas
-- des demandes.

create table if not exists public.cal_events (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,                  -- vacances | fermeture | camp | evenement
  title       text not null,
  start_date  date not null,
  end_date    date not null,
  member_id   uuid references public.pm_members(id) on delete cascade,
  status      text not null default 'valide', -- demande | valide | refuse
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  decided_by  uuid,
  decided_at  timestamptz,
  constraint cal_dates_coherentes check (end_date >= start_date),
  constraint cal_kind_connu   check (kind in ('vacances','fermeture','camp','evenement')),
  constraint cal_statut_connu check (status in ('demande','valide','refuse')),
  constraint cal_vacances_ont_un_membre check (kind <> 'vacances' or member_id is not null)
);
create index if not exists cal_ev_dates  on public.cal_events (start_date, end_date);
create index if not exists cal_ev_membre on public.cal_events (member_id, start_date);

-- Qui voit et alimente : la même équipe que le Project Manager.
create or replace function public.can_calendrier(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles
     where user_id = uid and role in ('superadmin','admin','secretaire','head_coach'));
$$;

-- Qui valide les demandes de vacances.
create or replace function public.can_calendrier_valider(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('superadmin','admin'));
$$;

alter table public.cal_events enable row level security;

drop policy if exists cal_lecture on public.cal_events;
create policy cal_lecture on public.cal_events for select to authenticated
  using (can_calendrier(auth.uid()));

-- Une demande de vacances naît obligatoirement en « demande » : personne ne
-- s'auto-valide, sauf ceux qui ont le droit de valider.
drop policy if exists cal_creation on public.cal_events;
create policy cal_creation on public.cal_events for insert to authenticated
  with check (can_calendrier(auth.uid())
    and (kind <> 'vacances' or status = 'demande' or can_calendrier_valider(auth.uid())));

drop policy if exists cal_modif on public.cal_events;
create policy cal_modif on public.cal_events for update to authenticated
  using (can_calendrier_valider(auth.uid())
         or (created_by = auth.uid() and status <> 'valide'))
  with check (can_calendrier_valider(auth.uid())
              or (created_by = auth.uid() and status = 'demande'));

drop policy if exists cal_suppr on public.cal_events;
create policy cal_suppr on public.cal_events for delete to authenticated
  using (can_calendrier_valider(auth.uid())
         or (created_by = auth.uid() and status <> 'valide'));

grant select, insert, update, delete on public.cal_events to authenticated;

-- Décision sur une demande. En fonction plutôt qu'en UPDATE direct : la date et
-- l'auteur de la décision doivent être posés en même temps que le statut, sans
-- que l'appelant puisse les oublier ou les falsifier.
create or replace function public.cal_decider(p_id uuid, p_valide boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_kind text;
begin
  if not can_calendrier_valider(auth.uid()) then
    return jsonb_build_object('ok', false, 'raison', 'droits');
  end if;
  select kind into v_kind from cal_events where id = p_id;
  if v_kind is null then return jsonb_build_object('ok', false, 'raison', 'introuvable'); end if;
  if v_kind <> 'vacances' then
    return jsonb_build_object('ok', false, 'raison', 'seules les vacances se valident');
  end if;
  update cal_events
     set status = case when p_valide then 'valide' else 'refuse' end,
         note = coalesce(p_note, note), decided_by = auth.uid(), decided_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Les semaines d'une période, avec tout ce qui s'y passe. Deux sources réunies
-- sans être mélangées : school_holidays (canton VD) et cal_events.
create or replace function public.cal_semaines(p_debut date, p_fin date)
returns table (n int, lundi date, dimanche date,
               jours_vacances_scolaires int, vacances_scolaires text, evenements jsonb)
language sql stable security definer set search_path = public as $$
  with semaines as (
    select row_number() over (order by d)::int as n,
           d::date as lundi, (d::date + 6) as dimanche
      from generate_series(p_debut, p_fin, interval '7 days') d
  ),
  -- Recouvrement scolaire compté sur les jours ouvrables : c'est ce qui dit si
  -- la semaine est travaillée.
  scol as (
    select s.n, count(*) filter (where h.label is not null)::int as jours,
           string_agg(distinct h.label, ' + ') as libelle
      from semaines s
      cross join lateral generate_series(s.lundi, s.lundi + 4, interval '1 day') j
      left join lateral (select label from school_holidays
         where canton = 'VD' and j::date between start_date and end_date limit 1) h on true
     group by s.n
  )
  select s.n, s.lundi, s.dimanche, sc.jours, sc.libelle,
         coalesce((select jsonb_agg(jsonb_build_object(
                    'id', e.id, 'kind', e.kind, 'title', e.title, 'status', e.status,
                    'start', e.start_date, 'end', e.end_date,
                    'membre', m.name, 'initiales', m.initials, 'couleur', m.color)
                  order by e.kind, e.start_date)
             from cal_events e left join pm_members m on m.id = e.member_id
            where e.start_date <= s.dimanche and e.end_date >= s.lundi), '[]'::jsonb)
    from semaines s join scol sc on sc.n = s.n
   where can_calendrier(auth.uid())
   order by s.n;
$$;

revoke all on function public.can_calendrier(uuid)              from public, anon;
revoke all on function public.can_calendrier_valider(uuid)      from public, anon;
revoke all on function public.cal_decider(uuid, boolean, text)  from public, anon;
revoke all on function public.cal_semaines(date, date)          from public, anon;
grant execute on function public.can_calendrier(uuid)             to authenticated;
grant execute on function public.can_calendrier_valider(uuid)     to authenticated;
grant execute on function public.cal_decider(uuid, boolean, text) to authenticated;
grant execute on function public.cal_semaines(date, date)         to authenticated;

-- Événements de départ.
insert into cal_events (kind, title, start_date, end_date, status)
select * from (values
  ('fermeture', 'Team Lausanne fermé',         date '2026-10-05', date '2026-10-11', 'valide'),
  ('fermeture', 'Team Lausanne fermé',         date '2027-03-22', date '2027-03-28', 'valide'),
  ('camp',      'Camp d''automne — semaine 1', date '2026-10-12', date '2026-10-16', 'valide'),
  ('camp',      'Camp d''automne — semaine 2', date '2026-10-19', date '2026-10-23', 'valide'),
  ('evenement', 'Lausanne Open 2027',          date '2027-08-21', date '2027-08-29', 'valide')
) as v(kind, title, start_date, end_date, status)
where not exists (select 1 from cal_events e where e.title = v.title and e.start_date = v.start_date);
