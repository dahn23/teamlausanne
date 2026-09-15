-- Ajout d'un onglet à une personne précise
--
-- Symétrique du retrait posé en 63_heures_verrou_acces.sql, et pour la même
-- raison : certains outils s'adressent à des PERSONNES plutôt qu'à des
-- fonctions. Le Project Manager en est l'exemple — c'est un tableau d'équipe,
-- pas un droit attaché au métier de head coach.
--
-- Mariano Palena est coach et head coach : aucun de ces rôles n'ouvre le
-- Project Manager, et l'ouvrir au rôle « head_coach » l'aurait donné à tous les
-- head coachs présents et futurs.
--
-- Forme : { "<user_id>": ["pm", …] }  dans app_settings, clé « tab_allow ».
-- Le RETRAIT reste prioritaire sur l'ajout : un onglet présent dans les deux
-- listes reste caché, puisqu'on a voulu l'enlever à quelqu'un.
--
-- Rappel : ces deux listes ne sont qu'un confort d'affichage. Ce qui protège
-- réellement les données, ce sont les contrôles en base (RLS, SECURITY DEFINER).

insert into app_settings (key, value)
select 'tab_allow', jsonb_build_object(u.id::text, jsonb_build_array('pm'))
  from auth.users u where u.email = 'palenamariano@gmail.com'
on conflict (key) do update
  set value = app_settings.value || excluded.value;
