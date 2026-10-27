-- 208_prospects_mails_automatiques.sql
-- Prospects › Suivi : la messagerie alimente le suivi toute seule.
--
-- Le constat qui a déclenché ça : sur les seize familles suivies, quatorze
-- avaient déjà un échange de mails dans info@ — 101 messages — et la fiche
-- n'en savait rien. Une famille écrite le matin même affichait encore
-- « dernière interaction : il y a six semaines ».
--
-- Le branchement se fait sur `mail_messages` plutôt que dans le code d'envoi :
-- c'est la table par laquelle TOUT passe, l'envoi depuis la console comme la
-- relève IMAP des réponses. Aucun chemin d'envoi à modifier, et les imports
-- futurs sont couverts d'office.
--
-- Ce que ça fait, et ce que ça ne fait pas :
--   · ça écrit une ligne d'historique et avance « dernière interaction » ;
--   · ça ne touche JAMAIS la prochaine action ni l'étape — c'est Raphaël qui
--     décide quand il relance, pas la boîte mail.

-- Le lien vers le message, pour ne jamais compter un mail deux fois (la
-- relève IMAP peut réimporter, et les sauvetages de boîte rejouent l'historique).
alter table public.prospect_events add column if not exists mail_id uuid;
create unique index if not exists prospect_events_mail on public.prospect_events(mail_id)
  where mail_id is not null;
create index if not exists prospect_followups_email on public.prospect_followups(lower(email))
  where email is not null;

-- L'adresse « d'en face » : le destinataire si on écrit, l'expéditeur si on
-- reçoit. Les en-têtes arrivent sous toutes les formes — « Nom <a@b.ch> »,
-- plusieurs destinataires séparés par des virgules, une virgule en trop à la
-- fin — d'où le nettoyage puis le découpage.
create or replace function public.pf_adresses_du_message(m public.mail_messages)
returns setof text language sql immutable as $$
  select distinct lower(trim(both ' <>' from regexp_replace(a, '^.*<|>.*$', '', 'g')))
  from unnest(string_to_array(
    case when m.direction = 'out'
         then coalesce(m.to_address, '') || ',' || coalesce(m.cc_address, '')
         else coalesce(m.from_address, '') end, ',')) as a
  where trim(a) <> '';
$$;

create or replace function public.pf_lier_mail() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prospect uuid; v_quoi text;
begin
  -- Le sujet suffit à se souvenir de l'échange ; le corps reste dans la
  -- messagerie, où il est lisible en entier.
  v_quoi := case when new.direction = 'out' then 'Envoyé : ' else 'Reçu : ' end
            || coalesce(nullif(trim(new.subject), ''), '(sans objet)');

  for v_prospect in
    select f.id from prospect_followups f
    where f.email is not null
      and lower(f.email) in (select pf_adresses_du_message(new))
  loop
    insert into prospect_events (prospect_id, at, kind, note, mail_id)
    values (v_prospect, coalesce(new.received_at, now()), 'mail', v_quoi, new.id)
    on conflict (mail_id) where mail_id is not null do nothing;

    -- « Dernière interaction » suit le mail le plus récent, jamais en arrière :
    -- un vieux message réimporté ne doit pas faire reculer la fiche.
    update prospect_followups
       set last_contact = greatest(last_contact, coalesce(new.received_at, now())::date),
           updated_at = now()
     where id = v_prospect
       and coalesce(new.received_at, now())::date > last_contact;
  end loop;
  return new;
end;$$;

drop trigger if exists pf_mail_suivi on public.mail_messages;
create trigger pf_mail_suivi after insert on public.mail_messages
  for each row execute function public.pf_lier_mail();

-- --- reprise de l'historique déjà en boîte --------------------------------
insert into prospect_events (prospect_id, at, kind, note, mail_id)
select f.id, m.received_at, 'mail',
       case when m.direction = 'out' then 'Envoyé : ' else 'Reçu : ' end
         || coalesce(nullif(trim(m.subject), ''), '(sans objet)'),
       m.id
from mail_messages m
join prospect_followups f
  on f.email is not null and lower(f.email) in (select pf_adresses_du_message(m))
where not exists (select 1 from prospect_events e where e.mail_id = m.id);

-- Et « dernière interaction » remise à la vérité de la boîte mail.
update prospect_followups f
   set last_contact = greatest(f.last_contact, d.dernier), updated_at = now()
from (select e.prospect_id, max(e.at)::date as dernier
      from prospect_events e where e.mail_id is not null group by e.prospect_id) d
where d.prospect_id = f.id and d.dernier > f.last_contact;
