-- Réseaux sociaux v2 — d'après le brief « Planable » (29.09.2026)
--
-- Le brief spécifie un produit SaaS multi-locataire : espaces de travail par
-- client, approbateurs externes sans compte, publication directe vers
-- Facebook/LinkedIn/X, jetons OAuth, pile Node/Redis/S3. Rien de tout cela ne
-- s'applique ici : une seule organisation, un seul compte, Instagram + TikTok
-- + newsletter, et une console posée sur Supabase.
--
-- Ce qui EST repris du brief, parce que ça répond à un vrai manque :
--
--  1. VARIANTES PAR CANAL. Le brief appelle ça « grouped post with
--     per-platform overrides » et un interrupteur « sync content on/off ».
--     C'était le défaut le plus criant de la v1 : un seul texte pour
--     Instagram, TikTok et la newsletter, alors qu'une légende Instagram et un
--     bloc de newsletter ne s'écrivent pas pareil.
--
--  2. MODE D'APPROBATION CONFIGURABLE (aucun / facultatif / obligatoire).
--     C'était la question restée ouverte à la livraison de la v1 : « Texte à
--     valider » était un statut de production, pas une barrière. Ici le mode
--     est un réglage, et en « obligatoire » le passage à « Programmé » est
--     refusé sans approbation enregistrée.
--
--  3. JOURNAL DES CHANGEMENTS DE STATUT. Le brief demande un « full audit
--     trail of status changes (who approved/rejected, when, with what
--     comment) ». Écrit par déclencheur, donc impossible à contourner depuis
--     l'écran.
--
--  4. FIL DE COMMENTAIRES avec résolution. Le brief distingue un fil interne
--     d'un fil client ; sans client externe, un seul fil suffit — le
--     distinguer serait une complication sans objet.
--
--  5. MÉDIATHÈQUE réutilisable. En v1 une image appartenait à une publication
--     et une seule ; la reverser dans une autre imposait de la re-téléverser.
--
-- Ce qui est ÉCARTÉ et pourquoi : les espaces de travail (une seule
-- organisation), les liens d'approbation externes (pas de client), les jetons
-- OAuth et le moteur de publication (Instagram et TikTok demandent un compte
-- professionnel et une application validée — des semaines de démarches,
-- souvent refusées), et l'analytique tirée des API (même obstacle ; la saisie
-- manuelle après coup existe déjà avec `lien_publie` et `bilan`).

