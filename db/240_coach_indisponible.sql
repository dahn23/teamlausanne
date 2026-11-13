-- 240 — Un coach « non disponible » pour une séance, sans le retirer du cours
-- (Raphael, 13.11.2026)
--
-- POURQUOI. `course_coaches` répondait à DEUX questions avec une seule ligne :
-- « qui est prévu sur ce cours ? » et « qui l'a donné, donc qui est payé ? ».
-- Quand un coach partait en tournoi, la seule façon de ne pas le payer était
-- de le RETIRER du cours — ce qui détruisait la réponse à la première.
--
-- Ce que ça donnait en vrai, sur les trois dernières semaines pleines :
--   • les créneaux ne bougent pas (79/79 puis 80/80 identiques d'une semaine
--     à l'autre) ; ce sont les COACHS qui changent, sur un tiers des cours.
--   • Mariano Palena : 22 cours la semaine du 02.11, **1** celle du 09.11,
--     21 celle du 16.11. Il était au Brésil — et c'était DÉJÀ écrit dans le
--     calendrier (« Brésil », 07→16.11, validé). Quelqu'un a malgré tout
--     retiré son nom de 21 cours à la main.
--   • Séline Rivaroli, malade les 09 et 10.11 : 2 → 1 → 0, même histoire.
-- Et comme « copier la semaine » recopie la semaine PRÉCÉDENTE, chaque
-- retrait devenait la vérité de la semaine suivante. Perez, venu dépanner,
-- était encore sur 10 cours deux semaines plus tard.
--
-- La note de db/129 posait déjà la question sans la trancher : « il faudrait
-- retirer le coach remplacé de course_coaches sur les cours qu'il n'a pas
-- donnés […] cela réécrit le planning passé : à décider, pas à faire en
-- passant. » Voilà la décision.
--
-- CE QU'ON FAIT. Une ligne de course_coaches porte désormais un STATUT :
--   • 'prevu'   — l'état normal, celui de tout le monde. Compte pour la paie.
--   • 'indispo' — pas disponible CETTE séance-là. Le coach RESTE attaché au
--                 cours (donc « copier la semaine » et le planning le gardent),
--                 mais il ne compte plus dans les heures. Le remplaçant, lui,
--                 est ajouté normalement en 'prevu' : c'est lui qui est payé.
--
-- ⚠️ 'indispo' n'est PAS l'absence de l'appel (attendance.status = 'absent').
-- Ce sont deux choses différentes et elles doivent le rester :
--   absent  = constaté le jour même, à l'appel. « N'est pas venu. »
--   indispo = décidé à l'avance, remplacement organisé. « Ne vient pas, c'est
--             prévu, c'est couvert. » D'où une couleur à part dans la console
--             (hachuré gris), surtout pas le rouge.
--
-- LES SEMAINES PASSÉES NE BOUGENT PAS. La colonne naît à 'prevu' : toutes les
-- lignes existantes gardent exactement le sens et la paie qu'elles avaient.
-- Rien n'est recalculé, rien n'est réécrit. On part propre à partir de la
-- première séance qu'on marquera à la main.

-- ---------------------------------------------------------------- colonnes --
alter table public.course_coaches
  add column if not exists statut     text not null default 'prevu',
  add column if not exists motif      text,
  add column if not exists remplace_par_person_id uuid references public.people(id) on delete set null,
  add column if not exists statut_par uuid references auth.users(id) on delete set null,
  add column if not exists statut_le  timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.course_coaches'::regclass
                    and conname  = 'course_coaches_statut_chk') then
    alter table public.course_coaches
      add constraint course_coaches_statut_chk check (statut in ('prevu', 'indispo'));
  end if;
end $$;

comment on column public.course_coaches.statut is
  'prevu = compte pour la paie · indispo = pas disponible cette séance, reste au planning, non payé';
comment on column public.course_coaches.remplace_par_person_id is
  'Qui a couvert la séance. Purement indicatif : le remplaçant est payé parce qu''il a SA propre ligne en prevu, pas à cause de celle-ci.';

-- Les indispos sont rares : un index partiel suffit, et il reste minuscule.
create index if not exists course_coaches_indispo_idx
  on public.course_coaches (coach_person_id) where statut = 'indispo';

