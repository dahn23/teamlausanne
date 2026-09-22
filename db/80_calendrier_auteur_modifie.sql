-- Calendrier d'équipe : l'auteur peut modifier ce qu'il a créé.
--
-- Constat : personne, à part un valideur, ne pouvait corriger un événement.
-- La règle disait « l'auteur modifie tant que ce n'est pas validé » —
--     using  (auteur and status <> 'valide')
--     check  (auteur and status  = 'demande')
-- — ce qui marche pour une demande de vacances, mais fermetures, camps,
-- événements et sessions de test naissent DIRECTEMENT en 'valide' : ce sont des
-- faits d'organisation, ils ne passent par aucune validation. Leur auteur se
-- retrouvait donc verrouillé dès l'enregistrement. Sur les treize lignes
-- existantes, toutes en 'valide', aucune n'était modifiable par son auteur.
--
-- Nouvelle règle : l'auteur fait ce qu'il veut de SA ligne, sauf s'il s'agit
-- d'une demande de vacances déjà validée. Deux choses restent ainsi impossibles
-- sans être valideur :
--   · s'auto-valider des vacances (le with check rejette la ligne qui sort en
--     kind='vacances' + status='valide', y compris en changeant le kind après
--     coup) ;
--   · retoucher ou supprimer des vacances déjà accordées, ce qui reviendrait à
--     déplacer un congé approuvé sans le repasser devant personne.
--
-- Le with check reprend la même condition que le using : sans cela on pourrait
-- entrer dans la modification par une ligne autorisée et en sortir une ligne
-- qui ne l'est plus — changer created_by, par exemple.

create or replace function public.cal_ligne_a_moi(p_created_by uuid, p_kind text, p_status text)
returns boolean language sql immutable as $$
  select p_created_by is not null
     and p_created_by = auth.uid()
     and (p_kind <> 'vacances' or p_status = 'demande');
$$;

drop policy if exists cal_modif on public.cal_events;
create policy cal_modif on public.cal_events for update to authenticated
  using       (can_calendrier_valider(auth.uid()) or cal_ligne_a_moi(created_by, kind, status))
  with check  (can_calendrier_valider(auth.uid()) or cal_ligne_a_moi(created_by, kind, status));

drop policy if exists cal_suppr on public.cal_events;
create policy cal_suppr on public.cal_events for delete to authenticated
  using (can_calendrier_valider(auth.uid()) or cal_ligne_a_moi(created_by, kind, status));

revoke all on function public.cal_ligne_a_moi(uuid, text, text) from public, anon;
grant execute on function public.cal_ligne_a_moi(uuid, text, text) to authenticated;
