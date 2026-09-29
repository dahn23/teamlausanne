-- 120 — Berti Murina quitte le sport-études.
--
-- Décision de Raphael : Berti arrête le programme. Son père est facturé pour
-- le PREMIER MOIS seulement, pas deux.
--
-- Situation avant :
--   2026-0066  6 560.–  « échéances 1-2/10 (double) »  ENVOYÉE le 24.09, impayée
--   2026-0067 … 2026-0074  8 × 3 280.–  à envoyer
--   Contrat : 32 800.– / 10 mensualités, 31.08.2026 → 02.07.2027
--
-- Aucune écriture bancaire n'est importée à ce jour : rien n'est encaissé,
-- on peut donc annuler proprement plutôt que d'émettre un avoir.
--
-- On ANNULE (on ne supprime pas : une facture envoyée doit rester traçable)
-- et on émet une facture neuve de 3 280.– que Raphael enverra depuis la console.
-- pdf_path reste NULL : oiAssurerPdf() fabrique le PDF au premier envoi, donc
-- il portera bien le bon montant (piège déjà rencontré sur la facture Picci).

begin;

-- ---------------------------------------------------------------- facturation

-- 1. La facture double déjà partie chez le père.
update out_invoices
   set status = 'annulee',
       note   = coalesce(note || E'\n', '')
             || 'Annulée le 29.09.2026 : Berti quitte le sport-études. '
             || 'Remplacée par la facture 2026-0312 (1er mois seul, 3 280.–).'
 where number = '2026-0066';

-- 2. Les huit échéances suivantes, jamais envoyées.
update out_invoices
   set status = 'annulee',
       note   = coalesce(note || E'\n', '')
             || 'Annulée le 29.09.2026 : fin du contrat sport-études de Berti Murina.'
 where number between '2026-0067' and '2026-0074'
   and person_id = '059658fe-9527-493b-9908-eb0607aa110a';

-- 3. La facture de remplacement : le premier mois, du 31.08 au 30.09.2026.
--    Numéro et référence RF calculés comme le fait la console
--    (out_invoice_next_number + oiScor), vérifiés contre les factures existantes.
insert into out_invoices (
  number, season_id, filiere, person_id,
  debtor_name, debtor_street, debtor_zip, debtor_city, debtor_email,
  label, instalment_no, instalment_total, amount, currency,
  issue_date, due_date, reference, account_id, status, items, note
) values (
  '2026-0312',
  'dcae97a4-2877-428e-b19c-9fb5797d4b89',
  'sport-etudes',
  '059658fe-9527-493b-9908-eb0607aa110a',
  'Valon Morina', 'Chemin des Grands Bonnets 20', '1293', 'Bellevue',
  'valon.morina1983@icloud.com',
  'Sport-études 2026/27 — 1er mois (31.08 – 30.09.2026) — Berti Murina',
  1, 1, 3280.00, 'CHF',
  '2026-09-29', '2026-10-29',
  'RF7320260312',
  'a41769c2-4f18-4066-bc2d-81e4c033d020',
  'a_envoyer',
  '[{"label":"Sport-études 2026/27 — 1er mois (31.08 – 30.09.2026) — Berti Murina","amount":3280}]'::jsonb,
  'Remplace la facture 2026-0066 (6 560.–, deux mois), annulée. '
  || 'Berti a quitté le programme : seul le premier mois est dû.'
);

-- ------------------------------------------------------- sortie de l'académie

-- 4. La filière de la saison : c'est elle qui fait apparaître un jeune dans
--    Études, Repas, Mental, Physique et les listes de facturation. On la retire.
delete from role_periods
 where person_id = '059658fe-9527-493b-9908-eb0607aa110a'
   and season_id = 'dcae97a4-2877-428e-b19c-9fb5797d4b89';

-- 5. Le contrat.
delete from player_contracts
 where person_id = '059658fe-9527-493b-9908-eb0607aa110a';

-- 6. Les cours à venir (les cours passés restent : ils ont eu lieu).
delete from course_participants cp
 using courses c
 where c.id = cp.course_id
   and cp.child_person_id = '059658fe-9527-493b-9908-eb0607aa110a'
   and c.course_date >= current_date;

delete from attendance a
 using courses c
 where c.id = a.course_id
   and a.person_id = '059658fe-9527-493b-9908-eb0607aa110a'
   and c.course_date >= current_date;

delete from course_segment_players sp
 using course_segments s, courses c
 where s.id = sp.segment_id and c.id = s.course_id
   and sp.person_id = '059658fe-9527-493b-9908-eb0607aa110a'
   and c.course_date >= current_date;

-- 7. Les journées d'études encore à venir (pré-remplies jusqu'en juin 2027).
--    Les 19 journées déjà passées restent : elles justifient le mois facturé.
delete from etudes_attendance a
 using etudes_days d
 where d.id = a.day_id
   and a.youth_person_id = '059658fe-9527-493b-9908-eb0607aa110a'
   and d.day >= current_date;

-- 8. Les routines de prépa physique qui lui étaient attribuées.
delete from phys_routine_assign
 where person_id = '059658fe-9527-493b-9908-eb0607aa110a';

-- 9. La fiche est désactivée, pas supprimée : la facture et l'historique
--    comptable doivent rester rattachés à quelqu'un.
update people
   set is_active = false,
       notes = coalesce(notes || E'\n', '')
            || 'A quitté le sport-études et Team Lausanne Academy le 29.09.2026. '
            || 'Facturé pour le 1er mois uniquement (facture 2026-0312).'
 where id = '059658fe-9527-493b-9908-eb0607aa110a';

commit;
