// Page publique de réponse à un sondage GameZone.
// URL : sondage.html?s=<survey_id>  (facultatif : &p=<participant_id>&t=<tournament_id>)
import { sb } from "./common.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const surveyId = params.get("s");
const participantId = params.get("p") || null;
const tournamentId = params.get("t") || null;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let questions = [];

async function load() {
  if (!surveyId) { $("sv-wait").textContent = "Lien de sondage invalide."; return; }
  const { data: survey } = await sb.from("gz_surveys").select("*").eq("id", surveyId).eq("active", true).maybeSingle();
  if (!survey) { $("sv-wait").textContent = "Ce sondage n'est plus disponible."; return; }
  const { data: qs } = await sb.from("gz_survey_questions").select("*").eq("survey_id", surveyId).order("position");
  questions = qs || [];
  $("sv-title").textContent = survey.title;
  if (survey.intro) $("sv-intro").textContent = survey.intro; else $("sv-intro").classList.add("hidden");
  $("sv-questions").innerHTML = questions.map((q, i) => {
    let field = "";
    if (q.qtype === "choice") {
      field = (q.options || []).map((o) => `<label class="sv-opt"><input type="radio" name="q${i}" value="${esc(o)}"/> ${esc(o)}</label>`).join("");
    } else if (q.qtype === "rating") {
      field = `<div class="sv-rating">${[1, 2, 3, 4, 5].map((n) => `<label class="sv-opt"><input type="radio" name="q${i}" value="${n}"/> ${n}</label>`).join("")}</div>`;
    } else {
      field = `<textarea name="q${i}" rows="3" style="width:100%;box-sizing:border-box"></textarea>`;
    }
    return `<div class="sv-q"><label class="sv-q-lbl">${esc(q.label)}</label>${field}</div>`;
  }).join("");
  $("sv-wait").classList.add("hidden");
  $("sv-form").classList.remove("hidden");
}

$("sv-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("sv-error"); err.hidden = true;
  const fd = new FormData(e.target);
  const answers = [];
  for (let i = 0; i < questions.length; i++) {
    const v = (fd.get("q" + i) || "").toString().trim();
    if (v) answers.push({ question_id: questions[i].id, value: v });
  }
  if (!answers.length) { err.textContent = "Merci de répondre à au moins une question."; err.hidden = false; return; }
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Envoi…";
  // id généré côté client : l'anonyme ne peut pas relire la réponse (RLS staff)
  const respId = crypto.randomUUID();
  const { error } = await sb.from("gz_survey_responses")
    .insert({ id: respId, survey_id: surveyId, participant_id: participantId, tournament_id: tournamentId });
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; btn.disabled = false; btn.textContent = "Envoyer"; return; }
  const rows = answers.map((a) => ({ ...a, response_id: respId }));
  const { error: e2 } = await sb.from("gz_survey_answers").insert(rows);
  if (e2) { err.textContent = "Erreur : " + e2.message; err.hidden = false; btn.disabled = false; btn.textContent = "Envoyer"; return; }
  $("sv-form").classList.add("hidden");
  $("sv-done").classList.remove("hidden");
});

load();
