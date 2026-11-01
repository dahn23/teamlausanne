-- Tests physiques : une batterie de mesures, passée ~4× par saison (01.11.2026)
--
-- Les tables existaient (modèle « test → questions → réponses ») mais une question ne portait
-- qu'un libellé. Un jeune qui lit « Lancer mur : 6,66 » ne sait ni ce qu'il a fait, ni si c'est
-- bien, ni s'il progresse. On ajoute donc à chaque mesure son protocole écrit, sa vignette,
-- son unité et le sens du progrès ; et à chaque passage sa date réelle et le mot du coach.

-- 1) La mesure --------------------------------------------------------------
alter table phys_test_questions
  add column if not exists description text,                 -- le protocole, mot pour mot
  add column if not exists icon        text,                 -- assets/phys/tests/<icon>.svg
  add column if not exists unit        text,                 -- m, cm, kg…
  add column if not exists better      text not null default 'up';
-- 'up' : plus c'est grand, mieux c'est · 'down' : l'inverse (distance entre les mains)
-- 'neutral' : une mesure de référence qu'on ne juge pas (distance entre les épaules).
alter table phys_test_questions drop constraint if exists phys_test_questions_better_chk;
alter table phys_test_questions add constraint phys_test_questions_better_chk
  check (better in ('up', 'down', 'neutral'));

-- 2) Le passage -------------------------------------------------------------
-- session_date = le jour du test, qui n'est pas celui de la saisie : les résultats arrivent
-- souvent plusieurs jours après, et c'est la date du test qui ordonne la progression.
alter table phys_results
  add column if not exists session_date date,
  add column if not exists comment      text;
update phys_results set session_date = filled_at::date where session_date is null;
alter table phys_results alter column session_date set default current_date;

-- Un jeune ne passe une batterie qu'une fois par date. Sans cet index, une double saisie
-- ferait deux colonnes de progression au lieu d'une correction.
create unique index if not exists phys_results_une_par_date
  on phys_results (person_id, test_id, session_date);

-- 3) Lecture par la famille -------------------------------------------------
-- phys_results et phys_answers restent fermés au staff (pr_staff / pa_staff) : le portail
-- passe par cette fonction, qui ne sert que les résultats du jeune demandé et vérifie d'abord
-- que celui qui demande est ce jeune, sa famille, ou le staff physique (can_phys_of).
create or replace function portal_phys_tests(p_youth uuid)
returns table (
  result_id uuid, test_id uuid, test_name text, session_date date,
  comment text, coach_name text,
  question_id uuid, label text, description text, icon text, unit text, better text,
  sort_order int, value_num numeric, value_text text
)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not can_phys_of(p_youth) then raise exception 'Accès refusé'; end if;
  return query
    select r.id, r.test_id, r.test_name, r.session_date, r.comment, r.coach_name,
           a.question_id, a.label, q.description, q.icon, q.unit, coalesce(q.better, 'up'),
           a.sort_order, a.value_num, a.value_text
    from phys_results r
    join phys_answers a on a.result_id = r.id
    left join phys_test_questions q on q.id = a.question_id
    where r.person_id = p_youth
    order by r.session_date desc, a.sort_order;
end $$;
revoke all on function portal_phys_tests(uuid) from public;
grant execute on function portal_phys_tests(uuid) to authenticated;
