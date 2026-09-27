-- 27.09.2026 (demandes Dan) — trois choses :
--  A) PHYSIQUE : onglet Mon espace « Physique » (sport-études, pro, pro U18, compétition, performance) avec
--     • Routine : programmes d'exercices créés par le staff et attribués À TITRE INDIVIDUEL (phys_routines +
--       phys_routine_assign). 3 routines de base attribuées aux jeunes des filières concernées.
--     • Prépa physique : fil type chat staff ↔ jeune (texte, lien, fichier/photo/vidéo), comme le Mental.
--     Staff = coach, coach physique, head coach, admin, superadmin.
--  B) ACCUEIL ESPACE PRIVÉ (ex-« News ») : messages rangés par saison juniors, ciblés par filière ; Mon espace
--     n'affiche que ceux de la saison en cours. Un message de bienvenue par filière pour 2026/27.
--  C) CONTACT : le jeune / parent écrit au secrétariat depuis Mon espace ; le message arrive dans la
--     Messagerie de la console (boîte info@teamlausanne.ch), sujet « ESPACE PRIVÉ - Prénom Nom ».

-- ============================== A) PHYSIQUE ==============================
create or replace function public.is_phys_staff(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = uid
                 and role::text in ('coach', 'coach_physique', 'head_coach', 'admin', 'superadmin'));
