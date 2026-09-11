-- Project Manager : un tableau facon Trello dans la console.
--
-- Colonnes, cartes, membres et etiquettes sont tous des lignes modifiables :
-- l'equipe doit pouvoir ajouter une colonne, une personne ou une etiquette
-- sans qu'on touche au code.
--
-- sort_order est en double precision, et non en entier : pour deposer une carte
-- entre deux autres il suffit de prendre le milieu des deux rangs voisins, sans
-- renumeroter toute la colonne a chaque glisser-deposer.

create table if not exists pm_columns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists pm_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  initials   text not null,
  color      text not null default '#073eb5',
  person_id  uuid references people(id) on delete set null,
  active     boolean not null default true,
  sort_order double precision not null default 0
);

create table if not exists pm_labels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#9aa3ad',
  sort_order double precision not null default 0
);

create table if not exists pm_cards (
  id          uuid primary key default gen_random_uuid(),
  column_id   uuid not null references pm_columns(id) on delete cascade,
  title       text not null,
  description text,
  start_date  date,
  due_date    date,
  sort_order  double precision not null default 0,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pm_cards_col on pm_cards (column_id, sort_order);

create table if not exists pm_card_members (
  card_id   uuid not null references pm_cards(id)   on delete cascade,
  member_id uuid not null references pm_members(id) on delete cascade,
  primary key (card_id, member_id)
);

create table if not exists pm_card_labels (
  card_id  uuid not null references pm_cards(id)  on delete cascade,
  label_id uuid not null references pm_labels(id) on delete cascade,
  primary key (card_id, label_id)
);

-- Pieces jointes stockees en base, comme celles de la messagerie : le volume
-- attendu est faible et cela evite de gerer un bucket de plus.
create table if not exists pm_attachments (
  id           uuid primary key default gen_random_uuid(),
  card_id      uuid not null references pm_cards(id) on delete cascade,
  filename     text not null,
  content_type text,
  size_bytes   integer,
  content_b64  text,
  created_at   timestamptz not null default now()
);
create index if not exists pm_att_card on pm_attachments (card_id);

-- Le tableau est un outil interne : reserve au staff, en lecture comme en
-- ecriture. is_staff couvre deja admin, secretariat et encadrement.
do $$
declare t text;
begin
  foreach t in array array['pm_columns','pm_members','pm_labels','pm_cards',
                           'pm_card_members','pm_card_labels','pm_attachments']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists pm_staff_all on %I', t);
    execute format(
      'create policy pm_staff_all on %I for all to authenticated
         using (is_staff(auth.uid())) with check (is_staff(auth.uid()))', t);
  end loop;
end $$;

-- Colonnes de depart.
insert into pm_columns (name, sort_order)
select * from (values
  ('À faire', 1.0), ('En cours', 2.0), ('En attente', 3.0), ('Fini', 4.0)
) as v(name, sort_order)
where not exists (select 1 from pm_columns);

-- L'equipe de depart.
insert into pm_members (name, initials, color, sort_order)
select * from (values
  ('Raphael Vergnaud', 'RV', '#073eb5', 1.0),
  ('Dan Hafner',       'DH', '#7b3fb8', 2.0),
  ('Arsalan Huber',    'AH', '#0f8a5f', 3.0),
  ('Séline Rivaroli',  'SR', '#c8442f', 4.0)
) as v(name, initials, color, sort_order)
where not exists (select 1 from pm_members);

-- Etiquettes, aux couleurs du tableau Trello existant.
insert into pm_labels (name, color, sort_order)
select * from (values
  ('Opérations',              '#4bbf73', 1.0),
  ('Admin & Finance',         '#e9d36c', 2.0),
  ('Coaching',                '#e8c33c', 3.0),
  ('Marketing & Comms',       '#f59f1b', 4.0),
  ('Ventes & Sponsoring',     '#ef7c6b', 5.0),
  ('Sport-Études / Academy',  '#b565d8', 6.0),
  ('Événements',              '#1f5fd6', 7.0)
) as v(name, color, sort_order)
where not exists (select 1 from pm_labels);
