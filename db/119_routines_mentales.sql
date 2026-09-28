-- 28.09.2026 (décision Dan) : routines MENTALES éditables dans la console (Mental › Routines), comme les routines
-- physiques (db/111) : une routine = un titre, un moment (avant / pendant / après match, autre), une consigne et une
-- liste de conseils [{title, text}] ; attribuée À TITRE INDIVIDUEL. Fred (coach mental) les édite.
-- Mon espace › Mental les affiche (compétition et performance : à la place de Messages / Après séance).
-- Les 3 routines de départ = les 15 conseils mis en dur dans Mon espace le même jour, attribuées aux jeunes
-- compétition et performance de la saison juniors en cours.

create or replace function public.can_mental_edit(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
                 and role::text in ('coach_mental', 'head_coach', 'admin', 'superadmin'));
$$;

create table if not exists public.mental_routines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'autre' check (kind in ('avant', 'pendant', 'apres', 'autre')),
  intro text,
  items jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.mental_routine_assign (
  routine_id uuid not null references public.mental_routines(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  assigned_by uuid default auth.uid(),
  assigned_at timestamptz not null default now(),
  primary key (routine_id, person_id)
);
alter table public.mental_routines enable row level security;
alter table public.mental_routine_assign enable row level security;
drop policy if exists mr_edit on public.mental_routines;
create policy mr_edit on public.mental_routines for all to authenticated
  using (can_mental_edit(auth.uid())) with check (can_mental_edit(auth.uid()));
drop policy if exists mra_edit on public.mental_routine_assign;
create policy mra_edit on public.mental_routine_assign for all to authenticated
  using (can_mental_edit(auth.uid())) with check (can_mental_edit(auth.uid()));
grant select, insert, update, delete on public.mental_routines, public.mental_routine_assign to authenticated;

-- Jeunes à qui on peut attribuer une routine : les 5 filières de la saison juniors en cours (noms seulement :
-- le coach mental ne lit pas tout le répertoire).
create or replace function public.mental_routine_youths()
returns table(person_id uuid, first_name text, last_name text, fil text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_mental_edit(auth.uid()) then raise exception 'Accès refusé'; end if;
  return query
    select distinct on (pe.id) pe.id, pe.first_name, pe.last_name, rp.role
    from role_periods rp join seasons s on s.id = rp.season_id join people pe on pe.id = rp.person_id
    where s.kind = 'juniors' and current_date between s.start_date and s.end_date
      and rp.role in ('sport-etudes', 'pro', 'pro-u18', 'competition', 'performance')
    order by pe.id, array_position(array['pro', 'pro-u18', 'sport-etudes', 'performance', 'competition'], rp.role);
end $$;
revoke all on function public.mental_routine_youths() from public, anon;
grant execute on function public.mental_routine_youths() to authenticated;

-- Routines d'un jeune (Mon espace et aperçu console).
create or replace function public.portal_mental_routines(p_youth uuid)
returns setof public.mental_routines language plpgsql stable security definer set search_path = public as $$
begin
  if not (can_mental_edit(auth.uid()) or can_read_public_of(p_youth)) then raise exception 'Accès refusé'; end if;
  return query select r.* from mental_routines r join mental_routine_assign a on a.routine_id = r.id
    where a.person_id = p_youth
    order by case r.kind when 'avant' then 1 when 'pendant' then 2 when 'apres' then 3 else 4 end, r.title;
end $$;
revoke all on function public.portal_mental_routines(uuid) from public, anon;
grant execute on function public.portal_mental_routines(uuid) to authenticated;

-- Les 3 routines de départ (une seule fois).
do $$
declare r_avant uuid; r_pendant uuid; r_apres uuid;
begin
  if exists (select 1 from mental_routines) then return; end if;
  insert into mental_routines(title, kind, intro, items, created_by) values
  ('Avant le match', 'avant', 'Cinq conseils à relire la veille et le jour J.', $j$[
    {"title":"Prépare ton sac la veille","text":"Deux raquettes cordées, grips, bouteille, en-cas, tenue de rechange. Le jour J, ta tête est libre pour le tennis."},
    {"title":"Fixe-toi un objectif de jeu","text":"Un ou deux objectifs que tu contrôles (« jouer long croisé », « avancer sur les balles courtes ») plutôt que « gagner »."},
    {"title":"Échauffe-toi vraiment","text":"Ta routine de 10 minutes (onglet Physique) puis quelques frappes. Un corps chaud, c'est une tête plus calme."},
    {"title":"Accueille le trac","text":"Le stress est normal, c'est de l'énergie. Avant d'entrer sur le court, respire lentement quelques fois : 4 secondes pour inspirer, 6 pour expirer."},
    {"title":"Oublie le classement de l'autre","text":"Il ne joue pas à ta place. Concentre-toi sur ton jeu et sur ce que tu as prévu."}]$j$::jsonb, null)
  returning id into r_avant;
  insert into mental_routines(title, kind, intro, items, created_by) values
  ('Pendant le match', 'pendant', 'Ce qui t''aide à rester dans ton match, point après point.', $j$[
    {"title":"Une routine entre les points","text":"Tourne le dos au filet, arrange tes cordes, respire, puis décide de ton prochain point. Toujours la même, même quand tout va bien."},
    {"title":"Un point à la fois","text":"Le point perdu est terminé. Le seul qui compte, c'est le suivant."},
    {"title":"Parle-toi comme un coach","text":"« Allez, bouge tes pieds » plutôt que « t'es nul ». Tu joues mieux avec un allié dans la tête qu'avec un juge."},
    {"title":"Profite des changements de côté","text":"Bois, mange un peu si le match est long, et fais le point : qu'est-ce qui marche ? qu'est-ce que je change ?"},
    {"title":"Quand ça va mal, simplifie","text":"Plus de marge, balles hautes et au centre, jusqu'à retrouver ton rythme. Garde la tête haute, même mené au score."}]$j$::jsonb, null)
  returning id into r_pendant;
  insert into mental_routines(title, kind, intro, items, created_by) values
  ('Après le match', 'apres', 'Gagné ou perdu, le match continue de te faire progresser.', $j$[
    {"title":"Fair-play d'abord","text":"Serre la main et remercie ton adversaire et l'arbitre, quel que soit le résultat."},
    {"title":"Récupère","text":"Décrassage de 10 minutes (onglet Physique), bois, et mange dans l'heure qui suit."},
    {"title":"Laisse retomber les émotions","text":"On analyse un match à froid, pas à chaud. Prends un moment avant de le juger."},
    {"title":"Remplis ta feuille de match","text":"Onglet Match : deux choses réussies et une chose à travailler, c'est déjà beaucoup."},
    {"title":"Parles-en, puis passe à la suite","text":"Discutes-en avec ton coach au prochain entraînement. Une défaite est une information, une victoire aussi."}]$j$::jsonb, null)
  returning id into r_apres;
  insert into mental_routine_assign(routine_id, person_id, assigned_by)
    select r.id, y.pid, null
    from (values (r_avant), (r_pendant), (r_apres)) r(id)
    cross join (select distinct rp.person_id pid from role_periods rp join seasons s on s.id = rp.season_id
                where s.kind = 'juniors' and current_date between s.start_date and s.end_date
                  and rp.role in ('competition', 'performance')) y
    on conflict do nothing;
end $$;
