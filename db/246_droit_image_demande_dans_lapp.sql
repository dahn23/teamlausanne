-- 246 — Droit à l'image : la question est posée DANS l'app (18.11.2026)
--
-- Pourquoi : db/245 a créé `people.photo_consent` (null / true / false) mais
-- personne pour le remplir — 128 fiches à null le jour de la sortie, et aucune
-- chance que 128 réponses rentrent sur papier. Donc la famille répond
-- elle-même, au moment où ça a un sens : la première fois qu'il y a des photos
-- de son enfant à voir.
--
-- Le marché : l'album reste FERMÉ tant que la famille n'a pas répondu. Elle
-- voit une carte « N photos de Léa — on les publie ? », elle répond Oui et
-- l'album s'ouvre dans la seconde, ou Non et plus aucune photo de Léa ne
-- paraît NULLE PART (déjà le cas depuis db/245 : un refus retire la photo à
-- TOUT LE MONDE, pas seulement à la famille qui refuse, sinon l'enfant
-- continuait de figurer sur les photos de groupe que les autres regardent).
--
-- ⚠ Ce que ça change pour les `null` : db/245 les laissait passer, pour que
-- l'album ne naisse pas vide. Ça reste vrai POUR LES AUTRES familles (un
-- enfant sans réponse figure encore sur la photo de groupe que les autres
-- voient), mais plus pour la sienne : sans réponse, sa famille ne voit rien.
-- C'est ce qui rend la question impossible à ignorer — donc ce qui remplit la
-- colonne. On pourra resserrer en « aucune photo sans un oui de chacun » le
-- jour où les réponses sont rentrées ; aujourd'hui ça viderait tous les albums.
--
-- ⚠ Qui répond : le compte de la famille, c'est-à-dire l'adresse portée par la
-- fiche — chez ces familles, celle d'un parent (c'est à ces adresses que la
-- newsletter est partie). On enregistre QUI a répondu et QUAND, pour que le
-- secrétariat puisse juger une réponse sur pièce.

-- ---- La trace de la réponse ------------------------------------------------
alter table public.people add column if not exists photo_consent_at     timestamptz;
alter table public.people add column if not exists photo_consent_by     uuid;
alter table public.people add column if not exists photo_consent_source text;
comment on column public.people.photo_consent_at is 'Quand le droit à l''image a été renseigné.';
comment on column public.people.photo_consent_by is 'Compte auth qui a répondu (famille via l''app, ou membre du staff).';
comment on column public.people.photo_consent_source is '''famille'' = répondu dans Mon espace · ''console'' = saisi par le secrétariat.';

-- ---- Ce que Mon espace doit demander ---------------------------------------
-- Les enfants de la famille qui ONT des photos et dont le droit à l'image
-- n'est pas accordé. `etat` = 'inconnu' (jamais demandé) ou 'refuse'.
-- Un enfant sans photo n'est PAS listé : on ne pose pas la question à vide,
-- elle arriverait sans raison et serait balayée.
create or replace function public.portal_photo_asks()
returns table (person_id uuid, prenom text, nb int, derniere date, etat text)
language sql stable security definer set search_path to 'public'
as $$
  select pe.id, pe.first_name, count(*)::int, max(ph.taken_on),
         case when pe.photo_consent is false then 'refuse' else 'inconnu' end
  from people pe
  join person_photo_people l on l.person_id = pe.id
  join person_photos ph on ph.id = l.photo_id
  where pe.id in (select my_family_ids())
    and pe.photo_consent is not true
  group by pe.id, pe.first_name, pe.photo_consent
  order by pe.first_name;
$$;

-- La famille répond. SECURITY DEFINER parce qu'un parent n'écrit pas dans
-- `people` (RLS : staff + sa propre fiche) — d'où la garde explicite.
create or replace function public.portal_set_photo_consent(p_person_id uuid, p_ok boolean)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_person_id is null or p_ok is null then
    raise exception 'Réponse incomplète.';
  end if;
  if p_person_id not in (select my_family_ids()) then
    raise exception 'Cette fiche n''est pas celle de votre famille.';
  end if;
  update people
     set photo_consent = p_ok,
         photo_consent_at = now(),
         photo_consent_by = auth.uid(),
         photo_consent_source = 'famille'
   where id = p_person_id;
end;
$$;
revoke all on function public.portal_set_photo_consent(uuid, boolean) from public, anon;
grant execute on function public.portal_set_photo_consent(uuid, boolean) to authenticated;

-- ---- L'album ne s'ouvre qu'après la réponse --------------------------------
-- Trois gardes, et il faut les trois :
--   A. un refus de N'IMPORTE QUEL enfant du cliché → photo cachée à tous ;
--   B. un enfant de MA famille sans réponse → photo cachée à MA famille ;
--   C. il faut qu'un enfant de ma famille y soit, évidemment.
--
-- ⚠⚠ POURQUOI TROIS FONCTIONS ET PAS TROIS `exists` ÉCRITS SUR PLACE — le
-- piège coûte cher et il n'est pas celui qu'on croit. Une policy s'exécute
-- AVEC LES DROITS DU LECTEUR : les `exists` qu'elle contient relisent
-- `person_photo_people`, donc à travers `ppp_famille`, qui ne montre à une
-- famille QUE les lignes de SES enfants. Vu du siège de la famille Démo, une
-- photo de groupe n'a donc qu'un seul enfant dessus — le sien. La garde « est-
-- ce que QUELQU'UN a refusé ? » ne voyait pas le refus de l'autre enfant, et
-- la photo restait lisible, ligne ET fichier. Une policy ne peut pas être
-- restrictive sur des lignes que la RLS lui cache : la garde doit passer par
-- du SECURITY DEFINER, qui voit tous les enfants du cliché.
-- (`portal_photos`, elle, était juste depuis le début : elle EST définer.)
create or replace function public.photo_de_ma_famille(p_photo uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from person_photo_people l
                  where l.photo_id = p_photo and l.person_id in (select my_family_ids()));
$$;

create or replace function public.photo_un_refus(p_photo uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from person_photo_people l join people pe on pe.id = l.person_id
                  where l.photo_id = p_photo and pe.photo_consent is false);
$$;

create or replace function public.photo_attente_famille(p_photo uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from person_photo_people l join people pe on pe.id = l.person_id
                  where l.photo_id = p_photo
                    and l.person_id in (select my_family_ids())
                    and pe.photo_consent is not true);
$$;

drop policy if exists pp_famille on public.person_photos;
create policy pp_famille on public.person_photos
  for select to authenticated
  using (photo_de_ma_famille(id) and not photo_un_refus(id) and not photo_attente_famille(id));

-- ⚠ La policy de stockage suit la MÊME garde : restreindre la table seule
-- laisserait les fichiers téléchargeables par chemin (leçon des buckets
-- `physique` et `mental`) — et le chemin, la table le donne.
drop policy if exists photos_jeunes_famille on storage.objects;
create policy photos_jeunes_famille on storage.objects
  for select to authenticated
  using (bucket_id = 'photos-jeunes' and exists (
    select 1 from person_photos ph
     where ph.storage_path = storage.objects.name
       and photo_de_ma_famille(ph.id)
       and not photo_un_refus(ph.id)
       and not photo_attente_famille(ph.id)));

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
    and not exists (select 1 from person_photo_people l4
                      join people pe4 on pe4.id = l4.person_id
                     where l4.photo_id = ph.id
                       and l4.person_id in (select my_family_ids())
                       and pe4.photo_consent is not true)
  order by ph.taken_on desc, ph.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;
