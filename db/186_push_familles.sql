-- 186 — Notifications de l'app pour les familles (19.10.2026).
-- Jusqu'ici l'app ne notifiait que l'équipe (nouveaux mails). Désormais :
--   * un message du staff dans le fil Prépa physique ou Mental  → le jeune et ses parents (comptes reliés) ;
--   * un message d'un jeune dans ces fils                        → les coachs physiques / mentaux ;
--   * une actualité publiée (onglet Accueil de Mon espace)      → les familles des filières visées.
-- Les déclencheurs ne font qu'écrire dans une FILE (push_queue) ; la fonction push-native la vide au passage
-- suivant du cron « push-native-mails » (toutes les 2 min), vers Android (FCM) et iPhone (APNs).
-- Seuls les comptes qui ont un téléphone enregistré entrent dans la file. Annulations de cours : pas notifiées
-- (supprimer/déplacer un cours en réorganisant le planning enverrait de fausses alertes).

create table if not exists public.push_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  title text not null,
  body text,
  url text,
  kind text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.push_queue enable row level security;   -- aucune policy : seule la fonction serveur y accède
create index if not exists push_queue_a_envoyer on public.push_queue (id) where sent_at is null;

-- Comptes qui voient un jeune dans Mon espace (même règle que my_family_ids, à l'envers).
create or replace function public.push_users_for_person(p uuid)
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select pr.user_id from profiles pr where pr.person_id = p
  union
  select pr.user_id from guardianships g join profiles pr on pr.person_id = g.guardian_id where g.child_id = p
  union
  select u.id from people pe join auth.users u on lower(trim(u.email)) = lower(trim(pe.email))
   where pe.id = p and coalesce(trim(pe.email), '') <> '' and u.email_confirmed_at is not null
$$;

create or replace function public.push_enqueue(p_users uuid[], p_title text, p_body text, p_url text, p_kind text)
returns void language sql security definer set search_path to 'public' as $$
  insert into push_queue (user_id, title, body, url, kind)
  select distinct u, left(p_title, 120), left(p_body, 300), p_url, p_kind
    from unnest(p_users) u
   where u is not null and exists (select 1 from push_devices d where d.user_id = u)
$$;

-- Fils Prépa physique et Mental.
create or replace function public.push_thread_trg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  phys boolean := tg_table_name = 'phys_thread';
  quoi text := coalesce(nullif(trim(new.body), ''), case when new.file_name is not null then '📎 ' || new.file_name end, '…');
  jeune text;
begin
  if new.author_is_staff then
    perform push_enqueue(
      array(select x from push_users_for_person(new.youth_person_id) x where x is distinct from new.created_by),
      case when phys then 'Prépa physique' else 'Mental' end || ' — nouveau message',
      coalesce(nullif(trim(new.author_name), ''), 'Ton coach') || ' : ' || quoi,
      '/espace.html?vue=' || case when phys then 'physique' else 'comp' end, tg_table_name);
  else
    select first_name || ' ' || last_name into jeune from people where id = new.youth_person_id;
    perform push_enqueue(
      array(select ur.user_id from user_roles ur
             where ur.role::text = case when phys then 'coach_physique' else 'coach_mental' end
               and ur.user_id is distinct from new.created_by),
      case when phys then 'Prépa physique' else 'Mental' end || ' — ' || coalesce(jeune, 'un jeune'),
      quoi, '/console', tg_table_name);
  end if;
  return new;
end $$;

drop trigger if exists trg_push_phys_thread on public.phys_thread;
create trigger trg_push_phys_thread after insert on public.phys_thread for each row execute function push_thread_trg();
drop trigger if exists trg_push_mental_thread on public.mental_thread;
create trigger trg_push_mental_thread after insert on public.mental_thread for each row execute function push_thread_trg();

-- Actualités : au moment où elles sont publiées (création publiée, ou passage de brouillon à publiée).
-- Mêmes destinataires que portal_news : filières de la saison visées, ou tout le monde si aucune filière n'est cochée.
create or replace function public.push_news_trg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  saison uuid;
  tous boolean := coalesce(array_length(new.audiences, 1), 0) = 0;
begin
  if not new.published or (tg_op = 'UPDATE' and coalesce(old.published, false)) then return new; end if;
  saison := coalesce(new.season_id, (select s.id from seasons s where s.kind = 'juniors' and current_date between s.start_date and s.end_date limit 1));
  perform push_enqueue(
    array(select distinct u from (
            select rp.person_id as pid from role_periods rp where rp.season_id = saison and (tous or rp.role = any(new.audiences))
            union
            select pr.person_id from person_roles pr where not tous and pr.role = any(new.audiences)
          ) t, lateral push_users_for_person(t.pid) u),
    'Team Lausanne', new.title, '/espace.html?vue=accueil', 'news');
  return new;
end $$;

drop trigger if exists trg_push_news on public.news;
create trigger trg_push_news after insert or update of published on public.news for each row execute function push_news_trg();

revoke all on function public.push_users_for_person(uuid) from public, anon, authenticated;
revoke all on function public.push_enqueue(uuid[], text, text, text, text) from public, anon, authenticated;
revoke all on function public.push_thread_trg() from public, anon, authenticated;
revoke all on function public.push_news_trg() from public, anon, authenticated;
