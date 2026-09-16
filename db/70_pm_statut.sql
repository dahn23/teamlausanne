-- Point de situation d'une carte du Project Manager
--
-- Distinct de la description, qui dit CE QU'IL FAUT FAIRE et ne bouge guère.
-- Ici, la personne en charge écrit OÙ ELLE EN EST : ce qui avance, ce qui
-- bloque, ce qu'elle attend de quelqu'un d'autre.
--
-- Le texte est remplacé à chaque mise à jour — ce n'est pas un fil de discussion
-- mais l'état courant. D'où la date et l'auteur : « en attente du devis » n'a
-- pas le même sens selon qu'il date d'hier ou d'il y a deux mois.
--
-- La console ne redate que si le texte a VRAIMENT changé : enregistrer la carte
-- pour une autre raison ne doit pas faire paraître le point de situation frais.
alter table public.pm_cards
  add column if not exists status_note text,
  add column if not exists status_at   timestamptz,
  add column if not exists status_by   text;
