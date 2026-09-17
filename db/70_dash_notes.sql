-- 70_dash_notes.sql
-- Dashboard : « Derniers messages » des 7 derniers jours, toutes sources confondues.
--   suivi    = youth_notes (fil transverse coach / prof / mental / admin)
--   tennis   = tennis_notes (onglet Tennis de la fiche)
--   physique = phys_notes
--   mental   = mental_thread (canal mental avec le jeune) + mental_comments (ancien canal)
--   cours    = notes des blocs de séance (course_segments.note), avec les joueurs du bloc ; auteur = qui a
--              enregistré le détail (created_by), le coach du bloc est indiqué dans « extra »
--   echange  = player_contact_log (onglet Échanges : appels / rencontres avec les familles ; ajouté le 17.09.2026)
-- Accès : mêmes rôles que dashboard_data (head_coach / admin / superadmin).

create or replace function public.dash_notes(p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not exists (select 1 from user_roles where user_id = auth.uid() and role in ('head_coach','admin','superadmin')) then
    raise exception 'Accès refusé';
  end if;
  with nm as (
    select id, trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) as n from people
  ),
  who as (  -- nom d'un utilisateur (created_by) via son profil
    select pr.user_id, nm.n from profiles pr join nm on nm.id = pr.person_id
  ),
  src as (
    select 'suivi'::text as kind, yn.created_at as at, (select n from nm where id = yn.youth_person_id) as youth,
           coalesce(yn.author_name, (select n from who where user_id = yn.created_by)) as author, yn.author_role as role,
           yn.body as body, null::text as extra
      from youth_notes yn where yn.created_at >= now() - make_interval(days => p_days)
    union all
    select 'tennis', tn.created_at, (select n from nm where id = tn.player_person_id),
           coalesce(tn.author_name, (select n from who where user_id = tn.created_by)), tn.author_role,
           tn.body, tn.theme
      from tennis_notes tn where tn.created_at >= now() - make_interval(days => p_days)
    union all
    select 'physique', pn.created_at, (select n from nm where id = pn.player_person_id),
           coalesce(pn.author_name, (select n from who where user_id = pn.created_by)), pn.author_role,
           pn.body, null
      from phys_notes pn where pn.created_at >= now() - make_interval(days => p_days)
    union all
    select 'mental', mt.created_at, (select n from nm where id = mt.youth_person_id),
           coalesce(mt.author_name, (select n from who where user_id = mt.created_by)),
           case when mt.author_is_staff then 'mental' else 'jeune' end,
           coalesce(mt.body, mt.file_name, mt.link_url), null
      from mental_thread mt where mt.created_at >= now() - make_interval(days => p_days)
    union all
    select 'mental', mc.created_at, (select n from nm where id = mc.youth_person_id),
           coalesce(mc.author_name, (select n from who where user_id = mc.created_by)), 'mental',
           mc.body, null
      from mental_comments mc where mc.created_at >= now() - make_interval(days => p_days)
    union all
    select 'cours', greatest(s.created_at, (c.course_date + c.start_time)::timestamptz),
           (select string_agg(nm.n, ', ' order by nm.n) from course_segment_players sp join nm on nm.id = sp.person_id where sp.segment_id = s.id),
           coalesce((select n from who where user_id = s.created_by), (select n from nm where id = s.coach_person_id)), 'head coach',
           s.note,
           coalesce(nullif(c.title,''), ct.name, 'Cours') || ' · ' || to_char(c.course_date, 'DD.MM') || coalesce(' · coach ' || (select n from nm where id = s.coach_person_id), '')
      from course_segments s join courses c on c.id = s.course_id left join course_types ct on ct.id = c.course_type_id
     where nullif(trim(s.note), '') is not null and s.created_at >= now() - make_interval(days => p_days)
    union all
    select 'echange', greatest(cl.created_at, cl.contacted_at::timestamptz), (select n from nm where id = cl.person_id),
           coalesce(cl.author_name, (select n from who where user_id = cl.created_by)), cl.channel,
           cl.summary, null
      from player_contact_log cl where cl.created_at >= now() - make_interval(days => p_days)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', kind, 'date', at, 'youth', youth, 'author', author, 'role', role,
           'body', left(regexp_replace(coalesce(body,''), '\s+', ' ', 'g'), 220), 'extra', extra) order by at desc), '[]'::jsonb)
    into v
    from (select * from src order by at desc limit 60) z;
  return v;
end; $$;
revoke all on function public.dash_notes(int) from public, anon;
grant execute on function public.dash_notes(int) to authenticated;
