-- 243 — Les présences des JEUNES en pro / sport-études, pour un senior coach
--        (16.11.2026, suite de db/242)
--
-- db/242 a ouvert `mark_attendance` au senior coach sur ses cours. Ça ne
-- suffisait pas, et voici pourquoi.
--
-- Sur un cours **détaillé** — pro ou sport-études avec plusieurs courts OU
-- plusieurs coachs — les présences des jeunes ne passent PAS par les pastilles
-- habituelles. Elles sont dérivées du « détail de la séance » : on saisit des
-- blocs (qui a joué avec qui, avec quel coach, combien de temps), et la console
-- en déduit les présences (`trSave` : présent = joue dans ≥ 1 bloc).
-- Les pastilles des jeunes sont volontairement inertes sur ces cours, pour tout
-- le monde, avec la mention « via détail ».
--
-- Or le détail écrit en DIRECT dans les tables — pas par une fonction. Il
-- tombait donc sur quatre policies réservées au head coach, que db/242 ne
-- touchait pas. Mark voyait l'onglet, et rien ne s'enregistrait.
--
-- Les 34 cours Pro Tennis / Sport-Études de Mark sont TOUS détaillés : sans
-- ce fichier, « marquer les présences des jeunes » restait impossible pour lui
-- sur l'intégralité de ses cours.
--
-- Même prédicat que db/242, `can_fix_attendance(uid, cours)` : head coach
-- partout, senior coach uniquement là où il est coché comme coach du cours.
-- Le nom parle d'appel, mais il répond en vérité à « qui tient cette séance ? »
-- — d'où le commentaire posé sur la fonction, pour le prochain lecteur.

comment on function public.can_fix_attendance(uuid, uuid) is
  'Qui tient cette séance : head coach / admin / superadmin partout, senior '
  'coach sur les cours où il est coché comme coach. Sert à l''appel (db/242) '
  'ET au détail de séance, qui EST l''appel des jeunes en pro / sport-études '
  '(db/243). Aucun filtre sur course_coaches.statut : un coach « non '
  'disponible » reste responsable de son cours.';

-- 1) Les présences écrites en direct par le détail de séance.
--    (mark_attendance est SECURITY DEFINER et ne passe pas par cette policy ;
--     celle-ci ne sert qu'aux écritures directes, dont trSave.)
drop policy if exists att_write on public.attendance;
create policy att_write on public.attendance for all
  using      (public.can_fix_attendance(auth.uid(), course_id))
  with check (public.can_fix_attendance(auth.uid(), course_id));

-- 2) Les blocs eux-mêmes.
--    is_admin était redondant : can_fix_attendance contient is_head, qui
--    contient déjà superadmin et admin.
drop policy if exists cs_head on public.course_segments;
create policy cs_write on public.course_segments for all
  using      (public.can_fix_attendance(auth.uid(), course_id))
  with check (public.can_fix_attendance(auth.uid(), course_id));

-- 3) et 4) Joueurs et sparrings d'un bloc : pas de course_id chez eux, on
--    remonte au bloc. Sans ces deux-là, les blocs s'enregistreraient vides —
--    le pire des cas, parce que ça ressemble à un succès.
drop policy if exists csp_head on public.course_segment_players;
create policy csp_write on public.course_segment_players for all
  using (exists (select 1 from public.course_segments s
                  where s.id = segment_id
                    and public.can_fix_attendance(auth.uid(), s.course_id)))
  with check (exists (select 1 from public.course_segments s
                  where s.id = segment_id
                    and public.can_fix_attendance(auth.uid(), s.course_id)));

drop policy if exists css_head on public.course_segment_sparrings;
create policy css_write on public.course_segment_sparrings for all
  using (exists (select 1 from public.course_segments s
                  where s.id = segment_id
                    and public.can_fix_attendance(auth.uid(), s.course_id)))
  with check (exists (select 1 from public.course_segments s
                  where s.id = segment_id
                    and public.can_fix_attendance(auth.uid(), s.course_id)));

-- Ce qui NE bouge pas, et c'est voulu : `courses_write` et `cp_write` restent
-- `is_head OR secrétariat`. Un senior coach ne crée pas, ne déplace pas et ne
-- supprime pas un cours, et ne change pas la liste des joueurs — Dan l'a
-- explicitement écarté le 16.11.2026. La console le reflète : elle lui ouvre
-- la séance en mode « Présences », sans le bloc d'édition ni Enregistrer.
--
-- Vérification (exécutée à l'application) :
--   un cours de Mark          -> true pour Mark, true pour Mariano
--   un cours Kids de Talia    -> false pour Mark, true pour Mariano
--   Yann (coach) et Talia     -> false partout
