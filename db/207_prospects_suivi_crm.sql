-- 207_prospects_suivi_crm.sql
-- Prospects › Suivi : le tableau à douze colonnes devient un entonnoir.
--
-- Ce qui manquait pour s'en servir comme d'un vrai suivi commercial :
--   · une ÉTAPE (où en est la famille), distincte du MODE de relance ;
--   · une PROCHAINE ACTION datée, choisie, et non déduite d'une formule ;
--   · un HISTORIQUE des échanges — `status_text` était réécrit à chaque fois,
--     donc tout ce qui avait été dit la fois d'avant était perdu ;
--   · la SOURCE (d'où vient la famille) : sans elle, impossible de savoir quel
--     canal amène des inscriptions ;
--   · le PROGRAMME et la SAISON visés, qui donnent l'urgence réelle.
--
-- Rien n'est supprimé : `mode` et `last_contact` restent, et les alertes du
-- Dashboard continuent de fonctionner pendant la bascule.

alter table public.prospect_followups
  add column if not exists stage text not null default 'nouveau'
    check (stage in ('nouveau','contacte','discussion','visite','dossier','inscrit','perdu')),
  add column if not exists priorite text not null default 'tiede'
    check (priorite in ('chaud','tiede','froid')),
  add column if not exists source text,
  add column if not exists programme text,
  add column if not exists saison_cible text,
  add column if not exists location text,
  add column if not exists next_action_at date,
  add column if not exists next_action text,
  add column if not exists lost_reason text,
  add column if not exists stage_changed_at timestamptz not null default now();

-- L'historique des échanges. Un prospect = une suite d'interactions datées.
create table if not exists public.prospect_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_followups(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null default 'note'
    check (kind in ('note','appel','mail','whatsapp','rdv','visite','etape')),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists prospect_events_prospect on public.prospect_events(prospect_id, at desc);
create index if not exists prospect_followups_next on public.prospect_followups(next_action_at) where not done;

alter table public.prospect_events enable row level security;
drop policy if exists pe_admin on public.prospect_events;
create policy pe_admin on public.prospect_events for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
grant select, insert, update, delete on public.prospect_events to authenticated;

-- --- reprise de l'existant ------------------------------------------------
-- L'étape se déduit du mode : une famille « en attente d'un retour » ou
-- relancée par mail/téléphone est forcément déjà en discussion.
update public.prospect_followups set
  stage = case when stage <> 'nouveau' then stage
               when mode in ('mail','tel','attente') then 'discussion'
               else 'contacte' end,
  priorite = case mode when 'standby' then 'froid'
                       when 'aucune' then 'froid'
                       when 'surveiller' then 'tiede'
                       else 'chaud' end,
  next_action_at = coalesce(next_action_at, prospect_alert_date(mode, last_contact)),
  next_action = coalesce(next_action, case mode
      when 'surveiller' then 'Prendre des nouvelles'
      when 'mail' then 'Relancer par mail'
      when 'tel' then 'Rappeler'
      when 'attente' then 'Relancer — sans réponse'
      when 'standby' then 'Reprendre contact'
      else null end)
where true;

-- Ce qui était écrit dans « Où ça en est » devient la première ligne de
-- l'historique, datée de la dernière interaction connue. Sinon la timeline
-- s'ouvrirait vide sur seize familles déjà suivies depuis des semaines.
insert into public.prospect_events (prospect_id, at, kind, note)
select f.id, (f.last_contact + time '12:00')::timestamptz, 'note', f.status_text
from public.prospect_followups f
where coalesce(trim(f.status_text), '') <> ''
  and not exists (select 1 from public.prospect_events e where e.prospect_id = f.id);

-- --- le Dashboard suit la prochaine action --------------------------------
-- Il lisait la date calculée depuis le mode ; il lit maintenant la date
-- choisie, et retombe sur l'ancienne formule tant qu'aucune n'est posée.
create or replace function public.dash_prospects() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'alerts', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'name', trim(coalesce(f.first_name,'')||' '||coalesce(f.last_name,'')),
        'mode', f.mode, 'last_contact', f.last_contact,
        'alert_at', coalesce(f.next_action_at, prospect_alert_date(f.mode, f.last_contact)),
        'status_text', coalesce(f.next_action, f.status_text),
        'ranking', f.ranking)
        order by coalesce(f.next_action_at, prospect_alert_date(f.mode, f.last_contact)))
      from prospect_followups f
      where not f.done
        and f.stage not in ('inscrit','perdu')
        and coalesce(f.next_action_at, prospect_alert_date(f.mode, f.last_contact)) is not null
        and coalesce(f.next_action_at, prospect_alert_date(f.mode, f.last_contact)) <= current_date + 7), '[]'::jsonb),
    'n_active', (select count(*) from prospect_followups where not done and stage not in ('inscrit','perdu'))
  );
$$;
revoke execute on function public.dash_prospects() from public;
