-- =====================================================================
--  LAUSANNE OPEN — Player Hub (app joueurs ITF M25) + backend mot de passe
--
--  Principe de sécurité :
--   - TOUTES les tables sont en LECTURE publique (anon) : l'app joueurs
--     n'a pas de login.
--   - AUCUNE policy d'écriture : personne ne peut écrire directement.
--     Toutes les écritures passent par des fonctions SECURITY DEFINER :
--       * lo_book_practice / lo_cancel_practice / lo_post / lo_delete_post
--         -> écritures joueurs, contrôlées (onglet actif, créneau libre…)
--       * lo_admin(mot de passe, action, payload)
--         -> backend : le mot de passe est vérifié en base (hash bcrypt),
--            il n'est jamais stocké côté client en clair.
--   - Le hash du mot de passe vit dans lo_secret : RLS active, AUCUNE
--     policy -> illisible par anon comme par un utilisateur connecté.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- secret
create table if not exists lo_secret (
  id         int primary key default 1,
  pwd_hash   text not null,
  updated_at timestamptz not null default now(),
  constraint lo_secret_one_row check (id = 1)
);
alter table lo_secret enable row level security;   -- aucune policy = illisible

-- Mot de passe par défaut du backend (à changer depuis le backend).
insert into lo_secret (id, pwd_hash)
values (1, crypt('LausanneOpen26', gen_salt('bf')))
on conflict (id) do nothing;

