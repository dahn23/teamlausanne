-- 73_mail_spam.sql
-- Messagerie : les mails que Hostpoint classe dans le dossier « Spam » sont relevés eux aussi, pour qu'un vrai mail
-- mal classé ne reste pas invisible. Ils sont marqués is_spam = true, rangés « traite », lus et sans notification :
-- ils ne comptent donc dans aucune pastille ni aucun délai de traitement. La console les montre sous le filtre « Spam »,
-- avec un bouton « Pas un spam » qui les remet dans « À traiter ».
alter table public.mail_messages add column if not exists is_spam boolean not null default false;
create index if not exists idx_mail_messages_spam on public.mail_messages(account_address) where is_spam;

-- Tableau de bord : les « reçus sur 7 jours » ne comptent pas le spam.
create or replace function public.dash_mail() returns jsonb
language sql stable security definer set search_path to 'public' as $function$
select jsonb_build_object(
 'boxes',(select coalesce(jsonb_agg(jsonb_build_object('label',a.label,'addr',a.address,
     'recv7',(select count(*) from mail_messages m where m.direction='in' and not m.is_spam and m.account_address=a.address and m.received_at>=now()-interval '7 days')
   ) order by a.sort_order),'[]') from mail_accounts a where a.active),
 'a_traiter',(select count(*) from mail_messages where direction='in' and status='a_traiter'),
 'done7',(select coalesce(jsonb_agg(jsonb_build_object('who',who,'traite',traite,'repondu',repondu) order by (traite+repondu) desc),'[]') from (
     select trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) who,
       count(*) filter (where not coalesce(m.replied,false)) traite,
       count(*) filter (where coalesce(m.replied,false)) repondu
     from mail_messages m left join people p on p.id=m.treated_by
     where m.status='traite' and m.treated_at>=now()-interval '7 days' group by 1) s),
 'avg_all_h',(select round((extract(epoch from avg(treated_at-received_at))/3600)::numeric,1) from mail_messages where status='traite' and treated_at is not null and received_at is not null),
 'avg_by',(select coalesce(jsonb_agg(jsonb_build_object('who',who,'hours',hours,'n',n) order by n desc),'[]') from (
     select trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) who,
       round((extract(epoch from avg(m.treated_at-m.received_at))/3600)::numeric,1) hours, count(*) n
     from mail_messages m join people p on p.id=m.assigned_user
     where m.status='traite' and m.treated_at is not null and m.received_at is not null group by 1) t)
);
$function$;

-- Carnet d'adresses (autocomplétion) : on ne propose pas les expéditeurs de spam.
create or replace function public.mail_addressbook() returns table(email text, name text)
language sql stable security definer set search_path to 'public' as $function$
  select lower(addr) as email, max(nm) as name
  from (
    select from_address as addr, from_name as nm
      from mail_messages where direction = 'in' and not is_spam and from_address is not null
    union all
    select trim(x) as addr, null::text as nm
      from mail_messages, unnest(string_to_array(coalesce(to_address, ''), ',')) as x
      where to_address is not null and not is_spam
  ) s
  where (is_staff(auth.uid()) or is_gz_official(auth.uid()))
    and addr ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  group by lower(addr)
  order by 1
  limit 3000;
$function$;