-- Pas de changement de RLS : cc_write (is_head ou secrétaire) couvre déjà le
-- marquage, et c'est exactement la même main qui édite le planning.

-- --------------------------------------------------------------- fonctions --
-- Sept fonctions lisent course_coaches pour compter des heures ou alerter.
-- Plutôt que de les recopier à la main — 4 500 caractères pour dash_general
-- seule, et autant d'occasions de faire une faute de frappe — on ajoute le
-- prédicat SUR LA DÉFINITION VIVE, avec un garde-fou : si le fragment attendu
-- n'est pas là exactement une fois, la migration s'arrête.

create or replace function public.patch_fn_240(p_nom text, p_motif text, p_vers text)
returns void language plpgsql as $$
declare d text; n int;
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = p_nom;
  if d is null then raise exception 'db/240 : fonction % introuvable', p_nom; end if;
  n := regexp_count(d, p_motif);
  if n <> 1 then
    raise exception 'db/240 : % — fragment trouvé % fois (attendu 1). Rien n''est modifié.', p_nom, n;
  end if;
  execute regexp_replace(d, p_motif, p_vers);
end $$;

-- Les six fonctions de PAIE : un coach indispo ne compte plus, ni en heures ni
-- dans le total « cours confirmés / cours ». Ce second point corrige au passage
-- le « 17/22 pour toujours » décrit dans db/129 : un coach légitimement
-- remplacé restait compté sur des cours qu'il n'avait pas donnés.
select public.patch_fn_240('coach_heures_periode',
  'join course_coaches cc on cc\.course_id = c\.id',
  'join course_coaches cc on cc.course_id = c.id and cc.statut = ''prevu''');

select public.patch_fn_240('coach_hours_detail_brut',
  'join course_coaches cc on cc\.course_id = c\.id',
  'join course_coaches cc on cc.course_id = c.id and cc.statut = ''prevu''');

select public.patch_fn_240('my_hours_month',
  'join course_coaches cc on cc\.course_id = c\.id',
  'join course_coaches cc on cc.course_id = c.id and cc.statut = ''prevu''');

select public.patch_fn_240('person_pay_season',
  'join course_coaches cc on cc\.course_id = c\.id and cc\.coach_person_id = p_person',
  'join course_coaches cc on cc.course_id = c.id and cc.coach_person_id = p_person and cc.statut = ''prevu''');

select public.patch_fn_240('prive_adultes_month',
  'join course_coaches cc on cc\.course_id = c\.id',
  'join course_coaches cc on cc.course_id = c.id and cc.statut = ''prevu''');

select public.patch_fn_240('staff_hours_month_brut',
  'join course_coaches cc on cc\.course_id = c\.id',
  'join course_coaches cc on cc.course_id = c.id and cc.statut = ''prevu''');

-- Et le tableau de bord. « Cours sans coach » doit continuer à voir les cours
-- que personne n'assure : jusqu'ici on retirait le coach, et l'alerte se
-- déclenchait toute seule. Maintenant qu'il reste attaché, il faut le dire —
-- sinon un cours dont le seul coach est indispo passerait pour couvert.
-- `coachabs` n'est PAS touchée : elle parle de l'appel, pas de la dispo.
select public.patch_fn_240('dash_general',
  'not exists\(select 1 from course_coaches cc where cc\.course_id=u\.id\)',
  'not exists(select 1 from course_coaches cc where cc.course_id=u.id and cc.statut=''prevu'')');

drop function public.patch_fn_240(text, text, text);

-- Les fonctions d'AFFICHAGE et d'ACCÈS ne sont volontairement pas touchées :
--   coach_of_course, affichage_course_detail, portal_week_courses, mon_joueur
--     → le coach doit rester visible, c'est tout l'intérêt de ne pas le retirer ;
--   mark_attendance, clear_attendance
--     → un coach indispo garde le droit de faire l'appel s'il le fait à distance ;
--   course_is_detailed, dash_general/coachabs
--     → comptent des coachs attachés, pas des heures.

-- Contrôles :
--   select statut, count(*) from course_coaches group by statut;
--     → tout doit être 'prevu' juste après la migration.
--   select * from coach_heures_periode('2026-11-09','2026-11-15');
--     → inchangé tant qu'aucune ligne n'est passée en 'indispo'.
