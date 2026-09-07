-- 48_prospect_followups.sql
-- Prospects › « Suivi » : prospects saisis à la main (nom, prénom, licence facultative, e-mail, tél, classement,
-- « où ça en est »), avec un mode de suivi qui programme une alerte dans le Dashboard :
--   surveiller → 1 mois après la dernière interaction · mail / tel / attente → 1 semaine · standby → 3 mois · aucune → pas d'alerte.
-- Accès : admin / superadmin (comme l'onglet Prospects). Dashboard : bloc « Prospects » (alertes échues + à venir 7 j).
create table if not exists public.prospect_followups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid,
  first_name text, last_name text, license_no text, email text, phone text, ranking text,
  status_text text,
  mode text not null default 'surveiller' check (mode in ('surveiller','mail','tel','attente','standby','aucune')),
  last_contact date not null default current_date,
  done boolean not null default false           -- archivé (plus suivi)
);
alter table public.prospect_followups enable row level security;
drop policy if exists pf_admin on public.prospect_followups;
create policy pf_admin on public.prospect_followups for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
grant select, insert, update, delete on public.prospect_followups to authenticated;

create or replace function public.prospect_alert_date(p_mode text, p_last date) returns date
language sql immutable as $$
  select case p_mode when 'surveiller' then p_last + interval '1 month'
                     when 'mail' then p_last + interval '7 days'
                     when 'tel' then p_last + interval '7 days'
                     when 'attente' then p_last + interval '7 days'
                     when 'standby' then p_last + interval '3 months'
                     else null end::date;
$$;

create or replace function public.dash_prospects() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'alerts', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', trim(coalesce(f.first_name,'')||' '||coalesce(f.last_name,'')),
        'mode', f.mode, 'last_contact', f.last_contact, 'alert_at', prospect_alert_date(f.mode, f.last_contact), 'status_text', f.status_text, 'ranking', f.ranking)
        order by prospect_alert_date(f.mode, f.last_contact))
      from prospect_followups f where not f.done and prospect_alert_date(f.mode, f.last_contact) is not null
        and prospect_alert_date(f.mode, f.last_contact) <= current_date + 7), '[]'::jsonb),
    'n_active', (select count(*) from prospect_followups where not done)
  );
$$;
revoke execute on function public.dash_prospects() from public;

create or replace function public.dashboard_data() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from user_roles where user_id=auth.uid() and role in ('head_coach','admin','superadmin')) then
    raise exception 'Accès refusé';
  end if;
  return jsonb_build_object(
    'general', dash_general(),
    'mail', dash_mail(),
    'se', dash_group(array['pro','pro-u18','sport-etudes']),
    'comp', dash_group(array['competition','performance']),
    'club', dash_club(),
    'prospects', dash_prospects(),
    'generated_at', now()
  );
end;$$;
