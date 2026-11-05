-- 225 — Trois fiches élite marquées inactives alors qu'elles sont bien actives (05.11.2026).
--
-- Repéré en préparant l'envoi des newsletters de lancement de Mon espace :
-- Isabella Stadelmann, Ylan Allenspach et Yuma Olgiati portaient un rôle de filière
-- pour la saison juniors en cours (sport-études / pro) tout en ayant is_active = false.
--
-- Pourquoi ça comptait : newsletter_audience() ne retient que les fiches actives
-- (coalesce(p.is_active, true)). Ces trois jeunes — et leurs parents — auraient donc
-- été écartés de l'envoi SANS AUCUNE ERREUR : une liste plus courte, et rien pour le
-- signaler. Même silence côté my_family_ids : la fiche existe, le rôle existe, mais
-- la personne disparaît des listes.
--
-- Dan confirme qu'ils sont actifs. On remet le drapeau à l'endroit.
-- C'étaient les trois seules fiches dans ce cas pour la saison en cours.

update people
set is_active = true
where id in (
  select p.id
  from people p
  join role_periods rp on rp.person_id = p.id
  join seasons s on s.id = rp.season_id
  where s.kind = 'juniors'
    and current_date between s.start_date and s.end_date
    and p.is_active is not true
);
