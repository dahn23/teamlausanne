-- 191 — « Qui voit cet événement ? » dans le calendrier.
--
-- Demande du 20.10.2026. Le nouvel onglet Calendrier de Mon espace (db/190)
-- montrait à toutes les familles des événements qui n'en concernaient qu'une
-- filière : « Activité joueurs de l'academy » ne parle qu'aux sport-études,
-- les « Sessions Performance 2/6 » qu'aux performance. Sur les six événements
-- aujourd'hui publiés, CINQ sont dans ce cas — le besoin est réel.
--
-- CE QU'ON NE FAIT PAS, et c'est le coeur de la décision : on n'ajoute pas de
-- public aux fermetures, aux vacances scolaires, aux jours fériés ni aux
-- camps. Ceux-là sont identiques pour tout le monde ; leur poser la question à
-- chaque saisie serait un clic sans contrepartie. Seuls les ÉVÉNEMENTS portent
-- un public, parce qu'eux seuls mélangent la journée Halloween et une séance
-- réservée à six joueurs.
--
-- La convention est celle des messages internes (table news) : une liste vide
-- = tout le monde. Le cas courant ne coûte donc rien, et l'ancien contenu
-- reste visible sans migration de données.
--
-- CIBLÉ = INTERNE. Un événement qui vise une filière disparaît du calendrier
-- public du site, quoi que dise la case « afficher sur le site ». Sans cette
-- règle, deux réglages pourraient se contredire et il faudrait se souvenir des
-- deux ; avec elle, cocher une filière suffit. Conséquence voulue : les
-- Sessions Compétition et Performance quittent teamlausanne.ch dès qu'elles
-- sont marquées.

begin;

alter table cal_events add column if not exists audiences text[];

comment on column cal_events.audiences is
  'Filières qui voient cet événement dans Mon espace. Vide = toutes. Ne concerne que kind = evenement ; un événement ciblé ne sort pas sur le site public.';

-- --- Le site public : les événements ciblés n'y figurent plus ---------------
create or replace function public.agenda_public(p_du date, p_au date)
returns table(debut date, fin date, titre text, genre text, detail text)
language sql stable security definer set search_path to 'public' as $$
  select h.start_date, h.end_date, h.label, 'vacances-scolaires',
         'Vacances scolaires vaudoises'
    from school_holidays h
   where h.canton = 'VD' and h.end_date >= p_du and h.start_date <= p_au
  union all
  select f.day, f.day, f.label, 'ferie', 'Jour férié'
    from public_holidays f
   where f.canton = 'VD' and f.day between p_du and p_au
  union all
  select e.start_date, e.end_date, e.title, 'fermeture',
         coalesce(e.note, 'Team Lausanne est fermé')
    from cal_events e
   where e.kind = 'fermeture' and e.status = 'valide'
     and e.end_date >= p_du and e.start_date <= p_au
  union all
  select s.start_date, s.end_date, s.title, 'stage', 'Stage — inscriptions ouvertes'
    from stage_sessions s
   where s.visible and s.end_date >= p_du and s.start_date <= p_au
  union all
  select e.start_date, e.end_date, e.title, 'stage', coalesce(e.note, 'Stage')
    from cal_events e
   where e.kind = 'camp' and e.status = 'valide'
     and e.end_date >= p_du and e.start_date <= p_au
     and not exists (select 1 from stage_sessions s
                      where s.visible and s.start_date = e.start_date and s.end_date = e.end_date)
  union all
  select e.start_date, e.end_date, e.title, 'evenement', e.note
    from cal_events e
   where e.kind = 'evenement' and e.status = 'valide' and e.public_site
     and coalesce(array_length(e.audiences, 1), 0) = 0   -- ciblé = interne
     and e.end_date >= p_du and e.start_date <= p_au
  order by 1, 3;
$$;

-- --- Mon espace : le même agenda, plus ce qui vise MA filière ---------------
--
-- Un événement est visible par une famille quand :
--   · il ne vise personne en particulier ET il est publié (Halloween), ou
--   · il vise une filière de la famille (Activité joueurs, Sessions).
-- Le reste de cal_events — rendez-vous nominatifs, déjeuners, essais,
-- absences — n'a ni public ni publication : il ne sort donc pas, comme avant.
--
-- p_youth : null = toute la famille. Renseigné = ce jeune-là, pour l'aperçu
-- de la console (db/187) et le sélecteur d'enfant du portail.
create or replace function public.agenda_famille(p_du date, p_au date, p_youth uuid default null)
returns table(debut date, fin date, titre text, genre text, detail text)
language sql stable security definer set search_path to 'public' as $$
  with miennes as (select filiere from portal_mes_filieres(p_youth))
  select a.debut, a.fin, a.titre, a.genre, a.detail
    from agenda_public(p_du, p_au) a
  union all
  select e.start_date, e.end_date, e.title, 'evenement', e.note
    from cal_events e
   where e.kind = 'evenement' and e.status = 'valide'
     and e.end_date >= p_du and e.start_date <= p_au
     and coalesce(array_length(e.audiences, 1), 0) > 0
     and exists (select 1 from miennes m where m.filiere = any(e.audiences))
  order by 1, 3;
$$;

comment on function public.agenda_famille(date, date, uuid) is
  'Agenda de Mon espace : le calendrier public, plus les événements qui visent une filière de la famille (db/191).';

revoke all on function public.agenda_famille(date, date, uuid) from public, anon;
grant execute on function public.agenda_famille(date, date, uuid) to authenticated;

commit;
