-- 187 — Aperçu de Mon espace depuis la console.
--
-- Demande du 20.10.2026 : voir à quoi ressemble l'espace privé sur un
-- téléphone, filière par filière, sans sortir le sien et sans se connecter
-- avec le compte d'une famille.
--
-- L'aperçu affiche l'app RÉELLE dans un cadre de téléphone, avec les données
-- d'un vrai élève. Ce qui pose la seule vraie question : qui a le droit de
-- regarder, et quoi.
--
-- LE PIÈGE, et pourquoi cette migration est si étroite.
--
-- La garde du portail, c'est can_read_public_of(jeune) = « ce jeune est de ma
-- famille ». La tentation était d'y ajouter « ou je suis admin ». Mais deux
-- autres gardes RETOMBENT dessus :
--
--   can_mental_of(jeune) := ... or can_read_public_of(jeune)
--   can_phys_of(jeune)   := ... or can_read_public_of(jeune)
--
-- Élargir can_read_public_of aurait donc ouvert, d'un même geste, les notes
-- mentales et le suivi physique des enfants — au secrétariat compris, qui n'y
-- a aucun accès dans la console (can_mental ne connaît que superadmin, admin,
-- head_coach et coach_mental). Une porte dérobée exactement du genre de
-- celles qu'on a fermées en octobre.
--
-- On ne touche donc PAS can_read_public_of. On ajoute la permission d'aperçu
-- aux trois seuls endroits où l'admin et le secrétariat voient déjà tout dans
-- la console :
--
--   · les leçons              (onglet Cours)
--   · la fiche du jeune        (Répertoire — l'AVS y figure déjà)
--   · les feuilles de match    (déjà lisibles par is_encadrement)
--
-- Mental, focus et physique gardent leurs propres règles. Conséquence voulue :
-- un secrétaire qui regarde l'aperçu d'un sport-études voit ces écrans VIDES,
-- un admin les voit remplis — parce qu'il y a droit par lui-même. L'aperçu
-- montre à chacun ce que son rôle lui donne déjà, et rien de plus.

begin;

-- Qui peut regarder un aperçu. Volontairement plus étroit qu'is_encadrement :
-- ni les coachs ni les moniteurs, qui n'ont pas à parcourir les familles.
create or replace function public.portal_peut_apercevoir()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from user_roles
                  where user_id = auth.uid()
                    and role in ('superadmin', 'admin', 'secretaire'));
$$;

comment on function public.portal_peut_apercevoir() is
  'Droit de visualiser Mon espace à la place d''une famille, depuis la console. Admin et secrétariat seulement.';

-- La liste des élèves proposés dans le sélecteur de l'aperçu. Rien de
-- sensible : un prénom, un nom et la filière, ce que la console montre déjà
-- dans le Répertoire.
create or replace function public.portal_apercu_eleves(p_filiere text)
returns table(person_id uuid, nom text, filiere text, a_un_compte boolean)
language sql stable security definer set search_path to 'public' as $$
  with cur as (select s.id from seasons s
                where s.kind = 'juniors' and current_date between s.start_date and s.end_date
                limit 1)
  select pe.id,
         pe.first_name || ' ' || pe.last_name,
         rp.role,
         exists (select 1 from auth.users u
                  where lower(u.email) = lower(trim(pe.email))
                    and coalesce(trim(pe.email), '') <> '')
    from role_periods rp
    join cur on cur.id = rp.season_id
    join people pe on pe.id = rp.person_id
   where portal_peut_apercevoir()
     and rp.role = p_filiere
   order by pe.first_name, pe.last_name;
$$;

revoke all on function public.portal_apercu_eleves(text) from public, anon;
grant execute on function public.portal_apercu_eleves(text) to authenticated;

-- --- Les trois gardes élargies ---------------------------------------------

