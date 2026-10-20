-- 194 — Marquer, dans l'agenda d'une famille, ce qui vise SA filière.
--
-- Demande du 20.10.2026 : « le calendrier doit rappeler leurs trois sessions
-- Compétition ». Elles y figuraient déjà depuis db/191 — mais perdues dans la
-- grille de février et celle d'avril, qu'il faut aller chercher. Figurer n'est
-- pas rappeler.
--
-- agenda_famille rend donc une colonne « cible » : vrai pour les événements
-- servis par la branche ciblée, faux pour tout ce qui vient du calendrier
-- public. L'app peut alors les réunir en haut de l'onglet, sous l'entête de
-- saison : « Vos rendez-vous ».
--
-- Générique à dessein : rien n'est écrit sur la compétition. Un sport-études
-- y verra son Activité joueurs, un pro ce qui le visera demain. Coder « les
-- trois sessions » aurait réglé la demande du jour et créé une règle de plus
-- à maintenir à la main chaque saison.

begin;

drop function if exists public.agenda_famille(date, date, uuid);

create or replace function public.agenda_famille(p_du date, p_au date, p_youth uuid default null)
returns table(debut date, fin date, titre text, genre text, detail text, cible boolean)
language sql stable security definer set search_path to 'public' as $$
  with miennes as (select filiere from portal_mes_filieres(p_youth))
  select a.debut, a.fin, a.titre, a.genre, a.detail, false
    from agenda_public(p_du, p_au) a
  union all
  select e.start_date, e.end_date, e.title, 'evenement', e.note, true
    from cal_events e
   where e.kind = 'evenement' and e.status = 'valide'
     and e.end_date >= p_du and e.start_date <= p_au
     and coalesce(array_length(e.audiences, 1), 0) > 0
     and exists (select 1 from miennes m where m.filiere = any(e.audiences))
  order by 1, 3;
$$;

comment on function public.agenda_famille(date, date, uuid) is
  'Agenda de Mon espace : le calendrier public, plus les événements qui visent une filière de la famille, marqués « cible » (db/191, db/194).';

revoke all on function public.agenda_famille(date, date, uuid) from public, anon;
grant execute on function public.agenda_famille(date, date, uuid) to authenticated;

commit;
