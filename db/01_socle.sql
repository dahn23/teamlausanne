-- =====================================================================
--  ACADÉMIE DE TENNIS — Couche 1 : le socle  (schéma v1)
--  Auth gérée par Supabase Auth (auth.users). 'profiles' relie un
--  compte de connexion à une personne du fichier.
-- =====================================================================

-- ---- Rôles possibles (un compte peut en cumuler plusieurs) ----
do $$ begin
  create type app_role as enum (
    'superadmin','admin','secretaire','head_coach','coach',
    'membre','junior','parent','organisateur','officiel'
  );
exception when duplicate_object then null; end $$;

-- ---- PERSONNES : le fichier central (membres, juniors, parents, staff) ----
create table if not exists people (
  id            uuid primary key default gen_random_uuid(),
  first_name    text not null,
  last_name     text not null,
  birthdate     date,
  gender        text check (gender in ('F','M','X')),
  email         text,
  phone         text,
  address       text,
  postal_code   text,
  city          text,
  category      text,            -- indicatif : 'membre','junior','parent','staff'
  is_active     boolean not null default true,
  join_date     date,
  notes         text,
  bexio_contact_id integer,      -- lien vers le contact bexio (facturation)
  created_at    timestamptz not null default now()
);

-- ---- COMPTES : lien Supabase Auth <-> personne ----
create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  person_id  uuid references people(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---- RÔLES attribués ----
create table if not exists user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role    app_role not null,
  primary key (user_id, role)
);

-- ---- Liens PARENT / JUNIOR ----
create table if not exists guardianships (
  guardian_id uuid references people(id) on delete cascade,  -- le parent
  child_id    uuid references people(id) on delete cascade,  -- le junior
  relation    text,                                          -- 'parent','tuteur'...
  primary key (guardian_id, child_id)
);

-- ---- COURTS (inventaire + disponibilité par saison) ----
create table if not exists courts (
  id            smallint primary key,          -- 1..N
  name          text not null,                 -- 'Court 1', 'Indoor A'...
  surface       text,                          -- 'terre battue','dur','indoor'...
  location      text check (location in ('outdoor','indoor')),
  open_summer   boolean not null default false,-- utilisable en été (mi-avril→mi-octobre)
  open_winter   boolean not null default false,-- utilisable en hiver (mi-octobre→mi-avril)
  display_order smallint,
  is_active     boolean not null default true
);

-- ---- RÉSERVATIONS de court ----
create table if not exists court_bookings (
  id           uuid primary key default gen_random_uuid(),
  court_id     smallint not null references courts(id),
  booking_date date not null,
  start_time   time not null,
  end_time     time not null,
  booked_by    uuid references people(id),
  kind         text not null default 'libre'
               check (kind in ('libre','cours','tournoi','maintenance')),
  title        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists court_bookings_slot on court_bookings (court_id, booking_date);
-- NB: anti-chevauchement strict à ajouter via contrainte d'exclusion (btree_gist).

-- ---- COURS (stub Couche 1, à étoffer plus tard) ----
create table if not exists lessons (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  coach_id     uuid references people(id),
  level        text,
  weekday      smallint check (weekday between 1 and 7),
  start_time   time,
  end_time     time,
  court_id     smallint references courts(id),
  season       text check (season in ('ete','hiver','annee')),
  max_participants smallint,
  is_active    boolean not null default true
);
create table if not exists lesson_enrollments (
  lesson_id uuid references lessons(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  primary key (lesson_id, person_id)
);

-- ---- Helper : test de rôle (base des règles de sécurité RLS) ----
create or replace function has_role(uid uuid, r app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role = r);
$$;

-- ---- Helper : saison d'une date (été = mi-avril → mi-octobre) ----
create or replace function season_of(d date)
returns text language sql immutable as $$
  select case
    when (extract(month from d), extract(day from d)) >= (4,15)
     and (extract(month from d), extract(day from d)) <  (10,15)
    then 'ete' else 'hiver' end;
$$;

-- RLS : activé partout ; les règles détaillées par rôle seront ajoutées
-- avec le front (lecture large pour les membres, écriture selon rôle).
alter table people            enable row level security;
alter table profiles          enable row level security;
alter table user_roles        enable row level security;
alter table guardianships     enable row level security;
alter table courts            enable row level security;
alter table court_bookings    enable row level security;
alter table lessons           enable row level security;
alter table lesson_enrollments enable row level security;
