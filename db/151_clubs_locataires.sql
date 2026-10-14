-- Clubs de tennis locataires : les clubs qui louent nos courts l'hiver (14.10.2026).
--
-- Rien ne les tenait. Le répertoire ne connaît que des PERSONNES — prénom,
-- nom, date de naissance — et un club n'en est pas une : il n'a pas d'âge, pas
-- de parents, pas de filière, et le facturer demande des choses qu'une fiche
-- de personne n'a pas (un n° IDE, une adresse de facturation qui n'est pas un
-- domicile, un interlocuteur qui change). Les forcer dans `people` aurait sali
-- le répertoire et faussé tous les comptages de membres.
--
-- Table à part, donc, et l'onglet Répertoire gagne un sous-onglet.
--
-- Ne pas confondre avec `people.club`, qui est le club D'ORIGINE d'un joueur
-- (son affiliation Swiss Tennis), ni avec `winter_plan`, qui est le planning
-- des abonnements INDIVIDUELS de l'hiver. Ici : des organisations qui nous
-- louent des courts et à qui nous envoyons une facture.

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  -- Adresse de FACTURATION : c'est elle qui part sur la facture, et ce n'est
  -- pas forcément celle du club-house.
  address text,
  postal_code text,
  city text,
  country text not null default 'Suisse',
  -- L'interlocuteur. Il change plus souvent que le club : on le garde ici
  -- plutôt que d'inventer une fiche de personne pour un contact externe.
  contact_name text,
  contact_role text,
  contact_email text,
  contact_phone text,
  -- N° IDE suisse (CHE-123.456.789), quand le club en a un. Pas de contrainte
  -- de format : certaines associations n'en ont pas, et un champ qui refuse
  -- une saisie légitime est pire qu'un champ vide.
  ide text,
  notes text,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists clubs_nom_idx on public.clubs(lower(name));

-- Ce que le club loue. Volontairement souple : certains paient à l'heure,
-- d'autres un forfait de saison. On garde les deux — heures × tarif donne un
-- montant, et `amount_chf` peut le remplacer quand c'est un forfait négocié.
create table if not exists public.club_rentals (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_label text not null default '2026/27',
  label text,
  -- 1 = lundi … 7 = dimanche (ISO), pour pouvoir trier une semaine type.
  weekday smallint check (weekday between 1 and 7),
  start_time time,
  end_time time,
  courts text,
  hours numeric(7, 2) check (hours is null or hours >= 0),
  rate_chf numeric(10, 2) check (rate_chf is null or rate_chf >= 0),
  amount_chf numeric(10, 2) check (amount_chf is null or amount_chf >= 0),
  notes text,
  created_at timestamptz not null default now(),
  constraint club_rental_heures_ordre check (start_time is null or end_time is null or end_time > start_time)
);
create index if not exists club_rentals_club_idx on public.club_rentals(club_id, season_label);

-- Le montant qui compte : le forfait s'il est posé, sinon heures × tarif.
-- En base plutôt qu'en JavaScript, pour que la facture et l'écran ne puissent
-- pas donner deux chiffres différents.
create or replace function public.club_rental_montant(r public.club_rentals)
returns numeric language sql immutable as $$
  select coalesce(r.amount_chf, round(coalesce(r.hours, 0) * coalesce(r.rate_chf, 0), 2));
$$;

alter table public.clubs        enable row level security;
alter table public.club_rentals enable row level security;

drop policy if exists clubs_staff on public.clubs;
create policy clubs_staff on public.clubs for all
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

drop policy if exists club_rentals_staff on public.club_rentals;
create policy club_rentals_staff on public.club_rentals for all
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));

grant select, insert, update, delete on public.clubs        to authenticated;
grant select, insert, update, delete on public.club_rentals to authenticated;
