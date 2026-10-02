-- 126 — Agenda public du site : ce que les parents peuvent voir.
--
-- Le site public se connecte en anonyme. Or aucune des tables de dates ne lui
-- est ouverte, et c'est très bien : cal_events contient les vacances de
-- l'équipe et des rendez-vous nominatifs avec des familles (« RDV NADIA
-- DÉVAUD », « Essai Milo Neyaga »). Rien de tout cela ne doit sortir.
--
-- On ne touche donc à aucune policy. Une seule fonction SECURITY DEFINER
-- rassemble les dates publiques et c'est elle, et elle seule, qui est ouverte à
-- l'anonyme. Le tri public/privé est écrit en SQL, pas dans le JavaScript du
-- site : une erreur de front ne peut pas faire fuiter une ligne.
--
-- Pour le genre « evenement », pas de règle devinable : la table mélange le
-- Lausanne Open et un rendez-vous avec un parent. D'où un drapeau explicite,
-- public_site, FERMÉ PAR DÉFAUT. Un nouvel événement n'est jamais publié par
-- accident ; il faut le cocher.

begin;

alter table cal_events
  add column if not exists public_site boolean not null default false;

comment on column cal_events.public_site is
  'Visible sur le calendrier public du site. Faux par défaut : la table contient des rendez-vous nominatifs.';

-- Les événements déjà connus comme publics. Les fermetures et les camps n'ont
-- pas besoin du drapeau : leur genre suffit (voir agenda_public).
update cal_events set public_site = true
 where kind = 'evenement'
   and (title ilike 'Lausanne Open%'
     or title ilike '%Halloween%'
     or title ilike 'Activité joueurs%'
     or title ~ '^Session (Compétition|Performance)');

commit;

-- ---------------------------------------------------------------------------
-- La fonction lue par le site.
--
-- Cinq genres, que le site colore : vacances-scolaires, ferie, fermeture,
-- stage, evenement. Les dates sont rendues en bornes incluses.
--
-- Les camps apparaissent deux fois dans les données : une session de stage
-- (celle où les parents s'inscrivent) et un repère dans le calendrier interne.
-- On prend la session, et on ne garde le repère que s'il ne correspond à
-- aucune session — sinon le camp s'afficherait en double.

create or replace function public.agenda_public(p_du date, p_au date)
returns table (debut date, fin date, titre text, genre text, detail text)
language sql
stable
security definer
set search_path = public
as $$
  -- Vacances scolaires vaudoises.
  select h.start_date, h.end_date, h.label, 'vacances-scolaires',
         'Vacances scolaires vaudoises'
    from school_holidays h
   where h.canton = 'VD' and h.end_date >= p_du and h.start_date <= p_au

  union all
  -- Jours fériés.
  select f.day, f.day, f.label, 'ferie', 'Jour férié'
    from public_holidays f
   where f.canton = 'VD' and f.day between p_du and p_au

  union all
  -- Académie fermée.
  select e.start_date, e.end_date, e.title, 'fermeture',
         coalesce(e.note, 'Team Lausanne est fermé')
    from cal_events e
   where e.kind = 'fermeture' and e.status = 'valide'
     and e.end_date >= p_du and e.start_date <= p_au

  union all
  -- Stages, depuis les sessions ouvertes aux inscriptions.
  select s.start_date, s.end_date, s.title, 'stage',
         'Stage — inscriptions ouvertes'
    from stage_sessions s
   where s.visible and s.end_date >= p_du and s.start_date <= p_au

  union all
  -- Camps notés au calendrier sans session correspondante.
  select e.start_date, e.end_date, e.title, 'stage', coalesce(e.note, 'Stage')
    from cal_events e
   where e.kind = 'camp' and e.status = 'valide'
     and e.end_date >= p_du and e.start_date <= p_au
     and not exists (select 1 from stage_sessions s
                      where s.visible
                        and s.start_date = e.start_date and s.end_date = e.end_date)

  union all
  -- Événements explicitement publiés.
  select e.start_date, e.end_date, e.title, 'evenement', e.note
    from cal_events e
   where e.kind = 'evenement' and e.status = 'valide' and e.public_site
     and e.end_date >= p_du and e.start_date <= p_au

  order by 1, 3;
$$;

-- Ouverte au site public ; les vacances de l'équipe ne passent par aucune des
-- branches ci-dessus.
grant execute on function public.agenda_public(date, date) to anon, authenticated;
