-- Planification des contenus (Instagram, TikTok, newsletter) — 28.09.2026
--
-- Reprend la taxonomie éditoriale de Team Lausanne : 14 piliers, des
-- étiquettes par famille, et les champs de suivi de production.
--
-- Trois choix de structure qui viennent du document lui-même :
--
--  1. UN pilier principal par publication, et PLUSIEURS étiquettes. C'est
--     écrit noir sur blanc : « les niveaux Kids, Club, Compétition… sont des
--     étiquettes transversales ». Faire du niveau un pilier aurait multiplié
--     les catégories sans rien apprendre.
--
--  2. Les étiquettes vivent en TABLE, pas en liste figée dans le code. Elles
--     changent au fil des saisons (un nouveau partenaire, un nouveau format) ;
--     une liste en dur obligerait à repasser par un déploiement.
--
--  3. Un champ « accord des personnes filmées ». On filme des mineurs : ce
--     n'est pas un détail de confort, et un post sans accord ne doit pas
--     pouvoir passer en « programmé » sans qu'on s'en aperçoive.

-- ---------- Piliers ----------
create table if not exists public.social_pillars (
  id serial primary key,
  n int not null unique,
  name text not null,
  sujets text,
  couleur text not null default '#69708a',
  actif boolean not null default true
);

insert into public.social_pillars (n, name, sujets, couleur) values
 (1, 'Découvrir le tennis',            'Premières balles, plaisir du jeu, Kids Tennis, initiations, journées découverte, accueil des débutants.', '#2bb673'),
 (2, 'Le parcours Team Lausanne',      'Les voies Kids, Club, Compétition, Performance, Sport-Études, Pro U18 et Pro ; adultes et cours privés ; passages entre programmes.', '#073eb5'),
 (3, 'Apprendre et progresser',        'Technique, tactique, exercices, analyse vidéo, objectifs individuels, planification et mesure de la progression.', '#137297'),
 (4, 'La performance dans son ensemble','Préparation physique, coordination, mobilité, récupération, préparation mentale, routines, hygiène de vie sportive.', '#6d3fd1'),
 (5, 'Sport-Études et avenir',         'Journée type, études encadrées, autonomie, équilibre sport-école, choix après la formation (Suisse, NCAA, haut niveau, métiers du sport).', '#b0329a'),
 (6, 'Les joueurs et leurs trajectoires','Portraits à tous les niveaux, motivations, progrès, difficultés, premiers matchs, résultats remis en contexte.', '#e0561e'),
 (7, 'La compétition à tous les niveaux','GameZone, premiers tournois, circuit junior, tournois accompagnés, Interclubs, équipes LNB, culture du match.', '#c0392f'),
 (8, 'Lausanne Open et grands rendez-vous','Tournoi professionnel, joueurs, matchs, public, animations, écoles invitées, bénévoles, partenaires et coulisses.', '#8e2620'),
 (9, 'Stages et vacances',             'Kids Tennis, Loisirs, « Entraîne-toi comme un pro », adultes ; déroulement, ambiance, choix du stage, infos aux familles.', '#c2560d'),
 (10,'Les coachs et l''équipe',         'Portraits, spécialités, philosophie d''entraînement, préparation des séances, formation des jeunes coachs.', '#9c6500'),
 (11,'TC Lausanne-Sports et vie du club','Rôle du club et de l''académie, adhésion, réservation, tennis adulte, familles, membres, vie associative.', '#4e8309'),
 (12,'Valeurs et impact local',        'Accès au tennis, inclusion, transmission, actions avec les écoles, respect, esprit d''équipe, plaisir de jouer.', '#1c7d38'),
 (13,'Partenaires et écosystème',      'Sponsors, partenaires sportifs, éducatifs, médicaux et locaux ; leur rôle concret dans la formation et les événements.', '#0b6b6b'),
 (14,'Réponses et informations pratiques','Inscriptions, essais, matériel, licences, MyTennis, horaires, fonctionnement, échéances, FAQ et appels à l''action.', '#64748b')
on conflict (n) do nothing;

-- ---------- Étiquettes ----------
create table if not exists public.social_tags (
  id serial primary key,
  famille text not null check (famille in ('programme','evenement','public','objectif','format')),
  nom text not null,
  ordre int not null default 0,
  actif boolean not null default true,
  unique (famille, nom)
);

insert into public.social_tags (famille, nom, ordre) values
 ('programme','Kids Tennis',1),('programme','Club',2),('programme','Compétition',3),
 ('programme','Performance',4),('programme','Sport-Études',5),('programme','Pro U18',6),
 ('programme','Pro',7),('programme','Adultes',8),('programme','Cours privés',9),
 ('programme','Stages',10),('programme','TC Lausanne-Sports',11),('programme','Lausanne Open',12),
 ('evenement','GameZone',1),('evenement','Tournoi junior',2),('evenement','Tournoi accompagné',3),
 ('evenement','Interclubs juniors',4),('evenement','Interclubs adultes',5),('evenement','LNB',6),
 ('evenement','Lausanne Open',7),('evenement','Journée découverte',8),('evenement','Événement club',9),
 ('evenement','Stage',10),
 ('public','Enfants',1),('public','Adolescents',2),('public','Parents',3),
 ('public','Joueurs adultes',4),('public','Membres du club',5),('public','Futurs élèves',6),
 ('public','Grand public',7),('public','Partenaires',8),
 ('objectif','Faire découvrir',1),('objectif','Expliquer',2),('objectif','Inspirer',3),
 ('objectif','Montrer une progression',4),('objectif','Créer du lien',5),
 ('objectif','Obtenir une inscription',6),('objectif','Faire venir à un événement',7),
 ('objectif','Valoriser un partenaire',8),('objectif','Répondre à une question',9),
 ('format','Reel',1),('format','Vidéo courte',2),('format','Carrousel',3),('format','Story',4),
 ('format','Photo',5),('format','Interview',6),('format','Article / bloc newsletter',7),
 ('format','Témoignage',8),('format','FAQ',9)
