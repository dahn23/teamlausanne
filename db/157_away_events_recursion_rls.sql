-- Déplacements : fin de la récursion infinie dans la RLS (14.10.2026).
--
-- Mariano, en voulant enregistrer le tournoi où il se trouve :
--   « infinite recursion detected in policy for relation "away_events" »
--
-- Faute introduite le matin même, dans db/150. Les policies se renvoyaient
-- l'une à l'autre :
--
--   away_events_concernes  lisait away_players  (ce jeune est-il du voyage ?)
--   away_players_concernes lisait away_events   (ce déplacement est-il visible ?)
--   → et ainsi de suite, jusqu'à ce que Postgres coupe.
--
-- À noter : la policy « staff » ne sauvait pas Mariano pour autant. Postgres
-- évalue TOUTES les policies permissives et les combine par OU ; celle qui
-- boucle est donc évaluée même quand une autre suffirait à autoriser.
--
-- Le correctif casse le cycle sans rien changer aux droits : la question
-- « ce déplacement me concerne-t-il ? » passe par une fonction SECURITY
-- DEFINER. Elle s'exécute avec les droits du propriétaire des tables, qui
-- n'est pas soumis à la RLS — la lecture de away_players ne déclenche donc
-- plus la policy de away_players, et la boucle n'existe plus.
--
-- La règle à retenir pour la suite : une policy ne doit jamais lire une table
-- qui, elle-même, lit la première dans sa propre policy. Dès que deux tables
-- se protègent mutuellement, le test de visibilité passe par une fonction.

create or replace function public.away_me_concerne(p_event uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from away_players p
                  where p.event_id = p_event and p.person_id in (select my_family_ids()))
      or exists (select 1 from away_coaches c
                  where c.event_id = p_event and c.coach_person_id in (select my_family_ids()));
$function$;

revoke all on function public.away_me_concerne(uuid) from public, anon;
grant execute on function public.away_me_concerne(uuid) to authenticated;

drop policy if exists away_events_concernes on public.away_events;
create policy away_events_concernes on public.away_events for select
  using (public.away_me_concerne(id));

drop policy if exists away_coaches_concernes on public.away_coaches;
create policy away_coaches_concernes on public.away_coaches for select
  using (public.away_me_concerne(event_id));

drop policy if exists away_players_concernes on public.away_players;
create policy away_players_concernes on public.away_players for select
  using (public.away_me_concerne(event_id));

-- Essayé le 14.10.2026 en se mettant dans la peau des comptes réels (rôle
-- authenticated + jeton), donc avec la RLS appliquée comme depuis le
-- navigateur :
--   · Mariano (head_coach) crée un déplacement + 1 coach + 2 joueurs : passe,
--     plus aucune récursion ;
--   · Mariano le relit : il le voit, avec ses participants ;
--   · un compte non-staff étranger au voyage : 0 ligne, sans erreur ;
--   · le même compte rattaché au déplacement : il le voit, avec le coach et
--     les autres joueurs — la visibilité « famille » est intacte.
-- Données d'essai supprimées.
