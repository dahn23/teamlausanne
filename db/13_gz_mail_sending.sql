-- 13_gz_mail_sending.sql
-- Envoi reel des e-mails GameZone (depuis tournoi@teamlausanne.ch).
-- Hybride : convocations/annulation MANUELLES (boutons "Gerer le tournoi") ;
-- Remerciement + Vainqueur AUTO le lundi (cron). Anti-doublon par gz_mail_sent.

-- Anti-doublon : 1 envoi par (tournoi, participant, modele)
create table if not exists public.gz_mail_sent (
  tournament_id uuid not null references public.gz_tournaments(id) on delete cascade,
  participant_id uuid not null references public.gz_participants(id) on delete cascade,
  template_key text not null,
  email text,
  sent_at timestamptz default now(),
  primary key (tournament_id, participant_id, template_key)
);
alter table public.gz_mail_sent enable row level security;
drop policy if exists gz_mail_sent_official on public.gz_mail_sent;
create policy gz_mail_sent_official on public.gz_mail_sent for all
  using (is_gz_official(auth.uid())) with check (is_gz_official(auth.uid()));

-- Messagerie official limitee a tournoi@ (migration mail_official_tournoi_only) :
--   mail_msg_official / mail_att_official / mail_draft_official / mail_acct_official.
-- Upload images GameZone par les officials (migration gzphotos_official_upload) :
--   gzphotos_write / gzphotos_update / gzphotos_delete = is_staff OR is_gz_official.

-- Edge functions : gz-notify (envoi ; manuel via JWT staff/official, ou cron via CRON_SECRET),
--   mail-send v10 (autorise l'official depuis tournoi@).
-- Cron : gz-mails-lundi = '0 9 * * 1' (lundi ~11h Zurich) -> gz-notify?key=CRON_SECRET
--   -> remerciement + vainqueur pour les tournois des 7 derniers jours.
-- Destinataires : welcome=confirmed ; non_selection=!confirmed ; annulation=tous ;
--   remerciement=presents (gz_player_status.absent<>true) ; vainqueur=is_winner+photo_url.
-- Variables : {prenom} {tournoi} {url_tournoi=registration_url} {code_vestiaire=2848#}
--   {responsables} {lien_tournois} {lien_sondage=sondage.html?s=<survey actif>}.
