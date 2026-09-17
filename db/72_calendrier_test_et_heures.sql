-- Calendrier d'équipe : sessions de test tennis, et horaires facultatifs.
--
-- 1. Un nouveau type d'événement : la session de test tennis (un joueur vient
--    essayer le programme avant de s'engager). Ce n'est ni un camp ni un
--    événement grand public : ça se prépare, ça concerne des coachs précis, et
--    on veut le repérer d'un coup d'œil dans le calendrier.
--
-- 2. Des horaires FACULTATIFS. La plupart des lignes du calendrier occupent des
--    journées entières (fermeture, vacances, camp) : leur imposer une heure
--    serait faux. Mais une session de test ou une réunion a une heure précise,
--    et sans elle la ligne ne sert à rien. Les deux colonnes sont donc nulles
--    par défaut : une ligne sans heure reste une ligne « toute la journée ».

alter table public.cal_events
  add column if not exists start_time time,
  add column if not exists end_time   time;

-- Sur un événement d'UN SEUL jour, une fin avant le début est forcément une
-- erreur de saisie. Sur plusieurs jours, en revanche, « du 12 à 08:00 au 16 à
-- 17:00 » est parfaitement normal : on ne contraint donc que le cas d'un jour.
alter table public.cal_events drop constraint if exists cal_heures_coherentes;
alter table public.cal_events add constraint cal_heures_coherentes check (
  start_date <> end_date
  or start_time is null or end_time is null
  or end_time > start_time
);

-- Une heure de fin seule ne veut rien dire.
alter table public.cal_events drop constraint if exists cal_fin_sans_debut;
alter table public.cal_events add constraint cal_fin_sans_debut check (
  end_time is null or start_time is not null
);

alter table public.cal_events drop constraint if exists cal_kind_connu;
alter table public.cal_events add constraint cal_kind_connu
  check (kind in ('vacances','fermeture','camp','evenement','test'));

-- La liste des semaines transporte désormais les horaires : sans eux, la vue
-- liste afficherait « Test Noah Lopez » sans dire quand.
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
                    'heure_debut', e.start_time, 'heure_fin', e.end_time,
                    'membre', m.name, 'initiales', m.initials, 'couleur', m.color)
                  -- À heure connue, l'ordre chronologique prime : dans une
                  -- journée, on lit ce qui vient d'abord.
                  order by e.start_date, e.start_time nulls first, e.kind)
             from cal_events e left join pm_members m on m.id = e.member_id
            where e.start_date <= s.dimanche and e.end_date >= s.lundi), '[]'::jsonb)
    from semaines s join scol sc on sc.n = s.n
   where can_calendrier(auth.uid())
   order by s.n;
$$;

revoke all on function public.cal_semaines(date, date) from public, anon;
grant execute on function public.cal_semaines(date, date) to authenticated;
