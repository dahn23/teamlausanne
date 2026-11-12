-- 237 — Les fils privés « Prépa physique » et « Mental » : un coach NOMMÉ, plus un rôle
-- (Raphael, 12.11.2026)
--
-- POURQUOI. Les deux fils étaient ouverts par rôle, et le rôle ne distingue pas les
-- personnes : `coach_physique` c'est Andreas Egger ET Rémi Moha, `coach_mental` c'est
-- Frédérique Rol ET Séline Rivaroli. Le fil physique était même lisible par TOUT coach
-- (is_phys_staff inclut 'coach'). Or ce que des jeunes de 14 à 18 ans écrivent à leur
-- préparateur physique ou à leur coach mentale n'a pas à passer sous les yeux de
-- l'encadrement entier : ce sont des mineurs, et c'est leur corps et leur tête.
--
-- CE QUI CHANGE. Chaque fil a désormais un coach désigné, par son compte, dans la table
-- `thread_coaches` : physique → Andreas, mental → Frédérique. S'y ajoutent, par rôle,
-- head_coach, admin et superadmin (direction). Personne d'autre côté staff. La famille
-- (le jeune et ses parents) garde évidemment son propre fil — can_read_public_of.
--
-- Changer de préparateur physique un jour = une ligne dans thread_coaches, pas une
-- fonction à réécrire. C'est pour ça que c'est une table et pas une liste en dur.
--
-- ⚠️ phys_media SUIT LE FIL, et ce n'est pas un excès de zèle : le déclencheur
-- `phys_thread_vers_videos_trg` recopie toute pièce jointe du staff dans phys_media,
-- avec le texte du message en commentaire. Restreindre le fil sans restreindre
-- phys_media aurait laissé le contenu lisible par la porte d'à côté. Idem pour
-- mental_proud, qui appartient au canal mental.
-- En revanche les ROUTINES et les SÉANCES (phys_routines, mental_routines,
-- mental_sessions, mental_comments) ne bougent pas : c'est du contenu préparé pour le
-- jeune, pas sa parole, et Séline en rédige.

-- 1 ---------------------------------------------------------------- qui voit quoi
create table if not exists thread_coaches (
  canal    text not null check (canal in ('physique', 'mental')),
  user_id  uuid not null references auth.users(id) on delete cascade,
  added_by uuid default auth.uid(),
  added_at timestamptz not null default now(),
  primary key (canal, user_id)
);
comment on table thread_coaches is
  'Coach désigné de chaque fil privé. S''ajoutent par rôle : head_coach, admin, superadmin.';

alter table thread_coaches enable row level security;
drop policy if exists tc_read on thread_coaches;
create policy tc_read  on thread_coaches for select using (is_staff(auth.uid()));
drop policy if exists tc_write on thread_coaches;
create policy tc_write on thread_coaches for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

insert into thread_coaches (canal, user_id) values
  ('physique', '7e50acc7-90b1-4358-880e-8d63b00a047c'),   -- Andreas Egger
  ('mental',   '38d0e446-f26f-4816-ac7a-2480eb518cd5')    -- Frédérique Rol
on conflict do nothing;

-- 2 ------------------------------------------------------------------- les gardes
create or replace function public.is_thread_coach(p_canal text, uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from thread_coaches tc where tc.canal = p_canal and tc.user_id = uid)
      or exists (select 1 from user_roles r where r.user_id = uid
                   and r.role::text in ('head_coach', 'admin', 'superadmin'));
$$;

