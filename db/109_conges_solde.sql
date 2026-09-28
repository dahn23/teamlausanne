-- Congés : droit annuel, solde et décompte (28.09.2026)
--
-- Le calendrier savait déjà demander et valider des vacances. Ce qui manquait,
-- c'est la comptabilité : combien de jours chacun a droit, combien il en a
-- pris, combien il en demande, combien il lui reste.
--
-- Trois décisions qui se voient dans l'écran, et qui se changent :
--
--  1. UN JOUR = UN JOUR OUVRABLE. Une demande du lundi au dimanche vaut cinq
--     jours, pas sept. On retire aussi les jours fériés vaudois : quelqu'un
--     qui pose la semaine de Pâques ne doit pas payer le Vendredi saint.
--     D'où la table public_holidays — school_holidays ne convient pas, elle
--     mélange vacances scolaires et quelques fériés.
--
--  2. LE DROIT EST PAR ANNÉE CIVILE, la norme suisse. Une demande à cheval sur
--     le Nouvel An est donc comptée dans les deux années, au prorata des jours
--     ouvrables de chacune — sans quoi elle tomberait entière dans l'une.
--
--  3. LE DROIT N'A PAS DE VALEUR PAR DÉFAUT. Inventer « 25 jours » donnerait
--     un solde faux qui a l'air juste. Tant que personne n'a saisi le droit
--     de quelqu'un, l'écran affiche « droit à définir » plutôt qu'un nombre.
--
-- Une demande EN ATTENTE est déjà décomptée : c'est ce qu'on veut voir avant
-- d'en accorder une autre. Elle est comptée à part du pris, pour qu'on sache
-- ce qui est acquis et ce qui ne l'est pas.

-- ---------- Jours fériés (canton) ----------
create table if not exists public.public_holidays (
  canton text not null default 'VD',
  day    date not null,
  label  text not null,
  primary key (canton, day)
);
alter table public.public_holidays enable row level security;
drop policy if exists jf_lecture on public.public_holidays;
create policy jf_lecture on public.public_holidays for select to authenticated using (true);
grant select on public.public_holidays to authenticated;

insert into public.public_holidays (canton, day, label) values
  ('VD','2026-01-01','Nouvel An'),        ('VD','2026-01-02','2 janvier'),
  ('VD','2026-04-03','Vendredi saint'),   ('VD','2026-04-06','Lundi de Pâques'),
  ('VD','2026-05-14','Ascension'),        ('VD','2026-05-25','Lundi de Pentecôte'),
  ('VD','2026-08-01','Fête nationale'),   ('VD','2026-09-21','Lundi du Jeûne fédéral'),
  ('VD','2026-12-25','Noël'),
  ('VD','2027-01-01','Nouvel An'),        ('VD','2027-01-02','2 janvier'),
  ('VD','2027-03-26','Vendredi saint'),   ('VD','2027-03-29','Lundi de Pâques'),
  ('VD','2027-05-06','Ascension'),        ('VD','2027-05-17','Lundi de Pentecôte'),
  ('VD','2027-08-01','Fête nationale'),   ('VD','2027-09-20','Lundi du Jeûne fédéral'),
  ('VD','2027-12-25','Noël')
on conflict (canton, day) do nothing;

-- Jours ouvrables d'une période, bornés à une année civile quand on la donne.
-- Le samedi et le dimanche sortent, les fériés aussi.
create or replace function public.jours_ouvrables(p_debut date, p_fin date, p_annee int default null)
returns numeric language sql stable as $fn$
  select count(*)::numeric
    from generate_series(
           greatest(p_debut, case when p_annee is null then p_debut else make_date(p_annee,1,1) end),
           least(p_fin,     case when p_annee is null then p_fin  else make_date(p_annee,12,31) end),
           interval '1 day') d
   where extract(isodow from d) < 6
     and not exists (select 1 from public_holidays h
                      where h.canton = 'VD' and h.day = d::date);
$fn$;

-- ---------- Droit annuel ----------
create table if not exists public.staff_leave_allowance (
  member_id  uuid not null references public.pm_members(id) on delete cascade,
  year       int  not null,
  days       numeric(4,1) not null check (days >= 0 and days <= 366),
  note       text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (member_id, year)
);
alter table public.staff_leave_allowance enable row level security;

-- Chacun lit SON droit ; seuls ceux qui valident lisent celui des autres.
drop policy if exists cong_lecture on public.staff_leave_allowance;
create policy cong_lecture on public.staff_leave_allowance for select to authenticated
  using (can_calendrier_valider(auth.uid())
         or member_id in (select m.id from pm_members m
                           join profiles pr on pr.person_id = m.person_id
                          where pr.user_id = auth.uid()));
-- Seuls ceux qui valident les congés fixent les droits.
drop policy if exists cong_ecriture on public.staff_leave_allowance;
create policy cong_ecriture on public.staff_leave_allowance for all to authenticated
  using (can_calendrier_valider(auth.uid())) with check (can_calendrier_valider(auth.uid()));
grant select, insert, update, delete on public.staff_leave_allowance to authenticated;

-- Une ligne de congé peut porter un décompte manuel : demi-journée, absence
-- particuliere, arrangement. S'il est rempli il prime sur le calcul.
alter table public.cal_events
  add column if not exists days_override numeric(4,1);
comment on column public.cal_events.days_override is
  'Décompte manuel en jours (demi-journée, cas particulier). Prime sur le calcul en jours ouvrables.';

-- ---------- Soldes ----------
-- Renvoie une ligne par membre : droit, pris (validé), en attente, restant.
-- En SECURITY DEFINER parce que le calcul doit lire cal_events pour tout le
-- monde ; le filtre de sortie (plus bas) decide ensuite qui voit quoi.
create or replace function public.conges_soldes(p_annee int)
returns table (member_id uuid, nom text, initiales text, couleur text,
               person_id uuid, droit numeric, pris numeric, en_attente numeric, restant numeric)
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
         a.days,
         coalesce((select jours from compte c where c.member_id=m.id and c.status='valide'),0),
         coalesce((select jours from compte c where c.member_id=m.id and c.status='demande'),0),
         case when a.days is null then null else
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

revoke all on function public.jours_ouvrables(date, date, int) from public, anon;
revoke all on function public.conges_soldes(int)               from public, anon;
grant execute on function public.jours_ouvrables(date, date, int) to authenticated;
grant execute on function public.conges_soldes(int)               to authenticated;

-- ---------- Liens manquants ----------
-- Seul Mariano etait relie a une fiche. Sans ce lien, personne ne peut voir
-- SON solde, et le formulaire ne savait deja pas proposer « pour moi ».
update public.pm_members set person_id = 'cf79b7aa-960a-4d70-aefc-7bb30d000837' where initials = 'RV' and person_id is null;
update public.pm_members set person_id = 'f9034b5b-36bc-4a15-a0d6-3fcbef630dee' where initials = 'DH' and person_id is null;
update public.pm_members set person_id = '80719169-dae3-4b11-9836-b06b44035c4d' where initials = 'AH' and person_id is null;
update public.pm_members set person_id = '4d6083e5-413f-4072-ad40-7a83be675ba2' where initials = 'SR' and person_id is null;
