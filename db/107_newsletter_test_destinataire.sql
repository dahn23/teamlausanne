-- Newsletter : choisir à qui part l'e-mail de test.
--
-- Le bouton « Test » envoyait à l'adresse du compte connecté, sans alternative.
-- Ça marche tant qu'on teste pour soi, mais pas dès qu'on travaille à
-- plusieurs : la secrétaire qui prépare l'envoi veut le faire relire avant de
-- l'expédier à tout le répertoire, et vérifier le rendu sur une autre boîte
-- (Gmail et Outlook ne rendent pas le même HTML).
--
-- Cette fonction alimente les raccourcis « envoyer à » : l'équipe qui a accès à
-- l'outil. En SECURITY DEFINER parce que profiles et user_roles ne sont
-- lisibles que par is_admin() — une secrétaire, qui a pourtant le droit
-- d'utiliser la newsletter, ne verrait rien.
--
-- Le filtre d'accès reprend exactement celui de l'outil (superadmin, admin,
-- secretaire) : cette fonction ne doit pas devenir un annuaire d'adresses pour
-- qui n'a pas déjà le droit d'envoyer.

create or replace function public.newsletter_testeurs()
returns table (nom text, email text)
language sql stable security definer set search_path = public as $$
  select (p.first_name || ' ' || p.last_name)::text, p.email::text
    from user_roles ur
    join profiles pr on pr.user_id = ur.user_id
    join people   p  on p.id = pr.person_id
   where ur.role in ('superadmin','admin','secretaire')
     and p.email is not null and p.email <> ''
     and exists (select 1 from user_roles me
                  where me.user_id = auth.uid()
                    and me.role in ('superadmin','admin','secretaire'))
   group by p.first_name, p.last_name, p.email
   order by 1;
$$;

revoke all on function public.newsletter_testeurs() from public, anon;
grant execute on function public.newsletter_testeurs() to authenticated;
