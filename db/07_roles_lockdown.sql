-- 07_roles_lockdown.sql
-- Verrou d'escalade de privileges : SEUL un superadmin peut attribuer/retirer
-- les roles "admin" et "superadmin". Un admin ne gere que les roles "bas"
-- (secretaire, head_coach, coach, prof, membre, etc.). Garde-fou : impossible
-- de retirer le dernier superadmin.
-- Applique sur le projet lnrmtwamuaqcubohontn (migration roles_lockdown_superadmin).

-- Helper : superadmin strict
create or replace function public.is_superadmin(uid uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from user_roles where user_id = uid and role = 'superadmin'); $$;

-- ===================== user_roles (acces reels) =====================
drop policy if exists roles_admin on user_roles;
drop policy if exists roles_self  on user_roles;

-- Lecture : soi-meme, ou admin (pour la matrice d'acces)
create policy roles_read on user_roles for select
  using (user_id = auth.uid() or is_admin(auth.uid()));

-- Un admin gere uniquement les roles NON privilegies
create policy roles_ins on user_roles for insert
  with check (is_admin(auth.uid()) and role not in ('admin','superadmin'));
create policy roles_upd on user_roles for update
  using (is_admin(auth.uid()) and role not in ('admin','superadmin'))
  with check (is_admin(auth.uid()) and role not in ('admin','superadmin'));
create policy roles_del on user_roles for delete
  using (is_admin(auth.uid()) and role not in ('admin','superadmin'));

-- Seul un superadmin gere admin / superadmin (et tout le reste)
create policy roles_super on user_roles for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- ===================== person_roles (chips de la fiche) =====================
drop policy if exists pr_staff on person_roles;

create policy pr_read on person_roles for select using (is_staff(auth.uid()));
create policy pr_ins  on person_roles for insert
  with check (is_staff(auth.uid()) and role not in ('admin','superadmin'));
create policy pr_upd  on person_roles for update
  using (is_staff(auth.uid()) and role not in ('admin','superadmin'))
  with check (is_staff(auth.uid()) and role not in ('admin','superadmin'));
create policy pr_del  on person_roles for delete
  using (is_staff(auth.uid()) and role not in ('admin','superadmin'));
create policy pr_super on person_roles for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- ===================== Garde-fou : dernier superadmin =====================
create or replace function public.protect_last_superadmin()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (tg_op = 'DELETE' and old.role = 'superadmin')
     or (tg_op = 'UPDATE' and old.role = 'superadmin' and new.role <> 'superadmin') then
    if (select count(*) from user_roles where role = 'superadmin') <= 1 then
      raise exception 'Impossible de retirer le dernier superadmin.';
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_protect_last_superadmin on user_roles;
create trigger trg_protect_last_superadmin
  before update or delete on user_roles
  for each row execute function public.protect_last_superadmin();
