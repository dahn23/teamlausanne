-- Les deux batteries de tests physiques de l'académie (01.11.2026)
--
-- Rejouable : les batteries sont retrouvées par leur nom, leurs mesures réécrites à chaque
-- passage. Les questions sont mises à jour en place (et non supprimées puis recréées) parce
-- que phys_answers garde leur question_id : effacer une question couperait les résultats
-- déjà saisis de leur protocole et de leur vignette.
-- Les protocoles sont ceux du préparateur physique, repris mot pour mot (fautes corrigées).

do $$
declare
  v_test uuid;
  v_q    record;
  v_i    int;
  -- label, description, icone, unite, sens du progrès
  v_puissance text[][] := array[
    ['Lancer mur', 'Lancer d''une médecine-ball de 2 kg, à 2 mains. Debout contre un mur, les pieds à environ 30 cm. Lancer la balle le plus loin possible sans que les omoplates ne décollent du mur.', 'lancer_mur', 'm', 'up'],
    ['Lancer bras droit', 'Lancer une médecine-ball de 2 kg, à 1 bras. Le pied opposé au bras de lancer en avant, contre le filet ; aide des jambes autorisée mais sans décoller le pied arrière. Longueur mesurée depuis le filet.', 'lancer_droite', 'm', 'up'],
    ['Lancer bras gauche', 'Lancer une médecine-ball de 2 kg, à 1 bras. Le pied opposé au bras de lancer en avant, contre le filet ; aide des jambes autorisée mais sans décoller le pied arrière. Longueur mesurée depuis le filet.', 'lancer_gauche', 'm', 'up'],
    ['Saut horizontal', 'Saut en extension à 2 pieds, le plus loin possible. Mesure prise à l''arrière de la chaussure.', 'saut_horizontal', 'cm', 'up'],
    ['2 bras par-dessus tête', 'Lancer une médecine-ball de 2 kg par-dessus la tête, comme une touche de football, les pieds parallèles, depuis le filet.', 'lancer_tete', 'm', 'up'],
    ['Saut vertical', 'Saut à 2 pieds, le plus haut possible, les jambes tendues en l''air.', 'saut_vertical', 'cm', 'up']
  ];
  v_force text[][] := array[
    ['Préhension gauche', 'Test de la force de poigne de la main gauche, avec un appareil de mesure (dynamomètre).', 'prehension_g', 'kg', 'up'],
    ['Préhension droite', 'Test de la force de poigne de la main droite, avec un appareil de mesure (dynamomètre).', 'prehension_d', 'kg', 'up'],
    ['Souplesse assise', 'Souplesse des ischio-jambiers. Assis, les jambes tendues : aller chercher le plus loin possible avec les mains.', 'souplesse_assise', 'cm', 'up'],
    ['Souplesse debout escalier', 'Souplesse des ischio-jambiers. Debout sur un box ou une marche d''escalier, les pointes de pieds au bord, descendre les mains le plus bas possible en gardant les jambes tendues.', 'souplesse_escalier', 'cm', 'up'],
    ['Distance épaules', 'Mesure de la distance entre les acromions (les os de l''épaule). Sert de référence au test de la corde : elle n''est pas une performance.', 'dist_epaules', 'cm', 'neutral'],
    ['Épaules corde', 'Souplesse des épaules. Bras tendus, tenir une corde devant soi et la faire passer derrière en gardant les bras le plus proches l''un de l''autre possible. On soustrait la distance épaules de la distance entre les mains une fois la corde dans le dos.', 'epaules_corde', 'cm', 'down'],
    ['Épaules + poignets', 'Mobilité et souplesse des épaules. Allongé sur le ventre, le nez touche le sol, bras tendus en avant tenant un bâton avec un écart de 40 cm : lever le bâton le plus haut possible.', 'epaules_poignets', 'cm', 'up'],
    ['Tronc + cou', 'Souplesse et mobilité du dos. Allongé sur le ventre, bras derrière les oreilles, lever le buste le plus haut possible ; mesure prise entre le nez et le sol.', 'tronc_cou', 'cm', 'up']
  ];
  v_batteries text[] := array['Puissance — lancers et sauts', 'Force et souplesse'];
  v_mesures   text[][];
begin
  for v_i in 1 .. 2 loop
    v_mesures := case v_i when 1 then v_puissance else v_force end;

    select id into v_test from phys_tests where name = v_batteries[v_i];
    if v_test is null then
      insert into phys_tests (name, active, sort_order) values (v_batteries[v_i], true, v_i)
        returning id into v_test;
    else
      update phys_tests set active = true, sort_order = v_i where id = v_test;
    end if;

    for v_q in
      select generate_series as n, v_mesures[generate_series][1] as label
      from generate_series(1, array_length(v_mesures, 1))
    loop
      update phys_test_questions set
        description = v_mesures[v_q.n][2], icon = v_mesures[v_q.n][3],
        unit = v_mesures[v_q.n][4], better = v_mesures[v_q.n][5],
        answer_type = 'number', sort_order = v_q.n
      where test_id = v_test and label = v_q.label;
      if not found then
        insert into phys_test_questions (test_id, label, answer_type, sort_order, description, icon, unit, better)
        values (v_test, v_q.label, 'number', v_q.n,
                v_mesures[v_q.n][2], v_mesures[v_q.n][3], v_mesures[v_q.n][4], v_mesures[v_q.n][5]);
      end if;
    end loop;
  end loop;
end $$;
