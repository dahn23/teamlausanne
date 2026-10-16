-- ===================================================================
--  SÉCURITÉ : les vues de facturation respectent enfin la RLS
-- ===================================================================
-- ⚠️ TROU RÉEL, trouvé par les advisors Supabase juste après le déploiement du
-- 16.10.2026, et refermé le même jour.
--
-- Une vue PostgreSQL s'exécute par défaut avec les droits de son PROPRIÉTAIRE,
-- pas de celui qui la lit. Elle traverse donc la RLS des tables qu'elle
-- interroge. `out_invoices` est pourtant verrouillé sur can_billing() : seuls
-- l'administration et le secrétariat voient les factures.
--
-- Or ces cinq vues lisent out_invoices et on leur a accordé SELECT à
-- `authenticated`. Autrement dit, n'importe quel compte connecté — un junior,
-- un parent, un moniteur — pouvait lire le nom, l'adresse e-mail et le solde
-- dû de TOUTES les familles du club, simplement en interrogeant la vue au lieu
-- de la table. Les écrans ne le proposent nulle part, mais la clé publiable et
-- un navigateur suffisaient.
--
-- security_invoker = on fait exécuter la vue avec les droits du LECTEUR : la
-- policy de out_invoices s'applique de nouveau, et un compte sans droits
-- financiers reçoit zéro ligne au lieu de tout.
--
-- Sans effet sur la console : ces vues ne sont lues que depuis les écrans
-- Factures d'admin.js, donc toujours par un compte qui a can_billing(). Rien
-- dans le portail membre (espace.js) ne les touche.
--
-- À RETENIR POUR LA SUITE : toute nouvelle vue posée sur une table protégée
-- par RLS doit naître avec security_invoker = on. C'est l'inverse du réflexe
-- naturel — on croit qu'une vue hérite des protections de ses tables, alors
-- qu'elle les perce.

alter view public.out_relances            set (security_invoker = on);
alter view public.out_relances_a_envoyer  set (security_invoker = on);
alter view public.out_invoices_solde      set (security_invoker = on);
alter view public.out_invoices_coherence  set (security_invoker = on);
