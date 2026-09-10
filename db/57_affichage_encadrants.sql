-- 57_affichage_encadrants.sql
-- Correctif de 56 : la policy ne couvrait que le tag « coach » (5 personnes),
-- alors que 9 moniteurs et 2 preparateurs physiques encadrent aussi des cours et
-- apparaissent donc dans la grille des courts. Sans eux, la grille affichait le
-- repli « Coach » de admin.js au lieu du nom.
-- « prof » reste exclu : enseignants scolaires, pas encadrants de court.
-- Verifie apres coup : 16 encadrants visibles, 0 autre personne.
drop policy if exists people_read_affichage on public.people;
create policy people_read_affichage on public.people for select
  using (
    has_role(auth.uid(), 'affichage')
    and (has_person_role(id, 'coach')
      or has_person_role(id, 'head_coach')
      or has_person_role(id, 'moniteur')
      or has_person_role(id, 'coach_physique'))
  );
