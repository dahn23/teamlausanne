-- 28.09.2026 (demande Dan) — fiche du joueur › GameZone et Photos / vidéos.
--  1) Résultat d'un tournoi : « inscrit » tant qu'il n'est pas joué ; « joué » s'il a été retenu (confirmed) et n'a pas
--     gagné ; « vainqueur » s'il a gagné. L'historique renvoie donc aussi « joué » (tournoi passé ou clôturé, heure
--     suisse) et « retenu » (gz_entries.confirmed).
--  2) Photo du vainqueur : ajoutée d'office dans les Photos / vidéos de sa fiche (person_media), rattachée au tournoi
--     (une seule par tournoi : « Refaire » la remplace, la retirer l'enlève). storage_path reste vide : supprimer la
--     photo depuis la fiche ne supprime pas la photo du tournoi (utilisée ailleurs, site public, mails).

create or replace function public.person_gz_history(p_person uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when is_staff(auth.uid()) then coalesce((
    select jsonb_agg(x order by x->>'date' desc) from (
      select jsonb_build_object(
        'date', t.tournament_date, 'name', t.name, 'gamezone', t.is_gamezone,
        'season', (select s.label from seasons s where s.kind = 'juniors' and t.tournament_date between s.start_date and s.end_date),
        'epreuves', string_agg(distinct nullif(e.epreuve, ''), ', '),
        'absent', bool_or(coalesce(ps.absent, false)),
        'winner', bool_or(coalesce(ps.is_winner, false)),
        'confirmed', bool_or(coalesce(e.confirmed, false)),
        'played', (t.closed_at is not null or t.tournament_date < (now() at time zone 'Europe/Zurich')::date),
        'club', max(gp.club), 'ranking', max(gp.ranking)) as x
      from gz_participants gp
      join gz_entries e on e.participant_id = gp.id
      join gz_tournaments t on t.id = e.tournament_id
      left join gz_player_status ps on ps.tournament_id = t.id and ps.participant_id = gp.id
      where gp.person_id = p_person
      group by t.id, t.tournament_date, t.name, t.is_gamezone, t.closed_at
    ) q), '[]'::jsonb) else '[]'::jsonb end;
$$;

alter table public.person_media add column if not exists gz_tournament_id uuid references public.gz_tournaments(id) on delete set null;
create unique index if not exists person_media_gz_uniq on public.person_media(person_id, gz_tournament_id) where gz_tournament_id is not null;

create or replace function public.gz_winner_photo_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_person uuid; v_label text;
begin
  select person_id into v_person from gz_participants where id = new.participant_id;
  if v_person is null then return new; end if;
  if coalesce(new.is_winner, false) and new.photo_url is not null then
    select 'Vainqueur · ' || coalesce(name, 'Tournoi GameZone') || ' du ' || to_char(tournament_date, 'DD.MM.YYYY')
      into v_label from gz_tournaments where id = new.tournament_id;
    insert into person_media(person_id, url, storage_path, kind, comment, gz_tournament_id)
    values (v_person, new.photo_url, null, 'image', v_label, new.tournament_id)
    on conflict (person_id, gz_tournament_id) where gz_tournament_id is not null
      do update set url = excluded.url;
  else
    delete from person_media where person_id = v_person and gz_tournament_id = new.tournament_id;
  end if;
  return new;
exception when others then
  return new;   -- une photo de fiche ne doit jamais bloquer la saisie du tournoi
end $$;
drop trigger if exists gz_winner_photo_sync on public.gz_player_status;
create trigger gz_winner_photo_sync after insert or update of photo_url, is_winner on public.gz_player_status
  for each row execute function public.gz_winner_photo_sync();

-- Rattrapage : les vainqueurs déjà photographiés.
insert into person_media(person_id, url, storage_path, kind, comment, gz_tournament_id)
select gp.person_id, ps.photo_url, null, 'image',
       'Vainqueur · ' || coalesce(t.name, 'Tournoi GameZone') || ' du ' || to_char(t.tournament_date, 'DD.MM.YYYY'), t.id
from gz_player_status ps
join gz_participants gp on gp.id = ps.participant_id
join gz_tournaments t on t.id = ps.tournament_id
where ps.is_winner and ps.photo_url is not null and gp.person_id is not null
on conflict (person_id, gz_tournament_id) where gz_tournament_id is not null do nothing;
