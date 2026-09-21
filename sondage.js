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

// Anti double envoi, 30 secondes seulement : le même questionnaire sert chaque week-end, un joueur doit pouvoir
// le re-remplir à chaque tournoi. On bloque juste le doublon immédiat — « page précédente » ou un rechargement
// ré-affichent le formulaire DÉJÀ REMPLI (le navigateur restaure les réponses) et un 2e clic créait un doublon
// (vu le 21.09.2026 : deux réponses identiques à 4 s d'écart). « Répondre à nouveau » lève le blocage tout de suite.
const BLOCK_MS = 30000;
const recentlySent = () => { const t = Date.parse(store.get(DONE_KEY) || ""); return !isNaN(t) && Date.now() - t < BLOCK_MS; };
const DONE_KEY = `sv-done:${surveyId}:${participantId || ""}:${tournamentId || ""}`;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* navigation privée */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch (_) { /* idem */ } } };
let sending = false;

function showDone() {
  $("sv-wait").classList.add("hidden");
  $("sv-form").classList.add("hidden");
  $("sv-done").classList.remove("hidden");
}
$("sv-again").addEventListener("click", (e) => {
  e.preventDefault();
  store.del(DONE_KEY);
  $("sv-form").reset();
  $("sv-form").querySelectorAll(".sv-scale-val").forEach((o) => (o.textContent = "5"));
  const btn = $("sv-form").querySelector("button[type=submit]");
  if (btn) { btn.disabled = false; btn.textContent = "Envoyer"; }
  $("sv-done").classList.add("hidden");
  if (questions.length) $("sv-form").classList.remove("hidden"); else load();
});
// Retour arrière servi depuis le cache du navigateur : la page ne se recharge pas, on revérifie.
window.addEventListener("pageshow", () => { if (recentlySent()) showDone(); });

async function load() {
  if (!surveyId) { $("sv-wait").textContent = "Lien de sondage invalide."; return; }
  if (recentlySent()) { showDone(); return; }
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
    } else if (q.qtype === "scale") {
      field = `<div class="sv-scale"><span>1</span><input type="range" name="q${i}" min="1" max="10" step="1" value="5" oninput="this.nextElementSibling.nextElementSibling.textContent=this.value"/><span>10</span><output class="sv-scale-val">5</output></div>`;
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
  if (sending || recentlySent()) return;
  const err = $("sv-error"); err.hidden = true;
  const fd = new FormData(e.target);
  const answers = [];
  for (let i = 0; i < questions.length; i++) {
    const v = (fd.get("q" + i) || "").toString().trim();
    if (v) answers.push({ question_id: questions[i].id, value: v });
  }
  if (!answers.length) { err.textContent = "Merci de répondre à au moins une question."; err.hidden = false; return; }
  const btn = e.target.querySelector("button[type=submit]");
  sending = true;
  btn.disabled = true; btn.textContent = "Envoi…";
  // id généré côté client : l'anonyme ne peut pas relire la réponse (RLS staff)
  const respId = crypto.randomUUID();
  const { error } = await sb.from("gz_survey_responses")
    .insert({ id: respId, survey_id: surveyId, participant_id: participantId, tournament_id: tournamentId });
  if (error) { sending = false; err.textContent = "Erreur : " + error.message; err.hidden = false; btn.disabled = false; btn.textContent = "Envoyer"; return; }
  const rows = answers.map((a) => ({ ...a, response_id: respId }));
  const { error: e2 } = await sb.from("gz_survey_answers").insert(rows);
  if (e2) { sending = false; err.textContent = "Erreur : " + e2.message; err.hidden = false; btn.disabled = false; btn.textContent = "Envoyer"; return; }
  sending = false;
  store.set(DONE_KEY, new Date().toISOString());
  e.target.reset();   // formulaire vidé : un retour sur la page ne propose plus les mêmes réponses
  $("sv-form").classList.add("hidden");
  $("sv-done").classList.remove("hidden");
});

load();
