// Client Supabase du Player Hub — volontairement autonome : ce dossier est
// publié sur un site Netlify SÉPARÉ, il ne doit dépendre d'aucun fichier du
// site teamlausanne (sinon rien ne se charge).
// La clé publiable est sans danger côté client : la sécurité tient aux règles
// RLS et aux fonctions SECURITY DEFINER (voir db/06_lausanne_open.sql).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const sb = createClient(
  "https://lnrmtwamuaqcubohontn.supabase.co",
  "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK",
  { auth: { persistSession: false } }   // aucun compte ici : pas de session à garder
);