$$;
create or replace function public.can_phys_of(p_youth uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_phys_staff(auth.uid()) or can_read_public_of(p_youth);
$$;
grant execute on function public.is_phys_staff(uuid), public.can_phys_of(uuid) to authenticated;

-- ---- Fil « Prépa physique » ----
create table if not exists public.phys_thread (
  id uuid primary key default gen_random_uuid(),
  youth_person_id uuid not null references public.people(id) on delete cascade,
  author_is_staff boolean not null,
  author_name text,
  body text, link_url text, file_path text, file_name text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists pth_youth_idx on public.phys_thread(youth_person_id, created_at);
alter table public.phys_thread enable row level security;
drop policy if exists pth_read on public.phys_thread;
create policy pth_read on public.phys_thread for select to authenticated using (can_phys_of(youth_person_id));
grant select on public.phys_thread to authenticated;

create or replace function public.phys_thread_list(p_youth uuid)
returns setof public.phys_thread language plpgsql stable security definer set search_path = public as $$
begin
  if not can_phys_of(p_youth) then raise exception 'Accès refusé'; end if;
  return query select * from public.phys_thread where youth_person_id = p_youth order by created_at;
end $$;

create or replace function public.phys_thread_post(p_youth uuid, p_body text, p_link text, p_file_path text, p_file_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_staff boolean; v_name text; v_id uuid;
begin
  if not can_phys_of(p_youth) then raise exception 'Accès refusé'; end if;
  if coalesce(btrim(p_body), '') = '' and coalesce(btrim(p_link), '') = '' and coalesce(p_file_path, '') = '' then
    raise exception 'Message vide';
  end if;
  v_staff := is_phys_staff(auth.uid());
  if v_staff then
    select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_name
      from people pe join profiles pr on pr.person_id = pe.id where pr.user_id = auth.uid() limit 1;
  else
    select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_name from people where id = p_youth;
  end if;
  insert into public.phys_thread(youth_person_id, author_is_staff, author_name, body, link_url, file_path, file_name, created_by)
  values (p_youth, v_staff, coalesce(nullif(v_name, ''), '—'), nullif(left(btrim(coalesce(p_body, '')), 8000), ''),
          nullif(btrim(coalesce(p_link, '')), ''), nullif(p_file_path, ''), nullif(p_file_name, ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.phys_thread_delete(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.phys_thread where id = p_id and (created_by = auth.uid() or is_phys_staff(auth.uid()));
end $$;

revoke all on function public.phys_thread_list(uuid), public.phys_thread_post(uuid, text, text, text, text), public.phys_thread_delete(uuid) from public, anon;
grant execute on function public.phys_thread_list(uuid), public.phys_thread_post(uuid, text, text, text, text), public.phys_thread_delete(uuid) to authenticated;

-- Bucket privé des pièces jointes (chemin = <youth_person_id>/<fichier>), 50 Mo max (vidéos courtes).
insert into storage.buckets (id, name, public, file_size_limit) values ('physique', 'physique', false, 52428800)
  on conflict (id) do update set file_size_limit = excluded.file_size_limit;
drop policy if exists physique_files_all on storage.objects;
create policy physique_files_all on storage.objects for all to authenticated
  using (bucket_id = 'physique' and can_phys_of(nullif((storage.foldername(name))[1], '')::uuid))
  with check (bucket_id = 'physique' and can_phys_of(nullif((storage.foldername(name))[1], '')::uuid));

-- ---- Routines ----
create table if not exists public.phys_routines (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 120),
  kind text not null default 'autre' check (kind in ('soir', 'echauffement', 'decrassage', 'renfo', 'autre')),
  duration text,
  intro text,
  exercises jsonb not null default '[]'::jsonb,   -- [{ "name": …, "dose": …, "how": … }]
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.phys_routine_assign (
  routine_id uuid not null references public.phys_routines(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  assigned_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (routine_id, person_id)
);
create index if not exists pra_person_idx on public.phys_routine_assign(person_id);
alter table public.phys_routines enable row level security;
alter table public.phys_routine_assign enable row level security;
drop policy if exists pr_staff on public.phys_routines;
create policy pr_staff on public.phys_routines for all to authenticated using (is_phys_staff(auth.uid())) with check (is_phys_staff(auth.uid()));
drop policy if exists pr_mine on public.phys_routines;
create policy pr_mine on public.phys_routines for select to authenticated
  using (exists (select 1 from phys_routine_assign a where a.routine_id = phys_routines.id and can_read_public_of(a.person_id)));
drop policy if exists pra_staff on public.phys_routine_assign;
create policy pra_staff on public.phys_routine_assign for all to authenticated using (is_phys_staff(auth.uid())) with check (is_phys_staff(auth.uid()));
drop policy if exists pra_mine on public.phys_routine_assign;
create policy pra_mine on public.phys_routine_assign for select to authenticated using (can_read_public_of(person_id));
grant select, insert, update, delete on public.phys_routines, public.phys_routine_assign to authenticated;

-- Routines d'un jeune (Mon espace et aperçu console).
create or replace function public.portal_phys_routines(p_youth uuid)
returns setof public.phys_routines language plpgsql stable security definer set search_path = public as $$
begin
  if not can_phys_of(p_youth) then raise exception 'Accès refusé'; end if;
  return query select r.* from phys_routines r join phys_routine_assign a on a.routine_id = r.id
    where a.person_id = p_youth
    order by case r.kind when 'echauffement' then 1 when 'decrassage' then 2 when 'soir' then 3 else 4 end, r.title;
end $$;
revoke all on function public.portal_phys_routines(uuid) from public, anon;
grant execute on function public.portal_phys_routines(uuid) to authenticated;

-- 3 routines de base (niveau moyen / ado), attribuées une par une aux jeunes des 5 filières de la saison en cours.
do $$
declare r_soir uuid; r_echauf uuid; r_decr uuid;
begin
  if exists (select 1 from phys_routines) then return; end if;
  insert into phys_routines(title, kind, duration, intro, exercises) values
  ('Routine du soir — mobilité et étirements', 'soir', '12 à 15 min',
   'Tous les soirs, chez toi, au calme (après la douche par exemple). Aucun étirement ne doit faire mal : tu cherches une tension agréable, tu respires lentement et tu ne donnes jamais d''à-coups. Si une douleur apparaît, tu arrêtes et tu en parles à ton coach.',
   '[
     {"name":"Respiration ventrale","dose":"1 min","how":"Sur le dos, genoux pliés, une main sur le ventre. Inspire 4 secondes par le nez (le ventre gonfle), expire 6 secondes par la bouche."},
     {"name":"Chat-vache","dose":"10 répétitions lentes","how":"À quatre pattes : arrondis le dos en expirant, puis creuse-le doucement en inspirant. Le mouvement part du bas du dos jusqu''à la nuque."},
     {"name":"Rotations du haut du dos","dose":"8 par côté","how":"À quatre pattes, une main derrière la tête : amène le coude vers le bras d''appui, puis ouvre vers le plafond en suivant ton coude du regard."},
     {"name":"Grande fente avec ouverture","dose":"5 par côté","how":"Grande fente avant, main opposée au sol : lève l''autre bras vers le plafond en tournant le buste, reviens, change de côté."},
     {"name":"Étirement des hanches (psoas)","dose":"30 s par côté","how":"Genou arrière au sol (sur un coussin), bassin rentré, avance doucement la hanche sans creuser le dos. Tu sens l''étirement devant la cuisse arrière."},
     {"name":"Arrière des cuisses (ischios)","dose":"30 s par jambe","how":"Sur le dos, une serviette ou un élastique sous le pied, monte la jambe tendue jusqu''à sentir l''étirement. L''autre jambe reste au sol."},
     {"name":"Fessier en « 4 »","dose":"30 s par côté","how":"Sur le dos, pose la cheville sur le genou opposé et ramène les deux jambes vers toi en tenant l''arrière de la cuisse."},
     {"name":"Mollets contre un mur","dose":"30 s par jambe","how":"Mains au mur, une jambe tendue derrière, talon au sol. Penche-toi doucement vers le mur."},
     {"name":"Épaules et avant-bras","dose":"20 à 30 s chaque","how":"Bras tendu croisé devant la poitrine, tiré par l''autre main. Puis bras tendu devant, paume vers le haut, tire doucement les doigts vers le bas ; puis paume vers le bas."},
     {"name":"Posture de l''enfant","dose":"1 min","how":"À genoux, fesses sur les talons, bras allongés devant toi, front posé. Relâche tout et respire lentement."}
   ]'::jsonb),
  ('Échauffement avant entraînement ou match', 'echauffement', '10 min',
   'Juste avant la séance ou le match, avec un élastique. L''intensité monte petit à petit : à la fin, tu dois avoir chaud et être un peu essoufflé·e, jamais fatigué·e.',
   '[
     {"name":"Footing léger ou corde à sauter","dose":"2 min","how":"Tranquille au début, un peu plus vite la dernière minute."},
     {"name":"Pas chassés et pas croisés","dose":"2 longueurs de ligne de fond dans chaque sens","how":"Reste bas, pieds rapides, le buste face au filet."},
     {"name":"Montées de genoux et talons-fesses","dose":"2 × 15 m chacun","how":"Pas rapides, bras qui accompagnent, sur l''avant du pied."},
     {"name":"Fentes avant avec rotation du buste","dose":"6 par jambe","how":"Grand pas en avant, genou arrière proche du sol, tourne le buste du côté de la jambe avant."},
     {"name":"Balancés de jambes","dose":"10 par jambe, avant-arrière puis sur le côté","how":"Une main au filet ou au grillage, balance la jambe de plus en plus haut, sans forcer."},
     {"name":"Élastique : rotations externes d''épaule","dose":"12 par bras","how":"Coude collé au corps et plié à 90°, tourne l''avant-bras vers l''extérieur contre l''élastique, reviens lentement."},
     {"name":"Élastique : tirage (rowing)","dose":"12","how":"Élastique devant toi, bras tendus : tire les coudes vers l''arrière en serrant les omoplates."},
     {"name":"Élastique aux genoux : marche latérale","dose":"2 × 8 pas par côté","how":"Élastique au-dessus des genoux, légèrement accroupi·e, fais de petits pas sur le côté sans que les genoux rentrent."},
     {"name":"Poignets et grands cercles de bras","dose":"30 s","how":"Rotations des poignets dans les deux sens, puis grands cercles de bras vers l''avant et vers l''arrière."},
     {"name":"Réactivité","dose":"3 × (split-step + sprint de 5 m)","how":"Petit saut sur place (split-step) puis démarrage explosif sur 5 m, à gauche, à droite, en avant. Marche pour revenir."}
   ]'::jsonb),
  ('Décrassage après entraînement ou match', 'decrassage', '10 min',
   'Juste après l''effort, pour aider ton corps à récupérer. Les étirements sont doux et tenus : tes muscles sont fatigués, ne force pas.',
   '[
     {"name":"Marche ou footing très lent","dose":"3 min","how":"Laisse redescendre le cœur, respire calmement."},
     {"name":"Boire et prévoir une collation","dose":"—","how":"Quelques gorgées d''eau tout de suite, puis une collation dans les 30 minutes (fruit, barre de céréales, sandwich)."},
     {"name":"Avant des cuisses (quadriceps)","dose":"30 s par jambe","how":"Debout, attrape ta cheville derrière toi, genoux côte à côte, bassin rentré."},
     {"name":"Arrière des cuisses","dose":"30 s par jambe","how":"Talon posé sur un banc bas, jambe tendue, penche-toi légèrement en avant, dos droit."},
     {"name":"Mollets","dose":"30 s par jambe","how":"Mains contre le filet ou un mur, jambe arrière tendue, talon au sol."},
     {"name":"Fessiers assis","dose":"30 s par côté","how":"Assis·e, une jambe croisée par-dessus l''autre, ramène le genou vers la poitrine."},
     {"name":"Épaules et triceps","dose":"20 s chaque bras","how":"Bras croisé devant la poitrine, puis main derrière la tête et coude tiré doucement par l''autre main."},
     {"name":"Avant-bras et poignets","dose":"20 s chaque sens","how":"Bras tendu, tire doucement les doigts vers le bas puis vers le haut."},
     {"name":"Respiration 4-6","dose":"1 min","how":"Inspire 4 secondes, expire 6 secondes. Tu peux fermer les yeux."}
   ]'::jsonb);
  select id into r_soir from phys_routines where kind = 'soir' limit 1;
  select id into r_echauf from phys_routines where kind = 'echauffement' limit 1;
  select id into r_decr from phys_routines where kind = 'decrassage' limit 1;
  insert into phys_routine_assign(routine_id, person_id, assigned_by)
  select r.id, y.pid, null
  from (select distinct rp.person_id pid from role_periods rp join seasons s on s.id = rp.season_id
        where s.kind = 'juniors' and current_date between s.start_date and s.end_date
          and rp.role in ('pro', 'pro-u18', 'competition', 'performance', 'sport-etudes')) y
  cross join (values (r_soir), (r_echauf), (r_decr)) r(id)
  on conflict do nothing;
end $$;

-- ============================== B) ACCUEIL ESPACE PRIVÉ ==============================
alter table public.news add column if not exists season_id uuid references public.seasons(id) on delete set null;
create index if not exists news_season_idx on public.news(season_id);

-- Messages de la saison juniors en cours (ou sans saison), pour les filières du compte (le jeune ou ses enfants) :
-- filière de la saison du message (role_periods) ; tags de la fiche en secours (membre, message sans saison).
create or replace function public.portal_news()
returns table(id uuid, title text, body text, image_url text, published_at timestamptz)
language sql stable security definer set search_path = public as $$
  with mine as (select * from my_family_ids() as pid),
  cur as (select s.id from seasons s where s.kind = 'juniors' and current_date between s.start_date and s.end_date limit 1)
  select n.id, n.title, n.body, n.image_url, coalesce(n.published_at, n.created_at)
  from news n
  where n.published = true
    and (n.season_id is null or n.season_id = (select id from cur))
    and ( coalesce(array_length(n.audiences, 1), 0) = 0
          or exists (select 1 from role_periods rp join mine on rp.person_id = mine.pid
                     where rp.season_id = coalesce(n.season_id, (select id from cur)) and rp.role = any(n.audiences))
          or exists (select 1 from person_roles pr join mine on pr.person_id = mine.pid where pr.role = any(n.audiences)) )
  order by coalesce(n.published_at, n.created_at) desc;
$$;

-- Qui voit un message (console) : les personnes de la filière pour la saison du message.
create or replace function public.news_audience_people(p_news uuid)
returns table(person_id uuid, first_name text, last_name text, role text)
language sql stable security definer set search_path = public as $$
  select distinct on (pe.id) pe.id, pe.first_name, pe.last_name, rp.role
  from news n
  join role_periods rp on rp.role = any(n.audiences)
    and rp.season_id = coalesce(n.season_id, (select s.id from seasons s where s.kind = 'juniors' and current_date between s.start_date and s.end_date limit 1))
  join people pe on pe.id = rp.person_id
  where n.id = p_news and is_staff(auth.uid())
  order by pe.id;
$$;
revoke all on function public.news_audience_people(uuid) from public, anon;
grant execute on function public.news_audience_people(uuid) to authenticated;

-- Un message de bienvenue par filière pour 2026/27 (photos du site teamlausanne.ch).
do $$
declare s uuid;
begin
  select id into s from seasons where kind = 'juniors' and label = '2026/27' limit 1;
  if s is null or exists (select 1 from news where season_id = s) then return; end if;
  insert into news(title, body, image_url, audiences, published, published_at, season_id) values
  ('Bienvenue au KidsTennis ! 🎾',
   E'Bienvenue dans la famille Team Lausanne !\n\nCette saison, on va bouger, jouer et surtout s''amuser en découvrant le tennis, à ton rythme. Dans ton espace privé, tu retrouves tes cours de la semaine et toutes les nouvelles du club.\n\nOn se réjouit de te voir sur le court !',
   'https://teamlausanne.ch/assets/photos/kidstennis-2026.jpg', array['kidstennis'], true, now(), s),
  ('Bienvenue dans la filière Club',
   E'Bienvenue pour cette nouvelle saison au Club !\n\nTu vas progresser à ton rythme, avec tes copains et tes coachs, et découvrir le plaisir du match grâce à nos tournois GameZone. Ton espace privé te montre tes cours de la semaine et les nouvelles du club.\n\nBonne saison à toi !',
   'https://teamlausanne.ch/assets/photos/club-2026.jpg', array['club'], true, now(), s),
  ('Bienvenue en Compétition 🏆',
   E'Bienvenue dans la filière Compétition pour la saison 2026/27 !\n\nCette année, on construit ta saison ensemble : dans ton espace privé, l''onglet Saison te montre le planning prévu par tes coachs (et les week-ends où t''inscrire à un tournoi), l''onglet Match ta feuille de match avant et après chaque rencontre, et l''onglet Physique tes routines d''échauffement et de récupération.\n\nOn compte sur ton engagement, on s''occupe du reste. Bonne saison !',
   'https://teamlausanne.ch/assets/photos/competition-2026.jpg', array['competition'], true, now(), s),
  ('Bienvenue en Performance 💪',
   E'Bienvenue dans la filière Performance !\n\nPlus d''entraînement, plus d''exigence, et un suivi plus proche : planning de saison, feuilles de match, routines physiques et échanges avec tes coachs, tout est dans ton espace privé.\n\nOn se réjouit de faire ce bout de chemin avec toi. Bonne saison !',
   'https://teamlausanne.ch/assets/photos/performance-2026.jpg', array['performance'], true, now(), s),
  ('Bienvenue en Sport-études 📚🎾',
   E'Bienvenue en Sport-études pour la saison 2026/27 !\n\nConcilier l''école et le tennis de haut niveau demande de l''organisation : ton espace privé t''aide au quotidien, avec tes cours et tes études, ta saison de tournois, tes feuilles de match, ta préparation physique et ton suivi mental.\n\nToute l''équipe est là pour t''accompagner. Belle saison à toi !',
   'https://teamlausanne.ch/assets/photos/sport-etudes-2026.jpg', array['sport-etudes'], true, now(), s),
  ('Bienvenue en Pro U18',
   E'Bienvenue dans la filière Pro U18 !\n\nCette saison, tout est pensé pour ta progression vers le haut niveau : planning de tournois, feuilles de match, prépa physique et suivi mental, directement dans ton espace privé.\n\nOn avance ensemble, match après match. Bonne saison !',
   'https://teamlausanne.ch/assets/photos/pro-u18-2026.jpg', array['pro-u18'], true, now(), s),
  ('Bienvenue en Pro',
   E'Bienvenue dans la filière Pro pour la saison 2026/27 !\n\nTon espace privé réunit ton planning de tournois, tes feuilles de match, ta préparation physique et ton suivi mental. Tes coachs y déposent aussi leurs messages et documents.\n\nBelle saison sur le circuit, on est derrière toi !',
   'https://teamlausanne.ch/assets/photos/pro-2026.jpg', array['pro'], true, now(), s),
  ('Bienvenue aux cours adultes',
   E'Bienvenue pour cette nouvelle saison de tennis !\n\nVos cours de la semaine et les nouvelles du club sont réunis dans votre espace privé. Pour toute question, l''onglet Contact vous permet d''écrire directement au secrétariat.\n\nBelle saison sur les courts !',
   'https://teamlausanne.ch/assets/photos/adultes-2026.jpg', array['adultes'], true, now(), s);
end $$;

-- ============================== C) CONTACT ==============================
-- Message du jeune / parent vers le secrétariat : arrive dans la Messagerie (boîte info@), « à traiter ».
-- Sujet : « ESPACE PRIVÉ - Prénom Nom » (le jeune concerné). Répondre = répondre à l'adresse du compte.
create or replace function public.portal_contact(p_youth uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text; v_from text; v_who text; v_msg text := btrim(coalesce(p_message, ''));
begin
  if auth.uid() is null then raise exception 'Connecte-toi d''abord'; end if;
  if length(v_msg) < 2 then raise exception 'Écris ton message'; end if;
  if length(v_msg) > 5000 then raise exception 'Message trop long (5000 caractères au maximum)'; end if;
  if p_youth is not null and not can_read_public_of(p_youth) then raise exception 'Accès refusé'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select trim(coalesce(pe.first_name, '') || ' ' || coalesce(pe.last_name, '')) into v_from
    from profiles pr join people pe on pe.id = pr.person_id where pr.user_id = auth.uid() limit 1;
  if p_youth is not null then
    select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_who from people where id = p_youth;
  end if;
  v_who := coalesce(nullif(v_who, ''), nullif(v_from, ''), v_email);
  if (select count(*) from mail_messages where from_address = v_email and subject like 'ESPACE PRIVÉ - %'
        and received_at > now() - interval '1 hour') >= 10 then
    raise exception 'Trop de messages en peu de temps : réessaie dans une heure';
  end if;
  insert into mail_messages(account_address, direction, from_name, from_address, to_address, subject, snippet, body_text,
                            received_at, is_read, status)
  values ('info@teamlausanne.ch', 'in', coalesce(nullif(v_from, ''), v_who), v_email, 'info@teamlausanne.ch',
          'ESPACE PRIVÉ - ' || v_who,
          left(regexp_replace(v_msg, '\s+', ' ', 'g'), 140),
          v_msg || E'\n\n—\nEnvoyé depuis l''espace privé (Mon espace) · concerne : ' || v_who
            || E'\nRépondre à : ' || coalesce(nullif(v_from, ''), v_who) || ' <' || v_email || '>',
          now(), false, 'a_traiter');
end $$;
revoke all on function public.portal_contact(uuid, text) from public, anon;
grant execute on function public.portal_contact(uuid, text) to authenticated;
