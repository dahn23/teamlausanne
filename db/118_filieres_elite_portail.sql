-- 28.09.2026 (décision Dan) : Mon espace distingue les filières « élite » (pro, pro U18, sport-études)
-- de compétition et performance.
--  • Le fil « Prépa physique » (chat staff ↔ jeune) n'existe que pour pro, pro U18 et sport-études.
--    Compétition et performance gardent leurs routines (portal_phys_routines inchangé).
--  • Mon espace lit la liste des jeunes élite du compte pour : cacher le chat physique, remplacer Mental
--    (Messages + Après séance) par des conseils, et retirer l'onglet Stages quand tous les jeunes du compte sont élite.

-- Jeune en pro / pro U18 / sport-études : tag de la fiche ou filière d'une saison en cours.
create or replace function public.is_elite_youth(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from person_roles where person_id = p and role in ('pro','pro-u18','sport-etudes'))
      or exists (select 1 from role_periods rp join seasons s on s.id = rp.season_id
                 where rp.person_id = p and rp.role in ('pro','pro-u18','sport-etudes')
                   and current_date between s.start_date and s.end_date);
$$;

-- Jeunes élite du compte connecté (parmi ceux que Mon espace affiche).
create or replace function public.portal_elite_youths()
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.person_id from portal_my_youths() m where is_elite_youth(m.person_id);
$$;
revoke all on function public.portal_elite_youths() from public, anon;
grant execute on function public.portal_elite_youths() to authenticated;
revoke all on function public.is_elite_youth(uuid) from public, anon;
grant execute on function public.is_elite_youth(uuid) to authenticated;

-- Fil « Prépa physique » : réservé aux jeunes élite (staff compris).
create or replace function public.phys_thread_list(p_youth uuid)
returns setof phys_thread language plpgsql stable security definer set search_path = public as $$
begin
  if not can_phys_of(p_youth) then raise exception 'Accès refusé'; end if;
  if not is_elite_youth(p_youth) then return; end if;
  return query select * from public.phys_thread where youth_person_id = p_youth order by created_at;
end $$;

do $$ declare d text; begin
  d := pg_get_functiondef('public.phys_thread_post(uuid,text,text,text,text)'::regprocedure);
  if position($q$if not can_phys_of(p_youth) then raise exception 'Accès refusé'; end if;$q$ in d) = 0 then
    raise exception 'phys_thread_post : garde introuvable, rien modifié'; end if;
  d := replace(d, $q$if not can_phys_of(p_youth) then raise exception 'Accès refusé'; end if;$q$,
    $q$if not can_phys_of(p_youth) then raise exception 'Accès refusé'; end if;
  if not is_elite_youth(p_youth) then raise exception 'La prépa physique en message est réservée aux filières pro, pro U18 et sport-études.'; end if;$q$);
  execute d;
end $$;
