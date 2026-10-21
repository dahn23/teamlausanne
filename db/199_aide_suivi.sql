-- ---------------------------------------------------------------------------
-- SUIVI DE L'AIDE — qui a demandé quoi, et ce que le guide ne couvrait pas.
--
-- Deux fonctions plutôt qu'une lecture directe des tables, pour trois raisons :
--
--  · LE NOM. aide_conversations ne garde qu'un user_id. Le nom vit dans
--    people (via profiles) et, à défaut, l'adresse vit dans auth.users — que
--    la console ne peut pas lire. Seule une fonction SECURITY DEFINER peut
--    recoudre les trois.
--  · LE DROIT. Le serveur tranche, et il LÈVE au lieu de filtrer : un garde
--    posé dans le WHERE rendrait un refus indiscernable d'une absence de
--    données, et l'écran annoncerait « aucune conversation » à quelqu'un qui
--    n'a simplement pas le droit de regarder.
--  · LA LISIBILITÉ. L'écran veut une ligne par conversation avec la première
--    question et un drapeau « hors guide » ; le faire en SQL évite de
--    descendre tous les messages dans le navigateur pour les recompter.
-- ---------------------------------------------------------------------------

-- La liste : une ligne par conversation, sur les N derniers jours.
create or replace function public.aide_suivi(p_jours int default 30)
returns table (
  id uuid, started_at timestamptz, qui text, ecrans text[],
  n_questions int, cost_usd numeric, hors_guide boolean, premiere text
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.can_aide_suivi(auth.uid()) then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  return query
    select c.id, c.started_at,
           coalesce(nullif(btrim(p.first_name || ' ' || p.last_name), ''), u.email, 'compte supprimé'),
           c.ecrans, c.n_questions, c.cost_usd,
           exists (select 1 from aide_messages m where m.conversation_id = c.id and m.hors_guide),
           (select m.content from aide_messages m
             where m.conversation_id = c.id and m.role = 'user'
             order by m.idx limit 1)
    from aide_conversations c
    left join auth.users u on u.id = c.user_id
    left join profiles pr on pr.user_id = c.user_id
    left join people p on p.id = pr.person_id
    where c.started_at >= now() - make_interval(days => greatest(p_jours, 1))
    order by c.started_at desc
    limit 500;
end $$;

-- Le fil d'une conversation, questions et réponses dans l'ordre.
create or replace function public.aide_suivi_fil(p_conv uuid)
returns table (
  idx int, role text, content text, ecran text,
  hors_guide boolean, cost_usd numeric, created_at timestamptz
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.can_aide_suivi(auth.uid()) then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  return query
    select m.idx, m.role, m.content, m.ecran, m.hors_guide, m.cost_usd, m.created_at
    from aide_messages m where m.conversation_id = p_conv order by m.idx;
end $$;

revoke all on function public.aide_suivi(int)      from public, anon;
revoke all on function public.aide_suivi_fil(uuid) from public, anon;
grant execute on function public.aide_suivi(int)      to authenticated;
grant execute on function public.aide_suivi_fil(uuid) to authenticated;

comment on function public.aide_suivi(int) is
  'Suivi de l''Aide : une ligne par conversation. Lève 42501 si l''appelant n''est pas administrateur.';