-- Les leçons. Sans aperçu, la clause rend la semaine de SA famille ; avec,
-- celle de tout le club. L'app filtre ensuite sur le jeune sélectionné, et
-- une semaine de leçons reste une charge modeste.
create or replace function public.portal_week_courses(p_from date, p_to date)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.course_date, t.start_time, t.youth_first), '[]'::jsonb)
  from (
    select
      c.id                                   as course_id,
      cp.child_person_id                     as youth_id,
      pe.first_name                          as youth_first,
      pe.last_name                           as youth_last,
      c.course_date,
      to_char(c.start_time,'HH24:MI')        as start_time,
      to_char(c.end_time,'HH24:MI')          as end_time,
      coalesce(nullif(c.title,''), ct.name)  as title,
      coalesce(c.color, ct.color)            as color,
      (select string_agg(co.name, ', ' order by co.name)
         from court_bookings cb join courts co on co.id = cb.court_id
        where cb.course_id = c.id)           as court,
      (select string_agg(cpe.first_name, ', ' order by cpe.first_name)
         from course_coaches cc join people cpe on cpe.id = cc.coach_person_id
        where cc.course_id = c.id)           as coach,
      (select a.status::text from attendance a
        where a.course_id = c.id and a.person_id = cp.child_person_id and a.is_coach = false
        limit 1)                             as coach_status,
      n.kind                                 as notice_kind,
      n.note                                 as notice_note
    from courses c
    join course_participants cp on cp.course_id = c.id
    join people pe on pe.id = cp.child_person_id
    left join course_types ct on ct.id = c.course_type_id
    left join course_notices n on n.course_id = c.id and n.person_id = cp.child_person_id
    where c.course_date between p_from and p_to
      and (public.can_read_public_of(cp.child_person_id) or public.portal_peut_apercevoir())
  ) t;
$$;

-- La fiche du jeune. L'admin et le secrétariat la lisent déjà entièrement
-- dans le Répertoire, AVS compris.
create or replace function public.portal_youth_info(p_youth uuid)
returns table(first_name text, last_name text, birthdate date, gender text, email text,
              phone text, avs text, license_no text, address text, postal_code text,
              city text, confirmed boolean)
language sql stable security definer set search_path to 'public' as $$
  select first_name,last_name,birthdate,gender,email,phone,avs,license_no,address,postal_code,city,
         (profile_confirmed_at is not null)
  from people
  where id = p_youth
    and (can_read_public_of(p_youth) or portal_peut_apercevoir());
$$;

-- Les feuilles de match. La table les ouvre déjà à tout l'encadrement
-- (politique mr_staff, is_encadrement) : l'aperçu ne montre donc rien de neuf.
create or replace function public.portal_match_reports(p_youth uuid)
returns setof match_reports language sql stable security definer set search_path to 'public' as $$
  select * from match_reports
  where youth_person_id = p_youth
    and (can_read_public_of(p_youth) or portal_peut_apercevoir())
  order by match_date desc nulls last, created_at desc;
$$;

commit;

-- ---------------------------------------------------------------------------
-- Le profil à imiter, en un seul appel.
--
-- La forme de Mon espace vient de trois réponses : quels jeunes, lesquels sont
-- « joueurs » (onglets Matchs, Compétition, Feuille, Physique) et lesquels
-- sont « élite » (l'onglet Stages disparaît). Les règles vivent déjà en base ;
-- l'aperçu les REDEMANDE plutôt que de les réécrire en JavaScript, sinon les
-- deux finiraient par diverger et l'aperçu mentirait précisément sur ce qu'on
-- lui demande de montrer.
create or replace function public.portal_apercu_profil(p_youth uuid)
returns table(person_id uuid, first_name text, last_name text, photo_url text,
              est_joueur boolean, est_elite boolean)
language sql stable security definer set search_path to 'public' as $$
  select pe.id, pe.first_name, pe.last_name, pe.photo_url,
         exists (
           select 1 from person_roles pr where pr.person_id = pe.id
             and pr.role in ('pro','pro-u18','competition','performance','sport-etudes')
         ) or exists (
           select 1 from role_periods rp join seasons s on s.id = rp.season_id
            where rp.person_id = pe.id
              and rp.role in ('pro','pro-u18','competition','performance','sport-etudes')
              and current_date between s.start_date and s.end_date
         ),
         is_elite_youth(pe.id)
    from people pe
   where pe.id = p_youth
     and portal_peut_apercevoir();
$$;

revoke all on function public.portal_apercu_profil(uuid) from public, anon;
grant execute on function public.portal_apercu_profil(uuid) to authenticated;
