-- Formulaire « Nous écrire » → boîte de la console
--
-- Les messages du site étaient écrits dans contact_messages, une table que RIEN
-- ne lit : ni la console, ni un déclencheur, ni une fonction. Tout le dépôt ne
-- contient que des .insert() dessus. Les demandes étaient donc invisibles.
--
-- Chaque message est désormais recopié dans mail_messages, la boîte que la
-- console affiche déjà, où il rejoint les vrais courriels avec le même suivi
-- (statut « à traiter », assignation, réponse). mail-fetch n'écrit que par
-- insertion et ne supprime jamais : ces lignes y sont stables.

create or replace function public.contact_message_vers_messagerie()
returns trigger
language plpgsql
security definer                 -- le visiteur est anon : il n'écrit pas dans mail_messages
set search_path = public
as $$
begin
  insert into mail_messages (
    account_address, direction, from_name, from_address, to_address,
    subject, snippet, body_text, received_at, is_read, status
  ) values (
    'info@teamlausanne.ch', 'in', new.name, new.email, 'info@teamlausanne.ch',
    'Site — ' || new.source,
    left(regexp_replace(coalesce(new.message, ''), '\s+', ' ', 'g'), 140),
    coalesce(new.message, '(aucun message)')
      || E'\n\n—\nFormulaire « Nous écrire » du site · ' || new.source
      || E'\nRépondre à : ' || new.name || ' <' || new.email || '>',
    new.created_at, false, 'a_traiter'
  );
  return new;
exception when others then
  -- Un échec de recopie ne doit jamais faire perdre son message au visiteur :
  -- la ligne reste dans contact_messages, qui garde tout.
  return new;
end;
$$;

drop trigger if exists contact_message_messagerie on public.contact_messages;
create trigger contact_message_messagerie
after insert on public.contact_messages
for each row execute function public.contact_message_vers_messagerie();
