-- Congés : sortir quelqu'un de la comptabilité sans le sortir du calendrier
-- (28.09.2026)
--
-- Dan dirige l'académie : il n'a pas de droit aux vacances à tenir, mais il
-- doit voir celui des autres. Sans distinction, sa ligne restait à « droit à
-- définir » pour toujours et le récapitulatif annonçait en permanence « 1
-- droit à définir » — un rappel pour une chose qui ne sera jamais faite.
--
-- Ce que le drapeau NE fait PAS : l'empêcher de poser des vacances. Il peut
-- toujours en saisir, elles s'affichent dans le calendrier comme celles des
-- autres — c'est ainsi que l'équipe sait qu'il est absent. Elles ne sont
-- simplement comptées contre aucun droit.
--
-- La ligne reste VISIBLE dans le tableau, marquée « non suivi », plutôt que
-- d'être filtrée : une ligne qui disparaît quand on décoche est une ligne
-- qu'on ne peut plus recocher.

alter table public.pm_members
  add column if not exists leave_tracked boolean not null default true;

comment on column public.pm_members.leave_tracked is
  'Soumis au décompte des congés. false = pas de droit à tenir (direction) ; '
  'ses vacances restent visibles au calendrier mais ne sont comptées nulle part.';

update public.pm_members set leave_tracked = false where initials = 'DH';

-- Le récapitulatif transporte le drapeau : c'est l'écran qui décide comment
-- présenter une ligne non suivie, et le calcul ne change pas pour les autres.
create or replace function public.conges_soldes(p_annee int)
returns table (member_id uuid, nom text, initiales text, couleur text,
               person_id uuid, suivi boolean, droit numeric, pris numeric,
               en_attente numeric, restant numeric)
language sql stable security definer set search_path = public as $fn$
  with moi as (select pr.person_id as pid from profiles pr where pr.user_id = auth.uid()),
  compte as (
    select e.member_id, e.status,
           sum(coalesce(e.days_override,
                        jours_ouvrables(e.start_date, e.end_date, p_annee))) as jours
      from cal_events e
     where e.kind = 'vacances' and e.member_id is not null
       and e.status in ('demande','valide')
       -- Bornes larges : une demande a cheval sur l'annee est retenue ici, et
       -- c'est jours_ouvrables() qui ne compte que la part de l'annee voulue.
       and e.end_date >= make_date(p_annee,1,1)
       and e.start_date <= make_date(p_annee,12,31)
     group by e.member_id, e.status
  )
  select m.id, m.name, m.initials, m.color, m.person_id,
         coalesce(m.leave_tracked, true),
         -- Pas de droit ni de solde pour qui n'est pas suivi : afficher un
         -- nombre laisserait croire a une comptabilite qui n'existe pas.
         case when coalesce(m.leave_tracked, true) then a.days end,
         coalesce((select jours from compte c where c.member_id=m.id and c.status='valide'),0),
         coalesce((select jours from compte c where c.member_id=m.id and c.status='demande'),0),
         case when not coalesce(m.leave_tracked, true) or a.days is null then null else
           a.days
           - coalesce((select jours from compte c where c.member_id=m.id and c.status='valide'),0)
           - coalesce((select jours from compte c where c.member_id=m.id and c.status='demande'),0)
         end
    from pm_members m
    left join staff_leave_allowance a on a.member_id = m.id and a.year = p_annee
   where m.active
     and can_calendrier(auth.uid())
     -- Cloisonnement : cacher le tableau dans l'ecran ne suffit pas, la
     -- fonction reste appelable directement. Qui ne valide pas ne recoit
     -- QUE sa propre ligne.
     and (can_calendrier_valider(auth.uid())
          or m.person_id = (select pid from moi))
   order by m.sort_order;
$fn$;

revoke all on function public.conges_soldes(int) from public, anon;
grant execute on function public.conges_soldes(int) to authenticated;
