-- Suivi des rendez-vous : familles, point hebdo, déjeuners (14.10.2026).
--
-- LE PROBLÈME N'EST PAS D'OUBLIER DE NOTER UN RENDEZ-VOUS, c'est de ne pas
-- voir qu'une famille n'a plus eu de nouvelles depuis trois mois. Un agenda
-- montre ce qu'on a prévu ; il ne montre jamais ce qu'on a omis de prévoir.
-- C'est exactement le défaut qui a fait rater la newsletter du 01.10 à 160
-- personnes : l'écran annonçait les servis, jamais les manquants.
--
-- On n'enregistre donc pas un agenda mais un JOURNAL DE CONTACTS, et on en
-- déduit qui est en retard. Quatre rythmes :
--
--   famille   — les 14 familles sport-études / pro / pro-U18, deux fois par
--               saison (rentrée, mi-saison). 180 jours entre deux.
--   hebdo     — le point Raphael ↔ Mariano, toutes les semaines. Pas de
--               personne attachée : c'est un rendez-vous à deux, pas un suivi.
--   dejeuner  — Mariano déjeune avec un joueur, deux fois par semaine. 14
--               joueurs à 2/semaine = un tour complet en 7 semaines, soit
--               environ 5 fois par joueur sur la saison. À une fois par
--               semaine le tour prendrait 14 semaines — deux fois par an et
--               par joueur, trop peu pour créer un lien.
--   appel     — les 5 joueurs performance. VOLONTAIREMENT SANS ÉCHÉANCE :
--               « les appeler quand je peux ». Un rappel rouge de plus
--               diluerait ceux qui comptent vraiment. La liste se contente de
--               dire qui n'a pas eu de nouvelles depuis le plus longtemps.
--
-- Ce qui fait que ça tient : ON NE CHOISIT PAS QUI EST LE PROCHAIN. La liste
-- est triée par « le plus longtemps sans contact », donc elle le désigne
-- elle-même, et un joueur sauté remonte en tête au lieu de disparaître.

create table if not exists public.suivi_contacts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('famille', 'hebdo', 'dejeuner', 'appel')),
  -- Le joueur (ou sa famille) concerné. Nul pour le point hebdo.
  person_id uuid references public.people(id) on delete cascade,
  -- Avec qui : Mariano pour les déjeuners et le point hebdo.
  with_person_id uuid references public.people(id) on delete set null,
  planned_on date,
  done_on date,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  -- Une ligne sert à prévoir OU à constater ; vide des deux côtés, elle ne
  -- veut rien dire.
  constraint suivi_prevu_ou_fait check (planned_on is not null or done_on is not null),
  constraint suivi_personne_sauf_hebdo check (kind = 'hebdo' or person_id is not null)
);
create index if not exists suivi_contacts_kind_idx on public.suivi_contacts(kind, done_on desc nulls last);
create index if not exists suivi_contacts_person_idx on public.suivi_contacts(person_id, kind);

alter table public.suivi_contacts enable row level security;
drop policy if exists suivi_contacts_staff on public.suivi_contacts;
create policy suivi_contacts_staff on public.suivi_contacts for all
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));
grant select, insert, update, delete on public.suivi_contacts to authenticated;

-- Qui relève de quel rythme, pour la saison en cours.
create or replace function public.suivi_population(p_kind text)
returns table(person_id uuid, nom text)
language sql stable security definer set search_path to 'public' as $function$
  select p.id, trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,''))
  from people p
  where exists (
    select 1 from role_periods rp
    join seasons s on s.id = rp.season_id
    where rp.person_id = p.id and s.kind = 'juniors'
      and current_date between s.start_date and s.end_date
      and rp.role = any (case when p_kind = 'appel' then array['performance']
                              else array['sport-etudes', 'pro', 'pro-u18'] end))
  order by 2;
$function$;

-- L'état de chaque rythme : qui, vu quand, en retard ou non.
--
-- `jours_cible` est nul pour « appel » : sans échéance, rien n'est jamais en
-- retard, et la liste reste un classement et non une réprimande.
create or replace function public.suivi_etat(p_kind text)
returns table(person_id uuid, nom text, dernier date, jours integer,
              jours_cible integer, en_retard boolean)
language sql stable security definer set search_path to 'public' as $function$
  with cible as (
    select case p_kind when 'famille' then 180 when 'dejeuner' then 49 when 'hebdo' then 7 else null end as j
  ),
  gens as (select person_id, nom from suivi_population(p_kind)),
  dern as (
    select g.person_id, g.nom,
           (select max(c.done_on) from suivi_contacts c
             where c.kind = p_kind and c.person_id = g.person_id and c.done_on is not null) as dernier
    from gens g
  )
  select d.person_id, d.nom, d.dernier,
         case when d.dernier is null then null else (current_date - d.dernier)::int end,
         (select j from cible),
         case when (select j from cible) is null then false
              when d.dernier is null then true
              else (current_date - d.dernier) >= (select j from cible) end
  from dern d
  -- Jamais vu d'abord, puis le plus ancien : la liste désigne le prochain.
  order by d.dernier nulls first, d.nom;
$function$;

revoke all on function public.suivi_population(text) from public, anon;
revoke all on function public.suivi_etat(text) from public, anon;
grant execute on function public.suivi_population(text) to authenticated;
grant execute on function public.suivi_etat(text) to authenticated;
