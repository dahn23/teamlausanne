-- 222_bareme_epaules_corde.sql
-- Le premier barème chargé : « Épaules corde », pris dans le tableau du préparateur
-- physique (feuille du 16.09.2026), seule mesure dont la feuille écrit les seuils en
-- clair (03.11.2026) :
--
--   Excellent : H < 17,8   / F < 12,7
--   Bon       : H 17,8–29,2 / F 12,7–24,7
--   Moyen     : H 29,2–36,8 / F 24,7–33,0
--   Passable  : H 36,8–49,5 / F 33,0–45,1
--   Faible    : H > 49,5   / F > 45,1
--
-- Ce barème n'a PAS de palier « Très bon » : il en compte cinq, là où d'autres mesures de
-- la même feuille en comptent six ou huit. D'où le seuil laissé vide — db/221 prévoit qu'un
-- palier sans seuil soit simplement sauté.
--
-- La mesure va dans le sens 'down' (moins l'écart des mains est grand, meilleure est la
-- souplesse), et la fonction compare donc en « au plus ».
--
-- Une borne tombe dans deux paliers sur la feuille (17,8 est à la fois la fin d'« Excellent »
-- et le début de « Bon »). On tranche pour le palier le plus favorable : 17,8 exactement =
-- Excellent. Un dixième de centimètre au dynamomètre ne mérite pas qu'on coupe un cheveu.
--
-- Vérifié contre les dix résultats du 16.09.2026 : les dix paliers calculés correspondent
-- aux couleurs posées à la main dans la feuille.

do $$
declare v_q uuid;
begin
  select id into v_q from phys_test_questions where label = 'Épaules corde';
  if v_q is null then raise notice 'Mesure « Épaules corde » introuvable — rien chargé.'; return; end if;

  insert into phys_norms (question_id, sex, s_excellent, s_tres_bon, s_bon, s_moyen, s_passable, source)
  values
    (v_q, 'M', 17.8, null, 29.2, 36.8, 49.5, 'Tableau du préparateur physique, feuille du 16.09.2026'),
    (v_q, 'F', 12.7, null, 24.7, 33.0, 45.1, 'Tableau du préparateur physique, feuille du 16.09.2026')
  on conflict (question_id, coalesce(sex, '*'), coalesce(age_min, -1), coalesce(age_max, -1))
  do update set s_excellent = excluded.s_excellent, s_tres_bon = excluded.s_tres_bon,
                s_bon = excluded.s_bon, s_moyen = excluded.s_moyen, s_passable = excluded.s_passable,
                source = excluded.source, updated_at = now();
end $$;