on conflict (famille, nom) do nothing;

-- ---------- Publications ----------
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  pillar_n int references public.social_pillars(n),
  statut text not null default 'idee'
    check (statut in ('idee','a_filmer','montage','texte_a_valider','programme','publie')),
  date_publication date,
  date_evenement date,
  canaux text[] not null default '{}',          -- instagram | tiktok | newsletter
  angle text,
  texte text,
  hashtags text,
  cta text,
  responsable_id uuid references public.pm_members(id) on delete set null,
  a_filmer text,                                 -- personne à filmer
  lieu text,
  partenaire text,
  accord_personnes boolean not null default false,
  lien_publie text,
  bilan text,                                    -- résultat et enseignement
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index if not exists social_posts_date on public.social_posts (date_publication);
create index if not exists social_posts_statut on public.social_posts (statut);

create table if not exists public.social_post_tags (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  tag_id  int  not null references public.social_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

-- Images : le chemin dans le bucket « social ». Plusieurs par publication
-- (un carrousel en compte jusqu'a dix).
create table if not exists public.social_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  chemin text not null,
  nom text,
  ordre int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists social_media_post on public.social_post_media (post_id, ordre);

-- ---------- Accès ----------
-- Toute l'équipe VOIT le planning : les coachs savent ainsi ce qui se tourne
-- et quand. L'écriture reste au secrétariat et à la direction, qui tiennent
-- la ligne éditoriale.
create or replace function public.can_social(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
                  and role in ('superadmin','admin','secretaire','head_coach',
                               'coach','coach_physique','coach_mental','moniteur','prof'));
$$;
create or replace function public.can_social_edit(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
                  and role in ('superadmin','admin','secretaire'));
$$;

alter table public.social_pillars   enable row level security;
alter table public.social_tags      enable row level security;
alter table public.social_posts     enable row level security;
alter table public.social_post_tags enable row level security;
alter table public.social_post_media enable row level security;

drop policy if exists soc_pil_lire on public.social_pillars;
create policy soc_pil_lire on public.social_pillars for select to authenticated using (can_social(auth.uid()));
drop policy if exists soc_pil_ecrire on public.social_pillars;
create policy soc_pil_ecrire on public.social_pillars for all to authenticated
  using (can_social_edit(auth.uid())) with check (can_social_edit(auth.uid()));

drop policy if exists soc_tag_lire on public.social_tags;
create policy soc_tag_lire on public.social_tags for select to authenticated using (can_social(auth.uid()));
drop policy if exists soc_tag_ecrire on public.social_tags;
create policy soc_tag_ecrire on public.social_tags for all to authenticated
  using (can_social_edit(auth.uid())) with check (can_social_edit(auth.uid()));

drop policy if exists soc_post_lire on public.social_posts;
create policy soc_post_lire on public.social_posts for select to authenticated using (can_social(auth.uid()));
drop policy if exists soc_post_ecrire on public.social_posts;
create policy soc_post_ecrire on public.social_posts for all to authenticated
  using (can_social_edit(auth.uid())) with check (can_social_edit(auth.uid()));

drop policy if exists soc_pt_lire on public.social_post_tags;
create policy soc_pt_lire on public.social_post_tags for select to authenticated using (can_social(auth.uid()));
drop policy if exists soc_pt_ecrire on public.social_post_tags;
create policy soc_pt_ecrire on public.social_post_tags for all to authenticated
  using (can_social_edit(auth.uid())) with check (can_social_edit(auth.uid()));

drop policy if exists soc_med_lire on public.social_post_media;
create policy soc_med_lire on public.social_post_media for select to authenticated using (can_social(auth.uid()));
drop policy if exists soc_med_ecrire on public.social_post_media;
create policy soc_med_ecrire on public.social_post_media for all to authenticated
  using (can_social_edit(auth.uid())) with check (can_social_edit(auth.uid()));

grant select on public.social_pillars, public.social_tags to authenticated;
grant select, insert, update, delete on public.social_posts, public.social_post_tags,
      public.social_post_media, public.social_pillars, public.social_tags to authenticated;
grant usage, select on sequence public.social_pillars_id_seq, public.social_tags_id_seq to authenticated;

revoke all on function public.can_social(uuid)      from public, anon;
revoke all on function public.can_social_edit(uuid) from public, anon;
grant execute on function public.can_social(uuid)      to authenticated;
grant execute on function public.can_social_edit(uuid) to authenticated;

-- ---------- Couverture des piliers ----------
-- La règle 2 du document : « couvrir l'ensemble des 14 piliers à l'échelle
-- d'un trimestre ». Cette fonction la rend mesurable, donc tenable — sinon
-- on s'en aperçoit trop tard.
create or replace function public.social_couverture(p_debut date, p_fin date)
returns table (n int, name text, couleur text, publications bigint)
language sql stable security definer set search_path = public as $$
  select p.n, p.name, p.couleur,
         count(s.id) filter (where s.date_publication between p_debut and p_fin)
    from social_pillars p
    left join social_posts s on s.pillar_n = p.n
   where p.actif and can_social(auth.uid())
   group by p.n, p.name, p.couleur
   order by p.n;
$$;
revoke all on function public.social_couverture(date, date) from public, anon;
grant execute on function public.social_couverture(date, date) to authenticated;
