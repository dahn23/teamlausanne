-- 14_survey_scale.sql
-- Type de reponse "scale" (echelle 1-10, curseur) pour les sondages.
-- IMPORTANT : la contrainte CHECK sur qtype interdisait 'scale' -> il fallait l'elargir,
-- sinon aucune question de type echelle ne pouvait etre enregistree.
alter table public.gz_survey_questions drop constraint if exists gz_survey_questions_qtype_check;
alter table public.gz_survey_questions add constraint gz_survey_questions_qtype_check
  check (qtype in ('choice','text','rating','scale'));

-- Front : admin.js addQuestion (type "echelle" -> qtype 'scale'), renderSurveys (label),
-- renderSurveyResults (buckets 1-10 + moyenne) ; sondage.js (curseur range 1-10).
-- Questionnaire de satisfaction GameZone rempli (survey 27adcf7a-...) : intro + 10 questions
-- (7 echelles + 3 champs libres). tag NULL = sondage GameZone (SURVEY_CFG.gamezone.newTag=null).
