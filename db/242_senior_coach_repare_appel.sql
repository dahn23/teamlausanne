-- 242 — Un senior coach répare l'appel de SES cours (16.11.2026)
--
-- Demande de Dan : Mark Gattiker doit pouvoir « valider les heures et les
-- leçons » de ses groupes (Sport-études et Pro).
--
-- Rappel du mécanisme, parce que tout tient là-dedans : une heure est comptée
-- quand le coach est marqué PRÉSENT à l'appel. Réparer l'appel, c'est donc
-- valider l'heure. Rien d'autre ne la valide.
--
-- Aujourd'hui un coach ne peut marquer QUE sa propre présence, et seulement
-- entre 25 minutes avant le cours et deux semaines après. Passé ce délai, ou
-- pour un collègue qui a oublié de se pointer, il faut `is_head` — donc
-- Mariano, pour toute l'académie. C'est ce goulot qu'on ouvre.
--
-- Décision (Dan, 16.11.2026) : **on n'invente pas un rôle de plus.** « senior
-- coach » existe depuis db/229, Mark le porte déjà, et c'est exactement la
-- marche intermédiaire qu'il faut entre coach et head coach. Un quatrième
-- grade voudrait dire une colonne de plus dans chaque contrôle de droits.
--
-- Portée : **uniquement les cours où il est lui-même attaché comme coach.**
-- Pas toute l'académie. Il répare l'appel du Sport-études et du Pro, pas celui
-- du Kids Tennis de Talia.
--
-- Ce qui NE bouge PAS, et qui reste réservé au head coach :
--   · le décompte des heures de toute l'équipe (can_hours) ;
--   · créer ou modifier un cours, et le bouton « Non dispo » (is_head +
--     secrétariat, policy cc_write) ;
--   · Prospects, le Dashboard, les Stages ;
--   · les salaires (admin/superadmin ou étiquette « Paie »).

-- ---------------------------------------------------------------------------
-- 1) Qui peut réparer l'appel de CE cours ?
-- ---------------------------------------------------------------------------
-- Volontairement : aucun filtre sur course_coaches.statut. Un senior coach
-- marqué « non disponible » pour une séance (db/240) reste responsable de son
-- cours — c'est même le moment où il a le plus besoin de pointer le collègue
-- qui l'a remplacé. Le statut dit qui est payé, pas qui décide.
create or replace function public.can_fix_attendance(uid uuid, p_course uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select is_head(uid)
      or exists (
        select 1
          from user_roles ur
          join profiles pf on pf.user_id = ur.user_id
          join course_coaches cc on cc.coach_person_id = pf.person_id
         where ur.user_id = uid
           and ur.role = 'senior_coach'
           and cc.course_id = p_course
      );
$$;

-- ---------------------------------------------------------------------------
-- 2) Les deux fonctions d'appel, patchées au fragment exact
-- ---------------------------------------------------------------------------
-- Même garde-fou qu'en db/240 : on relit la définition vivante, on exige que
-- le fragment s'y trouve UNE SEULE fois, et on refuse tout si ce n'est pas le
-- cas. Dan et Raphael travaillent en parallèle ; un `create or replace` écrit
-- d'après une copie périmée écraserait son travail sans rien dire.
create or replace function public.patch_fn_242(p_nom text, p_motif text, p_vers text)
returns void language plpgsql as $$
declare d text; n int;
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = p_nom;
  if d is null then raise exception 'db/242 : fonction % introuvable', p_nom; end if;
  n := regexp_count(d, p_motif);
  if n <> 1 then
    raise exception 'db/242 : % — fragment trouvé % fois (attendu 1). Rien n''est modifié.', p_nom, n;
  end if;
  execute regexp_replace(d, p_motif, p_vers);
end $$;

-- Dans les deux fonctions, tout le bloc de restrictions est gardé par
-- `if not is_head(v_uid) then … end if`. Remplacer cette seule condition
-- suffit : un senior coach sur SON cours passe désormais par la même porte
-- que le head coach, et retrouve donc aussi le droit de pointer les jeunes
-- d'un cours pro / sport-études — ce qui est bien le sens de « il répare
-- l'appel de ses cours ».
select public.patch_fn_242('mark_attendance',
  'if not is_head\(v_uid\) then', 'if not can_fix_attendance(v_uid, p_course) then');
select public.patch_fn_242('clear_attendance',
  'if not is_head\(v_uid\) then', 'if not can_fix_attendance(v_uid, p_course) then');

drop function public.patch_fn_242(text, text, text);

-- ---------------------------------------------------------------------------
-- Vérification (exécutée à l'application, 16.11.2026)
-- ---------------------------------------------------------------------------
--   Mark = 8428df63-f5da-46d3-8622-902e60a6236c (mgattiker@hotmail.com)
--
--   select can_fix_attendance('8428df63-…', <cours où Mark est coach>);  -> true
--   select can_fix_attendance('8428df63-…', <cours Kids Tennis>);        -> false
--   select can_fix_attendance(<uid de Yann, simple coach>, <son cours>); -> false
--
-- Et le pendant côté console : canMarkBox() / peutReparerAppel() dans
-- admin.js, qui doivent dire exactement la même chose — sinon les pastilles
-- restent grises alors que la base accepterait l'écriture.
