-- 209_prospects_relance_faite.sql
-- Prospects › Suivi : écrire à une famille coche sa relance.
--
-- db/208 rattachait déjà les mails à la fiche et avançait « dernière
-- interaction ». Mais la PROCHAINE ACTION ne bougeait pas : on écrivait à une
-- famille le matin et la ligne restait « en retard de six semaines » dans
-- « À relancer ». La file ne disait donc plus la vérité, et c'est précisément
-- ce qui fait abandonner un suivi.
--
-- La règle, volontairement prudente :
--   · seulement sur un mail SORTANT (on a écrit) ;
--   · seulement si la relance était DUE à la date du mail — une action prévue
--     plus tard est un plan délibéré, on n'y touche pas ;
--   · seulement sur une fiche encore dans l'entonnoir (ni inscrit, ni perdu,
--     ni archivée) ;
--   · et jamais sur une fiche sans date : « pas de relance prévue » est aussi
--     une décision.
-- La relance est alors reportée d'une semaine, en attente d'une réponse.

create or replace function public.pf_lier_mail() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prospect uuid; v_quoi text; v_jour date; v_sortant boolean;
begin
  v_sortant := (new.direction = 'out');
  v_jour := coalesce(new.received_at, now())::date;
  v_quoi := case when v_sortant then 'Envoyé : ' else 'Reçu : ' end
            || coalesce(nullif(trim(new.subject), ''), '(sans objet)');

  for v_prospect in
    select f.id from prospect_followups f
    where f.email is not null
      and lower(f.email) in (select pf_adresses_du_message(new))
  loop
    insert into prospect_events (prospect_id, at, kind, note, mail_id)
    values (v_prospect, coalesce(new.received_at, now()), 'mail', v_quoi, new.id)
    on conflict (mail_id) where mail_id is not null do nothing;

    update prospect_followups
       set last_contact = greatest(last_contact, v_jour),
           updated_at = now()
     where id = v_prospect
       and v_jour > last_contact;

    -- La relance due vient d'être faite : on la reporte d'une semaine.
    if v_sortant then
      update prospect_followups
         set next_action_at = v_jour + 7,
             next_action = 'Relancer — sans réponse',
             updated_at = now()
       where id = v_prospect
         and not done
         and stage not in ('inscrit', 'perdu')
         and next_action_at is not null
         and next_action_at <= v_jour;
    end if;
  end loop;
  return new;
end;$$;

-- --- rattrapage : les fiches déjà relancées sans que la file le sache ------
update prospect_followups f
   set next_action_at = d.dernier + 7,
       next_action = 'Relancer — sans réponse',
       updated_at = now()
from (
  select e.prospect_id, max(e.at)::date as dernier
  from prospect_events e
  join mail_messages m on m.id = e.mail_id
  where m.direction = 'out'
  group by e.prospect_id
) d
where d.prospect_id = f.id
  and not f.done
  and f.stage not in ('inscrit', 'perdu')
  and f.next_action_at is not null
  and f.next_action_at <= d.dernier;
