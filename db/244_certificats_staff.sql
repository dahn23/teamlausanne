-- 244 — Certificats et formations du staff (fiche › onglet « Certificats »)
--
-- Besoin : garder la trace des diplômes et formations des moniteurs, coachs et
-- profs (Swiss Tennis, J+S, BLS-AED…), avec le justificatif scanné (PDF, JPEG, PNG).
--
-- Qui y a accès : exactement la population du Répertoire, `can_membres`
-- (superadmin, admin, secrétaire, head coach). On réutilise ce helper au lieu
-- d'en écrire un nouveau : l'onglet vit DANS le Répertoire, les deux ne peuvent
-- donc pas divergir. Un coach ne voit pas ses propres certificats — il n'a pas
-- l'onglet Répertoire, une policy « self » serait une porte sans pièce derrière.
--
-- ⚠ Les policies de STOCKAGE doivent suivre la même garde que la table : restreindre
-- la table seule laisserait les fichiers téléchargeables par chemin (leçon des
-- buckets `physique` et `mental`).

create table if not exists public.staff_certificates (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.people(id) on delete cascade,
  title         text not null,                 -- « Coach C Swiss Tennis », « BLS-AED »…
  issuer        text,                           -- organisme : Swiss Tennis, J+S, SRC…
  obtained_on   date,
  expires_on    date,                           -- null = sans échéance (diplôme acquis)
  note          text,
  storage_path  text,                           -- bucket `certificats` : <person_id>/<uuid>.<ext>
  file_name     text,
  mime          text,
  size_bytes    bigint,
  created_at    timestamptz not null default now(),
  created_by    uuid
);

create index if not exists staff_certificates_person_idx
  on public.staff_certificates (person_id, expires_on nulls last, obtained_on desc);

alter table public.staff_certificates enable row level security;

drop policy if exists sc_membres on public.staff_certificates;
create policy sc_membres on public.staff_certificates
  for all to authenticated
  using (can_membres(auth.uid()))
  with check (can_membres(auth.uid()));

-- ---- Bucket privé ----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificats', 'certificats', false, 15728640,
        array['application/pdf','image/jpeg','image/png','image/heic','image/heif','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists certificats_membres on storage.objects;
create policy certificats_membres on storage.objects
  for all to authenticated
  using (bucket_id = 'certificats' and can_membres(auth.uid()))
  with check (bucket_id = 'certificats' and can_membres(auth.uid()));
