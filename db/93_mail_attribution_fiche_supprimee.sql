-- Garde-fou messagerie (23.09.2026) : un mail ne doit jamais rester attribué à une
-- fiche qui n'existe plus (la console affichait « Attribué · ? »).
-- Quand une fiche du répertoire est supprimée :
--   * ses mails « attribués » repassent en « À traiter » (assigned_user vidé) ;
--   * ses mails « traités » gardent leur statut mais perdent le nom du traitant.

create or replace function public.mail_detach_deleted_person()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update mail_messages
     set assigned_user = null,
         status = case when status = 'en_cours' then 'a_traiter' else status end
   where assigned_user = old.id;
  update mail_messages set treated_by = null where treated_by = old.id;
  return old;
end $$;

drop trigger if exists trg_mail_detach_deleted_person on public.people;
create trigger trg_mail_detach_deleted_person
  before delete on public.people
  for each row execute function public.mail_detach_deleted_person();

-- Même règle appliquée aux fantômes déjà présents (2 mails des 1er et 2 septembre 2026).
update mail_messages m
   set assigned_user = null,
       status = case when m.status = 'en_cours' then 'a_traiter' else m.status end
 where m.assigned_user is not null
   and not exists (select 1 from people p where p.id = m.assigned_user);
update mail_messages m set treated_by = null
 where m.treated_by is not null
   and not exists (select 1 from people p where p.id = m.treated_by);
