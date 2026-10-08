-- 138 — Garder trace des mails de stage envoyés.
--
-- Les quatre modèles de mails de stage (inscription, rappel_paiement,
-- avant_stage, remerciement) étaient éditables depuis le début mais rien ne
-- les envoyait : ni cron, ni trigger, ni bouton. Vérifié le 07.10.2026 et
-- reconfirmé le 08 — zéro mail parti avec ces objets depuis la mise en
-- service. Les messages de bienvenue aux stages ont tous été écrits à la main.
--
-- Raphael a préparé les PDF le 08.10 (KidsTennis, Loisir journée, Loisir
-- matin) et le stage d'automne commence le 12. On câble donc l'envoi, et il
-- faut d'abord de quoi savoir ce qui est déjà parti.
--
-- Une ligne par inscrit ET par type de mail : c'est ce qui empêche d'envoyer
-- deux fois le même message à la même famille. Sur une liste de huit
-- personnes, un double envoi se voit ; sur soixante, non — et c'est
-- exactement le genre de bêtise qui fait perdre la confiance d'un parent.
--
-- La clé primaire porte la règle : un (inscrit, type) ne peut pas entrer deux
-- fois. Pas de contrainte applicative à maintenir en parallèle.

begin;

create table if not exists public.stage_mail_sent (
  registration_id uuid not null references public.stage_registrations(id) on delete cascade,
  type            text not null,
  sent_at         timestamptz not null default now(),
  sent_by         uuid references auth.users(id),
  to_email        text,
  primary key (registration_id, type)
);

comment on table public.stage_mail_sent is
  'Un mail de stage envoyé, par inscrit et par type. Empêche le double envoi ; sert aussi à afficher qui a déjà reçu quoi.';

alter table public.stage_mail_sent enable row level security;
drop policy if exists sms_staff on public.stage_mail_sent;
create policy sms_staff on public.stage_mail_sent for all
  using (is_staff(auth.uid())) with check (is_staff(auth.uid()));
grant select, insert, delete on public.stage_mail_sent to authenticated;

create index if not exists stage_mail_sent_type_idx on public.stage_mail_sent (type, sent_at desc);

commit;
