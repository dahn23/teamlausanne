-- ===================================================================
--  Site public : reconstruire dès qu'un article paraît (16.10.2026)
-- ===================================================================
-- Le site n'est pas rendu à la volée : Netlify exécute build.mjs au
-- déploiement, lequel relit les articles dans Supabase et écrit un vrai
-- fichier HTML par article. C'est ce qui les rend indexables.
--
-- Mais cela n'arrive QUE lors d'un déploiement, et un déploiement n'arrivait
-- que sur « git push ». Un article publié un mardi restait donc invisible
-- pour Google jusqu'à ce que quelqu'un pousse du code pour une autre raison.
--
-- Un build hook Netlify est une adresse privée : lui envoyer une requête
-- revient à dire « reconstruis maintenant ». Publier un article devient donc
-- son propre déclencheur.
--
-- ⚠️ L'ADRESSE N'EST PAS DANS CE FICHIER, et ne doit jamais y être : db/ part
-- sur GitHub. Elle est dans le Vault de Supabase, sous le nom
-- « netlify_build_hook », posée à la main une fois :
--
--   select vault.create_secret('<adresse du hook>', 'netlify_build_hook', '…');
--
-- Elle ne touche pas non plus admin.js, qui est servi publiquement à
-- n'importe quel navigateur. Tout se passe en base.

-- Trace des reconstructions demandées. Sans elle, « le site ne s'est pas mis à
-- jour » serait impossible à instruire : on ne saurait pas si la demande est
-- partie, ni quand.
create table if not exists site_rebuild_log (
  id          bigint generated always as identity primary key,
  raison      text not null,
  request_id  bigint,
  demande_par uuid,
  created_at  timestamptz not null default now()
);
alter table site_rebuild_log enable row level security;
drop policy if exists srl_lire on site_rebuild_log;
create policy srl_lire on site_rebuild_log for select using (is_encadrement(auth.uid()));

create or replace function public.site_rebuild(p_raison text default 'manuel')
returns bigint language plpgsql security definer set search_path = public, vault as $$
declare v_url text; v_req bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'netlify_build_hook';
  if v_url is null then
    raise exception 'Secret « netlify_build_hook » absent du Vault : le site ne peut pas être reconstruit.';
  end if;
  -- pg_net poste sans bloquer : la transaction qui publie l'article n'attend
  -- pas Netlify, et un Netlify lent ne fait pas échouer une publication.
  select net.http_post(url := v_url, body := '{}'::jsonb) into v_req;
  insert into site_rebuild_log (raison, request_id, demande_par)
  values (p_raison, v_req, auth.uid());
  return v_req;
end $$;
revoke all on function public.site_rebuild(text) from public, anon;
grant execute on function public.site_rebuild(text) to authenticated;

-- Le déclencheur. On ne reconstruit que pour ce qui CHANGE la page publique :
-- un brouillon sans date de publication n'est pas rendu, donc rien à refaire.
create or replace function public.news_articles_rebuild()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_avant boolean; v_apres boolean;
begin
  -- Un article n'est visible que si news_public() le renvoie : status =
  -- 'publie' ET published_on <= aujourd'hui. Ne regarder que la date ferait
  -- reconstruire pour un brouillon daté, qui n'est rendu nulle part.
  v_apres := (tg_op <> 'DELETE' and new.status = 'publie' and new.published_on is not null);
  v_avant := (tg_op in ('UPDATE','DELETE') and old.status = 'publie' and old.published_on is not null);
  if v_apres or v_avant then
    perform site_rebuild('article ' || lower(tg_op) || ' : '
      || coalesce(case when tg_op = 'DELETE' then old.slug else new.slug end, '?'));
  end if;
  return null;
end $$;

drop trigger if exists news_articles_rebuild_trg on public.news_articles;
create trigger news_articles_rebuild_trg
  after insert or update or delete on public.news_articles
  for each row execute function public.news_articles_rebuild();
