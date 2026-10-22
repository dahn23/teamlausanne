-- 203 — CSEL : Séline modifie le planning des repas (22.10.2026).
-- Liste nominative app_settings.csel_editors (user_id) ; la console (cselCanEdit) lit la même liste.
-- Arsalan reste en lecture seule (db/202).
insert into app_settings (key, value) values ('csel_editors', '["21c6acc5-abc9-4b5a-945f-7b03ac96dec7"]'::jsonb)
  on conflict (key) do update set value = excluded.value;
create or replace function public.is_csel_editor(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_settings s, jsonb_array_elements_text(s.value) e
                 where s.key = 'csel_editors' and jsonb_typeof(s.value) = 'array' and e = uid::text);
$$;
revoke all on function public.is_csel_editor(uuid) from public, anon;
grant execute on function public.is_csel_editor(uuid) to authenticated;
create policy csel_mo_editors on public.csel_meal_overrides for all
  using (is_csel_editor(auth.uid())) with check (is_csel_editor(auth.uid()));
