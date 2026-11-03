-- 221_bareme_tests_physiques.sql
-- Tests physiques : le barème, pour que « Préhension droite : 37,7 kg » veuille dire
-- quelque chose au jeune qui l'ouvre dans Mon espace (03.11.2026).
--
-- Jusqu'ici le portail affichait un nombre nu, et l'écart avec le passage précédent quand il
-- y en avait un. Au premier test — le cas de tout le monde aujourd'hui, une seule session
-- passée — il ne restait que le nombre. Six paliers, repris du tableau du préparateur
-- physique : excellent, très bon, bon, moyen, passable, faible.
--
-- MODÈLE : on stocke les CINQ SEUILS qui découpent les six paliers, et non six intervalles.
-- Six intervalles saisis à la main laissent fatalement des trous (« 42,5 n'est dans aucune
-- case ») ou des recouvrements. Cinq seuils ordonnés ne le peuvent pas.
--
-- Le barème peut dépendre du SEXE et de l'ÂGE, ou pas : les trois colonnes sont nullables,
-- `null` voulant dire « vaut pour tout le monde ». La fonction prend toujours la ligne la
-- plus précise qui corresponde. Un barème unique par mesure se saisit donc en une ligne.

create table if not exists public.phys_norms (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.phys_test_questions(id) on delete cascade,
  sex text check (sex in ('M', 'F')),       -- null = filles et garçons
  age_min int, age_max int,                 -- bornes incluses ; null = tous les âges
  -- Les cinq seuils, du meilleur au moins bon. Lus selon le sens de la mesure
  -- (`phys_test_questions.better`) : 'up' → « au moins », 'down' → « au plus ».
  -- Un seuil laissé vide fait sauter son palier : le barème peut n'en compter que trois.
  s_excellent numeric,
  s_tres_bon  numeric,
  s_bon       numeric,
  s_moyen     numeric,
  s_passable  numeric,
  source text,                              -- d'où vient ce barème, pour qu'on sache le discuter
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une seule ligne par (mesure, sexe, tranche d'âge) : sinon la fonction choisirait au hasard
-- entre deux barèmes également précis.
create unique index if not exists phys_norms_unique on public.phys_norms
  (question_id, coalesce(sex, '*'), coalesce(age_min, -1), coalesce(age_max, -1));

-- Lecture ouverte à tout compte connecté : un barème n'est pas une donnée personnelle, et
-- Mon espace doit pouvoir montrer au jeune l'échelle sur laquelle il se situe.
-- Écriture : l'encadrement physique (coach, coach physique, head coach, admin).
alter table public.phys_norms enable row level security;
drop policy if exists pn_read on public.phys_norms;
create policy pn_read on public.phys_norms for select using (auth.uid() is not null);
drop policy if exists pn_write on public.phys_norms;
create policy pn_write on public.phys_norms for all
  using (is_phys_staff(auth.uid())) with check (is_phys_staff(auth.uid()));
grant select on public.phys_norms to authenticated;
grant insert, update, delete on public.phys_norms to authenticated;

-- --- Dans quel palier tombe une valeur ? ----------------------------------
create or replace function public.phys_band(p_question uuid, p_value numeric, p_sex text, p_age int)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  n public.phys_norms%rowtype;
  v_better text;
begin
  if p_value is null or p_question is null then return null; end if;
  select coalesce(better, 'up') into v_better from phys_test_questions where id = p_question;
  -- 'neutral' = une mesure de référence qu'on ne juge pas (la distance entre les épaules).
  -- Lui coller une couleur serait dire au jeune que ses épaules sont « passables ».
  if v_better is null or v_better = 'neutral' then return null; end if;

  select * into n from phys_norms b
   where b.question_id = p_question
     and (b.sex is null or b.sex = p_sex)
     and (b.age_min is null or (p_age is not null and p_age >= b.age_min))
     and (b.age_max is null or (p_age is not null and p_age <= b.age_max))
   order by (b.sex is not null) desc,
            (b.age_min is not null or b.age_max is not null) desc
   limit 1;
  if n.id is null then return null; end if;   -- pas de barème : pas de couleur, pas de jugement

  if v_better = 'down' then
    if n.s_excellent is not null and p_value <= n.s_excellent then return 'excellent'; end if;
    if n.s_tres_bon  is not null and p_value <= n.s_tres_bon  then return 'tres_bon';  end if;
    if n.s_bon       is not null and p_value <= n.s_bon       then return 'bon';       end if;
    if n.s_moyen     is not null and p_value <= n.s_moyen     then return 'moyen';     end if;
    if n.s_passable  is not null and p_value <= n.s_passable  then return 'passable';  end if;
  else
    if n.s_excellent is not null and p_value >= n.s_excellent then return 'excellent'; end if;
    if n.s_tres_bon  is not null and p_value >= n.s_tres_bon  then return 'tres_bon';  end if;
    if n.s_bon       is not null and p_value >= n.s_bon       then return 'bon';       end if;
    if n.s_moyen     is not null and p_value >= n.s_moyen     then return 'moyen';     end if;
    if n.s_passable  is not null and p_value >= n.s_passable  then return 'passable';  end if;
  end if;
  return 'faible';
end $$;
revoke all on function public.phys_band(uuid, numeric, text, int) from public;
grant execute on function public.phys_band(uuid, numeric, text, int) to authenticated;

-- --- Le portail renvoie le palier ET l'échelle -----------------------------
-- L'échelle part avec : « excellent ≥ 48 kg » en dit plus long qu'une pastille verte, et
-- donne au jeune le prochain palier à viser. L'âge est celui qu'il avait LE JOUR DU TEST —
-- sinon un résultat de septembre serait relu avec le barème de ses 15 ans en juin suivant.
-- `drop` d'abord : deux colonnes de plus en sortie, et Postgres refuse de remplacer une
-- fonction qui change de type de retour.
drop function if exists public.portal_phys_tests(uuid);
create or replace function public.portal_phys_tests(p_youth uuid)
returns table (
  result_id uuid, test_id uuid, test_name text, session_date date,
  comment text, coach_name text,
  question_id uuid, label text, description text, icon text, unit text, better text,
  sort_order int, value_num numeric, value_text text,
  band text, norm jsonb
)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_sex text;
  v_birth date;
begin
  if not can_phys_of(p_youth) then raise exception 'Accès refusé'; end if;
  select p.gender, p.birthdate into v_sex, v_birth from people p where p.id = p_youth;
  return query
    with reponses as (
      select r.id as result_id, r.test_id, r.test_name, r.session_date, r.comment, r.coach_name,
             a.question_id, a.label, q.description, q.icon, q.unit,
             coalesce(q.better, 'up') as better,
             a.sort_order, a.value_num, a.value_text,
             case when v_birth is null then null
                  else extract(year from age(r.session_date, v_birth))::int end as age_test
        from phys_results r
        join phys_answers a on a.result_id = r.id
        left join phys_test_questions q on q.id = a.question_id
       where r.person_id = p_youth
    )
    select e.result_id, e.test_id, e.test_name, e.session_date, e.comment, e.coach_name,
           e.question_id, e.label, e.description, e.icon, e.unit, e.better,
           e.sort_order, e.value_num, e.value_text,
           phys_band(e.question_id, e.value_num, v_sex, e.age_test),
           (select to_jsonb(x) from (
              select b.s_excellent, b.s_tres_bon, b.s_bon, b.s_moyen, b.s_passable
                from phys_norms b
               where b.question_id = e.question_id
                 and (b.sex is null or b.sex = v_sex)
                 and (b.age_min is null or (e.age_test is not null and e.age_test >= b.age_min))
                 and (b.age_max is null or (e.age_test is not null and e.age_test <= b.age_max))
               order by (b.sex is not null) desc,
                        (b.age_min is not null or b.age_max is not null) desc
               limit 1) x)
      from reponses e
     order by e.session_date desc, e.sort_order;
end $$;
revoke all on function public.portal_phys_tests(uuid) from public;
grant execute on function public.portal_phys_tests(uuid) to authenticated;
