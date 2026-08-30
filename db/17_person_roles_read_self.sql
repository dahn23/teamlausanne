-- 17_person_roles_read_self.sql
-- "Mon profil" doit afficher TOUS les roles de l'utilisateur, y compris les tags CRM
-- non-acces (ex. "responsable-tournoi"). Ces tags sont dans person_roles, dont la
-- lecture etait reservee au staff (pr_read = is_staff). Un official n'est pas staff ->
-- il ne voyait aucun de ses tags. On autorise chacun a lire SES PROPRES lignes.
create policy pr_read_self on public.person_roles
  for select
  using (person_id in (select person_id from public.profiles where user_id = auth.uid()));