create or replace function public.can_phys_thread_of(p_youth uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select is_thread_coach('physique', auth.uid()) or can_read_public_of(p_youth);
$$;

create or replace function public.can_mental_thread_of(p_youth uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select is_thread_coach('mental', auth.uid()) or can_read_public_of(p_youth);
$$;

-- 3 --------------------------------------------------------------------- lectures
drop policy if exists pth_read on phys_thread;
create policy pth_read on phys_thread for select using (can_phys_thread_of(youth_person_id));

drop policy if exists mth_read on mental_thread;
create policy mth_read on mental_thread for select using (can_mental_thread_of(youth_person_id));

drop policy if exists phys_media_lire on phys_media;
create policy phys_media_lire on phys_media for select using (can_phys_thread_of(youth_person_id));

drop policy if exists phys_media_ecrire on phys_media;
create policy phys_media_ecrire on phys_media for all
  using (is_thread_coach('physique', auth.uid()))
  with check (is_thread_coach('physique', auth.uid()));

drop policy if exists mpr_read on mental_proud;
create policy mpr_read on mental_proud for select using (can_mental_thread_of(youth_person_id));

-- 4 ------------------------------------------------- écriture, lecture, suppression
-- Corps inchangés par ailleurs : la garde d'élite, le nom d'auteur, la limite de
-- 8000 caractères et le refus du message vide restent tels quels.
create or replace function public.phys_thread_post(p_youth uuid, p_body text, p_link text, p_file_path text, p_file_name text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_staff boolean; v_name text; v_id uuid;
begin
  if not can_phys_thread_of(p_youth) then raise exception 'Accès refusé'; end if;
  if not is_elite_youth(p_youth) then raise exception 'La prépa physique en message est réservée aux filières pro, pro U18 et sport-études.'; end if;
  if coalesce(btrim(p_body), '') = '' and coalesce(btrim(p_link), '') = '' and coalesce(p_file_path, '') = '' then
    raise exception 'Message vide';
  end if;
  v_staff := is_thread_coach('physique', auth.uid());
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

create or replace function public.phys_thread_list(p_youth uuid)
returns setof phys_thread language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not can_phys_thread_of(p_youth) then raise exception 'Accès refusé'; end if;
  if not is_elite_youth(p_youth) then return; end if;
  return query select * from public.phys_thread where youth_person_id = p_youth order by created_at;
end $$;

create or replace function public.phys_thread_delete(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  delete from public.phys_thread where id = p_id
    and (created_by = auth.uid() or is_thread_coach('physique', auth.uid()));
end $$;

create or replace function public.mental_thread_post(p_youth uuid, p_body text, p_link text, p_file_path text, p_file_name text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_staff boolean; v_name text; v_id uuid;
begin
  if not can_mental_thread_of(p_youth) then raise exception 'Accès refusé'; end if;
  v_staff := is_thread_coach('mental', auth.uid());
  if v_staff then
    select trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) into v_name
      from people pe join profiles pr on pr.person_id = pe.id where pr.user_id = auth.uid() limit 1;
  else
    select trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) into v_name from people where id = p_youth;
  end if;
  insert into public.mental_thread(youth_person_id, author_is_staff, author_person_id, author_name, body, link_url, file_path, file_name, created_by)
  values (p_youth, v_staff, null, coalesce(nullif(v_name,''),'—'), nullif(p_body,''), nullif(p_link,''), nullif(p_file_path,''), nullif(p_file_name,''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.mental_thread_list(p_youth uuid)
returns setof mental_thread language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not can_mental_thread_of(p_youth) then raise exception 'Accès refusé'; end if;
  return query select * from public.mental_thread where youth_person_id = p_youth order by created_at;
end $$;

create or replace function public.mental_thread_delete(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  delete from public.mental_thread where id = p_id
    and (created_by = auth.uid() or is_thread_coach('mental', auth.uid()));
end $$;

-- 4 bis ------------------------------------------------- LES FICHIERS, pas que les lignes
-- Restreindre les tables ne suffisait pas : les deux buckets privés (« physique » et
-- « mental ») ont leur propre policy de stockage, et elles pointaient sur les anciens
-- helpers. Autrement dit, les lignes disparaissaient de la console mais les vidéos, les
-- photos et les documents restaient téléchargeables par n'importe quel coach avec le
-- chemin du fichier. On repointe les deux sur les mêmes gardes que les fils.
drop policy if exists physique_files_all on storage.objects;
create policy physique_files_all on storage.objects for all
  using      (bucket_id = 'physique' and can_phys_thread_of((nullif((storage.foldername(name))[1], ''))::uuid))
  with check (bucket_id = 'physique' and can_phys_thread_of((nullif((storage.foldername(name))[1], ''))::uuid));

drop policy if exists mental_files_all on storage.objects;
create policy mental_files_all on storage.objects for all
  using      (bucket_id = 'mental' and can_mental_thread_of((nullif((storage.foldername(name))[1], ''))::uuid))
  with check (bucket_id = 'mental' and can_mental_thread_of((nullif((storage.foldername(name))[1], ''))::uuid));

-- 5 ------------------------------------------------------------------ les notifications
-- Le jeune écrit : on prévient le coach désigné du canal et le head coach. La direction
-- (admin, superadmin) PEUT lire, mais n'est pas notifiée de chaque message d'un jeune —
-- ce serait du bruit, et ces fils ne sont pas les siens au quotidien.
create or replace function public.push_thread_trg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  phys boolean := tg_table_name = 'phys_thread';
  v_canal text := case when phys then 'physique' else 'mental' end;   -- v_ : sinon « canal » est ambigu avec la colonne
  quoi text := coalesce(nullif(trim(new.body), ''), case when new.file_name is not null then '📎 ' || new.file_name end, '…');
  jeune text;
begin
  if new.author_is_staff then
    perform push_enqueue(
      array(select x from push_users_for_person(new.youth_person_id) x where x is distinct from new.created_by),
      case when phys then 'Prépa physique' else 'Mental' end || ' — nouveau message',
      coalesce(nullif(trim(new.author_name), ''), 'Ton coach') || ' : ' || quoi,
      '/espace.html?vue=' || case when phys then 'physique' else 'comp' end, tg_table_name);
  else
    select first_name || ' ' || last_name into jeune from people where id = new.youth_person_id;
    perform push_enqueue(
      array(
        select tc.user_id from thread_coaches tc where tc.canal = v_canal
        union
        select ur.user_id from user_roles ur where ur.role::text = 'head_coach'
      ),
      case when phys then 'Prépa physique' else 'Mental' end || ' — ' || coalesce(jeune, 'un jeune'),
      quoi, '/console', tg_table_name);
  end if;
  return new;
end $$;
