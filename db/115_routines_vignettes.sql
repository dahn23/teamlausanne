-- 28.09.2026 (demande Dan) : chaque exercice des 3 routines de base reçoit une vignette illustrée (trait fin bleu),
-- clé « img » dans phys_routines.exercises → fichier /assets/phys/<img>.svg (générées par tools/pictos-physique.js).
with m(name, img) as (values
 ('Footing léger ou corde à sauter','footing'),('Pas chassés et pas croisés','pas_chasses'),('Montées de genoux et talons-fesses','genoux'),
 ('Fentes avant avec rotation du buste','fente_rotation'),('Balancés de jambes','balancer'),('Élastique : rotations externes d''épaule','rotation_epaule'),
 ('Élastique : tirage (rowing)','rowing'),('Élastique aux genoux : marche latérale','marche_laterale'),('Poignets et grands cercles de bras','cercles_bras'),
 ('Réactivité','reactivite'),('Marche ou footing très lent','marche'),('Boire et prévoir une collation','boire'),('Avant des cuisses (quadriceps)','quadriceps'),
 ('Arrière des cuisses','ischios_banc'),('Mollets','mollets_mur'),('Fessiers assis','fessiers_assis'),('Épaules et triceps','epaule_croise'),
 ('Avant-bras et poignets','avant_bras'),('Respiration 4-6','respiration_assis'),('Respiration ventrale','respiration_dos'),('Chat-vache','chat_vache'),
 ('Rotations du haut du dos','rotation_dos'),('Grande fente avec ouverture','fente_ouverture'),('Étirement des hanches (psoas)','psoas'),
 ('Arrière des cuisses (ischios)','ischios_dos'),('Fessier en « 4 »','fessier_4'),('Mollets contre un mur','mollets_mur'),
 ('Épaules et avant-bras','epaule_croise'),('Posture de l''enfant','enfant'))
update phys_routines r set exercises = (
  select jsonb_agg(case when m.img is not null then e.x || jsonb_build_object('img', m.img) else e.x end order by e.i)
  from jsonb_array_elements(r.exercises) with ordinality e(x, i) left join m on m.name = e.x->>'name'), updated_at = now()
where r.kind in ('soir', 'echauffement', 'decrassage');
