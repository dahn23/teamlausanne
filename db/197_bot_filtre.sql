-- ---------------------------------------------------------------------------
-- L'assistant : marquer les échanges auxquels on a répondu SANS appeler le
-- modèle.
--
-- Pourquoi une colonne et pas une ligne de plus dans `tools` : le plafond du
-- jour compte les messages de visiteurs. Si un plaisantin envoie trois cents
-- émojis, il ferme l'assistant pour tout le monde jusqu'à minuit — sans que
-- ça ait coûté un centime. Il faut donc pouvoir EXCLURE ces messages du
-- comptage, et pour ça il faut un filtre SQL simple.
--
-- `filtre` reste NULL pour un échange normal, et porte le motif sinon
-- (« charabia », « salutation », « remerciement », « insulte »).
-- ---------------------------------------------------------------------------

alter table public.bot_messages
  add column if not exists filtre text;

comment on column public.bot_messages.filtre is
  'Motif du filtre quand la réponse a été donnée sans appeler le modèle (NULL sinon).';

-- Le plafond du jour lit « les messages de visiteurs non filtrés du jour » :
-- un index partiel sur cette question exacte.
create index if not exists bot_msg_vrais
  on public.bot_messages (created_at desc)
  where role = 'user' and filtre is null;
