-- 28.09.2026 : Last scores affiche aussi les jeunes de la nouvelle filière « Privé » (role_periods.role = 'prive').
do $$
declare d text;
begin
  d := pg_get_functiondef('public.last_scores(integer)'::regprocedure);
  if position($q$'sport-etudes','pro-u18','pro'))$q$ in d) = 0 then raise exception 'last_scores : liste des filières introuvable, rien modifié'; end if;
  d := replace(d, $q$'sport-etudes','pro-u18','pro'))$q$, $q$'sport-etudes','pro-u18','pro','prive'))$q$);
  execute d;
end $$;
