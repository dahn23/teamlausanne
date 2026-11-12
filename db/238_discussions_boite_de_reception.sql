-- 238 — « Discussions » : une boîte de réception pour les fils des jeunes
-- (Raphael, 12.11.2026)
--
-- POURQUOI. Les fils existaient, mais sans endroit où les voir. Pour savoir si un jeune
-- lui avait écrit, Andreas devait ouvrir Physique, cliquer un joueur, dérouler sous les
-- routines et les vidéos, revenir, cliquer le suivant — dix-huit fois, sans aucune marque
-- de « nouveau ». Frédérique, pire : son fil est au fond de la fiche de chaque jeune.
-- Autrement dit : un jeune écrivait, et personne ne pouvait le savoir. Un premier message
-- resté sans réponse pendant une semaine apprend à un ado que l'app ne sert à rien.
--
-- CE QUE ÇA AJOUTE. Une liste de conversations, la plus récente en haut, avec le début du
-- dernier message et un compteur de non-lus. Rien d'autre : les fils, les droits et les
-- notifications ne bougent pas (db/237).
--
-- « Non lu » = un message DU JEUNE postérieur à mon dernier passage. Les miens ne
-- comptent jamais : répondre ne doit pas rallumer la pastille.

-- 1 ------------------------------------------------------- où j'en étais, par conversation
create table if not exists thread_reads (
  user_id         uuid not null references auth.users(id) on delete cascade,
  canal           text not null check (canal in ('physique', 'mental')),
  youth_person_id uuid not null references people(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (user_id, canal, youth_person_id)
);
comment on table thread_reads is
  'Dernier passage d''un encadrant sur une conversation. Sert au compteur de non-lus.';

alter table thread_reads enable row level security;
drop policy if exists tr_self on thread_reads;
create policy tr_self on thread_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2 ---------------------------------------------------------------- la liste, en une requête
-- Une seule requête pour tout l'écran : dix-huit allers-retours au serveur pour afficher
-- une liste, c'est ce qu'on vient de supprimer côté humain, autant ne pas le refaire côté
-- machine.
--
-- Les jeunes SANS message figurent aussi, en bas : sinon le coach n'a aucun moyen
-- d'engager la conversation depuis cet écran, et il retournerait là d'où on le sort.
create or replace function public.discussions_list()
returns table (canal text, youth_person_id uuid, youth_name text, filiere text,
               dernier_at timestamptz, dernier_auteur text, dernier_staff boolean,
               dernier_extrait text, non_lus integer, total integer)
language sql stable security definer set search_path to 'public' as $fn$
  with canaux as (
    select c from (values ('physique'), ('mental')) v(c) where is_thread_coach(c, auth.uid())
  ),
  msgs as (
    select 'physique'::text as canal, t.youth_person_id, t.created_at, t.author_name,
           t.author_is_staff, t.body, t.file_name
      from phys_thread t where exists (select 1 from canaux where c = 'physique')
    union all
    select 'mental', t.youth_person_id, t.created_at, t.author_name,
           t.author_is_staff, t.body, t.file_name
      from mental_thread t where exists (select 1 from canaux where c = 'mental')
  ),
  -- Les jeunes éligibles sans le moindre message : pro, pro U18, sport-études.
  vides as (
    select cx.c as canal, p.id as youth_person_id
      from canaux cx
      join people p on is_elite_youth(p.id) and coalesce(p.is_active, true)
     where not exists (select 1 from msgs m where m.canal = cx.c and m.youth_person_id = p.id)
  ),
  der as (
    select distinct on (m.canal, m.youth_person_id)
           m.canal, m.youth_person_id, m.created_at, m.author_name, m.author_is_staff, m.body, m.file_name
      from msgs m order by m.canal, m.youth_person_id, m.created_at desc
  ),
  tout as (
    select d.canal, d.youth_person_id, d.created_at, d.author_name, d.author_is_staff, d.body, d.file_name from der d
    union all
    select v.canal, v.youth_person_id, null, null, null, null, null from vides v
  )
  select t.canal, t.youth_person_id,
         trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
         (select rp.role::text from role_periods rp join seasons s on s.id = rp.season_id
            where rp.person_id = t.youth_person_id and current_date between s.start_date and s.end_date
              and rp.role in ('pro', 'pro-u18', 'sport-etudes') limit 1),
         t.created_at, t.author_name, t.author_is_staff,
         left(coalesce(nullif(btrim(t.body), ''), '📎 ' || t.file_name), 140),
         (select count(*) from msgs m
           where m.canal = t.canal and m.youth_person_id = t.youth_person_id
             and not m.author_is_staff
             and m.created_at > coalesce((select r.last_read_at from thread_reads r
                   where r.user_id = auth.uid() and r.canal = t.canal
                     and r.youth_person_id = t.youth_person_id), '-infinity'::timestamptz))::integer,
         (select count(*) from msgs m
           where m.canal = t.canal and m.youth_person_id = t.youth_person_id)::integer
    from tout t join people p on p.id = t.youth_person_id
   order by t.created_at desc nulls last,
            trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''));
$fn$;

-- 3 ------------------------------------------------------------------- marquer comme lu
create or replace function public.discussion_marquer_lu(p_canal text, p_youth uuid)
returns void language plpgsql security definer set search_path to 'public' as $fn$
begin
  if p_canal not in ('physique', 'mental') then raise exception 'Canal inconnu'; end if;
  if not is_thread_coach(p_canal, auth.uid()) then raise exception 'Accès refusé'; end if;
  insert into thread_reads (user_id, canal, youth_person_id, last_read_at)
  values (auth.uid(), p_canal, p_youth, now())
  on conflict (user_id, canal, youth_person_id) do update set last_read_at = now();
end $fn$;

-- 4 ----------------------------------------------------------- le compteur de la barre
-- Appelé à chaque chargement de la console : il doit rester bon marché, d'où un simple
-- décompte plutôt que la liste entière.
create or replace function public.discussions_non_lus()
returns integer language sql stable security definer set search_path to 'public' as $fn$
  select coalesce(sum(d.non_lus), 0)::integer from discussions_list() d;
$fn$;
