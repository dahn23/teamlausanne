-- 51_newsletter.sql
-- Onglet Newsletter (superadmin / admin / secrétaire). Envoi via Resend (domaine authentifié SPF/DKIM/DMARC),
-- ciblage = répertoire (tout / filières / tags) + participants GameZone (saison) + e-mails manuels, dédoublonné,
-- moins les désinscrits. Historique + métriques (envoyés, délivrés, ouvertures, clics, rebonds, spam, désinscriptions)
-- alimentées par le webhook Resend (edge function newsletter-webhook). Désinscription = lien unique par destinataire.
create or replace function public.can_newsletter(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid and role in ('superadmin','admin','secretaire'));
$$;

create table if not exists public.newsletters (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(), created_by uuid,
  subject text not null default '', html text not null default '', text_body text,
  from_name text not null default 'Team Lausanne Academy',
  from_email text not null default 'newsletter@teamlausanne.ch',
  reply_to text default 'info@teamlausanne.ch',
  audience jsonb not null default '{}'::jsonb,
  status text not null default 'brouillon',          -- brouillon | envoi | envoyee
  sent_at timestamptz, sent_by uuid, n_recipients int not null default 0, n_sent int not null default 0, last_error text
);
create table if not exists public.newsletter_recipients (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  person_id uuid, gz_participant_id uuid,
  email text not null, name text, source text,
  status text not null default 'en_attente',         -- en_attente | envoye | delivre | ouvert | clique | rebond | spam | erreur | desinscrit
  provider_id text, sent_at timestamptz, delivered_at timestamptz, opened_at timestamptz, open_count int not null default 0,
  clicked_at timestamptz, click_count int not null default 0, bounced_at timestamptz, complained_at timestamptz, error text,
  unique (newsletter_id, email)
);
create index if not exists nlr_newsletter_idx on public.newsletter_recipients(newsletter_id);
create index if not exists nlr_provider_idx on public.newsletter_recipients(provider_id);
create table if not exists public.newsletter_unsubscribes (
  email text primary key, created_at timestamptz not null default now(), source text
);
alter table public.newsletters enable row level security;
alter table public.newsletter_recipients enable row level security;
alter table public.newsletter_unsubscribes enable row level security;
drop policy if exists nl_all on public.newsletters;
create policy nl_all on public.newsletters for all using (can_newsletter(auth.uid())) with check (can_newsletter(auth.uid()));
drop policy if exists nlr_all on public.newsletter_recipients;
create policy nlr_all on public.newsletter_recipients for all using (can_newsletter(auth.uid())) with check (can_newsletter(auth.uid()));
drop policy if exists nlu_all on public.newsletter_unsubscribes;
create policy nlu_all on public.newsletter_unsubscribes for all using (can_newsletter(auth.uid())) with check (can_newsletter(auth.uid()));
grant select, insert, update, delete on public.newsletters, public.newsletter_recipients, public.newsletter_unsubscribes to authenticated;

-- Ciblage : { all_people: bool, roles: [..], gz_all: bool, gz_season_id: uuid, extra_emails: [..] } → liste dédoublonnée par e-mail
create or replace function public.newsletter_audience(p_aud jsonb)
returns table(email text, name text, person_id uuid, gz_participant_id uuid, source text)
language sql stable security definer set search_path = public as $$
  with cur as (select id from seasons where kind = 'juniors' and current_date between start_date and end_date),
  roles as (select jsonb_array_elements_text(coalesce(p_aud->'roles', '[]'::jsonb)) as r),
  ppl as (
    select p.id, lower(trim(p.email)) as email, trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) as name,
      case when coalesce((p_aud->>'all_people')::boolean, false) then 'répertoire' else 'filière / tag' end as source
    from people p
    where p.email is not null and p.email like '%@%' and coalesce(p.is_active, true)
      and ( coalesce((p_aud->>'all_people')::boolean, false)
         or exists (select 1 from person_roles pr where pr.person_id = p.id and pr.role in (select r from roles))
         or exists (select 1 from role_periods rp where rp.person_id = p.id and rp.season_id = (select id from cur) and rp.role in (select r from roles)) )
  ),
  gz as (
    select gp.id as gzid, lower(trim(gp.email)) as email, trim(coalesce(gp.first_name,'') || ' ' || coalesce(gp.last_name,'')) as name, 'GameZone' as source
    from gz_participants gp
    where gp.email is not null and gp.email like '%@%'
      and ( coalesce((p_aud->>'gz_all')::boolean, false)
         or ( nullif(p_aud->>'gz_season_id','') is not null and exists (
              select 1 from gz_entries e join gz_tournaments t on t.id = e.tournament_id
              where e.participant_id = gp.id and t.season_id = (p_aud->>'gz_season_id')::uuid) ) )
  ),
  extra as (
    select lower(trim(x)) as email, null::text as name, 'manuel' as source
    from jsonb_array_elements_text(coalesce(p_aud->'extra_emails', '[]'::jsonb)) x where x like '%@%'
  ),
  allrows as (
    select email, name, id as person_id, null::uuid as gz_participant_id, source, 1 as prio from ppl
    union all select email, name, null, gzid, source, 2 from gz
    union all select email, name, null, null, source, 3 from extra
  )
  select distinct on (a.email) a.email, a.name, a.person_id, a.gz_participant_id, a.source
  from allrows a
  where can_newsletter(auth.uid())
    and not exists (select 1 from newsletter_unsubscribes u where u.email = a.email)
  order by a.email, a.prio;
$$;
grant execute on function public.newsletter_audience(jsonb) to authenticated;

-- Désinscription publique : jeton = id du destinataire (lien unique dans chaque e-mail)
create or replace function public.newsletter_unsubscribe(p_token uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  select email into v_email from newsletter_recipients where id = p_token;
  if v_email is null then return null; end if;
  insert into newsletter_unsubscribes(email, source) values (v_email, 'lien') on conflict (email) do nothing;
  update newsletter_recipients set status = 'desinscrit' where id = p_token;
  return v_email;
end;$$;
grant execute on function public.newsletter_unsubscribe(uuid) to anon, authenticated;

-- Métriques par newsletter (vue, avec les droits de l'appelant)
create or replace view public.newsletter_metrics with (security_invoker = true) as
select n.id as newsletter_id,
  count(r.id) as n_total,
  count(*) filter (where r.status not in ('en_attente','erreur')) as n_sent,
  count(*) filter (where r.delivered_at is not null or r.opened_at is not null or r.clicked_at is not null) as n_delivered,
  count(*) filter (where r.opened_at is not null) as n_opened,
  count(*) filter (where r.clicked_at is not null) as n_clicked,
  count(*) filter (where r.bounced_at is not null) as n_bounced,
  count(*) filter (where r.complained_at is not null) as n_spam,
  count(*) filter (where r.status = 'desinscrit') as n_unsub,
  count(*) filter (where r.status = 'erreur') as n_error
from newsletters n left join newsletter_recipients r on r.newsletter_id = n.id
group by n.id;
grant select on public.newsletter_metrics to authenticated;
