-- 01.11.2026 — Le formulaire public de demande d'inscription (site, pages de filière + adultes)
-- répondait « permission denied for function can_membres » : la policy staff, ouverte à {public},
-- était évaluée aussi pour un visiteur anonyme, qui n'a pas le droit d'exécuter can_membres.
-- Résultat : aucune demande n'avait jamais été enregistrée. La policy staff ne vise plus que
-- les comptes connectés ; l'insertion anonyme reste gérée par enr_public_insert.
drop policy if exists enr_staff_all on public.enrollment_requests;
create policy enr_staff_all on public.enrollment_requests for all to authenticated
  using (can_membres(auth.uid())) with check (can_membres(auth.uid()));
grant insert on public.enrollment_requests to anon;