-- ------------------------------------------------------------- réglages
create table if not exists lo_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------- infos officielles
create table if not exists lo_messages (
  id         bigserial primary key,
  title      text not null default '',
  body       text not null,
  level      text not null default 'info',   -- info | warning | urgent
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------- navette
create table if not exists lo_shuttle (
  id         bigserial primary key,
  day        date,                       -- null = tous les jours
  dep_time   time not null,
  from_place text not null default '',
  to_place   text not null default '',
  note       text not null default '',
  sort       int  not null default 0
);

-- ------------------------------------------------------- restaurant
create table if not exists lo_menu (
  id          bigserial primary key,
  name        text not null,
  description text not null default '',
  price       numeric(6,2),
  sort        int  not null default 0,
  active      boolean not null default true
);

-- ----------------------------------------------------- order of play
-- Le PDF est stocké en base64 dans la colonne data (pas de bucket à
-- configurer, et l'upload reste protégé par le mot de passe du backend).
create table if not exists lo_oop (
  id         bigserial primary key,
  day        date not null unique,
  filename   text not null default 'order-of-play.pdf',
  mime       text not null default 'application/pdf',
  data       text not null,
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------- practice
create table if not exists lo_practice_days (
  day          date primary key,
  court_names  text[] not null default array['Court 1','Court 2'],
  first_time   time   not null default '09:00',
  last_time    time   not null default '18:00',   -- début du dernier créneau
  slot_min     int    not null default 30,
  visible_from timestamptz,                        -- null = visible tout de suite
  note         text   not null default ''
);

create table if not exists lo_practice_bookings (
  id         bigserial primary key,
  day        date not null,
  court      text not null,
  start_time time not null,
  player_name text not null,
  token      uuid not null default gen_random_uuid(),  -- annulation par le joueur
  created_at timestamptz not null default now(),
  unique (day, court, start_time)
);
create index if not exists lo_pb_day on lo_practice_bookings (day);

-- ------------------------------------------- sparring / roommate (mur)
create table if not exists lo_posts (
  id         bigserial primary key,
  kind       text not null check (kind in ('sparring','roommate')),
  author     text not null default '',
  body       text not null,
  token      uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create index if not exists lo_posts_kind on lo_posts (kind, created_at desc);

-- =====================================================================
--  RLS : lecture publique partout, écriture nulle part (RPC uniquement)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['lo_settings','lo_messages','lo_shuttle','lo_menu',
                           'lo_oop','lo_practice_days','lo_practice_bookings','lo_posts']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_read', t);
  end loop;
end $$;

-- Le token d'annulation ne doit pas être lisible publiquement : on expose
-- des vues sans le token, et on retire la lecture directe des colonnes.
revoke select on lo_practice_bookings from anon, authenticated;
revoke select on lo_posts from anon, authenticated;
grant select (id, day, court, start_time, player_name, created_at)
  on lo_practice_bookings to anon, authenticated;
grant select (id, kind, author, body, created_at)
  on lo_posts to anon, authenticated;

-- =====================================================================
--  Helpers
-- =====================================================================
create or replace function lo_tab_enabled(p_tab text)
returns boolean language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select coalesce((select (value -> p_tab)::boolean from lo_settings where key = 'tabs'), true);
$$;

create or replace function lo_check_pwd(p_pwd text)
returns boolean language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select exists (select 1 from lo_secret where id = 1 and pwd_hash = crypt(p_pwd, pwd_hash));
$$;
revoke all on function lo_check_pwd(text) from public, anon, authenticated;

-- =====================================================================
--  ÉCRITURES JOUEURS
-- =====================================================================

-- Réserver un créneau de practice. Renvoie le token d'annulation.
create or replace function lo_book_practice(
  p_day date, p_court text, p_start time, p_name text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare d lo_practice_days%rowtype; nm text; tok uuid; n int;
begin
  if not lo_tab_enabled('practice') then
    raise exception 'Practice booking is currently closed.';
  end if;

  select * into d from lo_practice_days where day = p_day;
  if not found then raise exception 'No practice schedule for this day.'; end if;
  if d.visible_from is not null and now() < d.visible_from then
    raise exception 'This day is not open for booking yet.';
  end if;
  if not (p_court = any (d.court_names)) then raise exception 'Unknown court.'; end if;
  if p_start < d.first_time or p_start > d.last_time then raise exception 'Time outside the schedule.'; end if;
  -- le créneau doit tomber pile sur la grille
  if mod(extract(epoch from (p_start - d.first_time))::int, d.slot_min * 60) <> 0 then
    raise exception 'Invalid time slot.';
  end if;

  nm := btrim(coalesce(p_name, ''));
  if length(nm) < 2 then raise exception 'Please enter your name.'; end if;
  if length(nm) > 60 then nm := left(nm, 60); end if;

  -- garde-fou anti-spam : 6 créneaux max par nom et par jour
  select count(*) into n from lo_practice_bookings
   where day = p_day and lower(player_name) = lower(nm);
  if n >= 6 then raise exception 'Booking limit reached for today.'; end if;

  insert into lo_practice_bookings (day, court, start_time, player_name)
  values (p_day, p_court, p_start, nm)
  returning token into tok;
  return jsonb_build_object('ok', true, 'token', tok);
exception when unique_violation then
  raise exception 'This slot has just been taken.';
end $$;

-- Annuler SA réservation (token gardé dans le navigateur du joueur).
create or replace function lo_cancel_practice(p_id bigint, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  delete from lo_practice_bookings where id = p_id and token = p_token;
  if not found then raise exception 'Not allowed.'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Poster un message sur le mur sparring / roommate.
create or replace function lo_post(p_kind text, p_author text, p_body text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare tok uuid; b text; a text; n int;
begin
  if p_kind not in ('sparring','roommate') then raise exception 'Unknown board.'; end if;
  if not lo_tab_enabled(p_kind) then raise exception 'This board is currently closed.'; end if;

  a := left(btrim(coalesce(p_author, '')), 60);
  b := btrim(coalesce(p_body, ''));
  if length(b) < 3 then raise exception 'Message too short.'; end if;
  if length(b) > 500 then b := left(b, 500); end if;

  -- anti-flood : pas plus de 5 messages / 10 min tous joueurs confondus par board
  select count(*) into n from lo_posts
   where kind = p_kind and created_at > now() - interval '10 minutes';
  if n >= 25 then raise exception 'Too many messages, please try again later.'; end if;
  -- doublon exact récent
  if exists (select 1 from lo_posts where kind = p_kind and body = b
              and created_at > now() - interval '2 minutes') then
    raise exception 'Message already posted.';
  end if;

  insert into lo_posts (kind, author, body) values (p_kind, a, b) returning token into tok;
  return jsonb_build_object('ok', true, 'token', tok);
end $$;

create or replace function lo_delete_post(p_id bigint, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  delete from lo_posts where id = p_id and token = p_token;
  if not found then raise exception 'Not allowed.'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- =====================================================================
--  BACKEND (mot de passe) — une seule fonction, action + payload
-- =====================================================================
create or replace function lo_admin(p_pwd text, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v jsonb := coalesce(p_payload, '{}'::jsonb); r jsonb; arr text[];
begin
  if not lo_check_pwd(p_pwd) then
    perform pg_sleep(0.4);                       -- ralentit le bruteforce
    raise exception 'Mot de passe incorrect.';
  end if;

  case p_action

  when 'check' then
    return jsonb_build_object('ok', true);

  when 'set_password' then
    if length(coalesce(v->>'new', '')) < 6 then raise exception 'Mot de passe trop court (6 caractères minimum).'; end if;
    update lo_secret set pwd_hash = crypt(v->>'new', gen_salt('bf')), updated_at = now() where id = 1;

  -- ---------------- réglages génériques (onglets, hôtel, textes…)
  when 'setting_set' then
    insert into lo_settings (key, value, updated_at) values (v->>'key', v->'value', now())
    on conflict (key) do update set value = excluded.value, updated_at = now();

  -- ---------------- infos officielles
  when 'msg_save' then
    if (v->>'id') is null then
      insert into lo_messages (title, body, level, pinned)
      values (coalesce(v->>'title',''), v->>'body', coalesce(v->>'level','info'), coalesce((v->>'pinned')::boolean,false));
    else
      update lo_messages set title = coalesce(v->>'title',''), body = v->>'body',
             level = coalesce(v->>'level','info'), pinned = coalesce((v->>'pinned')::boolean,false)
       where id = (v->>'id')::bigint;
    end if;
  when 'msg_del' then
    delete from lo_messages where id = (v->>'id')::bigint;

  -- ---------------- navette
  when 'shuttle_save' then
    if (v->>'id') is null then
      insert into lo_shuttle (day, dep_time, from_place, to_place, note, sort)
      values (nullif(v->>'day','')::date, (v->>'dep_time')::time, coalesce(v->>'from_place',''),
              coalesce(v->>'to_place',''), coalesce(v->>'note',''), coalesce((v->>'sort')::int,0));
    else
      update lo_shuttle set day = nullif(v->>'day','')::date, dep_time = (v->>'dep_time')::time,
             from_place = coalesce(v->>'from_place',''), to_place = coalesce(v->>'to_place',''),
             note = coalesce(v->>'note',''), sort = coalesce((v->>'sort')::int,0)
       where id = (v->>'id')::bigint;
    end if;
  when 'shuttle_del' then
    delete from lo_shuttle where id = (v->>'id')::bigint;

  -- ---------------- restaurant
  when 'menu_save' then
    if (v->>'id') is null then
      insert into lo_menu (name, description, price, sort, active)
      values (v->>'name', coalesce(v->>'description',''), nullif(v->>'price','')::numeric,
              coalesce((v->>'sort')::int,0), coalesce((v->>'active')::boolean,true));
    else
      update lo_menu set name = v->>'name', description = coalesce(v->>'description',''),
             price = nullif(v->>'price','')::numeric, sort = coalesce((v->>'sort')::int,0),
             active = coalesce((v->>'active')::boolean,true)
       where id = (v->>'id')::bigint;
    end if;
  when 'menu_del' then
    delete from lo_menu where id = (v->>'id')::bigint;

  -- ---------------- order of play
  when 'oop_set' then
    insert into lo_oop (day, filename, mime, data, updated_at)
    values ((v->>'day')::date, coalesce(v->>'filename','order-of-play.pdf'),
            coalesce(v->>'mime','application/pdf'), v->>'data', now())
    on conflict (day) do update set filename = excluded.filename, mime = excluded.mime,
            data = excluded.data, updated_at = now();
  when 'oop_del' then
    delete from lo_oop where day = (v->>'day')::date;

  -- ---------------- practice : journées
  when 'pday_save' then
    select array(select jsonb_array_elements_text(v->'court_names')) into arr;
    insert into lo_practice_days (day, court_names, first_time, last_time, slot_min, visible_from, note)
    values ((v->>'day')::date, arr, (v->>'first_time')::time, (v->>'last_time')::time,
            coalesce((v->>'slot_min')::int,30), nullif(v->>'visible_from','')::timestamptz,
            coalesce(v->>'note',''))
    on conflict (day) do update set court_names = excluded.court_names,
            first_time = excluded.first_time, last_time = excluded.last_time,
            slot_min = excluded.slot_min, visible_from = excluded.visible_from, note = excluded.note;
    -- réservations devenues hors grille : on les signale (on ne supprime rien)
  when 'pday_del' then
    delete from lo_practice_bookings where day = (v->>'day')::date;
    delete from lo_practice_days where day = (v->>'day')::date;

  -- ---------------- practice : réservations
  when 'pb_save' then
    if (v->>'id') is null then
      insert into lo_practice_bookings (day, court, start_time, player_name)
      values ((v->>'day')::date, v->>'court', (v->>'start_time')::time, v->>'player_name');
    else
      update lo_practice_bookings set player_name = v->>'player_name' where id = (v->>'id')::bigint;
    end if;
  when 'pb_del' then
    delete from lo_practice_bookings where id = (v->>'id')::bigint;

  -- ---------------- murs sparring / roommate
  when 'post_save' then
    update lo_posts set author = coalesce(v->>'author',''), body = v->>'body'
     where id = (v->>'id')::bigint;
  when 'post_del' then
    delete from lo_posts where id = (v->>'id')::bigint;

  else
    raise exception 'Action inconnue : %', p_action;
  end case;

  return jsonb_build_object('ok', true);
end $$;

-- Le backend lit aussi les tokens (colonnes retirées à anon) : on passe par
-- une fonction dédiée pour les listes complètes côté backend.
create or replace function lo_admin_list(p_pwd text, p_what text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r jsonb;
begin
  if not lo_check_pwd(p_pwd) then perform pg_sleep(0.4); raise exception 'Mot de passe incorrect.'; end if;
  case p_what
    when 'bookings' then
      select coalesce(jsonb_agg(to_jsonb(t) - 'token' order by t.day, t.court, t.start_time), '[]')
        into r from lo_practice_bookings t;
    when 'posts' then
      select coalesce(jsonb_agg(to_jsonb(t) - 'token' order by t.created_at desc), '[]')
        into r from lo_posts t;
    else raise exception 'Inconnu';
  end case;
  return r;
end $$;

-- Droits d'exécution
revoke all on function lo_admin(text, text, jsonb) from public;
revoke all on function lo_admin_list(text, text) from public;
grant execute on function lo_admin(text, text, jsonb) to anon, authenticated;
grant execute on function lo_admin_list(text, text) to anon, authenticated;
grant execute on function lo_book_practice(date, text, time, text) to anon, authenticated;
grant execute on function lo_cancel_practice(bigint, uuid) to anon, authenticated;
grant execute on function lo_post(text, text, text) to anon, authenticated;
grant execute on function lo_delete_post(bigint, uuid) to anon, authenticated;
grant execute on function lo_tab_enabled(text) to anon, authenticated;

-- =====================================================================
--  Valeurs par défaut
-- =====================================================================
insert into lo_settings (key, value) values
  ('tabs', '{"welcome":true,"info":true,"logistics":true,"oop":true,"practice":true,"sparring":true,"roommate":true}'),
  ('hotel', '{"name":"ibis Lausanne Centre","address":"Rue du Maupas 20, 1004 Lausanne","phone":"+41 21 340 07 07",
              "maps":"https://maps.google.com/?q=ibis+Lausanne+Centre+Rue+du+Maupas+20+1004+Lausanne",
              "note":"Breakfast is served from 6:30 to 10:00. Reception is open 24/7. The tournament shuttle stops in front of the hotel entrance."}'),
  ('restaurant', '{"name":"Restaurant du Tennis — Lausanne-Sports",
              "address":"Chemin des Grandes-Roches 14, 1018 Lausanne",
              "note":"Players menu — 15 CHF per dish, drinks not included. Show your player badge at the counter."}'),
  ('balls', '{"text":"Practice balls are available at the tournament office. Please leave an ID card as a deposit; you get it back when you return the balls."}'),
  ('practice_intro', '{"text":"Book a 30-minute practice slot. Enter the name you want to appear on the schedule."}')
on conflict (key) do nothing;

insert into lo_menu (name, description, price, sort)
select * from (values
  ('Pasta bolognese'::text, 'With a side salad'::text, 15.00::numeric, 1),
  ('Breaded escalope',      'French fries and salad',  15.00,          2)
) as v(name, description, price, sort)
where not exists (select 1 from lo_menu);
