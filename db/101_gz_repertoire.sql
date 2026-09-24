-- Joueurs GameZone dans le répertoire (24.09.2026).
-- Chaque joueur des tournois (gz_participants) est relié à UNE fiche du répertoire (people) :
--   1. même n° de licence (chiffres seuls)                         → même personne
--   2. fiche SANS licence, même nom (sans accents ni tirets) ET même date de naissance (décodée de la licence)
--                                                                   → même personne, la licence est ajoutée à la fiche
--   3. tout autre cas ressemblant (même nom+prénom, ou même nom + même naissance) → JAMAIS fusionné tout seul :
--      liste « à vérifier » (gz_link_review), décision à la main dans la console
--   4. sinon                                                        → nouvelle fiche (naissance + sexe tirés de la licence)
-- Toute fiche reliée reçoit le tag « gamezone » (person_roles, sans aucun accès à l'app).
-- Une fiche « GameZone seulement » (ce tag, aucun autre rôle ni filière) est exclue des anniversaires du Dashboard
-- et de la newsletter « tout le répertoire » (le ciblage GameZone de la newsletter existe déjà à part).
-- Le lien se fait aussi à chaque nouvel import, dès la PREMIÈRE inscription du joueur à un tournoi (déclencheur sur
-- gz_entries) : un joueur sans aucune inscription (retirée, tournoi supprimé) ne reçoit pas de fiche vide.
-- Rattrapage du 24.09.2026 : 33 par licence, 3 par nom + naissance, 551 nouvelles fiches, 1 à vérifier
-- (van Ruymbeke Vincent : même naissance, préfixe de licence différent).

alter table public.gz_participants add column if not exists person_id uuid references public.people(id) on delete set null;
create index if not exists gz_participants_person_idx on public.gz_participants(person_id);

-- ---------- Outils ----------
create or replace function public.name_key(t text) returns text language sql immutable as $$
  select regexp_replace(translate(lower(coalesce(t, '')), 'àáâäãåçèéêëìíîïñòóôöõøùúûüýÿ', 'aaaaaaceeeeiiiinoooooouuuuyy'), '[^a-z]', '', 'g');
$$;
create or replace function public.lic_digits(t text) returns text language sql immutable as $$
  select regexp_replace(coalesce(t, ''), '\D', '', 'g');
$$;
-- Licence Swiss Tennis « NNN.AA.JMM.N » : même règle que licDecode() de la console.
create or replace function public.lic_birthdate(t text) returns date language plpgsql immutable as $$
declare yy int; d1 int; dc int; mo int; dd int; y int;
begin
  if coalesce(t, '') !~ '^\s*\d+\.\d{2}\.\d{3}\.\d+\s*$' then return null; end if;
  yy := split_part(btrim(t), '.', 2)::int;
  d1 := left(split_part(btrim(t), '.', 3), 1)::int;
  dc := substr(split_part(btrim(t), '.', 3), 2, 2)::int;
  if d1 < 1 or d1 > 8 or dc < 1 or dc > 93 then return null; end if;
  mo := ((d1 - 1) % 4) * 3 + 1 + (dc - 1) / 31;
  dd := dc - ((dc - 1) / 31) * 31;
  y := 2000 + yy; if y > extract(year from current_date)::int then y := y - 100; end if;
  return make_date(y, mo, dd);
exception when others then return null;
end $$;
create or replace function public.lic_sex(t text) returns text language sql immutable as $$
  select case when coalesce(t, '') ~ '^\s*\d+\.\d{2}\.\d{3}\.\d+\s*$'
              then case when left(split_part(btrim(t), '.', 3), 1)::int between 1 and 4 then 'M'
                        when left(split_part(btrim(t), '.', 3), 1)::int between 5 and 8 then 'F' end end;
$$;

-- ---------- Liste « à vérifier » ----------
create table if not exists public.gz_link_review (
  participant_id uuid primary key references public.gz_participants(id) on delete cascade,
  candidate_ids uuid[] not null default '{}',
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.gz_link_review enable row level security;
drop policy if exists gz_link_review_staff on public.gz_link_review;
create policy gz_link_review_staff on public.gz_link_review for all using (is_staff(auth.uid())) with check (is_staff(auth.uid()));
grant select, insert, update, delete on public.gz_link_review to authenticated;

-- Relie les fiches reliées : tag gamezone + retrait de la liste à vérifier.
create or replace function public.gz_attach(p_gid uuid, p_person uuid) returns void
language sql security definer set search_path = public as $$
  update gz_participants set person_id = p_person where id = p_gid;
  insert into person_roles(person_id, role) values (p_person, 'gamezone') on conflict do nothing;
  delete from gz_link_review where participant_id = p_gid;
$$;
revoke all on function public.gz_attach(uuid, uuid) from public, anon, authenticated;

-- ---------- Rapprochement d'un joueur ----------
create or replace function public.gz_link_one(p_gid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare g record; lic text; born date; cand uuid[]; pid uuid; how text;
begin
  select * into g from gz_participants where id = p_gid;
  if not found then return 'introuvable'; end if;
  if g.person_id is not null then
    perform gz_attach(p_gid, g.person_id);
    return 'deja';
  end if;
  lic := lic_digits(g.license_no);
  born := lic_birthdate(g.license_no);

  -- 1. Même licence
  if lic <> '' then
    select array_agg(id) into cand from people where lic_digits(license_no) = lic;
    if coalesce(array_length(cand, 1), 0) = 1 then pid := cand[1]; how := 'licence';
    elsif coalesce(array_length(cand, 1), 0) > 1 then
      insert into gz_link_review(participant_id, candidate_ids, reason) values (p_gid, cand, 'Plusieurs fiches portent cette licence')
        on conflict (participant_id) do update set candidate_ids = excluded.candidate_ids, reason = excluded.reason;
      return 'a_verifier';
    end if;
  end if;

  -- 2. Fiche sans licence : même nom + même date de naissance
  if pid is null and born is not null then
    select array_agg(id) into cand from people
     where name_key(last_name) = name_key(g.last_name) and birthdate = born and lic_digits(license_no) = '';
    if coalesce(array_length(cand, 1), 0) = 1 then
      pid := cand[1]; how := 'nom+naissance';
      update people set license_no = btrim(g.license_no) where id = pid and lic_digits(license_no) = '';
    elsif coalesce(array_length(cand, 1), 0) > 1 then
      insert into gz_link_review(participant_id, candidate_ids, reason) values (p_gid, cand, 'Plusieurs fiches même nom et même naissance')
        on conflict (participant_id) do update set candidate_ids = excluded.candidate_ids, reason = excluded.reason;
      return 'a_verifier';
    end if;
  end if;

  -- 3. Ressemblance sans certitude : on ne fusionne jamais tout seul
  if pid is null then
    select array_agg(id) into cand from people
     where name_key(last_name || first_name) = name_key(g.last_name || g.first_name)
        or (born is not null and name_key(last_name) = name_key(g.last_name) and birthdate = born);
    if coalesce(array_length(cand, 1), 0) > 0 then
      insert into gz_link_review(participant_id, candidate_ids, reason) values (p_gid, cand, 'Même nom, mais licence ou naissance différente / inconnue')
        on conflict (participant_id) do update set candidate_ids = excluded.candidate_ids, reason = excluded.reason;
      return 'a_verifier';
    end if;
  end if;

  -- 4. Nouvelle fiche
  if pid is null then
    insert into people(first_name, last_name, birthdate, gender, email, phone, city, license_no, is_active)
    values (btrim(g.first_name), btrim(g.last_name), coalesce(g.birthdate, born), lic_sex(g.license_no),
            nullif(btrim(coalesce(g.email, '')), ''), nullif(btrim(coalesce(g.phone, '')), ''), nullif(btrim(coalesce(g.city, '')), ''),
            nullif(btrim(coalesce(g.license_no, '')), ''), true)
    returning id into pid;
    how := 'nouvelle';
  end if;

  perform gz_attach(p_gid, pid);
  return how;
end $$;
revoke all on function public.gz_link_one(uuid) from public, anon, authenticated;

-- Tous les joueurs pas encore reliés (rattrapage + contrôle) : renvoie le décompte par règle.
create or replace function public.gz_link_all() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; res text; out jsonb := '{}'::jsonb;
begin
  if auth.uid() is not null and not is_staff(auth.uid()) then raise exception 'réservé au secrétariat'; end if;
  for r in select g.id from gz_participants g
            where g.person_id is null and exists (select 1 from gz_entries e where e.participant_id = g.id)
              and not exists (select 1 from gz_link_review v where v.participant_id = g.id)
            order by g.created_at loop
    res := gz_link_one(r.id);
    out := jsonb_set(out, array[res], to_jsonb(coalesce((out->>res)::int, 0) + 1));
  end loop;
  return out;
end $$;
revoke all on function public.gz_link_all() from public, anon;
grant execute on function public.gz_link_all() to authenticated;

-- Décision à la main sur un cas « à vérifier » : p_person = la fiche choisie, ou null = créer une nouvelle fiche.
create or replace function public.gz_link_resolve(p_gid uuid, p_person uuid) returns text
language plpgsql security definer set search_path = public as $$
declare g record; pid uuid;
begin
  if not is_staff(auth.uid()) then raise exception 'réservé au secrétariat'; end if;
  select * into g from gz_participants where id = p_gid;
  if not found then return 'introuvable'; end if;
  if p_person is not null then
    update people set license_no = btrim(g.license_no) where id = p_person and lic_digits(license_no) = '' and lic_digits(g.license_no) <> '';
    perform gz_attach(p_gid, p_person);
    return 'relie';
  end if;
  insert into people(first_name, last_name, birthdate, gender, email, phone, city, license_no, is_active)
  values (btrim(g.first_name), btrim(g.last_name), coalesce(g.birthdate, lic_birthdate(g.license_no)), lic_sex(g.license_no),
          nullif(btrim(coalesce(g.email, '')), ''), nullif(btrim(coalesce(g.phone, '')), ''), nullif(btrim(coalesce(g.city, '')), ''),
          nullif(btrim(coalesce(g.license_no, '')), ''), true)
  returning id into pid;
  perform gz_attach(p_gid, pid);
  return 'nouvelle';
end $$;
revoke all on function public.gz_link_resolve(uuid, uuid) from public, anon;
grant execute on function public.gz_link_resolve(uuid, uuid) to authenticated;

-- Chaque joueur est relié à sa première inscription. Une erreur de rapprochement ne bloque JAMAIS l'import.
drop trigger if exists gz_participants_link on public.gz_participants;
drop function if exists public.gz_participants_link_trg();
create or replace function public.gz_entries_link_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from gz_participants where id = new.participant_id and person_id is null) then
    begin perform gz_link_one(new.participant_id); exception when others then null; end;
  end if;
  return null;
end $$;
drop trigger if exists gz_entries_link on public.gz_entries;
create trigger gz_entries_link after insert on public.gz_entries for each row execute function public.gz_entries_link_trg();

-- ---------- Fiche : historique GameZone d'une personne ----------
create or replace function public.person_gz_history(p_person uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_staff(auth.uid()) then coalesce((
    select jsonb_agg(x order by x->>'date' desc) from (
      select jsonb_build_object(
        'date', t.tournament_date, 'name', t.name, 'gamezone', t.is_gamezone,
        'season', (select s.label from seasons s where s.kind = 'juniors' and t.tournament_date between s.start_date and s.end_date),
        'epreuves', string_agg(distinct nullif(e.epreuve, ''), ', '),
        'absent', bool_or(coalesce(ps.absent, false)),
        'winner', bool_or(coalesce(ps.is_winner, false)),
        'club', max(gp.club), 'ranking', max(gp.ranking)) as x
      from gz_participants gp
      join gz_entries e on e.participant_id = gp.id
      join gz_tournaments t on t.id = e.tournament_id
      left join gz_player_status ps on ps.tournament_id = t.id and ps.participant_id = gp.id
      where gp.person_id = p_person
      group by t.id, t.tournament_date, t.name, t.is_gamezone
    ) q), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.person_gz_history(uuid) from public, anon;
grant execute on function public.person_gz_history(uuid) to authenticated;

-- Liste « à vérifier » lisible par la console (noms des candidats inclus).
create or replace function public.gz_link_review_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_staff(auth.uid()) then coalesce((
    select jsonb_agg(jsonb_build_object(
      'participant_id', r.participant_id, 'reason', r.reason,
      'player', jsonb_build_object('last_name', g.last_name, 'first_name', g.first_name, 'license_no', g.license_no,
                                   'born', lic_birthdate(g.license_no), 'club', g.club),
      'candidates', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'last_name', p.last_name, 'first_name', p.first_name,
                                   'birthdate', p.birthdate, 'license_no', p.license_no)), '[]'::jsonb)
                     from people p where p.id = any(r.candidate_ids)))
      order by g.last_name)
    from gz_link_review r join gz_participants g on g.id = r.participant_id), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.gz_link_review_list() from public, anon;
grant execute on function public.gz_link_review_list() to authenticated;

-- ---------- Fiche « GameZone seulement » ----------
create or replace function public.people_gz_only(p_person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from person_roles where person_id = p_person and role = 'gamezone')
     and not exists (select 1 from person_roles where person_id = p_person and role <> 'gamezone')
     and not exists (select 1 from role_periods where person_id = p_person);
$$;
grant execute on function public.people_gz_only(uuid) to authenticated;

-- Anniversaires du Dashboard et newsletter « tout le répertoire » : sans les fiches GameZone seulement.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.dash_general'::regproc);
  if position('and not people_gz_only(pe.id)' in d) = 0 then
    n := replace(d, 'from people pe where pe.birthdate is not null and coalesce(pe.is_active,true))',
                    'from people pe where pe.birthdate is not null and coalesce(pe.is_active,true) and not people_gz_only(pe.id))');
    if n = d then raise exception 'dash_general : motif des anniversaires introuvable'; end if;
    execute n;
  end if;
  d := pg_get_functiondef('public.newsletter_audience(jsonb)'::regprocedure);
  if position('people_gz_only' in d) = 0 then
    n := replace(d, '      and ( coalesce((p_aud->>''all_people'')::boolean, false)',
                    '      and ( (coalesce((p_aud->>''all_people'')::boolean, false) and not people_gz_only(p.id))');
    if n = d then raise exception 'newsletter_audience : motif « tout le répertoire » introuvable'; end if;
    execute n;
  end if;
end $$;
