-- =====================================================================
-- 255 — La couleur attachée à un nom de réservation sert enfin
--                                                            26.11.2026
-- =====================================================================
-- `booking_labels` garde depuis toujours un nom ET une couleur : le nom
-- alimente la liste de suggestions du champ « Nom », la couleur était
-- écrite à la toute première saisie et PLUS JAMAIS RELUE. Résultat, un même
-- locataire prenait la couleur que la personne avait sous la main ce
-- jour-là — Xavier Schumacher existait en jaune, en bleu par défaut et en
-- brun (cf. db/254).
--
-- Désormais (admin.js) : choisir un nom déjà connu repose SA couleur, et
-- enregistrer met la couleur du nom à jour. Le dernier choix délibéré fait
-- foi et devient le défaut de la fois suivante. Sans cette mise à jour, la
-- couleur de la toute première saisie resterait figée pour l'éternité —
-- c'est précisément ce qui avait laissé « Schumacher » sur le bleu.
--
-- ⚠ Ne concerne QUE les réservations de court. Une séance de l'école est un
-- cours : la grille lit `course_types.color` avant la couleur de la
-- réservation (drawResaGrid), donc rien ici ne peut l'atteindre. Même garde
-- que db/254.
--
-- Les trois autres libellés (« cours kim », « Performance », « Tournoi »)
-- sont laissés tels quels : leur couleur deviendra celle du prochain
-- enregistrement délibéré.
-- =====================================================================

update booking_labels set color = '#92400e' where lower(name) like '%schumacher%';

insert into booking_labels (name, color)
select 'Xavier Schumacher', '#92400e'
where not exists (select 1 from booking_labels where lower(name) = 'xavier schumacher');