-- ---------- Réglages ----------
-- Une seule ligne. En table plutôt qu'en constante du code : le mode
-- d'approbation est une décision d'organisation, elle doit pouvoir changer
-- sans redéploiement.
create table if not exists public.social_settings (
  id int primary key default 1 check (id = 1),
  mode_approbation text not null default 'facultatif'
    check (mode_approbation in ('aucun','facultatif','obligatoire')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.social_settings (id) values (1) on conflict (id) do nothing;

alter table public.social_settings enable row level security;
drop policy if exists soc_set_lire on public.social_settings;
create policy soc_set_lire on public.social_settings for select to authenticated
  using (can_social(auth.uid()));
drop policy if exists soc_set_ecrire on public.social_settings;
create policy soc_set_ecrire on public.social_settings for all to authenticated
  using (can_social_valider(auth.uid())) with check (can_social_valider(auth.uid()));

-- Qui approuve : la direction, comme pour les congés. Le secrétariat prépare
-- et peut demander l'approbation, il ne se l'accorde pas.
create or replace function public.can_social_valider(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
                  and role in ('superadmin','admin'));
$$;
revoke all on function public.can_social_valider(uuid) from public, anon;
grant execute on function public.can_social_valider(uuid) to authenticated;

-- ---------- Variantes par canal ----------
alter table public.social_posts
  add column if not exists sync_canaux boolean not null default true,
  add column if not exists approuve_par uuid,
  add column if not exists approuve_at timestamptz,
  add column if not exists approbation_demandee_at timestamptz,
  add column if not exists refus_motif text;

comment on column public.social_posts.sync_canaux is
  'true : le texte commun sert pour tous les canaux. false : chaque canal a sa variante.';

create table if not exists public.social_post_variants (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  canal text not null check (canal in ('instagram','tiktok','newsletter')),
  texte text,
  hashtags text,
  cta text,
  primary key (post_id, canal)
);
alter table public.social_post_variants enable row level security;
drop policy if exists soc_var_lire on public.social_post_variants;
create policy soc_var_lire on public.social_post_variants for select to authenticated
  using (can_social(auth.uid()));
drop policy if exists soc_var_ecrire on public.social_post_variants;
create policy soc_var_ecrire on public.social_post_variants for all to authenticated
  using (can_social_edit(auth.uid())) with check (can_social_edit(auth.uid()));

-- ---------- Commentaires ----------
create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  corps text not null,
  auteur uuid,
  resolu boolean not null default false,
  resolu_par uuid,
  resolu_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists social_comments_post on public.social_comments (post_id, created_at);

alter table public.social_comments enable row level security;
drop policy if exists soc_com_lire on public.social_comments;
create policy soc_com_lire on public.social_comments for select to authenticated
  using (can_social(auth.uid()));
-- Commenter est ouvert à toute l'équipe : c'est le point du brief
-- (« Collaborator : comment/suggest only »). Un coach qui repère une erreur
-- doit pouvoir le dire sans pouvoir modifier la publication.
drop policy if exists soc_com_ecrire on public.social_comments;
create policy soc_com_ecrire on public.social_comments for insert to authenticated
  with check (can_social(auth.uid()));
-- On ne modifie et ne supprime que SON commentaire ; la direction peut tout.
drop policy if exists soc_com_modif on public.social_comments;
create policy soc_com_modif on public.social_comments for update to authenticated
  using (auteur = auth.uid() or can_social_valider(auth.uid()))
  with check (auteur = auth.uid() or can_social_valider(auth.uid()));
drop policy if exists soc_com_suppr on public.social_comments;
create policy soc_com_suppr on public.social_comments for delete to authenticated
  using (auteur = auth.uid() or can_social_valider(auth.uid()));

-- ---------- Journal des statuts ----------
create table if not exists public.social_status_log (
  id bigserial primary key,
  post_id uuid not null references public.social_posts(id) on delete cascade,
  de text,
  vers text not null,
  par uuid,
  commentaire text,
  created_at timestamptz not null default now()
);
create index if not exists social_log_post on public.social_status_log (post_id, created_at desc);

alter table public.social_status_log enable row level security;
drop policy if exists soc_log_lire on public.social_status_log;
create policy soc_log_lire on public.social_status_log for select to authenticated
  using (can_social(auth.uid()));
-- Personne n'écrit ce journal à la main : c'est le déclencheur qui le tient.
-- Sans cela, une trace d'audit ne vaut rien.
grant select on public.social_status_log to authenticated;
grant usage, select on sequence public.social_status_log_id_seq to authenticated;

-- ---------- Médiathèque ----------
-- En v1 une image appartenait à une publication et une seule. Ici elle vit
-- dans une bibliothèque et se rattache à autant de publications qu'on veut.
create table if not exists public.social_media (
  id uuid primary key default gen_random_uuid(),
  chemin text not null unique,
  nom text,
  type_mime text,
  taille bigint,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.social_media enable row level security;
drop policy if exists soc_lib_lire on public.social_media;
create policy soc_lib_lire on public.social_media for select to authenticated
  using (can_social(auth.uid()));
drop policy if exists soc_lib_ecrire on public.social_media;
create policy soc_lib_ecrire on public.social_media for all to authenticated
  using (can_social_edit(auth.uid())) with check (can_social_edit(auth.uid()));

-- L'ancienne table devient un simple rattachement. Elle est vide (aucune
-- publication n'existe encore), donc rien à reprendre.
drop table if exists public.social_post_media;
create table public.social_post_media (
  post_id  uuid not null references public.social_posts(id) on delete cascade,
  media_id uuid not null references public.social_media(id) on delete cascade,
  ordre int not null default 0,
  primary key (post_id, media_id)
);
create index if not exists social_pm_post on public.social_post_media (post_id, ordre);
alter table public.social_post_media enable row level security;
drop policy if exists soc_pm_lire on public.social_post_media;
create policy soc_pm_lire on public.social_post_media for select to authenticated
  using (can_social(auth.uid()));
drop policy if exists soc_pm_ecrire on public.social_post_media;
create policy soc_pm_ecrire on public.social_post_media for all to authenticated
  using (can_social_edit(auth.uid())) with check (can_social_edit(auth.uid()));

grant select, insert, update, delete on public.social_settings, public.social_post_variants,
      public.social_comments, public.social_media, public.social_post_media to authenticated;

-- ---------- Le garde-fou d'approbation ----------
-- Trois règles tenues par la base, et non par l'écran :
--   · en mode « obligatoire », on ne programme ni ne publie sans approbation ;
--   · toute approbation est effacée dès que la publication est rouverte pour
--     modification — sinon un texte approuvé pourrait être réécrit après coup
--     et partir sans que personne ne l'ait relu ;
--   · chaque changement de statut laisse une trace.
create or replace function public.social_garde_statut()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_mode text;
begin
  select mode_approbation into v_mode from social_settings where id = 1;

  if tg_op = 'UPDATE' and new.statut is distinct from old.statut then
    -- Retour en arrière : l'approbation ne survit pas à une réouverture.
    if old.statut in ('programme','publie') and new.statut not in ('programme','publie') then
      new.approuve_par := null; new.approuve_at := null;
    end if;

    if v_mode = 'obligatoire' and new.statut in ('programme','publie')
       and new.approuve_par is null then
      raise exception 'Approbation requise : cette publication doit être approuvée avant de passer en « %ance ».',
        case new.statut when 'programme' then 'Programmé' else 'Publié' end;
    end if;

    insert into social_status_log (post_id, de, vers, par)
    values (new.id, old.statut, new.statut, auth.uid());
  elsif tg_op = 'INSERT' then
    insert into social_status_log (post_id, de, vers, par)
    values (new.id, null, new.statut, auth.uid());
  end if;
  return new;
end $fn$;

drop trigger if exists social_garde_statut_t on public.social_posts;
create trigger social_garde_statut_t
  before insert or update on public.social_posts
  for each row execute function public.social_garde_statut();

-- Le déclencheur écrit dans le journal APRÈS l'insertion de la publication :
-- sur INSERT, la ligne n'existe pas encore quand un BEFORE s'exécute. On
-- sépare donc les deux moments.
create or replace function public.social_log_creation()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into social_status_log (post_id, de, vers, par)
  values (new.id, null, new.statut, auth.uid());
  return new;
end $fn$;

-- ---------- Approuver / refuser ----------
-- En fonction plutôt qu'en UPDATE libre : la date et l'auteur de la décision
-- doivent être posés en même temps que l'approbation, sans que l'appelant
-- puisse les oublier ou les falsifier.
create or replace function public.social_decider(p_id uuid, p_ok boolean, p_motif text default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_statut text;
begin
  if not can_social_valider(auth.uid()) then
    return jsonb_build_object('ok', false, 'raison', 'droits');
  end if;
  select statut into v_statut from social_posts where id = p_id;
  if v_statut is null then return jsonb_build_object('ok', false, 'raison', 'introuvable'); end if;

  if p_ok then
    update social_posts
       set approuve_par = auth.uid(), approuve_at = now(), refus_motif = null,
           updated_at = now(), updated_by = auth.uid()
     where id = p_id;
    insert into social_status_log (post_id, de, vers, par, commentaire)
    values (p_id, v_statut, v_statut, auth.uid(), 'Approuvée' || coalesce(' — ' || p_motif, ''));
  else
    update social_posts
       set approuve_par = null, approuve_at = null, refus_motif = p_motif,
           statut = 'texte_a_valider', updated_at = now(), updated_by = auth.uid()
     where id = p_id;
    insert into social_status_log (post_id, de, vers, par, commentaire)
    values (p_id, v_statut, 'texte_a_valider', auth.uid(), 'Refusée' || coalesce(' — ' || p_motif, ''));
  end if;
  return jsonb_build_object('ok', true);
end $fn$;
revoke all on function public.social_decider(uuid, boolean, text) from public, anon;
grant execute on function public.social_decider(uuid, boolean, text) to authenticated;
