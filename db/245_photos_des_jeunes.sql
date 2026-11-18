-- 245 — Photos des jeunes : l'album que la famille voit dans Mon espace
--
-- Besoin : le secrétariat photographie les jeunes à l'entraînement, et les
-- parents retrouvent quelques photos de leur enfant en action dans l'app.
--
-- ⚠ Pourquoi un bucket PRIVÉ et pas `gz-photos` : les 142 photos d'enfants
-- déjà en base vivent dans `gz-photos`, qui est PUBLIC — n'importe qui
-- connaissant l'adresse les ouvre, sans compte. Passable pour une vignette de
-- console, pas pour un album que des familles parcourent et font suivre. Ici :
-- bucket privé + URL signée, comme `physique` et `mental`.
--
-- ⚠ UNE photo, PLUSIEURS enfants (décision du 18.11.2026) : une photo d'un
-- exercice de groupe appartient à tous les jeunes dessus, d'où la table de
-- liaison. Chaque famille ne voit que les photos où SON enfant est marqué —
-- mais elle y voit forcément les autres enfants du cliché. C'est assumé, et
-- c'est pour ça que le droit à l'image existe ci-dessous.

-- ---- Droit à l'image, sur la fiche -----------------------------------------
-- null  = jamais demandé (cas de tout le monde aujourd'hui)
-- true  = la famille a dit oui
-- false = la famille a dit non → l'enfant ne paraît NULLE PART, ni dans son
--         propre album ni dans celui des autres.
-- On n'exclut PAS les `null` : sinon l'album naît vide et personne ne s'en
-- sert. La console affiche le nombre de fiches sans réponse pour qu'on aille
-- les chercher ; on pourra resserrer la règle le jour où elles sont remplies.
alter table public.people add column if not exists photo_consent boolean;
comment on column public.people.photo_consent is
  'Droit à l''image : null = non demandé, true = accordé, false = refusé (l''enfant n''apparaît sur aucune photo).';

-- ---- Les photos ------------------------------------------------------------
create table if not exists public.person_photos (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null,
  file_name     text,
  taken_on      date not null default current_date,
  course_id     uuid references public.courses(id) on delete set null,
  comment       text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);

-- Qui est sur la photo. Une ligne par enfant.
create table if not exists public.person_photo_people (
  photo_id   uuid not null references public.person_photos(id) on delete cascade,
  person_id  uuid not null references public.people(id) on delete cascade,
  primary key (photo_id, person_id)
);
create index if not exists ppp_person_idx on public.person_photo_people (person_id);
create index if not exists person_photos_date_idx on public.person_photos (taken_on desc);

alter table public.person_photos       enable row level security;
alter table public.person_photo_people enable row level security;

-- Le secrétariat (= la population du Répertoire) dépose et retire.
drop policy if exists pp_staff on public.person_photos;
create policy pp_staff on public.person_photos
  for all to authenticated
  using (can_membres(auth.uid())) with check (can_membres(auth.uid()));

drop policy if exists ppp_staff on public.person_photo_people;
create policy ppp_staff on public.person_photo_people
  for all to authenticated
  using (can_membres(auth.uid())) with check (can_membres(auth.uid()));

-- La famille lit les photos où SON enfant est marqué.
-- ⚠ Et un refus retire la photo à TOUT LE MONDE, pas seulement à la famille
-- de celui qui refuse : sinon un enfant dont les parents ont dit non
-- continuait de paraître sur les photos de groupe que les AUTRES familles
-- regardent — exactement l'inverse de ce qui a été décidé. Vérifié en se
-- mettant dans la peau d'une famille : la photo de groupe disparaît dès
-- qu'un seul des enfants dessus a refusé.
drop policy if exists pp_famille on public.person_photos;
create policy pp_famille on public.person_photos
  for select to authenticated
  using (
    exists (select 1 from person_photo_people l
             where l.photo_id = person_photos.id
               and l.person_id in (select my_family_ids()))
    and not exists (select 1 from person_photo_people l2
                      join people pe2 on pe2.id = l2.person_id
                     where l2.photo_id = person_photos.id
                       and pe2.photo_consent is false));

drop policy if exists ppp_famille on public.person_photo_people;
create policy ppp_famille on public.person_photo_people
  for select to authenticated
  using (person_id in (select my_family_ids()));

-- ---- Bucket privé ----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos-jeunes', 'photos-jeunes', false, 15728640,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ⚠ La policy de stockage suit la MÊME garde que la table : restreindre la
-- table seule laisserait les fichiers téléchargeables par chemin.
drop policy if exists photos_jeunes_staff on storage.objects;
create policy photos_jeunes_staff on storage.objects
  for all to authenticated
  using (bucket_id = 'photos-jeunes' and can_membres(auth.uid()))
  with check (bucket_id = 'photos-jeunes' and can_membres(auth.uid()));

-- La famille télécharge un fichier seulement s'il porte une photo de son
-- enfant — et même garde de consentement que la table.
drop policy if exists photos_jeunes_famille on storage.objects;
create policy photos_jeunes_famille on storage.objects
  for select to authenticated
  using (bucket_id = 'photos-jeunes' and exists (
    select 1 from person_photos ph
     where ph.storage_path = storage.objects.name
       and exists (select 1 from person_photo_people l
                    where l.photo_id = ph.id and l.person_id in (select my_family_ids()))
       and not exists (select 1 from person_photo_people l2
                         join people pe2 on pe2.id = l2.person_id
                        where l2.photo_id = ph.id and pe2.photo_consent is false)));

-- ---- Ce que lit Mon espace -------------------------------------------------
-- Renvoie les photos de la famille, la plus récente d'abord. Le chemin seul :
-- l'app en tire une URL signée, comme pour `phys_media`.
create or replace function public.portal_photos(p_limit int default 60)
returns table (id uuid, storage_path text, taken_on date, comment text,
               qui text, course_label text)
language sql stable security definer set search_path to 'public'
as $$
  select ph.id, ph.storage_path, ph.taken_on, ph.comment,
    (select string_agg(pe.first_name, ', ' order by pe.first_name)
       from person_photo_people l2 join people pe on pe.id = l2.person_id
      where l2.photo_id = ph.id and l2.person_id in (select my_family_ids())) as qui,
    (select coalesce(nullif(trim(c.title), ''), ct.name)
       from courses c left join course_types ct on ct.id = c.course_type_id
      where c.id = ph.course_id) as course_label
  from person_photos ph
  where exists (select 1 from person_photo_people l
                 where l.photo_id = ph.id and l.person_id in (select my_family_ids()))
    and not exists (select 1 from person_photo_people l3
                      join people pe3 on pe3.id = l3.person_id
                     where l3.photo_id = ph.id and pe3.photo_consent is false)
  order by ph.taken_on desc, ph.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;
