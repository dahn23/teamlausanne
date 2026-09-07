-- 49_prospect_description.sql
-- Prospects › Suivi : champ texte libre « description » (après prénom / nom) + import de la liste initiale de Dan.
alter table public.prospect_followups add column if not exists description text;

insert into public.prospect_followups (first_name, last_name, description, email, phone, ranking, status_text, mode)
select * from (values
  ('Benjamin', 'Bourqui', 'Oscar Bourqui', 'benjamin.bourqui@gmail.com', '0033644128559', null, 'Living in France, want to relocate to the region, Oscar plays a lot of tennis', 'surveiller'),
  ('Helena', 'Loureiro', 'N/A', 'hcloureiro@yahoo.com', null, null, 'Living in Brasil, relocation to Switzerland, looking for sport studies programme', 'surveiller'),
  ('Yann', 'Baron', '2 kids - 2016 and 2019', 'yann.baron16@gmail.com', '0033781896392', null, 'Living in France voisine, boys play and love tennis', 'surveiller'),
  ('Hektor', 'Alabre', null, 'marjorie.alabre@gmail.com', '06 42 76 68 30', null, 'Livin in France, sister will join a sport studies in gymnastics', 'surveiller'),
  ('Honeyleen', 'Anhes', 'Fille 15 ans', 'jessica.anhes@gmail.com', '0679752439', null, 'Lives in Morzines', 'surveiller'),
  ('Balthazar', 'Winssinger', 'Garçon 12 ans', 'perine@winssinger.com', '0786628962', null, 'Lives in Corseaux, he loves sailing and tennis.', 'surveiller'),
  ('Mathias', 'Fae', 'Garçon 16 ans', 'dott.cristinafae@gmail.com', '00393387719966', null, 'Lives in Italy, wants international education.', 'surveiller'),
  ('Ming', 'Suriamin', 'Fille 15 ans', 'suriamin.huang@gmail.com', '0014054029008', null, 'Annika is doing 2 weeks with pro programme', 'surveiller'),
  ('Janice', 'Weckherlin', 'Garçon 15 ans', 'jweckherlin@gmail.com', '0796798680', null, 'Timothy is studying and doing tennis every afternoon. Wants to do an exchange for 3 months.', 'surveiller'),
  ('A', 'Meinen', 'Garçon 15 ans', 'a.meinen@bluewin.ch', '0765281221', 'R2', 'Max will do a linguistic exchange at Didac in Lausanne. 28 hours per week of French and English. Max is R2, soon R1. Wants to find a tennis programme while he studies for a year', 'surveiller'),
  ('Ines', 'Czech', 'Fille 15 ans', 'czechines8@gmail.com', '619266260', null, 'French, not much info given, just questions. Wants to start sport-études 2027/28', 'surveiller'),
  ('Lamine', 'Mbow', 'Garçon 10 ans', 'lwandeler@gmail.com', '0795355871', null, 'French, he is young and in Fribourg and wants to do a sport studies programme', 'surveiller'),
  ('Nolan', 'Brigandet', 'Garçon 12 ans', 'philippe.brigandet@sfr.fr', null, null, 'French, want to move to Switzerland', 'surveiller')
) v(first_name, last_name, description, email, phone, ranking, status_text, mode)
where not exists (select 1 from public.prospect_followups p where p.email = v.email and p.first_name = v.first_name);
