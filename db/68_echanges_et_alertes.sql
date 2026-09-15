-- Échanges avec les familles, et alertes du tableau de bord
--
-- Deux besoins distincts, réunis ici parce qu'ils se rejoignent sur le même
-- tableau de bord : ne perdre personne de vue.
--
-- 1. JOURNAL DES ÉCHANGES. Distinct de youth_notes, qui suit le DÉVELOPPEMENT
--    du jeune (tennis, mental, études, avec badges de rôle). Ici on note la
--    RELATION : qui a été appelé, quand, par quel moyen, ce qui s'est dit. Ni le
--    même public ni la même durée de vie, d'où deux tables.
--
-- 2. ALERTE D'ABSENCES. Toutes filières confondues. On compte des HEURES et non
--    des séances : rater trois cours d'une heure n'a pas le même poids que trois
--    séances de deux heures.
--
-- Les deux seuils sont des réglages (app_settings), pas des nombres en dur : la
-- cadence d'appel comme le seuil d'absences se discuteront.

create table if not exists public.player_contact_log (
  id                uuid primary key default gen_random_uuid(),
  person_id         uuid not null references public.people(id) on delete cascade,
  contacted_at      date not null default current_date,
  channel           text not null default 'appel',   -- appel | visio | rencontre | message | autre
  summary           text not null,
  author_person_id  uuid references public.people(id) on delete set null,
  author_name       text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);
create index if not exists pcl_person on public.player_contact_log (person_id, contacted_at desc);

-- Volontairement plus étroit que is_staff : ces échanges touchent aux familles,
-- aux tarifs et parfois au privé. Ni les coachs ni les moniteurs n'y ont accès.
create or replace function public.can_contact_log(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
     where user_id = uid and role in ('superadmin','admin','head_coach','secretaire')
  );
$$;

alter table public.player_contact_log enable row level security;
drop policy if exists pcl_acces on public.player_contact_log;
create policy pcl_acces on public.player_contact_log for all to authenticated
  using (can_contact_log(auth.uid())) with check (can_contact_log(auth.uid()));
grant select, insert, update, delete on public.player_contact_log to authenticated;

insert into app_settings (key, value) values ('contact_cadence_jours', '30'::jsonb)
on conflict (key) do nothing;
insert into app_settings (key, value) values ('absences_seuil_heures', '3'::jsonb)
on conflict (key) do nothing;

-- Joueurs sport-études / pro / pro-u18 et leur dernier échange. Renvoie TOUT LE
-- MONDE, y compris ceux jamais contactés (jours = null) : personne ne doit
-- disparaître de la liste faute d'historique.
create or replace function public.contacts_a_relancer()
returns table (person_id uuid, joueur text, filiere text,
               dernier_contact date, jours int, en_retard boolean)
language sql stable security definer set search_path = public as $$
  with cadence as (
    select coalesce((select value::text::int from app_settings
                      where key = 'contact_cadence_jours'), 30) as n
  ),
  saison as (
    select id from seasons
     where kind = 'juniors' and current_date between start_date and end_date
  ),
  joueurs as (
    select distinct pe.id, pe.first_name || ' ' || pe.last_name as nom, rp.role
      from role_periods rp
      join people pe on pe.id = rp.person_id
     where rp.season_id = (select id from saison)
       and rp.role in ('sport-etudes','pro','pro-u18')
       and coalesce(pe.is_active, true)
  )
  select j.id, j.nom, j.role, d.dernier,
         case when d.dernier is null then null else (current_date - d.dernier) end,
         case when d.dernier is null then true
              else (current_date - d.dernier) >= (select n from cadence) end
    from joueurs j
    left join lateral (
      select max(contacted_at) as dernier from player_contact_log l where l.person_id = j.id
    ) d on true
   where can_contact_log(auth.uid())
   order by (d.dernier is not null), d.dernier, j.nom;
$$;

-- Élèves dont les absences cumulées dépassent le seuil, toutes filières.
-- Le contact du parent est renvoyé avec, pour appeler sans quitter l'écran.
create or replace function public.absences_a_signaler()
returns table (person_id uuid, eleve text, filiere text,
               heures numeric, seances int, derniere date, parent text)
language sql stable security definer set search_path = public as $$
  with saison as (
    select id, start_date, end_date from seasons
     where kind = 'juniors' and current_date between start_date and end_date
  ),
  seuil as (
    select coalesce((select value::text::numeric from app_settings
                      where key = 'absences_seuil_heures'), 3) as h
  ),
  abs as (
    select a.person_id,
           round(sum(extract(epoch from (c.end_time - c.start_time)) / 3600.0)::numeric, 2) as heures,
           count(*)::int as seances,
           max(c.course_date) as derniere
      from attendance a
      join courses c on c.id = a.course_id
     where not a.is_coach and a.status = 'absent'
       and c.course_date between (select start_date from saison) and (select end_date from saison)
     group by a.person_id
  )
  select pe.id, pe.first_name || ' ' || pe.last_name,
         (select string_agg(rp.role, ', ' order by rp.role) from role_periods rp
           where rp.person_id = pe.id and rp.season_id = (select id from saison)),
         abs.heures, abs.seances, abs.derniere,
         nullif(btrim(coalesce(pe.parent1, '')), '')
    from abs join people pe on pe.id = abs.person_id
   where is_staff(auth.uid())
     and coalesce(pe.is_active, true)
     and abs.heures > (select h from seuil)
   order by abs.heures desc, pe.last_name;
$$;

revoke all on function public.can_contact_log(uuid) from public, anon;
revoke all on function public.contacts_a_relancer() from public, anon;
revoke all on function public.absences_a_signaler() from public, anon;
grant execute on function public.can_contact_log(uuid) to authenticated;
grant execute on function public.contacts_a_relancer() to authenticated;
grant execute on function public.absences_a_signaler() to authenticated;
