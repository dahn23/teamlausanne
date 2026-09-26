-- Dashboard › Derniers messages : texte complet (avant : coupé à 220 caractères) ; la console l'affiche sur
-- 3 lignes avec un « voir plus » par message (26.09.2026). Plafond de sécurité à 4000 caractères.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.dash_notes'::regproc);
  n := replace(d, $r$'body', left(regexp_replace(coalesce(body,''), '\s+', ' ', 'g'), 220)$r$, $r$'body', left(btrim(coalesce(body,'')), 4000)$r$);
  if n = d then raise exception 'dash_notes : motif de coupe introuvable'; end if;
  execute n;
end $$;
