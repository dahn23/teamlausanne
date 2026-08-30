-- 15_gz_resp_people.sql
-- Un OFFICIAL (organisateur) doit pouvoir attribuer les responsables d'un tournoi,
-- y compris lui-meme. Probleme : un official n'est PAS "staff" -> la RLS lui interdit
-- de lire person_roles et le repertoire people (il ne voit que sa propre fiche).
-- Resultat : la liste des responsables nommables etait vide pour lui.
--
-- Solution (pattern GameZone) : fonction SECURITY DEFINER qui renvoie les candidats
-- (tagues "responsable-tournoi") + ceux deja nommes, avec leur nom, sans ouvrir tout
-- le repertoire. Reservee aux officials/staff. Le front (loadResponsables) l'appelle
-- via sb.rpc("gz_resp_people", {p_tid}) au lieu de lire person_roles/people.
create or replace function public.gz_resp_people(p_tid uuid)
returns table(person_id uuid, last_name text, first_name text, named boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.last_name, p.first_name,
         exists(select 1 from gz_managers m where m.tournament_id = p_tid and m.person_id = p.id)
  from people p
  where (is_gz_official(auth.uid()) or is_staff(auth.uid()))
    and ( exists(select 1 from person_roles pr where pr.person_id = p.id and pr.role = 'responsable-tournoi')
          or exists(select 1 from gz_managers m where m.tournament_id = p_tid and m.person_id = p.id) )
  order by p.last_name, p.first_name;
$$;
grant execute on function public.gz_resp_people(uuid) to authenticated, anon;

-- L'ecriture (nommer/retirer) marchait deja : gz_managers a une policy ALL
-- "gz_managers_official" = is_gz_official(auth.uid()).
