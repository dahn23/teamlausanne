// Client Supabase du site du Club — volontairement autonome : ce dossier est
// publié sur un site Netlify SÉPARÉ (base directory = « club »), il ne doit
// dépendre d'aucun fichier de la racine, sinon rien ne se charge.
// Il ne sert qu'au formulaire de contact : la clé publiable est sans danger
// côté client, la sécurité tient à la RLS de contact_messages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const sb = createClient(
  "https://lnrmtwamuaqcubohontn.supabase.co",
  "sb_publishable_nsRKXBFgwmDjtmvS3mFc0w_Q4pi_qxK",
  { auth: { persistSession: false } }   // aucun compte ici : pas de session à garder
);
