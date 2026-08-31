// Console admin — CRM membres (accès staff uniquement).
import { sb, getSession, myRoles, hasAny, STAFF_ROLES, frDate, frDateTime, jours } from "./common.js";
import "./pretty-select.js";
import "./pretty-date.js";

const $ = (id) => document.getElementById(id);
// Petite coupe SVG (remplace l'emoji 🏆 dans les tableaux)
const ICO_CUP = '<svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-1px" fill="none" stroke="#c8901f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4z"/><path d="M8 5.5H5V7a3 3 0 0 0 3 3M16 5.5h3V7a3 3 0 0 1-3 3"/><path d="M10 13.5V16h4v-2.5M8 20h8M12 16v4"/></svg>';
// Modal maison (remplace alert/confirm natifs) : fond blanc, contour bleu, icône warning bleue.
function uiModal(message, opts = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "ui-modal";
    const ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2L2 20.5h20L12 3.2z"/><path d="M12 9.5v4.6"/><circle cx="12" cy="17.4" r=".7" fill="currentColor" stroke="none"/></svg>';
    ov.innerHTML = `<div class="ui-box"><div class="ui-ico">${ico}</div><p class="ui-msg">${esc(message).replace(/\n/g, "<br>")}</p><div class="ui-actions">${opts.confirm ? '<button type="button" class="ui-btn ui-no">Non</button><button type="button" class="ui-btn ui-yes">Oui</button>' : '<button type="button" class="ui-btn ui-yes">OK</button>'}</div></div>`;
    document.body.appendChild(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    ov.querySelector(".ui-yes").addEventListener("click", () => done(true));
    const no = ov.querySelector(".ui-no"); if (no) no.addEventListener("click", () => done(false));
    ov.addEventListener("click", (e) => { if (e.target === ov) done(false); });
    ov.querySelector(".ui-yes").focus();
  });
}
const uiAlert = (m) => uiModal(m);
const uiConfirm = (m) => uiModal(m, { confirm: true });
// Saisie stylée (remplace prompt natif) : renvoie la valeur, ou null si annulé.
function uiPrompt(message, def = "") {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "ui-modal";
    const ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
    ov.innerHTML = `<div class="ui-box"><div class="ui-ico">${ico}</div><p class="ui-msg">${esc(message).replace(/\n/g, "<br>")}</p><input type="text" class="ui-input" /><div class="ui-actions"><button type="button" class="ui-btn ui-no">Annuler</button><button type="button" class="ui-btn ui-yes">OK</button></div></div>`;
    document.body.appendChild(ov);
    const inp = ov.querySelector(".ui-input"); inp.value = def == null ? "" : String(def);
    const done = (v) => { ov.remove(); resolve(v); };
    ov.querySelector(".ui-yes").addEventListener("click", () => done(inp.value));
    ov.querySelector(".ui-no").addEventListener("click", () => done(null));
    ov.addEventListener("click", (e) => { if (e.target === ov) done(null); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); done(inp.value); } });
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  });
}
window.prompt = () => { throw new Error("prompt natif désactivé — utilise uiPrompt"); };
// Homogénéise : tous les alert natifs passent par le modal bleu ; les confirmations deviennent await uiConfirm.
window.alert = (m) => { uiModal(String(m)); };
let people = [];
let meId = null;
let myAppRoles = [];
let meEmail = null;
let meName = null;
let myPersonId = null;
let isGzManager = false;         // responsable d'au moins un tournoi non clôturé
const pad2 = (n) => String(n).padStart(2, "0");
// Rôles qui donnent accès à la console (staff + rôles à onglet dédié).
// Un responsable de tournoi (rôle « responsable ») n'est pas staff mais a droit
// à l'onglet GameZone (limité à ses tournois — voir RLS gz_manages).
const CONSOLE_ROLES = [...STAFF_ROLES, "prof", "coach_mental", "organisateur", "responsable"];

// ---- Garde d'accès : connecté + rôle staff ----
// Accès direct à /admin sans session → on affiche un formulaire de connexion
// (pas de redirection vers l'accueil).
const session = await getSession();
if (!session) {
  $("loader").classList.add("hidden");
  $("admin-login").classList.remove("hidden");
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("login-error"); err.hidden = true; $("login-btn").disabled = true;
    const { error } = await sb.auth.signInWithPassword({
      email: $("email").value.trim(), password: $("password").value });
    $("login-btn").disabled = false;
    if (error) { err.textContent = "Connexion impossible : " + error.message; err.hidden = false; return; }
    // Un membre/parent/jeune qui se connecte ici part sur son espace, pas d'« accès refusé ».
    const roles = await myRoles();
    let ok = hasAny(roles, CONSOLE_ROLES);
    if (!ok) { try { ok = (await sb.rpc("gz_is_manager")) === true; } catch (_) {} }
    if (ok) location.reload();
    else location.href = "espace.html";
  });
} else {
  $("who").textContent = session.user.email;
  const roles = await myRoles();
  // « Responsable de tournoi » = être nommé responsable d'un tournoi NON clôturé
  // (table gz_managers). Ça ouvre l'accès GameZone (limité à ses tournois),
  // sans rôle app à attribuer : une seule et même notion.
  try {
    const { data: gzMgr } = await sb.rpc("gz_is_manager");
    isGzManager = gzMgr === true;
  } catch (_) {}
  $("loader").classList.add("hidden");
  if (!hasAny(roles, CONSOLE_ROLES) && !isGzManager) {
    // Connecté mais pas staff → on l'envoie sur son espace membre plutôt qu'un mur « accès refusé ».
    location.href = "espace.html";
  } else {
    $("console").classList.remove("hidden");
    // Entête selon le rôle : « Console » pour l'admin, « Espace coach/prof/mental » pour l'encadrement.
    const brand = $("brand-role");
    if (brand) brand.textContent =
      hasAny(roles, ["superadmin", "admin", "secretaire"]) ? "Console"
      : hasAny(roles, ["head_coach", "coach", "coach_physique", "moniteur"]) ? "Espace coach"
      : roles.includes("prof") ? "Espace prof"
      : roles.includes("coach_mental") ? "Espace mental"
      : "Console";
    meId = session.user.id;
    meEmail = session.user.email;
    meName = meEmail;
    try {
      const { data: prof } = await sb.from("profiles").select("person_id").eq("user_id", meId).maybeSingle();
      if (prof?.person_id) {
        myPersonId = prof.person_id;
        const { data: me } = await sb.from("people").select("first_name,last_name").eq("id", prof.person_id).maybeSingle();
        if (me) meName = `${me.first_name || ""} ${me.last_name || ""}`.trim() || meEmail;
      }
    } catch (_) {}
    // Barre du haut : le nom cliquable ouvre « Mon profil ».
    $("who").textContent = meName;
    $("who").addEventListener("click", openMyProfile);
    $("me-close").addEventListener("click", () => $("me-modal").classList.add("hidden"));
    $("me-modal").addEventListener("click", (e) => { if (e.target === $("me-modal")) $("me-modal").classList.add("hidden"); });
    init(roles);
  }
}

// ---- Mon profil (staff connecté) : fiche lecture seule ouverte depuis la barre ----
const ME_ROLE_LABELS = {
  superadmin: "Superadmin", admin: "Admin", secretaire: "Secrétaire", head_coach: "Head coach",
  coach: "Coach", coach_physique: "Coach physique", moniteur: "Moniteur", prof: "Prof", coach_mental: "Coach mental", organisateur: "Official",
  responsable: "Responsable tournoi", membre: "Membre", junior: "Junior", parent: "Parent",
};
const ME_FIELDS = [
  { k: "email", lbl: "Email", type: "email" },
  { k: "phone", lbl: "Téléphone", type: "tel" },
  { k: "avs", lbl: "N° AVS", type: "text" },
  { k: "birthdate", lbl: "Naissance", type: "date", disp: (v) => frDate(v) },
  { k: "license_no", lbl: "Licence", type: "text" },
  { k: "address", lbl: "Adresse", type: "text" },
  { k: "postal_code", lbl: "NPA", type: "text" },
  { k: "city", lbl: "Ville", type: "text" },
  { k: "iban", lbl: "IBAN", type: "text" },
];
async function openMyProfile() {
  if (!myPersonId) { alert("Ton compte n'est pas relié à une fiche."); return; }
  let p = people.find((x) => x.id === myPersonId);
  if (!p) { const { data } = await sb.from("people").select("*").eq("id", myPersonId).maybeSingle(); p = data; }
  if (!p) { alert("Fiche introuvable."); return; }
  // Tous les roles : roles d'ACCES (user_roles) + tags CRM (person_roles, dont
  // « responsable-tournoi » qui n'est pas un role d'acces). Chacun peut lire ses
  // propres tags (policy pr_read_self) meme s'il n'est pas staff (ex. official).
  const { data: prt } = await sb.from("person_roles").select("role").eq("person_id", myPersonId);
  const myTags = (prt || []).map((r) => r.role);
  const roles = [...new Set([...[...new Set(myAppRoles)].map((r) => ME_ROLE_LABELS[r] || r), ...myTags.map((r) => roleLabel(r))])];
  const inits = (((p.first_name || "")[0] || "") + ((p.last_name || "")[0] || "")).toUpperCase();
  // Pas de licence pour les non-joueurs : prof, official (organisateur), responsable de tournoi.
  const noLicense = myAppRoles.includes("prof") || myAppRoles.includes("organisateur") || myTags.includes("responsable-tournoi");
  const fields = ME_FIELDS.filter((f) => !(f.k === "license_no" && noLicense));
  const hasEmpty = fields.some((f) => !p[f.k]);  // au moins une info à compléter ?
  const rows = fields.map((f) => {
    const val = p[f.k];
    // Champ vide → éditable (le staff peut le compléter) ; champ rempli → verrouillé.
    if (!val) return `<div class="me-row edit"><span>${f.lbl}</span><input id="me-f-${f.k}" type="${f.type}" placeholder="À compléter" /></div>`;
    return `<div class="me-row"><span>${f.lbl}</span><b>${esc(f.disp ? f.disp(val) : val)}</b></div>`;
  }).join("");
  const foot = hasEmpty
    ? `<p class="muted" style="font-size:.82rem;margin:14px 0 10px">Complète les infos manquantes puis enregistre. Les infos déjà renseignées sont verrouillées — pour les corriger, contacte le secrétariat.</p>
       <div class="me-actions"><button type="button" id="me-save">Enregistrer</button><span id="me-status" class="muted"></span></div>`
    : `<p class="muted" style="font-size:.82rem;margin:14px 0 0">Toutes tes infos sont renseignées. Pour corriger une information, contacte le secrétariat.</p>`;
  $("me-body").innerHTML = `
    <div class="me-head">
      <div class="me-av">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="">` : esc(inits)}</div>
      <div><h2>${esc(p.first_name || "")} ${esc(p.last_name || "")}</h2>
        <div class="me-roles">${roles.map((r) => `<span class="me-role">${esc(r)}</span>`).join("")}</div></div>
    </div>
    <div class="me-grid">${rows}</div>
    ${foot}
    <div class="me-pw">
      <h3>Mot de passe</h3>
      <div class="me-pw-row">
        <input type="password" id="me-pw-input" placeholder="Nouveau mot de passe (min. 6)" autocomplete="new-password" />
        <button type="button" id="me-pw-btn">Changer</button>
      </div>
      <span id="me-pw-status" class="muted" style="font-size:.85rem"></span>
    </div>`;
  if (hasEmpty) $("me-save").addEventListener("click", saveMyProfile);
  $("me-pw-btn").addEventListener("click", changeMyPassword);
  $("me-modal").classList.remove("hidden");
}
async function changeMyPassword() {
  const inp = $("me-pw-input"), st = $("me-pw-status"), btn = $("me-pw-btn");
  const pw = inp.value;
  if (pw.length < 6) { st.textContent = "6 caractères minimum."; return; }
  btn.disabled = true; st.textContent = "Changement…";
  const { error } = await sb.auth.updateUser({ password: pw });
  btn.disabled = false;
  if (error) { st.textContent = "Erreur : " + error.message; return; }
  inp.value = ""; st.textContent = "✓ Mot de passe changé";
}
async function saveMyProfile() {
  const payload = {};
  ME_FIELDS.forEach((f) => { const el = document.getElementById("me-f-" + f.k); if (el) payload[f.k] = el.value.trim(); });
  const btn = $("me-save"); btn.disabled = true;
  $("me-status").textContent = "Enregistrement…";
  const { error } = await sb.rpc("confirm_my_profile", { p_data: payload });
  if (error) { btn.disabled = false; $("me-status").textContent = "Erreur : " + error.message; return; }
  const { data } = await sb.from("people").select("*").eq("id", myPersonId).maybeSingle();
  if (data) { const i = people.findIndex((x) => x.id === myPersonId); if (i >= 0) people[i] = data; else people.push(data); }
  openMyProfile();
}

// Accès aux onglets par rôle (défense en profondeur : la RLS protège déjà
// les écritures en base ; ceci masque l'UI selon le rôle).
const DEFAULT_TAB_ACCESS = {
  superadmin: ["membres", "anniv", "inscriptions", "prospects", "news", "mail", "roles", "resa", "cours", "matchs", "phystests", "etudes", "mental", "csel", "gamezone", "caisse", "heures", "locks", "irrigation", "stages", "stats"],
  admin:      ["membres", "anniv", "inscriptions", "prospects", "news", "mail", "roles", "resa", "cours", "matchs", "phystests", "etudes", "mental", "csel", "gamezone", "caisse", "heures", "locks", "irrigation", "stages", "stats"],
  secretaire: ["membres", "anniv", "inscriptions", "news", "mail", "resa", "cours", "caisse", "locks", "irrigation", "stages", "stats"],
  head_coach: ["anniv", "resa", "cours", "matchs", "phystests", "mental", "stages", "prospects", "heures"],
  coach:      ["cours", "matchs", "phystests", "heures"],
  coach_physique: ["cours", "phystests", "heures"],
  moniteur:   ["cours", "heures"],
  prof:       ["etudes"],
  coach_mental: ["mental", "heures"],
  organisateur: ["gamezone", "mail"],
  responsable:  ["gamezone"],
};
const ADMIN_TABS = [["membres", "Répertoire"], ["inscriptions", "Inscriptions"], ["prospects", "Prospects"], ["news", "News"], ["mail", "Messagerie"], ["roles", "Réglages"], ["resa", "Réserv."], ["cours", "Cours"], ["matchs", "Feuille de match"], ["phystests", "Tests phys."], ["anniv", "Anniversaires"], ["etudes", "Études"], ["mental", "Mental"], ["csel", "CSEL"], ["gamezone", "GameZone"], ["caisse", "Caisse"], ["heures", "Heures"], ["locks", "Serrures"], ["irrigation", "Arrosage"], ["stages", "Stages"], ["stats", "Stats"]];
// NB : « Responsable de tournoi » n'est PAS un rôle app ici — c'est le tag CRM
// « responsable-tournoi » + la nomination sur un tournoi (gz_managers) qui ouvre
// l'accès GameZone automatiquement. Une seule notion, gérée dans la fiche.
const ROLE_LIST = [["superadmin", "Superadmin"], ["admin", "Admin"], ["secretaire", "Secrétaire"], ["head_coach", "Head coach"], ["coach", "Coach"], ["coach_physique", "Coach physique"], ["moniteur", "Moniteur"], ["prof", "Prof"], ["coach_mental", "Coach mental"], ["organisateur", "Official"]];
const ASSIGNABLE_ROLES = ["superadmin", "admin", "secretaire", "head_coach", "coach", "coach_physique", "moniteur", "prof", "coach_mental", "membre", "organisateur"];
// Rôles/tags d'une personne (cumulables) — pilotent filtres + onglets de la fiche.
const PERSON_ROLES = [
  ["membre", "Membre"], ["client", "Client"], ["coach", "Coach"], ["coach-prive", "Coach avec autorisation"],
  ["head-coach", "Head coach"], ["official", "Official"], ["responsable-tournoi", "Responsable de tournoi"],
  ["kidstennis", "KidsTennis"], ["club", "Club"], ["competition", "Compétition"], ["performance", "Performance"],
  ["sport-etudes", "Sport-études"], ["pro-u18", "Pro U18"], ["pro", "Pro"],
  ["prof", "Prof"], ["coach-mental", "Coach mental"], ["coach_physique", "Coach physique"], ["moniteur", "Moniteur"], ["secretaire", "Secrétaire"], ["finance", "Finance"], ["admin", "Admin"], ["superadmin", "Superadmin"],
];
const roleLabel = (r) => (PERSON_ROLES.find(([v]) => v === r) || [r, r])[1];

// ---- Rôles saisonniers (source de vérité = table role_periods, par saison) ----
const SEASONAL_COTISATION = ["membre"];
const SEASONAL_JUNIORS = ["kidstennis", "club", "competition", "performance", "sport-etudes", "pro-u18", "pro"];
const SEASONAL_ROLES = [...SEASONAL_COTISATION, ...SEASONAL_JUNIORS];
const seasonTypeOf = (role) => SEASONAL_COTISATION.includes(role) ? "cotisation" : SEASONAL_JUNIORS.includes(role) ? "juniors" : null;
const INTENTS = [["reste", "Reste"], ["monte", "Monte"], ["descend", "Descend"], ["part", "Part"], ["a-decider", "À décider"]];
const intentLabel = (v) => (INTENTS.find(([x]) => x === v) || ["", "—"])[1];
// Saisons = table `seasons` (créées explicitement dans Réglages › Saisons).
let seasons = [];
async function loadSeasonsList() {
  const { data } = await sb.from("seasons").select("*").order("start_date", { ascending: false });
  seasons = data || [];
}
const seasonsOf = (kind) => seasons.filter((s) => s.kind === kind);
function currentSeason(kind) {
  // Date LOCALE (Europe/Zurich pour Dan) et non UTC, sinon la bascule de saison
  // se ferait ~2 h après minuit local près d'une frontière de saison.
  const n = new Date();
  const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  const list = seasonsOf(kind);
  return list.find((s) => s.start_date <= today && today <= s.end_date)
    || list.filter((s) => s.start_date <= today)[0] || null; // list est triée desc
}

let peopleRoles = {};            // person_id -> [role,…]
const activeFilters = new Set(); // filtres rôle actifs

const tabAccessMap = () => settings.tab_access || DEFAULT_TAB_ACCESS;

function applyTabAccess(roles) {
  const access = tabAccessMap();
  // Onglets déjà configurés dans le réglage stocké (toutes rôles confondus).
  // Un onglet NON connu (nouveau module) retombe sur l'accès par défaut,
  // pour apparaître sans devoir re-régler la matrice à chaque ajout.
  const known = new Set(Object.values(access).flat());
  const allowedFor = (v) => roles.some((r) =>
    (known.has(v) ? (access[r] || []) : (DEFAULT_TAB_ACCESS[r] || [])).includes(v));
  let first = null;
  document.querySelectorAll(".side-item[data-view]").forEach((b) => {
    const v = b.dataset.view;
    if (v === "bientot") return;
    const allowed = allowedFor(v) || (v === "gamezone" && isGzManager);
    b.classList.toggle("hidden", !allowed);
    if (allowed && !first) first = v;
  });
  // Masquer un bloc entier si aucun de ses onglets n'est visible (pas de trait orphelin).
  document.querySelectorAll(".side-block").forEach((bl) => {
    const anyVisible = [...bl.querySelectorAll(".side-item[data-view]")]
      .some((b) => b.dataset.view !== "bientot" && !b.classList.contains("hidden"));
    bl.classList.toggle("hidden", !anyVisible);
  });
  // Le menu ET le contenu n'apparaissent qu'une fois la bonne vue choisie
  // (évite le flash de la vue Répertoire par défaut avant l'aiguillage par rôle).
  if (first) showView(first);
  document.querySelector(".side")?.classList.add("ready");
  document.querySelector(".admin-main")?.classList.add("ready");
}

async function init(roles) {
  myAppRoles = roles || [];
  $("logout").addEventListener("click", async () => {
    if (!(await uiConfirm("Êtes-vous sûr de vouloir vous déconnecter ?"))) return;
    await sb.auth.signOut();
    location.href = "/";
  });
  // Barre latérale repliable (icônes seules), mémorisée ; repliée par défaut sur mobile
  const sideEl = document.querySelector(".side");
  const isMobile = () => window.matchMedia("(max-width:600px)").matches;
  let sideStored = null; try { sideStored = localStorage.getItem("sideCollapsed"); } catch (_) {}
  if (sideStored === "1" || (sideStored === null && isMobile())) sideEl.classList.add("collapsed");
  $("side-toggle").addEventListener("click", () => {
    sideEl.classList.toggle("collapsed");
    try { localStorage.setItem("sideCollapsed", sideEl.classList.contains("collapsed") ? "1" : "0"); } catch (_) {}
  });
  // Sur mobile, choisir un onglet referme le menu (overlay)
  sideEl.addEventListener("click", (e) => { if (e.target.closest(".side-item") && isMobile()) sideEl.classList.add("collapsed"); });
  $("new-person").addEventListener("click", () => openPerson(null));
  $("import-people").addEventListener("click", openImport);
  $("import-close").addEventListener("click", () => $("import-modal").classList.add("hidden"));
  $("import-modal").addEventListener("click", (e) => { if (e.target === $("import-modal")) $("import-modal").classList.add("hidden"); });
  $("import-template").addEventListener("click", downloadTemplate);
  $("import-file-btn").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", onImportFile);
  $("import-confirm").addEventListener("click", confirmImport);
  // La fiche s'affiche en pleine page : on déplace le <form> dans #people-detail
  $("people-detail").appendChild($("person-form"));
  $("close-person").addEventListener("click", closePerson);
  $("person-form").addEventListener("submit", savePerson);
  $("delete-person").addEventListener("click", deletePerson);
  $("invite-person").addEventListener("click", invitePerson);
  $("autofill-lic").addEventListener("click", autofillLicenses);
  $("find-lic-mt").addEventListener("click", findLicensesMt);
  $("cr-add").addEventListener("click", addCoachRate);
  $("p-license").addEventListener("input", updateLicHint);
  $("p-birth").addEventListener("input", updateLicHint);
  $("fam-add-btn").addEventListener("click", addFamily);
  $("cr-add-btn").addEventListener("click", rechargeCredit);
  document.querySelectorAll("#p-tabs .ptab").forEach((b) =>
    b.addEventListener("click", () => setPersonTab(b.dataset.ptab)));
  $("pc-season").addEventListener("change", renderPersonContract);
  $("obj-add-btn").addEventListener("click", addObjective);
  $("ss-cot-add").addEventListener("click", () => addSeasonRole("cotisation", "membre"));
  $("ss-jun-add").addEventListener("click", () => addSeasonRole("juniors", $("ss-jun-role").value));
  $("media-btn").addEventListener("click", () => $("media-file").click());
  $("media-file").addEventListener("change", (e) => uploadMedia(e.target));
  $("pp-fill").addEventListener("click", () => openPhysFillFor($("p-id").value));
  $("p-photo-btn").addEventListener("click", () => $("p-photo-file").click());
  $("p-photo-file").addEventListener("change", () => uploadPersonPhoto($("p-photo-file")));
  $("search").addEventListener("input", () => { $("search-clear").hidden = !$("search").value; renderRows(); });
  $("search-clear").addEventListener("click", () => { $("search").value = ""; $("search-clear").hidden = true; renderRows(); $("search").focus(); });
  document.querySelectorAll(".side-item[data-view]").forEach((b) =>
    b.addEventListener("click", () => showView(b.dataset.view)));
  $("rg-save").addEventListener("click", saveSettings);
  $("gz-mov-add").addEventListener("click", addMovement);
  initNews();
  await loadSettings();
  await loadPeople();            // AVANT le 1er showView : sinon la vue par défaut (ex. Études d'un prof) s'affiche avant que `people` soit chargé
  applyTabAccess(roles);
  loadMtBookmarklet();
  initResa(roles);
  initStats();
  initRoles();
  initCours(roles);
  initGameZone(roles);
  initStages();
  initPhys();
  initEtudes();
  initMental();
  initMatchs(roles);
}

// ---- Bascule de vues ----
function showView(view) {
  if (view === "bientot") return;
  // Toujours revenir à la liste : referme les fiches pleine page ouvertes
  closePerson();
  if ($("prosp-detail")) closeProspect();
  document.querySelectorAll(".side-item[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) =>
    v.classList.toggle("hidden", v.id !== "view-" + view));
  if (view === "caisse") loadCaisseTab();
  if (view === "stages") loadStagesTab();
  if (view === "phystests") loadPhysResults();
  if (view === "etudes") loadEtudesCalendar();
  if (view === "csel") loadCsel();
  if (view === "anniv") loadBirthdays();
  if (view === "mail") loadMail();
  if (view === "mental") loadMentalCalendar();
  if (view === "matchs") mrActivateFirst();
  if (view === "news") loadNews();
  if (view === "inscriptions") loadInscriptions();
  if (view === "prospects") loadProspects();
  if (view === "heures") loadHeures();
  if (view === "locks") loadLocks();
  if (view === "irrigation") loadIrrigation();
}

// ===================================================================
//  Réglages (app_settings)
// ===================================================================
let settings = {};
const PRICE_ZONES = [["hiver", "Hiver (bulle + halle)"], ["ete_ext", "Été (extérieurs)"], ["ete_halle", "Été (halle)"]];
const PRICE_CATS = [["m_m", "M/M"], ["second", "2ᵉ h"], ["m_guest", "M/invité"], ["ext", "Externe"]];

async function loadSettings() {
  const { data } = await sb.from("app_settings").select("key,value");
  settings = {};
  for (const r of data || []) settings[r.key] = r.value;

  const s = settings.season || {};
  $("rg-winter-start").value = s.winter_start || "";
  $("rg-winter-end").value = s.winter_end || "";
  updateWeeks();
  $("rg-winter-start").addEventListener("change", updateWeeks);
  $("rg-winter-end").addEventListener("change", updateWeeks);

  const q = settings.quotas || {};
  $("rg-max-m").value = q.max_hours_member ?? 2;
  $("rg-max-nm").value = q.max_hours_nonmember ?? 2;
  $("rg-max-coach").value = q.max_hours_coach == null ? "" : q.max_hours_coach;
  $("rg-inv").value = q.invitations_per_season_member ?? 2;
  $("rg-adv-m").value = q.advance_days_member ?? 7;
  $("rg-adv-nm").value = q.advance_days_nonmember ?? 2;
  $("rg-adv-coach").value = q.advance_days_coach ?? 14;

  const v = settings.visibility || {};
  $("rg-names-member").checked = v.show_names_to_member ?? true;
  $("rg-names-client").checked = v.show_names_to_client ?? false;

  const m = settings.confirmation_email || {};
  $("rg-mail-subject").value = m.subject || "";
  $("rg-mail-body").value = m.body || "";

  renderPricing();
}

function updateWeeks() {
  const a = $("rg-winter-start").value, b = $("rg-winter-end").value;
  if (!a || !b) { $("rg-weeks").textContent = ""; return; }
  const days = (new Date(b) - new Date(a)) / 86400000;
  const weeks = Math.round(days / 7 * 10) / 10;
  $("rg-weeks").textContent = days > 0 ? `≈ ${weeks} semaines` : "dates invalides";
}

function renderPricing() {
  const p = settings.pricing || {};
  let html = '<table class="crm-table"><thead><tr><th>Zone</th><th>Tarif</th>' +
    PRICE_CATS.map(([, l]) => `<th>${l}</th>`).join("") + "</tr></thead><tbody>";
  for (const [zk, zl] of PRICE_ZONES) {
    for (const rk of ["creuse", "pleine"]) {
      html += `<tr><td>${rk === "creuse" ? zl : ""}</td><td>${rk === "creuse" ? "Creuse" : "Pleine"}</td>` +
        PRICE_CATS.map(([ck]) =>
          `<td><input type="number" class="rg-price" data-z="${zk}" data-r="${rk}" data-c="${ck}" min="0"
            value="${p?.[zk]?.[rk]?.[ck] ?? 0}" style="width:64px" /></td>`).join("") + "</tr>";
    }
  }
  $("rg-pricing").innerHTML = html + "</tbody></table>";
}

async function saveSettings() {
  const pricing = {};
  for (const [zk] of PRICE_ZONES) { pricing[zk] = { creuse: {}, pleine: {} }; }
  document.querySelectorAll(".rg-price").forEach((i) => {
    pricing[i.dataset.z][i.dataset.r][i.dataset.c] = Number(i.value);
  });
  const rows = [
    { key: "season", value: { winter_start: $("rg-winter-start").value, winter_end: $("rg-winter-end").value } },
    { key: "quotas", value: {
      max_hours_member: Number($("rg-max-m").value), max_hours_nonmember: Number($("rg-max-nm").value),
      max_hours_coach: $("rg-max-coach").value === "" ? null : Number($("rg-max-coach").value),
      invitations_per_season_member: Number($("rg-inv").value),
      advance_days_member: Number($("rg-adv-m").value), advance_days_nonmember: Number($("rg-adv-nm").value),
      advance_days_coach: Number($("rg-adv-coach").value) } },
    { key: "visibility", value: { show_names_to_member: $("rg-names-member").checked, show_names_to_client: $("rg-names-client").checked } },
    { key: "confirmation_email", value: { subject: $("rg-mail-subject").value, body: $("rg-mail-body").value } },
    { key: "pricing", value: pricing },
  ];
  $("rg-status").textContent = "Enregistrement…";
  const { error } = await sb.from("app_settings").upsert(rows, { onConflict: "key" });
  $("rg-status").textContent = error ? "Erreur : " + error.message : "✓ Réglages enregistrés";
}

// ===================================================================
//  Réservations (staff) — grille, création/édition, récurrence
// ===================================================================
let resaCourts = [];      // courts affichés (selon saison de la date)
let resaCourtsAll = [];   // tous les courts actifs (pour le select)
let resaLabels = [];
let drag = null;

const isoA = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function seasonA(iso) {
  const s = settings.season || { winter_start: "2026-10-19", winter_end: "2027-04-11" };
  const md = (d) => Number(d.slice(5, 7)) * 100 + Number(d.slice(8, 10));
  const x = md(iso), a = md(s.winter_start), b = md(s.winter_end);
  return (x >= a || x <= b) ? "hiver" : "ete";
}

async function initResa(roles) {
  // Sous-onglets Jour / Réglages ; les Réglages sont réservés aux admins.
  const isAdminUser = (roles || []).some((r) => ["superadmin", "admin"].includes(r));
  if (!isAdminUser) document.querySelector('#view-resa .resa-subtab[data-sub="reglages"]')?.classList.add("hidden");
  document.querySelectorAll("#view-resa .resa-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-resa .resa-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-resa .resa-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "resa-sub-" + b.dataset.sub));
    }));

  const { data } = await sb.from("courts").select("*").eq("is_active", true).order("display_order");
  resaCourtsAll = data || [];
  // Réservation (console) : vrais courts saisonniers + « Fitness » (visible toute l'année pour les cours physiques).
  $("r-court").innerHTML = resaCourtsAll.filter((c) => c.open_summer || c.open_winter || isFitnessCourt(c)).map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  $("r-start").innerHTML = Array.from({ length: 14 }, (_, i) => i + 8)
    .map((h) => `<option value="${h}">${pad2(h)}:15</option>`).join("");
  await loadResaLabels();

  $("resa-date").value = isoA(new Date());
  $("resa-date").addEventListener("change", loadResaDay);
  $("resa-prev").addEventListener("click", () => shiftResa(-1));
  $("resa-next").addEventListener("click", () => shiftResa(1));
  $("resa-today").addEventListener("click", () => { $("resa-date").value = isoA(new Date()); loadResaDay(); });
  $("resa-close").addEventListener("click", closeResa);
  $("resa-modal").addEventListener("click", (e) => { if (e.target === $("resa-modal")) closeResa(); });
  $("resa-form").addEventListener("submit", saveResa);
  $("r-del-occ").addEventListener("click", deleteOccurrence);
  $("r-del-series").addEventListener("click", deleteSeries);
  document.addEventListener("mouseup", endDrag);
  loadResaDay();
}

async function loadResaLabels() {
  const { data } = await sb.from("booking_labels").select("*").order("name");
  resaLabels = data || [];
  $("label-list").innerHTML = resaLabels.map((l) => `<option value="${esc(l.name)}">`).join("");
}

function shiftResa(delta) {
  const d = new Date($("resa-date").value + "T00:00:00");
  d.setDate(d.getDate() + delta);
  $("resa-date").value = isoA(d);
  loadResaDay();
}

async function loadResaDay() {
  const date = $("resa-date").value;
  const season = seasonA(date);
  const sunIco = '<svg class="season-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7"/></svg>';
  const snowIco = '<svg class="season-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M3.4 7l17.2 10M20.6 7L3.4 17"/><path d="M12 5l-2.2 2.2M12 5l2.2 2.2M12 19l-2.2-2.2M12 19l2.2 2.2"/></svg>';
  $("resa-season").innerHTML = season === "ete" ? sunIco + "Été" : snowIco + "Hiver";
  const col = season === "ete" ? "open_summer" : "open_winter";
  resaCourts = resaCourtsAll.filter((c) => c[col] || isFitnessCourt(c));
  const { data: bookings } = await sb.from("court_bookings").select("*").eq("booking_date", date);
  // Pour les cours : coachs (affichés à la place du type) + couleur du TYPE (source de vérité, pas la couleur figée à l'enregistrement)
  const courseIds = [...new Set((bookings || []).filter((b) => b.course_id).map((b) => b.course_id))];
  const coachMap = {}, colorMap = {};
  if (courseIds.length) {
    const [{ data: cc }, { data: crs }] = await Promise.all([
      sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", courseIds),
      sb.from("courses").select("id,color,course_types(color)").in("id", courseIds),
    ]);
    for (const x of cc || []) (coachMap[x.course_id] = coachMap[x.course_id] || []).push(x.coach_person_id);
    for (const c of crs || []) colorMap[c.id] = c.course_types?.color || c.color || null;
  }
  drawResaGrid(date, bookings || [], coachMap, colorMap);
}

function drawResaGrid(date, bookings, coachMap = {}, colorMap = {}) {
  const grid = $("resa-grid");
  grid.style.gridTemplateColumns = `64px repeat(${resaCourts.length}, minmax(74px,1fr))`;
  grid.innerHTML = "";
  grid.appendChild(rcell("", "rcell corner"));
  for (const c of resaCourts) {
    const el = document.createElement("div");
    el.className = "rcell rhead " + surfaceClass(c.surface);
    const isCourt = /^court\s/i.test(c.name);
    const n = c.name.replace(/^Court\s*/i, "");
    el.innerHTML = isCourt
      ? `<span class="cn-full">Court&nbsp;${n}</span><span class="cn-short">${n}</span>`
      : `<span class="cn-full">${esc(c.name)}</span><span class="cn-short">${esc(c.name)}</span>`;
    el.title = `${c.name} · ${c.surface}`;
    grid.appendChild(el);
  }

  for (let h = 8; h <= 21; h++) {
    grid.appendChild(rcell(pad2(h) + ":15", "rcell rhour"));
    for (const c of resaCourts) {
      const slotStart = pad2(h) + ":15:00", slotEnd = pad2(h + 1) + ":15:00";
      const b = bookings.find((x) => x.court_id === c.id && x.start_time < slotEnd && x.end_time > slotStart);
      const el = document.createElement("div");
      el.className = "rcell rslot";
      if (b) {
        el.style.background = (b.course_id && colorMap[b.course_id]) || b.color || "#1e3ad1";
        el.style.color = "#fff";
        // Pour un cours : nom du/des coach(s) (le type est déjà donné par la couleur)
        const cids = b.course_id ? (coachMap[b.course_id] || []) : [];
        let label, full;
        if (cids.length) {
          const p0 = people.find((x) => x.id === cids[0]);
          label = (p0 ? p0.last_name : "Coach") + (cids.length > 1 ? ` +${cids.length - 1}` : "");
          full = cids.map((id) => personName(id)).join(", ");
        } else {
          label = b.title || kindLabel(b.kind);
          full = label;
        }
        el.textContent = label;
        el.title = full + (b.recurrence_id ? " · série" : "");
        el.addEventListener("click", () => editBooking(b, h));
      } else {
        el.classList.add("rfree");
        el.dataset.court = c.id;
        el.dataset.hour = h;
        el.addEventListener("mousedown", (e) => { e.preventDefault(); startDrag(c.id, h); });
        el.addEventListener("mouseover", () => overDrag(c.id, h));
      }
      grid.appendChild(el);
    }
  }
}

const isFitnessCourt = (c) => /fitness/i.test(c?.name || "");
const kindLabel = (k) => ({ cours: "Cours", tournoi: "Tournoi", maintenance: "Maintenance", libre: "Réservé" }[k] || "Réservé");
function rcell(text, cls) { const el = document.createElement("div"); el.className = cls; el.textContent = text; return el; }
function surfaceClass(s) { return /terre/i.test(s) ? "sfc-terre" : /gazon|synth/i.test(s) ? "sfc-gazon" : "sfc-dur"; }

// ---- Sélection à la souris ----
function startDrag(court, h) { drag = { court, h1: h, h2: h }; paintDrag(); }
function overDrag(court, h) { if (drag && drag.court === court) { drag.h2 = h; paintDrag(); } }
function paintDrag() {
  document.querySelectorAll("#resa-grid .rslot.sel").forEach((e) => e.classList.remove("sel"));
  if (!drag) return;
  const lo = Math.min(drag.h1, drag.h2), hi = Math.max(drag.h1, drag.h2);
  document.querySelectorAll(`#resa-grid .rslot[data-court="${drag.court}"]`).forEach((e) => {
    const h = Number(e.dataset.hour);
    if (h >= lo && h <= hi) e.classList.add("sel");
  });
}
function endDrag() {
  if (!drag) return;
  const lo = Math.min(drag.h1, drag.h2), hi = Math.max(drag.h1, drag.h2);
  const court = drag.court;
  drag = null;
  document.querySelectorAll("#resa-grid .rslot.sel").forEach((e) => e.classList.remove("sel"));
  openResaCreate(court, lo, hi - lo + 1);
}

// ---- Création / édition ----
function openResaCreate(courtId, hour, dur) {
  $("r-error").hidden = true;
  $("resa-title").textContent = "Nouvelle réservation";
  $("r-id").value = ""; $("r-recid").value = "";
  $("r-name").value = ""; $("r-kind").value = "cours";
  $("r-court").value = courtId ?? resaCourtsAll[0]?.id;
  $("r-date").value = $("resa-date").value;
  $("r-start").value = hour ?? 8;
  $("r-dur").value = dur ?? 1;
  $("r-color").value = "#1e3ad1";
  $("r-rec").checked = false; $("r-until").value = "";
  $("r-del-occ").classList.add("hidden");
  $("r-del-series").classList.add("hidden");
  $("resa-modal").classList.remove("hidden");
}

function editBooking(b, hour) {
  // Un cours : on ouvre l'éditeur de cours complet (coachs, élèves, présences)
  if (b.course_id && isCourseMgr) { editCourse(b.course_id); return; }
  $("r-error").hidden = true;
  $("resa-title").textContent = "Modifier la réservation";
  $("r-id").value = b.id; $("r-recid").value = b.recurrence_id || "";
  $("r-name").value = b.title || "";
  $("r-kind").value = b.kind || "cours";
  $("r-court").value = b.court_id;
  $("r-date").value = b.booking_date;
  $("r-start").value = Number(b.start_time.slice(0, 2));
  $("r-dur").value = Number(b.end_time.slice(0, 2)) - Number(b.start_time.slice(0, 2));
  $("r-color").value = b.color || "#1e3ad1";
  $("r-rec").checked = false; $("r-until").value = "";
  $("r-del-occ").classList.remove("hidden");
  $("r-del-series").classList.toggle("hidden", !b.recurrence_id);
  $("resa-modal").classList.remove("hidden");
}

function closeResa() { $("resa-modal").classList.add("hidden"); }

async function saveResa(e) {
  e.preventDefault();
  const err = $("r-error"); err.hidden = true;
  const name = $("r-name").value.trim();
  const kind = $("r-kind").value;
  const courtId = Number($("r-court").value);
  const date = $("r-date").value;
  const startH = Number($("r-start").value);
  const dur = Number($("r-dur").value);
  const color = $("r-color").value;
  if (startH + dur > 22) return failR(err, "La durée dépasse la fin de journée (22:15 max).");

  const base = {
    court_id: courtId, start_time: pad2(startH) + ":15:00", end_time: pad2(startH + dur) + ":15:00",
    kind, title: name || null, color, created_by: meId,
  };

  const id = $("r-id").value;
  if (id) {
    const { error } = await sb.from("court_bookings").update({ ...base, booking_date: date }).eq("id", id);
    if (error) return failR(err, error.message);
  } else if ($("r-rec").checked && $("r-until").value) {
    const recId = crypto.randomUUID();
    let d = new Date(date + "T00:00:00");
    const end = new Date($("r-until").value + "T00:00:00");
    let ok = 0, conflicts = 0;
    while (d <= end) {
      const { error } = await sb.from("court_bookings").insert({ ...base, booking_date: isoA(d), recurrence_id: recId });
      if (error) conflicts++; else ok++;
      d.setDate(d.getDate() + 7);
    }
    if (ok === 0) return failR(err, "Aucune date libre pour cette série.");
    if (conflicts) alert(`${ok} créneaux créés, ${conflicts} déjà occupés (ignorés).`);
  } else {
    const { error } = await sb.from("court_bookings").insert({ ...base, booking_date: date });
    if (error) return failR(err, error.code === "23P01" ? "Ce créneau est déjà pris." : error.message);
  }

  if (name && !resaLabels.some((l) => l.name === name)) {
    await sb.from("booking_labels").insert({ name, color });
    await loadResaLabels();
  }
  closeResa();
  loadResaDay();
}

async function deleteOccurrence() {
  const id = $("r-id").value;
  if (!id || !await uiConfirm("Supprimer cette réservation ?")) return;
  await sb.from("court_bookings").delete().eq("id", id);
  closeResa(); loadResaDay();
}
async function deleteSeries() {
  const rec = $("r-recid").value;
  if (!rec || !await uiConfirm("Supprimer TOUTE la série récurrente ?")) return;
  await sb.from("court_bookings").delete().eq("recurrence_id", rec);
  closeResa(); loadResaDay();
}
function failR(el, msg) { el.textContent = msg; el.hidden = false; }

// ===================================================================
//  Statistiques
// ===================================================================
const WD = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function initStats() {
  const today = isoA(new Date());
  $("st-to").value = today;
  $("st-from").value = today.slice(0, 4) + "-01-01";
  $("st-refresh").addEventListener("click", loadStats);
  $("st-all").addEventListener("click", () => { $("st-from").value = "2026-01-01"; loadStats(); });
  loadStats();
}

function weekKey(iso) {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7;              // 0 = lundi
  d.setDate(d.getDate() - day + 3);              // jeudi de la semaine ISO
  const firstThu = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-S${pad2(week)}`;
}

async function loadStats() {
  const from = $("st-from").value, to = $("st-to").value;
  const { data } = await sb.from("court_bookings").select("*")
    .gte("booking_date", from).lte("booking_date", to);
  const bookings = data || [];
  $("st-empty").hidden = bookings.length > 0;

  const hoursOf = (b) => Number(b.end_time.slice(0, 2)) - Number(b.start_time.slice(0, 2));
  const players = { m_m: 0, m_guest: 0, ext: 0, club: 0, autre: 0 };
  const byCourt = {}, byHour = {}, byWeekday = {}, byWeek = {}, byDayChf = {};
  let totalHours = 0, totalChf = 0;

  for (const b of bookings) {
    const h = hoursOf(b); totalHours += h;
    totalChf += Number(b.price_chf || 0);
    if (["cours", "tournoi", "maintenance"].includes(b.kind)) players.club += h;
    else if (b.payer_category === "m_m") players.m_m += h;
    else if (b.payer_category === "m_guest") players.m_guest += h;
    else if (b.payer_category === "ext") players.ext += h;
    else players.autre += h;
    byCourt[b.court_id] = (byCourt[b.court_id] || 0) + h;
    const sh = Number(b.start_time.slice(0, 2));
    for (let k = 0; k < h; k++) byHour[sh + k] = (byHour[sh + k] || 0) + 1;
    const wd = ((new Date(b.booking_date + "T00:00:00").getDay()) + 6) % 7 + 1;
    byWeekday[wd] = (byWeekday[wd] || 0) + h;
    const wk = weekKey(b.booking_date); byWeek[wk] = (byWeek[wk] || 0) + h;
    byDayChf[b.booking_date] = (byDayChf[b.booking_date] || 0) + Number(b.price_chf || 0);
  }

  // taux d'occupation sur la période
  let available = 0;
  const d0 = new Date(from + "T00:00:00"), d1 = new Date(to + "T00:00:00");
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    const iso = isoA(d), season = seasonA(iso), col = season === "ete" ? "open_summer" : "open_winter";
    available += resaCourtsAll.filter((c) => c[col]).length * 14;
  }
  const occ = available ? Math.round(totalHours / available * 100) : 0;

  // KPI
  $("st-kpis").innerHTML =
    kpi("Réservations", bookings.length) + kpi("Heures jouées", totalHours) +
    kpi("Recettes", totalChf.toFixed(0) + " CHF") + kpi("Taux d'occupation", occ + " %");

  // Type de joueur
  const pl = [["Membre / membre", players.m_m], ["Membre + invité", players.m_guest],
    ["Non-membre", players.ext], ["Club (cours, tournois…)", players.club]];
  if (players.autre) pl.push(["Autre", players.autre]);
  $("st-players").innerHTML = barsFrom(pl, "h");

  // Occupation par court
  const courtRows = resaCourtsAll.map((c) => [c.name, byCourt[c.id] || 0]);
  $("st-courts").innerHTML = barsFrom(courtRows, "h");

  // Par heure
  const hourRows = [];
  for (let hh = 8; hh <= 21; hh++) hourRows.push([pad2(hh) + "h", byHour[hh] || 0]);
  $("st-hours").innerHTML = barsFrom(hourRows, "");

  // Par jour de semaine
  const wdRows = [];
  for (let w = 1; w <= 7; w++) wdRows.push([WD[w], byWeekday[w] || 0]);
  $("st-weekdays").innerHTML = barsFrom(wdRows, "h");

  // Recettes par jour (les 14 derniers jours non nuls)
  const revRows = Object.entries(byDayChf).sort().slice(-14).map(([d, v]) => [d.slice(5), v.toFixed(0)]);
  $("st-revenue").innerHTML = revRows.length ? barsFrom(revRows, " CHF") : '<p class="muted">—</p>';

  // Semaine la plus demandée
  const top = Object.entries(byWeek).sort((a, b) => b[1] - a[1])[0];
  $("st-topweek").innerHTML = top
    ? `<b>${top[0]}</b><span>${top[1]} heures réservées</span>`
    : '<span class="muted">—</span>';
}

function kpi(label, val) {
  return `<div class="kpi"><b>${val}</b><span>${label}</span></div>`;
}
function barsFrom(rows, suffix) {
  const max = Math.max(1, ...rows.map((r) => Number(r[1])));
  return rows.map(([label, val]) =>
    `<div class="bar-row"><span class="bar-label">${label}</span>
      <div class="bar"><div class="bar-fill" style="width:${Math.round(Number(val) / max * 100)}%"></div></div>
      <span class="bar-val">${val}${suffix}</span></div>`).join("");
}

// ===================================================================
//  Rôles & accès
// ===================================================================
function initRoles() {
  renderAccessMatrix();
  $("access-save").addEventListener("click", saveAccess);
  loadAccounts();
  document.querySelectorAll("#view-roles .rg-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-roles .rg-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-roles .rg-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "rg-sub-" + b.dataset.sub));
      if (b.dataset.sub === "seasons") loadSeasonsManage();
    }));
  $("rg-cot-add").addEventListener("click", () => addRoleSeason("cotisation"));
  $("rg-jun-add").addEventListener("click", () => addRoleSeason("juniors"));
  $("bsc-load").addEventListener("click", bscLoad);
  $("bsc-apply").addEventListener("click", bscApply);
}

async function loadSeasonsManage() {
  await loadSeasonsList();
  const render = (kind, containerId) => {
    const cur = currentSeason(kind);
    const list = seasonsOf(kind);
    $(containerId).innerHTML = list.length ? list.map((s) => `
      <div class="rg-season-row${cur && s.id === cur.id ? " ss-cur" : ""}" data-id="${s.id}">
        <input class="rgs-label" value="${esc(s.label)}" />
        <input type="date" class="rgs-start" value="${s.start_date}" />
        <span class="rgs-arrow">→</span>
        <input type="date" class="rgs-end" value="${s.end_date}" />
        ${cur && s.id === cur.id ? '<span class="ss-tag ss-ok">en cours</span>' : ""}
        <button type="button" class="ghost rgs-save">Enregistrer</button>
        <button type="button" class="fam-del rgs-del">✕</button>
      </div>`).join("") : '<p class="muted" style="font-size:.85rem">Aucune saison.</p>';
    $(containerId).querySelectorAll(".rg-season-row").forEach((row) => {
      row.querySelector(".rgs-save").addEventListener("click", () => saveRoleSeason(row));
      row.querySelector(".rgs-del").addEventListener("click", () => delRoleSeason(row.dataset.id));
    });
  };
  render("cotisation", "rg-cot-seasons");
  render("juniors", "rg-jun-seasons");
  // Selects de la bascule
  const allOpts = seasons.map((s) => `<option value="${s.id}">${esc(s.label)} · ${s.kind}</option>`).join("");
  $("bsc-src").innerHTML = allOpts; $("bsc-tgt").innerHTML = allOpts;
  $("bsc-list").innerHTML = ""; $("bsc-foot").classList.add("hidden");
}

async function bscLoad() {
  const src = seasons.find((s) => s.id === $("bsc-src").value), tgt = seasons.find((s) => s.id === $("bsc-tgt").value);
  if (!src || !tgt) return;
  if (src.id === tgt.id) { alert("Choisis deux saisons différentes."); return; }
  if (src.kind !== tgt.kind) { alert("Les deux saisons doivent être du même type (cotisation ou juniors)."); return; }
  const { data } = await sb.from("role_periods").select("*, people(id,first_name,last_name)").eq("season_id", src.id);
  const rows = (data || []).filter((r) => r.people);
  if (!rows.length) { $("bsc-list").innerHTML = '<p class="muted" style="font-size:.85rem">Personne dans cette saison.</p>'; $("bsc-foot").classList.add("hidden"); return; }
  const isJun = src.kind === "juniors";
  $("bsc-list").innerHTML = `<div class="table-wrap"><table class="crm-table"><thead><tr><th></th><th>Personne</th><th>Actuel</th><th>Intention</th><th>${isJun ? "Filière cible" : "Rôle"}</th></tr></thead><tbody>`
    + rows.map((r) => {
      const carry = r.next_intent !== "part";
      const roleCell = isJun
        ? `<select class="bsc-role">${SEASONAL_JUNIORS.map((x) => `<option value="${x}"${x === r.role ? " selected" : ""}>${esc(roleLabel(x))}</option>`).join("")}</select>`
        : "Membre";
      return `<tr data-person="${r.people.id}" data-role="${r.role}">
        <td><input type="checkbox" class="bsc-chk"${carry ? " checked" : ""}/></td>
        <td>${esc(r.people.last_name)} ${esc(r.people.first_name)}</td>
        <td>${esc(roleLabel(r.role))}</td>
        <td>${r.next_intent ? intentLabel(r.next_intent) : "—"}</td>
        <td>${roleCell}</td></tr>`;
    }).join("") + "</tbody></table></div>";
  $("bsc-foot").classList.remove("hidden");
  $("bsc-status").textContent = "";
  $("bsc-apply").dataset.tgt = tgt.id; $("bsc-apply").dataset.kind = src.kind;
}

async function bscApply() {
  const tgtId = $("bsc-apply").dataset.tgt, kind = $("bsc-apply").dataset.kind;
  if (!tgtId) return;
  const rows = [...$("bsc-list").querySelectorAll("tbody tr")].filter((tr) => tr.querySelector(".bsc-chk").checked);
  if (!rows.length) { alert("Personne à reconduire (coche au moins un)."); return; }
  const btn = $("bsc-apply"); btn.disabled = true; $("bsc-status").textContent = "…";
  const inserts = rows.map((tr) => ({
    person_id: tr.dataset.person, season_id: tgtId, created_by: meId,
    role: kind === "juniors" ? tr.querySelector(".bsc-role").value : "membre",
    ...(kind === "cotisation" ? { paid: false } : {}),
  }));
  const { error } = await sb.from("role_periods").upsert(inserts, { onConflict: "person_id,role,season_id", ignoreDuplicates: true });
  btn.disabled = false;
  if (error) { $("bsc-status").textContent = "Erreur : " + error.message; return; }
  $("bsc-status").textContent = `✓ ${inserts.length} personne(s) reconduite(s) vers la nouvelle saison.`;
  loadPeople();
}
async function addRoleSeason(kind) {
  const p = kind === "cotisation" ? "cot" : "jun";
  const label = $(`rg-${p}-label`).value.trim();
  const start = $(`rg-${p}-start`).value, end = $(`rg-${p}-end`).value;
  if (!label || !start || !end) { alert("Étiquette + date de début + date de fin obligatoires."); return; }
  if (end < start) { alert("La date de fin précède le début."); return; }
  const { error } = await sb.from("seasons").insert({ kind, label, start_date: start, end_date: end });
  if (error) { alert(error.message); return; }
  $(`rg-${p}-label`).value = ""; $(`rg-${p}-start`).value = ""; $(`rg-${p}-end`).value = "";
  loadSeasonsManage();
  loadPeople();
}
async function saveRoleSeason(row) {
  const patch = {
    label: row.querySelector(".rgs-label").value.trim(),
    start_date: row.querySelector(".rgs-start").value,
    end_date: row.querySelector(".rgs-end").value,
  };
  if (!patch.label || !patch.start_date || !patch.end_date) { alert("Champs obligatoires."); return; }
  const btn = row.querySelector(".rgs-save"); btn.textContent = "…";
  const { error } = await sb.from("seasons").update(patch).eq("id", row.dataset.id);
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  if (!error) { await loadSeasonsList(); loadPeople(); }
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}
async function delRoleSeason(id) {
  if (!await uiConfirm("Supprimer cette saison ? (les affectations de cette saison seront aussi supprimées)")) return;
  const { error } = await sb.from("seasons").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  loadSeasonsManage();
  loadPeople();
}

function renderAccessMatrix() {
  const access = tabAccessMap();
  // Même logique que applyTabAccess : un onglet absent de la matrice stockée
  // (module récent) retombe sur l'accès PAR DÉFAUT — sinon les cases s'afficheraient
  // décochées et un « Enregistrer » verrouillerait ces onglets pour tout le monde.
  const known = new Set(Object.values(access).flat());
  const isOn = (rk, tk) =>
    (known.has(tk) ? (access[rk] || []) : (DEFAULT_TAB_ACCESS[rk] || [])).includes(tk);
  let html = '<table class="crm-table"><thead><tr><th>Rôle</th>' +
    ADMIN_TABS.map(([, l]) => `<th>${l}</th>`).join("") + "</tr></thead><tbody>";
  for (const [rk, rl] of ROLE_LIST) {
    html += `<tr><td>${rl}</td>` + ADMIN_TABS.map(([tk]) =>
      `<td style="text-align:center"><input type="checkbox" class="acc" data-role="${rk}" data-tab="${tk}" ${isOn(rk, tk) ? "checked" : ""} /></td>`).join("") + "</tr>";
  }
  $("access-matrix").innerHTML = '<div class="table-wrap">' + html + "</tbody></table></div>";
}

async function saveAccess() {
  const map = {};
  for (const [rk] of ROLE_LIST) map[rk] = [];
  document.querySelectorAll(".acc:checked").forEach((c) => map[c.dataset.role].push(c.dataset.tab));
  $("access-status").textContent = "Enregistrement…";
  const { error } = await sb.from("app_settings").upsert({ key: "tab_access", value: map }, { onConflict: "key" });
  if (error) { $("access-status").textContent = "Erreur : " + error.message; return; }
  settings.tab_access = map;
  $("access-status").textContent = "✓ Accès enregistrés (effectif à la prochaine connexion des utilisateurs)";
}

async function loadAccounts() {
  const { data, error } = await sb.rpc("list_accounts");
  if (error) { $("accounts-rows").innerHTML = `<tr><td colspan="2" class="muted">${esc(error.message)}</td></tr>`; return; }
  $("accounts-rows").innerHTML = (data || []).map((a) => {
    const label = a.person_name ? `${a.person_name} · ${a.email}` : a.email;
    const chips = ASSIGNABLE_ROLES.map((r) =>
      `<label class="role-chip"><input type="checkbox" data-uid="${a.user_id}" data-role="${r}" ${(a.roles || []).includes(r) ? "checked" : ""} /> ${r}</label>`).join("");
    return `<tr><td>${esc(label)}</td><td class="role-cell">${chips}</td></tr>`;
  }).join("");
  $("accounts-rows").querySelectorAll("input[type=checkbox]").forEach((c) =>
    c.addEventListener("change", () => toggleRole(c)));
}

async function toggleRole(c) {
  const r = c.dataset.role;
  const enabling = c.checked;                 // action voulue : true = attribuer
  const verbe = enabling ? "attribuer" : "désattribuer";
  const lbl = ME_ROLE_LABELS[r] || r;
  const privileged = r === "admin" || r === "superadmin";
  // Seul un superadmin peut toucher aux rôles admin/superadmin : on bloque avant l'appel.
  if (privileged && !myAppRoles.includes("superadmin")) {
    c.checked = !c.checked;
    uiAlert(`Vous n'avez pas les droits pour ${verbe} le rôle « ${lbl} ». Seul le superadmin peut le faire.`);
    return;
  }
  const { error } = await sb.rpc("set_user_role", { target: c.dataset.uid, r, enabled: enabling });
  if (error) {
    c.checked = !c.checked;
    if (/superadmin_required/.test(error.message))
      uiAlert(`Vous n'avez pas les droits pour ${verbe} le rôle « ${lbl} ». Seul le superadmin peut le faire.`);
    else if (/dernier superadmin/i.test(error.message))
      uiAlert("Impossible de retirer le dernier superadmin.");
    else uiAlert("Erreur : " + error.message);
  }
}

async function loadPeople() {
  await loadSeasonsList();
  const curIds = [currentSeason("cotisation"), currentSeason("juniors")].filter(Boolean).map((s) => s.id);
  const [{ data, error }, { data: pr }, { data: rp }] = await Promise.all([
    sb.from("people").select("*").order("last_name").order("first_name"),
    sb.from("person_roles").select("person_id,role"),
    curIds.length ? sb.from("role_periods").select("person_id,role,season_id").in("season_id", curIds) : Promise.resolve({ data: [] }),
  ]);
  if (error) { alert("Erreur chargement : " + error.message); return; }
  people = data || [];
  peopleRoles = {};
  const add = (pid, role) => { const a = (peopleRoles[pid] || (peopleRoles[pid] = [])); if (!a.includes(role)) a.push(role); };
  for (const r of pr || []) add(r.person_id, r.role);
  for (const r of rp || []) add(r.person_id, r.role); // rôles saisonniers de la saison EN COURS
  renderFilters();
  renderRows();
}

function renderFilters() {
  const box = $("people-filters"); if (!box) return;
  const all = `<button type="button" class="chip filt reset${activeFilters.size ? "" : " sel"}" data-role="">Tout</button>`;
  box.innerHTML = `<span class="filters-lbl">Filtrer&nbsp;:</span>` + all + PERSON_ROLES.map(([v, l]) =>
    `<button type="button" class="chip filt${activeFilters.has(v) ? " sel" : ""}" data-role="${v}">${esc(l)}</button>`).join("");
  box.querySelectorAll(".filt").forEach((b) => b.addEventListener("click", () => {
    const r = b.dataset.role;
    // Filtre unique : un clic remplace le filtre courant (re-cliquer le filtre actif = revient à « Tout »).
    if (!r || (activeFilters.has(r) && activeFilters.size === 1)) activeFilters.clear();
    else { activeFilters.clear(); activeFilters.add(r); }
    renderFilters(); renderRows();
  }));
}

// ===================================================================
//  Import Excel / CSV des membres
// ===================================================================
const IMPORT_HEADERS = ["Prénom", "Nom", "Naissance", "Genre", "Email", "Téléphone", "AVS", "Adresse", "NPA", "Ville", "Rôles", "Notes"];
const norm = (s) => (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const HEADER_MAP = {
  prenom: "first", nom: "last", naissance: "birth", "date de naissance": "birth",
  genre: "gender", sexe: "gender", email: "email", "e-mail": "email", courriel: "email",
  telephone: "phone", tel: "phone", portable: "phone", natel: "phone",
  avs: "avs", "n avs": "avs", "no avs": "avs", "n° avs": "avs",
  adresse: "address", npa: "postal", "code postal": "postal", ville: "city",
  roles: "roles", role: "roles", notes: "notes", remarques: "notes", note: "notes",
};
// lookup rôle : par valeur OU par libellé
const ROLE_LOOKUP = (() => {
  const m = {};
  for (const [v, l] of PERSON_ROLES) { m[norm(v)] = v; m[norm(l)] = v; }
  m[norm("headcoach")] = "head-coach"; m[norm("coach prive")] = "coach-prive";
  m[norm("sport-etudes")] = "sport-etudes"; m[norm("sport etudes")] = "sport-etudes";
  m[norm("prou18")] = "pro-u18"; m[norm("pro u18")] = "pro-u18";
  return m;
})();
let importRows = [];

function importParseDate(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  if (typeof v === "number") { const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
  const s = v.toString().trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += y < 30 ? 2000 : 1900; return `${y}-${pad2(+m[2])}-${pad2(+m[1])}`; }
  return null;
}
function importParseGender(v) {
  const n = norm(v);
  if (["f", "femme", "fille", "féminin", "feminin"].includes(n)) return "F";
  if (["m", "homme", "garcon", "garçon", "masculin", "h"].includes(n)) return "M";
  if (n === "x" || n === "autre") return "X";
  return null;
}
function importParseRoles(v) {
  if (!v) return { ok: [], bad: [] };
  const parts = v.toString().split(/[,;|\/]+/).map((x) => x.trim()).filter(Boolean);
  const ok = [], bad = [];
  for (const p of parts) { const r = ROLE_LOOKUP[norm(p)]; if (r) { if (!ok.includes(r)) ok.push(r); } else bad.push(p); }
  return { ok, bad };
}
function openImport() {
  $("import-error").hidden = true;
  $("import-summary").hidden = true;
  $("import-preview").innerHTML = "";
  $("import-confirm").disabled = true;
  $("import-file").value = "";
  importRows = [];
  $("import-modal").classList.remove("hidden");
}
function downloadTemplate() {
  if (!window.XLSX) { alert("Le module Excel n'est pas encore chargé, réessayez dans un instant."); return; }
  const example = ["Zoé", "Dupont", "15.03.2014", "F", "zoe@example.com", "079 123 45 67", "", "Ch. du Tennis 1", "1006", "Lausanne", "kidstennis, competition", ""];
  const ws = XLSX.utils.aoa_to_sheet([IMPORT_HEADERS, example]);
  ws["!cols"] = IMPORT_HEADERS.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Membres");
  XLSX.writeFile(wb, "teamlausanne_membres_modele.xlsx");
}
async function onImportFile(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  $("import-error").hidden = true;
  if (!window.XLSX) { $("import-error").textContent = "Module Excel non chargé, réessayez."; $("import-error").hidden = false; return; }
  const buf = await f.arrayBuffer();
  let wb;
  try { wb = XLSX.read(buf, { type: "array", cellDates: true }); }
  catch (err) { $("import-error").textContent = "Lecture impossible : " + err.message; $("import-error").hidden = false; return; }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
  if (raw.length < 2) { $("import-error").textContent = "Le fichier semble vide (pas de lignes de données)."; $("import-error").hidden = false; return; }
  const headers = raw[0].map((h) => HEADER_MAP[norm(h)] || null);
  const existingEmails = new Set(people.map((p) => norm(p.email)).filter(Boolean));
  const existingNames = new Set(people.map((p) => norm(p.first_name) + "|" + norm(p.last_name)));
  importRows = raw.slice(1).map((cells) => {
    const o = { first: "", last: "", birth: null, gender: null, email: "", phone: "", avs: "", address: "", postal: "", city: "", roles: { ok: [], bad: [] }, notes: "" };
    headers.forEach((key, i) => {
      if (!key) return;
      const val = cells[i];
      if (key === "birth") o.birth = importParseDate(val);
      else if (key === "gender") o.gender = importParseGender(val);
      else if (key === "roles") o.roles = importParseRoles(val);
      else o[key] = (val == null ? "" : val.toString().trim());
    });
    const errs = [];
    if (!o.first || !o.last) errs.push("Prénom/Nom manquant");
    const dup = (o.email && existingEmails.has(norm(o.email))) || existingNames.has(norm(o.first) + "|" + norm(o.last));
    o._errs = errs; o._dup = dup;
    return o;
  }).filter((o) => o.first || o.last || o.email); // ignore lignes totalement vides
  renderImportPreview();
}
function renderImportPreview() {
  const valid = importRows.filter((o) => o._errs.length === 0);
  const dups = valid.filter((o) => o._dup).length;
  const bad = importRows.length - valid.length;
  const badRoles = [...new Set(importRows.flatMap((o) => o.roles.bad))];
  const s = $("import-summary");
  s.hidden = false;
  s.innerHTML = `<b>${valid.length}</b> fiche(s) prête(s) à importer`
    + (bad ? ` · <span class="imp-warn">${bad} ignorée(s)</span>` : "")
    + (dups ? ` · <span class="imp-warn">${dups} doublon(s) possible(s)</span>` : "")
    + (badRoles.length ? `<br><span class="imp-warn">Rôles non reconnus (ignorés) : ${esc(badRoles.join(", "))}</span>` : "");
  const rowsHtml = importRows.slice(0, 40).map((o) => {
    const st = o._errs.length ? `<span class="imp-bad">${esc(o._errs.join(", "))}</span>`
      : o._dup ? `<span class="imp-warn">doublon ?</span>` : `<span class="imp-ok">OK</span>`;
    return `<tr class="${o._errs.length ? "imp-row-bad" : ""}"><td>${esc(o.first)}</td><td>${esc(o.last)}</td>
      <td>${frDate(o.birth)}</td><td>${esc(o.email)}</td>
      <td>${o.roles.ok.map((r) => `<span class="role-badge">${esc(roleLabel(r))}</span>`).join(" ")}</td>
      <td>${st}</td></tr>`;
  }).join("");
  $("import-preview").innerHTML = `<div class="table-wrap"><table class="crm-table"><thead><tr>
    <th>Prénom</th><th>Nom</th><th>Naissance</th><th>Email</th><th>Rôles</th><th>Statut</th></tr></thead>
    <tbody>${rowsHtml}</tbody></table></div>`
    + (importRows.length > 40 ? `<p class="muted" style="font-size:.82rem">… et ${importRows.length - 40} autre(s) ligne(s).</p>` : "");
  $("import-confirm").disabled = valid.length === 0;
  $("import-confirm").textContent = `Importer ${valid.length} fiche(s)`;
}
async function confirmImport() {
  const valid = importRows.filter((o) => o._errs.length === 0);
  if (!valid.length) return;
  const btn = $("import-confirm"); btn.disabled = true;
  let done = 0, fail = 0;
  for (const o of valid) {
    btn.textContent = `Import… ${done + 1}/${valid.length}`;
    const row = {
      first_name: o.first, last_name: o.last, birthdate: o.birth, gender: o.gender,
      email: o.email || null, phone: o.phone || null, avs: o.avs || null,
      address: o.address || null, postal_code: o.postal || null, city: o.city || null,
      notes: o.notes || null, is_active: true,
    };
    const res = await sb.from("people").insert(row).select("id").single();
    if (res.error) { fail++; continue; }
    if (o.roles.ok.length) {
      await sb.from("person_roles").insert(o.roles.ok.map((role) => ({ person_id: res.data.id, role })));
    }
    done++;
  }
  $("import-modal").classList.add("hidden");
  await loadPeople();
  alert(`✓ ${done} fiche(s) importée(s)` + (fail ? `\n${fail} échec(s).` : ""));
}

function renderRows() {
  const q = $("search").value.trim().toLowerCase();
  const rows = people.filter((p) => {
    const roles = peopleRoles[p.id] || [];
    if (activeFilters.size && ![...activeFilters].every((f) => roles.includes(f))) return false;
    if (!q) return true;
    const emails = [p.email, ...(p.emails || [])].join(" ");
    const phones = [p.phone, ...(p.phones || [])].join(" ");
    return (`${p.first_name} ${p.last_name} ${emails} ${phones}`).toLowerCase().includes(q);
  });
  const n = rows.length;
  const flt = activeFilters.size ? " · " + [...activeFilters].map(roleLabel).join(", ") : "";
  $("people-count").textContent = `${n} personne${n > 1 ? "s" : ""}${flt}`;
  const tbody = $("people-rows");
  tbody.innerHTML = "";
  $("empty-msg").hidden = rows.length > 0;
  for (const p of rows) {
    const emails = [p.email, ...(p.emails || [])].filter(Boolean);
    const phones = [p.phone, ...(p.phones || [])].filter(Boolean);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(p.last_name)}</td>
      <td>${esc(p.first_name)}</td>
      <td>${esc(emails[0] || "")}${emails.length > 1 ? ` <span class="muted">+${emails.length - 1}</span>` : ""}</td>
      <td>${esc(phones[0] || "")}${phones.length > 1 ? ` <span class="muted">+${phones.length - 1}</span>` : ""}</td>
      <td>${frDate(p.birthdate)}</td>`;
    tr.addEventListener("click", () => openPerson(p));
    tbody.appendChild(tr);
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- Fiche ----
function openPerson(p) {
  $("person-error").hidden = true;
  $("person-title").textContent = p ? "Modifier la fiche" : "Nouvelle personne";
  $("delete-person").classList.toggle("hidden", !p);
  $("invite-person").classList.toggle("hidden", !p);
  $("p-invite-result").classList.add("hidden");
  $("p-invite-result").innerHTML = "";
  $("p-id").value = p?.id || "";
  $("p-first").value = p?.first_name || "";
  $("p-last").value = p?.last_name || "";
  $("p-birth").value = p?.birthdate || "";
  $("p-gender").value = p?.gender || "";
  $("p-email").value = p?.email || "";
  $("p-phone").value = p?.phone || "";
  $("p-avs").value = p?.avs || "";
  $("p-license").value = p?.license_no || "";
  updateLicHint();
  $("p-emails").value = (p?.emails || []).join("\n");
  $("p-phones").value = (p?.phones || []).join("\n");
  $("p-address").value = p?.address || "";
  $("p-postal").value = p?.postal_code || "";
  $("p-city").value = p?.city || "";
  $("p-parent1").value = p?.parent1 || "";
  $("p-parent2").value = p?.parent2 || "";
  $("p-tshirt").value = p?.tshirt || "";
  $("p-shorts").value = p?.shorts || "";
  $("p-hoodie").value = p?.hoodie || "";
  $("p-sweatpants").value = p?.sweatpants || "";
  $("p-active").checked = p ? p.is_active : true;
  $("p-notes").value = p?.notes || "";
  personPhotoUrl = p?.photo_url || null;
  renderPersonPhoto();
  renderPersonRoles(p ? (peopleRoles[p.id] || []) : []);
  $("family-section").classList.toggle("hidden", !p);
  $("credit-section").classList.toggle("hidden", !p);
  if (p) { populateFamPersons(p.id); loadFamily(p.id); loadCredit(p.id); }
  const roles = p ? (peopleRoles[p.id] || []) : [];
  // Onglet Réservations : visible si membre/client (ou si des résas existent — persistance)
  const resaByRole = roles.includes("membre") || roles.includes("client");
  const coursByRole = COURSE_ROLES.some((r) => roles.includes(r));
  const physByRole = COURSE_ROLES.some((r) => roles.includes(r)); // tests physiques = tous les jeunes
  const etudesByRole = roles.includes("sport-etudes");            // études = sport-études uniquement
  const mentalByRole = MENTAL_YOUTH_ROLES.some((r) => roles.includes(r)); // mental = sport-études/pro/proU18
  showPersonTab("resa", resaByRole);
  showPersonTab("cours", coursByRole);
  showPersonTab("phys", physByRole);
  showPersonTab("etudes", etudesByRole);
  showPersonTab("matchs", physByRole);
  showPersonTab("suivi", physByRole);   // fil « Suivi du jeune » pour tout junior
  const isPlayer = ["sport-etudes", "pro", "pro-u18"].some((r) => roles.includes(r)); // contrat = sport-études / pro
  showPersonTab("contrat", isPlayer);
  showPersonTab("stages", false);
  const staffPayRole = [...COACH_ROLES, "prof", "coach-mental"].some((r) => roles.includes(r));
  showPersonTab("coach", staffPayRole);
  const isCoachPerson = COACH_ROLES.some((r) => roles.includes(r)); // sous-onglet Repas = coachs
  showPersonTab("repas", isCoachPerson);
  loadPersonMeals(p ? p.id : null, isCoachPerson);
  $("p-iban").value = p?.iban || "";
  loadCoachRates(p ? p.id : null);
  setPersonTab("info");
  loadObjectives(p ? p.id : null);
  loadMedia(p ? p.id : null);
  loadPersonSeasons(p ? p.id : null);
  if (p) { loadReservations(p.id, resaByRole); loadCourses(p.id, coursByRole); loadPersonPhys(p.id, physByRole); loadPersonEtudes(p.id, etudesByRole); loadPersonSuivi(p.id, physByRole); loadPersonContract(p.id, isPlayer); loadPersonMatchs(p.id, physByRole || !!p.license_no); loadPersonStages(p.id); }
  else { $("resa-list").innerHTML = ""; $("resa-stats").innerHTML = ""; $("cours-content").innerHTML = ""; $("pp-results").innerHTML = ""; $("pe-stats").innerHTML = ""; $("ps-chan").innerHTML = ""; $("pc-body").innerHTML = ""; $("mrf-mount").innerHTML = ""; $("ps-participations").innerHTML = ""; }
  $("people-list-wrap").classList.add("hidden");
  $("people-detail").classList.remove("hidden");
  window.scrollTo(0, 0);
}

// ---- Onglets de la fiche ----
function setPersonTab(tab) {
  document.querySelectorAll("#p-tabs .ptab").forEach((b) =>
    b.classList.toggle("active", b.dataset.ptab === tab));
  document.querySelectorAll("#person-form .ptab-panel").forEach((p) =>
    p.classList.toggle("hidden", p.id !== `ptab-${tab}`));
}
function showPersonTab(tab, show) {
  const btn = document.querySelector(`#p-tabs .ptab[data-ptab="${tab}"]`);
  if (btn) btn.classList.toggle("hidden", !show);
}

// Rôles qui font apparaître l'onglet Cours
const COURSE_ROLES = ["kidstennis", "club", "competition", "performance", "sport-etudes", "pro-u18", "pro", "adultes"];
const COACH_ROLES = ["coach", "head-coach", "coach-prive", "coach_physique", "moniteur"];
const hasRoleIn = (pid, list) => (peopleRoles[pid] || []).some((r) => list.includes(r));

// ---- Photos / vidéos d'une personne ----
async function loadMedia(personId) {
  const grid = $("media-grid");
  const has = !!personId;
  $("media-btn").disabled = !has;
  $("media-need-save").hidden = has;
  $("media-status").textContent = "";
  if (!has) { grid.innerHTML = ""; return; }
  const { data, error } = await sb.from("person_media")
    .select("*").eq("person_id", personId).order("created_at", { ascending: false });
  if (error) { grid.innerHTML = `<p class="obj-empty">Erreur : ${esc(error.message)}</p>`; return; }
  if (!data.length) { grid.innerHTML = `<p class="obj-empty">Aucune photo ni vidéo.</p>`; return; }
  grid.innerHTML = data.map((m) => {
    const media = m.kind === "video"
      ? `<video src="${esc(m.url)}" controls preload="metadata"></video>`
      : `<img src="${esc(m.url)}" alt="" />`;
    const badge = m.is_profile ? `<span class="media-badge">Profil</span>` : "";
    return `<div class="media-card" data-mid="${m.id}">
      <div class="media-thumb">${media}${badge}</div>
      <textarea class="media-comment" rows="2" placeholder="Commentaire…">${esc(m.comment || "")}</textarea>
      <button type="button" class="media-del" data-url="${esc(m.storage_path || "")}">Supprimer</button>
    </div>`;
  }).join("");
  grid.querySelectorAll(".media-comment").forEach((t) =>
    t.addEventListener("blur", () => saveMediaComment(t.closest(".media-card").dataset.mid, t.value)));
  grid.querySelectorAll(".media-del").forEach((b) =>
    b.addEventListener("click", () => deleteMedia(b.closest(".media-card").dataset.mid, b.dataset.url)));
}
async function uploadMedia(fileInput) {
  const id = $("p-id").value;
  if (!id || !fileInput.files || !fileInput.files[0]) return;
  const f = fileInput.files[0];
  const kind = f.type.startsWith("video") ? "video" : "image";
  $("media-status").textContent = "Envoi…";
  const path = `people/${id}/media/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
  const up = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (up.error) { $("media-status").textContent = "Erreur : " + up.error.message; return; }
  const url = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  const { error } = await sb.from("person_media").insert({ person_id: id, url, storage_path: path, kind, created_by: meId });
  fileInput.value = "";
  $("media-status").textContent = error ? "Erreur : " + error.message : "";
  loadMedia(id);
}
async function saveMediaComment(mid, comment) {
  const { error } = await sb.from("person_media").update({ comment: comment.trim() || null }).eq("id", mid);
  if (error) { $("media-status").textContent = "Commentaire : " + error.message; return; }
  $("media-status").textContent = "✓ Commentaire enregistré";
  setTimeout(() => { if ($("media-status").textContent.startsWith("✓")) $("media-status").textContent = ""; }, 1500);
}
async function deleteMedia(mid, storagePath) {
  if (!await uiConfirm("Supprimer ce média ?")) return;
  if (storagePath) await sb.storage.from("gz-photos").remove([storagePath]);
  const { error } = await sb.from("person_media").delete().eq("id", mid);
  if (error) { $("media-status").textContent = "Suppression : " + error.message; return; }
  loadMedia($("p-id").value);
}

// ---- Cours d'une personne (présences + cours annoncés à venir) ----
// Lecture par lots (contourne la limite 1000 lignes + URL trop longue sur .in()).
async function fetchInChunks(table, cols, col, ids, tweak) {
  const out = []; const CH = 80;
  for (let i = 0; i < ids.length; i += CH) {
    let q = sb.from(table).select(cols).in(col, ids.slice(i, i + CH));
    if (tweak) q = tweak(q);
    const { data } = await q; if (data) out.push(...data);
  }
  return out;
}

async function loadCourses(personId, showByRole) {
  const box = $("cours-content");
  const { data: parts0 } = await sb.from("course_participants").select("course_id,courses(course_date)").eq("child_person_id", personId);
  const anyCourse = (parts0 || []).some((p) => p.courses);
  showPersonTab("cours", showByRole || anyCourse);
  const juns = (typeof seasonsOf === "function" ? seasonsOf("juniors") : []) || [];
  if (!juns.length) { box.innerHTML = '<p class="obj-empty">Aucune saison définie.</p>'; return; }
  const cur = (typeof currentSeason === "function" ? currentSeason("juniors") : null);
  box.innerHTML = `<div class="cours-toolbar"><label class="fld">Saison <select id="cours-season">${juns.map((s) => `<option value="${s.id}">${esc(s.label || (s.start_date + "→" + s.end_date))}</option>`).join("")}</select></label></div><div id="cours-body"></div>`;
  const sel = $("cours-season");
  sel.value = (cur && cur.id) || juns[0].id;   // forcer la valeur (pretty-select)
  sel.addEventListener("change", () => renderCoursSeason(personId, sel.value));
  renderCoursSeason(personId, sel.value);
}

// Stats de jeu par saison, basées sur les PRÉSENCES RÉELLES (et le détail pour pro/SE).
async function renderCoursSeason(personId, seasonId) {
  const body = $("cours-body"); if (!body) return;
  const juns = (typeof seasonsOf === "function" ? seasonsOf("juniors") : []) || [];
  const s = juns.find((x) => String(x.id) === String(seasonId));
  if (!s) { body.innerHTML = '<p class="obj-empty">Choisis une saison.</p>'; return; }
  body.innerHTML = '<p class="muted">Chargement…</p>';
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const { data: parts } = await sb.from("course_participants")
    .select("course_id,courses(course_date,start_time,end_time,course_type_id,course_types(name))").eq("child_person_id", personId);
  const mine = (parts || []).filter((p) => p.courses && p.courses.course_date >= s.start_date && p.courses.course_date <= s.end_date);
  if (!mine.length) { body.innerHTML = '<p class="obj-empty">Aucun cours cette saison.</p>'; return; }
  const courseIds = mine.map((p) => p.course_id);
  const [att, segs] = await Promise.all([
    fetchInChunks("attendance", "course_id,person_id,status", "course_id", courseIds, (q) => q.eq("is_coach", false)),
    fetchInChunks("course_segments", "id,course_id,minutes", "course_id", courseIds),
  ]);
  const sp = segs.length ? await fetchInChunks("course_segment_players", "segment_id,person_id", "segment_id", segs.map((x) => x.id)) : [];
  const attByCourse = {}; att.forEach((a) => ((attByCourse[a.course_id] || (attByCourse[a.course_id] = {}))[a.person_id] = a.status));
  const segByCourse = {}; segs.forEach((sg) => (segByCourse[sg.course_id] || (segByCourse[sg.course_id] = [])).push(sg));
  const playersBySeg = {}; sp.forEach((r) => (playersBySeg[r.segment_id] || (playersBySeg[r.segment_id] = [])).push(r.person_id));
  const isPhys = (name) => /physique|fitness/i.test(name || "");
  const mk = () => ({ present: 0, absent: 0, late: 0, annonce: 0, g: { 1: 0, 2: 0, 3: 0, 4: 0 }, withMin: {}, total: 0 });
  const D = { tennis: mk(), phys: mk() };
  mine.forEach((p) => {
    const c = p.courses, cid = p.course_id;
    const d = isPhys(c.course_types?.name) ? D.phys : D.tennis;
    const st = (attByCourse[cid] || {})[personId];
    if (st === "present") d.present++; else if (st === "absent") d.absent++; else if (st === "late") d.late++;
    else { if (c.course_date >= todayISO) d.annonce++; return; }
    if (st !== "present" && st !== "late") return;            // pas de temps de jeu si absent
    const segList = segByCourse[cid];
    if (segList && segList.length) {                          // pro/SE détaillé → selon le détail (blocs)
      segList.forEach((sg) => {
        const pls = playersBySeg[sg.id] || []; if (!pls.includes(personId)) return;
        const m = sg.minutes || 0, gs = Math.min(pls.length, 4) || 1;
        d.g[gs] += m; d.total += m;
        pls.forEach((o) => { if (o !== personId) d.withMin[o] = (d.withMin[o] || 0) + m; });
      });
    } else {                                                  // cours normal → durée pleine, groupe = présents
      const dur = trMinBetween(c.start_time, c.end_time);
      const pres = Object.keys(attByCourse[cid] || {}).filter((pid) => ["present", "late"].includes(attByCourse[cid][pid]));
      const gs = Math.min(pres.length || 1, 4);
      d.g[gs] += dur; d.total += dur;
      pres.forEach((o) => { if (o !== personId) d.withMin[o] = (d.withMin[o] || 0) + dur; });
    }
  });
  body.innerHTML = coursBoxHtml("🎾 Tennis", D.tennis, "tn") + coursBoxHtml("💪 Physique", D.phys, "ph");
  body.querySelectorAll(".cours-more").forEach((b) => b.addEventListener("click", () => { const r = $(b.dataset.t + "-rest"); if (r) r.classList.remove("hidden"); b.remove(); }));
}

function coursBoxHtml(title, d, key) {
  const fmt = (m) => { const h = Math.floor(m / 60), r = m % 60; return h && r ? `${h}h${String(r).padStart(2, "0")}` : h ? `${h}h` : `${r}min`; };
  const marked = d.present + d.absent + d.late;
  if (!marked && !d.annonce) return `<div class="cours-box"><div class="cours-box-h">${title}</div><p class="muted" style="font-size:.85rem;margin:6px 0 0">Aucun cours cette saison.</p></div>`;
  const pct = marked ? Math.round((d.present / marked) * 100) : 0;
  const partners = Object.entries(d.withMin).map(([id, m]) => ({ id, m })).sort((a, b) => b.m - a.m);
  const row = (p) => `<div class="att-row"><span class="att-d">${esc(trFull(p.id))}</span><span class="att-badge">${fmt(p.m)}</span></div>`;
  const shown = partners.slice(0, 8), rest = partners.slice(8);
  const partHtml = partners.length
    ? shown.map(row).join("") + (rest.length ? `<div id="${key}-rest" class="hidden">${rest.map(row).join("")}</div><button type="button" class="ghost cours-more" data-t="${key}" style="margin-top:6px">Afficher plus (${rest.length})</button>` : "")
    : '<span class="muted" style="font-size:.85rem">— personne —</span>';
  return `<div class="cours-box">
    <div class="cours-box-h">${title}</div>
    <div class="cours-line"><b>Présences</b> — ${d.present} présent · ${d.late} retard · ${d.absent} absent${marked ? ` · <b>${pct}%</b>` : ""}${d.annonce ? ` · ${d.annonce} annoncé` : ""}</div>
    <div class="cours-line"><b>Temps de jeu réel</b> — seul ${fmt(d.g[1])} · à 2 ${fmt(d.g[2])} · à 3 ${fmt(d.g[3])} · à 4+ ${fmt(d.g[4])} · <b>total ${fmt(d.total)}</b></div>
    <div class="cours-line" style="margin-top:6px"><b>Joué avec</b></div>
    <div class="att-list">${partHtml}</div>
  </div>`;
}

// ---- Réservations d'une personne ----
function seasonOf(d) {
  const dt = new Date(d), m = dt.getMonth() + 1, day = dt.getDate();
  const ete = (m > 4 && m < 10) || (m === 4 && day >= 15) || (m === 10 && day < 15);
  return ete ? "ete" : "hiver";
}
async function loadReservations(personId, showByRole) {
  const list = $("resa-list"), stats = $("resa-stats");
  // booked_by = la personne concernée ; partner_person_id = quand elle est l'invitée/partenaire
  const { data, error } = await sb.from("court_bookings")
    .select("booking_date,start_time,end_time,price_chf,kind,title,partner_person_id,booked_by,courts(name)")
    .or(`booked_by.eq.${personId},partner_person_id.eq.${personId}`)
    .order("booking_date", { ascending: false }).order("start_time", { ascending: false });
  const rows = error ? [] : (data || []);
  showPersonTab("resa", showByRole || rows.length > 0);
  if (error) { stats.innerHTML = ""; list.innerHTML = `<p class="obj-empty">Erreur : ${esc(error.message)}</p>`; return; }
  if (!rows.length) { stats.innerHTML = ""; list.innerHTML = `<p class="obj-empty">Aucune réservation.</p>`; return; }
  // Stats par année + saison
  const agg = {};
  for (const b of rows) {
    const y = (b.booking_date || "").slice(0, 4);
    const s = seasonOf(b.booking_date);
    const key = `${y}|${s}`;
    (agg[key] = agg[key] || { count: 0, sum: 0 });
    agg[key].count++; agg[key].sum += Number(b.price_chf || 0);
  }
  const keys = Object.keys(agg).sort().reverse();
  stats.innerHTML = keys.map((k) => {
    const [y, s] = k.split("|");
    const a = agg[k];
    const lbl = s === "ete" ? "Été" : "Hiver";
    return `<div class="resa-stat"><div class="resa-stat-h">${y} · ${lbl}</div>
      <div class="resa-stat-n">${a.count} résa${a.count > 1 ? "s" : ""}</div>
      <div class="resa-stat-s">${a.sum.toFixed(2)} CHF</div></div>`;
  }).join("");
  list.innerHTML = rows.map((b) => {
    const d = b.booking_date ? frDate(b.booking_date) : "—";
    const h = `${(b.start_time || "").slice(0, 5)}–${(b.end_time || "").slice(0, 5)}`;
    const court = b.courts?.name || "Court";
    const price = b.price_chf != null ? `${Number(b.price_chf).toFixed(2)} CHF` : "—";
    return `<div class="resa-row"><span class="resa-d">${d}</span><span class="resa-h">${h}</span>
      <span class="resa-c">${esc(court)}</span><span class="resa-p">${price}</span></div>`;
  }).join("");
}

// ---- Objectifs ----
async function loadObjectives(personId) {
  const list = $("obj-list");
  const hasP = !!personId;
  $("obj-body").disabled = !hasP;
  $("obj-add-btn").disabled = !hasP;
  $("obj-need-save").hidden = hasP;
  if (!hasP) { list.innerHTML = ""; return; }
  const { data, error } = await sb.from("person_objectives")
    .select("*").eq("person_id", personId).order("created_at", { ascending: false });
  if (error) { list.innerHTML = `<p class="obj-empty">Erreur : ${esc(error.message)}</p>`; return; }
  if (!data.length) { list.innerHTML = `<p class="obj-empty">Aucun objectif pour le moment.</p>`; return; }
  list.innerHTML = data.map((o) => {
    const mine = o.created_by === meId;
    const dt = frDateTime(o.created_at);
    const edited = o.updated_at && o.updated_at !== o.created_at ? ' <span class="muted">(modifié)</span>' : "";
    return `<div class="obj-item" data-oid="${o.id}">
      <div class="obj-meta"><b>${esc(o.author_name || "—")}</b><span>${dt}${edited}</span></div>
      <div class="obj-body">${esc(o.body)}</div>
      ${mine ? `<div class="obj-acts"><button type="button" class="edit">Modifier</button><button type="button" class="del">Supprimer</button></div>` : ""}
    </div>`;
  }).join("");
  list.querySelectorAll(".obj-item .edit").forEach((b) =>
    b.addEventListener("click", () => editObjective(b.closest(".obj-item").dataset.oid)));
  list.querySelectorAll(".obj-item .del").forEach((b) =>
    b.addEventListener("click", () => deleteObjective(b.closest(".obj-item").dataset.oid)));
}
async function addObjective() {
  const id = $("p-id").value;
  const body = $("obj-body").value.trim();
  if (!id || !body) return;
  const { error } = await sb.from("person_objectives").insert({
    person_id: id, body, author_name: meName, created_by: meId,
  });
  if (error) { alert("Objectif : " + error.message); return; }
  $("obj-body").value = "";
  loadObjectives(id);
}
async function editObjective(oid) {
  const el = document.querySelector(`.obj-item[data-oid="${oid}"] .obj-body`);
  const current = el ? el.textContent : "";
  const next = await uiPrompt("Modifier l'objectif :", current);
  if (next === null) return;
  const body = next.trim();
  if (!body) return;
  const { error } = await sb.from("person_objectives")
    .update({ body, updated_at: new Date().toISOString() }).eq("id", oid);
  if (error) { alert("Objectif : " + error.message); return; }
  loadObjectives($("p-id").value);
}
async function deleteObjective(oid) {
  if (!await uiConfirm("Supprimer cet objectif ?")) return;
  const { error } = await sb.from("person_objectives").delete().eq("id", oid);
  if (error) { alert("Objectif : " + error.message); return; }
  loadObjectives($("p-id").value);
}

// ---- Saisons (rôles saisonniers = source de vérité, rattachés à une saison) ----
function seasonOpt(s, curId) {
  return `<option value="${s.id}"${s.id === curId ? " selected" : ""}>${esc(s.label)}${s.id === curId ? " (en cours)" : ""}</option>`;
}
async function loadPersonSeasons(personId) {
  const curCot = currentSeason("cotisation"), curJun = currentSeason("juniors");
  const cotS = seasonsOf("cotisation"), junS = seasonsOf("juniors");
  $("ss-cot-season").innerHTML = cotS.length ? cotS.map((s) => seasonOpt(s, curCot?.id)).join("") : '<option value="">— aucune saison —</option>';
  $("ss-jun-season").innerHTML = junS.length ? junS.map((s) => seasonOpt(s, curJun?.id)).join("") : '<option value="">— aucune saison —</option>';
  $("ss-jun-role").innerHTML = '<option value="">— Choisir une filière —</option>' + SEASONAL_JUNIORS.map((r) => `<option value="${r}">${esc(roleLabel(r))}</option>`).join("");
  const enable = !!personId;
  ["ss-cot-add", "ss-jun-add", "ss-cot-season", "ss-jun-season", "ss-jun-role"].forEach((id) => { $(id).disabled = !enable; });
  if (!enable) { $("ss-cot-list").innerHTML = '<p class="muted" style="font-size:.85rem">Enregistrez d\'abord la personne.</p>'; $("ss-jun-list").innerHTML = ""; return; }

  const { data } = await sb.from("role_periods").select("*, seasons(id,kind,label,start_date)").eq("person_id", personId);
  const rows = (data || []).filter((r) => r.seasons);
  const intentSel = (r) => `<select class="ss-intent" data-id="${r.id}">
    <option value="">Intention suivante…</option>
    ${INTENTS.map(([v, l]) => `<option value="${v}"${r.next_intent === v ? " selected" : ""}>${l}</option>`).join("")}</select>`;

  const cots = rows.filter((r) => r.seasons.kind === "cotisation").sort((a, b) => b.seasons.start_date.localeCompare(a.seasons.start_date));
  $("ss-cot-list").innerHTML = cots.length ? cots.map((r) => `
    <div class="ss-row${r.season_id === curCot?.id ? " ss-cur" : ""}">
      <span class="ss-season">${esc(r.seasons.label)}</span>
      <label class="ss-paid"><input type="checkbox" class="ss-paid-chk" data-id="${r.id}" ${r.paid ? "checked" : ""}/> Payé</label>
      <span class="ss-status">${r.paid ? '<span class="ss-tag ss-ok">Membre</span>' : '<span class="ss-tag ss-warn">Non payé</span>'}</span>
      ${intentSel(r)}
      <button type="button" class="fam-del ss-del" data-id="${r.id}">✕</button>
    </div>`).join("") : '<p class="muted" style="font-size:.85rem">Aucune cotisation enregistrée.</p>';

  const juns = rows.filter((r) => r.seasons.kind === "juniors").sort((a, b) => b.seasons.start_date.localeCompare(a.seasons.start_date) || a.role.localeCompare(b.role));
  $("ss-jun-list").innerHTML = juns.length ? juns.map((r) => `
    <div class="ss-row${r.season_id === curJun?.id ? " ss-cur" : ""}">
      <span class="ss-season">${esc(r.seasons.label)}</span>
      <span class="ss-status"><span class="ss-tag ss-role">${esc(roleLabel(r.role))}</span></span>
      ${intentSel(r)}
      <button type="button" class="fam-del ss-del" data-id="${r.id}">✕</button>
    </div>`).join("") : '<p class="muted" style="font-size:.85rem">Aucune filière enregistrée.</p>';

  $("ptab-seasons").querySelectorAll(".ss-del").forEach((b) => b.addEventListener("click", () => deleteSeasonPeriod(b.dataset.id)));
  $("ptab-seasons").querySelectorAll(".ss-paid-chk").forEach((c) => c.addEventListener("change", () => updateSeasonPeriod(c.dataset.id, { paid: c.checked })));
  $("ptab-seasons").querySelectorAll(".ss-intent").forEach((s) => s.addEventListener("change", () => updateSeasonPeriod(s.dataset.id, { next_intent: s.value || null })));
}
async function addSeasonRole(kind, role) {
  const pid = $("p-id").value;
  const seasonId = $(kind === "cotisation" ? "ss-cot-season" : "ss-jun-season").value;
  if (!pid || !role) return;
  if (!seasonId) { alert("Crée d'abord une saison dans Réglages › Saisons."); return; }
  const { error } = await sb.from("role_periods").insert({ person_id: pid, season_id: seasonId, role, created_by: meId });
  if (error) { alert(error.code === "23505" ? "Déjà enregistré pour cette saison." : error.message); return; }
  loadPersonSeasons(pid);
  loadPeople();
}
async function updateSeasonPeriod(id, patch) {
  const { error } = await sb.from("role_periods").update(patch).eq("id", id);
  if (error) { alert(error.message); return; }
  loadPersonSeasons($("p-id").value);
  if ("paid" in patch) loadPeople();
}
async function deleteSeasonPeriod(id) {
  if (!await uiConfirm("Retirer cette saison ?")) return;
  const { error } = await sb.from("role_periods").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  loadPersonSeasons($("p-id").value);
  loadPeople();
}

let personPhotoUrl = null;
let personRolesSel = new Set();
function renderPersonPhoto() {
  const box = $("p-photo-preview");
  box.innerHTML = personPhotoUrl ? `<img src="${personPhotoUrl}" alt="" />` : "";
  box.classList.toggle("empty", !personPhotoUrl);
}
function renderPersonRoles(roles) {
  // Les rôles saisonniers (membre + filières juniors) se gèrent dans l'onglet Saisons.
  personRolesSel = new Set((roles || []).filter((r) => !SEASONAL_ROLES.includes(r)));
  $("p-roles").innerHTML = PERSON_ROLES.filter(([v]) => !SEASONAL_ROLES.includes(v)).map(([v, l]) =>
    `<button type="button" class="chip${personRolesSel.has(v) ? " sel" : ""}" data-role="${v}">${esc(l)}</button>`).join("");
  $("p-roles").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    const r = b.dataset.role;
    personRolesSel.has(r) ? personRolesSel.delete(r) : personRolesSel.add(r);
    b.classList.toggle("sel");
  }));
}
async function uploadPersonPhoto(file) {
  if (!file.files || !file.files[0]) return;
  const f = file.files[0];
  const path = `people/${$("p-id").value || "new"}-${Date.now()}`;
  const { error } = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (error) { alert("Photo : " + error.message); return; }
  personPhotoUrl = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  renderPersonPhoto();
  // La photo de profil s'ajoute aussi dans l'onglet Photos / vidéos (commentaire éditable)
  const id = $("p-id").value;
  if (id) {
    await sb.from("person_media").insert({
      person_id: id, url: personPhotoUrl, storage_path: path, kind: "image",
      is_profile: true, comment: "Photo de profil", created_by: meId,
    });
    loadMedia(id);
  }
}

async function loadCredit(personId) {
  $("cr-amount").value = ""; $("cr-reason").value = "";
  const [{ data: bal }, { data: led }] = await Promise.all([
    sb.rpc("wallet_balance", { p_person: personId }),
    sb.from("wallet_ledger").select("amount,reason,created_at").eq("person_id", personId).order("created_at", { ascending: false }).limit(12),
  ]);
  $("cr-balance").textContent = `${Number(bal ?? 0)} CHF`;
  const rows = led || [];
  $("cr-ledger").innerHTML = rows.length ? rows.map((r) =>
    `<div class="cr-row"><span>${frDate(r.created_at)} · ${esc(r.reason || "")}</span>
      <b style="color:${r.amount >= 0 ? "#0b6b3a" : "#b3261e"}">${r.amount >= 0 ? "+" : ""}${r.amount}</b></div>`).join("")
    : '<p class="muted" style="font-size:.85rem;margin:6px 0 0">Aucun mouvement.</p>';
}

async function rechargeCredit() {
  const id = $("p-id").value; if (!id) return;
  const amount = Number($("cr-amount").value);
  if (!amount || amount <= 0) { alert("Montant invalide."); return; }
  const { error } = await sb.from("wallet_ledger").insert({
    person_id: id, amount, reason: $("cr-reason").value.trim() || "Recharge", created_by: meId,
  });
  if (error) { alert("Recharge impossible : " + error.message); return; }
  loadCredit(id);
}

function populateFamPersons(selfId) {
  $("fam-person").innerHTML = '<option value="">— Choisir une personne —</option>' +
    people.filter((x) => x.id !== selfId).map((x) =>
      `<option value="${x.id}">${esc(x.last_name)} ${esc(x.first_name)}</option>`).join("");
}

async function loadFamily(id) {
  const { data } = await sb.from("guardianships").select("*").or(`guardian_id.eq.${id},child_id.eq.${id}`);
  const nameOf = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.last_name} ${p.first_name}` : "—"; };
  const rows = data || [];
  $("family-list").innerHTML = rows.length ? rows.map((g) => {
    const isParent = g.guardian_id === id;
    const other = isParent ? g.child_id : g.guardian_id;
    const label = g.relation === "sibling"
      ? `Frère / sœur : ${nameOf(other)}`
      : (isParent ? `Enfant : ${nameOf(other)}` : `Parent/tuteur : ${nameOf(other)}`);
    return `<div class="fam-item"><span>${label}</span><button type="button" class="fam-del" data-g="${g.guardian_id}" data-c="${g.child_id}">✕</button></div>`;
  }).join("") : '<p class="muted" style="font-size:.85rem;margin:0">Aucun lien.</p>';
  $("family-list").querySelectorAll(".fam-del").forEach((b) =>
    b.addEventListener("click", () => removeFamily(b.dataset.g, b.dataset.c, id)));
}

async function addFamily() {
  const id = $("p-id").value;
  if (!id) { alert("Enregistrez d'abord la fiche."); return; }
  const other = $("fam-person").value;
  if (!other) return;
  const dir = $("fam-dir").value;
  let row;
  if (dir === "sibling") {
    // Lien non orienté : on ordonne les ids pour éviter les doublons A-B / B-A
    const [a, b] = [id, other].sort();
    row = { guardian_id: a, child_id: b, relation: "sibling" };
  } else if (dir === "child") {
    row = { guardian_id: id, child_id: other, relation: "parent" };
  } else {
    row = { guardian_id: other, child_id: id, relation: "parent" };
  }
  const { error } = await sb.from("guardianships").insert(row);
  if (error) { alert("Lien impossible : " + (error.code === "23505" ? "ce lien existe déjà." : error.message)); return; }
  $("fam-person").value = "";
  loadFamily(id);
}

async function removeFamily(g, c, id) {
  await sb.from("guardianships").delete().eq("guardian_id", g).eq("child_id", c);
  loadFamily(id);
}

// ===================================================================
//  Cours
// ===================================================================
let courseTypes = [];
let isHeadUser = false, isAdminUser = false, isCourseMgr = false;
const QH = (() => { const a = []; for (let h = 7; h <= 22; h++) for (const m of [0, 15, 30, 45]) { if (h === 22 && m > 0) break; a.push(pad2(h) + ":" + pad2(m)); } return a; })();

function initCours(roles) {
  isHeadUser = roles.some((r) => ["superadmin", "admin", "head_coach"].includes(r));
  isCourseMgr = isHeadUser || roles.includes("secretaire"); // créer/éditer des cours = head/admin + secrétariat
  isAdminUser = roles.some((r) => ["superadmin", "admin"].includes(r));
  $("ct-card").querySelector(".ct-add").classList.toggle("hidden", !isAdminUser);
  // Sous-onglet « Types de cours » : réservé admin/superadmin (impacte le paiement).
  const tt = $("cours-subtab-types");
  if (tt) tt.classList.toggle("hidden", !isAdminUser);
  $("cs-new").classList.toggle("hidden", !isCourseMgr);
  $("cs-copy").classList.toggle("hidden", !isCourseMgr);

  $("c-start").innerHTML = QH.map((t) => `<option value="${t}">${t}</option>`).join("");
  $("c-end").innerHTML = QH.map((t) => `<option value="${t}">${t}</option>`).join("");

  document.querySelectorAll("#view-cours .cours-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-cours .cours-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-cours .cours-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "cours-sub-" + b.dataset.sub));
    }));
  $("ct-add-btn").addEventListener("click", addType);
  $("cs-date").value = isoA(new Date());
  $("cs-date").addEventListener("change", loadCoursesCurrent);
  $("cs-search").addEventListener("input", filterCourses);
  $("cs-prev").addEventListener("click", () => shiftCs(-1));
  $("cs-next").addEventListener("click", () => shiftCs(1));
  $("cs-new").addEventListener("click", () => openCourse(null));
  $("cs-copy").addEventListener("click", copyWeek);
  $("cs-mode-day").addEventListener("click", () => setCoursView("day"));
  $("cs-mode-week").addEventListener("click", () => setCoursView("week"));
  $("cw-close").addEventListener("click", () => $("copyweek-modal").classList.add("hidden"));
  $("copyweek-modal").addEventListener("click", (e) => { if (e.target === $("copyweek-modal")) $("copyweek-modal").classList.add("hidden"); });
  $("cw-go").addEventListener("click", cwGo);
  $("cw-date").addEventListener("change", () => { if (cwToCreate) { cwToCreate = null; $("cw-summary").hidden = true; $("cw-go").disabled = false; $("cw-go").textContent = "Vérifier"; } });
  $("course-close").addEventListener("click", () => $("course-modal").classList.add("hidden"));
  $("course-modal").addEventListener("click", (e) => { if (e.target === $("course-modal")) $("course-modal").classList.add("hidden"); });
  $("course-form").addEventListener("submit", saveCourse);
  $("c-del").addEventListener("click", deleteCourse);
  $("c-type").addEventListener("change", () => { const t = courseTypes.find((x) => x.id === $("c-type").value); if (t) $("c-color").value = t.color; });
  $("c-search").addEventListener("input", renderPlayerChips);
  $("att-close").addEventListener("click", () => $("att-modal").classList.add("hidden"));
  $("att-modal").addEventListener("click", (e) => { if (e.target === $("att-modal")) $("att-modal").classList.add("hidden"); });

  loadTypes();
  loadCoursesCurrent();
}

let coursView = "day";
function loadCoursesCurrent() { return coursView === "week" ? loadCoursesWeek() : loadCoursesDay(); }
function setCoursView(v) {
  if (v === coursView) return;
  coursView = v;
  $("cs-mode-day").classList.toggle("active", v === "day");
  $("cs-mode-week").classList.toggle("active", v === "week");
  $("cs-list").classList.toggle("hidden", v === "week");
  $("cs-week").classList.toggle("hidden", v !== "week");
  $("cs-legend").classList.toggle("hidden", v === "week"); // les présences ne s'éditent qu'en vue Jour
  $("cs-prev").setAttribute("aria-label", v === "week" ? "Semaine précédente" : "Jour précédent");
  $("cs-next").setAttribute("aria-label", v === "week" ? "Semaine suivante" : "Jour suivant");
  loadCoursesCurrent();
}

async function loadTypes() {
  const { data } = await sb.from("course_types").select("*").order("name");
  courseTypes = data || [];
  $("ct-list").innerHTML = courseTypes.length ? courseTypes.map((t) =>
    `<div class="ct-item"><span class="ct-dot" style="background:${t.color}"></span>
      <b>${esc(t.name)}</b>
      ${isAdminUser ? `<button type="button" class="fam-del" data-id="${t.id}">✕</button>` : ""}</div>`).join("")
    : '<p class="muted" style="font-size:.85rem">Aucun type de cours.</p>';
  $("ct-list").querySelectorAll(".fam-del").forEach((b) => b.addEventListener("click", () => deleteType(b.dataset.id)));
  $("c-type").innerHTML = '<option value="">— Type —</option>' +
    courseTypes.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
}

async function addType() {
  const name = $("ct-name").value.trim();
  if (!name) return;
  const { error } = await sb.from("course_types").insert({ name, color: $("ct-color").value });
  if (error) { alert("Impossible : " + (error.code === "23505" ? "ce type existe déjà." : error.message)); return; }
  $("ct-name").value = "";
  loadTypes();
}
async function deleteType(id) {
  // Combien de cours utilisent ce type ?
  const { count } = await sb.from("courses").select("id", { count: "exact", head: true }).eq("course_type_id", id);
  const n = count || 0;
  const msg = n > 0
    ? `Ce type est utilisé par ${n} cours. Ils seront conservés mais repassés « sans type » (leur couleur et leur titre restent). Supprimer ce type ?`
    : "Supprimer ce type de cours ?";
  if (!await uiConfirm(msg)) return;
  if (n > 0) {
    const { error: e1 } = await sb.from("courses").update({ course_type_id: null }).eq("course_type_id", id);
    if (e1) { alert("Impossible de détacher les cours : " + e1.message); return; }
  }
  const { error } = await sb.from("course_types").delete().eq("id", id);
  if (error) { alert("Suppression impossible : " + error.message); return; }
  loadTypes();
}

function shiftCs(delta) {
  const d = new Date($("cs-date").value + "T00:00:00");
  d.setDate(d.getDate() + delta * (coursView === "week" ? 7 : 1));
  $("cs-date").value = isoA(d);
  loadCoursesCurrent();
}

const personName = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.last_name} ${p.first_name}` : "—"; };

// Peut-on marquer cette pastille ? (miroir de la RPC mark_attendance)
function canMarkBox(course, coachIds, pid, isCoach) {
  if (isHeadUser) return true;                     // head/admin/superadmin : tout, tout le temps
  if (!myPersonId || !coachIds.includes(myPersonId)) return false; // doit être coach du cours
  if (isCoach && pid !== myPersonId) return false; // un coach ne marque que sa propre présence
  // Fenêtre : 10 min avant → 2 semaines après. Le coach peut agir sur SA présence à l'avance (absence anticipée).
  const start = new Date(`${course.course_date}T${course.start_time}`).getTime();
  const now = Date.now(), upper = start + 14 * 24 * 3600000;
  const ownCoach = isCoach && pid === myPersonId;
  return ownCoach ? now <= upper : (now >= start - 10 * 60000 && now <= upper);
}
// Tous les jeunes d'un cours ont-ils un statut ? (pré-requis pour que le coach se déclare présent)
function allKidsMarked(courseId) {
  const card = document.querySelector(`.cs-card[data-id="${courseId}"]`);
  if (!card) return true;
  return [...card.querySelectorAll('.att-chip[data-coach="0"]')].every((k) => k.dataset.status);
}

const isBirthday = (pid, dateIso) => { const p = people.find((x) => x.id === pid); return !!(p?.birthdate && dateIso && p.birthdate.slice(5, 10) === dateIso.slice(5, 10)); };
function attChip(course, coachIds, pid, isCoach, status) {
  const can = canMarkBox(course, coachIds, pid, isCoach);
  const cls = status === "present" ? "st-present" : status === "late" ? "st-late"
    : status === "absent" ? "st-absent" : (can ? "st-none" : "st-locked");
  const bday = isBirthday(pid, course.course_date);
  return `<button type="button" class="att-chip ${cls}" data-course="${course.id}" data-person="${pid}"
    data-coach="${isCoach ? 1 : 0}" data-status="${status || ""}" data-can="${can ? 1 : 0}" data-cstart="${course.course_date}T${course.start_time}"
    title="${esc(personName(pid))}${bday ? " · anniversaire 🎁" : ""}">${bday ? "🎁 " : ""}${esc(personName(pid))}</button>`;
}

// Une colonne (Coachs ou Élèves) de pastilles de présence. statusFn(pid) → statut.
function attCol(course, coachIds, list, isCoach, title, statusFn) {
  return `<div class="cs-att-col"><div class="cs-att-h">${title}</div>
    <div class="cs-att-items">${list.length
      ? list.map((pid) => attChip(course, coachIds, pid, isCoach, statusFn(pid))).join("")
      : '<span class="muted" style="font-size:.8rem">—</span>'}</div></div>`;
}

async function loadCoursesDay() {
  const date = $("cs-date").value;
  const { data: courses } = await sb.from("courses").select("*").eq("course_date", date).order("start_time");
  const ids = (courses || []).map((c) => c.id);
  let books = [], coaches = [], parts = [], att = [];
  if (ids.length) {
    [books, coaches, parts, att] = await Promise.all([
      sb.from("court_bookings").select("court_id,course_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_participants").select("course_id,child_person_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("attendance").select("course_id,person_id,status").in("course_id", ids).then((r) => r.data || []),
    ]);
  }
  const courtName = (id) => (resaCourtsAll.find((c) => c.id === id)?.name || "?").replace("Court ", "C");
  const attOf = (cid, pid) => att.find((a) => a.course_id === cid && a.person_id === pid)?.status || "";
  const col = (course, coachIds, list, isCoach, title) => attCol(course, coachIds, list, isCoach, title, (pid) => attOf(course.id, pid));

  // Espace coach (pas manager) : n'afficher QUE les cours où il est coach.
  const shownDay = (!isCourseMgr && myPersonId) ? (courses || []).filter((c) => coaches.some((x) => x.course_id === c.id && x.coach_person_id === myPersonId)) : (courses || []);
  $("cs-list").innerHTML = shownDay.length ? shownDay.map((c) => {
    const cts = books.filter((b) => b.course_id === c.id).map((b) => courtName(b.court_id)).join(", ");
    const coachIds = coaches.filter((x) => x.course_id === c.id).map((x) => x.coach_person_id);
    const childIds = parts.filter((x) => x.course_id === c.id).map((x) => x.child_person_id);
    const type = courseTypes.find((t) => t.id === c.course_type_id);
    const needMore = Math.max(coachIds.length, childIds.length) > 4;
    const nmeOf = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.first_name} ${p.last_name}` : ""; };
    const search = esc([c.title || "", type?.name || "", ...coachIds.map(nmeOf), ...childIds.map(nmeOf)].join(" ").toLowerCase());
    // Cours détaillé (pro/SE + plusieurs courts OU coachs) : les présences des jeunes
    // se gèrent via le détail (head coach) → ici en lecture seule (non cliquables).
    const courtCount = books.filter((b) => b.course_id === c.id).length;
    const detailed = !!type && TR_TYPE_RE.test(type.name || "") && (courtCount > 1 || coachIds.length > 1);
    const elevesCol = detailed
      ? `<div class="cs-att-col"><div class="cs-att-h">Élèves <span class="muted" style="font-weight:400;font-size:.72rem">· via détail</span></div><div class="cs-att-items">${childIds.length ? childIds.map((pid) => { const s = attOf(c.id, pid); const cls = s === "present" ? "st-present" : s === "absent" ? "st-absent" : s === "late" ? "st-late" : "st-none"; return `<span class="att-chip ${cls}" data-can="0" data-detail="1" style="cursor:default" title="${esc(personName(pid))} — présence gérée par le head coach (détail)">${esc(personName(pid))}</span>`; }).join("") : '<span class="muted" style="font-size:.8rem">—</span>'}</div></div>`
      : col(c, coachIds, childIds, false, "Élèves");
    return `<div class="cs-card" data-id="${c.id}" data-search="${search}" style="border-left-color:${type?.color || c.color || "#0b6b3a"}">
      <div class="cs-card-top">
        <div class="cs-time">${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}</div>
        <div class="cs-main"><b>${esc(c.title || type?.name || "Cours")}</b>
          <span class="muted">${type ? esc(type.name) + " · " : ""}Courts ${cts || "—"}</span></div>
        ${needMore ? '<button type="button" class="cs-more">Plus</button>' : ""}
      </div>
      <div class="cs-att">${col(c, coachIds, coachIds, true, "Coachs")}${elevesCol}</div>
    </div>`;
  }).join("") : '<p class="muted">Aucun cours ce jour.</p>';

  const L = $("cs-list");
  L.querySelectorAll(".att-chip").forEach((ch) => ch.addEventListener("click", (e) => { e.stopPropagation(); cycleAtt(ch); }));
  L.querySelectorAll(".cs-more").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const card = b.closest(".cs-card");
    b.textContent = card.classList.toggle("expanded") ? "Réduire" : "Plus";
  }));
  if (isCourseMgr) L.querySelectorAll(".cs-card").forEach((el) =>
    el.addEventListener("click", (e) => { if (e.target.closest(".att-chip,.cs-more")) return; editCourse(el.dataset.id); }));
  filterCoursesDay();
}

function filterCoursesDay() { filterCourses(); }
function filterCourses() {
  const q = ($("cs-search").value || "").trim().toLowerCase();
  if (coursView === "week") {
    document.querySelectorAll("#cs-week .cw-ev").forEach((el) =>
      el.classList.toggle("hidden", !!q && !(el.dataset.search || "").includes(q)));
    document.querySelectorAll("#cs-week .cw-day").forEach((day) => {
      const any = [...day.querySelectorAll(".cw-ev")].some((e) => !e.classList.contains("hidden"));
      day.classList.toggle("hidden", !any);
    });
    return;
  }
  const cards = document.querySelectorAll("#cs-list .cs-card");
  let n = 0;
  cards.forEach((el) => {
    const hit = !q || (el.dataset.search || "").includes(q);
    el.classList.toggle("hidden", !hit);
    if (hit) n++;
  });
  let empty = $("cs-noresult");
  if (q && !n && cards.length) {
    if (!empty) { empty = document.createElement("p"); empty.id = "cs-noresult"; empty.className = "muted"; $("cs-list").appendChild(empty); }
    empty.textContent = "Aucun cours ne correspond.";
    empty.hidden = false;
  } else if (empty) empty.hidden = true;
}

const DOW_ABBR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
async function loadCoursesWeek() {
  const mon = mondayOf($("cs-date").value);
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(mon + "T00:00:00"); d.setDate(d.getDate() + i); days.push(isoA(d)); }
  const sun = days[6];
  const { data: courses } = await sb.from("courses").select("*").gte("course_date", mon).lte("course_date", sun).order("start_time");
  const ids = (courses || []).map((c) => c.id);
  let books = [], coaches = [], parts = [], myatt = [];
  if (ids.length) {
    [books, coaches, parts, myatt] = await Promise.all([
      sb.from("court_bookings").select("court_id,course_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_participants").select("course_id,child_person_id").in("course_id", ids).then((r) => r.data || []),
      myPersonId ? sb.from("attendance").select("course_id,status").eq("person_id", myPersonId).eq("is_coach", true).in("course_id", ids).then((r) => r.data || []) : Promise.resolve([]),
    ]);
  }
  const myAttOf = {}; myatt.forEach((a) => (myAttOf[a.course_id] = a.status)); // ma validation (coach) par cours
  const courtName = (id) => (resaCourtsAll.find((c) => c.id === id)?.name || "?").replace("Court ", "C");
  const nmeOf = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.first_name} ${p.last_name}` : ""; };
  const firstOf = (pid) => people.find((x) => x.id === pid)?.first_name || "";
  const evHtml = (c) => {
    const cts = books.filter((b) => b.course_id === c.id).map((b) => courtName(b.court_id)).join(", ");
    const coachIds = coaches.filter((x) => x.course_id === c.id).map((x) => x.coach_person_id);
    const childIds = parts.filter((x) => x.course_id === c.id).map((x) => x.child_person_id);
    const type = courseTypes.find((t) => t.id === c.course_type_id);
    const coachNames = coachIds.filter(firstOf).map((id) => (isBirthday(id, c.course_date) ? "🎁 " : "") + firstOf(id));
    const coachStr = coachNames.slice(0, 3).join(", ") + (coachNames.length > 3 ? ` +${coachNames.length - 3}c` : "");
    const childBday = childIds.some((id) => isBirthday(id, c.course_date));
    const search = esc([c.title || "", type?.name || "", ...coachIds.map(nmeOf), ...childIds.map(nmeOf)].join(" ").toLowerCase());
    const mySt = myAttOf[c.id];
    const stCls = mySt === "present" ? " cw-present" : mySt === "absent" ? " cw-absent" : "";
    return `<div class="cw-ev${stCls}" data-id="${c.id}" data-date="${c.course_date}" data-search="${search}" style="border-left-color:${type?.color || c.color || "#0b6b3a"}">
      <div class="cw-ev-t">${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}</div>
      <div class="cw-ev-n">${esc(c.title || type?.name || "Cours")}</div>
      <div class="cw-ev-m muted">${cts || "—"}${childIds.length ? " · " + childIds.length + "j" : ""}${childBday ? " 🎁" : ""}</div>
      ${coachStr ? `<div class="cw-ev-co">${esc(coachStr)}</div>` : ""}
    </div>`;
  };
  const today = isoA(new Date());
  // Espace coach (pas manager) : n'afficher QUE les cours où il est coach.
  const shownWk = (!isCourseMgr && myPersonId) ? (courses || []).filter((c) => coaches.some((x) => x.course_id === c.id && x.coach_person_id === myPersonId)) : (courses || []);
  const filled = days.map((iso, i) => ({ iso, i, dc: shownWk.filter((c) => c.course_date === iso) })).filter((x) => x.dc.length);
  $("cs-week").innerHTML = filled.length ? filled.map(({ iso, i, dc }) => {
    const dd = iso.slice(8, 10) + "." + iso.slice(5, 7);
    return `<div class="cw-day${iso === today ? " cw-today" : ""}">
      <div class="cw-dh"><span><b>${DOW_ABBR[i]}</b> ${dd}</span>${isCourseMgr ? `<button type="button" class="cw-add" data-d="${iso}" title="Nouveau cours ce jour">+</button>` : ""}</div>
      <div class="cw-evs">${dc.map(evHtml).join("")}</div>
    </div>`;
  }).join("") : '<p class="muted">Aucun cours cette semaine.</p>';
  const W = $("cs-week");
  // Clic sur un cours de la semaine → bascule en vue Jour ce jour-là (cours + participants + appel).
  W.querySelectorAll(".cw-ev").forEach((el) => el.addEventListener("click", () => { $("cs-date").value = el.dataset.date; setCoursView("day"); }));
  if (isCourseMgr) {
    W.querySelectorAll(".cw-add").forEach((b) => b.addEventListener("click", () => { $("cs-date").value = b.dataset.d; openCourse(null); }));
  }
  filterCourses();
}

// Clic sur une pastille : blanc → vert → rouge → orange → blanc
async function cycleAtt(chip) {
  if (chip.dataset.can !== "1") { // verrouillé → on explique pourquoi (popup)
    const cstart = chip.dataset.cstart ? new Date(chip.dataset.cstart).getTime() : 0, now = Date.now();
    if (chip.dataset.detail === "1") uiAlert("Sur ce cours (pro / sport-études), les présences des jeunes sont gérées par le head coach via le détail de la séance.");
    else if (chip.dataset.coach === "1") uiAlert("Vous ne pouvez marquer que votre propre présence.");
    else if (cstart && now < cstart - 10 * 60000) uiAlert("L'appel des jeunes ouvre 10 minutes avant le début du cours — pas avant.");
    else if (cstart && now > cstart + 14 * 24 * 3600000) uiAlert("Appel clos (2 semaines écoulées). Demande à un head coach / admin.");
    else uiAlert("Cette présence n'est pas modifiable pour le moment.");
    return;
  }
  const course = chip.dataset.course, pid = chip.dataset.person, isCoach = chip.dataset.coach === "1";
  const cur = chip.dataset.status || "";
  let next;
  if (isCoach) {
    // Coach : présent / absent uniquement (jamais « en retard »).
    // Avant l'ouverture (10 min avant) → seulement l'absence anticipée ; en fenêtre → présent si tous les jeunes marqués.
    const cstart = chip.dataset.cstart ? new Date(chip.dataset.cstart).getTime() : 0;
    const inWindow = !chip.dataset.cstart || Date.now() >= cstart - 10 * 60000;
    const kidsPending = !allKidsMarked(course);
    const blockPresent = !isHeadUser && pid === myPersonId && (!inWindow || kidsPending);
    if (cur === "") {
      next = blockPresent ? "absent" : "present";
      // En fenêtre mais jeunes pas tous validés : on explique pourquoi « présent » est indisponible.
      if (blockPresent && inWindow && kidsPending)
        uiAlert("Tu ne peux pas te déclarer présent tant que tous les jeunes ne sont pas validés. Tu es noté absent pour l'instant — reclique pour effacer.");
    } else if (cur === "present") next = "absent";
    else next = null; // absent (ou ancien statut) → efface
  } else {
    // Élève : blanc → présent → absent → en retard → blanc.
    next = cur === "" ? "present" : cur === "present" ? "absent" : cur === "absent" ? "late" : null;
  }
  chip.disabled = true;
  const { error } = next === null
    ? await sb.rpc("clear_attendance", { p_course: course, p_person: pid, p_is_coach: isCoach })
    : await sb.rpc("mark_attendance", { p_course: course, p_person: pid, p_status: next, p_is_coach: isCoach });
  chip.disabled = false;
  if (error) { alert(error.message); return; }
  chip.dataset.status = next || "";
  chip.classList.remove("st-present", "st-late", "st-absent", "st-none", "st-locked");
  chip.classList.add(next === "present" ? "st-present" : next === "late" ? "st-late" : next === "absent" ? "st-absent" : "st-none");
}

// ---- Présences ----
let attCourse = null;
const ATT_STATUS = [["present", "Présent"], ["absent", "Absent"], ["late", "En retard"]];

async function openAttendance(courseId) {
  const course = (await sb.from("courses").select("*").eq("id", courseId).single()).data;
  attCourse = course;
  const [parts, coaches, att, vals] = await Promise.all([
    sb.from("course_participants").select("child_person_id").eq("course_id", courseId).then((r) => (r.data || []).map((x) => x.child_person_id)),
    sb.from("course_coaches").select("coach_person_id").eq("course_id", courseId).then((r) => (r.data || []).map((x) => x.coach_person_id)),
    sb.from("attendance").select("*").eq("course_id", courseId).then((r) => r.data || []),
    sb.from("course_validation").select("coach_person_id").eq("course_id", courseId).then((r) => (r.data || []).map((x) => x.coach_person_id)),
  ]);
  const statusOf = (pid) => att.find((a) => a.person_id === pid)?.status || null;
  const nameOf = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.last_name} ${p.first_name}` : "—"; };

  $("att-title").textContent = `Présences — ${course.title || "cours"} (${course.start_time.slice(0, 5)})`;
  const allKids = parts.length ? parts.every((pid) => statusOf(pid)) : true;
  $("att-note").textContent = isHeadUser
    ? "Cliquez pour marquer présent / absent / en retard."
    : "Appel ouvert de 10 min avant le début à 2 semaines après. Déclare-toi présent une fois tous les jeunes appelés.";

  $("att-children").innerHTML = parts.length ? parts.map((pid) => attRow(pid, nameOf(pid), statusOf(pid), false)).join("") : '<p class="muted" style="font-size:.85rem">Aucun enfant.</p>';
  // Le coach ne peut se déclarer présent / en retard que si tous les jeunes ont un statut (il peut toujours se mettre absent).
  $("att-coaches").innerHTML = coaches.length ? coaches.map((pid) => attRow(pid, nameOf(pid), statusOf(pid), true, pid === myPersonId && !isHeadUser && !allKids)).join("") : '<p class="muted" style="font-size:.85rem">Aucun coach.</p>';
  $("att-modal").querySelectorAll(".att-set").forEach((b) =>
    b.addEventListener("click", () => markAtt(b.dataset.person, b.dataset.status, b.dataset.coach === "1")));
  renderAttValidate(courseId, coaches, vals);
  $("att-modal").classList.remove("hidden");
}

function renderAttValidate(courseId, coaches, vals) {
  const host = $("att-validate"); if (!host) return;
  const iAmCoach = myPersonId && coaches.includes(myPersonId);
  if (iAmCoach) {
    const mine = vals.includes(myPersonId);
    host.innerHTML = mine
      ? `<span class="he-val">✓ Cours validé — compté dans tes heures</span> <button type="button" id="att-toggle-val" class="ghost">Annuler</button>`
      : `<button type="button" id="att-toggle-val">Valider ce cours (mes heures)</button> <span class="muted" style="font-size:.82rem">À faire une fois les présences saisies.</span>`;
    $("att-toggle-val").addEventListener("click", () => toggleCourseValidation(courseId, mine));
  } else {
    host.innerHTML = vals.length
      ? `<span class="he-val">✓ Validé par le coach</span>`
      : `<span class="muted" style="font-size:.85rem">Pas encore validé par le coach.</span>`;
  }
}
async function toggleCourseValidation(courseId, mine) {
  if (mine) await sb.from("course_validation").delete().eq("course_id", courseId).eq("coach_person_id", myPersonId);
  else { const { error } = await sb.from("course_validation").insert({ course_id: courseId, coach_person_id: myPersonId }); if (error) { alert(error.message); return; } }
  openAttendance(courseId);
}

function attRow(pid, name, status, isCoach, lockPresent) {
  // Coach : pas de « en retard » — seulement présent / absent.
  const list = isCoach ? ATT_STATUS.filter(([s]) => s !== "late") : ATT_STATUS;
  const btns = list.map(([s, l]) => {
    const dis = lockPresent && s !== "absent"; // « présent » bloqué tant que les jeunes ne sont pas tous pointés
    return `<button type="button" class="att-set st-${s} ${status === s ? "on" : ""}" ${dis ? "disabled" : ""} data-person="${pid}" data-status="${s}" data-coach="${isCoach ? 1 : 0}">${l}</button>`;
  }).join("");
  const hint = lockPresent ? `<span class="att-hint muted">Marque d'abord tous les jeunes pour pouvoir te déclarer présent.</span>` : "";
  return `<div class="att-row"><span class="att-name">${esc(name)}</span><div class="att-btns">${btns}</div>${hint}</div>`;
}

async function markAtt(personId, status, isCoach) {
  const { error } = await sb.rpc("mark_attendance", {
    p_course: attCourse.id, p_person: personId, p_status: status, p_is_coach: isCoach,
  });
  if (error) { alert(error.message); return; }
  openAttendance(attCourse.id); // refresh
}

// ===================================================================
//  GameZone — saisons + catégories de tarifs (Phase 1)
// ===================================================================
let gzRoles = [], gzPersonId = null, gzIsOfficial = false;

async function initGameZone(roles) {
  gzRoles = roles || [];
  gzIsOfficial = gzRoles.some((r) => ["superadmin", "admin", "organisateur"].includes(r));
  const { data: prof } = await sb.from("profiles").select("person_id").eq("user_id", meId).maybeSingle();
  gzPersonId = prof?.person_id || null;
  if (!gzIsOfficial) {
    document.querySelector('#view-gamezone .subtab[data-sub="reglages"]')?.classList.add("hidden");
    document.querySelector('#view-gamezone .subtab[data-sub="participants"]')?.classList.add("hidden");
    document.querySelector('#view-gamezone .subtab[data-sub="financier"]')?.classList.add("hidden");
    document.querySelector('#view-gamezone .subtab[data-sub="communication"]')?.classList.add("hidden");
    document.querySelector('#view-gamezone .subtab[data-sub="sondages"]')?.classList.add("hidden");
    document.querySelector('#view-gamezone .subtab[data-sub="site"]')?.classList.add("hidden");
    $("gz-bm-card")?.classList.add("hidden");
    $("gz-official-box")?.classList.add("hidden");
  }
  $("gz-fin-season").addEventListener("change", renderFinance);
  $("gz-part-search").addEventListener("input", renderParts);
  document.querySelectorAll('#gz-sub-participants th[data-sort]').forEach((th) =>
    th.addEventListener("click", () => { gzPartSort = th.dataset.sort; renderParts(); }));
  $("gz-season-new").addEventListener("click", createSeason);
  $("gz-cat-new").addEventListener("click", createCat);
  $("gz-survey-new").addEventListener("click", () => createSurvey("gamezone"));
  document.querySelectorAll("#view-gamezone .subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-gamezone .subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-gamezone .gz-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "gz-sub-" + b.dataset.sub));
      if (b.dataset.sub === "participants") loadParticipantsTab();
      if (b.dataset.sub === "financier") loadFinanceTab();
      if (b.dataset.sub === "communication") loadMailTab();
      if (b.dataset.sub === "sondages") loadSurveyTab("gamezone");
      if (b.dataset.sub === "site") loadSiteTab();
    }));
  $("gz-detail-back").addEventListener("click", closeDetail);
  $("gz-resp-add").addEventListener("click", addResponsable);
  $("gz-mov-add").addEventListener("click", addMovement);
  $("gz-mgr-cat").addEventListener("change", async () => {
    await sb.from("gz_tournaments").update({ price_category_id: $("gz-mgr-cat").value || null }).eq("id", mgrTid);
    renderMgr();
  });
  $("gz-mgr-gz").addEventListener("change", async () => {
    mgrIsGz = $("gz-mgr-gz").checked;
    await sb.from("gz_tournaments").update({ is_gamezone: mgrIsGz }).eq("id", mgrTid);
    renderMgr();
  });
  $("gz-mgr-url").addEventListener("change", async () => {
    const v = $("gz-mgr-url").value.trim();
    await sb.from("gz_tournaments").update({ registration_url: v || null }).eq("id", mgrTid);
  });
  $("gz-pay-add").addEventListener("click", addPayment);
  $("gz-sal-add").addEventListener("click", addSalary);
  $("gz-sal-person").addEventListener("change", () => {
    const other = $("gz-sal-person").value === "autre";
    $("gz-sal-name").classList.toggle("hidden", !other);
    if (other) $("gz-sal-name").focus();
  });
  $("gz-caisse-start").addEventListener("change", saveCaisse);
  $("gz-caisse-counted").addEventListener("change", saveCaisse);
  $("gz-close-tournament").addEventListener("click", closeTournament);
  $("gz-text-form").addEventListener("submit", saveGzNote);
  document.querySelector("[data-close-gztext]").addEventListener("click", () => $("gz-text-modal").classList.add("hidden"));
  $("gz-text-modal").addEventListener("click", (e) => { if (e.target === $("gz-text-modal")) $("gz-text-modal").classList.add("hidden"); });
  loadSeasons();
  loadCats();
  loadTournaments();
  loadBookmarklet();
}

async function loadMtBookmarklet() {
  const { data } = await sb.from("gz_config").select("import_key").maybeSingle();
  if (!data) { $("mt-bm-note").textContent = "Clé d'import indisponible (droits admin requis)."; return; }
  let src;
  try { src = await (await fetch("mt-bookmarklet.js")).text(); }
  catch (_e) { $("mt-bm-note").textContent = "Impossible de charger le bookmarklet."; return; }
  const code = src.replace("__KEY__", data.import_key).replace("__RCV__", location.origin + "/mt-receiver.html");
  const a = document.createElement("a");
  a.href = "javascript:" + encodeURIComponent(code);
  a.textContent = "Importer les matchs";
  a.className = "btn-prod";
  a.style.textDecoration = "none";
  a.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Ne cliquez pas ici : GLISSEZ ce bouton dans votre barre de favoris, puis utilisez-le une fois connecté sur mytennis.ch.");
  });
  $("mt-bm-holder").innerHTML = "";
  $("mt-bm-holder").appendChild(a);
  $("mt-bm-note").textContent = "Astuce : glissez-le dans la barre de favoris (ou clic droit → Ajouter aux favoris).";
}

async function loadBookmarklet() {
  const { data } = await sb.from("gz_config").select("import_key").maybeSingle();
  if (!data) { $("gz-bm-note").textContent = "Clé d'import indisponible (droits admin requis)."; return; }
  let src;
  try { src = await (await fetch("bookmarklet.js")).text(); }
  catch (_e) { $("gz-bm-note").textContent = "Impossible de charger le bookmarklet."; return; }
  const code = src
    .replace("__KEY__", data.import_key)
    .replace("__RCV__", location.origin + "/gz-receiver.html");
  const a = document.createElement("a");
  a.href = "javascript:" + encodeURIComponent(code);
  a.textContent = "Importer GameZone";
  a.className = "btn-prod";
  a.style.textDecoration = "none";
  a.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Ne cliquez pas ici : GLISSEZ ce bouton dans votre barre de favoris, puis utilisez-le une fois connecté sur la page Swiss Tennis.");
  });
  $("gz-bm-holder").innerHTML = "";
  $("gz-bm-holder").appendChild(a);
  $("gz-bm-note").textContent = "Astuce : glissez-le dans la barre de favoris (ou clic droit → Ajouter aux favoris).";
  // Tablette/mobile : pas de barre de favoris -> copier le code pour le coller dans l'URL d'un favori.
  const copyBtn = $("gz-bm-copy"), copySt = $("gz-bm-copystatus");
  if (copyBtn) copyBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(a.href); if (copySt) copySt.textContent = "✓ Code copié — collez-le dans l'URL du favori."; }
    catch (_e) {
      const ta = document.createElement("textarea"); ta.value = a.href; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand("copy"); if (copySt) copySt.textContent = "✓ Code copié."; }
      catch (_e2) { if (copySt) copySt.textContent = "Copie auto impossible — sélectionnez le champ et copiez à la main."; }
      ta.remove();
    }
  };
}

async function loadTournaments() {
  const [{ data: tournaments }, { data: cnts }, { data: seasons }] = await Promise.all([
    sb.from("gz_tournaments").select("*").order("tournament_date", { ascending: false, nullsFirst: false }),
    sb.from("gz_tournament_counts").select("tournament_id,inscrits,selectionnes"),
    sb.from("gz_seasons").select("id,name,start_date,end_date").order("start_date", { ascending: false }),
  ]);
  const counts = {};
  for (const c of cnts || []) counts[c.tournament_id] = { p: c.inscrits, s: c.selectionnes };
  let rows = tournaments || [];
  if (!gzIsOfficial) {
    const { data: mine } = await sb.from("gz_managers").select("tournament_id").eq("person_id", gzPersonId);
    const allowed = new Set((mine || []).map((m) => m.tournament_id));
    rows = rows.filter((t) => allowed.has(t.id) && t.status !== "Clôturé");
  }
  $("gz-tourn-count").textContent = rows.length ? `${rows.length} tournoi(s)` : "";
  const seasonName = {};
  for (const s of seasons || []) seasonName[s.id] = s.name;
  const seasonOfDate = (d) => {
    if (!d) return "none";
    const s = (seasons || []).find((x) => d >= x.start_date && d <= x.end_date);
    return s ? s.id : "none";
  };
  const groups = {};
  for (const t of rows) { const k = seasonOfDate(t.tournament_date); (groups[k] || (groups[k] = [])).push(t); }
  const order = (seasons || []).map((s) => s.id).concat("none");
  let html = "";
  for (const sid of order) {
    const g = groups[sid];
    if (!g || !g.length) continue;
    html += `<h3 class="gz-season-h">${sid === "none" ? "Hors saison" : esc(seasonName[sid] || "—")} <span class="muted" style="font-weight:400">(${g.length})</span></h3>`;
    html += `<div class="table-wrap" style="margin-bottom:16px"><table class="crm-table"><thead><tr><th>Tournoi</th><th>Date</th><th>Statut</th><th>Inscrits</th><th>Sélect.</th></tr></thead><tbody>`;
    let ti = 0, ts = 0;
    for (const t of g) {
      const c = counts[t.id] || { p: 0, s: 0 };
      ti += c.p; ts += c.s;
      const drawn = /peuvent être joués|visibles au public/i.test((t.status || "") + JSON.stringify(t.epreuves || ""));
      const badge = t.is_gamezone ? '<span class="gz-badge">GameZone</span>' : '<span class="gz-badge off">autre</span>';
      html += `<tr class="gz-trow" data-tid="${t.id}"><td>${badge} ${esc(t.name || "—")}</td><td>${t.tournament_date ? frDate(t.tournament_date) : "—"}</td><td>${esc(t.status || "—")}${drawn ? " ✓" : ""}</td><td>${c.p}</td><td>${c.s}</td></tr>`;
    }
    html += `<tr class="gz-total"><td colspan="3">Total — ${g.length} tournoi(s)</td><td>${ti}</td><td>${ts}</td></tr>`;
    html += "</tbody></table></div>";
  }
  $("gz-tournaments-groups").innerHTML = html || '<p class="muted">Aucun tournoi importé. Utilisez le bookmarklet ci-dessous.</p>';
  $("gz-tournaments-groups").querySelectorAll(".gz-trow").forEach((r) =>
    r.addEventListener("click", () => openTournamentMgr(r.dataset.tid)));
}

// ---- Gestion d'un tournoi (responsable) ----
let mgrTid = null, mgrCats = [], mgrPlayers = [], mgrIsGz = false;

async function openTournamentMgr(tid) {
  mgrTid = tid;
  const { data: t } = await sb.from("gz_tournaments").select("*").eq("id", tid).single();
  mgrIsGz = !!t.is_gamezone;
  mgrTournamentName = t.name || "Tournoi";
  $("gz-mgr-title").textContent = `Gérer — ${t.name || "tournoi"}${t.tournament_date ? " (" + frDate(t.tournament_date) + ")" : ""}`;
  $("gz-mgr-gz").checked = mgrIsGz;
  $("gz-mgr-url").value = t.registration_url || "";
  const { data: cats } = await sb.from("gz_price_categories").select("*").order("created_at");
  mgrCats = cats || [];
  $("gz-mgr-cat").innerHTML = '<option value="">— catégorie de tarifs —</option>' +
    mgrCats.map((c) => `<option value="${c.id}" ${c.id === t.price_category_id ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  const { data: entries } = await sb.from("gz_entries").select("participant_id,comment").eq("tournament_id", tid).eq("confirmed", true);
  const remarkByPid = {};
  for (const e of entries || []) { if (e.comment && !remarkByPid[e.participant_id]) remarkByPid[e.participant_id] = e.comment; }
  const ids = [...new Set((entries || []).map((e) => e.participant_id))];
  if (!ids.length) {
    $("gz-mgr-players").innerHTML = '<tr><td colspan="7" class="muted">Aucun joueur sélectionné (tirage pas encore fait ?).</td></tr>';
    $("gz-mgr-totals").innerHTML = "";
  } else {
    const { data: parts } = await sb.from("gz_participants").select("*").in("id", ids);
    const { data: statuses } = await sb.from("gz_player_status").select("*").eq("tournament_id", tid);
    const stMap = {}; for (const s of statuses || []) stMap[s.participant_id] = s;
    mgrPlayers = (parts || []).sort((a, b) => (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name))
      .map((p) => ({ p, st: stMap[p.id] || {}, remark: remarkByPid[p.id] || null }));
    renderMgr();
  }
  $("gz-close-status").textContent = "";
  await loadFinances(tid);
  if (gzIsOfficial) loadResponsables(tid);
  renderGzMailActions(tid);
  $("gz-list-wrap").classList.add("hidden");
  $("gz-detail").classList.remove("hidden");
  window.scrollTo(0, 0);
}

function closeDetail() {
  $("gz-detail").classList.add("hidden");
  $("gz-list-wrap").classList.remove("hidden");
  loadTournaments();
}

// Envois e-mails d'un tournoi (depuis tournoi@). Un « tournoi » regroupe plusieurs
// épreuves (tableaux) : l'ANNULATION est PAR ÉPREUVE. Remerciement/Vainqueur aussi
// automatiques le lundi 11h (cron gz-mails-lundi).
async function renderGzMailActions(tid) {
  const box = $("gz-mail-actions"); if (!box) return;
  box.innerHTML = `<h3 style="margin-top:0">Envois e-mails <span class="muted" style="font-weight:400;font-size:.85rem">— depuis tournoi@</span></h3><p class="muted" style="font-size:.85rem">Chargement…</p>`;
  const { data: tt } = await sb.from("gz_tournaments").select("tournament_date").eq("id", tid).maybeSingle();
  const d = tt?.tournament_date ? new Date(tt.tournament_date + "T12:00:00") : new Date();
  const mo = d.getMonth() + 1, day = d.getDate();
  const ete = (mo > 4 && mo < 10) || (mo === 4 && day >= 15) || (mo === 10 && day < 15);
  const welcomeKey = ete ? "welcome_ete" : "welcome_hiver";
  const [{ data: entries }, { data: status }, { data: sent }] = await Promise.all([
    sb.from("gz_entries").select("participant_id,confirmed,epreuve").eq("tournament_id", tid),
    sb.from("gz_player_status").select("participant_id,absent,is_winner,photo_url").eq("tournament_id", tid),
    sb.from("gz_mail_sent").select("participant_id,template_key").eq("tournament_id", tid),
  ]);
  const allIds = [...new Set((entries || []).map((e) => e.participant_id).concat((status || []).map((s) => s.participant_id)))];
  const { data: parts } = allIds.length ? await sb.from("gz_participants").select("id,first_name,last_name,email").in("id", allIds) : { data: [] };
  const pInfo = {}; (parts || []).forEach((p) => (pInfo[p.id] = p));
  const emailOk = (id) => { const p = pInfo[id]; return !!(p && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || "")); };
  const nm = (id) => { const p = pInfo[id] || {}; return `${p.first_name || ""} ${p.last_name || ""}`.trim() || "?"; };
  const absent = new Set((status || []).filter((s) => s.absent).map((s) => s.participant_id));
  const doneKey = (key) => new Set((sent || []).filter((s) => s.template_key === key).map((s) => s.participant_id));
  // Classement par épreuve : un tableau SANS aucun confirmé = annulé ; les non-confirmés
  // d'un tableau QUI A des confirmés = vraie liste d'attente.
  const epConfirmed = {}; (entries || []).forEach((e) => { const ep = e.epreuve || "—"; if (!(ep in epConfirmed)) epConfirmed[ep] = false; if (e.confirmed) epConfirmed[ep] = true; });
  const cancelledEps = [...new Set((entries || []).map((e) => e.epreuve || "—"))].filter((ep) => !epConfirmed[ep]).sort();
  const idsFor = (key) => {
    let ids;
    if (key.startsWith("welcome")) ids = (entries || []).filter((e) => e.confirmed).map((e) => e.participant_id);
    else if (key === "non_selection") ids = (entries || []).filter((e) => !e.confirmed && epConfirmed[e.epreuve || "—"]).map((e) => e.participant_id);
    else if (key === "remerciement") ids = (entries || []).filter((e) => e.confirmed).map((e) => e.participant_id).filter((pid) => !absent.has(pid));
    else if (key === "vainqueur") ids = (status || []).filter((s) => s.is_winner && s.photo_url).map((s) => s.participant_id);
    else ids = [];
    const done = doneKey(key);
    return [...new Set(ids)].filter((id) => emailOk(id) && !done.has(id));
  };
  const annulIdsFor = (ep) => {
    const ids = [...new Set((entries || []).filter((e) => (e.epreuve || "—") === ep).map((e) => e.participant_id))];
    const done = doneKey("annulation");
    return ids.filter((id) => emailOk(id) && !done.has(id));
  };
  const lists = {}; let ri = 0;
  const row = (label, auto, ids, doneN, key, epreuve) => {
    const n = ids.length, idx = ri++; lists[idx] = ids;
    return `<div class="gz-send-row"><span class="gz-send-lbl">${esc(label)}${auto ? ` <span class="gz-send-auto">${auto}</span>` : ""}</span>`
      + `<button type="button" class="gz-send-count-link" data-list="${idx}" ${n ? "" : "disabled"}>${n} à envoyer${doneN ? ` · ${doneN} envoyé` : ""}</button>`
      + `<button type="button" class="ghost gz-send-btn" data-key="${key}"${epreuve != null ? ` data-epreuve="${esc(epreuve)}"` : ""} data-n="${n}" ${n ? "" : "disabled"}>Envoyer${n ? ` (${n})` : ""}</button></div>`;
  };
  let html = `<h3 style="margin-top:0">Envois e-mails <span class="muted" style="font-weight:400;font-size:.85rem">— depuis tournoi@teamlausanne.ch</span></h3>`;
  html += row("Bienvenue — sélectionnés", "", idsFor(welcomeKey), doneKey(welcomeKey).size, welcomeKey);
  html += row("Non-sélection — liste d'attente", "", idsFor("non_selection"), doneKey("non_selection").size, "non_selection");
  html += `<div class="gz-send-sub">Annulation — tableaux sans aucun sélectionné</div>`;
  html += cancelledEps.length ? cancelledEps.map((ep) => {
    const doneN = (sent || []).filter((s) => s.template_key === "annulation" && (entries || []).some((e) => e.participant_id === s.participant_id && (e.epreuve || "—") === ep)).length;
    return row(`Annuler « ${ep} »`, "", annulIdsFor(ep), doneN, "annulation", ep);
  }).join("") : '<p class="muted" style="font-size:.84rem">Aucun tableau annulé (tous ont au moins un sélectionné).</p>';
  html += `<div class="gz-send-sub">Après le tournoi</div>`;
  html += row("Remerciements — sélectionnés présents", "auto lundi 11h", idsFor("remerciement"), doneKey("remerciement").size, "remerciement");
  html += row("Vainqueurs — avec photo", "auto lundi 11h", idsFor("vainqueur"), doneKey("vainqueur").size, "vainqueur");
  box.innerHTML = html;
  box.querySelectorAll(".gz-send-count-link").forEach((b) => b.addEventListener("click", () => gzShowRecipients(lists[b.dataset.list] || [], pInfo, nm)));
  box.querySelectorAll(".gz-send-btn").forEach((b) => b.addEventListener("click", () => gzSend(tid, b.dataset.key, b, b.dataset.epreuve || null, +b.dataset.n || 0)));
}
// Popup liste des destinataires : nom en gras bleu + email, sur 2 colonnes.
function gzShowRecipients(ids, pInfo, nm) {
  const ov = document.createElement("div");
  ov.className = "ui-modal";
  const items = ids.length
    ? ids.map((id) => `<div class="gz-rec"><b class="gz-recname">${esc(nm(id))}</b> <span class="gz-recmail">${esc(pInfo[id]?.email || "(sans email)")}</span></div>`).join("")
    : '<p class="muted" style="grid-column:1/-1">Aucun destinataire.</p>';
  ov.innerHTML = `<div class="ui-box gz-rec-box"><p class="ui-msg">${ids.length} destinataire(s)</p><div class="gz-reclist">${items}</div><div class="ui-actions"><button type="button" class="ui-btn ui-yes">OK</button></div></div>`;
  document.body.appendChild(ov);
  const done = () => ov.remove();
  ov.querySelector(".ui-yes").addEventListener("click", done);
  ov.addEventListener("click", (e) => { if (e.target === ov) done(); });
}
async function gzSend(tid, key, btn, epreuve, n) {
  // « Bienvenue » mentionne le(s) responsable(s) → impossible sans au moins un responsable nommé.
  if (key.startsWith("welcome")) {
    const { count } = await sb.from("gz_managers").select("tournament_id", { count: "exact", head: true }).eq("tournament_id", tid);
    if (!count) { uiAlert("Nomme au moins un responsable du tournoi avant d'envoyer la « Bienvenue » (ce mail indique le/les responsable(s))."); return; }
  }
  const cible = epreuve ? `la catégorie « ${epreuve} »` : "tous les destinataires concernés";
  if (!(await uiConfirm(`Envoyer ce mail à ${n || "les"} destinataire(s) — ${cible} — depuis tournoi@teamlausanne.ch ?`))) return;
  btn.disabled = true;
  let total = 0;
  try {
    for (let pass = 0; pass < 40; pass++) {
      btn.textContent = `Envoi… (${total})`;
      const body = { tournament_id: tid, key };
      if (epreuve) body.epreuve = epreuve;
      const { data, error } = await sb.functions.invoke("gz-notify", { body });
      if (error) { let m = error.message; try { m = (await error.context.json())?.error || m; } catch (_) {} uiAlert("Envoi : " + m); break; }
      if (data?.error) { uiAlert("Envoi : " + data.error); break; }
      total += data?.sent || 0;
      if (!data || data.remaining <= 0 || (data.sent || 0) === 0) break;
    }
    uiAlert(`✓ ${total} e-mail(s) envoyé(s).`);
  } catch (e) { uiAlert("Envoi impossible : " + (e?.message || e)); }
  renderGzMailActions(tid);
}

// Seules les personnes taguées « Responsable de tournoi » dans le répertoire.
const RESP_CANDIDATE_ROLES = ["responsable-tournoi"];
async function loadResponsables(tid) {
  // Passe par la fonction serveur gz_resp_people : un OFFICIAL (organisateur) n'est
  // pas "staff", donc la RLS lui interdit de lire person_roles / le repertoire people.
  // La fonction (SECURITY DEFINER) renvoie candidats + deja-nommes avec leur nom,
  // pour les officials comme pour le staff. Zero dependance a l'etat en memoire.
  const { data: rows, error } = await sb.rpc("gz_resp_people", { p_tid: tid });
  if (error) console.warn("gz_resp_people:", error.message);
  const all = rows || [];
  const named = all.filter((r) => r.named);
  $("gz-resp-list").innerHTML = named.length
    ? named.map((p) => `<span class="gz-badge" style="background:var(--fluo-d);color:var(--fluo-ink)">${esc(p.last_name)} ${esc(p.first_name)} <b class="gz-resp-del" data-id="${p.person_id}" style="cursor:pointer">×</b></span>`).join(" ")
    : '<span class="muted" style="font-size:.85rem">Aucun responsable nommé.</span>';
  $("gz-resp-list").querySelectorAll(".gz-resp-del").forEach((b) =>
    b.addEventListener("click", async () => { await sb.from("gz_managers").delete().eq("tournament_id", tid).eq("person_id", b.dataset.id); loadResponsables(tid); loadFinances(tid); }));
  const elig = all.filter((r) => !r.named);
  $("gz-resp-select").innerHTML = elig.length
    ? '<option value="">— choisir une personne à nommer —</option>' + elig.map((p) => `<option value="${p.person_id}">${esc(p.last_name)} ${esc(p.first_name)}</option>`).join("")
    : '<option value="">— aucun « Responsable de tournoi » disponible —</option>';
}

async function addResponsable() {
  const pid = $("gz-resp-select").value;
  if (!pid) return;
  await sb.from("gz_managers").insert({ tournament_id: mgrTid, person_id: pid });
  $("gz-resp-select").value = "";
  loadResponsables(mgrTid); loadFinances(mgrTid);
}

function priceOpts() {
  const cat = mgrCats.find((c) => c.id === $("gz-mgr-cat").value);
  return cat && Array.isArray(cat.prices) ? cat.prices : [];
}

const gzShort = (s, n = 34) => { s = String(s || ""); return s.length > n ? esc(s.slice(0, n)) + "…" : esc(s); };
// Couleur de ligne : payé = vert clair, absent = rouge clair (pour voir qui est coché)
function gzRowClass(st) {
  if (st.absent) return "gz-abs";
  if (st.amount_paid != null) return "gz-paid";
  return "";
}

function renderMgr() {
  const opts = priceOpts();
  $("gz-mgr-players").innerHTML = mgrPlayers.map(({ p, st, remark }) => {
    const amtOpts = ['<option value="">—</option>', '<option value="0">Gratuit</option>']
      .concat(opts.map((o) => `<option value="${o.amount}" ${Number(st.amount_paid) === Number(o.amount) ? "selected" : ""}>${esc(o.label)} — ${o.amount}</option>`)).join("");
    const method = (m) => `<option value="${m}" ${st.pay_method === m ? "selected" : ""}>${m}</option>`;
    const credit = Number(p.credit_chf || 0);
    return `<tr data-pid="${p.id}" class="${gzRowClass(st)}">
      <td class="gz-col-player">
        <div class="gz-name"><b>${esc(p.last_name)} ${esc(p.first_name)}</b>${st.is_winner ? " " + ICO_CUP : ""}</div>
        <div class="gz-sub">
          ${p.club ? `<span class="gz-club">${esc(p.club)}</span>` : ""}
          ${remark ? `<button type="button" class="gz-remark" title="Remarque importée (mytennis)">💬 ${gzShort(remark, 28)}</button>` : ""}
        </div>
      </td>
      <td class="gz-col-note"><button type="button" class="gz-note-btn">${p.note ? gzShort(p.note, 24) : '<span class="muted">+ note</span>'}</button></td>
      <td><select class="gz-amount" ${st.absent ? "disabled" : ""}>${amtOpts}</select></td>
      <td><select class="gz-method" ${st.absent ? "disabled" : ""}><option value="">méthode</option>${method("cash")}${method("twint")}${method("carte")}</select></td>
      <td class="gz-col-credit">
        ${credit > 0 ? `<b class="gz-credit">${credit} CHF</b> <button type="button" class="gz-credit-use gz-mini">utiliser</button>` : `<span class="muted">—</span>`}
        <button type="button" class="gz-credit-add gz-mini">+ crédit</button>
      </td>
      <td style="text-align:center"><input type="checkbox" class="gz-absent" ${st.absent ? "checked" : ""} /></td>
      <td class="gz-winner-cell" style="text-align:center">${mgrIsGz ? `
        <label title="Vainqueur"><input type="checkbox" class="gz-winner" ${st.is_winner ? "checked" : ""} /> ${ICO_CUP}</label>
        <div class="gz-photo-wrap" style="${st.is_winner ? "" : "display:none"}">
          ${st.photo_url ? `<img src="${st.photo_url}" class="gz-photo-thumb" />` : ""}
          <button type="button" class="gz-photo-btn">${st.photo_url ? "Refaire" : "Photo"}</button>
          <input type="file" accept="image/*" capture="environment" class="gz-photo-file" style="display:none" />
        </div>` : ""}</td>
    </tr>`;
  }).join("");
  $("gz-mgr-players").querySelectorAll("tr[data-pid]").forEach((tr) => {
    tr.querySelectorAll(".gz-absent,.gz-amount,.gz-method,.gz-winner").forEach((el) => el.addEventListener("change", () => saveStatus(tr)));
    const btn = tr.querySelector(".gz-photo-btn"), file = tr.querySelector(".gz-photo-file");
    if (btn && file) {
      btn.addEventListener("click", () => file.click());
      file.addEventListener("change", () => uploadPhoto(tr, file));
    }
    tr.querySelector(".gz-credit-add")?.addEventListener("click", () => grantCredit(tr.dataset.pid));
    tr.querySelector(".gz-credit-use")?.addEventListener("click", () => spendCredit(tr.dataset.pid));
    tr.querySelector(".gz-note-btn")?.addEventListener("click", () => openNoteEditor(tr.dataset.pid));
    tr.querySelector(".gz-remark")?.addEventListener("click", () => openRemarkView(tr.dataset.pid));
  });
  updateMgrTotals();
}

function mgrPlayer(pid) { return mgrPlayers.find((x) => x.p.id === pid); }

async function grantCredit(pid) {
  const mp = mgrPlayer(pid); if (!mp) return;
  const v = await uiPrompt(`Ajouter un crédit à ${mp.p.first_name} (CHF) :`, "");
  const amt = Number(v);
  if (!amt) return;
  const nc = Number(mp.p.credit_chf || 0) + amt;
  await sb.from("gz_participants").update({ credit_chf: nc }).eq("id", pid);
  mp.p.credit_chf = nc;
  renderMgr();
}

async function spendCredit(pid) {
  const mp = mgrPlayer(pid); if (!mp) return;
  const credit = Number(mp.p.credit_chf || 0);
  if (credit <= 0) return;
  const v = await uiPrompt(`Montant du crédit à utiliser (max ${credit} CHF) :`, String(credit));
  const amt = Math.min(Number(v) || 0, credit);
  if (!amt) return;
  await sb.from("gz_participants").update({ credit_chf: credit - amt }).eq("id", pid);
  await sb.from("gz_player_status").upsert({
    tournament_id: mgrTid, participant_id: pid, absent: false,
    amount_paid: amt, pay_method: null, updated_at: new Date().toISOString(),
  }, { onConflict: "tournament_id,participant_id" });
  mp.p.credit_chf = credit - amt;
  mp.st = { ...mp.st, absent: false, amount_paid: amt, pay_method: null };
  renderMgr();
}

// Note interne (éditable) : popup avec textarea
let gzTextPid = null;
function openNoteEditor(pid) {
  const mp = mgrPlayer(pid); if (!mp) return;
  gzTextPid = pid;
  $("gz-text-title").textContent = "Note interne";
  $("gz-text-who").textContent = `${mp.p.first_name} ${mp.p.last_name}`;
  const ta = $("gz-text-area");
  ta.value = mp.p.note || ""; ta.readOnly = false;
  $("gz-text-actions").style.display = "";
  $("gz-text-modal").classList.remove("hidden");
  ta.focus();
}
// Remarque (importée mytennis) : popup lecture seule
function openRemarkView(pid) {
  const mp = mgrPlayer(pid); if (!mp) return;
  gzTextPid = null;
  $("gz-text-title").textContent = "Remarque (importée)";
  $("gz-text-who").textContent = `${mp.p.first_name} ${mp.p.last_name}`;
  const ta = $("gz-text-area");
  ta.value = mp.remark || ""; ta.readOnly = true;
  $("gz-text-actions").style.display = "none";
  $("gz-text-modal").classList.remove("hidden");
}
async function saveGzNote(e) {
  if (e) e.preventDefault();
  if (!gzTextPid) { $("gz-text-modal").classList.add("hidden"); return; }
  const mp = mgrPlayer(gzTextPid); if (!mp) { $("gz-text-modal").classList.add("hidden"); return; }
  const v = $("gz-text-area").value.trim() || null;
  const { error } = await sb.from("gz_participants").update({ note: v }).eq("id", gzTextPid);
  if (error) { alert("Note : " + error.message); return; }
  mp.p.note = v;
  $("gz-text-modal").classList.add("hidden");
  renderMgr();
}

async function uploadPhoto(tr, file) {
  if (!file.files || !file.files[0]) return;
  const pid = tr.dataset.pid;
  const f = file.files[0];
  const path = `${mgrTid}/${pid}-${Date.now()}.jpg`;
  const { error } = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (error) { alert("Photo : " + error.message); return; }
  const url = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  await sb.from("gz_player_status").upsert({ tournament_id: mgrTid, participant_id: pid, photo_url: url, is_winner: true, updated_at: new Date().toISOString() }, { onConflict: "tournament_id,participant_id" });
  const wrap = tr.querySelector(".gz-photo-wrap");
  wrap.querySelector("img")?.remove();
  wrap.insertAdjacentHTML("afterbegin", `<img src="${url}" class="gz-photo-thumb" />`);
  tr.querySelector(".gz-photo-btn").textContent = "Refaire";
}

async function saveStatus(tr) {
  const pid = tr.dataset.pid;
  const absent = tr.querySelector(".gz-absent").checked;
  const amount = tr.querySelector(".gz-amount").value;
  const method = tr.querySelector(".gz-method").value;
  const winner = tr.querySelector(".gz-winner") ? tr.querySelector(".gz-winner").checked : false;
  tr.querySelector(".gz-amount").disabled = absent;
  tr.querySelector(".gz-method").disabled = absent;
  const wrap = tr.querySelector(".gz-photo-wrap");
  if (wrap) wrap.style.display = winner ? "" : "none";
  await sb.from("gz_player_status").upsert({
    tournament_id: mgrTid, participant_id: pid,
    absent, amount_paid: absent || amount === "" ? null : Number(amount),
    pay_method: absent || !method ? null : method, is_winner: winner, updated_at: new Date().toISOString(),
  }, { onConflict: "tournament_id,participant_id" });
  // couleur de ligne : vert si payé, rouge si absent
  tr.classList.remove("gz-paid", "gz-abs");
  if (absent) tr.classList.add("gz-abs");
  else if (amount !== "") tr.classList.add("gz-paid");
  updateMgrTotals();
}

function updateMgrTotals() {
  const t = { cash: 0, twint: 0, carte: 0 };
  $("gz-mgr-players").querySelectorAll("tr[data-pid]").forEach((tr) => {
    if (tr.querySelector(".gz-absent").checked) return;
    const m = tr.querySelector(".gz-method").value;
    const a = Number(tr.querySelector(".gz-amount").value) || 0;
    if (m && t[m] !== undefined) t[m] += a;
  });
  const tot = t.cash + t.twint + t.carte;
  $("gz-mgr-totals").innerHTML =
    `<span>Cash : <b>${t.cash} CHF</b></span><span>Twint : <b>${t.twint} CHF</b></span><span>Carte : <b>${t.carte} CHF</b></span><span>Total : <b>${tot} CHF</b></span>`;
  mgrCashPlayers = t.cash;
  computeCaisse();
}

// ---- Finances du tournoi : paiements, salaires, caisse, clôture ----
let mgrPayments = [], mgrSalaries = [], mgrManagers = [], mgrCashPlayers = 0, mgrTillBalance = 0, mgrTournamentName = "";

async function loadFinances(tid) {
  const [{ data: pays }, { data: sals }, { data: caisse }, { data: mgrs }] = await Promise.all([
    sb.from("gz_payments").select("*").eq("tournament_id", tid).order("created_at"),
    sb.from("gz_salaries").select("*").eq("tournament_id", tid).order("created_at"),
    sb.from("gz_caisse").select("*").eq("tournament_id", tid).maybeSingle(),
    sb.from("gz_managers").select("person_id").eq("tournament_id", tid),
  ]);
  mgrPayments = pays || []; mgrSalaries = sals || [];
  const ids = (mgrs || []).map((m) => m.person_id);
  mgrManagers = ids.length ? (await sb.from("people").select("id,first_name,last_name").in("id", ids)).data || [] : [];
  $("gz-sal-person").innerHTML = '<option value="">— responsable —</option>' +
    mgrManagers.map((p) => `<option value="${p.id}">${esc(p.last_name)} ${esc(p.first_name)}</option>`).join("") +
    '<option value="autre">Autre (saisir)…</option>';
  const { data: bal } = await sb.rpc("gz_till_balance");
  mgrTillBalance = Number(bal) || 0;
  $("gz-caisse-start").value = mgrTillBalance;
  $("gz-caisse-counted").value = caisse?.counted_amount ?? "";
  renderPayments(); renderSalaries(); computeCaisse();
}

function renderPayments() {
  $("gz-pay-list").innerHTML = mgrPayments.length ? mgrPayments.map((p) =>
    `<div class="gz-fin-item"><span>${esc(p.label || "—")} — <b>${p.amount} CHF</b> · ${esc(p.method || "?")}</span><button type="button" class="gz-del-pay" data-id="${p.id}">✕</button></div>`).join("") : '<p class="muted" style="font-size:.85rem;margin:0">Aucun.</p>';
  $("gz-pay-list").querySelectorAll(".gz-del-pay").forEach((b) => b.onclick = () => delFin("gz_payments", b.dataset.id));
}
function renderSalaries() {
  const nameOf = (s) => s.name || mgrManagers.find((m) => m.id === s.person_id)?.last_name + " " + (mgrManagers.find((m) => m.id === s.person_id)?.first_name || "") || "—";
  $("gz-sal-list").innerHTML = mgrSalaries.length ? mgrSalaries.map((s) =>
    `<div class="gz-fin-item"><span>${esc(nameOf(s))} — <b>${s.amount} CHF</b></span><button type="button" class="gz-del-sal" data-id="${s.id}">✕</button></div>`).join("") : '<p class="muted" style="font-size:.85rem;margin:0">Aucun.</p>';
  $("gz-sal-list").querySelectorAll(".gz-del-sal").forEach((b) => b.onclick = () => delFin("gz_salaries", b.dataset.id));
}
async function addPayment() {
  const amount = Number($("gz-pay-amount").value);
  if (!amount) return;
  await sb.from("gz_payments").insert({ tournament_id: mgrTid, label: $("gz-pay-label").value.trim() || null, amount, method: $("gz-pay-method").value });
  $("gz-pay-label").value = ""; $("gz-pay-amount").value = "";
  mgrPayments = (await sb.from("gz_payments").select("*").eq("tournament_id", mgrTid).order("created_at")).data || [];
  renderPayments(); computeCaisse();
}
async function addSalary() {
  const amount = Number($("gz-sal-amount").value);
  if (!amount) return;
  const sel = $("gz-sal-person").value;
  let row = { tournament_id: mgrTid, amount };
  if (sel === "autre") {
    const n = $("gz-sal-name").value.trim();
    if (!n) { alert("Saisissez un nom."); $("gz-sal-name").focus(); return; }
    row.name = n;
  }
  else if (sel) row.person_id = sel;
  else { alert("Choisissez un responsable."); return; }
  await sb.from("gz_salaries").insert(row);
  $("gz-sal-amount").value = "";
  $("gz-sal-name").value = ""; $("gz-sal-name").classList.add("hidden");
  $("gz-sal-person").value = "";
  mgrSalaries = (await sb.from("gz_salaries").select("*").eq("tournament_id", mgrTid).order("created_at")).data || [];
  renderSalaries(); computeCaisse();
}
async function delFin(table, id) {
  await sb.from(table).delete().eq("id", id);
  if (table === "gz_payments") { mgrPayments = mgrPayments.filter((x) => x.id !== id); renderPayments(); }
  else { mgrSalaries = mgrSalaries.filter((x) => x.id !== id); renderSalaries(); }
  computeCaisse();
}
async function saveCaisse() {
  await sb.from("gz_caisse").upsert({
    tournament_id: mgrTid, start_amount: numOrNull($("gz-caisse-start").value),
    counted_amount: numOrNull($("gz-caisse-counted").value), updated_at: new Date().toISOString(),
  }, { onConflict: "tournament_id" });
  computeCaisse();
}
const numOrNull = (v) => v === "" ? null : Number(v);

function caisseNumbers() {
  const start = Number($("gz-caisse-start").value) || 0;
  const counted = $("gz-caisse-counted").value === "" ? null : Number($("gz-caisse-counted").value);
  const cashPay = mgrPayments.filter((p) => p.method === "cash").reduce((a, p) => a + Number(p.amount || 0), 0);
  const cashOut = mgrSalaries.reduce((a, s) => a + Number(s.amount || 0), 0);
  const expected = start + mgrCashPlayers + cashPay - cashOut;
  return { start, counted, cashIn: mgrCashPlayers + cashPay, cashOut, expected, diff: counted === null ? null : counted - expected };
}
function computeCaisse() {
  if (!$("gz-caisse-calc")) return;
  const c = caisseNumbers();
  $("gz-caisse-calc").innerHTML =
    `Cash encaissé : ${c.cashIn} · Salaires (sortie) : ${c.cashOut} · <b>Caisse attendue : ${c.expected} CHF</b>` +
    (c.counted === null ? "" : ` · Compté : ${c.counted} · Écart : <b style="color:${c.diff === 0 ? "#0b6b3a" : "#b3261e"}">${c.diff > 0 ? "+" : ""}${c.diff} CHF</b>`);
}

async function closeTournament() {
  const rows = [...$("gz-mgr-players").querySelectorAll("tr[data-pid]")];
  const unresolved = rows.filter((tr) => !tr.querySelector(".gz-absent").checked && tr.querySelector(".gz-amount").value === "").length;
  if (unresolved > 0) { alert(`${unresolved} joueur(s) ne sont ni payés ni marqués « absent ». Impossible de clôturer — complétez-les d'abord.`); return; }
  const winnersNoPhoto = rows.filter((tr) => tr.querySelector(".gz-winner")?.checked && !tr.querySelector(".gz-photo-wrap img")).length;
  const c = caisseNumbers();
  let warn = "";
  if (mgrIsGz && winnersNoPhoto > 0) warn += `\n• ${winnersNoPhoto} vainqueur(s) sans photo.`;
  if (c.counted !== null && c.diff !== 0) warn += `\n• La caisse comptée ne correspond pas (écart ${c.diff > 0 ? "+" : ""}${c.diff} CHF).`;
  if (warn && !await uiConfirm("Attention :" + warn + "\n\nClôturer le tournoi quand même ?")) return;
  const { data: cz } = await sb.from("gz_caisse").select("closed").eq("tournament_id", mgrTid).maybeSingle();
  await saveCaisse();
  if (!cz?.closed) {
    // Passe par une fonction SECURITY DEFINER : le responsable du tournoi peut
    // poster ce mouvement de clôture sans avoir un accès général à la caisse.
    const { error: ce } = await sb.rpc("gz_add_tournament_caisse", { p_tournament: mgrTid, p_amount: c.cashIn - c.cashOut, p_label: mgrTournamentName });
    if (ce) { alert("Caisse : " + ce.message); return; }
  }
  await sb.from("gz_caisse").update({ closed: true, closed_at: new Date().toISOString() }).eq("tournament_id", mgrTid);
  // Clôture via fonction SECURITY DEFINER : après passage à « Clôturé », le
  // responsable perd l'accès RLS au tournoi — il ne peut donc pas faire cet UPDATE lui-même.
  const { error: se } = await sb.rpc("gz_close_tournament", { p_tournament: mgrTid });
  if (se) { alert("Clôture : " + se.message); return; }
  $("gz-close-status").textContent = "✓ Tournoi clôturé.";
  setTimeout(closeDetail, 1400);
}

// ---- Caisse transverse (grand livre) ----
async function loadCaisseTab() {
  const { data: led } = await sb.from("gz_caisse_ledger").select("*").order("created_at", { ascending: true });
  const rows = led || [];
  let run = 0;
  const withRun = rows.map((r) => { run += Number(r.amount); return { ...r, run }; });
  $("gz-till-balance").textContent = run + " CHF";
  $("gz-ledger-rows").innerHTML = withRun.length ? withRun.slice().reverse().map((r) =>
    `<tr><td>${frDate(r.created_at)}</td><td>${esc(r.label || "—")}</td>
      <td style="font-weight:700;color:${r.amount >= 0 ? "#0b6b3a" : "#b3261e"}">${r.amount >= 0 ? "+" : ""}${r.amount}</td>
      <td>${r.run}</td><td><button type="button" class="fam-del gz-mov-del" data-id="${r.id}">✕</button></td></tr>`).join("")
    : '<tr><td colspan="5" class="muted">Aucun mouvement.</td></tr>';
  $("gz-ledger-rows").querySelectorAll(".gz-mov-del").forEach((b) =>
    b.addEventListener("click", async () => { if (await uiConfirm("Supprimer ce mouvement de caisse ?")) { await sb.from("gz_caisse_ledger").delete().eq("id", b.dataset.id); loadCaisseTab(); } }));
}

async function addMovement() {
  const amount = Number($("gz-mov-amount").value);
  if (!amount) { alert("Montant requis (positif pour une entrée, négatif pour une sortie)."); return; }
  await sb.from("gz_caisse_ledger").insert({ label: $("gz-mov-label").value.trim() || null, amount, created_by: meId });
  $("gz-mov-label").value = ""; $("gz-mov-amount").value = "";
  loadCaisseTab();
}

// ---- Tous les participants ----
let gzParts = [], gzPartSort = "last";

// Sélecteur de saison commun (Participants / Financier / Site public) : la saison
// EN COURS est pré-sélectionnée par défaut, suivie de toutes les saisons puis de
// « Toutes les saisons » (valeur vide = pas de filtre).
let gzSeasonsCache = [], gzCurSeasonId = null;
async function gzLoadSeasons() {
  if (!gzSeasonsCache.length) {
    const { data } = await sb.from("gz_seasons").select("id,name,start_date,is_current").order("start_date", { ascending: false });
    gzSeasonsCache = data || [];
    gzCurSeasonId = (gzSeasonsCache.find((s) => s.is_current) || {}).id || null;
  }
  return gzSeasonsCache;
}
function gzSeasonOptions(selId) {
  const sel = selId === undefined ? gzCurSeasonId : selId;
  return gzSeasonsCache.map((s) => `<option value="${s.id}"${s.id === sel ? " selected" : ""}>${esc(s.name)}${s.is_current ? " (en cours)" : ""}</option>`).join("")
    + `<option value=""${sel ? "" : " selected"}>Toutes les saisons</option>`;
}

let gzPartSeasonStats = {}, gzPartSeasonLoaded = false;

async function loadParticipantsTab() {
  await gzLoadSeasons();
  const [{ data: parts }, { data: stats }, { data: sstats }] = await Promise.all([
    sb.from("gz_participants").select("*"),
    sb.from("gz_participant_stats").select("*"),
    sb.from("gz_participant_season_stats").select("*"),
  ]);
  const sMap = {}; for (const s of stats || []) sMap[s.participant_id] = s;
  gzParts = (parts || []).map((p) => ({ ...p, part: sMap[p.id]?.participations || 0, vic: sMap[p.id]?.victoires || 0 }));
  gzPartSeasonStats = {};
  for (const r of sstats || []) gzPartSeasonStats[`${r.participant_id}|${r.season_id}`] = { part: r.participations || 0, vic: r.victoires || 0 };
  if (!gzPartSeasonLoaded) {
    $("gz-part-season").innerHTML = gzSeasonOptions();
    $("gz-part-season").value = gzCurSeasonId || "";
    $("gz-part-season").addEventListener("change", renderParts);
    gzPartSeasonLoaded = true;
  }
  renderParts();
}

function renderParts() {
  const sid = $("gz-part-season") ? $("gz-part-season").value : "";
  // Quand une saison est choisie : n'afficher que les participants de cette saison,
  // et compter participations/victoires POUR cette saison. « Toutes » = total cumulé.
  const partOf = (p) => sid ? (gzPartSeasonStats[`${p.id}|${sid}`]?.part || 0) : p.part;
  const vicOf = (p) => sid ? (gzPartSeasonStats[`${p.id}|${sid}`]?.vic || 0) : p.vic;
  const q = $("gz-part-search").value.trim().toLowerCase();
  let rows = gzParts.filter((p) =>
    (!sid || gzPartSeasonStats[`${p.id}|${sid}`]) &&
    (!q || `${p.last_name} ${p.first_name} ${p.email || ""} ${p.phone || ""} ${p.city || ""} ${p.club || ""} ${p.note || ""}`.toLowerCase().includes(q)));
  const val = (p) => ({ last: p.last_name, first: p.first_name, email: p.email, birth: p.birthdate,
    phone: p.phone, part: partOf(p), vic: vicOf(p), credit: Number(p.credit_chf || 0), note: p.note }[gzPartSort]);
  rows = rows.slice().sort((a, b) => {
    const x = val(a), y = val(b);
    if (["part", "vic", "credit"].includes(gzPartSort)) return (y || 0) - (x || 0);
    return String(x || "").localeCompare(String(y || ""));
  });
  $("gz-part-rows").innerHTML = rows.map((p) => `<tr>
    <td>${esc(p.last_name)}</td><td>${esc(p.first_name)}</td><td>${esc(p.email || "")}</td>
    <td>${p.birthdate || ""}</td><td>${esc(p.phone || "")}</td>
    <td>${partOf(p)}</td><td>${vicOf(p) > 0 ? ICO_CUP + " " + vicOf(p) : "0"}</td>
    <td>${p.credit_chf > 0 ? p.credit_chf + " CHF" : ""}</td><td class="muted" style="font-size:.82rem">${esc(p.note || "")}</td></tr>`).join("");
  $("gz-part-count").textContent = `${rows.length} participant(s)`;
}

// ---- Résumé financier ----
let gzFin = [], gzFinMgrs = {}, gzFinSeasonsLoaded = false;

async function loadFinanceTab() {
  await gzLoadSeasons();
  const [{ data: fin }, { data: mgrs }] = await Promise.all([
    sb.from("gz_tournament_finance").select("*"),
    sb.from("gz_managers").select("tournament_id,person_id"),
  ]);
  const nameOf = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.last_name} ${p.first_name}` : ""; };
  gzFinMgrs = {};
  for (const m of mgrs || []) { (gzFinMgrs[m.tournament_id] || (gzFinMgrs[m.tournament_id] = [])).push(nameOf(m.person_id)); }
  gzFin = fin || [];
  if (!gzFinSeasonsLoaded) {
    $("gz-fin-season").innerHTML = gzSeasonOptions();
    $("gz-fin-season").value = gzCurSeasonId || "";
    gzFinSeasonsLoaded = true;
  }
  renderFinance();
}

function renderFinance() {
  const sid = $("gz-fin-season").value;
  const rows = gzFin.filter((r) => !sid || r.season_id === sid)
    .sort((a, b) => String(b.tournament_date || "").localeCompare(String(a.tournament_date || "")));
  const T = { presents: 0, twint: 0, cash: 0, carte: 0, total: 0, salaires: 0, net: 0 };
  const html = rows.map((r) => {
    const twint = Number(r.twint), cash = Number(r.cash), carte = Number(r.carte), sal = Number(r.salaires);
    const total = twint + cash + carte, net = total - sal;
    T.presents += r.presents; T.twint += twint; T.cash += cash; T.carte += carte; T.total += total; T.salaires += sal; T.net += net;
    return `<tr><td>${esc(r.name || "—")}</td><td>${r.tournament_date ? frDate(r.tournament_date) : "—"}</td><td>${r.presents}</td>
      <td>${twint}</td><td>${cash}</td><td>${carte}</td><td><b>${total}</b></td><td>${sal}</td><td>${net}</td>
      <td class="muted" style="font-size:.8rem">${(gzFinMgrs[r.tournament_id] || []).join(", ")}</td></tr>`;
  }).join("");
  $("gz-fin-rows").innerHTML = html || '<tr><td colspan="10" class="muted">Aucun tournoi.</td></tr>';
  $("gz-fin-totals").innerHTML =
    `<td colspan="2">TOTAL — ${rows.length} tournoi(s)</td><td>${T.presents}</td><td>${T.twint}</td><td>${T.cash}</td><td>${T.carte}</td><td>${T.total}</td><td>${T.salaires}</td><td>${T.net}</td><td></td>`;
}

// ---- Communication : modèles d'e-mails ----
let gzMails = [];

async function loadMailTab() {
  const { data } = await sb.from("gz_email_templates").select("*").order("sort_order");
  gzMails = data || [];
  renderMailCards();
}

function renderMailCards() {
  $("gz-mail-list").innerHTML = gzMails.map((m) => `
    <div class="gz-mail-card" data-key="${m.key}">
      <div class="gz-mail-head">
        <b>${esc(m.name)}</b>
        <label class="gz-mail-en"><input type="checkbox" class="gz-mail-enabled" ${m.enabled ? "checked" : ""}/> Actif</label>
      </div>
      <div class="muted" style="font-size:.82rem;margin-bottom:.4rem">⏱ ${esc(m.trigger_desc || "")}</div>
      <label class="gz-mail-lbl">Objet</label>
      <input type="text" class="gz-mail-subject" value="${esc(m.subject || "")}"/>
      <label class="gz-mail-lbl">Message</label>
      <textarea class="gz-mail-body" rows="9">${esc(m.body || "")}</textarea>
      <div class="gz-mail-foot">
        <div class="gz-mail-img">
          ${m.image_url ? `<img src="${m.image_url}" class="gz-mail-thumb"/>` : ""}
          <button type="button" class="ghost gz-mail-imgbtn">${m.image_url ? "Changer l'image" : "Ajouter une image (plan, etc.)"}</button>
          ${m.image_url ? `<button type="button" class="ghost gz-mail-imgdel">Retirer</button>` : ""}
          <input type="file" accept="image/*" class="gz-mail-file hidden"/>
        </div>
        <button type="button" class="primary gz-mail-save">Enregistrer</button>
      </div>
      <div class="gz-mail-test-row">
        <span class="gz-mail-lbl" style="margin:0">Tester&nbsp;:</span>
        <input type="email" class="gz-mail-testmail" placeholder="ton@email.ch — recevoir ce mail en test" />
        <button type="button" class="ghost gz-mail-testbtn">Envoyer un test</button>
        <span class="gz-mail-teststatus muted"></span>
      </div>
    </div>`).join("");
  $("gz-mail-list").querySelectorAll(".gz-mail-card").forEach((card) => {
    const key = card.dataset.key;
    card.querySelector(".gz-mail-save").addEventListener("click", () => saveMail(key, card));
    const file = card.querySelector(".gz-mail-file");
    card.querySelector(".gz-mail-imgbtn").addEventListener("click", () => file.click());
    file.addEventListener("change", () => uploadMailImage(key, file));
    card.querySelector(".gz-mail-imgdel")?.addEventListener("click", () => removeMailImage(key));
    card.querySelector(".gz-mail-testbtn").addEventListener("click", () => gzMailTest(key, card));
  });
}

// Liste des tournois GameZone sur mytennis ({lien_tournois} + repli de {url_tournoi}).
const GZ_MYTENNIS_LIST = "https://www.mytennis.ch/fr/tournois?keyword=gamezone";
// {url_tournoi} = page mytennis du tournoi, derivee du swiss_id (ex. "Id159321" -> .../159321).
// Un lien saisi a la main (registration_url) reste prioritaire ; sinon repli sur la liste.
const gzTournoiUrl = (t) => (t?.registration_url && t.registration_url.trim())
  || (t?.swiss_id ? "https://www.mytennis.ch/fr/tournois/" + String(t.swiss_id).replace(/\D/g, "") : GZ_MYTENNIS_LIST);
const gzFillVars = (s, map) => String(s || "").replace(/\{(\w+)\}/g, (mm, k) => (map[k] != null ? map[k] : mm));
async function gzMailTest(key, card) {
  const to = card.querySelector(".gz-mail-testmail").value.trim();
  const st = card.querySelector(".gz-mail-teststatus");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { st.textContent = "Entre un email valide."; return; }
  const btn = card.querySelector(".gz-mail-testbtn"); btn.disabled = true; st.textContent = "Préparation…";
  try {
    // Tournoi le plus proche (avant ou après aujourd'hui) comme exemple
    const { data: ts } = await sb.from("gz_tournaments").select("id,name,registration_url,swiss_id,tournament_date").not("tournament_date", "is", null);
    const now = Date.now(); let t = null, best = Infinity;
    for (const x of (ts || [])) { const d = Math.abs(new Date(x.tournament_date).getTime() - now); if (d < best) { best = d; t = x; } }
    let respNames = [pName(myPersonId)].filter((n) => n && n !== "?");
    if (t) { const { data: mgrs } = await sb.from("gz_managers").select("person_id").eq("tournament_id", t.id); const names = (mgrs || []).map((x) => pName(x.person_id)).filter((n) => n && n !== "?"); if (names.length) respNames = names; }
    const respo = respNames.join(", ") || pName(myPersonId);
    const meFirst = (people.find((p) => p.id === myPersonId) || {}).first_name || "Prénom";
    const fill = {
      prenom: meFirst,
      tournoi: t?.name || "Tournoi test",
      url_tournoi: gzTournoiUrl(t),
      code_vestiaire: "2848#",
      responsables: respo,
      resp_mot: respNames.length > 1 ? "Responsables" : "Responsable",
      lien_tournois: GZ_MYTENNIS_LIST,
      lien_sondage: "https://teamlausanne.ch",
    };
    const subject = "[TEST] " + gzFillVars(card.querySelector(".gz-mail-subject").value.trim(), fill);
    const body = gzFillVars(card.querySelector(".gz-mail-body").value, fill);
    const m = gzMails.find((x) => x.key === key);
    const img = m?.image_url ? `<div style="margin-top:14px"><img src="${esc(m.image_url)}" style="max-width:100%"/></div>` : "";
    const html = `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#111">${draftToHtml(body)}${img}</div>`;
    st.textContent = "Envoi…";
    const { data, error } = await sb.functions.invoke("mail-send", { body: { account: "tournoi@teamlausanne.ch", to, subject, text: body, html } });
    if (error) { let e = error.message; try { e = (await error.context.json())?.error || e; } catch (_) {} st.textContent = "Échec : " + e; }
    else if (data?.error) { st.textContent = "Échec : " + data.error; }
    else { st.textContent = `✓ Test envoyé à ${to} (depuis ${data?.from || "tournoi@"}) — exemple : ${fill.tournoi}`; }
  } catch (e) { st.textContent = "Échec : " + (e?.message || e); }
  btn.disabled = false;
}
async function saveMail(key, card) {
  const patch = {
    subject: card.querySelector(".gz-mail-subject").value.trim(),
    body: card.querySelector(".gz-mail-body").value,
    enabled: card.querySelector(".gz-mail-enabled").checked,
    updated_at: new Date().toISOString(),
  };
  const btn = card.querySelector(".gz-mail-save");
  btn.textContent = "…";
  const { error } = await sb.from("gz_email_templates").update(patch).eq("key", key);
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  if (!error) { const m = gzMails.find((x) => x.key === key); if (m) Object.assign(m, patch); }
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function uploadMailImage(key, file) {
  if (!file.files || !file.files[0]) return;
  const f = file.files[0];
  const path = `templates/${key}-${Date.now()}`;
  const { error } = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (error) { alert("Image : " + error.message); return; }
  const url = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  await sb.from("gz_email_templates").update({ image_url: url }).eq("key", key);
  const m = gzMails.find((x) => x.key === key); if (m) m.image_url = url;
  renderMailCards();
}

async function removeMailImage(key) {
  await sb.from("gz_email_templates").update({ image_url: null }).eq("key", key);
  const m = gzMails.find((x) => x.key === key); if (m) m.image_url = null;
  renderMailCards();
}

// ---- Sondages (moteur générique : GameZone + Stages) ----
const SITE_ORIGIN = location.origin;
const SURVEY_CFG = {
  gamezone: { listId: "gz-survey-list", newTag: null },
  stage:    { listId: "stg-survey-list", newTag: "stage" },
};
const surveyState = { gamezone: { list: [], q: {} }, stage: { list: [], q: {} } };

async function loadSurveyTab(scope) {
  const [{ data: surveys }, { data: qs }] = await Promise.all([
    sb.from("gz_surveys").select("*").order("created_at", { ascending: false }),
    sb.from("gz_survey_questions").select("*").order("position"),
  ]);
  const all = surveys || [];
  const list = scope === "stage" ? all.filter((s) => s.tag === "stage") : all.filter((s) => s.tag !== "stage");
  const q = {};
  for (const qq of qs || []) (q[qq.survey_id] || (q[qq.survey_id] = [])).push(qq);
  surveyState[scope] = { list, q };
  renderSurveys(scope);
}

function renderSurveys(scope) {
  const L = $(SURVEY_CFG[scope].listId);
  const { list, q: qmap } = surveyState[scope];
  if (!list.length) { L.innerHTML = '<p class="muted">Aucun questionnaire. Clique « + Nouveau ».</p>'; return; }
  L.innerHTML = list.map((s) => {
    const qs = qmap[s.id] || [];
    const link = `${SITE_ORIGIN}/sondage.html?s=${s.id}`;
    const qhtml = qs.map((q) => {
      const opts = q.qtype === "choice" ? ` <span class="muted">(${(q.options || []).map(esc).join(" · ")})</span>` : q.qtype === "rating" ? ' <span class="muted">(note 1–5)</span>' : q.qtype === "scale" ? ' <span class="muted">(échelle 1–10)</span>' : ' <span class="muted">(texte libre)</span>';
      return `<li>${esc(q.label)}${opts} <button class="fam-del gz-q-del" data-id="${q.id}">✕</button></li>`;
    }).join("");
    return `<div class="gz-survey-card" data-id="${s.id}">
      <div class="gz-mail-head">
        <input type="text" class="gz-survey-title" value="${esc(s.title)}" style="font-weight:800;flex:1;margin-right:10px"/>
        <label class="gz-mail-en"><input type="checkbox" class="gz-survey-active" ${s.active ? "checked" : ""}/> Actif</label>
      </div>
      <label class="gz-mail-lbl">Intro (optionnel)</label>
      <input type="text" class="gz-survey-intro" value="${esc(s.intro || "")}"/>
      <label class="gz-mail-lbl">Questions</label>
      <ol class="gz-survey-qs">${qhtml || '<li class="muted">Aucune question.</li>'}</ol>
      <button class="ghost gz-q-add" data-id="${s.id}">+ Ajouter une question</button>
      <div class="gz-mail-foot">
        <div class="muted" style="font-size:.8rem">Lien : <a href="${link}" target="_blank" rel="noopener">${link}</a></div>
        <div style="display:flex;gap:8px">
          <button class="ghost gz-survey-results" data-id="${s.id}">Résultats</button>
          <button class="primary gz-survey-save" data-id="${s.id}">Enregistrer</button>
          <button class="fam-del gz-survey-del" data-id="${s.id}">Supprimer</button>
        </div>
      </div>
      <div class="gz-survey-res hidden" id="gz-res-${s.id}"></div>
    </div>`;
  }).join("");
  L.querySelectorAll(".gz-survey-save").forEach((b) => b.addEventListener("click", () => saveSurvey(scope, b.dataset.id)));
  L.querySelectorAll(".gz-survey-del").forEach((b) => b.addEventListener("click", () => delSurvey(scope, b.dataset.id)));
  L.querySelectorAll(".gz-q-add").forEach((b) => b.addEventListener("click", () => addQuestion(scope, b.dataset.id)));
  L.querySelectorAll(".gz-q-del").forEach((b) => b.addEventListener("click", () => delQuestion(scope, b.dataset.id)));
  L.querySelectorAll(".gz-survey-results").forEach((b) => b.addEventListener("click", () => showSurveyResults(scope, b.dataset.id)));
}

async function createSurvey(scope) {
  const title = await uiPrompt("Titre du questionnaire :", "Questionnaire de satisfaction");
  if (!title) return;
  const { error } = await sb.from("gz_surveys").insert({ title, tag: SURVEY_CFG[scope].newTag });
  if (error) return alert(error.message);
  loadSurveyTab(scope);
}

async function saveSurvey(scope, id) {
  const card = $(SURVEY_CFG[scope].listId).querySelector(`.gz-survey-card[data-id="${id}"]`);
  const patch = {
    title: card.querySelector(".gz-survey-title").value.trim(),
    intro: card.querySelector(".gz-survey-intro").value.trim() || null,
    active: card.querySelector(".gz-survey-active").checked,
  };
  const btn = card.querySelector(".gz-survey-save");
  btn.textContent = "…";
  const { error } = await sb.from("gz_surveys").update(patch).eq("id", id);
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  if (!error) Object.assign(surveyState[scope].list.find((x) => x.id === id), patch);
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
  if (!error && patch.active) loadSurveyTab(scope);   // un seul actif à la fois → refléter la désactivation des autres
}

async function delSurvey(scope, id) {
  if (!await uiConfirm("Supprimer ce questionnaire et toutes ses réponses ?")) return;
  await sb.from("gz_surveys").delete().eq("id", id);
  loadSurveyTab(scope);
}

async function addQuestion(scope, sid) {
  const label = await uiPrompt("Question :");
  if (!label) return;
  const t = (await uiPrompt("Type — tape : choix / texte / note / échelle", "choix") || "").toLowerCase().trim();
  const qtype = t.startsWith("t") ? "text" : t.startsWith("n") ? "rating" : (t.startsWith("é") || t.startsWith("e")) ? "scale" : "choice";
  let options = [];
  if (qtype === "choice") {
    const o = await uiPrompt("Réponses possibles, séparées par des virgules :", "Oui, Non");
    options = (o || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (!options.length) return alert("Au moins une réponse est nécessaire.");
  }
  const pos = (surveyState[scope].q[sid] || []).length;
  const { error } = await sb.from("gz_survey_questions").insert({ survey_id: sid, label, qtype, options, position: pos });
  if (error) return alert(error.message);
  loadSurveyTab(scope);
}

async function delQuestion(scope, qid) {
  if (!await uiConfirm("Supprimer cette question ?")) return;
  await sb.from("gz_survey_questions").delete().eq("id", qid);
  loadSurveyTab(scope);
}

async function showSurveyResults(scope, sid) {
  const box = $("gz-res-" + sid);
  if (!box.classList.contains("hidden")) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  box.innerHTML = '<p class="muted">Chargement…</p>';
  const [{ data: resp }, { data: ans }] = await Promise.all([
    sb.from("gz_survey_responses").select("id,submitted_at,tournament_id").eq("survey_id", sid),
    sb.from("gz_survey_answers").select("question_id,value,response_id"),
  ]);
  const respIds = new Set((resp || []).map((r) => r.id));
  const answers = (ans || []).filter((a) => respIds.has(a.response_id));
  box.dataset.resp = JSON.stringify(resp || []);
  box.dataset.ans = JSON.stringify(answers);
  const dates = (resp || []).map((r) => r.submitted_at).sort();
  const min = dates[0] ? dates[0].slice(0, 10) : "";
  const max = dates[dates.length - 1] ? dates[dates.length - 1].slice(0, 10) : "";
  box.innerHTML = `
    <div class="gz-res-filter">
      <label>Du <input type="date" class="gz-res-from" value="${min}"/></label>
      <label>au <input type="date" class="gz-res-to" value="${max}"/></label>
    </div>
    <div class="gz-res-body"></div>`;
  const redraw = () => renderSurveyResults(scope, sid, box);
  box.querySelector(".gz-res-from").addEventListener("change", redraw);
  box.querySelector(".gz-res-to").addEventListener("change", redraw);
  redraw();
}

function renderSurveyResults(scope, sid, box) {
  const resp = JSON.parse(box.dataset.resp || "[]");
  const answers = JSON.parse(box.dataset.ans || "[]");
  const from = box.querySelector(".gz-res-from").value;
  const to = box.querySelector(".gz-res-to").value;
  const inRange = (d) => (!from || d.slice(0, 10) >= from) && (!to || d.slice(0, 10) <= to);
  const okResp = new Set(resp.filter((r) => inRange(r.submitted_at)).map((r) => r.id));
  const okAns = answers.filter((a) => okResp.has(a.response_id));
  const qs = surveyState[scope].q[sid] || [];
  let html = `<p><b>${okResp.size}</b> sondage(s) rempli(s) sur la période.</p>`;
  for (const q of qs) {
    const qa = okAns.filter((a) => a.question_id === q.id);
    html += `<div class="gz-res-q"><b>${esc(q.label)}</b>`;
    if (q.qtype === "choice" || q.qtype === "rating" || q.qtype === "scale") {
      const buckets = q.qtype === "rating" ? ["1", "2", "3", "4", "5"] : q.qtype === "scale" ? ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] : (q.options || []);
      const counts = {}; qa.forEach((a) => (counts[a.value] = (counts[a.value] || 0) + 1));
      const tot = qa.length || 1;
      if (q.qtype === "rating" || q.qtype === "scale") {
        const nums = qa.map((a) => parseFloat(a.value)).filter((n) => !isNaN(n));
        if (nums.length) html += `<div class="muted" style="font-size:.85rem;margin:3px 0 5px">Moyenne : <b>${(nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1)}</b> / ${q.qtype === "scale" ? 10 : 5}</div>`;
      }
      html += "<ul class='gz-res-bars'>" + buckets.map((opt) => {
        const c = counts[opt] || 0; const pct = Math.round((c / tot) * 100);
        return `<li><span class="gz-res-lbl">${esc(opt)}</span><span class="gz-res-bar"><span style="width:${pct}%"></span></span><span class="gz-res-n">${c} (${pct}%)</span></li>`;
      }).join("") + "</ul>";
    } else {
      html += qa.length ? "<ul class='gz-res-txt'>" + qa.map((a) => `<li>${esc(a.value || "")}</li>`).join("") + "</ul>" : '<p class="muted">Aucune réponse.</p>';
    }
    html += "</div>";
  }
  box.querySelector(".gz-res-body").innerHTML = html;
}

// ---- Site public : gestion des photos de vainqueurs ----
let gzSitePhotos = [], gzSiteSeasonsLoaded = false;

async function loadSiteTab() {
  await gzLoadSeasons();
  const { data: st } = await sb.from("gz_player_status")
    .select("participant_id,tournament_id,photo_url,photo_public,updated_at,gz_participants(first_name,last_name),gz_tournaments(name,tournament_date,season_id,is_gamezone)")
    .eq("is_winner", true).not("photo_url", "is", null);
  gzSitePhotos = (st || []).filter((r) => r.gz_tournaments?.is_gamezone);
  if (!gzSiteSeasonsLoaded) {
    $("gz-site-season").innerHTML = gzSeasonOptions();
    $("gz-site-season").value = gzCurSeasonId || "";
    $("gz-site-season").addEventListener("change", renderSitePhotos);
    gzSiteSeasonsLoaded = true;
  }
  renderSitePhotos();
}

function renderSitePhotos() {
  const sid = $("gz-site-season").value;
  const rows = gzSitePhotos
    .filter((r) => !sid || r.gz_tournaments?.season_id === sid)
    .sort((a, b) => String(b.gz_tournaments?.tournament_date || "").localeCompare(String(a.gz_tournaments?.tournament_date || "")));
  if (!rows.length) { $("gz-site-photos").innerHTML = '<p class="muted">Aucune photo de vainqueur.</p>'; return; }
  $("gz-site-photos").innerHTML = rows.map((r) => {
    const p = r.gz_participants || {}, t = r.gz_tournaments || {};
    const hidden = !r.photo_public;
    return `<div class="gz-site-card${hidden ? " off" : ""}" data-tid="${r.tournament_id}" data-pid="${r.participant_id}">
      <img src="${esc(r.photo_url)}" alt="" />
      <div class="gz-site-meta">
        <b>${esc(p.first_name || "")} ${esc(p.last_name || "")}</b>
        <span class="muted">${esc(t.name || "")}${t.tournament_date ? " · " + frDate(t.tournament_date) : ""}</span>
      </div>
      <button class="ghost gz-site-toggle">${hidden ? "Afficher" : "Retirer du public"}</button>
      ${hidden ? '<span class="gz-site-badge">Masquée</span>' : ""}
    </div>`;
  }).join("");
  $("gz-site-photos").querySelectorAll(".gz-site-toggle").forEach((b) =>
    b.addEventListener("click", () => toggleSitePhoto(b.closest(".gz-site-card"))));
}

async function toggleSitePhoto(card) {
  const tid = card.dataset.tid, pid = card.dataset.pid;
  const row = gzSitePhotos.find((r) => r.tournament_id === tid && r.participant_id === pid);
  const next = !row.photo_public;
  const btn = card.querySelector(".gz-site-toggle");
  btn.textContent = "…";
  const { error } = await sb.from("gz_player_status").update({ photo_public: next })
    .eq("tournament_id", tid).eq("participant_id", pid);
  if (error) { btn.textContent = "Erreur"; return; }
  row.photo_public = next;
  renderSitePhotos();
}

async function loadSeasons() {
  const { data } = await sb.from("gz_seasons").select("*").order("start_date", { ascending: false });
  const rows = data || [];
  $("gz-seasons-rows").innerHTML = rows.length ? rows.map((s) => {
    const weeks = Math.round((new Date(s.end_date) - new Date(s.start_date)) / 86400000 / 7 * 10) / 10;
    return `<tr>
      <td>${esc(s.name)}</td><td>${frDate(s.start_date)}</td><td>${frDate(s.end_date)}</td><td>${weeks}</td>
      <td>${s.is_current ? "✓ courante" : `<button class="ghost gz-set-cur" data-id="${s.id}">définir</button>`}</td>
      <td><button class="fam-del gz-del-season" data-id="${s.id}">✕</button></td></tr>`;
  }).join("") : '<tr><td colspan="6" class="muted">Aucune saison.</td></tr>';
  $("gz-seasons-rows").querySelectorAll(".gz-set-cur").forEach((b) => b.addEventListener("click", () => setCurrentSeason(b.dataset.id)));
  $("gz-seasons-rows").querySelectorAll(".gz-del-season").forEach((b) => b.addEventListener("click", () => delSeason(b.dataset.id)));
}

async function createSeason() {
  const name = await uiPrompt("Nom de la saison (ex. GameZone 2025/26) :");
  if (!name) return;
  const start = await uiPrompt("Date de début (AAAA-MM-JJ) :");
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return alert("Date de début invalide.");
  const end = await uiPrompt("Date de fin (AAAA-MM-JJ) :");
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return alert("Date de fin invalide.");
  const { error } = await sb.from("gz_seasons").insert({ name, start_date: start, end_date: end });
  if (error) return alert(error.message);
  loadSeasons();
}

async function setCurrentSeason(id) {
  await sb.from("gz_seasons").update({ is_current: false }).neq("id", id);
  await sb.from("gz_seasons").update({ is_current: true }).eq("id", id);
  loadSeasons();
}

async function delSeason(id) {
  if (!await uiConfirm("Supprimer cette saison ?")) return;
  await sb.from("gz_seasons").delete().eq("id", id);
  loadSeasons();
}

async function loadCats() {
  const { data } = await sb.from("gz_price_categories").select("*").order("created_at");
  $("gz-cats").innerHTML = (data || []).map(catCardHTML).join("") || '<p class="muted">Aucune catégorie.</p>';
  document.querySelectorAll(".gz-cat").forEach(wireCatCard);
}

function catCardHTML(c) {
  const prices = Array.isArray(c.prices) ? c.prices : [];
  const rows = prices.map((p, i) => priceRowHTML(p.label, p.amount, i)).join("");
  return `<div class="gz-cat rg-card" data-id="${c.id}" style="background:#f5f7fb">
    <input class="gz-cat-name" value="${esc(c.name)}" style="font-weight:800;max-width:340px" />
    <table class="crm-table" style="margin:10px 0"><thead><tr><th>Libellé du prix</th><th>Montant (CHF)</th><th></th></tr></thead>
      <tbody class="gz-price-rows">${rows}</tbody></table>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" class="ghost gz-add-price">+ Prix</button>
      <span class="spacer" style="flex:1"></span>
      <button type="button" class="danger gz-del-cat">Supprimer</button>
      <button type="button" class="gz-save-cat">Enregistrer</button>
    </div></div>`;
}
function priceRowHTML(label, amount, i) {
  return `<tr><td><input class="gz-plabel" value="${esc(label || "")}" /></td>
    <td><input class="gz-pamount" type="number" min="0" value="${amount ?? 0}" style="width:90px" /></td>
    <td><button type="button" class="fam-del gz-del-price">✕</button></td></tr>`;
}
function wireCatCard(card) {
  card.querySelector(".gz-add-price").addEventListener("click", () => {
    card.querySelector(".gz-price-rows").insertAdjacentHTML("beforeend", priceRowHTML("", 0));
    card.querySelectorAll(".gz-del-price").forEach((b) => b.onclick = () => b.closest("tr").remove());
  });
  card.querySelectorAll(".gz-del-price").forEach((b) => b.onclick = () => b.closest("tr").remove());
  card.querySelector(".gz-save-cat").addEventListener("click", () => saveCat(card));
  card.querySelector(".gz-del-cat").addEventListener("click", () => delCat(card.dataset.id));
}

async function saveCat(card) {
  const name = card.querySelector(".gz-cat-name").value.trim();
  const prices = [...card.querySelectorAll(".gz-price-rows tr")].map((tr) => ({
    label: tr.querySelector(".gz-plabel").value.trim(),
    amount: Number(tr.querySelector(".gz-pamount").value),
  })).filter((p) => p.label);
  const { error } = await sb.from("gz_price_categories").update({ name, prices }).eq("id", card.dataset.id);
  const btn = card.querySelector(".gz-save-cat");
  btn.textContent = error ? "Erreur" : "✓ Enregistré";
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function createCat() {
  const name = await uiPrompt("Nom de la catégorie de tarifs :");
  if (!name) return;
  await sb.from("gz_price_categories").insert({ name, prices: [] });
  loadCats();
}

async function delCat(id) {
  if (!await uiConfirm("Supprimer cette catégorie de tarifs ?")) return;
  await sb.from("gz_price_categories").delete().eq("id", id);
  loadCats();
}

function renderChips(containerId, items, selected) {
  const set = new Set(selected || []);
  $(containerId).innerHTML = items.map(([val, label]) =>
    `<button type="button" class="chip ${set.has(String(val)) ? "sel" : ""}" data-val="${val}">${esc(label)}</button>`).join("");
  $(containerId).querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => c.classList.toggle("sel")));
}
const chipValues = (id) => [...document.querySelectorAll("#" + id + " .chip.sel")].map((c) => c.dataset.val);
function updateCount() {
  $("c-count").textContent = `(${cPlayerSel.size} / 30)`;
}

// Sélecteur de joueurs du cours : recherche + affiche 30 résultats max (les sélectionnés restent toujours visibles)
let cPlayers = [], cPlayerSel = new Set();
function renderPlayerChips() {
  const q = ($("c-search").value || "").trim().toLowerCase();
  const sel = cPlayers.filter((p) => cPlayerSel.has(String(p[0])));
  let pool = cPlayers.filter((p) => !cPlayerSel.has(String(p[0])));
  if (q) pool = pool.filter((p) => p[1].toLowerCase().includes(q));
  const shown = [...sel, ...pool.slice(0, 10)];
  const extra = pool.length - Math.min(pool.length, 10);
  $("c-children").innerHTML = shown.map(([val, label]) =>
    `<button type="button" class="chip ${cPlayerSel.has(String(val)) ? "sel" : ""}" data-val="${val}">${esc(label)}</button>`).join("")
    + (extra > 0 ? `<span class="muted c-more">+${extra} autres — affinez la recherche</span>` : "");
  $("c-children").querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
    const v = String(c.dataset.val);
    if (cPlayerSel.has(v)) cPlayerSel.delete(v); else cPlayerSel.add(v);
    renderPlayerChips(); updateCount();
  }));
}

function openCourse(course, related) {
  $("c-error").hidden = true;
  $("course-title").textContent = course ? "Modifier le cours" : "Nouveau cours";
  $("c-id").value = course?.id || "";
  $("c-type").value = course?.course_type_id || "";
  $("c-label").value = course?.title || "";
  $("c-date").value = course?.course_date || $("cs-date").value;
  $("c-start").value = course ? course.start_time.slice(0, 5) : "17:00";
  $("c-end").value = course ? course.end_time.slice(0, 5) : "18:00";
  const cType = courseTypes.find((t) => t.id === course?.course_type_id);
  $("c-color").value = cType?.color || course?.color || "#0b6b3a";
  renderChips("c-courts", resaCourtsAll.map((c) => [c.id, c.name.replace("Court ", "C")]), related?.courts);
  renderChips("c-coaches", people.filter((p) => hasRoleIn(p.id, COACH_ROLES)).map((p) => [p.id, `${p.last_name} ${p.first_name}`]), related?.coaches);
  cPlayers = people.filter((p) => hasRoleIn(p.id, COURSE_ROLES))
    .map((p) => [p.id, `${p.last_name} ${p.first_name}`])
    .sort((a, b) => a[1].localeCompare(b[1]));
  cPlayerSel = new Set((related?.children || []).map(String));
  $("c-search").value = "";
  renderPlayerChips();
  updateCount();
  $("c-del").classList.toggle("hidden", !course);
  // Présences (seulement en édition d'un cours existant)
  // Cours détaillé (pro/SE + plusieurs courts/coachs) : le détail remplace les présences manuelles.
  const needsDetail = courseNeedsDetail(course, related?.courts || [], related?.coaches || []);
  $("c-att-block").classList.toggle("hidden", !course || needsDetail);
  if (course && !needsDetail) renderCourseAtt(course, related?.coaches || [], related?.children || [], related?.attendance || []);
  if (course) courseDetailMaybe(course, related?.courts || [], related?.coaches || [], related?.children || []);
  else { $("c-detail-block")?.classList.add("hidden"); $("c-detail").innerHTML = ""; }
  $("course-modal").classList.remove("hidden");
}

function renderCourseAtt(course, coachIds, childIds, att) {
  const statusOf = (pid) => att.find((a) => a.person_id === pid)?.status || "";
  $("c-att").innerHTML = attCol(course, coachIds, coachIds, true, "Coachs", statusOf)
    + attCol(course, coachIds, childIds, false, "Élèves", statusOf);
  $("c-att").querySelectorAll(".att-chip").forEach((ch) => ch.addEventListener("click", () => cycleAtt(ch)));
}

async function editCourse(id) {
  const course = (await sb.from("courses").select("*").eq("id", id).single()).data;
  const [courts, coaches, children, attendance] = await Promise.all([
    sb.from("court_bookings").select("court_id").eq("course_id", id).then((r) => (r.data || []).map((x) => String(x.court_id))),
    sb.from("course_coaches").select("coach_person_id").eq("course_id", id).then((r) => (r.data || []).map((x) => x.coach_person_id)),
    sb.from("course_participants").select("child_person_id").eq("course_id", id).then((r) => (r.data || []).map((x) => x.child_person_id)),
    sb.from("attendance").select("person_id,status").eq("course_id", id).then((r) => r.data || []),
  ]);
  openCourse(course, { courts, coaches, children, attendance });
}

async function saveCourse(e) {
  e.preventDefault();
  const err = $("c-error"); err.hidden = true;
  const start = $("c-start").value, end = $("c-end").value;
  if (end <= start) return failC(err, "L'heure de fin doit être après le début.");
  const courts = chipValues("c-courts");
  if (!courts.length) return failC(err, "Sélectionnez au moins un court.");
  const children = [...cPlayerSel];
  if (children.length > 30) return failC(err, "30 joueurs maximum.");
  const coaches = chipValues("c-coaches");

  const row = {
    course_type_id: $("c-type").value || null,
    title: $("c-label").value.trim() || null,
    course_date: $("c-date").value,
    start_time: start + ":00", end_time: end + ":00",
    color: $("c-color").value, created_by: meId,
  };
  const id = $("c-id").value;
  let courseId = id;
  if (id) {
    const { error } = await sb.from("courses").update(row).eq("id", id);
    if (error) return failC(err, error.message);
    // reset liens + occupations
    await Promise.all([
      sb.from("course_coaches").delete().eq("course_id", id),
      sb.from("course_participants").delete().eq("course_id", id),
      sb.from("court_bookings").delete().eq("course_id", id),
    ]);
  } else {
    const { data, error } = await sb.from("courses").insert(row).select("id").single();
    if (error) return failC(err, error.message);
    courseId = data.id;
  }

  // occupations des courts (bloque la grille)
  const label = row.title || courseTypes.find((t) => t.id === row.course_type_id)?.name || "Cours";
  let conflicts = 0;
  for (const cid of courts) {
    const { error } = await sb.from("court_bookings").insert({
      court_id: Number(cid), booking_date: row.course_date,
      start_time: row.start_time, end_time: row.end_time,
      kind: "cours", title: label, color: row.color, created_by: meId, course_id: courseId,
    });
    if (error) conflicts++;
  }
  if (coaches.length) await sb.from("course_coaches").insert(coaches.map((p) => ({ course_id: courseId, coach_person_id: p })));
  if (children.length) await sb.from("course_participants").insert(children.map((p) => ({ course_id: courseId, child_person_id: p })));

  if (conflicts) alert(`Cours enregistré, mais ${conflicts} court(s) étai(en)t déjà occupé(s) sur ce créneau.`);
  $("course-modal").classList.add("hidden");
  loadCoursesCurrent();
}

async function deleteCourse() {
  const id = $("c-id").value;
  if (!id || !await uiConfirm("Supprimer ce cours (et libérer les courts) ?")) return;
  await sb.from("courses").delete().eq("id", id); // cascade : bookings, coaches, participants, présences
  $("course-modal").classList.add("hidden");
  loadCoursesCurrent();
}

const mondayOf = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoA(d); };
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoA(d); };

let cwSrcMon = null, cwSrcEnd = null, cwToCreate = null, cwTgtMon = null, cwCoaches = [], cwParts = [], cwConflicts = [];

function copyWeek() { // ouvre le modal
  cwSrcMon = mondayOf($("cs-date").value);
  cwSrcEnd = addDays(cwSrcMon, 6);
  cwToCreate = null;
  $("cw-src").textContent = `Copier tous les cours de la semaine du ${frDate(cwSrcMon)} vers :`;
  $("cw-date").value = addDays(cwSrcMon, 7);
  $("cw-summary").hidden = true; $("cw-summary").innerHTML = "";
  $("cw-error").hidden = true;
  $("cw-go").disabled = false; $("cw-go").textContent = "Vérifier";
  $("copyweek-modal").classList.remove("hidden");
}

async function cwGo() {
  if (cwToCreate) return cwRun();
  const err = $("cw-error"); err.hidden = true;
  const target = $("cw-date").value;
  if (!target) { err.textContent = "Choisis une semaine cible."; err.hidden = false; return; }
  cwTgtMon = mondayOf(target);
  const offset = Math.round((new Date(cwTgtMon) - new Date(cwSrcMon)) / 86400000);
  if (offset === 0) { err.textContent = "C'est la même semaine."; err.hidden = false; return; }
  const { data: courses } = await sb.from("courses").select("*").gte("course_date", cwSrcMon).lte("course_date", cwSrcEnd);
  if (!courses || !courses.length) { err.textContent = "Aucun cours dans cette semaine."; err.hidden = false; return; }
  const ids = courses.map((c) => c.id);
  let books;
  [books, cwCoaches, cwParts] = await Promise.all([
    sb.from("court_bookings").select("course_id,court_id").in("course_id", ids).then((r) => r.data || []),
    sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", ids).then((r) => r.data || []),
    sb.from("course_participants").select("course_id,child_person_id").in("course_id", ids).then((r) => r.data || []),
  ]);
  const toCreate = [], conflicts = [];
  for (const c of courses) {
    const newDate = addDays(c.course_date, offset);
    const courts = books.filter((b) => b.course_id === c.id).map((b) => b.court_id);
    const { data: clash } = await sb.from("court_bookings").select("court_id")
      .eq("booking_date", newDate).in("court_id", courts).lt("start_time", c.end_time).gt("end_time", c.start_time);
    if (clash && clash.length) conflicts.push(`${frDate(newDate)} ${c.start_time.slice(0, 5)} — ${c.title || "cours"}`);
    else toCreate.push({ c, newDate, courts });
  }
  cwConflicts = conflicts;
  $("cw-summary").hidden = false;
  $("cw-summary").innerHTML = `<b>${toCreate.length}</b> cours ${toCreate.length > 1 ? "seront copiés" : "sera copié"} vers la semaine du <b>${frDate(cwTgtMon)}</b>.`
    + (conflicts.length ? `<div class="cw-warn">${conflicts.length} en conflit (ignorés, rien n'est écrasé) :<br>${conflicts.map(esc).join("<br>")}</div>` : "");
  if (!toCreate.length) { $("cw-go").disabled = true; $("cw-go").textContent = "Rien à copier"; return; }
  cwToCreate = toCreate;
  $("cw-go").textContent = `Copier ${toCreate.length} cours`;
}

async function cwRun() {
  $("cw-go").disabled = true; $("cw-go").textContent = "Copie…";
  let created = 0;
  for (const { c, newDate, courts } of cwToCreate) {
    const { data: nc } = await sb.from("courses").insert({
      course_type_id: c.course_type_id, title: c.title, course_date: newDate,
      start_time: c.start_time, end_time: c.end_time, color: c.color, created_by: meId,
    }).select("id").single();
    if (!nc) continue;
    for (const court of courts) await sb.from("court_bookings").insert({
      court_id: court, booking_date: newDate, start_time: c.start_time, end_time: c.end_time,
      kind: "cours", title: c.title || "Cours", color: c.color, created_by: meId, course_id: nc.id,
    });
    const cs = cwCoaches.filter((x) => x.course_id === c.id).map((x) => ({ course_id: nc.id, coach_person_id: x.coach_person_id }));
    if (cs.length) await sb.from("course_coaches").insert(cs);
    const ps = cwParts.filter((x) => x.course_id === c.id).map((x) => ({ course_id: nc.id, child_person_id: x.child_person_id }));
    if (ps.length) await sb.from("course_participants").insert(ps);
    created++;
  }
  $("copyweek-modal").classList.add("hidden");
  cwToCreate = null;
  alert(`✓ ${created} cours copiés.` + (cwConflicts.length ? ` ${cwConflicts.length} ignoré(s) pour conflit.` : ""));
  loadCoursesCurrent();
}
function failC(el, msg) { el.textContent = msg; el.hidden = false; }

function closePerson() {
  $("people-detail").classList.add("hidden");
  $("people-list-wrap").classList.remove("hidden");
}

async function savePerson(e) {
  e.preventDefault();
  const err = $("person-error");
  err.hidden = true;
  const lines = (id) => $(id).value.split("\n").map((x) => x.trim()).filter(Boolean);
  const row = {
    first_name: $("p-first").value.trim(),
    last_name: $("p-last").value.trim(),
    birthdate: $("p-birth").value || null,
    gender: $("p-gender").value || null,
    email: $("p-email").value.trim() || null,
    phone: $("p-phone").value.trim() || null,
    avs: $("p-avs").value.trim() || null,
    license_no: $("p-license").value.trim() || null,
    iban: $("p-iban").value.trim() || null,
    emails: lines("p-emails"),
    phones: lines("p-phones"),
    photo_url: personPhotoUrl,
    address: $("p-address").value.trim() || null,
    parent1: $("p-parent1").value.trim() || null,
    parent2: $("p-parent2").value.trim() || null,
    tshirt: $("p-tshirt").value.trim() || null,
    shorts: $("p-shorts").value.trim() || null,
    hoodie: $("p-hoodie").value.trim() || null,
    sweatpants: $("p-sweatpants").value.trim() || null,
    postal_code: $("p-postal").value.trim() || null,
    city: $("p-city").value.trim() || null,
    is_active: $("p-active").checked,
    notes: $("p-notes").value.trim() || null,
  };
  let id = $("p-id").value;
  let error;
  if (id) ({ error } = await sb.from("people").update(row).eq("id", id));
  else {
    const res = await sb.from("people").insert(row).select("id").single();
    error = res.error; id = res.data?.id;
  }
  if (error) { err.textContent = "Enregistrement impossible : " + error.message; err.hidden = false; return; }
  // Rôles : on remplace l'ensemble
  if (id) {
    await sb.from("person_roles").delete().eq("person_id", id);
    const rr = [...personRolesSel].map((role) => ({ person_id: id, role }));
    if (rr.length) await sb.from("person_roles").insert(rr);
    // Répercute les rôles d'ACCÈS (staff) vers user_roles = source d'accès réelle.
    const okAcc = await syncAccessRoles(id, personRolesSel);
    if (!okAcc) alert("Fiche enregistrée. Mais les rôles d'ACCÈS (staff) n'ont pas pu être mis à jour — réservé à un admin (superadmin/admin). L'accès réel est inchangé.");
  }
  closePerson();
  loadPeople();
}

// Rôles d'accès pilotant la console/RLS. Miroir fiche -> user_roles (uniquement
// pour une personne AYANT un compte). On ne touche PAS membre/junior/parent
// (saisonniers, gérés dans role_periods). Écriture réservée aux admins (RLS is_admin).
const ACCESS_SYNC_ROLES = ["superadmin", "admin", "secretaire", "head_coach", "coach", "coach_physique", "moniteur", "prof", "coach_mental", "organisateur"];
// Correspondance chip répertoire (person_roles) -> rôle d'accès (user_roles) quand les libellés diffèrent.
const CHIP_TO_ACCESS = { official: "organisateur", "head-coach": "head_coach", "coach-mental": "coach_mental" };
async function syncAccessRoles(personId, rolesSet) {
  const { data: prof } = await sb.from("profiles").select("user_id").eq("person_id", personId).maybeSingle();
  if (!prof?.user_id) return true;                       // pas de compte -> rien à synchroniser
  const want = [...new Set([...rolesSet].map((r) => CHIP_TO_ACCESS[r] || r).filter((r) => ACCESS_SYNC_ROLES.includes(r)))].sort();
  const { data: cur } = await sb.from("user_roles").select("role").eq("user_id", prof.user_id).in("role", ACCESS_SYNC_ROLES);
  const have = (cur || []).map((x) => x.role).sort();
  if (have.length === want.length && have.every((r, i) => r === want[i])) return true; // déjà aligné
  if (!myAppRoles.some((r) => r === "superadmin" || r === "admin")) return false;      // changement demandé mais pas admin
  await sb.from("user_roles").delete().eq("user_id", prof.user_id).in("role", ACCESS_SYNC_ROLES);
  if (want.length) {
    const { error } = await sb.from("user_roles").insert(want.map((role) => ({ user_id: prof.user_id, role })));
    if (error) return false;
  }
  return true;
}

async function deletePerson() {
  const id = $("p-id").value;
  if (!id || !await uiConfirm("Supprimer définitivement cette fiche ?")) return;
  const { error } = await sb.from("people").delete().eq("id", id);
  if (error) { alert("Suppression impossible : " + error.message); return; }
  closePerson();
  loadPeople();
}

// ---- Licence Swiss Tennis : décodage naissance/sexe + remplissage auto ----
function licDecode(lic) {
  const m = String(lic || "").trim().match(/^(\d+)\.(\d{2})\.(\d)(\d{2})\.(\d+)$/);
  if (!m) return null;
  const yy = +m[2], d1 = +m[3], dc = +m[4];
  if (d1 < 1 || d1 > 8 || dc < 1 || dc > 93) return null;
  const monthOff = Math.floor((dc - 1) / 31);
  const month = ((d1 - 1) % 4) * 3 + 1 + monthOff;
  const day = dc - monthOff * 31;
  let year = 2000 + yy;
  if (year > new Date().getFullYear()) year -= 100;
  const dt = new Date(year, month - 1, day);
  if (dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return { birthdate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, sex: d1 <= 4 ? "M" : "F" };
}
function updateLicHint() {
  const el = $("p-license-hint"); if (!el) return;
  const raw = $("p-license").value.trim();
  if (!raw) { el.textContent = ""; el.className = "lic-hint"; return; }
  const d = licDecode(raw);
  if (!d) { el.textContent = "Format non reconnu."; el.className = "lic-hint warn"; return; }
  const sexLbl = d.sex === "M" ? "garçon" : "fille";
  const b = $("p-birth").value;
  if (b && b !== d.birthdate) {
    el.textContent = `Décodé : ${frDate(d.birthdate)} · ${sexLbl} ⚠ ne correspond pas à la naissance saisie`;
    el.className = "lic-hint warn";
  } else {
    el.textContent = `Décodé : ${frDate(d.birthdate)} · ${sexLbl}${b ? " ✓" : ""}`;
    el.className = "lic-hint ok";
  }
}
async function findLicensesMt() {
  if (!await uiConfirm("Chercher sur mytennis les licences manquantes (par nom, confirmées par la date de naissance) ?\nCela peut prendre quelques dizaines de secondes.")) return;
  const btn = $("find-lic-mt"); btn.disabled = true; btn.textContent = "Recherche sur mytennis…";
  const { data, error } = await sb.functions.invoke("mt-find-licenses", { body: {} });
  btn.disabled = false; btn.textContent = "Chercher sur mytennis";
  if (error || data?.error) { alert("Erreur : " + (data?.error || error?.message)); return; }
  alert(`${data.filled} licence(s) trouvée(s) sur mytennis et ajoutée(s).\n`
    + `${data.notfound} sans correspondance · ${data.ambiguous} ambigu(s) (sur ${data.total} fiches sans licence).`);
  loadPeople();
}

async function autofillLicenses() {
  if (!await uiConfirm("Retrouver les n° de licence des membres depuis les participants GameZone (par nom + date de naissance) ?")) return;
  const btn = $("autofill-lic"); btn.disabled = true; btn.textContent = "Recherche…";
  const { data, error } = await sb.rpc("autofill_licenses_from_gz");
  btn.disabled = false; btn.textContent = "Retrouver les licences";
  if (error) { alert("Erreur : " + error.message); return; }
  alert(`${data.filled} licence(s) trouvée(s) et remplie(s).` + (data.ambiguous ? `\n${data.ambiguous} cas ambigu(s) laissé(s) de côté (à saisir à la main).` : ""));
  loadPeople();
}

// ---- Tarifs & IBAN du coach (sous-onglet Coach) ----
async function loadCoachRates(personId) {
  const list = $("coach-rates-list"), need = $("coach-need-save");
  if (!list) return;
  if (!personId) { list.innerHTML = ""; need.hidden = false; return; }
  need.hidden = true;
  const { data } = await sb.from("coach_rates").select("*").eq("person_id", personId).order("is_default", { ascending: false }).order("created_at");
  const rows = data || [];
  list.innerHTML = rows.length ? rows.map((r) => `<div class="coach-rate-row">
    <span>${esc(r.label)} — <b>${r.chf_per_hour}.–/h</b>${r.is_default ? ' <span class="he-val">par défaut</span>' : ""}</span>
    <span class="coach-rate-acts">
      ${r.is_default ? "" : `<button type="button" class="ghost cr-def" data-id="${r.id}">Par défaut</button>`}
      <button type="button" class="ghost cr-del" data-id="${r.id}">Suppr.</button>
    </span></div>`).join("") : `<p class="muted" style="font-size:.85rem">Aucun tarif défini.</p>`;
  list.querySelectorAll(".cr-del").forEach((b) => b.addEventListener("click", () => deleteCoachRate(b.dataset.id, personId)));
  list.querySelectorAll(".cr-def").forEach((b) => b.addEventListener("click", () => setDefaultRate(b.dataset.id, personId)));
}
async function addCoachRate() {
  const personId = $("p-id").value;
  if (!personId) { alert("Enregistrez d'abord la personne, puis rouvrez sa fiche."); return; }
  const label = $("cr-label").value.trim(), chf = $("cr-chf").value;
  if (!label || !chf) { alert("Libellé et tarif requis."); return; }
  if ($("cr-default").checked) await sb.from("coach_rates").update({ is_default: false }).eq("person_id", personId);
  await sb.from("coach_rates").insert({ person_id: personId, label, chf_per_hour: Number(chf), is_default: $("cr-default").checked });
  $("cr-label").value = ""; $("cr-chf").value = ""; $("cr-default").checked = false;
  loadCoachRates(personId);
}
async function deleteCoachRate(id, personId) { await sb.from("coach_rates").delete().eq("id", id); loadCoachRates(personId); }
async function setDefaultRate(id, personId) {
  await sb.from("coach_rates").update({ is_default: false }).eq("person_id", personId);
  await sb.from("coach_rates").update({ is_default: true }).eq("id", id);
  loadCoachRates(personId);
}

async function invitePerson() {
  const id = $("p-id").value;
  const email = $("p-email").value.trim();
  const box = $("p-invite-result");
  if (!email) { alert("Renseignez un email dans la fiche, enregistrez, puis créez l'accès."); return; }
  if (!await uiConfirm(`Créer un accès au portail « Mon espace » pour ${email} ?`)) return;
  const btn = $("invite-person");
  btn.disabled = true; btn.textContent = "Création…";
  const { data, error } = await sb.functions.invoke("invite-member", {
    body: { person_id: id || null, email, redirectTo: location.origin + "/set-password.html" },
  });
  btn.disabled = false; btn.textContent = "Créer un accès portail";
  if (error || data?.error) { alert("Échec : " + (data?.error || error?.message)); return; }
  const link = data.action_link || "";
  const reactiv = data.mode === "recovery";
  box.classList.remove("hidden");
  box.innerHTML = `
    <p class="invite-ok">✅ Accès ${reactiv ? "ré-activé" : "créé"} pour <b>${email}</b>.</p>
    <p class="muted" style="margin:.3rem 0">Envoie ce lien d'activation à la personne (email, WhatsApp…) — il ouvre la page où elle choisit son mot de passe, puis « Mon espace ».</p>
    <div class="invite-linkrow">
      <input type="text" id="p-invite-link" readonly value="${link}" />
      <button type="button" id="p-invite-copy">Copier</button>
    </div>`;
  $("p-invite-copy").addEventListener("click", async () => {
    const inp = $("p-invite-link");
    try { await navigator.clipboard.writeText(inp.value); }
    catch { inp.select(); document.execCommand("copy"); }
    $("p-invite-copy").textContent = "Copié ✓";
    setTimeout(() => { $("p-invite-copy").textContent = "Copier"; }, 1500);
  });
}

// ===================================================================
//  News (actualités du portail « Mon espace »)
// ===================================================================
const NEWS_AUDIENCES = [["membre", "Membres"], ["kidstennis", "KidsTennis"], ["club", "Club"],
  ["competition", "Compétition"], ["performance", "Performance"], ["sport-etudes", "Sport-études"],
  ["pro-u18", "Pro U18"], ["pro", "Pro"]];
const newsAudLabel = (a) => (NEWS_AUDIENCES.find(([v]) => v === a) || [a, a])[1];
let newsList = [], newsImageUrl = null;

function initNews() {
  $("news-new").addEventListener("click", () => openNews(null));
  $("news-close").addEventListener("click", closeNews);
  $("news-form").addEventListener("submit", saveNews);
  $("n-delete").addEventListener("click", deleteNews);
  $("n-img-btn").addEventListener("click", () => $("n-img-file").click());
  $("n-img-file").addEventListener("change", (e) => { if (e.target.files[0]) uploadNewsImage(e.target.files[0]); });
  $("n-img-clear").addEventListener("click", () => { newsImageUrl = null; updateNewsImg(); });
}

async function loadNews() {
  const { data } = await sb.from("news").select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  newsList = data || [];
  const box = $("news-list");
  if (!newsList.length) { box.innerHTML = `<p class="muted">Aucune news pour l'instant. Cliquez « + Nouvelle news ».</p>`; return; }
  box.innerHTML = newsList.map((n) => {
    const aud = (n.audiences && n.audiences.length)
      ? n.audiences.map((a) => `<span class="role-badge">${esc(newsAudLabel(a))}</span>`).join(" ")
      : `<span class="role-badge">Tout le monde</span>`;
    return `<div class="news-adm-card" data-id="${n.id}">
      ${n.image_url ? `<img class="news-adm-thumb" src="${esc(n.image_url)}" alt="" />` : `<div class="news-adm-thumb ph">📣</div>`}
      <div class="news-adm-info">
        <div class="news-adm-top"><b>${esc(n.title)}</b>
          <span class="news-state ${n.published ? "pub" : "draft"}">${n.published ? "Publié" : "Brouillon"}</span></div>
        <div class="news-adm-aud">${aud}</div>
        <div class="muted news-adm-date">${n.published_at ? frDate(n.published_at) : "non publié"}</div>
      </div></div>`;
  }).join("");
  box.querySelectorAll(".news-adm-card").forEach((c) =>
    c.addEventListener("click", () => openNews(newsList.find((x) => x.id === c.dataset.id))));
}

function renderNewsAud(sel) {
  $("n-aud").innerHTML = NEWS_AUDIENCES.map(([v, l]) =>
    `<label class="news-aud-chk"><input type="checkbox" value="${v}"${sel.includes(v) ? " checked" : ""} /> ${esc(l)}</label>`).join("");
}
function updateNewsImg() {
  const img = $("n-img-preview");
  if (newsImageUrl) {
    img.src = newsImageUrl; img.classList.remove("hidden");
    $("n-img-clear").classList.remove("hidden"); $("n-img-btn").textContent = "Changer l'image";
  } else {
    img.classList.add("hidden"); $("n-img-clear").classList.add("hidden"); $("n-img-btn").textContent = "Ajouter une image";
  }
}
function openNews(n) {
  $("n-error").hidden = true;
  $("news-modal-title").textContent = n ? "Modifier la news" : "Nouvelle news";
  $("n-id").value = n?.id || "";
  $("n-title").value = n?.title || "";
  $("n-body").value = n?.body || "";
  $("n-published").checked = !!n?.published;
  newsImageUrl = n?.image_url || null;
  updateNewsImg();
  renderNewsAud(n?.audiences || []);
  $("n-delete").classList.toggle("hidden", !n);
  $("news-modal").classList.remove("hidden");
}
function closeNews() { $("news-modal").classList.add("hidden"); }

async function uploadNewsImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `news/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from("gz-photos").upload(path, file, { upsert: true, contentType: file.type });
  if (error) { alert("Upload impossible : " + error.message); return; }
  newsImageUrl = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  updateNewsImg();
}

async function saveNews(e) {
  e.preventDefault();
  const err = $("n-error"); err.hidden = true;
  const title = $("n-title").value.trim();
  if (!title) { err.textContent = "Le titre est obligatoire."; err.hidden = false; return; }
  const id = $("n-id").value;
  const published = $("n-published").checked;
  const wasPublished = id ? !!newsList.find((x) => x.id === id)?.published : false;
  const row = {
    title, body: $("n-body").value.trim() || null, image_url: newsImageUrl,
    audiences: [...$("n-aud").querySelectorAll("input:checked")].map((i) => i.value),
    published, updated_at: new Date().toISOString(),
  };
  if (published && !wasPublished) row.published_at = new Date().toISOString();
  const res = id ? await sb.from("news").update(row).eq("id", id) : await sb.from("news").insert(row);
  if (res.error) { err.textContent = "Enregistrement impossible : " + res.error.message; err.hidden = false; return; }
  closeNews();
  loadNews();
}

async function deleteNews() {
  const id = $("n-id").value;
  if (!id || !await uiConfirm("Supprimer cette news ?")) return;
  const { error } = await sb.from("news").delete().eq("id", id);
  if (error) { alert("Suppression impossible : " + error.message); return; }
  closeNews();
  loadNews();
}

// ===================================================================
//  Inscriptions (demandes depuis les pages de filière du site)
// ===================================================================
const FILIERE_LABEL = { competition: "Compétition", performance: "Performance", club: "Club", kidstennis: "KidsTennis" };
let inscList = [];

async function loadInscriptions() {
  const { data, error } = await sb.rpc("list_enrollment_requests");
  inscList = error ? [] : (data || []);
  const box = $("insc-list");
  if (!inscList.length) { box.innerHTML = `<p class="muted">Aucune demande d'inscription pour le moment.</p>`; return; }
  box.innerHTML = inscList.map((r) => {
    const done = r.status === "ajoute";
    const info = [r.birthdate ? "Né(e) le " + frDate(r.birthdate) : "", r.avs ? "AVS " + esc(r.avs) : ""].filter(Boolean).join(" · ");
    const contact = [
      r.phone ? `<a href="tel:${esc(r.phone.replace(/\s/g, ""))}">${esc(r.phone)}</a>` : "",
      r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : "",
    ].filter(Boolean).join(" · ");
    return `<div class="insc-card">
      <div class="insc-top">
        <span class="insc-fil">${esc(FILIERE_LABEL[r.filiere] || r.filiere)}</span>
        <b>${esc(r.first_name)} ${esc(r.last_name)}</b>
        ${r.ranking ? `<span class="insc-rank">Classement : ${esc(r.ranking)}</span>` : ""}
        <span class="muted insc-date">${frDate(r.created_at)}</span>
      </div>
      ${info ? `<div class="insc-line">${info}</div>` : ""}
      ${contact ? `<div class="insc-line">${contact}</div>` : ""}
      ${r.comment ? `<div class="insc-comment">${esc(r.comment)}</div>` : ""}
      ${r.dup ? `<div class="insc-dup">⚠ Doublon possible : <b>${esc(r.dup.name)}</b> existe déjà dans le répertoire.</div>` : ""}
      <div class="insc-acts">
        ${done ? `<span class="insc-added">✅ Ajouté au répertoire</span>`
               : `<button class="insc-add" data-id="${r.id}">Ajouter au répertoire</button>`}
        <button class="insc-del ghost" data-id="${r.id}">Supprimer</button>
      </div>
    </div>`;
  }).join("");
  box.querySelectorAll(".insc-add").forEach((b) => b.addEventListener("click", () => addToRepertoire(b.dataset.id)));
  box.querySelectorAll(".insc-del").forEach((b) => b.addEventListener("click", () => deleteInscription(b.dataset.id)));
}

async function addToRepertoire(id) {
  const r = inscList.find((x) => x.id === id);
  if (!r) return;
  if (r.dup && !await uiConfirm(`Un profil « ${r.dup.name} » existe peut-être déjà.\nCréer quand même une nouvelle fiche ?`)) return;
  if (!r.dup && !await uiConfirm(`Ajouter ${r.first_name} ${r.last_name} au répertoire ?`)) return;
  const ins = await sb.from("people").insert({
    first_name: r.first_name, last_name: r.last_name,
    birthdate: r.birthdate || null, avs: r.avs || null,
    email: r.email || null, phone: r.phone || null,
    emails: r.email ? [r.email] : [], phones: r.phone ? [r.phone] : [],
    is_active: true, notes: r.comment || null,
  }).select("id").single();
  if (ins.error) { alert("Création impossible : " + ins.error.message); return; }
  const pid = ins.data.id;
  if (r.filiere) await sb.from("person_roles").insert({ person_id: pid, role: r.filiere });
  await sb.from("enrollment_requests").update({ status: "ajoute", added_person_id: pid }).eq("id", id);
  loadInscriptions();
  loadPeople();
}

async function deleteInscription(id) {
  if (!await uiConfirm("Supprimer cette demande ?")) return;
  const { error } = await sb.from("enrollment_requests").delete().eq("id", id);
  if (error) { alert("Suppression impossible : " + error.message); return; }
  loadInscriptions();
}

// ===================================================================
//  Prospects (scouting jeunes joueurs suisses)
// ===================================================================
const PROSP_STATUS = { nouveau: "Nouveau", en_cours: "En cours", interesse: "Intéressé", jamais_repondu: "Jamais répondu", pas_maintenant: "Pas pour le moment", impossible: "Impossible" };
const ROMANDIE = ["VD", "GE", "VS", "FR", "NE", "JU"];
let prospList = [], prospInit = false, prospSort = { key: "class", dir: "desc" };
const ageOf = (bd) => { if (!bd) return null; const d = new Date(bd), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--; return a; };
const classTier = (c) => { c = (c || "").toUpperCase(); if (/^N/.test(c)) return "N"; const m = c.match(/^R([1-9])/); return m ? "R" + m[1] : ""; };

function initProspects() {
  if (prospInit) return; prospInit = true;
  ["prosp-search", "prosp-fclass", "prosp-fage", "prosp-fstatus", "prosp-fcanton", "prosp-fsex", "prosp-fdist"].forEach((id) => $(id).addEventListener("input", renderProspRows));
  $("prosp-fupset").addEventListener("change", renderProspRows);
  $("prosp-geocode").addEventListener("click", geocodeDistances);
  document.querySelectorAll(".prosp-subtab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".prosp-subtab").forEach((x) => x.classList.toggle("active", x === b));
    $("prosp-sub-liste").classList.toggle("hidden", b.dataset.psub !== "liste");
    $("prosp-sub-import").classList.toggle("hidden", b.dataset.psub !== "import");
  }));
  document.querySelectorAll(".prosp-table th[data-sort]").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.sort;
    if (prospSort.key === k) prospSort.dir = prospSort.dir === "asc" ? "desc" : "asc";
    else prospSort = { key: k, dir: (["name", "club", "canton", "status"].includes(k) ? "asc" : "desc") };
    renderProspRows();
  }));
  loadProspBookmarklet();
  loadProspResultsBookmarklet();
  loadProspContactBookmarklet();
}
async function loadProspContactBookmarklet() {
  const { data } = await sb.from("gz_config").select("import_key").maybeSingle();
  if (!data) { $("prosp-contact-note").textContent = "Clé d'import indisponible."; return; }
  let src;
  try { src = await (await fetch("prosp-contact-bookmarklet.js")).text(); }
  catch (_e) { $("prosp-contact-note").textContent = "Impossible de charger le bookmarklet."; return; }
  const code = src.replace("__KEY__", data.import_key).replace("__RCV__", location.origin + "/prosp-contact-receiver.html");
  const aEl = document.createElement("a");
  aEl.href = "javascript:" + encodeURIComponent(code);
  aEl.textContent = "Coordonnées";
  aEl.className = "btn-prod"; aEl.style.textDecoration = "none";
  aEl.addEventListener("click", (e) => { e.preventDefault(); alert("Ne cliquez pas ici : GLISSEZ ce bouton dans vos favoris, puis utilisez-le sur la fiche « Voir la licence » d'un joueur."); });
  $("prosp-contact-holder").innerHTML = ""; $("prosp-contact-holder").appendChild(aEl);
  $("prosp-contact-note").textContent = "Astuce : glissez-le dans la barre de favoris.";
}
async function loadProspects() {
  initProspects();
  let all = [], from = 0;
  for (;;) {
    const { data } = await sb.from("prospects").select("*").order("ranking_value", { ascending: false, nullsFirst: false }).range(from, from + 999);
    if (!data || !data.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  prospList = all;
  populateCantons();
  renderProspRows();
  renderRecentUpsets();
}
function populateCantons() {
  const sel = $("prosp-fcanton"); if (!sel) return;
  const cur = sel.value;
  const cantons = [...new Set(prospList.map((p) => p.canton).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">Toute la Suisse</option><option value="romandie">Romandie</option>`
    + cantons.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  sel.value = cur;
}
function sortProspects(rows) {
  const k = prospSort.key, dir = prospSort.dir === "asc" ? 1 : -1;
  const val = (p) => {
    if (k === "name") return `${p.last_name || ""} ${p.first_name || ""}`.toLowerCase();
    if (k === "class") return p.ranking_value != null ? Number(p.ranking_value) : -1;
    if (k === "age") return p.birthdate || "9999";
    if (k === "club") return (p.club || "").toLowerCase();
    if (k === "canton") return (p.canton || "").toLowerCase();
    if (k === "matchs") return p.match_count || 0;
    if (k === "exploits") return p.upset_count || 0;
    if (k === "status") return p.status || "";
    return 0;
  };
  return rows.sort((a, b) => { const va = val(a), vb = val(b); return va < vb ? -dir : va > vb ? dir : 0; });
}
async function geocodeDistances() {
  const btn = $("prosp-geocode");
  const { data: cfg } = await sb.from("gz_config").select("import_key").maybeSingle();
  if (!cfg) { alert("Clé d'import indisponible."); return; }
  btn.disabled = true;
  let total = 0, done = false, guard = 0;
  while (!done && guard++ < 40) {
    btn.textContent = `Géocodage… (${total})`;
    let j;
    try { j = await (await fetch("https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/prospects-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: cfg.import_key, action: "geocode" }) })).json(); }
    catch (e) { alert("Erreur réseau : " + e.message); break; }
    if (!j.ok) { alert("Erreur : " + (j.error || "?")); break; }
    total += j.geocoded || 0; done = j.done;
    if (!j.geocoded && !j.done) break;
  }
  btn.disabled = false; btn.textContent = "Calculer les distances";
  alert(done ? `Distances calculées (${total} clubs géocodés).` : `Interrompu — ${total} clubs géocodés. Recliquez pour continuer.`);
  loadProspects();
}
let prospUpfeedOpen = true;
async function renderRecentUpsets() {
  const host = $("prosp-upsets"); if (!host) return;
  const { data } = await sb.from("prospect_matches").select("*").eq("is_upset", true).order("match_date", { ascending: false, nullsFirst: false }).limit(60);
  const ms = data || [];
  const byLic = {}; prospList.forEach((p) => { byLic[p.license_no] = p; });
  let count = 0;
  const items = ms.map((m) => {
    const p = byLic[m.prospect_license]; if (!p) return ""; count++;
    return `<div class="prosp-upitem" data-id="${p.id}"><b>${esc(p.first_name || "")} ${esc(p.last_name || "")}</b> <span class="muted">${esc(p.classification || "")}</span> a battu <b>${esc(((m.opponent_first || "") + " " + (m.opponent_last || "")).trim() || "?")}</b>${m.opponent_classification ? " (" + esc(m.opponent_classification) + ")" : ""} · ${esc(m.score || "")} · <span class="muted">${m.match_date ? frDate(m.match_date) : ""}</span></div>`;
  }).filter(Boolean).join("");
  if (!items) { host.innerHTML = ""; return; }
  host.innerHTML = `<div class="prosp-upfeed">
    <button type="button" class="prosp-upfeed-h" id="prosp-upfeed-toggle">🔥 Exploits récents (${count}) <span class="prosp-upfeed-chev">${prospUpfeedOpen ? "▲" : "▼"}</span></button>
    <div id="prosp-upfeed-body"${prospUpfeedOpen ? "" : " hidden"}>${items}</div>
  </div>`;
  $("prosp-upfeed-toggle").addEventListener("click", () => {
    prospUpfeedOpen = !prospUpfeedOpen;
    $("prosp-upfeed-body").hidden = !prospUpfeedOpen;
    $("prosp-upfeed-toggle").querySelector(".prosp-upfeed-chev").textContent = prospUpfeedOpen ? "▲" : "▼";
  });
  host.querySelectorAll(".prosp-upitem").forEach((el) => el.addEventListener("click", () => openProspect(el.dataset.id)));
}
async function loadProspResultsBookmarklet() {
  const { data } = await sb.from("gz_config").select("import_key").maybeSingle();
  if (!data) { $("prosp-res-note").textContent = "Clé d'import indisponible."; return; }
  let src;
  try { src = await (await fetch("prosp-results-bookmarklet.js")).text(); }
  catch (_e) { $("prosp-res-note").textContent = "Impossible de charger le bookmarklet."; return; }
  const code = src.replace("__KEY__", data.import_key).replace("__RCV__", location.origin + "/prosp-results-receiver.html");
  const aEl = document.createElement("a");
  aEl.href = "javascript:" + encodeURIComponent(code);
  aEl.textContent = "Scanner les résultats";
  aEl.className = "btn-prod"; aEl.style.textDecoration = "none";
  aEl.addEventListener("click", (e) => { e.preventDefault(); alert("Ne cliquez pas ici : GLISSEZ ce bouton dans vos favoris, puis utilisez-le sur mytennis (connecté)."); });
  $("prosp-res-holder").innerHTML = ""; $("prosp-res-holder").appendChild(aEl);
  $("prosp-res-note").textContent = "Astuce : glissez-le dans la barre de favoris.";
}
function renderProspRows() {
  const q = $("prosp-search").value.toLowerCase().trim();
  const fc = $("prosp-fclass").value, fa = $("prosp-fage").value, fs = $("prosp-fstatus").value, fu = $("prosp-fupset").checked, fca = $("prosp-fcanton").value, fsx = $("prosp-fsex").value, fd = $("prosp-fdist").value;
  const inClass = (c) => { const t = classTier(c); if (!fc) return true; if (fc === "N") return t === "N"; if (fc === "R1-R3") return ["R1", "R2", "R3"].includes(t); if (fc === "R4-R5") return ["R4", "R5"].includes(t); if (fc === "R6-R7") return ["R6", "R7"].includes(t); return true; };
  const inAge = (bd) => { if (!fa) return true; const a = ageOf(bd); if (a == null) return false; if (fa === "u12") return a <= 12; if (fa === "u14") return a >= 13 && a <= 14; if (fa === "u16") return a >= 15 && a <= 16; if (fa === "u18") return a >= 17 && a <= 18; return true; };
  const inCanton = (ct) => { if (!fca) return true; const c = (ct || "").toUpperCase(); return fca === "romandie" ? ROMANDIE.includes(c) : c === fca.toUpperCase(); };
  const inDist = (km) => { if (!fd) return true; return km != null && km <= Number(fd); };
  const rows = sortProspects(prospList.filter((p) =>
    (!q || `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase().includes(q))
    && inClass(p.classification) && inAge(p.birthdate) && inCanton(p.canton)
    && (!fsx || p.sex === fsx) && inDist(p.distance_km)
    && (!fs || p.status === fs) && (!fu || p.upset_count > 0)));
  $("prosp-empty").hidden = prospList.length > 0;
  document.querySelectorAll(".prosp-table th[data-sort]").forEach((th) => {
    const on = th.dataset.sort === prospSort.key;
    th.classList.toggle("sorted", on);
    th.dataset.dir = on ? prospSort.dir : "";
  });
  const CAP = 1000;
  $("prosp-count").textContent = rows.length > CAP
    ? `${rows.length} prospects — affichage des ${CAP} premiers (affine les filtres pour réduire)`
    : `${rows.length} prospect${rows.length > 1 ? "s" : ""}`;
  const tb = $("prosp-rows");
  tb.innerHTML = rows.slice(0, CAP).map((p) => {
    const a = ageOf(p.birthdate);
    return `<tr class="prosp-row" data-id="${p.id}">
      <td><b>${esc(p.last_name || "")}</b> ${esc(p.first_name || "")}</td>
      <td>${esc(p.classification || "—")}</td>
      <td>${a != null ? a : "—"}</td>
      <td>${esc(p.club || "—")}</td>
      <td>${esc(p.canton || "—")}</td>
      <td>${p.match_count || 0}</td>
      <td>${p.upset_count ? `<span class="prosp-upset">🔥 ${p.upset_count}</span>` : "—"}</td>
      <td><span class="prosp-badge s-${p.status}">${PROSP_STATUS[p.status] || p.status}</span></td>
    </tr>`;
  }).join("");
  tb.querySelectorAll(".prosp-row").forEach((r) => r.addEventListener("click", () => openProspect(r.dataset.id)));
}
function closeProspect() {
  $("prosp-detail").classList.add("hidden");
  $("prosp-list-wrap").classList.remove("hidden");
}
async function openProspect(id) {
  const p = prospList.find((x) => x.id === id); if (!p) return;
  const a = ageOf(p.birthdate);
  const chips = [
    a != null ? `${a} ans` : "", p.birthdate ? frDate(p.birthdate) : "", p.sex === "F" ? "fille" : p.sex === "M" ? "garçon" : "",
    p.club ? esc(p.club) : "", p.canton ? esc(p.canton) : "", p.distance_km != null ? `${p.distance_km} km de Lausanne` : "", "Lic. " + esc(p.license_no),
  ].filter(Boolean).map((c) => `<span class="prosp-chip">${c}</span>`).join("");
  const statusOpts = Object.entries(PROSP_STATUS).map(([v, l]) => `<option value="${v}"${p.status === v ? " selected" : ""}>${l}</option>`).join("");
  const d = $("prosp-detail");
  d.innerHTML = `
    <button type="button" id="prosp-back" class="ghost stg-back">← Retour aux prospects</button>
    <div class="prosp-dhead">
      <div>
        <h1 class="prosp-dname">${esc(p.first_name || "")} ${esc(p.last_name || "")}</h1>
        <div class="prosp-chips">${chips}</div>
      </div>
      <span class="prosp-cls-badge">${esc(p.classification || "—")}${p.ranking_position ? `<small>n°${p.ranking_position}</small>` : ""}</span>
    </div>
    <div class="prosp-statrow">
      <div class="prosp-stat"><b>${a != null ? a : "—"}</b><span>ans</span></div>
      <div class="prosp-stat"><b>${p.match_count || 0}</b><span>matchs récents</span></div>
      <div class="prosp-stat ${p.upset_count ? "up" : ""}"><b>${p.upset_count || 0}</b><span>exploits</span></div>
    </div>
    <div class="prosp-cols">
      <div class="prosp-card">
        <label class="prosp-lbl">Statut
          <select id="prosp-status">${statusOpts}</select></label>
        <label class="prosp-lbl">Notes / interactions
          <textarea id="prosp-notes" rows="7" placeholder="Historique des échanges, remarques…">${esc(p.notes || "")}</textarea></label>
        <div style="display:flex;align-items:center;gap:12px">
          <button type="button" id="prosp-save">Enregistrer</button>
          <span id="prosp-saved" class="muted" style="font-size:.85rem" hidden>Enregistré ✓</span>
        </div>
        <div class="prosp-contact-box">
          <h4>Coordonnées</h4>
          ${(p.email || p.phone || p.address) ? `
            ${p.email ? `<div>📧 <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></div>` : ""}
            ${p.phone ? `<div>📞 <a href="tel:${esc((p.phone || "").replace(/\\s/g, ""))}">${esc(p.phone)}</a></div>` : ""}
            ${(p.address || p.city) ? `<div>📍 ${esc([p.address, [p.postal_code, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", "))}</div>` : ""}
          ` : `<div class="muted" style="font-size:.85rem">Non récupérées.</div>`}
          <button type="button" id="prosp-portal" class="ghost" style="margin-top:8px">Ouvrir la fiche licence ↗</button>
          <span class="muted" style="font-size:.8rem;display:block;margin-top:4px">Puis clique le favori « Coordonnées » sur la page qui s'ouvre.</span>
        </div>
      </div>
      <div class="prosp-card">
        <h3 style="margin-top:0">Matchs récents</h3>
        <div id="prosp-matches"><p class="muted" style="font-size:.85rem">Chargement…</p></div>
      </div>
    </div>`;
  $("prosp-list-wrap").classList.add("hidden");
  d.classList.remove("hidden");
  window.scrollTo(0, 0);
  $("prosp-back").addEventListener("click", closeProspect);
  $("prosp-save").addEventListener("click", () => saveProspect(p.id));
  $("prosp-portal").addEventListener("click", () => {
    window.open("https://licence.mytennis.ch/fr/licences/" + encodeURIComponent(p.license_no), "_blank", "noopener");
  });
  const { data } = await sb.from("prospect_matches").select("*").eq("prospect_license", p.license_no).order("match_date", { ascending: false, nullsFirst: false });
  const ms = data || [];
  $("prosp-matches").innerHTML = ms.length
    ? `<div class="table-wrap"><table class="crm-table"><thead><tr><th>Date</th><th>Tournoi</th><th>Adversaire</th><th>Score</th><th>Rés.</th></tr></thead><tbody>`
      + ms.map((m) => `<tr class="${m.is_upset ? "prosp-upset-row" : ""}"><td>${m.match_date ? frDate(m.match_date) : "—"}</td><td>${esc(m.tournament_name || "—")}</td><td>${esc(((m.opponent_first || "") + " " + (m.opponent_last || "")).trim() || "—")}${m.opponent_classification ? " (" + esc(m.opponent_classification) + ")" : ""}</td><td>${esc(m.score || "—")}</td><td>${m.won === true ? (m.is_upset ? '<span class="pm-w">V 🔥</span>' : '<span class="pm-w">V</span>') : m.won === false ? '<span class="pm-l">D</span>' : "—"}</td></tr>`).join("")
      + `</tbody></table></div>`
    : `<p class="muted" style="font-size:.85rem">Aucun match récent. Lance « Scanner les résultats ».</p>`;
}
async function saveProspect(id) {
  const { error } = await sb.from("prospects").update({ status: $("prosp-status").value, notes: $("prosp-notes").value.trim() || null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) { alert("Erreur : " + error.message); return; }
  const p = prospList.find((x) => x.id === id);
  if (p) { p.status = $("prosp-status").value; p.notes = $("prosp-notes").value.trim() || null; }
  const sv = $("prosp-saved"); if (sv) { sv.hidden = false; setTimeout(() => { if ($("prosp-saved")) $("prosp-saved").hidden = true; }, 1600); }
}
async function loadProspBookmarklet() {
  const { data } = await sb.from("gz_config").select("import_key").maybeSingle();
  if (!data) { $("prosp-bm-note").textContent = "Clé d'import indisponible (droits admin requis)."; return; }
  let src;
  try { src = await (await fetch("prosp-bookmarklet.js")).text(); }
  catch (_e) { $("prosp-bm-note").textContent = "Impossible de charger le bookmarklet."; return; }
  const code = src.replace("__KEY__", data.import_key).replace("__RCV__", location.origin + "/prosp-receiver.html");
  const aEl = document.createElement("a");
  aEl.href = "javascript:" + encodeURIComponent(code);
  aEl.textContent = "Importer classements";
  aEl.className = "btn-prod"; aEl.style.textDecoration = "none";
  aEl.addEventListener("click", (e) => { e.preventDefault(); alert("Ne cliquez pas ici : GLISSEZ ce bouton dans vos favoris, puis utilisez-le sur la page Classements de mytennis (connecté)."); });
  $("prosp-bm-holder").innerHTML = ""; $("prosp-bm-holder").appendChild(aEl);
  $("prosp-bm-note").textContent = "Astuce : glissez-le dans la barre de favoris.";
}

// ===================================================================
//  Heures (décomptes coachs & profs)
// ===================================================================
let heuresData = { coaches: [], profs: [] }, heuresYm = null, heuresInit = false;
const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function fillHeuresMonths() {
  const sel = $("heures-month"); if (!sel || sel.options.length) return;
  const d = new Date(); d.setDate(1);
  let html = "";
  for (let i = 0; i < 18; i++) {   // 18 derniers mois, du plus récent au plus ancien
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const lbl = `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
    html += `<option value="${ym}">${lbl.charAt(0).toUpperCase() + lbl.slice(1)}</option>`;
    d.setMonth(d.getMonth() - 1);
  }
  sel.innerHTML = html;
  sel.value = ymNow();             // forcer la valeur (pretty-select)
}
function initHeures() {
  if (heuresInit) return; heuresInit = true;
  fillHeuresMonths();
  $("heures-month").addEventListener("change", loadHeures);
  $("heures-export").addEventListener("click", exportHeures);
}
async function loadHeures() {
  initHeures();
  heuresYm = $("heures-month").value || ymNow();
  await renderMyHours();
  const isManager = hasAny(myAppRoles, ["superadmin", "admin", "secretaire", "head_coach"]);
  $("heures-recap").classList.toggle("hidden", !isManager);
  $("heures-export").classList.toggle("hidden", !isManager);
  if (isManager) {
    const { data, error } = await sb.rpc("staff_hours_month", { p_ym: heuresYm });
    heuresData = error ? { coaches: [], profs: [] } : (data || { coaches: [], profs: [] });
    renderHeures();
  }
}
async function renderMyHours() {
  const host = $("heures-mine"); if (!host) return;
  const { data } = await sb.rpc("my_hours_month", { p_ym: heuresYm });
  const m = data || {};
  const hasCoach = (m.coach_total || 0) > 0, hasProf = (m.prof_total || 0) > 0;
  if (!hasCoach && !hasProf) { host.innerHTML = ""; return; }
  let inner = "";
  if (hasCoach) {
    const done = m.coach_total > 0 && m.coach_val === m.coach_total;
    inner += `<div class="he-mine-row">
      <span>Cours (coach) : <b>${m.coach_hours} h</b> <span class="muted">(${m.coach_val}/${m.coach_total} cours validés)</span></span>
      <span class="he-mine-act ${done ? "he-val" : "muted"}" style="font-size:.85rem">${done ? "✓ tout validé" : "Valide chaque cours en saisissant les présences"}</span>
    </div>`;
  }
  if (hasProf) {
    const done = m.prof_total > 0 && m.prof_val === m.prof_total;
    inner += `<div class="he-mine-row">
      <span>Études (prof) : <b>${m.prof_hours} h</b> <span class="muted">(${m.prof_val}/${m.prof_total} après-midis validés)</span></span>
      <span class="he-mine-act ${done ? "he-val" : "muted"}" style="font-size:.85rem">${done ? "✓ tout validé" : "Valide chaque après-midi dans Études"}</span>
    </div>`;
  }
  host.innerHTML = `<div class="he-mine"><div class="he-mine-h">Mes heures — ${heuresYm}</div>${inner}</div>`;
}
async function toggleMyValidation(kind, hours, isValidated) {
  if (!myPersonId) { alert("Ton compte n'est pas relié à une fiche."); return; }
  if (isValidated) await sb.from("staff_month_validation").delete().eq("person_id", myPersonId).eq("ym", heuresYm).eq("kind", kind);
  else await sb.from("staff_month_validation").upsert({ person_id: myPersonId, ym: heuresYm, kind, hours, validated_at: new Date().toISOString() }, { onConflict: "person_id,ym,kind" });
  loadHeures();
}
function renderHeures() {
  const c = heuresData.coaches || [], p = heuresData.profs || [];
  $("heures-coaches-empty").hidden = c.length > 0;
  $("heures-profs-empty").hidden = p.length > 0;
  $("heures-coaches").innerHTML = c.map((x) => {
    const amount = x.rate != null ? Math.round(x.hours * Number(x.rate) * 100) / 100 : null;
    const allVal = x.total_courses > 0 && x.courses === x.total_courses;
    return `<tr>
      <td><b>${esc(x.name)}</b></td><td>${x.total_courses}</td><td>${x.hours} h</td>
      <td>${x.rate != null ? x.rate + ".–" : '<span class="muted">—</span>'}</td>
      <td>${amount != null ? amount + " CHF" : "—"}</td>
      <td style="font-size:.8rem">${x.iban ? esc(x.iban) : '<span class="muted">—</span>'}</td>
      <td>${allVal ? '<span class="he-val">✓ ' + x.courses + "/" + x.total_courses + "</span>" : '<span class="muted">' + x.courses + "/" + x.total_courses + "</span>"}</td>
      <td class="he-acts"><button class="ghost he-detail" data-id="${x.person_id}" data-name="${esc(x.name)}">Détail</button></td></tr>`;
  }).join("");
  $("heures-profs").innerHTML = p.map((x) => {
    const allVal = x.total_days > 0 && x.days === x.total_days;
    return `<tr>
      <td><b>${esc(x.name)}</b></td><td>${x.total_days}</td><td>${x.hours} h</td>
      <td style="font-size:.8rem">${x.iban ? esc(x.iban) : '<span class="muted">—</span>'}</td>
      <td>${allVal ? '<span class="he-val">✓ ' + x.days + "/" + x.total_days + "</span>" : '<span class="muted">' + x.days + "/" + x.total_days + "</span>"}</td>
      <td></td></tr>`;
  }).join("");
  document.querySelectorAll("#heures-coaches .he-detail").forEach((b) => b.addEventListener("click", () => coachDetail(b.dataset.id, b.dataset.name)));
}
async function toggleValidation(personId, kind, hours) {
  const arr = kind === "coach" ? heuresData.coaches : heuresData.profs;
  const cur = arr.find((x) => x.person_id === personId)?.validated;
  if (cur) await sb.from("staff_month_validation").delete().eq("person_id", personId).eq("ym", heuresYm).eq("kind", kind);
  else await sb.from("staff_month_validation").upsert({ person_id: personId, ym: heuresYm, kind, hours, validated_at: new Date().toISOString() }, { onConflict: "person_id,ym,kind" });
  loadHeures();
}
async function coachDetail(personId, name) {
  const { data } = await sb.rpc("coach_hours_detail", { p_person: personId, p_ym: heuresYm });
  const rows = data || [];
  const tot = Math.round(rows.filter((r) => r.validated).reduce((a, r) => a + Number(r.hours), 0) * 100) / 100;
  const html = `<h2>Décompte d'heures — ${esc(name)}</h2><p>Mois : ${heuresYm}</p>
    <table><thead><tr><th>Date</th><th>Horaire</th><th>Cours</th><th>Heures</th><th>Validé</th></tr></thead><tbody>
    ${rows.map((r) => `<tr${r.validated ? "" : ' style="color:#999"'}><td>${frDate(r.date)}</td><td>${r.start}–${r.end}</td><td>${esc(r.title || "")}</td><td>${r.hours} h</td><td>${r.validated ? "✓" : "—"}</td></tr>`).join("")}
    </tbody><tfoot><tr><td colspan="3"><b>Total validé</b></td><td colspan="2"><b>${tot} h</b></td></tr></tfoot></table>
    <p style="font-size:12px;color:#666">Seules les heures des cours validés par le coach sont comptées.</p>`;
  const w = window.open("", "_blank", "width=700,height=820");
  if (!w) { alert("Autorise les pop-ups pour imprimer le décompte."); return; }
  w.document.write(`<html><head><title>Décompte ${esc(name)} ${heuresYm}</title><style>body{font-family:system-ui,sans-serif;padding:28px;color:#111}h2{margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:14px}tfoot td{border-top:2px solid #333}button{margin-top:16px;padding:8px 16px}</style></head><body>${html}<button onclick="window.print()">Imprimer</button></body></html>`);
  w.document.close();
}
function exportHeures() {
  const c = heuresData.coaches || [], p = heuresData.profs || [];
  const lines = [["Type", "Nom", "Cours/AM", "Heures", "Tarif", "Montant", "IBAN", "Valide"]];
  for (const x of c) { const amt = x.rate != null ? Math.round(x.hours * Number(x.rate) * 100) / 100 : ""; lines.push(["Coach", x.name, x.courses, x.hours, x.rate ?? "", amt, x.iban ?? "", x.validated ? "oui" : "non"]); }
  for (const x of p) lines.push(["Prof", x.name, x.days, x.hours, "", "", x.iban ?? "", x.validated ? "oui" : "non"]);
  const csv = lines.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `heures-${heuresYm}.csv`; a.click();
}

// ===================================================================
//  Serrures connectées
// ===================================================================
const LOCK_STATE = { locked: ["🔒 Fermée", "lk-locked"], unlocked: ["🔓 Ouverte", "lk-unlocked"], unknown: ["❔ Inconnu", "lk-unknown"] };
const LOCK_ACT = { open: "Ouverture", close: "Fermeture", code_created: "Code créé", code_used: "Code utilisé", state: "État" };
let locksList = [], lockCourts = [], locksInit = false, lkcCurrent = null;
function initLocks() {
  if (locksInit) return; locksInit = true;
  $("lock-add").addEventListener("click", () => openLock(null));
  $("lock-close").addEventListener("click", () => $("lock-modal").classList.add("hidden"));
  $("lock-form").addEventListener("submit", saveLock);
  $("lk-delete").addEventListener("click", deleteLock);
  $("lkc-close").addEventListener("click", () => $("lockcode-modal").classList.add("hidden"));
  $("lkc-add").addEventListener("click", addLockCode);
}
async function loadLocks() {
  initLocks();
  const [locks, courts] = await Promise.all([
    sb.from("locks").select("*").order("sort_order", { nullsFirst: false }).order("name").then((r) => r.data || []),
    sb.from("courts").select("id,name").order("id").then((r) => r.data || []),
  ]);
  locksList = locks; lockCourts = courts;
  renderLocks();
  loadLockJournal();
}
function renderLocks() {
  const host = $("locks-list");
  if (!locksList.length) { host.innerHTML = `<p class="muted">Aucune serrure. Cliquez « + Ajouter une serrure ».</p>`; return; }
  host.innerHTML = locksList.map((l) => {
    const [lbl, cls] = LOCK_STATE[l.state] || LOCK_STATE.unknown;
    return `<div class="lock-card">
      <div class="lock-info">
        <b>${esc(l.name)}</b>${l.location ? ` <span class="muted">· ${esc(l.location)}</span>` : ""}
        <span class="lock-state ${cls}">${lbl}</span>
        <span class="role-badge">${l.provider === "mock" ? "démo" : esc(l.provider)}</span>
        ${!l.is_active ? '<span class="muted">(inactive)</span>' : ""}
      </div>
      <div class="lock-acts">
        <button class="lk-open" data-id="${l.id}">Ouvrir</button>
        <button class="ghost lk-cls" data-id="${l.id}">Fermer</button>
        <button class="ghost lk-codes" data-id="${l.id}" data-name="${esc(l.name)}">Codes</button>
        <button class="ghost lk-edit" data-id="${l.id}">✎</button>
      </div></div>`;
  }).join("");
  host.querySelectorAll(".lk-open").forEach((b) => b.addEventListener("click", () => lockAction(b.dataset.id, "open")));
  host.querySelectorAll(".lk-cls").forEach((b) => b.addEventListener("click", () => lockAction(b.dataset.id, "close")));
  host.querySelectorAll(".lk-codes").forEach((b) => b.addEventListener("click", () => openLockCodes(b.dataset.id, b.dataset.name)));
  host.querySelectorAll(".lk-edit").forEach((b) => b.addEventListener("click", () => openLock(locksList.find((x) => x.id === b.dataset.id))));
}
async function lockAction(lockId, action) {
  if (!await uiConfirm(action === "open" ? "Ouvrir cette serrure ?" : "Fermer cette serrure ?")) return;
  const { data, error } = await sb.functions.invoke("lock-control", { body: { lock_id: lockId, action } });
  if (error || data?.error) { alert("Échec : " + (data?.error || error?.message)); loadLocks(); return; }
  if (!data.ok) alert("Non effectué : " + (data.detail || "fournisseur non configuré"));
  loadLocks();
}
function openLock(l) {
  $("lk-error").hidden = true;
  $("lock-modal-title").textContent = l ? "Modifier la serrure" : "Nouvelle serrure";
  $("lk-id").value = l?.id || "";
  $("lk-name").value = l?.name || "";
  $("lk-location").value = l?.location || "";
  $("lk-court").innerHTML = `<option value="">—</option>` + lockCourts.map((c) => `<option value="${c.id}"${l && l.court_id === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("");
  $("lk-provider").value = l?.provider || "mock";
  $("lk-external").value = l?.external_id || "";
  $("lk-active").checked = l ? l.is_active : true;
  $("lk-delete").classList.toggle("hidden", !l);
  $("lock-modal").classList.remove("hidden");
}
async function saveLock(e) {
  e.preventDefault();
  const err = $("lk-error"); err.hidden = true;
  const name = $("lk-name").value.trim();
  if (!name) { err.textContent = "Nom requis."; err.hidden = false; return; }
  const row = { name, location: $("lk-location").value.trim() || null, court_id: $("lk-court").value ? Number($("lk-court").value) : null, provider: $("lk-provider").value, external_id: $("lk-external").value.trim() || null, is_active: $("lk-active").checked };
  const id = $("lk-id").value;
  const res = id ? await sb.from("locks").update(row).eq("id", id) : await sb.from("locks").insert(row);
  if (res.error) { err.textContent = "Erreur : " + res.error.message; err.hidden = false; return; }
  $("lock-modal").classList.add("hidden");
  loadLocks();
}
async function deleteLock() {
  const id = $("lk-id").value;
  if (!id || !await uiConfirm("Supprimer cette serrure ?")) return;
  await sb.from("locks").delete().eq("id", id);
  $("lock-modal").classList.add("hidden");
  loadLocks();
}
async function openLockCodes(lockId, name) {
  lkcCurrent = lockId;
  $("lkc-title").textContent = "Codes — " + name;
  $("lkc-label").value = ""; $("lkc-from").value = ""; $("lkc-to").value = "";
  await renderLockCodes();
  $("lockcode-modal").classList.remove("hidden");
}
async function renderLockCodes() {
  const { data } = await sb.from("lock_codes").select("*").eq("lock_id", lkcCurrent).order("created_at", { ascending: false });
  const rows = data || [];
  $("lkc-list").innerHTML = rows.length ? rows.map((c) => {
    const inactive = !c.active || (c.valid_to && new Date(c.valid_to) < new Date());
    return `<div class="coach-rate-row">
      <span><b class="lkc-code">${esc(c.code || "—")}</b>${c.label ? " · " + esc(c.label) : ""} <span class="muted" style="font-size:.8rem">${c.valid_from ? frDateTime(c.valid_from) : ""}${c.valid_to ? " → " + frDateTime(c.valid_to) : ""}</span> ${inactive ? '<span class="muted">(inactif)</span>' : '<span class="he-val">actif</span>'}</span>
      ${c.active ? `<button class="ghost lkc-del" data-id="${c.id}">Révoquer</button>` : ""}</div>`;
  }).join("") : `<p class="muted" style="font-size:.85rem">Aucun code émis.</p>`;
  $("lkc-list").querySelectorAll(".lkc-del").forEach((b) => b.addEventListener("click", async () => { await sb.from("lock_codes").update({ active: false }).eq("id", b.dataset.id); renderLockCodes(); }));
}
async function addLockCode() {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const row = { lock_id: lkcCurrent, code, label: $("lkc-label").value.trim() || null, valid_from: $("lkc-from").value ? new Date($("lkc-from").value).toISOString() : null, valid_to: $("lkc-to").value ? new Date($("lkc-to").value).toISOString() : null, active: true, created_by: meId };
  const { error } = await sb.from("lock_codes").insert(row);
  if (error) { alert("Erreur : " + error.message); return; }
  await sb.from("lock_events").insert({ lock_id: lkcCurrent, action: "code_created", result: "ok", by_name: meName, detail: "Code " + code });
  $("lkc-label").value = ""; $("lkc-from").value = ""; $("lkc-to").value = "";
  renderLockCodes();
}
async function loadLockJournal() {
  const { data } = await sb.from("lock_events").select("*").order("created_at", { ascending: false }).limit(40);
  const rows = data || [];
  const nameOfLock = (id) => locksList.find((l) => l.id === id)?.name || "—";
  $("locks-journal").innerHTML = rows.length
    ? `<div class="table-wrap"><table class="crm-table"><thead><tr><th>Quand</th><th>Serrure</th><th>Action</th><th>Par</th><th></th></tr></thead><tbody>`
      + rows.map((e) => `<tr><td>${frDateTime(e.created_at)}</td><td>${esc(nameOfLock(e.lock_id))}</td><td>${LOCK_ACT[e.action] || esc(e.action)}</td><td>${esc(e.by_name || "—")}</td><td>${e.result === "ok" ? '<span class="he-val">✓</span>' : '<span class="pm-l">' + esc(e.result || "?") + "</span>"}${e.detail ? ' <span class="muted" style="font-size:.8rem">' + esc(e.detail) + "</span>" : ""}</td></tr>`).join("")
      + `</tbody></table></div>`
    : `<p class="muted" style="font-size:.85rem">Aucun événement.</p>`;
}

// ===================================================================
//  Arrosage connecté
// ===================================================================
const IRR_STATE = { on: ["💧 En cours", "irr-on"], off: ["Éteint", "irr-off"] };
const IRR_ACT = { start: "Arrosage", stop: "Arrêt", auto: "Auto", skipped: "Ignoré", scheduled: "Programmé" };
const DAYS_LBL = { daily: "Tous les jours", "1,2,3,4,5": "Lun–Ven", "6,7": "Week-end", "1": "Lundi", "2": "Mardi", "3": "Mercredi", "4": "Jeudi", "5": "Vendredi", "6": "Samedi", "7": "Dimanche" };
let irrList = [], irrCourts = [], irrInit = false, iscCurrent = null;
function initIrrigation() {
  if (irrInit) return; irrInit = true;
  $("irr-add").addEventListener("click", () => openZone(null));
  $("irr-close").addEventListener("click", () => $("irr-modal").classList.add("hidden"));
  $("irr-form").addEventListener("submit", saveZone);
  $("iz-delete").addEventListener("click", deleteZone);
  $("isc-close").addEventListener("click", () => $("irrsched-modal").classList.add("hidden"));
  $("isc-add").addEventListener("click", addSchedule);
}
async function loadIrrigation() {
  initIrrigation();
  const [zones, courts] = await Promise.all([
    sb.from("irrigation_zones").select("*").order("sort_order", { nullsFirst: false }).order("name").then((r) => r.data || []),
    sb.from("courts").select("id,name").order("id").then((r) => r.data || []),
  ]);
  irrList = zones; irrCourts = courts;
  renderZones();
  loadIrrJournal();
}
function renderZones() {
  const host = $("irr-list");
  if (!irrList.length) { host.innerHTML = `<p class="muted">Aucune zone. Cliquez « + Ajouter une zone ».</p>`; return; }
  host.innerHTML = irrList.map((z) => {
    const [lbl, cls] = IRR_STATE[z.state] || IRR_STATE.off;
    return `<div class="lock-card">
      <div class="lock-info">
        <b>${esc(z.name)}</b>
        <span class="lock-state ${cls}">${lbl}</span>
        ${z.moisture != null ? `<span class="role-badge">💦 ${z.moisture}%</span>` : ""}
        ${z.auto_enabled ? '<span class="he-val" style="font-size:.75rem">auto</span>' : ""}
        <span class="role-badge">${z.provider === "mock" ? "démo" : esc(z.provider)}</span>
        ${!z.is_active ? '<span class="muted">(inactive)</span>' : ""}
      </div>
      <div class="lock-acts">
        <button class="iz-start" data-id="${z.id}">Arroser</button>
        <button class="ghost iz-stop" data-id="${z.id}">Arrêter</button>
        <button class="ghost iz-sched" data-id="${z.id}" data-name="${esc(z.name)}">Programmer</button>
        <button class="ghost iz-edit" data-id="${z.id}">✎</button>
      </div></div>`;
  }).join("");
  host.querySelectorAll(".iz-start").forEach((b) => b.addEventListener("click", () => zoneAction(b.dataset.id, "start")));
  host.querySelectorAll(".iz-stop").forEach((b) => b.addEventListener("click", () => zoneAction(b.dataset.id, "stop")));
  host.querySelectorAll(".iz-sched").forEach((b) => b.addEventListener("click", () => openSchedules(b.dataset.id, b.dataset.name)));
  host.querySelectorAll(".iz-edit").forEach((b) => b.addEventListener("click", () => openZone(irrList.find((x) => x.id === b.dataset.id))));
}
async function zoneAction(zoneId, action) {
  const z = irrList.find((x) => x.id === zoneId);
  const dur = z?.default_duration_min || 10;
  if (action === "start" && !await uiConfirm(`Arroser « ${z?.name} » pendant ${dur} min ?`)) return;
  if (action === "stop" && !await uiConfirm("Arrêter l'arrosage ?")) return;
  const body = { zone_id: zoneId, action };
  if (action === "start") body.duration_min = dur;
  const { data, error } = await sb.functions.invoke("irrigation-control", { body });
  if (error || data?.error) { alert("Échec : " + (data?.error || error?.message)); loadIrrigation(); return; }
  if (!data.ok) alert(data.detail || "Non effectué.");
  loadIrrigation();
}
function openZone(z) {
  $("iz-error").hidden = true;
  $("irr-modal-title").textContent = z ? "Modifier la zone" : "Nouvelle zone";
  $("iz-id").value = z?.id || "";
  $("iz-name").value = z?.name || "";
  $("iz-court").innerHTML = `<option value="">—</option>` + irrCourts.map((c) => `<option value="${c.id}"${z && z.court_id === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("");
  $("iz-threshold").value = z?.moisture_threshold ?? 40;
  $("iz-duration").value = z?.default_duration_min ?? 10;
  $("iz-provider").value = z?.provider || "mock";
  $("iz-external").value = z?.external_id || "";
  $("iz-auto").checked = !!z?.auto_enabled;
  $("iz-active").checked = z ? z.is_active : true;
  $("iz-delete").classList.toggle("hidden", !z);
  $("irr-modal").classList.remove("hidden");
}
async function saveZone(e) {
  e.preventDefault();
  const err = $("iz-error"); err.hidden = true;
  const name = $("iz-name").value.trim();
  if (!name) { err.textContent = "Nom requis."; err.hidden = false; return; }
  const row = { name, court_id: $("iz-court").value ? Number($("iz-court").value) : null, provider: $("iz-provider").value, external_id: $("iz-external").value.trim() || null, moisture_threshold: $("iz-threshold").value ? Number($("iz-threshold").value) : null, default_duration_min: $("iz-duration").value ? Number($("iz-duration").value) : 10, auto_enabled: $("iz-auto").checked, is_active: $("iz-active").checked };
  const id = $("iz-id").value;
  const res = id ? await sb.from("irrigation_zones").update(row).eq("id", id) : await sb.from("irrigation_zones").insert(row);
  if (res.error) { err.textContent = "Erreur : " + res.error.message; err.hidden = false; return; }
  $("irr-modal").classList.add("hidden");
  loadIrrigation();
}
async function deleteZone() {
  const id = $("iz-id").value;
  if (!id || !await uiConfirm("Supprimer cette zone ?")) return;
  await sb.from("irrigation_zones").delete().eq("id", id);
  $("irr-modal").classList.add("hidden");
  loadIrrigation();
}
async function openSchedules(zoneId, name) {
  iscCurrent = zoneId;
  $("isc-title").textContent = "Programmations — " + name;
  $("isc-days").value = "daily"; $("isc-time").value = ""; $("isc-dur").value = "";
  await renderSchedules();
  $("irrsched-modal").classList.remove("hidden");
}
async function renderSchedules() {
  const { data } = await sb.from("watering_schedules").select("*").eq("zone_id", iscCurrent).order("time_of_day");
  const rows = data || [];
  $("isc-list").innerHTML = rows.length ? rows.map((s) => `<div class="coach-rate-row">
    <span><b>${DAYS_LBL[s.days] || esc(s.days || "")}</b> à ${s.time_of_day ? s.time_of_day.slice(0, 5) : "—"} · ${s.duration_min} min ${s.active ? "" : '<span class="muted">(inactif)</span>'}</span>
    <button class="ghost isc-del" data-id="${s.id}">Suppr.</button></div>`).join("") : `<p class="muted" style="font-size:.85rem">Aucune programmation.</p>`;
  $("isc-list").querySelectorAll(".isc-del").forEach((b) => b.addEventListener("click", async () => { await sb.from("watering_schedules").delete().eq("id", b.dataset.id); renderSchedules(); }));
}
async function addSchedule() {
  if (!$("isc-time").value) { alert("Choisis une heure."); return; }
  const { error } = await sb.from("watering_schedules").insert({ zone_id: iscCurrent, days: $("isc-days").value, time_of_day: $("isc-time").value, duration_min: $("isc-dur").value ? Number($("isc-dur").value) : 10, active: true });
  if (error) { alert("Erreur : " + error.message); return; }
  $("isc-time").value = ""; $("isc-dur").value = "";
  renderSchedules();
}
async function loadIrrJournal() {
  const { data } = await sb.from("watering_events").select("*").order("created_at", { ascending: false }).limit(40);
  const rows = data || [];
  const nameOf = (id) => irrList.find((z) => z.id === id)?.name || "—";
  $("irr-journal").innerHTML = rows.length
    ? `<div class="table-wrap"><table class="crm-table"><thead><tr><th>Quand</th><th>Zone</th><th>Action</th><th>Durée</th><th>Par</th><th></th></tr></thead><tbody>`
      + rows.map((e) => `<tr><td>${frDateTime(e.created_at)}</td><td>${esc(nameOf(e.zone_id))}</td><td>${IRR_ACT[e.action] || esc(e.action)}</td><td>${e.duration_min ? e.duration_min + " min" : "—"}</td><td>${esc(e.by_name || "—")}</td><td>${e.result === "ok" ? '<span class="he-val">✓</span>' : e.result === "skipped" ? '<span class="muted">ignoré</span>' : '<span class="pm-l">' + esc(e.result || "?") + "</span>"}${e.detail ? ' <span class="muted" style="font-size:.8rem">' + esc(e.detail) + "</span>" : ""}</td></tr>`).join("")
      + `</tbody></table></div>`
    : `<p class="muted" style="font-size:.85rem">Aucun événement.</p>`;
}

// ===================================================================
//  Stages
// ===================================================================
let stgCats = [], stgSessions = [], stgCounts = {}, stgCurrent = null, stgRegs = [], stgSessionCats = {}, stgStaff = [];
const stgActiveCats = () => stgCats.filter((c) => c.active);

const stgDays = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
const stgEffPrice = (price, days) => Math.round(Number(price) * Math.min(days, 5) / 5 * 100) / 100;
const stgCatById = (id) => stgCats.find((c) => c.id === id) || {};

function initStages() {
  document.querySelectorAll("#view-stages .stg-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-stages .stg-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-stages .stg-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "stg-sub-" + b.dataset.sub));
      if (b.dataset.sub === "stages" || b.dataset.sub === "categories") loadStagesTab();
      if (b.dataset.sub === "mails") loadStageMails();
      if (b.dataset.sub === "questionnaires") loadSurveyTab("stage");
    }));
  $("stg-cat-new").addEventListener("click", createStageCat);
  $("stg-new").addEventListener("click", () => openStageModal(null));
  $("stg-detail-back").addEventListener("click", closeStageDetail);
  $("stg-detail-edit").addEventListener("click", () => openStageModal(stgCurrent));
  $("stg-reg-add").addEventListener("click", openRegModal);
  $("stg-survey-new").addEventListener("click", () => createSurvey("stage"));
  $("stg-mail-cat").addEventListener("change", () => renderStageMails($("stg-mail-cat").value));
  // Modal stage
  $("stage-close").addEventListener("click", () => $("stage-modal").classList.add("hidden"));
  $("stage-modal").addEventListener("click", (e) => { if (e.target === $("stage-modal")) $("stage-modal").classList.add("hidden"); });
  $("stage-form").addEventListener("submit", saveStage);
  $("stage-delete").addEventListener("click", deleteStage);
  $("stg-f-photo-btn").addEventListener("click", () => $("stg-f-photo-file").click());
  $("stg-f-photo-file").addEventListener("change", (e) => uploadStageImage(e.target));
  // Modal inscrit
  $("reg-close").addEventListener("click", () => $("reg-modal").classList.add("hidden"));
  $("reg-modal").addEventListener("click", (e) => { if (e.target === $("reg-modal")) $("reg-modal").classList.add("hidden"); });
  $("reg-form").addEventListener("submit", saveReg);
  $("stlink-close").addEventListener("click", () => $("stlink-modal").classList.add("hidden"));
  $("stlink-modal").addEventListener("click", (e) => { if (e.target === $("stlink-modal")) $("stlink-modal").classList.add("hidden"); });
  $("stlink-create").addEventListener("click", createPersonFromReg);
}

async function loadStagesTab() {
  const [{ data: cats }, { data: sessions }, { data: regs }, { data: links }] = await Promise.all([
    sb.from("stage_categories").select("*").order("sort_order"),
    sb.from("stage_sessions").select("*").order("start_date", { ascending: false }),
    sb.from("stage_registrations").select("stage_id"),
    sb.from("stage_session_categories").select("session_id,category_id"),
  ]);
  stgCats = cats || [];
  stgSessions = sessions || [];
  stgCounts = {};
  for (const r of regs || []) stgCounts[r.stage_id] = (stgCounts[r.stage_id] || 0) + 1;
  stgSessionCats = {};
  for (const l of links || []) (stgSessionCats[l.session_id] = stgSessionCats[l.session_id] || []).push(l.category_id);
  renderStageCats();
  renderStageList();
}

// ---- Catégories ----
function renderStageCats() {
  $("stg-cat-list").innerHTML = stgCats.map((c) => `
    <div class="stg-cat-card" data-id="${c.id}">
      <div class="gz-mail-head">
        <input type="text" class="stg-cat-name" value="${esc(c.name)}" style="font-weight:800;flex:1;margin-right:10px"/>
        <label class="gz-mail-en"><input type="checkbox" class="stg-cat-active" ${c.active ? "checked" : ""}/> Active</label>
      </div>
      <label class="gz-mail-lbl">Description</label>
      <textarea class="stg-cat-desc" rows="2" style="width:100%;box-sizing:border-box">${esc(c.description || "")}</textarea>
      <div class="stg-cat-grid">
        <label>Prix (CHF)<input type="number" class="stg-cat-price" value="${c.price}"/></label>
        <label class="stg-inline"><input type="checkbox" class="stg-cat-meal" ${c.meal ? "checked" : ""}/> Repas</label>
        <label class="stg-inline"><input type="checkbox" class="stg-cat-tshirt" ${c.tshirt ? "checked" : ""}/> Offrir un t-shirt</label>
        <label class="stg-inline"><input type="checkbox" class="stg-cat-ranking" ${c.ask_ranking ? "checked" : ""}/> Demander le classement</label>
        <label>Option 3h privé (+CHF)<input type="number" class="stg-cat-addon" style="width:120px" value="${c.private_addon_price ?? ""}" placeholder="—"/></label>
      </div>
      <div class="gz-mail-foot">
        <div class="gz-mail-img">
          ${c.image_url ? `<img src="${c.image_url}" class="gz-mail-thumb"/>` : ""}
          <button type="button" class="ghost stg-cat-imgbtn">${c.image_url ? "Changer la photo" : "Photo d'illustration"}</button>
          <input type="file" accept="image/*" class="stg-cat-file hidden"/>
        </div>
        <div style="display:flex;gap:8px">
          <button type="button" class="primary stg-cat-save">Enregistrer</button>
          <button type="button" class="fam-del stg-cat-del">Supprimer</button>
        </div>
      </div>
    </div>`).join("") || '<p class="muted">Aucune catégorie.</p>';
  $("stg-cat-list").querySelectorAll(".stg-cat-card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelector(".stg-cat-save").addEventListener("click", () => saveStageCat(id, card));
    card.querySelector(".stg-cat-del").addEventListener("click", () => delStageCat(id));
    const file = card.querySelector(".stg-cat-file");
    card.querySelector(".stg-cat-imgbtn").addEventListener("click", () => file.click());
    file.addEventListener("change", () => uploadCatImage(id, file));
  });
}

async function createStageCat() {
  const sort = (stgCats.at(-1)?.sort_order || stgCats.length) + 1;
  const { error } = await sb.from("stage_categories").insert({ name: "Nouvelle catégorie", sort_order: sort });
  if (error) return alert(error.message);
  await loadStagesTab();
  // ouvre l'édition inline de la nouvelle carte
  const last = $("stg-cat-list").querySelector(".stg-cat-card:last-child .stg-cat-name");
  if (last) { last.focus(); last.select(); }
}

async function saveStageCat(id, card) {
  const patch = {
    name: card.querySelector(".stg-cat-name").value.trim(),
    description: card.querySelector(".stg-cat-desc").value.trim() || null,
    price: Number(card.querySelector(".stg-cat-price").value) || 0,
    meal: card.querySelector(".stg-cat-meal").checked,
    tshirt: card.querySelector(".stg-cat-tshirt").checked,
    ask_ranking: card.querySelector(".stg-cat-ranking").checked,
    private_addon_price: card.querySelector(".stg-cat-addon").value ? Number(card.querySelector(".stg-cat-addon").value) : null,
    active: card.querySelector(".stg-cat-active").checked,
  };
  const btn = card.querySelector(".stg-cat-save");
  btn.textContent = "…";
  const { error } = await sb.from("stage_categories").update(patch).eq("id", id);
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  if (!error) Object.assign(stgCatById(id), patch);
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function delStageCat(id) {
  if (!await uiConfirm("Supprimer cette catégorie ? (impossible si des stages l'utilisent)")) return;
  const { error } = await sb.from("stage_categories").delete().eq("id", id);
  if (error) return alert("Suppression impossible : " + error.message);
  loadStagesTab();
}

async function uploadCatImage(id, file) {
  if (!file.files || !file.files[0]) return;
  const f = file.files[0];
  const path = `stages/cat-${id}-${Date.now()}`;
  const { error } = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (error) { alert("Photo : " + error.message); return; }
  const url = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  await sb.from("stage_categories").update({ image_url: url }).eq("id", id);
  stgCatById(id).image_url = url;
  renderStageCats();
}

// ---- Liste des stages ----
function stgVisLabel(s) {
  if (s.visibility_mode === "manual") return s.visible ? "Visible (manuel)" : "Masqué (manuel)";
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date(new Date(s.start_date) - 3 * 86400000).toISOString().slice(0, 10);
  return today <= limit ? "Visible (auto)" : "Masqué (auto, J-3)";
}

function stgCatBadges(sessionId) {
  const ids = stgSessionCats[sessionId] || [];
  if (!ids.length) return '<span class="muted">— aucune —</span>';
  return ids.map((id) => `<span class="role-badge">${esc(stgCatById(id).name || "?")}</span>`).join(" ");
}

function renderStageList() {
  $("stg-rows").innerHTML = stgSessions.map((s) => {
    const days = stgDays(s.start_date, s.end_date);
    const dates = s.start_date === s.end_date ? frDate(s.start_date) : `${frDate(s.start_date)} → ${frDate(s.end_date)}`;
    return `<tr class="stg-row" data-id="${s.id}">
      <td><b>${esc(s.title || "Stage")}</b></td>
      <td>${dates}</td>
      <td>${jours(days)}${days < 5 ? " <span class='muted'>(pro-rata)</span>" : ""}</td>
      <td class="role-cell">${stgCatBadges(s.id)}</td>
      <td>${stgCounts[s.id] || 0}</td>
      <td>
        <select class="stg-vis" data-id="${s.id}">
          <option value="auto"${s.visibility_mode === "auto" ? " selected" : ""}>Auto (J-3)</option>
          <option value="show"${s.visibility_mode === "manual" && s.visible ? " selected" : ""}>Visible</option>
          <option value="hide"${s.visibility_mode === "manual" && !s.visible ? " selected" : ""}>Masqué</option>
        </select>
        <div class="muted" style="font-size:.72rem">${stgVisLabel(s)}</div>
      </td>
    </tr>`;
  }).join("") || '<tr><td colspan="6" class="muted">Aucun stage.</td></tr>';
  $("stg-rows").querySelectorAll(".stg-row").forEach((tr) =>
    tr.addEventListener("click", (e) => { if (e.target.closest(".stg-vis")) return; openStage(tr.dataset.id); }));
  $("stg-rows").querySelectorAll(".stg-vis").forEach((sel) =>
    sel.addEventListener("change", () => setStageVisibility(sel.dataset.id, sel.value)));
}

async function setStageVisibility(id, val) {
  const patch = val === "auto" ? { visibility_mode: "auto" }
    : { visibility_mode: "manual", visible: val === "show" };
  await sb.from("stage_sessions").update(patch).eq("id", id);
  Object.assign(stgSessions.find((s) => s.id === id), patch);
  renderStageList();
}

// ---- Modal création / édition d'un stage (semaine) ----
let stageImageUrl = null;
function renderStageImage() {
  const box = $("stg-f-photo-preview");
  box.innerHTML = stageImageUrl ? `<img src="${stageImageUrl}" alt="" />` : "";
  box.classList.toggle("empty", !stageImageUrl);
}
async function uploadStageImage(input) {
  if (!input.files || !input.files[0]) return;
  const f = input.files[0];
  $("stg-f-photo-status").textContent = "Envoi…";
  const path = `stages/session-${Date.now()}`;
  const up = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (up.error) { $("stg-f-photo-status").textContent = "Erreur : " + up.error.message; return; }
  stageImageUrl = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  input.value = "";
  $("stg-f-photo-status").textContent = "";
  renderStageImage();
}
function openStageModal(id) {
  if (!stgActiveCats().length) return alert("Crée d'abord au moins une catégorie active (onglet Catégories).");
  $("stage-error").hidden = true;
  const s = id ? stgSessions.find((x) => x.id === id) : null;
  $("stg-f-id").value = id || "";
  $("stage-modal-title").textContent = s ? "Modifier le stage" : "Nouveau stage";
  $("stg-f-name").value = s?.title || "";
  $("stg-f-start").value = s?.start_date || "";
  $("stg-f-end").value = s?.end_date || "";
  stageImageUrl = s?.image_url || null;
  $("stg-f-photo-status").textContent = "";
  renderStageImage();
  $("stage-delete").classList.toggle("hidden", !s);
  const selected = new Set(id ? (stgSessionCats[id] || []) : []);
  $("stg-f-cats").innerHTML = stgActiveCats().map((c) =>
    `<label class="stg-cat-opt"><input type="checkbox" value="${c.id}"${selected.has(c.id) ? " checked" : ""}/>
      <span><b>${esc(c.name)}</b> <span class="muted">${c.price} CHF${c.meal ? " · repas" : ""}${c.tshirt ? " · t-shirt" : ""}</span></span></label>`).join("");
  $("stage-modal").classList.remove("hidden");
}

async function saveStage(e) {
  e.preventDefault();
  const err = $("stage-error"); err.hidden = true;
  const id = $("stg-f-id").value;
  const name = $("stg-f-name").value.trim();
  const start = $("stg-f-start").value, end = $("stg-f-end").value;
  if (!name || !start || !end) { err.textContent = "Nom et dates obligatoires."; err.hidden = false; return; }
  if (end < start) { err.textContent = "La date de fin précède le début."; err.hidden = false; return; }
  const catIds = [...$("stg-f-cats").querySelectorAll("input:checked")].map((c) => c.value);
  if (!catIds.length) { err.textContent = "Coche au moins une catégorie ouverte à l'inscription."; err.hidden = false; return; }
  let sid = id;
  const patch = { title: name, start_date: start, end_date: end, image_url: stageImageUrl };
  if (id) { const { error } = await sb.from("stage_sessions").update(patch).eq("id", id); if (error) { err.textContent = error.message; err.hidden = false; return; } }
  else {
    const res = await sb.from("stage_sessions").insert({ ...patch, visibility_mode: "auto" }).select("id").single();
    if (res.error) { err.textContent = res.error.message; err.hidden = false; return; }
    sid = res.data.id;
  }
  // remplace les catégories ouvertes
  await sb.from("stage_session_categories").delete().eq("session_id", sid);
  await sb.from("stage_session_categories").insert(catIds.map((cid) => ({ session_id: sid, category_id: cid })));
  $("stage-modal").classList.add("hidden");
  await loadStagesTab();
  if (id && stgCurrent === id) openStage(id); // rafraîchit le détail ouvert
}

async function deleteStage() {
  const id = $("stg-f-id").value;
  if (!id || !await uiConfirm("Supprimer ce stage et tous ses inscrits ?")) return;
  await sb.from("stage_registrations").delete().eq("stage_id", id);
  await sb.from("stage_session_categories").delete().eq("session_id", id);
  const { error } = await sb.from("stage_sessions").delete().eq("id", id);
  if (error) return alert(error.message);
  $("stage-modal").classList.add("hidden");
  closeStageDetail();
  loadStagesTab();
}

// ---- Détail d'un stage : inscrits + programme ----
async function openStage(id) {
  stgCurrent = id;
  const s = stgSessions.find((x) => x.id === id);
  const days = stgDays(s.start_date, s.end_date);
  const catList = (stgSessionCats[id] || []).map((cid) => {
    const c = stgCatById(cid);
    return `${esc(c.name || "?")} <span class="muted">(${stgEffPrice(c.price || 0, days)} CHF)</span>`;
  });
  $("stg-detail-title").textContent = (s.title || "Stage");
  $("stg-detail-meta").innerHTML = `${frDate(s.start_date)}${s.end_date !== s.start_date ? " → " + frDate(s.end_date) : ""} · ${jours(days)}${days < 5 ? " (pro-rata)" : ""}<br>`
    + `Catégories : ${catList.length ? catList.join(" · ") : '<span class="muted">aucune</span>'}`;
  $("stg-list-wrap").classList.add("hidden");
  $("stg-detail").classList.remove("hidden");
  await loadRegistrations();
}

function closeStageDetail() {
  stgCurrent = null;
  $("stg-detail").classList.add("hidden");
  $("stg-list-wrap").classList.remove("hidden");
}

async function loadRegistrations() {
  const [{ data: regs }, { data: staff }] = await Promise.all([
    sb.from("stage_registrations").select("*").eq("stage_id", stgCurrent).order("created_at"),
    sb.from("stage_staff").select("*").eq("session_id", stgCurrent).order("created_at"),
  ]);
  stgRegs = regs || [];
  stgStaff = staff || [];
  renderRegistrants();
}

const round2 = (n) => Math.round(n * 100) / 100;
function stgRegPrice(r, days) {
  const cat = stgCatById(r.category_id);
  const base = stgEffPrice(cat.price || 0, days);
  const discounted = base * (1 - (r.discount_pct || 0) / 100);
  const addon = r.private_addon ? Number(cat.private_addon_price || 0) : 0;
  return round2(discounted + addon);
}

function renderRegistrants() {
  const s = stgSessions.find((x) => x.id === stgCurrent);
  const days = stgDays(s.start_date, s.end_date);
  const openCats = (stgSessionCats[stgCurrent] || []).map((id) => stgCatById(id)).filter((c) => c.id);
  $("stg-reg-count").textContent = stgRegs.length;

  // --- Résumé financier ---
  const encaisse = stgRegs.filter((r) => r.paid).reduce((t, r) => t + stgRegPrice(r, days), 0);
  const mealRegs = stgRegs.filter((r) => stgCatById(r.category_id).meal).length; // journée / pro
  const repasCount = days * (stgStaff.length + mealRegs);
  const repasCost = repasCount * 15;
  const coachFees = stgStaff.reduce((t, x) => t + Number(x.fee || 0), 0);
  const solde = round2(encaisse - repasCost - coachFees);
  $("stg-finance").innerHTML = `
    <h3 style="margin:0 0 10px">Résumé financier</h3>
    <div class="stg-fin-grid">
      <div class="stg-fin"><span>Encaissé (payé)</span><b>${round2(encaisse)} CHF</b></div>
      <div class="stg-fin"><span>− Repas (${repasCount} × 15)</span><b>−${repasCost} CHF</b></div>
      <div class="stg-fin"><span>− Tarifs coachs</span><b>−${round2(coachFees)} CHF</b></div>
      <div class="stg-fin stg-fin-total"><span>Solde</span><b>${solde} CHF</b></div>
    </div>
    <p class="muted" style="font-size:.78rem;margin:8px 0 0">Repas = 15 CHF × ${jours(days)} × (${stgStaff.length} coach(s) + ${mealRegs} inscrit(s) journée/pro).</p>`;

  // --- Tuiles récap ---
  $("stg-cat-tiles").innerHTML = [`<div class="stg-tile"><b>${stgRegs.length}</b><span>participants</span></div>`]
    .concat(openCats.map((c) => `<div class="stg-tile"><b>${stgRegs.filter((r) => r.category_id === c.id).length}</b><span>${esc(c.name)}</span></div>`)).join("");

  // --- Une box par catégorie ---
  $("stg-boxes").innerHTML = openCats.map((c) => {
    const regs = stgRegs.filter((r) => r.category_id === c.id);
    const coaches = stgStaff.filter((x) => x.category_id === c.id);
    return `<div class="rg-card stg-box">
      <div class="stg-card-head"><h3 style="margin:0">${esc(c.name)} (${regs.length}) <span class="muted" style="font-weight:400">· ${stgEffPrice(c.price || 0, days)} CHF${c.meal ? " · repas" : ""}${c.tshirt ? " · t-shirt" : ""}</span></h3></div>
      <div class="table-wrap" style="margin-top:8px">
        <table class="crm-table"><thead><tr><th>Nom</th><th>Naissance</th><th>Mail</th>${c.tshirt ? "<th>T-shirt</th>" : ""}${c.meal ? "<th>Repas</th>" : ""}<th>Commentaire</th><th>Rabais</th><th>Prix</th><th>Facture</th><th>Payé</th><th></th></tr></thead>
        <tbody>${regs.length ? regs.map((r) => stgRegRow(r, c, days)).join("") : '<tr><td colspan="11" class="muted">Aucun inscrit.</td></tr>'}</tbody></table>
      </div>
      <div class="stg-coaches">
        <div class="stg-card-head"><h4 style="margin:10px 0 4px">Coachs</h4><button type="button" class="ghost stg-coach-add" data-cat="${c.id}">+ Ajouter un coach</button></div>
        <div class="stg-coach-rows">${coaches.map(stgCoachRow).join("") || '<p class="muted" style="font-size:.82rem;margin:0">Aucun coach.</p>'}</div>
      </div>
    </div>`;
  }).join("") || '<p class="muted">Aucune catégorie ouverte pour ce stage.</p>';

  wireStageDetail();
}

function stgRegRow(r, cat, days) {
  const price = stgRegPrice(r, days);
  const rebate = r.discount_pct ? `−${r.discount_pct}% <span class="muted">(${esc(r.discount_reason || "")})</span> <button class="fam-del stg-reb-del" data-id="${r.id}">✕</button>`
    : `<button class="ghost stg-reb-add" data-id="${r.id}">−20%</button>`;
  const invoice = r.invoice_created ? `<span class="muted">Facturé${r.invoice_sent_at ? " le " + frDate(r.invoice_sent_at) : ""}</span>`
    : `<button class="ghost stg-inv" data-id="${r.id}">Facture + mail</button>`;
  return `<tr data-id="${r.id}">
    <td><b>${esc(r.first_name)} ${esc(r.last_name)}</b> ${r.person_id ? '<span class="stg-linked" title="Lié à une fiche du répertoire">✓ fiche</span>' : `<button class="ghost stg-link" data-id="${r.id}">Lier</button>`}</td>
    <td>${r.birth_date ? frDate(r.birth_date) : "—"}</td>
    <td>${esc(r.email || "—")}</td>
    ${cat.tshirt ? `<td>${esc(r.tshirt_size || "—")}</td>` : ""}
    ${cat.meal ? `<td>${esc(r.meal_restriction || "—")}</td>` : ""}
    <td class="stg-cmt">${r.private_addon ? '<span class="stg-tag">+3h privé</span> ' : ""}${r.ranking ? `<b>Classement : ${esc(r.ranking)}</b>${r.comment ? "<br>" : ""}` : ""}${esc(r.comment || "")}</td>
    <td>${rebate}</td>
    <td><b>${price}</b></td>
    <td>${invoice}</td>
    <td><input type="checkbox" class="stg-paid" data-id="${r.id}" ${r.paid ? "checked" : ""}/></td>
    <td><button class="fam-del stg-reg-del" data-id="${r.id}">✕</button></td>
  </tr>`;
}
function stgCoachOptions(selectedId) {
  const coaches = people.filter((p) => hasRoleIn(p.id, COACH_ROLES)).sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
  return '<option value="">— choisir un coach —</option>' + coaches.map((p) => `<option value="${p.id}"${p.id === selectedId ? " selected" : ""}>${esc(p.last_name)} ${esc(p.first_name)}</option>`).join("");
}
function stgCoachRow(x) {
  return `<div class="stg-coach-row" data-id="${x.id}">
    <select class="stg-coach-sel">${stgCoachOptions(x.coach_person_id)}</select>
    <input type="number" class="stg-coach-fee" placeholder="Tarif total (CHF)" value="${x.fee ?? ""}" />
    <input class="stg-coach-note" placeholder="Note (ex. lun–jeu seulement)" value="${esc(x.note || "")}" />
    <button type="button" class="fam-del stg-coach-del" data-id="${x.id}">✕</button>
  </div>`;
}
function wireStageDetail() {
  const D = $("stg-boxes");
  D.querySelectorAll(".stg-reb-add").forEach((b) => b.addEventListener("click", () => setDiscount(b.dataset.id)));
  D.querySelectorAll(".stg-reb-del").forEach((b) => b.addEventListener("click", () => removeDiscount(b.dataset.id)));
  D.querySelectorAll(".stg-inv").forEach((b) => b.addEventListener("click", () => createInvoice(b.dataset.id)));
  D.querySelectorAll(".stg-paid").forEach((c) => c.addEventListener("change", () => togglePaid(c.dataset.id, c.checked)));
  D.querySelectorAll(".stg-reg-del").forEach((b) => b.addEventListener("click", () => delRegistrant(b.dataset.id)));
  D.querySelectorAll(".stg-coach-add").forEach((b) => b.addEventListener("click", () => addStageStaff(b.dataset.cat)));
  D.querySelectorAll(".stg-coach-del").forEach((b) => b.addEventListener("click", () => delStageStaff(b.dataset.id)));
  D.querySelectorAll(".stg-coach-row").forEach((row) => row.querySelectorAll("input,select").forEach((el) =>
    el.addEventListener("change", () => saveStageStaff(row.dataset.id, row))));
  D.querySelectorAll(".stg-link").forEach((b) => b.addEventListener("click", () => openStageLink(b.dataset.id)));
}

async function addStageStaff(catId) {
  const { error } = await sb.from("stage_staff").insert({ session_id: stgCurrent, category_id: catId, fee: 0 });
  if (error) { alert(error.message); return; }
  loadRegistrations();
}
async function saveStageStaff(id, row) {
  const cid = row.querySelector(".stg-coach-sel").value || null;
  const p = cid ? people.find((x) => x.id === cid) : null;
  const patch = {
    coach_person_id: cid,
    name: p ? `${p.last_name} ${p.first_name}` : null,
    fee: Number(row.querySelector(".stg-coach-fee").value) || 0,
    note: row.querySelector(".stg-coach-note").value.trim() || null,
  };
  const { error } = await sb.from("stage_staff").update(patch).eq("id", id);
  if (error) { alert(error.message); return; }
  const x = stgStaff.find((s) => s.id === id); if (x) Object.assign(x, patch);
  renderRegistrants(); // met à jour le résumé financier
}
async function delStageStaff(id) {
  const { error } = await sb.from("stage_staff").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  loadRegistrations();
}

// ---- Lier un inscrit à une fiche (déduplication par suggestions) ----
let stLinkRegId = null;
function matchScore(reg, p) {
  const eq = (a, b) => a && b && norm(a) === norm(b);
  let s = 0; const reasons = [];
  if (eq(reg.last_name, p.last_name)) { s += 3; reasons.push("nom"); }
  if (eq(reg.first_name, p.first_name)) { s += 3; reasons.push("prénom"); }
  if (reg.birth_date && p.birthdate && reg.birth_date === p.birthdate) { s += 3; reasons.push("naissance"); }
  const emails = [p.email, ...(p.emails || [])].filter(Boolean).map(norm);
  if (reg.email && emails.includes(norm(reg.email))) { s += 2; reasons.push("email"); }
  return { s, reasons };
}
function openStageLink(regId) {
  const r = stgRegs.find((x) => x.id === regId); if (!r) return;
  stLinkRegId = regId;
  $("stlink-info").innerHTML = `Inscrit : <b>${esc(r.first_name)} ${esc(r.last_name)}</b>${r.birth_date ? " · né(e) le " + frDate(r.birth_date) : ""}${r.email ? " · " + esc(r.email) : ""}`;
  const scored = people.map((p) => ({ p, ...matchScore(r, p) })).filter((x) => x.s >= 5).sort((a, b) => b.s - a.s).slice(0, 6);
  $("stlink-suggestions").innerHTML = scored.length ? scored.map((x) => {
    const lvl = x.s >= 8 ? "fort" : x.s >= 6 ? "probable" : "possible";
    const cls = x.s >= 8 ? "ss-ok" : x.s >= 6 ? "ss-warn" : "ss-role";
    return `<div class="stlink-row">
      <div><b>${esc(x.p.last_name)} ${esc(x.p.first_name)}</b> <span class="muted">${x.p.birthdate ? frDate(x.p.birthdate) : ""}${x.p.email ? " · " + esc(x.p.email) : ""}</span><br>
        <span class="ss-tag ${cls}">${lvl}</span> <span class="muted" style="font-size:.78rem">correspond : ${x.reasons.join(", ")}</span></div>
      <button type="button" class="stlink-pick" data-id="${x.p.id}">Lier</button></div>`;
  }).join("") : '<p class="muted" style="font-size:.85rem">Aucune fiche ressemblante trouvée. Crée une nouvelle fiche.</p>';
  $("stlink-suggestions").querySelectorAll(".stlink-pick").forEach((b) => b.addEventListener("click", () => linkRegToPerson(regId, b.dataset.id)));
  $("stlink-modal").classList.remove("hidden");
}
async function linkRegToPerson(regId, personId) {
  const { error } = await sb.from("stage_registrations").update({ person_id: personId }).eq("id", regId);
  if (error) { alert(error.message); return; }
  $("stlink-modal").classList.add("hidden");
  loadRegistrations();
}
async function createPersonFromReg() {
  const r = stgRegs.find((x) => x.id === stLinkRegId); if (!r) return;
  const res = await sb.from("people").insert({ first_name: r.first_name, last_name: r.last_name, birthdate: r.birth_date || null, email: r.email || null, is_active: true }).select("id").single();
  if (res.error) { alert(res.error.message); return; }
  await sb.from("stage_registrations").update({ person_id: res.data.id }).eq("id", stLinkRegId);
  $("stlink-modal").classList.add("hidden");
  await loadPeople();
  loadRegistrations();
}

// ---- Onglet Stages de la fiche (jeune + coach) ----
async function loadPersonStages(personId) {
  if (!personId) { $("ps-participations").innerHTML = ""; $("ps-coaching").innerHTML = ""; showPersonTab("stages", false); return; }
  const [{ data: regs }, { data: staff }] = await Promise.all([
    sb.from("stage_registrations").select("*, stage_sessions(title,start_date,end_date), stage_categories(name,price,private_addon_price)").eq("person_id", personId),
    sb.from("stage_staff").select("*, stage_sessions(title,start_date,end_date), stage_categories(name)").eq("coach_person_id", personId),
  ]);
  const R = regs || [], S = staff || [];
  showPersonTab("stages", R.length + S.length > 0);
  $("ps-participations").innerHTML = R.length ? '<table class="crm-table"><thead><tr><th>Stage</th><th>Dates</th><th>Catégorie</th><th>Payé</th><th>Prix</th></tr></thead><tbody>'
    + R.map((r) => {
      const s = r.stage_sessions, c = r.stage_categories, days = s ? stgDays(s.start_date, s.end_date) : 5;
      const base = stgEffPrice(c?.price || 0, days), disc = base * (1 - (r.discount_pct || 0) / 100), addon = r.private_addon ? Number(c?.private_addon_price || 0) : 0;
      return `<tr><td><b>${esc(s?.title || "Stage")}</b></td><td>${s ? frDate(s.start_date) + " → " + frDate(s.end_date) : "—"}</td><td>${esc(c?.name || "—")}</td><td>${r.paid ? '<span class="ss-tag ss-ok">payé</span>' : '<span class="ss-tag ss-warn">en attente</span>'}</td><td><b>${round2(disc + addon)} CHF</b></td></tr>`;
    }).join("") + "</tbody></table>" : '<p class="muted" style="font-size:.85rem">Aucune participation à un stage.</p>';
  $("ps-coaching-block").classList.toggle("hidden", !S.length);
  $("ps-coaching").innerHTML = S.length ? '<table class="crm-table"><thead><tr><th>Stage</th><th>Dates</th><th>Catégorie</th><th>Tarif reçu</th></tr></thead><tbody>'
    + S.map((x) => { const s = x.stage_sessions; return `<tr><td><b>${esc(s?.title || "Stage")}</b></td><td>${s ? frDate(s.start_date) + " → " + frDate(s.end_date) : "—"}</td><td>${esc(x.stage_categories?.name || "—")}</td><td><b>${round2(x.fee || 0)} CHF</b></td></tr>`; }).join("") + "</tbody></table>" : "";
}

// ---- Modal ajout d'un inscrit ----
function openRegModal() {
  const openCats = (stgSessionCats[stgCurrent] || []).map((id) => stgCatById(id)).filter((c) => c.id);
  if (!openCats.length) return alert("Ce stage n'a aucune catégorie ouverte. Ajoute-en via « Modifier le stage ».");
  $("reg-error").hidden = true;
  $("reg-f-first").value = ""; $("reg-f-last").value = ""; $("reg-f-email").value = ""; $("reg-f-birth").value = "";
  $("reg-f-cat").innerHTML = openCats.map((c) => `<option value="${c.id}">${esc(c.name)} — ${c.price} CHF</option>`).join("");
  $("reg-modal").classList.remove("hidden");
}

async function saveReg(e) {
  e.preventDefault();
  const err = $("reg-error"); err.hidden = true;
  const first = $("reg-f-first").value.trim(), last = $("reg-f-last").value.trim();
  if (!first || !last) { err.textContent = "Prénom et nom obligatoires."; err.hidden = false; return; }
  const { error } = await sb.from("stage_registrations").insert({
    stage_id: stgCurrent, first_name: first, last_name: last,
    email: $("reg-f-email").value.trim() || null,
    birth_date: $("reg-f-birth").value || null,
    category_id: $("reg-f-cat").value || null,
  });
  if (error) { err.textContent = error.message; err.hidden = false; return; }
  stgCounts[stgCurrent] = (stgCounts[stgCurrent] || 0) + 1;
  $("reg-modal").classList.add("hidden");
  loadRegistrations();
}

async function setDiscount(id) {
  const t = (await uiPrompt("Motif du rabais −20% — tape : famille / 2e semaine", "famille") || "").toLowerCase().trim();
  if (!t) return;
  const reason = t.startsWith("2") || t.includes("sem") ? "2e semaine" : "famille";
  await sb.from("stage_registrations").update({ discount_pct: 20, discount_reason: reason }).eq("id", id);
  const r = stgRegs.find((x) => x.id === id); Object.assign(r, { discount_pct: 20, discount_reason: reason });
  renderRegistrants();
}

async function removeDiscount(id) {
  await sb.from("stage_registrations").update({ discount_pct: 0, discount_reason: null }).eq("id", id);
  const r = stgRegs.find((x) => x.id === id); Object.assign(r, { discount_pct: 0, discount_reason: null });
  renderRegistrants();
}

async function createInvoice(id) {
  if (!await uiConfirm("Créer la facture et envoyer le mail d'inscription (avec facture jointe) ?\nL'envoi réel s'activera en production.")) return;
  const now = new Date().toISOString();
  await sb.from("stage_registrations").update({ invoice_created: true, invoice_sent_at: now }).eq("id", id);
  const r = stgRegs.find((x) => x.id === id); Object.assign(r, { invoice_created: true, invoice_sent_at: now });
  renderRegistrants();
}

async function togglePaid(id, paid) {
  await sb.from("stage_registrations").update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq("id", id);
  const r = stgRegs.find((x) => x.id === id); r.paid = paid;
  renderRegistrants(); // met à jour le résumé financier
}

async function delRegistrant(id) {
  if (!await uiConfirm("Supprimer cet inscrit ?")) return;
  await sb.from("stage_registrations").delete().eq("id", id);
  stgCounts[stgCurrent] = Math.max(0, (stgCounts[stgCurrent] || 1) - 1);
  loadRegistrations();
}

// ---- Mails des stages ----
const STG_MAIL_TYPES = [
  ["inscription", "Confirmation d'inscription (+ facture)", "À l'émission de la facture", false],
  ["rappel_paiement", "Rappel de paiement", "jours avant le début, si non payé", true],
  ["avant_stage", "Avant le stage", "jours avant le début", true],
  ["remerciement", "Remerciement + questionnaire", "jours après la fin", true],
];
let stgMails = [], stgMailSurveys = [];

async function loadStageMails() {
  const [{ data: cats }, { data: tpls }, { data: surveys }] = await Promise.all([
    sb.from("stage_categories").select("id,name").order("sort_order"),
    sb.from("stage_email_templates").select("*"),
    sb.from("gz_surveys").select("id,title,tag"),
  ]);
  stgMails = tpls || [];
  stgMailSurveys = (surveys || []).filter((s) => s.tag === "stage");
  const sel = $("stg-mail-cat");
  const prev = sel.value;
  sel.innerHTML = (cats || []).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  sel.value = prev && [...sel.options].some((o) => o.value === prev) ? prev : (cats?.[0]?.id || "");
  renderStageMails(sel.value);
}

function renderStageMails(catId) {
  if (!catId) { $("stg-mail-list").innerHTML = '<p class="muted">Crée d\'abord une catégorie.</p>'; return; }
  const byType = {};
  for (const m of stgMails) if (m.category_id === catId) byType[m.type] = m;
  $("stg-mail-list").innerHTML = STG_MAIL_TYPES.map(([type, label, when, hasOffset]) => {
    const m = byType[type] || { category_id: catId, type, subject: "", body: "", offset_days: 0, enabled: true };
    const surveyOpts = type === "remerciement"
      ? `<label class="gz-mail-lbl">Questionnaire lié</label>
         <select class="stg-mail-survey"><option value="">— aucun —</option>${stgMailSurveys.map((s) => `<option value="${s.id}"${m.survey_id === s.id ? " selected" : ""}>${esc(s.title)}</option>`).join("")}</select>`
      : "";
    const offset = hasOffset
      ? `<label class="gz-mail-lbl">Délai</label><div class="stg-inline"><input type="number" class="stg-mail-offset" value="${m.offset_days}" style="width:80px"/> <span class="muted">${when}</span></div>`
      : `<div class="muted" style="font-size:.82rem;margin-top:.4rem">⏱ ${when}</div>`;
    return `<div class="gz-mail-card stg-mail-card" data-type="${type}">
      <div class="gz-mail-head"><b>${label}</b>
        <label class="gz-mail-en"><input type="checkbox" class="stg-mail-enabled" ${m.enabled ? "checked" : ""}/> Actif</label>
      </div>
      ${offset}
      <label class="gz-mail-lbl">Objet</label>
      <input type="text" class="stg-mail-subject" value="${esc(m.subject || "")}"/>
      <label class="gz-mail-lbl">Message</label>
      <textarea class="stg-mail-body" rows="7">${esc(m.body || "")}</textarea>
      ${surveyOpts}
      <div class="gz-mail-foot">
        <div class="gz-mail-img">
          ${m.attachment_url ? `<a href="${m.attachment_url}" target="_blank" rel="noopener" class="muted">Pièce jointe</a>` : ""}
          <button type="button" class="ghost stg-mail-attbtn">${m.attachment_url ? "Changer la pièce jointe" : "Joindre un PDF / image"}</button>
          <input type="file" accept="application/pdf,image/*" class="stg-mail-file hidden"/>
        </div>
        <button type="button" class="primary stg-mail-save">Enregistrer</button>
      </div>
    </div>`;
  }).join("");
  $("stg-mail-list").querySelectorAll(".stg-mail-card").forEach((card) => {
    const type = card.dataset.type;
    card.querySelector(".stg-mail-save").addEventListener("click", () => saveStageMail(catId, type, card));
    const file = card.querySelector(".stg-mail-file");
    card.querySelector(".stg-mail-attbtn").addEventListener("click", () => file.click());
    file.addEventListener("change", () => uploadStageMailAttach(catId, type, file));
  });
}

function stgMailPatch(catId, type, card) {
  const patch = {
    category_id: catId, type,
    subject: card.querySelector(".stg-mail-subject").value.trim(),
    body: card.querySelector(".stg-mail-body").value,
    enabled: card.querySelector(".stg-mail-enabled").checked,
    updated_at: new Date().toISOString(),
  };
  const off = card.querySelector(".stg-mail-offset");
  if (off) patch.offset_days = Number(off.value) || 0;
  const sv = card.querySelector(".stg-mail-survey");
  if (sv) patch.survey_id = sv.value || null;
  return patch;
}

async function saveStageMail(catId, type, card) {
  const patch = stgMailPatch(catId, type, card);
  const btn = card.querySelector(".stg-mail-save");
  btn.textContent = "…";
  const { error } = await sb.from("stage_email_templates").upsert(patch, { onConflict: "category_id,type" });
  btn.textContent = error ? "Erreur" : "Enregistré ✓";
  if (!error) await loadStageMails();
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function uploadStageMailAttach(catId, type, file) {
  if (!file.files || !file.files[0]) return;
  const f = file.files[0];
  const path = `stages/mail-${catId}-${type}-${Date.now()}`;
  const { error } = await sb.storage.from("gz-photos").upload(path, f, { upsert: true, contentType: f.type });
  if (error) { alert("Pièce jointe : " + error.message); return; }
  const url = sb.storage.from("gz-photos").getPublicUrl(path).data.publicUrl;
  await sb.from("stage_email_templates").upsert({ category_id: catId, type, attachment_url: url }, { onConflict: "category_id,type" });
  await loadStageMails();
}

// ===================================================================
//  Tests physiques
// ===================================================================
const PHYS_YOUTH_ROLES = COURSE_ROLES; // tests physiques = tous les jeunes (toutes filières)
let physTests = [];

function initPhys() {
  // Créer / éditer des modèles de test = head coach / admin / superadmin. Un coach remplit seulement.
  if (!hasAny(myAppRoles, ["superadmin", "admin", "head_coach"]))
    document.querySelector('#view-phystests .phys-subtab[data-sub="templates"]')?.classList.add("hidden");
  document.querySelectorAll("#view-phystests .phys-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-phystests .phys-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-phystests .phys-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "phys-sub-" + b.dataset.sub));
      if (b.dataset.sub === "results") loadPhysResults();
      if (b.dataset.sub === "templates") loadPhysTemplates();
    }));
  $("phys-fill-new").addEventListener("click", () => openPhysFill());
  $("phys-tpl-new").addEventListener("click", createPhysTemplate);
  $("phys-fill-close").addEventListener("click", () => $("phys-fill-modal").classList.add("hidden"));
  $("phys-fill-modal").addEventListener("click", (e) => { if (e.target === $("phys-fill-modal")) $("phys-fill-modal").classList.add("hidden"); });
  $("phys-fill-form").addEventListener("submit", savePhysFill);
  $("pf-test").addEventListener("change", renderPhysFillQuestions);
  $("pf-person-search").addEventListener("focus", () => renderPfYouthList($("pf-person-search").value));
  $("pf-person-search").addEventListener("input", () => { $("pf-person").value = ""; renderPfYouthList($("pf-person-search").value); });
  document.addEventListener("pointerdown", (e) => { if (!$("pf-person-combo").contains(e.target)) $("pf-person-list").hidden = true; }, true);
  $("phys-result-close").addEventListener("click", () => $("phys-result-modal").classList.add("hidden"));
  $("phys-result-modal").addEventListener("click", (e) => { if (e.target === $("phys-result-modal")) $("phys-result-modal").classList.add("hidden"); });
  $("pr-del").addEventListener("click", () => deletePhysResult($("pr-del").dataset.id));
}

async function loadPhysResults() {
  const { data, error } = await sb.from("phys_results").select("*").order("filled_at", { ascending: false });
  const rows = error ? [] : (data || []);
  $("phys-results-rows").innerHTML = rows.length ? rows.map((r) => `
    <tr class="phys-res-row" data-id="${r.id}">
      <td><b>${esc(personName(r.person_id))}</b></td>
      <td>${esc(r.test_name || "—")}</td>
      <td>${esc(r.coach_name || "—")}</td>
      <td>${frDateTime(r.filled_at)}</td>
    </tr>`).join("") : '<tr><td colspan="4" class="muted">Aucun test rempli.</td></tr>';
  $("phys-results-rows").querySelectorAll(".phys-res-row").forEach((tr) =>
    tr.addEventListener("click", () => openPhysResult(tr.dataset.id)));
}

async function openPhysResult(id) {
  const r = (await sb.from("phys_results").select("*").eq("id", id).single()).data;
  if (!r) return;
  const answers = (await sb.from("phys_answers").select("*").eq("result_id", id).order("sort_order")).data || [];
  $("pr-title").textContent = r.test_name || "Test";
  $("pr-meta").innerHTML = `${esc(personName(r.person_id))} · rempli par <b>${esc(r.coach_name || "—")}</b> · ${frDateTime(r.filled_at)}`;
  $("pr-answers").innerHTML = answers.length ? answers.map((a) => {
    const v = a.answer_type === "number" ? (a.value_num ?? "—") : (a.value_text || "—");
    return `<div class="phys-ans"><span class="phys-ans-q">${esc(a.label || "")}</span><span class="phys-ans-v">${esc(v)}</span></div>`;
  }).join("") : '<p class="muted">Aucune réponse.</p>';
  $("pr-del").dataset.id = id;
  $("phys-result-modal").classList.remove("hidden");
}

async function deletePhysResult(id) {
  if (!id || !await uiConfirm("Supprimer ce test rempli ?")) return;
  const { error } = await sb.from("phys_results").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  $("phys-result-modal").classList.add("hidden");
  loadPhysResults();
}

async function loadPhysTemplates() {
  const [{ data: tests }, { data: qs }] = await Promise.all([
    sb.from("phys_tests").select("*").order("sort_order").order("created_at"),
    sb.from("phys_test_questions").select("*").order("sort_order"),
  ]);
  physTests = tests || [];
  const qByTest = {};
  for (const q of qs || []) (qByTest[q.test_id] = qByTest[q.test_id] || []).push(q);
  $("phys-tpl-list").innerHTML = physTests.length ? physTests.map((t) => `
    <div class="phys-tpl-card" data-id="${t.id}">
      <div class="phys-tpl-head">
        <input type="text" class="phys-tpl-name" value="${esc(t.name)}" placeholder="Nom du test" />
        <label class="stg-inline"><input type="checkbox" class="phys-tpl-active" ${t.active ? "checked" : ""}/> Actif</label>
      </div>
      <div class="phys-q-rows">${(qByTest[t.id] || []).map((q) => physQRow(q.label, q.answer_type)).join("")}</div>
      <button type="button" class="ghost phys-q-add">+ Question</button>
      <div class="phys-tpl-foot">
        <button type="button" class="primary phys-tpl-save">Enregistrer</button>
        <button type="button" class="fam-del phys-tpl-del">Supprimer</button>
      </div>
    </div>`).join("") : '<p class="muted">Aucun test. Cliquez « + Nouveau test ».</p>';
  $("phys-tpl-list").querySelectorAll(".phys-tpl-card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelector(".phys-q-add").addEventListener("click", () => {
      card.querySelector(".phys-q-rows").insertAdjacentHTML("beforeend", physQRow("", "text"));
      wirePhysQRows(card);
    });
    card.querySelector(".phys-tpl-save").addEventListener("click", () => savePhysTemplate(id, card));
    card.querySelector(".phys-tpl-del").addEventListener("click", () => deletePhysTemplate(id));
    wirePhysQRows(card);
  });
}

function physQRow(label, type) {
  return `<div class="phys-q-row">
    <input type="text" class="phys-q-label" value="${esc(label)}" placeholder="Question (ex. Sprint 20 m)" />
    <select class="phys-q-type">
      <option value="text"${type === "text" ? " selected" : ""}>Texte</option>
      <option value="number"${type === "number" ? " selected" : ""}>Numérique</option>
    </select>
    <button type="button" class="fam-del phys-q-del">✕</button>
  </div>`;
}
function wirePhysQRows(card) {
  card.querySelectorAll(".phys-q-del").forEach((b) => { b.onclick = () => b.closest(".phys-q-row").remove(); });
}

async function createPhysTemplate() {
  const sort = (physTests.at(-1)?.sort_order || physTests.length) + 1;
  const { error } = await sb.from("phys_tests").insert({ name: "Nouveau test", sort_order: sort });
  if (error) { alert(error.message); return; }
  await loadPhysTemplates();
  const last = $("phys-tpl-list").querySelector(".phys-tpl-card:last-child .phys-tpl-name");
  if (last) { last.focus(); last.select(); }
}

async function savePhysTemplate(id, card) {
  const name = card.querySelector(".phys-tpl-name").value.trim() || "Test";
  const active = card.querySelector(".phys-tpl-active").checked;
  const questions = [...card.querySelectorAll(".phys-q-row")].map((row, i) => ({
    test_id: id,
    label: row.querySelector(".phys-q-label").value.trim(),
    answer_type: row.querySelector(".phys-q-type").value,
    sort_order: i,
  })).filter((q) => q.label);
  const btn = card.querySelector(".phys-tpl-save");
  btn.textContent = "…";
  await sb.from("phys_tests").update({ name, active }).eq("id", id);
  await sb.from("phys_test_questions").delete().eq("test_id", id);
  if (questions.length) await sb.from("phys_test_questions").insert(questions);
  btn.textContent = "Enregistré ✓";
  setTimeout(() => (btn.textContent = "Enregistrer"), 1500);
}

async function deletePhysTemplate(id) {
  if (!await uiConfirm("Supprimer ce modèle de test ? (les tests déjà remplis sont conservés)")) return;
  const { error } = await sb.from("phys_tests").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  loadPhysTemplates();
}

let pfYouthList = [];
const pfName = (p) => `${p.last_name} ${p.first_name}`;
async function openPhysFill(preselectId) {
  $("pf-error").hidden = true;
  pfYouthList = people.filter((p) => hasRoleIn(p.id, PHYS_YOUTH_ROLES)).sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
  const pre = preselectId ? people.find((p) => p.id === preselectId) : null; // depuis une fiche : jeune figé
  $("pf-person").value = pre ? pre.id : "";
  $("pf-person-search").value = pre ? pfName(pre) : "";
  $("pf-person-search").disabled = !!pre;
  $("pf-person-list").hidden = true;
  const { data: tests } = await sb.from("phys_tests").select("*").eq("active", true).order("sort_order").order("created_at");
  physTests = tests || [];
  $("pf-test").innerHTML = '<option value="">— Choisir un test —</option>'
    + physTests.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  $("pf-questions").innerHTML = "";
  $("phys-fill-modal").classList.remove("hidden");
}
function renderPfYouthList(q) {
  q = (q || "").trim().toLowerCase();
  const list = (q ? pfYouthList.filter((p) => pfName(p).toLowerCase().includes(q)) : pfYouthList).slice(0, 20);
  const box = $("pf-person-list");
  box.innerHTML = list.length
    ? list.map((p) => `<div class="combo-opt" data-id="${p.id}">${esc(p.last_name)} ${esc(p.first_name)}</div>`).join("")
    : '<div class="combo-empty">Aucun joueur</div>';
  box.querySelectorAll(".combo-opt").forEach((o) => o.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const p = pfYouthList.find((x) => x.id === o.dataset.id);
    $("pf-person").value = p.id;
    $("pf-person-search").value = pfName(p);
    box.hidden = true;
  }));
  // Positionnement fixe (sinon la liste est rognée par la modale en overflow:auto)
  const r = $("pf-person-search").getBoundingClientRect();
  const below = window.innerHeight - r.bottom - 10;
  box.style.left = r.left + "px";
  box.style.top = (r.bottom + 4) + "px";
  box.style.width = r.width + "px";
  box.style.maxHeight = Math.max(120, Math.min(240, below)) + "px";
  box.hidden = false;
}
async function openPhysFillFor(personId) {
  if (!personId) { alert("Enregistre d'abord la fiche."); return; }
  await openPhysFill(personId);
}

async function renderPhysFillQuestions() {
  const tid = $("pf-test").value;
  if (!tid) { $("pf-questions").innerHTML = ""; return; }
  const qs = (await sb.from("phys_test_questions").select("*").eq("test_id", tid).order("sort_order")).data || [];
  $("pf-questions").innerHTML = qs.length ? qs.map((q) => `
    <label class="pf-q">${esc(q.label)}${q.answer_type === "number" ? ' <span class="muted">(nombre)</span>' : ""}
      <input class="pf-a" data-qid="${q.id}" data-type="${q.answer_type}" data-label="${esc(q.label)}"
        type="${q.answer_type === "number" ? "number" : "text"}" step="any" />
    </label>`).join("") : '<p class="muted" style="font-size:.85rem">Ce test n\'a pas encore de questions.</p>';
}

async function savePhysFill(e) {
  e.preventDefault();
  const err = $("pf-error"); err.hidden = true;
  const pid = $("pf-person").value, tid = $("pf-test").value;
  if (!pid || !tid) { err.textContent = "Choisis un joueur et un test."; err.hidden = false; return; }
  const testName = $("pf-test").options[$("pf-test").selectedIndex]?.textContent || "Test";
  const res = await sb.from("phys_results").insert({
    test_id: tid, test_name: testName, person_id: pid,
    coach_person_id: myPersonId, coach_name: meName, created_by: meId,
  }).select("id").single();
  if (res.error) { err.textContent = res.error.message; err.hidden = false; return; }
  const answers = [...$("pf-questions").querySelectorAll(".pf-a")].map((inp, i) => {
    const num = inp.dataset.type === "number";
    return {
      result_id: res.data.id, question_id: inp.dataset.qid, label: inp.dataset.label,
      answer_type: inp.dataset.type,
      value_text: num ? null : (inp.value.trim() || null),
      value_num: num ? (inp.value === "" ? null : Number(inp.value)) : null,
      sort_order: i,
    };
  });
  if (answers.length) await sb.from("phys_answers").insert(answers);
  $("phys-fill-modal").classList.add("hidden");
  loadPhysResults();
  // si on remplissait depuis une fiche ouverte, rafraîchir sa liste
  if (!$("people-detail").classList.contains("hidden") && $("p-id").value === pid) loadPersonPhys(pid);
}

// ---- Onglets Tests physiques & Études de la fiche ----
async function loadPersonPhys(personId, byRole) {
  if (!personId) { $("pp-results").innerHTML = ""; return; }
  const { data } = await sb.from("phys_results").select("*").eq("person_id", personId).order("filled_at", { ascending: false });
  const rows = data || [];
  showPersonTab("phys", byRole || rows.length > 0);
  $("pp-results").innerHTML = rows.length ? '<table class="crm-table"><thead><tr><th>Test</th><th>Rempli par</th><th>Date</th></tr></thead><tbody>'
    + rows.map((r) => `<tr class="pp-row" data-id="${r.id}"><td><b>${esc(r.test_name || "—")}</b></td><td>${esc(r.coach_name || "—")}</td><td>${frDateTime(r.filled_at)}</td></tr>`).join("")
    + "</tbody></table>" : '<p class="muted" style="font-size:.85rem">Aucun test rempli.</p>';
  $("pp-results").querySelectorAll(".pp-row").forEach((tr) => tr.addEventListener("click", () => openPhysResult(tr.dataset.id)));
}

// ===================================================================
//  Feuille de match (match_reports)
// ===================================================================
const MR_RANKINGS = ["r9", "r8", "r7", "r6", "r5", "r4", "r3", "r2", "r1", "n4", "n3", "n2", "n1", "autre"];
const MR_RATINGS = [
  ["r_attitude", "Attitude sur le terrain"], ["r_mindset", "État d'esprit positif"],
  ["r_legs", "Intensité des jambes"], ["r_relax", "Relâchement"],
  ["r_objectives", "Tenir les objectifs"], ["r_combative", "Combatif"],
];
// Clés des champs texte (colonnes DB) — ordre d'affichage.
const MR_TEXTS = [
  ["strategy_pre"], ["opp_sw"], ["opp_style"], ["how_won"],
  ["how_lost"], ["did_well"], ["to_improve"], ["three_positives"],
];
// Sexe d'une personne ("M" par défaut si inconnu).
const mrGenderOf = (pid) => (people.find((p) => p.id === pid)?.gender) || "M";
// Libellés des champs texte selon le point de vue (coach = il/elle ; joueur = 1re personne).
function mrTextLabels(mode, gender) {
  const il = gender === "F" ? "elle" : "il";
  const base = {
    strategy_pre: "Stratégie d'avant match",
    opp_sw: "Forces et faiblesses de l'adversaire",
    opp_style: "Style de jeu de l'adversaire",
    three_positives: "3 choses positives de ce match",
  };
  if (mode === "joueur") return {
    ...base,
    how_won: "Comment j'ai gagné la majorité des points",
    how_lost: "Comment j'ai perdu la majorité des points",
    did_well: "Ce que j'ai bien réussi à faire",
    to_improve: "Ce que je dois améliorer",
  };
  return {
    ...base,
    how_won: `Comment ${il} a gagné la majorité des points`,
    how_lost: `Comment ${il} a perdu la majorité des points`,
    did_well: `Ce qu'${il} a bien réussi à faire`,
    to_improve: `Ce qu'${il} doit améliorer`,
  };
}

function initMatchs(roles) {
  // Remplir/lister = coachs & admin ; valider les correspondances = admin/superadmin/secrétariat
  const canFill = hasAny(roles || [], ["coach", "head_coach", "admin", "superadmin"]);
  const canValidate = hasAny(roles || [], ["admin", "superadmin", "secretaire"]);
  const showSub = (sub, ok) => document.querySelector(`#view-matchs .mr-subtab[data-sub="${sub}"]`)?.classList.toggle("hidden", !ok);
  showSub("new", canFill); showSub("list", canFill); showSub("links", canValidate);
  document.querySelectorAll("#view-matchs .mr-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-matchs .mr-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-matchs .mr-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "mr-sub-" + b.dataset.sub));
      if (b.dataset.sub === "new") mrRenderForm();
      if (b.dataset.sub === "list") loadMatchList();
      if (b.dataset.sub === "links") loadMatchLinks();
    }));
}
// Active le premier sous-onglet visible (selon le rôle)
function mrActivateFirst() {
  const first = [...document.querySelectorAll("#view-matchs .mr-subtab")].find((b) => !b.classList.contains("hidden"));
  if (first) first.click();
}

function mrRenderForm(prefillYouth) {
  const mount = $("mr-form-mount");
  if (!mount) return;
  const youths = people.filter((p) => hasRoleIn(p.id, COURSE_ROLES)).sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
  const yopts = youths.map((p) => `<option value="${p.id}"${p.id === prefillYouth ? " selected" : ""}>${esc(p.last_name)} ${esc(p.first_name)}</option>`).join("");
  const rankOpts = MR_RANKINGS.map((r) => `<option value="${r}">${r === "autre" ? "Autre" : r.toUpperCase()}</option>`).join("");
  const initYouth = prefillYouth || youths[0]?.id;
  const labels = mrTextLabels("coach", mrGenderOf(initYouth));
  mount.innerHTML = `
    <div class="rg-card mr-form">
      <div class="mr-grid">
        <label>Jeune concerné<select id="mr-youth">${yopts}</select></label>
        <label>Date du match<input type="date" id="mr-date" /></label>
        <label>Adversaire<input type="text" id="mr-opponent" /></label>
        <label>Classement adversaire<select id="mr-rank"><option value="">—</option>${rankOpts}</select></label>
        <label>Résultat<select id="mr-result"><option value="gagne">Gagné</option><option value="perdu">Perdu</option></select></label>
        <label>Score<input type="text" id="mr-score" placeholder="ex. 6-3 6-4" /></label>
      </div>
      <div class="mr-texts">${MR_TEXTS.map(([k]) => `<label><span class="mr-lbl" data-k="${k}">${esc(labels[k])}</span><textarea id="mr-${k}" rows="2"></textarea></label>`).join("")}</div>
      <h4 class="mr-h">Évaluations (1 à 5)</h4>
      <div class="mr-ratings">${MR_RATINGS.map(([k, l]) => `<div class="mr-rate"><span>${esc(l)}</span><div class="mr-stars" data-k="${k}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="mr-star" data-v="${n}">${n}</button>`).join("")}</div></div>`).join("")}</div>
      <label class="mr-comment">Commentaire<textarea id="mr-comment" rows="2"></textarea></label>
      <div class="mr-actions"><button type="button" id="mr-save">Enregistrer la feuille</button><span id="mr-status" class="muted"></span></div>
    </div>`;
  $("mr-date").value = new Date().toISOString().slice(0, 10);
  // Adapte « il / elle » selon le sexe du jeune choisi.
  $("mr-youth").addEventListener("change", () => {
    const lab = mrTextLabels("coach", mrGenderOf($("mr-youth").value));
    mount.querySelectorAll(".mr-lbl").forEach((s) => { s.textContent = lab[s.dataset.k]; });
  });
  mount.querySelectorAll(".mr-stars").forEach((box) => box.querySelectorAll(".mr-star").forEach((b) => b.addEventListener("click", () => {
    box.dataset.val = b.dataset.v;
    box.querySelectorAll(".mr-star").forEach((x) => x.classList.toggle("on", Number(x.dataset.v) <= Number(b.dataset.v)));
  })));
  $("mr-save").addEventListener("click", saveMatchReport);
}

async function saveMatchReport() {
  const youth = $("mr-youth").value;
  if (!youth) { $("mr-status").textContent = "Choisis un jeune."; return; }
  const rating = (k) => { const el = document.querySelector(`.mr-stars[data-k="${k}"]`); return el && el.dataset.val ? Number(el.dataset.val) : null; };
  const row = {
    youth_person_id: youth, author_role: "coach",
    author_person_id: myPersonId, author_name: meName, created_by: meId,
    match_date: $("mr-date").value || null, opponent: $("mr-opponent").value.trim() || null,
    opponent_ranking: $("mr-rank").value || null, result: $("mr-result").value,
    score: $("mr-score").value.trim() || null, comment: $("mr-comment").value.trim() || null,
  };
  for (const [k] of MR_TEXTS) row[k] = $("mr-" + k).value.trim() || null;
  for (const [k] of MR_RATINGS) row[k] = rating(k);
  $("mr-status").textContent = "Enregistrement…";
  const { error } = await sb.from("match_reports").insert(row);
  if (error) { $("mr-status").textContent = "Erreur : " + error.message; return; }
  mrRenderForm();
  const listTab = document.querySelector('#view-matchs .mr-subtab[data-sub="list"]');
  if (listTab && !listTab.classList.contains("hidden")) listTab.click();
}

const mrNorm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const mrDaysApart = (a, b) => (!a || !b) ? 99 : Math.abs((new Date(a) - new Date(b)) / 86400000);
function mrPairScore(c, j) {
  let s = 0;
  const co = mrNorm(c.opponent), jo = mrNorm(j.opponent);
  if (co && co === jo) s += 3; else if (co && jo && (co.includes(jo) || jo.includes(co))) s += 2;
  if (mrNorm(c.score) && mrNorm(c.score) === mrNorm(j.score)) s += 2;
  const d = mrDaysApart(c.match_date, j.match_date);
  if (d <= 1) s += 3; else if (d <= 3) s += 1;
  return s;
}
// Correspondances coach ↔ joueur à valider (admin/superadmin/secrétariat)
async function loadMatchLinks() {
  const cont = $("mr-links"); if (!cont) return;
  const [{ data: reps }, { data: ign }] = await Promise.all([
    sb.from("match_reports").select("*"),
    sb.from("match_link_ignored").select("a_id,b_id"),
  ]);
  const ignored = new Set((ign || []).map((x) => [x.a_id, x.b_id].sort().join("|")));
  const byYouth = {};
  for (const r of reps || []) (byYouth[r.youth_person_id] = byYouth[r.youth_person_id] || []).push(r);
  const pairs = [];
  for (const yid in byYouth) {
    const coaches = byYouth[yid].filter((r) => r.author_role === "coach");
    const joueurs = byYouth[yid].filter((r) => r.author_role === "joueur");
    for (const c of coaches) for (const j of joueurs) {
      if (c.match_group_id && c.match_group_id === j.match_group_id) continue;
      const key = [c.id, j.id].sort().join("|");
      if (ignored.has(key)) continue;
      const s = mrPairScore(c, j);
      if (s >= 2) pairs.push({ c, j, s, key });
    }
  }
  pairs.sort((a, b) => b.s - a.s);
  const one = (r) => `<span class="mr-badge ${r.author_role}">${r.author_role}</span> ${esc(r.author_name || "—")}<br><span class="muted">vs ${esc(r.opponent || "—")}${r.opponent_ranking ? " (" + esc(r.opponent_ranking.toUpperCase()) + ")" : ""} · ${esc(r.score || "—")} · ${r.match_date ? frDate(r.match_date) : "—"}</span>`;
  cont.innerHTML = pairs.length
    ? '<p class="muted" style="font-size:.85rem;margin:0 0 12px">Le système a repéré des feuilles coach et joueur qui pourraient concerner le même match. Validez pour les comparer.</p>'
      + pairs.map((p) => `<div class="rg-card mr-link" data-c="${p.c.id}" data-j="${p.j.id}" data-a="${p.key.split("|")[0]}" data-b="${p.key.split("|")[1]}">
        <div class="mr-link-head"><b>${esc(mrName(p.c.youth_person_id))}</b> <span class="mr-conf">confiance ${p.s}/8</span></div>
        <div class="mr-link-cols"><div>${one(p.c)}</div><div>${one(p.j)}</div></div>
        <div class="mr-link-acts"><button type="button" class="mr-link-yes">C'est le même match — lier</button><button type="button" class="ghost mr-link-no">Ignorer</button></div>
      </div>`).join("")
    : '<p class="muted" style="font-size:.85rem">Aucune correspondance à valider pour le moment.</p>';
  cont.querySelectorAll(".mr-link").forEach((card) => {
    card.querySelector(".mr-link-yes").addEventListener("click", async () => {
      const gid = crypto.randomUUID();
      await sb.from("match_reports").update({ match_group_id: gid }).in("id", [card.dataset.c, card.dataset.j]);
      loadMatchLinks();
    });
    card.querySelector(".mr-link-no").addEventListener("click", async () => {
      await sb.from("match_link_ignored").insert({ a_id: card.dataset.a, b_id: card.dataset.b });
      loadMatchLinks();
    });
  });
}

const mrName = (id) => { const p = people.find((x) => x.id === id); return p ? `${p.last_name} ${p.first_name}` : "—"; };
async function loadMatchList() {
  const cont = $("mr-list"); if (!cont) return;
  // Uniquement les feuilles que J'ai remplies en tant que coach.
  const { data } = await sb.from("match_reports").select("*")
    .eq("author_role", "coach").eq("author_person_id", myPersonId)
    .order("created_at", { ascending: false });
  const rows = data || [];
  cont.innerHTML = rows.length
    ? '<table class="crm-table"><thead><tr><th>Date / heure</th><th>Jeune</th><th>Adversaire</th><th>Résultat</th></tr></thead><tbody>'
      + rows.map((r) => `<tr class="mr-row" data-id="${r.id}"><td>${frDateTime(r.created_at)}</td><td><b>${esc(mrName(r.youth_person_id))}</b></td>
        <td>${esc(r.opponent || "—")}${r.opponent_ranking ? " (" + esc(r.opponent_ranking.toUpperCase()) + ")" : ""}</td>
        <td>${r.result === "gagne" ? '<span class="mr-win">Gagné</span>' : '<span class="mr-loss">Perdu</span>'} ${esc(r.score || "")}</td></tr>`).join("")
      + "</tbody></table>"
    : '<p class="muted" style="font-size:.85rem">Tu n\'as pas encore rempli de feuille de match.</p>';
  cont.querySelectorAll(".mr-row").forEach((tr) => tr.addEventListener("click", () => openMatchReport(tr.dataset.id)));
}

const mrStars = (v) => v ? "★".repeat(v) + "☆".repeat(5 - v) : "—";
async function openMatchReport(id) {
  const { data: r } = await sb.from("match_reports").select("*").eq("id", id).single();
  if (!r) return;
  const labels = mrTextLabels(r.author_role, mrGenderOf(r.youth_person_id));
  const cont = $("mr-list");
  cont.innerHTML = `<button type="button" class="ghost stg-back" id="mr-back">← Retour à la liste</button>
    <div class="rg-card" style="margin-top:10px">
      <h2 style="margin-top:0">${esc(mrName(r.youth_person_id))} <span class="mr-badge ${r.author_role}">${r.author_role}</span></h2>
      <p class="muted">${r.match_date ? frDate(r.match_date) : ""} · vs <b>${esc(r.opponent || "—")}</b>${r.opponent_ranking ? " (" + esc(r.opponent_ranking.toUpperCase()) + ")" : ""} · ${r.result === "gagne" ? "Gagné" : "Perdu"} ${esc(r.score || "")} · rempli par ${esc(r.author_name || "—")} le ${frDateTime(r.created_at)}</p>
      ${MR_TEXTS.filter(([k]) => r[k]).map(([k]) => `<div class="mr-field"><b>${esc(labels[k])}</b><p>${esc(r[k])}</p></div>`).join("")}
      <div class="mr-ratings-view">${MR_RATINGS.map(([k, l]) => `<div class="mr-rv"><span>${esc(l)}</span><b>${mrStars(r[k])}</b></div>`).join("")}</div>
      ${r.comment ? `<div class="mr-field"><b>Commentaire</b><p>${esc(r.comment)}</p></div>` : ""}
      <button type="button" class="fam-del" id="mr-del" style="margin-top:14px">Supprimer cette feuille</button>
    </div>`;
  $("mr-back").addEventListener("click", loadMatchList);
  $("mr-del").addEventListener("click", async () => { if (!await uiConfirm("Supprimer cette feuille ?")) return; await sb.from("match_reports").delete().eq("id", id); loadMatchList(); });
}

async function loadPersonMatchs(personId, byRole) {
  const mount = $("mrf-mount"); if (!mount) return;
  if (!personId) { mount.innerHTML = ""; return; }
  const { data } = await sb.from("match_reports").select("*").eq("youth_person_id", personId).order("match_date", { ascending: false, nullsFirst: false });
  const rows = data || [];
  showPersonTab("matchs", byRole || rows.length > 0);
  const wins = rows.filter((r) => r.result === "gagne").length, losses = rows.filter((r) => r.result === "perdu").length;
  const avg = (list, k) => { const v = list.map((r) => r[k]).filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
  const cR = rows.filter((r) => r.author_role === "coach"), jR = rows.filter((r) => r.author_role === "joueur");
  const bar = (v, cls) => `<div class="mr-bar"><div class="mr-bar-fill ${cls}" style="width:${(v || 0) / 5 * 100}%"></div></div>`;
  const hasComp = cR.length && jR.length;
  const comp = MR_RATINGS.map(([k, l]) => {
    const c = avg(cR, k), j = avg(jR, k);
    return `<div class="mr-comp"><span class="mr-comp-l">${esc(l)}</span><div class="mr-comp-bars">
      <div class="mr-comp-line"><span class="mr-tag coach">Coach ${c ?? "—"}</span>${bar(c, "coach")}</div>
      <div class="mr-comp-line"><span class="mr-tag joueur">Joueur ${j ?? "—"}</span>${bar(j, "joueur")}</div></div></div>`;
  }).join("");
  mount.innerHTML = `
    <div class="et-stats" style="margin-bottom:12px">
      <div class="et-stat st-present"><b>${wins}</b><span>gagnés</span></div>
      <div class="et-stat st-absent"><b>${losses}</b><span>perdus</span></div>
      <div class="et-stat"><b>${rows.length}</b><span>feuilles</span></div>
    </div>
    ${rows.length ? `<h3 style="margin:10px 0 8px">Évaluation moyenne ${hasComp ? "— coach vs joueur" : ""}</h3>
      ${hasComp ? `<p class="muted" style="font-size:.82rem;margin:0 0 8px">Compare la vision du coach et celle du joueur sur les mêmes critères.</p>` : ""}
      <div class="mr-comp-wrap">${comp}</div>` : ""}
    <h3 style="margin:16px 0 8px">Feuilles de match</h3>
    ${rows.length ? '<div class="table-wrap"><table class="crm-table"><thead><tr><th>Date</th><th>Adversaire</th><th>Résultat</th><th>Par</th></tr></thead><tbody>'
      + rows.map((r) => `<tr><td>${r.match_date ? frDate(r.match_date) : "—"}</td><td>${esc(r.opponent || "—")}${r.opponent_ranking ? " (" + esc(r.opponent_ranking.toUpperCase()) + ")" : ""}</td><td>${r.result === "gagne" ? "Gagné" : "Perdu"} ${esc(r.score || "")}</td><td><span class="mr-badge ${r.author_role}">${r.author_role}</span></td></tr>`).join("")
      + "</tbody></table></div>" : '<p class="muted" style="font-size:.85rem">Aucune feuille de match.</p>'}
    <div id="pm-hist"></div>`;
  renderPmHistory(personId, rows);
}

// ---- Historique Swiss Tennis (matchs importés de mytennis) ----
let pmData = [], pmReports = [];
async function renderPmHistory(personId, reports) {
  const host = $("pm-hist"); if (!host) return;
  const { data } = await sb.from("player_matches").select("*").eq("person_id", personId).order("match_date", { ascending: false, nullsFirst: false });
  pmData = data || []; pmReports = reports || [];
  if (!pmData.length) {
    host.innerHTML = `<h3 style="margin:16px 0 8px">Historique Swiss Tennis</h3>
      <p class="muted" style="font-size:.85rem">Aucun match importé pour ce joueur. (Import via le favori « Importer les matchs » en bas du Répertoire ; nécessite un n° de licence.)</p>`;
    return;
  }
  showPersonTab("matchs", true);
  const years = [...new Set(pmData.map((m) => (m.match_date || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  host.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 8px">
      <h3 style="margin:0">Historique Swiss Tennis</h3>
      <select id="pm-year" style="max-width:150px">${years.map((y) => `<option value="${y}">${y}</option>`).join("")}<option value="all">Toutes les années</option></select>
    </div>
    <div id="pm-year-list"></div>`;
  $("pm-year").addEventListener("change", () => drawPmYear($("pm-year").value));
  drawPmYear(years[0] || "all");
}
function pmLinked(m) {
  const oppLast = (m.opponent_last || "").toLowerCase().trim();
  if (!oppLast) return false;
  const md = m.match_date ? new Date(m.match_date) : null;
  return pmReports.some((r) => {
    if (!r.opponent || !r.opponent.toLowerCase().includes(oppLast)) return false;
    if (md && r.match_date) return Math.abs((md - new Date(r.match_date)) / 86400000) <= 3;
    return true;
  });
}
function drawPmYear(year) {
  const list = $("pm-year-list"); if (!list) return;
  const rows = year === "all" ? pmData : pmData.filter((m) => (m.match_date || "").slice(0, 4) === year);
  if (!rows.length) { list.innerHTML = `<p class="muted" style="font-size:.85rem">Aucun match.</p>`; return; }
  const w = rows.filter((m) => m.won === true).length, l = rows.filter((m) => m.won === false).length;
  list.innerHTML = `<div class="et-stats" style="margin-bottom:10px">
      <div class="et-stat st-present"><b>${w}</b><span>victoires</span></div>
      <div class="et-stat st-absent"><b>${l}</b><span>défaites</span></div>
      <div class="et-stat"><b>${rows.length}</b><span>matchs</span></div>
    </div>
    <div class="table-wrap"><table class="crm-table"><thead><tr><th>Date</th><th>Tournoi</th><th>Adversaire</th><th>Score</th><th>Rés.</th><th></th></tr></thead><tbody>`
    + rows.map((m) => `<tr>
        <td>${m.match_date ? frDate(m.match_date) : "—"}</td>
        <td>${esc(m.tournament_name || "—")}</td>
        <td>${esc(((m.opponent_first || "") + " " + (m.opponent_last || "")).trim() || "—")}${m.opponent_classification ? " (" + esc(m.opponent_classification) + ")" : ""}</td>
        <td>${esc(m.score || "—")}</td>
        <td>${m.won === true ? '<span class="pm-w">V</span>' : m.won === false ? '<span class="pm-l">D</span>' : "—"}</td>
        <td>${pmLinked(m) ? '<span class="pm-link" title="Une feuille de match coach/joueur correspond">📋 liée</span>' : ""}</td>
      </tr>`).join("")
    + "</tbody></table></div>";
}

let peYouthId = null;
async function loadPersonEtudes(personId, byRole) {
  if (!personId) { $("pe-stats").innerHTML = ""; return; }
  showPersonTab("etudes", byRole);
  const season = currentSeason("juniors");
  let n = 0, pr = 0, la = 0, ab = 0;
  if (season) {
    const { data: days } = await sb.from("etudes_days").select("id").eq("season_id", season.id);
    const dayIds = (days || []).map((d) => d.id);
    if (dayIds.length) {
      const att = (await sb.from("etudes_attendance").select("status").in("day_id", dayIds).eq("youth_person_id", personId)).data || [];
      const rows = att.filter((a) => a.status !== "not_planned"); n = rows.length;
      pr = rows.filter((a) => a.status === "present").length; la = rows.filter((a) => a.status === "late").length; ab = rows.filter((a) => a.status === "absent").length;
    }
  }
  const pct = (x) => n ? Math.round(x / n * 100) : 0;
  $("pe-stats").innerHTML = (season ? `<div class="muted" style="width:100%;font-size:.82rem;margin-bottom:6px">Saison ${esc(season.label)}</div>` : "")
    + (n ? `<div class="et-stat st-present"><b>${pct(pr)}%</b><span>présent (${pr})</span></div><div class="et-stat st-late"><b>${pct(la)}%</b><span>retard (${la})</span></div><div class="et-stat st-absent"><b>${pct(ab)}%</b><span>absent (${ab})</span></div><div class="et-stat"><b>${n}</b><span>jours</span></div>`
      : '<p class="muted" style="font-size:.85rem">Aucune présence renseignée.</p>');
}
// Fil « Suivi du jeune » unifié (interne, cross-rôles) dans la fiche.
async function loadPersonSuivi(personId, byRole) {
  if (!personId) { $("ps-chan").innerHTML = ""; return; }
  showPersonTab("suivi", byRole);
  youthNotes("ps-chan", personId);
}

// ---- Onglet Contrat (joueurs sport-études / pro) : par saison ----
let pcPersonId = null;
async function loadPersonContract(personId, byRole) {
  pcPersonId = personId;
  if (!personId) { $("pc-body").innerHTML = ""; return; }
  showPersonTab("contrat", byRole);
  if (!byRole) return;
  await loadSeasonsList();
  const cur = currentSeason("juniors")?.id;
  const sel = $("pc-season");
  sel.innerHTML = seasonsOf("juniors").map((s) => seasonOpt(s, cur)).join("") || '<option value="">—</option>';
  if (cur) sel.value = cur;   // force la saison en cours (sinon la valeur peut ne pas s'appliquer -> contrat affiché « vide »)
  renderPersonContract();
}
const PC_PROGRAMMES = ["sport-études", "pro", "proU18", "sport-études sans études"];
const PC_STATUSES = ["à préparer", "envoyé", "signé"];
const PC_DURATIONS = ["1h", "1h30", "2h", "2h30", "3h"];
const PC_DAYS = [["Mon", "Lun"], ["Tue", "Mar"], ["Wed", "Mer"], ["Thu", "Jeu"], ["Fri", "Ven"]];
const pcMonthly = (d) => { const a = parseFloat(d["Annual fee"]), n = parseFloat(d["Instalments"]); return (a > 0 && n > 0) ? String(Math.round(a / n)) : ""; };

async function renderPersonContract() {
  const body = $("pc-body"); if (!body) return;
  const seasonId = $("pc-season").value;
  if (!pcPersonId || !seasonId) { body.innerHTML = ""; return; }
  const { data } = await sb.from("player_contracts").select("data").eq("person_id", pcPersonId).eq("season_id", seasonId).maybeSingle();
  const d = data?.data || {};
  const sess = Array.isArray(d["Private sessions"]) ? d["Private sessions"] : [];

  if (!hasAny(myAppRoles, ["superadmin", "admin"])) {  // lecture seule (secrétariat)
    if (!data) { body.innerHTML = '<p class="muted" style="font-size:.88rem">Aucun contrat pour cette saison.</p>'; return; }
    const row = (l, v) => (v != null && v !== "") ? `<div class="pc-row"><span>${l}</span><b>${esc(String(v))}</b></div>` : "";
    const wk = (p) => PC_DAYS.map(([k, l]) => `<span class="pc-day ${d[k + " " + p] === "Oui" ? "oui" : "non"}">${l}</span>`).join("");
    body.innerHTML = `
      <div class="pc-sec"><h4>Contrat & facturation</h4>
        ${row("Programme", d["Programme"])}${row("Statut du contrat", d["Contract status"])}
        ${row("Début", d["Start date"] ? frDate(d["Start date"]) : "")}${row("Fin", d["End date"] ? frDate(d["End date"]) : "")}
        ${row("Montant annuel", d["Annual fee"] ? d["Annual fee"] + " CHF" : "")}${row("Mensualités", d["Instalments"])}${row("Mensualité", pcMonthly(d) ? pcMonthly(d) + " CHF" : "")}</div>
      <div class="pc-sec"><h4>Entraînement matin</h4><div class="pc-week">${wk("AM")}</div></div>
      <div class="pc-sec"><h4>Entraînement après-midi</h4><div class="pc-week">${wk("PM")}</div></div>
      <div class="pc-sec"><h4>Repas de midi</h4><div class="pc-week">${wk("lunch")}</div></div>
      <div class="pc-sec"><h4>Cours privés</h4>${row("Cours privés ?", d["Private lessons?"])}${sess.length ? `<div class="pc-row"><span>Séances</span><b>${sess.map(esc).join(", ")}</b></div>` : ""}</div>
      ${d["Notes"] ? `<div class="pc-sec"><h4>Notes</h4><p style="margin:0">${esc(d["Notes"])}</p></div>` : ""}`;
    return;
  }

  // Formulaire éditable (admin / superadmin)
  const opt = (v, cur) => `<option${cur === v ? " selected" : ""}>${esc(v)}</option>`;
  const selF = (k, l, opts) => `<label class="pc-f"><span>${l}</span><select data-k="${esc(k)}"><option value=""></option>${opts.map((o) => opt(o, d[k])).join("")}</select></label>`;
  const inpF = (k, l, t) => `<label class="pc-f"><span>${l}</span><input data-k="${esc(k)}" type="${t}" value="${esc(d[k] || "")}" /></label>`;
  const wkE = (p) => PC_DAYS.map(([k, l]) => { const on = d[k + " " + p] === "Oui"; return `<button type="button" class="pc-tog ${on ? "oui" : "non"}" data-k="${k} ${p}" data-v="${on ? "Oui" : "Non"}">${l}</button>`; }).join("");
  const sessRow = (v) => `<div class="pc-sess-row"><select class="pc-sess">${PC_DURATIONS.map((o) => opt(o, v)).join("")}</select><button type="button" class="pc-sess-rm" aria-label="Retirer">✕</button></div>`;
  const priv = d["Private lessons?"] === "Oui";
  body.innerHTML = `
    <div class="pc-sec"><h4>Contrat & facturation</h4><div class="pc-grid">
      ${selF("Programme", "Programme", PC_PROGRAMMES)}
      ${selF("Contract status", "Statut du contrat", PC_STATUSES)}
      ${inpF("Start date", "Date de début", "date")}
      ${inpF("End date", "Date de fin", "date")}
      ${inpF("Annual fee", "Montant annuel (CHF)", "number")}
      ${inpF("Instalments", "Nb de mensualités", "number")}
      <label class="pc-f"><span>Mensualité (auto)</span><input id="pc-monthly" type="text" value="${esc(pcMonthly(d))}" disabled /></label>
    </div></div>
    <div class="pc-sec"><h4>Entraînement matin</h4><div class="pc-week edit">${wkE("AM")}</div></div>
    <div class="pc-sec"><h4>Entraînement après-midi</h4><div class="pc-week edit">${wkE("PM")}</div></div>
    <div class="pc-sec"><h4>Repas de midi</h4><div class="pc-week edit">${wkE("lunch")}</div></div>
    <div class="pc-sec"><h4>Cours privés</h4>
      <button type="button" class="pc-tog ${priv ? "oui" : "non"}" id="pc-priv" data-v="${priv ? "Oui" : "Non"}" style="max-width:120px">${priv ? "Oui" : "Non"}</button>
      <div id="pc-sess-wrap" class="${priv ? "" : "hidden"}" style="margin-top:12px">
        <div id="pc-sessions">${sess.map(sessRow).join("")}</div>
        <button type="button" id="pc-sess-add" class="ghost" style="margin-top:4px">+ Ajouter une séance</button>
      </div>
    </div>
    <div class="pc-sec"><h4>Notes</h4><textarea id="pc-notes" rows="2" style="width:100%">${esc(d["Notes"] || "")}</textarea></div>
    <div class="pc-actions"><button type="button" id="pc-save">Enregistrer le contrat</button><span id="pc-status" class="muted"></span></div>`;
  const bindSessRm = () => body.querySelectorAll(".pc-sess-rm").forEach((b) => { b.onclick = () => b.closest(".pc-sess-row").remove(); });
  bindSessRm();
  body.querySelectorAll(".pc-week.edit .pc-tog[data-k]").forEach((b) => b.addEventListener("click", () => {
    const n = b.dataset.v === "Oui" ? "Non" : "Oui"; b.dataset.v = n; b.className = "pc-tog " + (n === "Oui" ? "oui" : "non");
  }));
  $("pc-priv").addEventListener("click", () => {
    const n = $("pc-priv").dataset.v === "Oui" ? "Non" : "Oui";
    $("pc-priv").dataset.v = n; $("pc-priv").className = "pc-tog " + (n === "Oui" ? "oui" : "non"); $("pc-priv").textContent = n;
    $("pc-sess-wrap").classList.toggle("hidden", n !== "Oui");
  });
  $("pc-sess-add").addEventListener("click", () => { $("pc-sessions").insertAdjacentHTML("beforeend", sessRow("1h")); bindSessRm(); });
  const upd = () => { $("pc-monthly").value = pcMonthly({ "Annual fee": body.querySelector('[data-k="Annual fee"]').value, "Instalments": body.querySelector('[data-k="Instalments"]').value }); };
  body.querySelector('[data-k="Annual fee"]').addEventListener("input", upd);
  body.querySelector('[data-k="Instalments"]').addEventListener("input", upd);
  $("pc-save").addEventListener("click", savePersonContract);
}
async function savePersonContract() {
  const body = $("pc-body");
  const out = {};
  body.querySelectorAll("input[data-k],select[data-k]").forEach((i) => { out[i.dataset.k] = (i.value || "").trim(); });
  body.querySelectorAll(".pc-week.edit .pc-tog[data-k]").forEach((b) => { out[b.dataset.k] = b.dataset.v; });
  out["Private lessons?"] = $("pc-priv").dataset.v;
  out["Private sessions"] = out["Private lessons?"] === "Oui" ? [...body.querySelectorAll(".pc-sess")].map((s) => s.value) : [];
  out["Monthly fee"] = pcMonthly(out);
  out["Notes"] = $("pc-notes").value.trim();
  const cnt = (p) => PC_DAYS.filter(([k]) => out[k + " " + p] === "Oui").length;
  out["AM days/wk"] = String(cnt("AM")); out["PM days/wk"] = String(cnt("PM")); out["Lunches/wk"] = String(cnt("lunch"));
  const btn = $("pc-save"); btn.disabled = true; $("pc-status").textContent = "Enregistrement…";
  const { error } = await sb.from("player_contracts")
    .upsert({ person_id: pcPersonId, season_id: $("pc-season").value, data: out, updated_at: new Date().toISOString() }, { onConflict: "person_id,season_id" });
  btn.disabled = false;
  $("pc-status").textContent = error ? "Erreur : " + error.message : "✓ Enregistré";
  setTimeout(() => { if ($("pc-status")) $("pc-status").textContent = ""; }, 2000);
}
async function loadPeRemarks(youthId) {
  peYouthId = youthId;
  const { data } = await sb.from("etudes_remarks").select("*").eq("youth_person_id", youthId).order("created_at", { ascending: false });
  const rows = data || [];
  $("pe-rem-list").innerHTML = rows.length ? rows.map((r) => {
    const mine = r.created_by === meId;
    const edited = r.updated_at && r.updated_at !== r.created_at ? ' <span class="muted">(modifié)</span>' : "";
    return `<div class="obj-item" data-id="${r.id}"><div class="obj-meta"><b>${esc(r.prof_name || "—")}</b><span>${frDateTime(r.created_at)}${edited}</span></div>
      <div class="obj-body">${esc(r.body)}</div>
      ${mine ? `<div class="obj-acts"><button type="button" class="edit">Modifier</button><button type="button" class="del">Supprimer</button></div>` : ""}</div>`;
  }).join("") : '<p class="obj-empty">Aucune remarque.</p>';
  $("pe-rem-list").querySelectorAll(".edit").forEach((b) => b.addEventListener("click", () => peEditRemark(b.closest(".obj-item").dataset.id)));
  $("pe-rem-list").querySelectorAll(".del").forEach((b) => b.addEventListener("click", () => peDelRemark(b.closest(".obj-item").dataset.id)));
}
async function peAddRemark() {
  const body = $("pe-rem-body").value.trim();
  if (!peYouthId || !body) return;
  const { error } = await sb.from("etudes_remarks").insert({ youth_person_id: peYouthId, body, prof_name: meName, prof_person_id: myPersonId, created_by: meId });
  if (error) { alert(error.message); return; }
  $("pe-rem-body").value = "";
  loadPeRemarks(peYouthId);
}
async function peEditRemark(id) {
  const el = document.querySelector(`#pe-rem-list .obj-item[data-id="${id}"] .obj-body`);
  const next = await uiPrompt("Modifier la remarque :", el ? el.textContent : "");
  if (next === null) return;
  const body = next.trim(); if (!body) return;
  await sb.from("etudes_remarks").update({ body, updated_at: new Date().toISOString() }).eq("id", id);
  loadPeRemarks(peYouthId);
}
async function peDelRemark(id) {
  if (!await uiConfirm("Supprimer cette remarque ?")) return;
  await sb.from("etudes_remarks").delete().eq("id", id);
  loadPeRemarks(peYouthId);
}

// ===================================================================
//  Mental (préparation mentale)
// ===================================================================
const MENTAL_YOUTH_ROLES = ["sport-etudes", "pro", "pro-u18"];
const MN_FIELDS = [
  { k: "theme", h: "Thématique" },
  { k: "type", h: "Type", type: "short" },
  { k: "day", h: "Date", type: "date" },
  { k: "heure_debut", h: "Heure début", type: "short" },
  { k: "heure_fin", h: "Heure fin", type: "short" },
  { k: "objectifs", h: "Objectifs" },
  { k: "inputs", h: "Routines chaque semaine · Inputs (Fred)" },
  { k: "entrainement", h: "Entraînement (Mariano)" },
  { k: "partage", h: "Routines chaque semaine et partage (Fred)" },
  { k: "retour_calme", h: "Retour au calme (Fred)" },
];
let mnYouthId = null;

function initMental() {
  document.querySelectorAll("#view-mental .mn-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-mental .mn-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-mental .mn-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "mn-sub-" + b.dataset.sub));
      if (b.dataset.sub === "calendrier") loadMentalCalendar();
      if (b.dataset.sub === "participants") loadMentalParticipants();
    }));
  $("mn-season").addEventListener("change", loadMentalCalendar);
  $("mn-season2").addEventListener("change", loadMentalParticipants);
  $("mn-add-session").addEventListener("click", addMentalSession);
  $("mn-part-back").addEventListener("click", () => { $("mn-part-detail").classList.add("hidden"); $("mn-part-list").classList.remove("hidden"); });
}
function mnPopulateSeasons() {
  const cur = currentSeason("juniors")?.id;
  const opts = seasonsOf("juniors").map((s) => seasonOpt(s, cur)).join("") || '<option value="">— créez une saison juniors —</option>';
  if (!$("mn-season").options.length) $("mn-season").innerHTML = opts;
  if (!$("mn-season2").options.length) $("mn-season2").innerHTML = opts;
}

// ---- Calendrier (éditable) ----
async function loadMentalCalendar() {
  await loadSeasonsList();
  mnPopulateSeasons();
  const seasonId = $("mn-season").value, cont = $("mn-calendar");
  if (!seasonId) { cont.innerHTML = '<p class="muted" style="font-size:.85rem">Crée d\'abord une saison juniors (Réglages › Saisons).</p>'; return; }
  const { data } = await sb.from("mental_sessions").select("*").eq("season_id", seasonId).order("sort_order").order("day");
  const rows = data || [];
  let html = '<table class="crm-table mn-cal"><thead><tr>' + MN_FIELDS.map((f) => `<th>${f.h}</th>`).join("") + "<th></th></tr></thead><tbody>";
  for (const r of rows) {
    html += "<tr>" + MN_FIELDS.map((f) => {
      if (f.type === "date") return `<td><input type="date" class="mn-cell mn-date" data-id="${r.id}" data-field="day" value="${r.day || ""}" /></td>`;
      if (f.type === "num") return `<td><input type="number" class="mn-cell mn-num" data-id="${r.id}" data-field="session_no" value="${r.session_no ?? ""}" /></td>`;
      if (f.type === "short") return `<td><input type="text" class="mn-cell mn-short" data-id="${r.id}" data-field="${f.k}" value="${esc(r[f.k] || "")}" /></td>`;
      return `<td><textarea class="mn-cell mn-txt" data-id="${r.id}" data-field="${f.k}" rows="3">${esc(r[f.k] || "")}</textarea></td>`;
    }).join("") + `<td><button type="button" class="fam-del mn-del" data-id="${r.id}">✕</button></td></tr>`;
  }
  cont.innerHTML = rows.length ? html + "</tbody></table>" : '<p class="muted" style="font-size:.85rem">Aucune séance. Clique « + Ajouter une séance ».</p>';
  cont.querySelectorAll(".mn-cell").forEach((c) => c.addEventListener("change", () => saveMentalCell(c)));
  cont.querySelectorAll(".mn-del").forEach((b) => b.addEventListener("click", () => delMentalSession(b.dataset.id)));
}
async function saveMentalCell(cell) {
  const id = cell.dataset.id, field = cell.dataset.field;
  let value = cell.value;
  if (field === "session_no") value = value === "" ? null : Number(value);
  if (field === "day") value = value || null;
  const { error } = await sb.from("mental_sessions").update({ [field]: value }).eq("id", id);
  if (error) { alert(error.message); return; }
  cell.classList.add("mn-saved"); setTimeout(() => cell.classList.remove("mn-saved"), 700);
}
async function addMentalSession() {
  const seasonId = $("mn-season").value;
  if (!seasonId) { alert("Choisis une saison."); return; }
  const { data } = await sb.from("mental_sessions").select("sort_order,session_no").eq("season_id", seasonId).order("sort_order", { ascending: false }).limit(1);
  const last = data && data[0];
  const { error } = await sb.from("mental_sessions").insert({ season_id: seasonId, sort_order: (last?.sort_order || 0) + 1, session_no: (last?.session_no || 0) + 1 });
  if (error) { alert(error.message); return; }
  loadMentalCalendar();
}
async function delMentalSession(id) {
  if (!await uiConfirm("Supprimer cette séance ?")) return;
  const { error } = await sb.from("mental_sessions").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  loadMentalCalendar();
}

// ---- Participants ----
async function loadMentalParticipants() {
  await loadSeasonsList();
  mnPopulateSeasons();
  $("mn-part-detail").classList.add("hidden");
  $("mn-part-list").classList.remove("hidden");
  const seasonId = $("mn-season2").value, cont = $("mn-part-list");
  if (!seasonId) { cont.innerHTML = '<p class="muted" style="font-size:.85rem">Crée une saison juniors.</p>'; return; }
  const { data } = await sb.from("role_periods").select("person_id,role").eq("season_id", seasonId).in("role", MENTAL_YOUTH_ROLES);
  const ids = [...new Set((data || []).map((r) => r.person_id))];
  const youths = people.filter((p) => ids.includes(p.id)).sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
  if (!youths.length) { cont.innerHTML = '<p class="muted" style="font-size:.85rem">Aucun participant (sport-études / pro / pro U18) pour cette saison.</p>'; return; }
  const { data: cmts } = await sb.from("mental_comments").select("youth_person_id");
  const cnt = {}; for (const c of cmts || []) cnt[c.youth_person_id] = (cnt[c.youth_person_id] || 0) + 1;
  cont.innerHTML = '<table class="crm-table"><thead><tr><th>Jeune</th><th>Filière(s)</th><th>Commentaires</th></tr></thead><tbody>'
    + youths.map((y) => { const roles = (data || []).filter((r) => r.person_id === y.id).map((r) => roleLabel(r.role)).join(", "); return `<tr class="mn-part-row" data-id="${y.id}"><td><b>${esc(y.last_name)} ${esc(y.first_name)}</b></td><td>${esc(roles)}</td><td>${cnt[y.id] || 0}</td></tr>`; }).join("")
    + "</tbody></table>";
  cont.querySelectorAll(".mn-part-row").forEach((tr) => tr.addEventListener("click", () => openMentalParticipant(tr.dataset.id)));
}
function openMentalParticipant(yid) {
  const p = people.find((x) => x.id === yid);
  $("mn-part-name").textContent = p ? `${p.last_name} ${p.first_name}` : "—";
  loadMnComments(yid);
  $("mn-part-list").classList.add("hidden");
  $("mn-part-detail").classList.remove("hidden");
  window.scrollTo(0, 0);
}
function loadMnComments(yid) { mnYouthId = yid; youthNotes("mn-chan", yid); }

// ---- Commentaires mental (partagés participants / fiche) ----
async function renderMentalComments(youthId, listId, refresh) {
  if (!youthId) { $(listId).innerHTML = ""; return; }
  const { data } = await sb.from("mental_comments").select("*").eq("youth_person_id", youthId).order("created_at", { ascending: false });
  const rows = data || [];
  $(listId).innerHTML = rows.length ? rows.map((r) => {
    const mine = r.created_by === meId;
    const edited = r.updated_at && r.updated_at !== r.created_at ? ' <span class="muted">(modifié)</span>' : "";
    return `<div class="obj-item" data-id="${r.id}"><div class="obj-meta"><b>${esc(r.author_name || "—")}</b><span>${frDateTime(r.created_at)}${edited}</span></div>
      <div class="obj-body">${esc(r.body)}</div>
      ${mine ? `<div class="obj-acts"><button type="button" class="edit">Modifier</button><button type="button" class="del">Supprimer</button></div>` : ""}</div>`;
  }).join("") : '<p class="obj-empty">Aucun commentaire.</p>';
  $(listId).querySelectorAll(".edit").forEach((b) => b.addEventListener("click", () => mentalEditComment(b.closest(".obj-item").dataset.id, refresh)));
  $(listId).querySelectorAll(".del").forEach((b) => b.addEventListener("click", () => mentalDelComment(b.closest(".obj-item").dataset.id, refresh)));
}
async function mentalAddComment(youthId, bodyId, refresh) {
  const body = $(bodyId).value.trim();
  if (!youthId || !body) return;
  const { error } = await sb.from("mental_comments").insert({ youth_person_id: youthId, body, author_name: meName, author_person_id: myPersonId, created_by: meId });
  if (error) { alert(error.message); return; }
  $(bodyId).value = "";
  refresh();
}
async function mentalEditComment(id, refresh) {
  const el = document.querySelector(`.obj-item[data-id="${id}"] .obj-body`);
  const next = await uiPrompt("Modifier le commentaire :", el ? el.textContent : "");
  if (next === null) return;
  const body = next.trim(); if (!body) return;
  await sb.from("mental_comments").update({ body, updated_at: new Date().toISOString() }).eq("id", id);
  refresh();
}
async function mentalDelComment(id, refresh) {
  if (!await uiConfirm("Supprimer ce commentaire ?")) return;
  await sb.from("mental_comments").delete().eq("id", id);
  refresh();
}
// Onglet Mental de la fiche du jeune
let pmYouthId = null;
async function loadPersonMental(personId, byRole) {
  if (!personId) { $("pm-chan").innerHTML = ""; return; }
  pmYouthId = personId;
  showPersonTab("mental", byRole);
  channelBox("pm-chan", "mental_comments", personId);
}

// ===================================================================
//  Études (sport-études) — calendrier de présence + suivi par jeune
// ===================================================================
const ET_ORDER = ["", "present", "late", "absent", "not_planned"];
const etNext = (s) => ET_ORDER[(ET_ORDER.indexOf(s || "") + 1) % ET_ORDER.length];
const ET_CLS = { present: "st-present", late: "st-late", absent: "st-absent", not_planned: "st-locked", "": "st-none" };
const ET_LBL = { present: "P", late: "R", absent: "A", not_planned: "—", "": "" };
// Jour de la semaine (abréviation FR) à partir d'une date ISO 'YYYY-MM-DD'
const etDow = (iso) => ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][new Date(iso + "T00:00:00").getDay()];
let etYouthId = null;

function initEtudes() {
  // Gérer les profs, générer le calendrier et définir le planning d'un jeune = admin/superadmin.
  // Un prof ne fait que saisir les présences + le suivi.
  if (!hasAny(myAppRoles, ["superadmin", "admin"])) {
    document.querySelector('#view-etudes .et-subtab[data-sub="profs"]')?.classList.add("hidden");
    document.querySelector('#view-etudes .et-subtab[data-sub="reglages"]')?.classList.add("hidden");
    $("et-plan-card")?.classList.add("hidden");
  }
  document.querySelectorAll("#view-etudes .et-subtab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll("#view-etudes .et-subtab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("#view-etudes .et-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "et-sub-" + b.dataset.sub));
      if (b.dataset.sub === "calendrier") loadEtudesCalendar();
      if (b.dataset.sub === "jeunes") loadEtudesYouths();
      if (b.dataset.sub === "profs") loadEtudesProfs();
      if (b.dataset.sub === "reglages") loadEtudesReglages();
    }));
  $("et-season").addEventListener("change", loadEtudesCalendar);
  $("et-season2").addEventListener("change", loadEtudesYouths);
  $("et-youth-back").addEventListener("click", () => { $("et-youth-detail").classList.add("hidden"); $("et-youth-list").classList.remove("hidden"); });
  $("et-plan-apply").addEventListener("click", applyEtudesPlan);
  $("et-rg-generate").addEventListener("click", generateEtudesDays);
  $("et-rg-season").addEventListener("change", loadEtudesReglages);
  $("et-pf-season").addEventListener("change", loadEtudesProfs);
  $("et-pf-apply").addEventListener("click", () => assignEtudesProf(false));
  $("et-pf-remove").addEventListener("click", () => assignEtudesProf(true));
}

function etPopulateSeasons() {
  const cur = currentSeason("juniors")?.id;
  const opts = seasonsOf("juniors").map((s) => seasonOpt(s, cur)).join("") || '<option value="">— créez une saison juniors —</option>';
  // On force la valeur sur la saison en cours au 1er remplissage (sinon le calendrier
  // reste vide tant qu'on n'a pas re-sélectionné la saison à la main).
  ["et-season", "et-season2", "et-rg-season", "et-pf-season"].forEach((id) => {
    const el = $(id);
    if (el && !el.options.length) { el.innerHTML = opts; if (cur) el.value = cur; }
  });
}
async function etYouthsForSeason(seasonId) {
  if (!seasonId) return [];
  const { data } = await sb.from("role_periods").select("person_id").eq("season_id", seasonId).eq("role", "sport-etudes");
  const ids = new Set((data || []).map((r) => r.person_id));
  return people.filter((p) => ids.has(p.id)).sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
}

// ===================================================================
//  Messagerie (secrétaire/admin/superadmin) — boîte unifiée
//  Squelette : lit mail_messages (démo). IMAP (relève) + SMTP (envoi) à brancher.
// ===================================================================
const MAIL_STATUS = { a_traiter: ["À traiter", "ms-todo"], en_cours: ["Attribué", "ms-doing"], traite: ["Traité", "ms-done"] };
const MAIL_ORDER = ["a_traiter", "en_cours", "traite"];
const MAIL_DIRS = [["in", "Reçus"], ["out", "Envoyés"], ["", "Tous"]];
const MAIL_STAFF_ROLES = ["secretaire", "admin", "superadmin"];   // qui peut être attribué
let mailAccounts = [], mailMsgs = [], mailView = [], mailFilterAddr = "info@teamlausanne.ch", mailSelId = null;
let mailDir = "in", mailStatusF = "a_traiter", mailAssigneeF = "", mailMineF = false, mailDraftT = null;
let mailTournoiOnly = false;   // official : messagerie limitée à tournoi@teamlausanne.ch
const MAIL_TOURNOI = "tournoi@teamlausanne.ch";
const pName = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "?"; };
const pShort = (pid) => { const p = people.find((x) => x.id === pid); return p ? (p.first_name || p.last_name || "?") : "?"; };
function mailSyncCache(m) {
  const c = mailMsgs.find((x) => x.id === m.id); if (c && c !== m) Object.assign(c, m);
  const v = mailView.find((x) => x.id === m.id); if (v && v !== m) Object.assign(v, m);
}
const mailDT = (iso) => { const d = new Date(iso); return `${frDate(iso)} ${d.toTimeString().slice(0, 5)}`; };
const mailShort = (iso) => { const d = new Date(iso); return d.toDateString() === new Date().toDateString() ? d.toTimeString().slice(0, 5) : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`; };

let mailSearchT = null;
async function loadMail() {
  $("view-mail").classList.remove("mail-showdetail");  // (re)entree dans la messagerie : mobile = liste d'abord
  if (!$("mail-search").dataset.wired) {
    $("mail-search").dataset.wired = "1";
    $("mail-search").addEventListener("input", () => { clearTimeout(mailSearchT); mailSearchT = setTimeout(refreshMailView, 250); });
    $("mail-sync").addEventListener("click", mailSync);
    $("mail-history-btn").addEventListener("click", mailHistory);
    $("mail-importboxes-btn").addEventListener("click", mailImportBoxes);
    $("mail-new").addEventListener("click", openMailCompose);
    // (1) Barre de filtres repliable (mobile).
    $("mail-filters-toggle").addEventListener("click", () => {
      const open = $("view-mail").classList.toggle("mail-filters-open");
      $("mail-filters-toggle").setAttribute("aria-expanded", open ? "true" : "false");
      $("mail-filters-toggle").textContent = open ? "Filtres ▴" : "Filtres ▾";
    });
    // (2/3) Boutons flottants : nouveau message / répondre (saute à l'éditeur).
    $("mail-fab-new").addEventListener("click", openMailCompose);
    $("mail-fab-reply").addEventListener("click", () => { const ed = $("mail-d-replyhtml"); if (ed) { ed.scrollIntoView({ behavior: "smooth", block: "center" }); ed.focus(); } });
    mailPTRInit();  // tirer-pour-actualiser (mobile)
    $("mail-notif-btn").addEventListener("click", enableMailNotifs);  // notifs push
    // Rafraîchissement auto de la liste quand la messagerie est ouverte (le serveur relève
    // chaque minute) — ne touche pas au message ouvert ni à un brouillon en cours.
    setInterval(async () => {
      if ($("view-mail").classList.contains("hidden")) return;
      const { data: msgs } = await sb.from("mail_messages").select("*").order("received_at", { ascending: false }).limit(300);
      if (msgs) { mailMsgs = msgs; renderMailAccts(); refreshMailView(); }
    }, 60000);
    $("mailc-close").addEventListener("click", () => $("mailc-modal").classList.add("hidden"));
    $("mailc-modal").addEventListener("click", (e) => { if (e.target === $("mailc-modal")) $("mailc-modal").classList.add("hidden"); });
    $("mailc-send").addEventListener("click", mailComposeSend);
    document.querySelectorAll("#mailc-modal .rt-btn").forEach((b) => b.addEventListener("mousedown", (e) => { e.preventDefault(); document.execCommand(b.dataset.cmd, false, null); }));
    $("mailc-color").addEventListener("input", (e) => { document.execCommand("foreColor", false, e.target.value); $("mailc-body").focus(); });
    $("mailc-file").addEventListener("change", (e) => { for (const f of e.target.files) { if (f.size > 8 * 1024 * 1024) { alert(`${f.name} dépasse 8 Mo — trop lourd.`); continue; } mailcFiles.push(f); } e.target.value = ""; renderMailcFiles(); });
  }
  const [{ data: accts }, { data: msgs }] = await Promise.all([
    sb.from("mail_accounts").select("*").order("sort_order"),
    sb.from("mail_messages").select("*").order("received_at", { ascending: false }).limit(300),
  ]);
  mailAccounts = accts || [];
  mailMsgs = msgs || [];
  const isSuper = myAppRoles.includes("superadmin");
  $("mail-importboxes-btn").classList.toggle("hidden", !isSuper);
  $("mail-history-btn").classList.toggle("hidden", !isSuper);
  // Official (organisateur non-staff) : messagerie verrouillée sur tournoi@
  mailTournoiOnly = myAppRoles.includes("organisateur") && !hasAny(myAppRoles, MAIL_STAFF_ROLES);
  if (mailTournoiOnly) mailFilterAddr = MAIL_TOURNOI;
  renderMailAccts();
  renderMailToolbar();
  refreshMailView();
  refreshMailSub();  // notifs push : rafraîchit l'abonnement si déjà autorisé, met à jour le bouton
}
// Barre de filtres : Reçus/Envoyés/Tous, puis statuts (reçus/tous), puis personnes attribuées (en cours).
function renderMailToolbar() {
  $("mail-dir-btns").innerHTML = MAIL_DIRS.map(([v, l]) => `<button type="button" class="mail-fbtn${(!mailMineF && mailDir === v) ? " sel" : ""}" data-dir="${v}">${l}</button>`).join("");
  $("mail-dir-btns").querySelectorAll(".mail-fbtn").forEach((b) => b.addEventListener("click", () => { mailDir = b.dataset.dir; mailMineF = false; renderMailToolbar(); refreshMailView(); }));
  const showStatus = mailDir !== "out" || mailMineF;
  $("mail-status-btns").classList.toggle("hidden", !showStatus);
  if (showStatus) {
    // Compteurs bleus par statut, pour la boîte sélectionnée
    const stCount = { a_traiter: 0, en_cours: 0, traite: 0 };
    for (const m of mailMsgs) {
      if ((m.direction || "in") !== "in") continue;
      if (mailFilterAddr && m.account_address !== mailFilterAddr) continue;
      if (stCount[m.status] != null) stCount[m.status]++;
    }
    $("mail-status-btns").innerHTML = MAIL_ORDER.map((k) => `<button type="button" class="mail-fbtn ${MAIL_STATUS[k][1]}${(!mailMineF && mailStatusF === k) ? " sel" : ""}" data-st="${k}">${MAIL_STATUS[k][0]}${(stCount[k] && k !== "traite") ? ` <span class="mail-badge mail-badge-blue">${stCount[k]}</span>` : ""}</button>`).join("");
    $("mail-status-btns").querySelectorAll(".mail-fbtn").forEach((b) => b.addEventListener("click", () => { mailStatusF = b.dataset.st; mailMineF = false; if (mailStatusF !== "en_cours") mailAssigneeF = ""; renderMailToolbar(); refreshMailView(); }));
  }
  // Bouton « Attribué à moi » (sa propre ligne) : compteur bleu, TOUTES boîtes confondues
  if (myPersonId) {
    const nMine = mailMsgs.filter((m) => m.status === "en_cours" && m.assigned_user === myPersonId).length;
    $("mail-mine-wrap").innerHTML = `<button type="button" class="mail-fbtn mail-mine${mailMineF ? " sel" : ""}" id="mail-mine-btn">Attribué à moi${nMine ? ` <span class="mail-badge mail-badge-blue">${nMine}</span>` : ""}</button>`;
    $("mail-mine-btn").addEventListener("click", () => { mailMineF = !mailMineF; renderMailToolbar(); refreshMailView(); });
  } else { $("mail-mine-wrap").innerHTML = ""; }
  const showAssignee = !mailMineF && showStatus && mailStatusF === "en_cours";
  $("mail-assignee-btns").classList.toggle("hidden", !showAssignee);
  if (showAssignee) {
    const ids = [...new Set(mailMsgs.filter((m) => m.status === "en_cours" && m.assigned_user).map((m) => m.assigned_user))];
    $("mail-assignee-btns").innerHTML = `<span class="mail-fbtn-lbl">Attribué à :</span><button type="button" class="mail-fbtn${mailAssigneeF === "" ? " sel" : ""}" data-as="">Tous</button>`
      + ids.map((pid) => `<button type="button" class="mail-fbtn${mailAssigneeF === pid ? " sel" : ""}" data-as="${pid}">${esc(pShort(pid))}</button>`).join("");
    $("mail-assignee-btns").querySelectorAll(".mail-fbtn[data-as]").forEach((b) => b.addEventListener("click", () => { mailAssigneeF = b.dataset.as; mailMineF = false; renderMailToolbar(); refreshMailView(); }));
  } else { $("mail-assignee-btns").classList.add("hidden"); }
}
async function refreshMailView() {
  const q = ($("mail-search").value || "").trim();
  // « Attribué à moi » = reçus, statut attribué, assigné à moi (prioritaire sur les autres filtres).
  const mine = mailMineF && myPersonId;
  const dir = mine ? "in" : mailDir;
  const useStatus = dir !== "out";
  const status = mine ? "en_cours" : (useStatus ? mailStatusF : "");
  const assignee = mine ? myPersonId : (status === "en_cours" ? mailAssigneeF : "");
  const useAddr = mailFilterAddr && !mine;   // « attribué à moi » = toutes boîtes
  if (q.length >= 2) {
    const safe = q.replace(/[,()%*]/g, " ").trim();
    let query = sb.from("mail_messages").select("*").order("received_at", { ascending: false }).limit(150)
      .or(`subject.ilike.%${safe}%,from_name.ilike.%${safe}%,from_address.ilike.%${safe}%,to_address.ilike.%${safe}%,body_text.ilike.%${safe}%`);
    if (useAddr) query = query.eq("account_address", mailFilterAddr);
    if (dir) query = query.eq("direction", dir);
    if (status) query = query.eq("status", status);
    if (assignee) query = query.eq("assigned_user", assignee);
    const { data } = await query;
    mailView = data || [];
  } else {
    mailView = mailMsgs.filter((m) => {
      if (useAddr && m.account_address !== mailFilterAddr) return false;
      if (dir && (m.direction || "in") !== dir) return false;
      if (status && m.status !== status) return false;
      if (assignee && m.assigned_user !== assignee) return false;
      return true;
    });
  }
  renderMailList();
}
async function mailImportBoxes() {
  const boxes = ["tournoi@teamlausanne.ch", "info@lausanneopen.ch"];
  if (!await uiConfirm("Importer les 100 derniers mails de tournoi@teamlausanne.ch et info@lausanneopen.ch ? (IMAP doit être activé sur ces boîtes)")) return;
  const btn = $("mail-importboxes-btn"); btn.disabled = true;
  const results = [];
  try {
    for (const address of boxes) {
      btn.textContent = "Import " + address.split("@")[0] + "…";
      const { data, error } = await sb.functions.invoke("mail-import-box", { body: { address, limit: 100 } });
      if (error) {
        let m = error.message;
        try { const t = await error.context.text(); try { m = JSON.parse(t).error || t; } catch (_) { m = t || m; } } catch (_) {}
        results.push(`${address} : ${m}`);
      }
      else if (data?.error) results.push(`${address} : ${data.error}`);
      else results.push(`${address} : ${data?.inserted || 0} importé(s)`);
    }
    await loadMail();
    alert("Import terminé.\n" + results.join("\n"));
  } catch (e) { alert("Import impossible : " + (e?.message || e)); }
  btn.disabled = false; btn.textContent = "Importer autres boîtes";
}
async function mailHistory() {
  const btn = $("mail-history-btn");
  if (!await uiConfirm("Importer les mails des 6 derniers mois depuis Gmail dans la console ? (peut se faire en plusieurs passages)")) return;
  btn.disabled = true;
  let total = 0;
  try {
    for (let pass = 0; pass < 20; pass++) {
      btn.textContent = `Import… (${total})`;
      const { data, error } = await sb.functions.invoke("mail-history", { body: {} });
      if (error) { let m = error.message; try { m = (await error.context.json())?.error || m; } catch (_) {} alert("Import : " + m); break; }
      if (data?.error) { alert("Import : " + data.error); break; }
      total += data?.inserted || 0;
      if (!data || data.remaining <= 0 || (data.inserted || 0) === 0) break;
    }
    await loadMail();
    alert(`Import terminé — ${total} message(s) d'historique ajouté(s).`);
  } catch (e) { alert("Import impossible : " + (e?.message || e)); }
  btn.disabled = false; btn.textContent = "Importer 6 mois";
}
async function mailSync() {
  const btn = $("mail-sync");
  btn.disabled = true; btn.textContent = "Relève…";
  try {
    const { data, error } = await sb.functions.invoke("mail-fetch", { body: {} });
    if (error) {
      let m = error.message || String(error);
      try { m = (await error.context.json())?.error || m; } catch (_) {}
      alert("Relève impossible : " + m);
    } else if (data?.error) {
      alert("Relève : " + data.error);
    } else {
      await loadMail();
      if (typeof data?.inserted === "number") { $("mail-demo").textContent = `Relève OK — ${data.inserted} nouveau(x) message(s).`; }
    }
  } catch (e) { alert("Relève impossible : " + (e?.message || e)); }
  btn.disabled = false; btn.textContent = "Relever";
}
// ===================================================================
//  Notifications push (Web Push, clés VAPID) — nouveaux mails
// ===================================================================
const VAPID_PUBLIC = "BCpLuh4lwYJMJuef00hPlsKP84SPrKl9ljrSyZKTdh9Wpz5X5Il4A26J9lbxFOjk-GQxp67EQYvPCsK7NeIGINk";
function urlB64ToUint8(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
let mailSWReg = null;
async function ensureMailSW() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  if (!mailSWReg) {
    try {
      // Périmètre DÉDIÉ (/tlpush/) : registration séparée de celle de Mon espace (sw.js,
      // scope /) qui n'a PAS de gestionnaire push — sinon collision et notif jamais affichée.
      mailSWReg = await navigator.serviceWorker.register("sw-admin.js", { scope: "/tlpush/" });
      // Attendre que le worker soit prêt (sinon l'abonnement peut se lier à un worker sans push).
      for (let i = 0; i < 30 && !mailSWReg.active; i++) await new Promise((r) => setTimeout(r, 100));
    } catch (e) { console.warn("SW console:", e); return null; }
  }
  return mailSWReg;
}
async function saveSubscription(sub) {
  const j = sub.toJSON();
  const { data: sess } = await sb.auth.getSession();
  const uid = sess?.session?.user?.id; if (!uid) return;
  await sb.from("push_subscriptions").upsert(
    { user_id: uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, ua: navigator.userAgent },
    { onConflict: "endpoint" }
  );
}
function updateNotifBtn() {
  const btn = $("mail-notif-btn"); if (!btn) return;
  const lbl = $("mail-notif-lbl"); if (!lbl) return;  // on garde la cloche SVG, on ne change que le texte
  const ok = ("Notification" in window) && Notification.permission === "granted";
  const denied = ("Notification" in window) && Notification.permission === "denied";
  lbl.textContent = ok ? "Notifs activées" : denied ? "Notifs bloquées" : "Activer les notifs";
  btn.classList.toggle("on", ok);
  btn.classList.toggle("denied", denied);
}
async function enableMailNotifs() {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    uiAlert("Cet appareil/navigateur ne gère pas les notifications. Sur iPhone, ajoute d'abord la console à l'écran d'accueil (Partager → Sur l'écran d'accueil)."); return;
  }
  if (Notification.permission === "denied") {
    uiAlert("Les notifications sont bloquées pour ce site. Autorise-les dans les réglages du navigateur (icône du cadenas → Notifications), puis reviens ici."); return;
  }
  // IMPORTANT : demander la permission EN PREMIER, dans le geste du clic, AVANT tout await
  // (enregistrer le service worker d'abord ferait perdre le « geste utilisateur » et
  // Android/Chrome ignorerait la fenêtre → « non autorisé »).
  let perm = Notification.permission;
  if (perm !== "granted") { try { perm = await Notification.requestPermission(); } catch (_) {} }
  updateNotifBtn();
  if (perm !== "granted") {
    uiAlert(perm === "denied"
      ? "Tu as bloqué les notifications. Pour les activer : touche l'icône du cadenas (ou ⋮ → Infos du site) → Notifications → Autoriser, puis reclique ici."
      : "La demande a été fermée sans choisir. Reclique sur « Activer les notifs » et touche « Autoriser » dans la fenêtre qui apparaît.");
    return;
  }
  const reg = await ensureMailSW();
  if (!reg) { uiAlert("Notifications indisponibles sur cet appareil."); return; }
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) });
    await saveSubscription(sub);
    updateNotifBtn();
    // Notif LOCALE de test : prouve immédiatement que l'affichage marche (indépendant du transport push).
    try { await reg.showNotification("Notifications activées ✓", { body: "Tu recevras les nouveaux mails ici.", icon: "assets/pwa/admin-icon-192.png", badge: "assets/pwa/admin-badge.png?v=2", tag: "mail" }); } catch (_) {}
    uiAlert("✓ Notifications activées. Une notif de test vient de s'afficher — si tu ne la vois pas dans tes notifications, dis-le moi.");
  } catch (e) { uiAlert("Activation impossible : " + (e?.message || e)); }
}
// Au chargement de la messagerie : si l'autorisation est déjà donnée, on rafraîchit
// l'abonnement en base (les endpoints peuvent expirer/changer).
async function refreshMailSub() {
  updateNotifBtn();
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const reg = await ensureMailSW(); if (!reg) return;
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) });
    await saveSubscription(sub);
  } catch (e) { console.warn("push refresh:", e); }
}
// Tirer-pour-actualiser (mobile) : tirer la liste vers le bas depuis le haut relance la relève.
function mailPTRInit() {
  const ind = $("mail-ptr"); if (!ind || mailPTRInit.done) return;
  mailPTRInit.done = true;
  let startY = null, pulling = false, armed = false;
  const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
  const active = () => !$("view-mail").classList.contains("hidden")
    && !$("view-mail").classList.contains("mail-showdetail")
    && matchMedia("(max-width:820px)").matches;
  window.addEventListener("touchstart", (e) => {
    if (!active() || !atTop()) { pulling = false; return; }
    startY = e.touches[0].clientY; pulling = true; armed = false;
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { ind.style.height = "0"; armed = false; return; }
    ind.style.height = Math.min(dy * 0.5, 70) + "px";
    armed = dy > 90;
    ind.textContent = armed ? "↻ Relâche pour actualiser" : "↓ Tire pour actualiser";
  }, { passive: true });
  const end = () => {
    if (!pulling) return;
    pulling = false;
    if (armed) { ind.textContent = "↻ Actualisation…"; ind.style.height = "42px"; Promise.resolve(mailSync()).finally(() => { ind.style.height = "0"; }); }
    else ind.style.height = "0";
    armed = false; startY = null;
  };
  window.addEventListener("touchend", end);
  window.addEventListener("touchcancel", end);
}
// Affiche le corps du mail : HTML (dans une iframe cloisonnée, liens cliquables) sinon texte
function renderMailBodyEl(m) {
  const el = $("mail-d-body");
  if (m.body_html) {
    el.innerHTML = "";
    const f = document.createElement("iframe");
    f.className = "mail-html";
    f.setAttribute("sandbox", "allow-same-origin allow-popups allow-popups-to-escape-sandbox");
    el.appendChild(f);
    f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{font-family:system-ui,Arial,sans-serif;font-size:14px;color:#111;margin:0;word-wrap:break-word;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#123cc4}</style></head><body>${m.body_html}</body></html>`;
    f.addEventListener("load", () => { try { const h = f.contentDocument.body.scrollHeight; f.style.height = Math.min(1400, h + 24) + "px"; } catch (_) { f.style.height = "500px"; } });
  } else {
    el.innerHTML = mailLinkify(m.body_text || m.snippet || "");
  }
}
// Texte brut -> HTML sûr avec URLs cliquables
function mailLinkify(text) {
  return String(text).split(/(https?:\/\/[^\s<>()]+)/g)
    .map((p, i) => i % 2 ? `<a href="${esc(p)}" target="_blank" rel="noopener">${esc(p)}</a>` : esc(p).replace(/\n/g, "<br>"))
    .join("");
}
let mailFiles = [];
function mailWireCompose() {
  mailFiles = [];
  renderMailFiles();
  document.querySelectorAll("#mail-detail .rt-btn").forEach((b) => b.addEventListener("mousedown", (e) => {
    e.preventDefault();
    document.execCommand(b.dataset.cmd, false, null);
  }));
  $("mail-d-color").addEventListener("input", (e) => { document.execCommand("foreColor", false, e.target.value); $("mail-d-replyhtml").focus(); });
  $("mail-d-file").addEventListener("change", (e) => {
    for (const f of e.target.files) {
      if (f.size > 8 * 1024 * 1024) { alert(`${f.name} dépasse 8 Mo — trop lourd.`); continue; }
      mailFiles.push(f);
    }
    e.target.value = "";
    renderMailFiles();
  });
  $("mail-d-send").addEventListener("click", () => mailSendReply($("mail-d-send").dataset.mid));
  $("mail-d-send").dataset.mid = mailSelId;
  $("mail-d-suggest").addEventListener("click", mailSuggest);
}
const draftToHtml = (t) => "<p>" + esc(t).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
async function mailSuggest() {
  const id = $("mail-d-send").dataset.mid, st = $("mail-d-sendstatus");
  const btn = $("mail-d-suggest"), old = btn.textContent;
  btn.disabled = true; btn.textContent = "✨ Rédaction…"; st.textContent = "";
  try {
    const { data, error } = await sb.functions.invoke("mail-suggest", { body: { id } });
    if (error) { let m = error.message; try { m = (await error.context.json())?.error || m; } catch (_) {} st.textContent = "Suggestion : " + m; }
    else if (data?.error) { st.textContent = "Suggestion : " + data.error; }
    else if (data?.draft) { $("mail-d-replyhtml").innerHTML = draftToHtml(data.draft); $("mail-d-replyhtml").focus(); st.textContent = "Brouillon proposé — modifie-le ou envoie-le tel quel."; }
    else { st.textContent = "Pas de suggestion."; }
  } catch (e) { st.textContent = "Suggestion : " + (e?.message || e); }
  btn.disabled = false; btn.textContent = old;
}
function renderMailFiles() {
  const box = $("mail-d-files");
  if (!box) return;
  box.innerHTML = mailFiles.map((f, i) => `<span class="rt-file">📎 ${esc(f.name)} <button type="button" data-i="${i}" aria-label="Retirer">✕</button></span>`).join("");
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { mailFiles.splice(+b.dataset.i, 1); renderMailFiles(); }));
}
const fileToB64 = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = () => res(""); r.readAsDataURL(f); });

// ---- Nouveau message ----
let mailcFiles = [];
function openMailCompose() {
  const froms = mailTournoiOnly ? mailAccounts.filter((a) => a.address === MAIL_TOURNOI) : mailAccounts;
  const cur = mailTournoiOnly ? MAIL_TOURNOI : (mailFilterAddr || (mailAccounts[0]?.address) || "");
  $("mailc-from").innerHTML = froms.map((a) => `<option value="${esc(a.address)}">${esc(a.label)} — ${esc(a.address)}</option>`).join("");
  if (cur) $("mailc-from").value = cur;
  $("mailc-to").value = ""; $("mailc-subject").value = ""; $("mailc-body").innerHTML = ""; $("mailc-status").textContent = "";
  mailcFiles = []; renderMailcFiles();
  $("mailc-modal").classList.remove("hidden");
  setTimeout(() => $("mailc-to").focus(), 50);
}
function renderMailcFiles() {
  const box = $("mailc-files"); if (!box) return;
  box.innerHTML = mailcFiles.map((f, i) => `<span class="rt-file">📎 ${esc(f.name)} <button type="button" data-i="${i}" aria-label="Retirer">✕</button></span>`).join("");
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { mailcFiles.splice(+b.dataset.i, 1); renderMailcFiles(); }));
}
async function mailComposeSend() {
  const account = $("mailc-from").value, to = $("mailc-to").value.trim(), subject = $("mailc-subject").value.trim();
  const html = $("mailc-body").innerHTML.trim(), text = $("mailc-body").innerText.trim();
  const st = $("mailc-status");
  if (!to) { st.textContent = "Indique un destinataire."; return; }
  if (!text && !mailcFiles.length) { st.textContent = "Écris un message."; return; }
  const btn = $("mailc-send"); btn.disabled = true; st.textContent = "Envoi…";
  try {
    const attachments = [];
    for (const f of mailcFiles) attachments.push({ filename: f.name, contentType: f.type || "application/octet-stream", content: await fileToB64(f) });
    const { data, error } = await sb.functions.invoke("mail-send", { body: { account, to, subject, text, html: html || undefined, attachments } });
    if (error) { let m = error.message; try { m = (await error.context.json())?.error || m; } catch (_) {} st.textContent = "Échec : " + m; }
    else if (data?.error) { st.textContent = "Échec : " + data.error; }
    else { $("mailc-modal").classList.add("hidden"); await loadMail(); }
  } catch (e) { st.textContent = "Échec : " + (e?.message || e); }
  btn.disabled = false;
}

async function mailSendReply(id) {
  const editor = $("mail-d-replyhtml");
  const html = (editor.innerHTML || "").trim();
  const text = (editor.innerText || "").trim();
  const st = $("mail-d-sendstatus");
  if (!text && !mailFiles.length) { st.textContent = "Écris un message avant d'envoyer."; return; }
  const btn = $("mail-d-send"); btn.disabled = true; st.textContent = "Envoi…";
  try {
    const attachments = [];
    for (const f of mailFiles) attachments.push({ filename: f.name, contentType: f.type || "application/octet-stream", content: await fileToB64(f) });
    const { data, error } = await sb.functions.invoke("mail-send", { body: { id, text, html: html || undefined, attachments } });
    if (error) { let msg = error.message; try { msg = (await error.context.json())?.error || msg; } catch (_) {} st.textContent = "Échec : " + msg; }
    else if (data?.error) { st.textContent = "Échec : " + data.error; }
    else {
      // Le passage en « Traité » + le nom du traiteur sont poses cote serveur (mail-send).
      st.textContent = "✓ Réponse envoyée depuis " + (data?.name ? data.name + " <" + data.from + ">" : data?.from || "?") + ".";
      editor.innerHTML = ""; mailFiles = []; renderMailFiles();
      await sb.from("mail_drafts").delete().eq("mail_id", id);
      await loadMail();
    }
  } catch (e) { st.textContent = "Échec : " + (e?.message || e); }
  btn.disabled = false;
}
function renderMailAccts() {
  // Rond BLEU = à traiter + attribué ; rond ROUGE = non lus (par boîte).
  const unread = {}, active = {};
  for (const m of mailMsgs) {
    if ((m.direction || "in") !== "in") continue;
    const a = m.account_address;
    if (!m.is_read) unread[a] = (unread[a] || 0) + 1;
    if (m.status === "a_traiter" || m.status === "en_cours") active[a] = (active[a] || 0) + 1;
  }
  const totU = Object.values(unread).reduce((a, b) => a + b, 0);
  const totA = Object.values(active).reduce((a, b) => a + b, 0);
  const chip = (addr, label, nA, nU) => `<button type="button" class="mail-acct${mailFilterAddr === addr ? " sel" : ""}" data-addr="${esc(addr)}">${esc(label)}${nA ? ` <span class="mail-badge mail-badge-blue" title="À traiter + attribué">${nA}</span>` : ""}${nU ? ` <span class="mail-badge" title="Non lus">${nU}</span>` : ""}</button>`;
  const accts = mailTournoiOnly ? mailAccounts.filter((a) => a.address === MAIL_TOURNOI) : mailAccounts;
  $("mail-accts").innerHTML = accts.map((a) => chip(a.address, a.label, active[a.address] || 0, unread[a.address] || 0)).join("") + (mailTournoiOnly ? "" : chip("", "Toutes", totA, totU));
  $("mail-accts").querySelectorAll(".mail-acct").forEach((b) => b.addEventListener("click", () => { mailFilterAddr = b.dataset.addr; mailMineF = false; renderMailAccts(); renderMailToolbar(); refreshMailView(); }));
}
function mailStatTag(m) {
  const isOut = (m.direction || "in") === "out";
  if (isOut) return '<span class="mail-stat mail-sent">Envoyé</span>';
  if (m.status === "traite") return `<span class="mail-stat ms-done">Traité${m.treated_by ? " · " + esc(pShort(m.treated_by)) : ""}</span>`;
  if (m.status === "en_cours") return `<span class="mail-stat ms-doing">Attribué${m.assigned_user ? " · " + esc(pShort(m.assigned_user)) : ""}</span>`;
  const [slbl, scls] = MAIL_STATUS[m.status] || [m.status, "ms-todo"];
  return `<span class="mail-stat ${scls}">${slbl}</span>`;
}
function renderMailList() {
  const list = mailView;
  const acctLabel = (addr) => mailAccounts.find((a) => a.address === addr)?.label || addr;
  $("mail-list").innerHTML = list.length ? list.map((m) => {
    const isOut = (m.direction || "in") === "out";
    const who = isOut ? "À " + esc(m.to_address || "—") : esc(m.from_name || m.from_address || "—");
    return `<div class="mail-item${m.id === mailSelId ? " sel" : ""}${m.is_read ? "" : " unread"}" data-id="${m.id}">
      <div class="mail-item-top"><span class="mail-from">${isOut ? '<span class="mail-outico">↗</span> ' : ""}${who}</span><span class="mail-date">${mailShort(m.received_at)}</span></div>
      <div class="mail-subj">${esc(m.subject || "(sans objet)")}</div>
      <div class="mail-snip muted">${esc(m.snippet || "")}</div>
      <div class="mail-item-foot"><span class="mail-acctbadge">${esc(acctLabel(m.account_address))}</span>
        <span class="mail-foot-right">${mailStatTag(m)}
        <button type="button" class="mail-rdtoggle" data-id="${m.id}" title="${m.is_read ? "Marquer non lu" : "Marquer lu"}">${m.is_read ? "✉" : "✓"}</button></span></div>
      ${isOut ? "" : `<div class="mail-item-actions">
        ${m.status !== "traite" ? `<button type="button" class="mail-quick mail-q-treat" data-id="${m.id}">✓ Traité</button>` : ""}
        <button type="button" class="mail-quick mail-q-assign" data-id="${m.id}">Attribuer</button>
      </div>`}
    </div>`;
  }).join("") : '<p class="muted" style="padding:16px">Aucun message.</p>';
  $("mail-list").querySelectorAll(".mail-item").forEach((el) => el.addEventListener("click", () => openMail(el.dataset.id)));
  $("mail-list").querySelectorAll(".mail-rdtoggle").forEach((b) => b.addEventListener("click", async (e) => {
    e.stopPropagation();
    const id = b.dataset.id;
    const mm = mailView.find((x) => x.id === id) || mailMsgs.find((x) => x.id === id);
    const nv = mm ? !mm.is_read : false;
    if (mm) mm.is_read = nv;
    const cached = mailMsgs.find((x) => x.id === id); if (cached) cached.is_read = nv;
    await sb.from("mail_messages").update({ is_read: nv }).eq("id", id);
    renderMailAccts(); renderMailList();
  }));
  // (4) Actions rapides sans ouvrir le mail : Traité / Attribuer.
  const findMsg = (id) => mailView.find((x) => x.id === id) || mailMsgs.find((x) => x.id === id);
  $("mail-list").querySelectorAll(".mail-q-treat").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); const m = findMsg(b.dataset.id); if (m) mailQuickTreat(m); }));
  $("mail-list").querySelectorAll(".mail-q-assign").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); const m = findMsg(b.dataset.id); if (m) mailQuickAssign(m); }));
}
// Actions rapides depuis la liste (sans ouvrir le message).
async function mailQuickTreat(m) {
  const upd = { status: "traite", treated_by: myPersonId, treated_at: new Date().toISOString() };
  Object.assign(m, upd); mailSyncCache(m);
  await sb.from("mail_messages").update(upd).eq("id", m.id);
  renderMailAccts(); renderMailToolbar(); refreshMailView();
}
async function mailQuickAssign(m) {
  const res = await mailAssignPrompt(m);
  if (!res) return;
  const upd = { status: "en_cours", assigned_user: res.personId, comment: res.comment || null };
  Object.assign(m, upd); mailSyncCache(m);
  await sb.from("mail_messages").update(upd).eq("id", m.id);
  renderMailAccts(); renderMailToolbar(); refreshMailView();
}
async function openMail(id) {
  const m = mailView.find((x) => x.id === id) || mailMsgs.find((x) => x.id === id);
  if (!m) return;
  mailSelId = id;
  if (!m.is_read) { m.is_read = true; const c = mailMsgs.find((x) => x.id === id); if (c) c.is_read = true; renderMailAccts(); await sb.from("mail_messages").update({ is_read: true }).eq("id", id); }
  const isOut = (m.direction || "in") === "out";
  const staff = people.filter((p) => hasRoleIn(p.id, MAIL_STAFF_ROLES)).sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
  const acctLabel = mailAccounts.find((a) => a.address === m.account_address)?.label || m.account_address;
  let statusInfo = "";
  if (m.status === "en_cours") statusInfo = `Attribué${m.assigned_user ? " à <b>" + esc(pName(m.assigned_user)) + "</b>" : " · <span class=\"mail-warn\">à attribuer</span>"}${m.comment ? " · " + esc(m.comment) : ""}`;
  else if (m.status === "traite") statusInfo = m.treated_at ? `Traité le ${mailDT(m.treated_at)}` : "";
  const controls = isOut ? "" : `
    <div class="mail-d-controls">
      <button type="button" id="mail-d-unread" class="ghost mail-d-unread">Marquer non lu</button>
      <div class="mail-stbtns">${MAIL_ORDER.map((k) => `<button type="button" class="mail-fbtn ${MAIL_STATUS[k][1]}${m.status === k ? " sel" : ""}" data-st="${k}">${MAIL_STATUS[k][0]}</button>`).join("")}${m.status === "traite" && m.treated_by ? `<span class="mail-treatedby">✓ par ${esc(pName(m.treated_by))}</span>` : ""}</div>
      ${statusInfo ? `<div class="mail-statusinfo muted">${statusInfo}</div>` : ""}
    </div>`;
  const reply = isOut ? "" : `
    <div class="mail-d-reply">
      <div class="rt-toolbar">
        <button type="button" class="rt-btn" data-cmd="bold" title="Gras"><b>G</b></button>
        <button type="button" class="rt-btn" data-cmd="italic" title="Italique"><i>I</i></button>
        <button type="button" class="rt-btn" data-cmd="underline" title="Souligné"><u>S</u></button>
        <label class="rt-color" title="Couleur du texte">A<input type="color" id="mail-d-color" value="#000000" /></label>
        <label class="rt-attach" title="Joindre un fichier">📎 Joindre<input type="file" id="mail-d-file" multiple hidden /></label>
        <button type="button" id="mail-d-suggest" class="rt-suggest" title="Rédiger une réponse automatiquement">✨ Proposer une réponse</button>
      </div>
      <div id="mail-d-replyhtml" class="rt-edit" contenteditable="true" data-ph="Répondre à ${esc(m.from_address || "")}…"></div>
      <div id="mail-d-files" class="rt-files"></div>
      <div class="mail-d-reply-foot"><span class="muted" style="font-size:.8rem">Envoi depuis ${esc(m.account_address)}</span>
        <span id="mail-d-draft" class="mail-draft muted" style="font-size:.78rem"></span>
        <span class="spacer"></span>
        <button type="button" id="mail-d-send">Envoyer la réponse</button></div>
      <p id="mail-d-sendstatus" class="muted" style="font-size:.8rem;margin:6px 0 0"></p>
    </div>`;
  $("mail-detail").innerHTML = `
    <button type="button" id="mail-d-back" class="mail-d-back">← Retour à la liste</button>
    <div class="mail-d-head">
      <h3>${esc(m.subject || "(sans objet)")}</h3>
      <div class="mail-d-meta">${isOut ? "À " + esc(m.to_address || "") : "<b>" + esc(m.from_name || "") + "</b> &lt;" + esc(m.from_address || "") + "&gt;"} <span class="muted">· ${esc(acctLabel)} · ${mailDT(m.received_at)}</span></div>
    </div>
    ${controls}
    <div id="mail-d-atts" class="mail-d-atts"></div>
    <div class="mail-d-body" id="mail-d-body"></div>
    ${reply}`;
  renderMailBodyEl(m);
  loadMailAttachments(id);
  // Mobile : maitre-detail facon appli mail — on ouvre le message en plein ecran
  // (la liste + la barre de filtres sont masquees) avec un bouton retour.
  $("view-mail").classList.add("mail-showdetail");
  $("view-mail").classList.toggle("mail-canreply", !isOut);  // FAB « Répondre » seulement sur un mail entrant
  $("mail-d-back").addEventListener("click", mailBackToList);
  $("mail-detail").scrollTop = 0;
  window.scrollTo(0, 0);
  if (!isOut) {
    mailWireCompose();
    $("mail-detail").querySelectorAll(".mail-stbtns .mail-fbtn").forEach((b) => b.addEventListener("click", () => mailSetStatus(m, b.dataset.st)));
    $("mail-d-unread").addEventListener("click", async () => { m.is_read = false; mailSyncCache(m); await sb.from("mail_messages").update({ is_read: false }).eq("id", id); renderMailAccts(); refreshMailView(); });
    loadMailDraft(id);
  }
  renderMailList();
}
// Retour a la liste (mobile) : on ressort du plein ecran message.
function mailBackToList() {
  $("view-mail").classList.remove("mail-showdetail");
  window.scrollTo(0, 0);
}
// Popup d'attribution : choisir une personne (obligatoire) + commentaire (optionnel).
function mailAssignPrompt(m) {
  return new Promise((resolve) => {
    const staff = people.filter((p) => hasRoleIn(p.id, MAIL_STAFF_ROLES)).sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
    const ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="9.5" cy="7.5" r="3.3"/><path d="M18 8v6M15 11h6"/></svg>';
    const ov = document.createElement("div");
    ov.className = "ui-modal";
    ov.innerHTML = `<div class="ui-box mail-assign-box">
      <div class="ui-ico">${ico}</div>
      <p class="ui-msg">Attribuer ce message</p>
      <label class="ma-field">Attribué à
        <select id="ma-person"><option value="">— choisir une personne —</option>${staff.map((p) => `<option value="${p.id}"${m.assigned_user === p.id ? " selected" : ""}>${esc(p.last_name)} ${esc(p.first_name)}</option>`).join("")}</select></label>
      <label class="ma-field">Commentaire (optionnel)
        <input id="ma-comment" type="text" value="${esc(m.comment || "")}" placeholder="ex. à rappeler, urgent…" /></label>
      <p id="ma-err" class="ma-err" hidden>Choisis une personne pour pouvoir attribuer.</p>
      <div class="ui-actions"><button type="button" class="ui-btn ui-no">Annuler</button><button type="button" class="ui-btn ui-yes">Attribuer</button></div>
    </div>`;
    document.body.appendChild(ov);
    const done = (v) => { ov.remove(); resolve(v); };
    ov.querySelector(".ui-yes").addEventListener("click", () => {
      const pid = ov.querySelector("#ma-person").value;
      if (!pid) { ov.querySelector("#ma-err").hidden = false; return; }
      done({ personId: pid, comment: ov.querySelector("#ma-comment").value.trim() });
    });
    ov.querySelector(".ui-no").addEventListener("click", () => done(null));
    ov.addEventListener("click", (e) => { if (e.target === ov) done(null); });
    setTimeout(() => ov.querySelector("#ma-person").focus(), 30);
  });
}
async function mailSetStatus(m, st) {
  if (st === "en_cours") {                       // « Attribué » = popup, personne obligatoire
    const res = await mailAssignPrompt(m);
    if (!res) return;                            // annulé / personne non choisie → on ne change rien
    const upd = { status: "en_cours", assigned_user: res.personId, comment: res.comment || null };
    Object.assign(m, upd); mailSyncCache(m);
    await sb.from("mail_messages").update(upd).eq("id", m.id);
    openMail(m.id); renderMailToolbar(); refreshMailView();
    return;
  }
  const upd = { status: st };
  m.status = st;
  if (st === "traite") { upd.treated_by = myPersonId; upd.treated_at = new Date().toISOString(); m.treated_by = myPersonId; m.treated_at = upd.treated_at; }
  mailSyncCache(m);
  await sb.from("mail_messages").update(upd).eq("id", m.id);
  openMail(m.id);
  renderMailToolbar();
  refreshMailView();
}
async function loadMailDraft(id) {
  const ed = $("mail-d-replyhtml"); if (!ed) return;
  const ind = $("mail-d-draft");
  const { data } = await sb.from("mail_drafts").select("body_html").eq("mail_id", id).maybeSingle();
  if (data?.body_html && !ed.innerHTML.trim()) { ed.innerHTML = data.body_html; if (ind) ind.textContent = "📝 Brouillon repris"; }
  const saveNow = async () => {
    const html = ed.innerHTML.trim();
    if (html) { await sb.from("mail_drafts").upsert({ mail_id: id, body_html: html, updated_by: myPersonId, updated_at: new Date().toISOString() }, { onConflict: "mail_id" }); if (ind) ind.textContent = "✓ Brouillon enregistré"; }
    else { await sb.from("mail_drafts").delete().eq("mail_id", id); if (ind) ind.textContent = ""; }
  };
  ed.addEventListener("input", () => { if (ind) ind.textContent = "Enregistrement…"; clearTimeout(mailDraftT); mailDraftT = setTimeout(saveNow, 700); });
  ed.addEventListener("blur", () => { clearTimeout(mailDraftT); saveNow(); });   // sauvegarde aussi en quittant le champ
}
async function loadMailAttachments(id) {
  const box = $("mail-d-atts"); if (!box) return;
  box.innerHTML = "";
  const { data } = await sb.from("mail_attachments").select("filename,content_type,size_bytes,content_b64").eq("mail_id", id).eq("is_inline", false);
  const atts = (data || []).filter((a) => a.content_b64);
  if (!atts.length) return;
  box.innerHTML = `<div class="mail-atts">${atts.map((a) => {
    const kb = Math.max(1, Math.round((a.size_bytes || 0) / 1024));
    const href = `data:${a.content_type || "application/octet-stream"};base64,${a.content_b64}`;
    return `<a class="mail-att" href="${href}" download="${esc(a.filename || "fichier")}">📎 ${esc(a.filename || "fichier")} <span class="muted">(${kb} Ko)</span></a>`;
  }).join("")}</div>`;
}

// ===================================================================
//  Anniversaires (secrétaire/admin/superadmin/head coach)
//  Fenêtre : aujourd'hui −7 j → +21 j. Tout le monde sauf membres/clients.
// ===================================================================
const BDAY_EXCLUDE = ["membre", "client"];
// Rôles mis en évidence dans la liste (les « importants » de l'académie)
const BDAY_HIGHLIGHT = ["pro", "pro-u18", "sport-etudes", "competition", "performance", "coach", "head-coach", "prof", "admin", "superadmin"];
async function loadBirthdays() {
  const body = $("bday-body");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 7);
  const end = new Date(today); end.setDate(end.getDate() + 21);
  const startIso = isoA(start), endIso = isoA(end), todayIso = isoA(today);
  // Cours dans la fenêtre → qui a un cours quel jour (participants + coachs)
  const { data: courses } = await sb.from("courses").select("id,course_date").gte("course_date", startIso).lte("course_date", endIso);
  const cids = (courses || []).map((c) => c.id);
  let parts = [], coaches = [];
  if (cids.length) {
    [parts, coaches] = await Promise.all([
      sb.from("course_participants").select("course_id,child_person_id").in("course_id", cids).then((r) => r.data || []),
      sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", cids).then((r) => r.data || []),
    ]);
  }
  const cDate = {}; for (const c of courses || []) cDate[c.id] = c.course_date;
  const byDate = {};
  const addC = (cid, pid) => { const d = cDate[cid]; if (d) (byDate[d] = byDate[d] || new Set()).add(pid); };
  for (const x of parts) addC(x.course_id, x.child_person_id);
  for (const x of coaches) addC(x.course_id, x.coach_person_id);
  // Personnes éligibles (au moins un rôle ≠ membre/client) avec une date de naissance
  const qualifies = (id) => (peopleRoles[id] || []).some((r) => !BDAY_EXCLUDE.includes(r));
  const mdMap = {};
  for (const p of people) {
    if (!p.birthdate || !qualifies(p.id)) continue;
    const md = p.birthdate.slice(5, 10);
    (mdMap[md] = mdMap[md] || []).push(p);
  }
  // Parcours des 29 jours de la fenêtre (gère le passage d'année)
  const isHl = (id) => (peopleRoles[id] || []).some((r) => BDAY_HIGHLIGHT.includes(r));
  const rows = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = isoA(d), md = iso.slice(5, 10);
    for (const p of (mdMap[md] || [])) {
      rows.push({ iso, p, age: d.getFullYear() - Number(p.birthdate.slice(0, 4)), hasCourse: byDate[iso]?.has(p.id) || false, isToday: iso === todayIso, hl: isHl(p.id) });
    }
  }
  if (!rows.length) { body.innerHTML = '<p class="muted" style="font-size:.85rem">Aucun anniversaire dans la période.</p>'; return; }
  body.innerHTML = `<div class="tbl-wrap"><table class="crm-table bday-table">
    <thead><tr><th>Date</th><th>Nom</th><th>Prénom</th><th>Âge</th><th>Cours ce jour</th></tr></thead>
    <tbody>${rows.map((r) => `<tr class="${r.hl ? "bday-hl" : ""}${r.isToday ? " bday-today" : ""}">
      <td><b>${etDow(r.iso)}</b> ${frDate(r.iso)}${r.isToday ? ' <span class="bday-tag">aujourd\'hui</span>' : ""}</td>
      <td><b>${esc(r.p.last_name)}</b></td><td>${esc(r.p.first_name)}</td>
      <td>${r.age} ans</td>
      <td class="bday-c">${r.hasCourse ? "✔" : "—"}</td></tr>`).join("")}</tbody></table></div>`;
}

// ===================================================================
//  CSEL (admin/superadmin) : planning hebdomadaire à donner au CSEL.
//  Repas = contrat du jeune (player_contracts.data « <Jour> lunch ») + coachs,
//  avec exceptions par semaine (csel_meal_overrides). Études = lecture seule.
//  Export PDF = fenêtre d'impression avec le logo Academy.
// ===================================================================
const CSEL_ROLES = ["sport-etudes", "pro", "pro-u18"];
const CSEL_ROLE_LBL = { "sport-etudes": "Sport-études", "pro": "Pro", "pro-u18": "Pro U18" };
let cselSub = "repas", cselMonday = null, cselDefaults = {};

const cselMondayOf = (iso) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoA(d); };
function cselWeekDates() { return PC_DAYS.map((_, i) => { const d = new Date(cselMonday + "T00:00:00"); d.setDate(d.getDate() + i); return isoA(d); }); }
function cselSeasonId() {
  const list = seasonsOf("juniors");
  return (list.find((s) => s.start_date <= cselMonday && cselMonday <= s.end_date) || currentSeason("juniors") || {}).id || null;
}

async function loadCsel() {
  await loadSeasonsList();
  if (!cselMonday) cselMonday = cselMondayOf(isoA(new Date()));
  const wk = $("csel-week");
  if (!wk.dataset.wired) {
    wk.dataset.wired = "1";
    wk.addEventListener("change", () => { cselMonday = cselMondayOf(wk.value || isoA(new Date())); renderCsel(); });
    $("csel-prev").addEventListener("click", () => cselShift(-7));
    $("csel-next").addEventListener("click", () => cselShift(7));
    $("csel-reset").addEventListener("click", cselReset);
    $("csel-pdf").addEventListener("click", cselExportPdf);
    document.querySelectorAll("#view-csel .csel-subtab").forEach((b) => b.addEventListener("click", () => {
      cselSub = b.dataset.sub;
      document.querySelectorAll("#view-csel .csel-subtab").forEach((x) => x.classList.toggle("active", x === b));
      $("csel-sub-repas").classList.toggle("hidden", cselSub !== "repas");
      $("csel-sub-etudes").classList.toggle("hidden", cselSub !== "etudes");
      $("csel-reset").classList.toggle("hidden", cselSub !== "repas");
      renderCsel();
    }));
  }
  renderCsel();
}
function cselShift(days) { const d = new Date(cselMonday + "T00:00:00"); d.setDate(d.getDate() + days); cselMonday = isoA(d); renderCsel(); }
function renderCsel() {
  $("csel-week").value = cselMonday;
  const dates = cselWeekDates();
  $("csel-range").textContent = `Semaine du ${frDate(dates[0])} au ${frDate(dates[4])}`;
  if (cselSub === "repas") renderCselRepas(dates); else renderCselEtudes(dates);
}

async function renderCselRepas(dates) {
  const body = $("csel-repas-body");
  const seasonId = cselSeasonId();
  if (!seasonId) { body.innerHTML = '<p class="muted" style="font-size:.85rem">Aucune saison juniors pour cette semaine.</p>'; return; }
  const { data: rps } = await sb.from("role_periods").select("person_id,role").eq("season_id", seasonId).in("role", CSEL_ROLES);
  const roleByPerson = {};
  for (const r of rps || []) (roleByPerson[r.person_id] = roleByPerson[r.person_id] || []).push(r.role);
  const ids = [...new Set((rps || []).map((r) => r.person_id))];
  const youths = ids.map((id) => people.find((p) => p.id === id)).filter(Boolean).sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
  const [cRes, oRes, dRes] = await Promise.all([
    ids.length ? sb.from("player_contracts").select("person_id,data").eq("season_id", seasonId).in("person_id", ids) : Promise.resolve({ data: [] }),
    sb.from("csel_meal_overrides").select("person_id,dow,present").eq("week_start", cselMonday),
    sb.from("coach_meal_defaults").select("person_id,dow"),
  ]);
  const contractData = {};
  for (const c of cRes.data || []) contractData[c.person_id] = c.data || {};
  const ovrMap = {};
  for (const o of oRes.data || []) (ovrMap[o.person_id] = ovrMap[o.person_id] || {})[o.dow] = o.present;
  const cmd = {}; // coach -> Set(dow) : repas déclarés par le coach lui-même
  for (const r of dRes.data || []) (cmd[r.person_id] = cmd[r.person_id] || new Set()).add(r.dow);
  // Coachs affichés = uniquement ceux qui ont déclaré au moins un repas
  const coaches = Object.keys(cmd).map((id) => people.find((p) => p.id === id)).filter(Boolean).sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
  cselDefaults = {};
  const totals = [0, 0, 0, 0, 0];
  const rowHtml = (p, isCoach) => {
    const def = isCoach
      ? PC_DAYS.map((_, i) => cmd[p.id]?.has(i + 1) || false)
      : PC_DAYS.map(([k]) => contractData[p.id]?.[k + " lunch"] === "Oui");
    cselDefaults[p.id] = def;
    let cnt = 0;
    const cells = def.map((dflt, i) => {
      const dow = i + 1, ov = ovrMap[p.id]?.[dow];
      const on = ov === undefined ? dflt : ov;
      if (on) { totals[i]++; cnt++; }
      return `<td class="csel-c ${on ? "csel-yes" : "csel-no"}" data-p="${p.id}" data-dow="${dow}" title="Cliquer pour changer">${on ? "✔" : "—"}</td>`;
    }).join("");
    const sub = isCoach ? "Coach" : (roleByPerson[p.id] || []).map((r) => CSEL_ROLE_LBL[r] || r).join(", ");
    return `<tr><td><b>${esc(p.last_name)} ${esc(p.first_name)}</b></td><td class="muted">${esc(sub)}</td>${cells}<td class="csel-c"><b>${cnt}</b></td></tr>`;
  };
  const youthRows = youths.map((y) => rowHtml(y, false)).join("");
  const coachRows = coaches.map((c) => rowHtml(c, true)).join("");
  const sep = (l) => `<tr class="csel-sep"><td colspan="8">${l}</td></tr>`;
  const foot = `<tr class="csel-tot"><td><b>Total / jour</b></td><td></td>${totals.map((t) => `<td class="csel-c"><b>${t}</b></td>`).join("")}<td class="csel-c"><b>${totals.reduce((a, b) => a + b, 0)}</b></td></tr>`;
  body.innerHTML = (!youths.length && !coaches.length) ? '<p class="muted" style="font-size:.85rem">Aucun jeune sport-études / pro pour cette saison.</p>'
    : `<div class="tbl-wrap"><table class="crm-table csel-table">
    <thead><tr><th>Nom</th><th>Filière</th>${PC_DAYS.map(([, l], i) => `<th>${l}<br><span class="csel-dh">${dates[i].slice(8, 10)}.${dates[i].slice(5, 7)}</span></th>`).join("")}<th>Sem.</th></tr></thead>
    <tbody>${youthRows ? sep("Jeunes") + youthRows : ""}${coachRows ? sep("Coachs / staff") + coachRows : ""}</tbody>
    <tfoot>${foot}</tfoot></table></div>`;
  body.querySelectorAll(".csel-c[data-p]").forEach((c) => c.addEventListener("click", () => cselToggle(c)));
}

async function cselToggle(cell) {
  const pid = cell.dataset.p, dow = Number(cell.dataset.dow);
  const def = cselDefaults[pid]?.[dow - 1] || false;
  const next = !cell.classList.contains("csel-yes");
  if (next === def) {
    await sb.from("csel_meal_overrides").delete().eq("week_start", cselMonday).eq("person_id", pid).eq("dow", dow);
  } else {
    await sb.from("csel_meal_overrides").upsert({ week_start: cselMonday, person_id: pid, dow, present: next, marked_by: meId }, { onConflict: "week_start,person_id,dow" });
  }
  renderCselRepas(cselWeekDates());
}
async function cselReset() {
  if (!await uiConfirm("Réinitialiser cette semaine selon les contrats ? (efface les modifications faites pour cette semaine)")) return;
  await sb.from("csel_meal_overrides").delete().eq("week_start", cselMonday);
  renderCselRepas(cselWeekDates());
}

async function renderCselEtudes(dates) {
  const body = $("csel-etudes-body");
  const seasonId = cselSeasonId();
  if (!seasonId) { body.innerHTML = '<p class="muted" style="font-size:.85rem">Aucune saison juniors pour cette semaine.</p>'; return; }
  const { data: days } = await sb.from("etudes_days").select("id,day").eq("season_id", seasonId).gte("day", dates[0]).lte("day", dates[4]).order("day");
  if (!days || !days.length) { body.innerHTML = '<p class="muted" style="font-size:.85rem">Pas d\'études cette semaine.</p>'; return; }
  const dayIds = days.map((d) => d.id);
  const [pRes, att, youths] = await Promise.all([
    sb.from("etudes_day_profs").select("day_id,prof_person_id").in("day_id", dayIds),
    fetchAllEtudesAtt(dayIds, "day_id,youth_person_id,status"),
    etYouthsForSeason(seasonId),
  ]);
  const firstOf = (id) => people.find((x) => x.id === id)?.first_name || "?";
  const rows = days.map((d) => {
    const profs = (pRes.data || []).filter((x) => x.day_id === d.id).map((x) => firstOf(x.prof_person_id)).join(", ") || "—";
    const notPlanned = new Set(att.filter((a) => a.day_id === d.id && a.status === "not_planned").map((a) => a.youth_person_id));
    const present = youths.filter((y) => !notPlanned.has(y.id));
    const list = present.map((y) => `${y.last_name} ${y.first_name}`).join(", ") || "—";
    return `<tr><td><b>${etDow(d.day)}</b> ${frDate(d.day)}</td><td>${esc(profs)}</td><td class="csel-c">${present.length}</td><td>${esc(list)}</td></tr>`;
  }).join("");
  body.innerHTML = `<div class="tbl-wrap"><table class="crm-table csel-et-table">
    <thead><tr><th>Jour</th><th>Prof(s)</th><th>Nb</th><th>Élèves prévus</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function cselExportPdf() {
  const dates = cselWeekDates();
  const title = cselSub === "repas" ? "Repas de midi" : "Études";
  const table = (cselSub === "repas" ? $("csel-repas-body") : $("csel-etudes-body")).querySelector("table");
  if (!table) { alert("Rien à exporter pour cette semaine."); return; }
  const logo = new URL("assets/logo-academie.webp", location.href).href;
  const w = window.open("", "_blank");
  if (!w) { alert("Autorise les pop-ups pour l'export PDF."); return; }
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>CSEL — ${title}</title>
    <style>
      body{font-family:system-ui,Arial,sans-serif;color:#111;margin:22px}
      .h{display:flex;align-items:center;gap:16px;margin-bottom:16px;border-bottom:2px solid #123cc4;padding-bottom:10px}
      .h img{height:56px}.h h1{margin:0;font-size:1.25rem;color:#123cc4}.h p{margin:3px 0 0;color:#555;font-size:.88rem}
      table{border-collapse:collapse;width:100%;font-size:.8rem}
      th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
      th{background:#f0f3fb}
      .csel-c{text-align:center}
      .csel-yes{color:#137a37;font-weight:700}.csel-no{color:#bbb}
      .csel-dh{font-weight:400;font-size:.7rem;color:#888}
      .csel-sep td{background:#eef1f7;font-weight:700}
      .csel-tot td{background:#f0f3fb;font-weight:700}
      @page{size:landscape;margin:11mm}
    </style></head><body>
    <div class="h"><img src="${logo}" alt=""><div><h1>CSEL — ${title}</h1><p>Semaine du ${frDate(dates[0])} au ${frDate(dates[4])} · Team Lausanne Academy</p></div></div>
    ${table.outerHTML}
    <scr` + `ipt>window.onload=function(){setTimeout(function(){window.print();},250);};</scr` + `ipt>
    </body></html>`);
  w.document.close();
}

// ---- Fiche coach › sous-onglet Repas : jours de repas au CSEL (rempli par le staff) ----
async function loadPersonMeals(personId, show) {
  const mount = $("pr-days"), status = $("pr-status");
  if (status) status.textContent = "";
  if (!mount) return;
  if (!show || !personId) { mount.innerHTML = ""; mount.dataset.pid = ""; return; }
  mount.dataset.pid = personId;
  const { data } = await sb.from("coach_meal_defaults").select("dow").eq("person_id", personId);
  const set = new Set((data || []).map((r) => r.dow));
  mount.innerHTML = PC_DAYS.map(([, l], i) => `<button type="button" class="mr-day ${set.has(i + 1) ? "on" : ""}" data-dow="${i + 1}">${l}</button>`).join("");
  mount.querySelectorAll(".mr-day").forEach((b) => b.addEventListener("click", () => prMealToggle(b)));
}
async function prMealToggle(btn) {
  const personId = $("pr-days").dataset.pid;
  if (!personId) return;
  const dow = Number(btn.dataset.dow), on = btn.classList.contains("on");
  const { error } = on
    ? await sb.from("coach_meal_defaults").delete().eq("person_id", personId).eq("dow", dow)
    : await sb.from("coach_meal_defaults").upsert({ person_id: personId, dow }, { onConflict: "person_id,dow" });
  if (error) { $("pr-status").textContent = "Erreur : " + error.message; return; }
  btn.classList.toggle("on");
  $("pr-status").textContent = "✓ Enregistré.";
}

// ---- Sous-onglet Calendrier ----
// Lecture paginée des présences (Supabase plafonne à 1000 lignes/requête ;
// une saison de sport-études dépasse ce seuil → sinon des jeunes restent « vides »).
async function fetchAllEtudesAtt(dayIds, cols = "*") {
  const all = [], PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from("etudes_attendance").select(cols).in("day_id", dayIds).range(from, from + PAGE - 1);
    if (error || !data || !data.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}
async function loadEtudesCalendar() {
  await loadSeasonsList();
  etPopulateSeasons();
  const seasonId = $("et-season").value;
  const cont = $("et-calendar");
  if (!seasonId) { cont.innerHTML = '<p class="muted" style="font-size:.85rem">Crée d\'abord une saison juniors (Réglages › Saisons).</p>'; return; }
  const youths = await etYouthsForSeason(seasonId);
  const { data: days } = await sb.from("etudes_days").select("*").eq("season_id", seasonId).order("day");
  const dayIds = (days || []).map((d) => d.id);
  let profs = [], att = [], etvals = [];
  if (dayIds.length) {
    [profs, att, etvals] = await Promise.all([
      sb.from("etudes_day_profs").select("*").in("day_id", dayIds).then((r) => r.data || []),
      fetchAllEtudesAtt(dayIds),
      sb.from("etudes_day_validation").select("*").in("day_id", dayIds).then((r) => r.data || []),
    ]);
  }
  const attOf = (dayId, yid) => att.find((a) => a.day_id === dayId && a.youth_person_id === yid)?.status || "";
  // Colonnes triées : jeunes qui viennent le plus souvent d'abord (moins de « pas prévu »), puis prénom.
  const npCount = {};
  for (const a of att) if (a.status === "not_planned") npCount[a.youth_person_id] = (npCount[a.youth_person_id] || 0) + 1;
  const nDays = (days || []).length;
  youths.sort((a, b) => {
    const sched = (nDays - (npCount[b.id] || 0)) - (nDays - (npCount[a.id] || 0));
    return sched !== 0 ? sched : (a.first_name || "").localeCompare(b.first_name || "");
  });
  const profOptions = people.filter((p) => hasRoleIn(p.id, ["prof"]));
  const canEditProfs = hasAny(myAppRoles, ["superadmin", "admin"]); // admin : saisie possible à tout moment
  if (!(days || []).length) { cont.innerHTML = '<p class="muted" style="font-size:.85rem">Aucun jour dans le calendrier pour cette saison.</p>'; return; }
  if (!youths.length) { cont.innerHTML = '<p class="muted" style="font-size:.85rem">Aucun jeune en sport-études pour cette saison (à définir dans les fiches › Saisons).</p>'; return; }
  const nmF = (id) => people.find((x) => x.id === id)?.first_name || "?";
  let html = '<table class="crm-table et-cal"><thead><tr><th>Date &amp; prof(s)</th>'
    + youths.map((y) => `<th title="${esc(y.first_name)} ${esc(y.last_name)}">${esc(y.first_name)} ${esc((y.last_name || "").slice(0, 1))}.</th>`).join("") + "</tr></thead><tbody>";
  const nowLocal = new Date();
  for (const d of days) {
    const dp = profs.filter((p) => p.day_id === d.id);
    const iAmProf = myPersonId && dp.some((p) => p.prof_person_id === myPersonId);
    // Saisie ouverte pour un prof seulement les jours où il est ASSIGNÉ et à partir de 12h50 ; admin = toujours.
    const timeOk = nowLocal >= new Date(d.day + "T12:50:00");
    const dayOpen = canEditProfs || (iAmProf && timeOk);
    const notMine = !canEditProfs && !iAmProf; // prof : jour qui ne lui est pas attribué → ligne grisée
    const myV = iAmProf ? etvals.find((v) => v.day_id === d.id && v.prof_person_id === myPersonId) : null;
    const mySt = myV?.status || "";
    const presCls = mySt === "present" ? "st-present" : mySt === "absent" ? "st-absent" : "st-none";
    const mine = canEditProfs || iAmProf; // c'est mon jour (ou admin)
    // Prof(s) du jour sous la date ; le mien = ma présence, cliquable (blanc→absent→présent), encadré bleu.
    const dprofs = dp.map((pp) => pp.prof_person_id === myPersonId
      ? `<button type="button" class="att-chip et-presence ${presCls}" data-day="${d.id}" data-date="${d.day}" data-status="${mySt}">${esc(nmF(pp.prof_person_id))}${mySt === "present" ? ` ${myV.hours ?? 4}h` : ""}</button>`
      : `<span class="et-dprof">${esc(nmF(pp.prof_person_id))}</span>`).join(" ") || '<span class="et-dprof muted">— prof —</span>';
    html += `<tr class="${notMine ? "et-notmine" : ""}"><td class="et-datecell"><div><b>${etDow(d.day)}</b> ${frDate(d.day)}</div><div class="et-dprofs">${dprofs}</div></td>`
      + youths.map((y) => { const s = attOf(d.id, y.id); const lk = !dayOpen; const due = s !== "not_planned"; const lockTitle = notMine ? "Vous ne pouvez pas valider les présences d'un jour qui ne vous est pas attribué" : "Vous ne pouvez pas valider les présences avant 12h50"; return `<td><button type="button" class="att-chip et-cell ${due ? (mine ? "et-due " : "et-due-lock ") : ""}${lk ? "st-locked" : ET_CLS[s]}" ${lk ? `data-locked="1" data-lockmsg="${esc(lockTitle)}"` : ""} data-day="${d.id}" data-youth="${y.id}" data-status="${s}">${ET_LBL[s]}</button></td>`; }).join("")
      + "</tr>";
  }
  cont.innerHTML = html + "</tbody></table>";
  cont.querySelectorAll(".et-cell").forEach((c) => c.addEventListener("click", () => {
    if (c.dataset.locked) { uiAlert(c.dataset.lockmsg || "Saisie non disponible pour ce jour."); return; }
    etCycle(c);
  }));
  cont.querySelectorAll(".et-presence").forEach((b) => b.addEventListener("click", () => etProfPresence(b)));
  cont.querySelectorAll(".et-prof-rm").forEach((b) => b.addEventListener("click", async () => { await sb.from("etudes_day_profs").delete().eq("day_id", b.dataset.day).eq("prof_person_id", b.dataset.prof); loadEtudesCalendar(); }));
  cont.querySelectorAll(".et-prof-add").forEach((s) => s.addEventListener("change", async () => { if (!s.value) return; await sb.from("etudes_day_profs").insert({ day_id: s.dataset.day, prof_person_id: s.value }); loadEtudesCalendar(); }));
}
// Tous les jeunes d'une journée ont-ils un statut ? (pré-requis pour se déclarer présent)
function etAllYouthsMarked(dayId) {
  return [...document.querySelectorAll(`.et-cell[data-day="${dayId}"]`)].every((c) => c.dataset.status);
}
// Box « heures faites » (défaut 4). Renvoie un nombre, ou null si annulé.
function askHours() {
  return new Promise((resolve) => {
    const m = $("etp-hours-modal"), inp = $("etp-hours-input");
    const ok = $("etp-hours-ok"), cancel = $("etp-hours-cancel");
    inp.value = "4"; m.classList.remove("hidden"); setTimeout(() => inp.focus(), 50);
    const cleanup = (val) => { m.classList.add("hidden"); ok.onclick = null; cancel.onclick = null; resolve(val); };
    ok.onclick = () => { const v = parseFloat(inp.value); cleanup(isNaN(v) ? 4 : v); };
    cancel.onclick = () => cleanup(null);
  });
}
// Pastille présence prof : blanc → absent (libre) → présent (tous jeunes + heures) → blanc.
async function etProfPresence(chip) {
  const day = chip.dataset.day, cur = chip.dataset.status || "";
  // « Présent » n'est proposé dans le cycle que s'il est possible (dès 12h50 le jour-j + tous les jeunes marqués).
  // Sinon on ne fait que basculer absent ↔ neutre (on ne reste pas coincé sur absent).
  const afterTime = new Date() >= new Date(chip.dataset.date + "T12:50:00");
  const youthsOk = etAllYouthsMarked(day);
  let next;
  if (cur === "") next = "absent";
  else if (cur === "absent") {
    if (afterTime && youthsOk) next = "present";
    else { if (afterTime && !youthsOk) alert("Marque d'abord tous les jeunes pour te déclarer présent."); next = "neutral"; }
  } else next = "neutral"; // présent → neutre
  let hours = null;
  if (next === "present") { hours = await askHours(); if (hours === null) return; }
  const { error } = await sb.rpc("set_etudes_presence", { p_day: day, p_status: next, p_hours: hours });
  if (error) { alert(error.message); return; }
  loadEtudesCalendar();
}
function etProfCellHtml(dayId, dayProfs, profOptions, canEdit) {
  // canEdit (admin) : peut ajouter/retirer des profs. Un prof voit juste les noms (pas de ✕ ni « + prof »).
  const chips = dayProfs.map((dp) => { const p = people.find((x) => x.id === dp.prof_person_id); return `<span class="et-prof-chip">${p ? esc(p.first_name) : "?"}${canEdit ? `<button type="button" class="et-prof-rm" data-day="${dayId}" data-prof="${dp.prof_person_id}">✕</button>` : ""}</span>`; }).join(" ");
  const avail = profOptions.filter((p) => !dayProfs.some((dp) => dp.prof_person_id === p.id));
  const sel = (canEdit && avail.length) ? `<select class="et-prof-add" data-day="${dayId}"><option value="">+ prof</option>${avail.map((p) => `<option value="${p.id}">${esc(p.last_name)} ${esc(p.first_name)}</option>`).join("")}</select>` : "";
  return `<div class="et-profwrap">${chips || '<span class="muted" style="font-size:.8rem">—</span>'}${sel}</div>`;
}
async function etCycle(cell) {
  const next = etNext(cell.dataset.status);
  const { error } = await sb.rpc("set_etudes_attendance", { p_day: cell.dataset.day, p_youth: cell.dataset.youth, p_status: next || "neutral" });
  if (error) { alert(error.message); return; }
  cell.dataset.status = next;
  cell.className = "att-chip et-cell " + ET_CLS[next];
  cell.textContent = ET_LBL[next];
}
// ---- Réglages : générer le calendrier d'une saison ----
async function loadEtudesReglages() {
  await loadSeasonsList();
  etPopulateSeasons();
  const s = seasonsOf("juniors").find((x) => x.id === $("et-rg-season").value) || currentSeason("juniors");
  $("et-rg-status").textContent = "";
  if (!s) return;
  $("et-rg-season").value = s.id;
  // Règle : études du 31 août au vendredi 2 semaines avant les vacances d'été
  const startYear = Number((s.label.match(/(\d{4})/) || [])[1]) || new Date(s.start_date + "T00:00:00").getFullYear();
  const endYear = startYear + 1;
  $("et-rg-from").value = `${startYear}-08-31`;
  let to = s.end_date;
  const { data: sum } = await sb.from("school_holidays").select("start_date")
    .ilike("label", "Été %").gte("start_date", `${endYear}-06-01`).lte("start_date", `${endYear}-09-01`).order("start_date").limit(1);
  if (sum && sum.length) {
    const d = new Date(sum[0].start_date + "T00:00:00");
    while (d.getDay() !== 5) d.setDate(d.getDate() - 1); // vendredi précédant l'été
    d.setDate(d.getDate() - 14);                          // 2 semaines avant
    to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  $("et-rg-to").value = to;
}
async function generateEtudesDays() {
  const seasonId = $("et-rg-season").value;
  const dows = [...document.querySelectorAll(".et-rg-dow:checked")].map((c) => Number(c.value));
  const from = $("et-rg-from").value, to = $("et-rg-to").value;
  if (!seasonId) { $("et-rg-status").textContent = "Choisis une saison."; return; }
  if (!dows.length) { $("et-rg-status").textContent = "Coche au moins un jour."; return; }
  if (!from || !to) { $("et-rg-status").textContent = "Choisis une période."; return; }
  $("et-rg-status").textContent = "Génération…";
  const { data, error } = await sb.rpc("etudes_generate_days", { p_season: seasonId, p_dows: dows, p_from: from, p_to: to });
  if (error) { $("et-rg-status").textContent = "Erreur : " + error.message; return; }
  $("et-rg-status").textContent = `✓ ${data} jour(s) ajouté(s) (hors vacances). Onglet Calendrier pour voir.`;
}
// ---- Profs : attribuer un prof à des jours sur une période ----
async function loadEtudesProfs() {
  await loadSeasonsList();
  etPopulateSeasons();
  $("et-pf-status").textContent = "";
  const seasonId = $("et-pf-season").value;
  const profs = people.filter((p) => hasRoleIn(p.id, ["prof"]));
  $("et-pf-prof").innerHTML = profs.length
    ? profs.map((p) => `<option value="${p.id}">${esc(p.last_name)} ${esc(p.first_name)}</option>`).join("")
    : '<option value="">— aucun prof (taguer « Prof » dans une fiche) —</option>';
  if (!seasonId) { $("et-pf-list").innerHTML = '<p class="muted" style="font-size:.85rem">Crée une saison juniors.</p>'; return; }
  const { data: days } = await sb.from("etudes_days").select("id,day").eq("season_id", seasonId).order("day");
  if (days && days.length) { $("et-pf-from").value = days[0].day; $("et-pf-to").value = days[days.length - 1].day; }
  const dayIds = (days || []).map((d) => d.id);
  let dp = [];
  if (dayIds.length) dp = (await sb.from("etudes_day_profs").select("prof_person_id").in("day_id", dayIds)).data || [];
  const cnt = {}; for (const r of dp) cnt[r.prof_person_id] = (cnt[r.prof_person_id] || 0) + 1;
  $("et-pf-list").innerHTML = profs.length
    ? '<table class="crm-table"><thead><tr><th>Prof</th><th>Jours assignés</th></tr></thead><tbody>'
      + profs.map((p) => `<tr><td><b>${esc(p.last_name)} ${esc(p.first_name)}</b></td><td>${cnt[p.id] || 0}</td></tr>`).join("")
      + "</tbody></table>"
    : '<p class="muted" style="font-size:.85rem">Aucun prof taggé. Ajoute le tag « Prof » dans une fiche.</p>';
}
async function assignEtudesProf(remove) {
  const seasonId = $("et-pf-season").value, prof = $("et-pf-prof").value;
  const dows = [...document.querySelectorAll(".et-pf-dow:checked")].map((c) => Number(c.value));
  const from = $("et-pf-from").value, to = $("et-pf-to").value;
  if (!seasonId || !prof) { $("et-pf-status").textContent = "Choisis une saison et un prof."; return; }
  if (!dows.length) { $("et-pf-status").textContent = "Coche au moins un jour."; return; }
  if (!from || !to) { $("et-pf-status").textContent = "Choisis une période."; return; }
  $("et-pf-status").textContent = remove ? "Retrait…" : "Attribution…";
  const { data, error } = await sb.rpc("etudes_assign_prof", { p_prof: prof, p_season: seasonId, p_dows: dows, p_from: from, p_to: to, p_remove: !!remove });
  if (error) { $("et-pf-status").textContent = "Erreur : " + error.message; return; }
  $("et-pf-status").textContent = remove ? `✓ ${data} jour(s) retiré(s).` : `✓ ${data} jour(s) attribué(s).`;
  loadEtudesProfs();
}

// ---- Planning par jeune : quels jours il vient (les autres = « pas prévu ») ----
async function applyEtudesPlan() {
  const seasonId = $("et-season2").value;
  if (!etYouthId || !seasonId) return;
  const dows = [...document.querySelectorAll("#et-youth-detail .et-dow:checked")].map((c) => Number(c.value));
  const from = $("et-plan-from").value, to = $("et-plan-to").value;
  if (!from || !to) { $("et-plan-status").textContent = "Choisis une période."; return; }
  $("et-plan-status").textContent = "Application…";
  const { error } = await sb.rpc("etudes_apply_plan", { p_youth: etYouthId, p_season: seasonId, p_dows: dows, p_from: from, p_to: to });
  if (error) { $("et-plan-status").textContent = "Erreur : " + error.message; return; }
  const jl = dows.length ? dows.map((d) => ["", "Lun", "Mar", "Mer", "Jeu", "Ven"][d]).join(" · ") : "aucun jour";
  $("et-plan-status").textContent = `✓ Appliqué (${jl}). Les autres jours de la période sont « pas prévu ».`;
  loadEtudesCalendar();          // rafraîchit la vue Calendrier (les cases « pas prévu » apparaissent)
}

// ---- Sous-onglet Par jeune ----
async function loadEtudesYouths() {
  await loadSeasonsList();
  etPopulateSeasons();
  $("et-youth-detail").classList.add("hidden");
  $("et-youth-list").classList.remove("hidden");
  const seasonId = $("et-season2").value;
  const cont = $("et-youth-list");
  if (!seasonId) { cont.innerHTML = '<p class="muted" style="font-size:.85rem">Crée une saison juniors.</p>'; return; }
  const youths = await etYouthsForSeason(seasonId);
  if (!youths.length) { cont.innerHTML = '<p class="muted" style="font-size:.85rem">Aucun jeune en sport-études pour cette saison.</p>'; return; }
  const { data: days } = await sb.from("etudes_days").select("id").eq("season_id", seasonId);
  const dayIds = (days || []).map((d) => d.id);
  let att = [];
  if (dayIds.length) att = await fetchAllEtudesAtt(dayIds, "youth_person_id,status");
  const stat = (yid) => {
    const rows = att.filter((a) => a.youth_person_id === yid && a.status !== "not_planned");
    const n = rows.length;
    const c = (s) => rows.filter((a) => a.status === s).length;
    return { n, pres: n ? Math.round(c("present") / n * 100) : null, late: n ? Math.round(c("late") / n * 100) : null, abs: n ? Math.round(c("absent") / n * 100) : null };
  };
  cont.innerHTML = '<table class="crm-table"><thead><tr><th>Jeune</th><th>Présence</th><th>Retard</th><th>Absence</th><th>Jours</th></tr></thead><tbody>'
    + youths.map((y) => { const s = stat(y.id); return `<tr class="et-youth-row" data-id="${y.id}"><td><b>${esc(y.last_name)} ${esc(y.first_name)}</b></td><td>${s.pres == null ? "—" : s.pres + "%"}</td><td>${s.late == null ? "—" : s.late + "%"}</td><td>${s.abs == null ? "—" : s.abs + "%"}</td><td>${s.n}</td></tr>`; }).join("")
    + "</tbody></table>";
  cont.querySelectorAll(".et-youth-row").forEach((tr) => tr.addEventListener("click", () => openEtudesYouth(tr.dataset.id)));
}
async function openEtudesYouth(yid) {
  etYouthId = yid;
  const seasonId = $("et-season2").value;
  const p = people.find((x) => x.id === yid);
  $("et-youth-name").textContent = p ? `${p.last_name} ${p.first_name}` : "—";
  const { data: days } = await sb.from("etudes_days").select("id,day").eq("season_id", seasonId).order("day");
  const dayIds = (days || []).map((d) => d.id);
  // Planning : période par défaut = étendue de la saison ; cases décochées
  if (days && days.length) { $("et-plan-from").value = days[0].day; $("et-plan-to").value = days[days.length - 1].day; }
  document.querySelectorAll("#et-youth-detail .et-dow").forEach((c) => (c.checked = false));
  $("et-plan-status").textContent = "";
  let att = [];
  if (dayIds.length) att = (await sb.from("etudes_attendance").select("status").in("day_id", dayIds).eq("youth_person_id", yid)).data || [];
  const rows = att.filter((a) => a.status !== "not_planned"), n = rows.length;
  const c = (s) => rows.filter((a) => a.status === s).length;
  const pct = (x) => n ? Math.round(x / n * 100) : 0;
  $("et-youth-stats").innerHTML = n ? `
    <div class="et-stat st-present"><b>${pct(c("present"))}%</b><span>présent (${c("present")})</span></div>
    <div class="et-stat st-late"><b>${pct(c("late"))}%</b><span>en retard (${c("late")})</span></div>
    <div class="et-stat st-absent"><b>${pct(c("absent"))}%</b><span>absent (${c("absent")})</span></div>
    <div class="et-stat"><b>${n}</b><span>jours comptés</span></div>` : '<p class="muted" style="font-size:.85rem">Aucune présence renseignée (les « pas prévu » ne comptent pas).</p>';
  youthNotes("et-chan", yid);
  $("et-youth-list").classList.add("hidden");
  $("et-youth-detail").classList.remove("hidden");
  window.scrollTo(0, 0);
}
// ---- Fil « Suivi du jeune » unifié (interne, partagé par tout l'encadrement) ----
// Table youth_notes. Utilisé partout : Études (par jeune), Mental (par jeune), fiche › Suivi.
const NOTE_ROLE_META = {
  coach_mental: ["Mental", "mental"], prof: ["Prof", "prof"], head_coach: ["Head coach", "head"],
  coach: ["Coach", "coach"], secretaire: ["Secrétariat", "secr"], admin: ["Admin", "admin"], superadmin: ["Admin", "admin"],
};
const NOTE_ROLE_PRIORITY = ["coach_mental", "prof", "head_coach", "coach", "secretaire", "admin", "superadmin"];
const myNoteRole = () => NOTE_ROLE_PRIORITY.find((r) => myAppRoles.includes(r)) || "coach";
const noteRoleBadge = (role) => { const m = NOTE_ROLE_META[role] || [role || "—", "coach"]; return `<span class="yn-badge ${m[1]}">${esc(m[0])}</span>`; };

async function youthNotes(mountId, youthId) {
  const el = $(mountId); if (!el) return;
  if (!youthId) { el.innerHTML = ""; return; }
  const { data } = await sb.from("youth_notes").select("*").eq("youth_person_id", youthId).order("created_at", { ascending: false });
  const rows = data || [];
  const canMod = hasAny(myAppRoles, ["superadmin", "admin"]); // admin : peut éditer/supprimer TOUTE note
  const items = rows.length ? rows.map((r) => {
    const canEdit = r.created_by === meId || canMod;
    const edited = r.updated_at && r.updated_at !== r.created_at ? ' <span class="muted">(modifié)</span>' : "";
    return `<div class="obj-item yn-item" data-id="${r.id}">
      <div class="obj-meta"><span class="yn-who">${noteRoleBadge(r.author_role)} <b>${esc(r.author_name || "—")}</b></span><span>${frDateTime(r.created_at)}${edited}</span></div>
      <div class="obj-body">${esc(r.body).replace(/\n/g, "<br/>")}</div>
      ${canEdit ? `<div class="obj-acts"><button type="button" class="edit">Modifier</button><button type="button" class="del">Supprimer</button></div>` : ""}</div>`;
  }).join("") : '<p class="obj-empty">Aucune note pour l\'instant.</p>';
  el.innerHTML = `
    <p class="chan-note interne">Fil interne — partagé par tout l'encadrement (coachs, profs, mental, secrétariat, admin).</p>
    <div class="obj-add"><textarea class="yn-body" rows="2" placeholder="Ajouter une note sur le jeune…"></textarea>
      <button type="button" class="yn-add">Ajouter</button></div>
    <div class="obj-list">${items}</div>`;
  el.querySelector(".yn-add").addEventListener("click", async () => {
    const body = el.querySelector(".yn-body").value.trim(); if (!body) return;
    const { error } = await sb.from("youth_notes").insert({ youth_person_id: youthId, body, author_person_id: myPersonId, author_name: meName, author_role: myNoteRole(), created_by: meId });
    if (error) { alert(error.message); return; }
    youthNotes(mountId, youthId);
  });
  el.querySelectorAll(".del").forEach((b) => b.addEventListener("click", async () => {
    if (!await uiConfirm("Supprimer cette note ?")) return;
    await sb.from("youth_notes").delete().eq("id", b.closest(".yn-item").dataset.id);
    youthNotes(mountId, youthId);
  }));
  el.querySelectorAll(".edit").forEach((b) => b.addEventListener("click", () => {
    const item = b.closest(".yn-item"), id = item.dataset.id, cur = rows.find((r) => r.id === id);
    item.querySelector(".obj-body").innerHTML = `<textarea class="yn-edit" rows="2" style="width:100%">${esc(cur.body)}</textarea>
      <div style="margin-top:6px"><button type="button" class="yn-save">Enregistrer</button></div>`;
    item.querySelector(".yn-save").addEventListener("click", async () => {
      const nb = item.querySelector(".yn-edit").value.trim(); if (!nb) return;
      await sb.from("youth_notes").update({ body: nb, updated_at: new Date().toISOString() }).eq("id", id);
      youthNotes(mountId, youthId);
    });
  }));
}

// ---- Composant « double canal » (interne / public) réutilisable ----
// Utilisé dans : onglet Études, onglet Mental, fiche Études, fiche Mental.
const CHAN_CFG = {
  etudes_remarks: { author: "prof_name", authorId: "prof_person_id" },
  mental_comments: { author: "author_name", authorId: "author_person_id" },
};
async function channelBox(mountId, table, youthId, internalOnly) {
  const el = $(mountId);
  if (!el) return;
  if (!youthId) { el.innerHTML = ""; return; }
  const cfg = CHAN_CFG[table];
  const chan = internalOnly ? "interne" : (el.dataset.chan === "public" ? "public" : "interne");
  el.dataset.chan = chan;
  const { data } = await sb.from(table).select("*").eq("youth_person_id", youthId).eq("channel", chan).order("created_at", { ascending: false });
  const rows = data || [];
  const items = rows.length ? rows.map((r) => {
    const mine = r.created_by === meId;
    const edited = r.updated_at && r.updated_at !== r.created_at ? ' <span class="muted">(modifié)</span>' : "";
    return `<div class="obj-item" data-id="${r.id}"><div class="obj-meta"><b>${esc(r[cfg.author] || "—")}</b><span>${frDateTime(r.created_at)}${edited}</span></div>
      <div class="obj-body">${esc(r.body)}</div>
      ${mine ? `<div class="obj-acts"><button type="button" class="edit">Modifier</button><button type="button" class="del">Supprimer</button></div>` : ""}</div>`;
  }).join("") : '<p class="obj-empty">Aucun message dans ce canal.</p>';
  const tabs = internalOnly ? "" : `
    <div class="chan-tabs">
      <button type="button" class="chan-tab ${chan === "interne" ? "active" : ""}" data-chan="interne">🔒 Interne</button>
      <button type="button" class="chan-tab pub ${chan === "public" ? "active" : ""}" data-chan="public">🌐 Public</button>
    </div>`;
  el.innerHTML = `
    ${tabs}
    <p class="chan-note ${chan}">${chan === "interne"
      ? "Canal interne — visible par le staff, les profs et les coachs."
      : "Canal public — visible aussi par le jeune concerné et ses parents."}</p>
    <div class="obj-add"><textarea class="chan-body" rows="2" placeholder="${chan === "interne" ? "Note interne…" : "Message partagé au jeune / aux parents…"}"></textarea>
      <button type="button" class="chan-add">Ajouter</button></div>
    <div class="obj-list">${items}</div>`;
  el.querySelectorAll(".chan-tab").forEach((b) => b.addEventListener("click", () => { el.dataset.chan = b.dataset.chan; channelBox(mountId, table, youthId, internalOnly); }));
  el.querySelector(".chan-add").addEventListener("click", async () => {
    const body = el.querySelector(".chan-body").value.trim(); if (!body) return;
    const row = { youth_person_id: youthId, body, channel: chan, created_by: meId };
    row[cfg.author] = meName; row[cfg.authorId] = myPersonId;
    const { error } = await sb.from(table).insert(row);
    if (error) { alert(error.message); return; }
    channelBox(mountId, table, youthId, internalOnly);
  });
  el.querySelectorAll(".del").forEach((b) => b.addEventListener("click", async () => {
    if (!await uiConfirm("Supprimer ce message ?")) return;
    await sb.from(table).delete().eq("id", b.closest(".obj-item").dataset.id);
    channelBox(mountId, table, youthId, internalOnly);
  }));
  el.querySelectorAll(".edit").forEach((b) => b.addEventListener("click", () => {
    const item = b.closest(".obj-item"), id = item.dataset.id, cur = rows.find((r) => r.id === id);
    item.querySelector(".obj-body").innerHTML = `<textarea class="chan-edit-body" rows="2" style="width:100%">${esc(cur.body)}</textarea>
      <div style="margin-top:6px"><button type="button" class="chan-save">Enregistrer</button></div>`;
    item.querySelector(".chan-save").addEventListener("click", async () => {
      const nb = item.querySelector(".chan-edit-body").value.trim(); if (!nb) return;
      await sb.from(table).update({ body: nb, updated_at: new Date().toISOString() }).eq("id", id);
      channelBox(mountId, table, youthId, internalOnly);
    });
  }));
}

async function loadEtRemarks(yid) {
  const { data } = await sb.from("etudes_remarks").select("*").eq("youth_person_id", yid).order("created_at", { ascending: false });
  const rows = data || [];
  $("et-rem-list").innerHTML = rows.length ? rows.map((r) => {
    const mine = r.created_by === meId;
    const edited = r.updated_at && r.updated_at !== r.created_at ? ' <span class="muted">(modifié)</span>' : "";
    return `<div class="obj-item" data-id="${r.id}"><div class="obj-meta"><b>${esc(r.prof_name || "—")}</b><span>${frDateTime(r.created_at)}${edited}</span></div>
      <div class="obj-body">${esc(r.body)}</div>
      ${mine ? `<div class="obj-acts"><button type="button" class="edit">Modifier</button><button type="button" class="del">Supprimer</button></div>` : ""}</div>`;
  }).join("") : '<p class="obj-empty">Aucune remarque.</p>';
  $("et-rem-list").querySelectorAll(".edit").forEach((b) => b.addEventListener("click", () => editEtRemark(b.closest(".obj-item").dataset.id)));
  $("et-rem-list").querySelectorAll(".del").forEach((b) => b.addEventListener("click", () => delEtRemark(b.closest(".obj-item").dataset.id)));
}
async function addEtRemark() {
  const body = $("et-rem-body").value.trim();
  if (!etYouthId || !body) return;
  const { error } = await sb.from("etudes_remarks").insert({ youth_person_id: etYouthId, body, prof_name: meName, prof_person_id: myPersonId, created_by: meId });
  if (error) { alert(error.message); return; }
  $("et-rem-body").value = "";
  loadEtRemarks(etYouthId);
}
async function editEtRemark(id) {
  const el = document.querySelector(`#et-rem-list .obj-item[data-id="${id}"] .obj-body`);
  const next = await uiPrompt("Modifier la remarque :", el ? el.textContent : "");
  if (next === null) return;
  const body = next.trim(); if (!body) return;
  await sb.from("etudes_remarks").update({ body, updated_at: new Date().toISOString() }).eq("id", id);
  loadEtRemarks(etYouthId);
}
async function delEtRemark(id) {
  if (!await uiConfirm("Supprimer cette remarque ?")) return;
  await sb.from("etudes_remarks").delete().eq("id", id);
  loadEtRemarks(etYouthId);
}


// ===================================================================
//  Détail des séances (head coach / admin) — qui a joué avec qui,
//  avec quel coach, combien de temps.
//  SAISIE directement dans le modal du cours (au moment des présences),
//  pour les types pro / sport-études quand il y a >1 court OU >1 coach.
//  Onglet "Stats séances" = consultation (paires, coachs, CSV).
//  Données SÉPARÉES (RLS) : invisibles pour jeunes et autres coachs.
// ===================================================================
const TR_TYPE_RE = /pro|étud|etud/i;                 // familles pro / sport-études
const TR_DURS = [15, 30, 45, 60, 75, 90, 105, 120];
let trStatWired = false;
let trEditing = null;   // { id, date, start, end, dur, label, roster:[], coachOpts:[], courtIds:[] }
let trBlocs = [];       // [{ minutes, coach, court, note, players:[] }]

const trFull = (id) => { const p = people.find((x) => x.id === id); return p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "?"; };
const trShort = (id) => { const p = people.find((x) => x.id === id); return p ? `${p.first_name || ""} ${(p.last_name || "").slice(0, 1)}.`.trim() : "?"; };
function trMinBetween(a, b) {
  if (!a || !b) return 0;
  const [h1, m1] = a.split(":").map(Number), [h2, m2] = b.split(":").map(Number);
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
}
const trFmtH = (m) => { const h = Math.floor(m / 60), r = m % 60; return h && r ? `${h}h${String(r).padStart(2, "0")}` : h ? `${h}h` : `${r}min`; };

// ---------- Saisie embarquée dans le modal du cours ----------
// Un cours "détaillé" = pro/sport-études AVEC plusieurs courts OU plusieurs coachs
// (head coach/admin). Pour ces cours, le détail REMPLACE la validation des présences.
function courseNeedsDetail(course, courtIds, coachIds) {
  if (!course) return false;
  const canEdit = hasAny(myAppRoles, ["superadmin", "admin", "head_coach"]);
  const typeName = (courseTypes.find((t) => t.id === course.course_type_id) || {}).name || "";
  // Aligné sur le serveur course_is_detailed : plusieurs COURTS OU plusieurs COACHS.
  const multi = (courtIds || []).length > 1 || (coachIds || []).length > 1;
  return canEdit && TR_TYPE_RE.test(typeName) && multi;
}
// Appelée par openCourse : affiche (ou non) le bloc détail.
async function courseDetailMaybe(course, courtIds, coachIds, childIds) {
  const block = $("c-detail-block"); if (!block) return;
  const typeName = (courseTypes.find((t) => t.id === course.course_type_id) || {}).name || "";
  if (!courseNeedsDetail(course, courtIds, coachIds)) { block.classList.add("hidden"); $("c-detail").innerHTML = ""; return; }
  block.classList.remove("hidden");
  const coachLike = (id) => (peopleRoles[id] || []).some((r) => ["coach", "head-coach", "coach-prive"].includes(r));
  const coachSet = new Set(coachIds || []); people.forEach((p) => { if (coachLike(p.id)) coachSet.add(p.id); });
  trEditing = {
    id: course.id, date: course.course_date, start: course.start_time, end: course.end_time,
    label: typeName || course.title || "Séance", dur: trMinBetween(course.start_time, course.end_time),
    roster: [...new Set(childIds || [])], coachOpts: [...coachSet], courtIds: (courtIds || []).map(Number),
    children: [...new Set(childIds || [])], courseCoaches: [...new Set(coachIds || [])],
  };
  const { data: segs } = await sb.from("course_segments").select("id,seq,minutes,coach_person_id,court_id,note").eq("course_id", course.id).order("seq");
  let ex = {};
  if ((segs || []).length) {
    const { data: sp } = await sb.from("course_segment_players").select("segment_id,person_id").in("segment_id", segs.map((s) => s.id));
    (sp || []).forEach((r) => (ex[r.segment_id] || (ex[r.segment_id] = [])).push(r.person_id));
  }
  (segs || []).forEach((s) => (ex[s.id] || []).forEach((pid) => { if (!trEditing.roster.includes(pid)) trEditing.roster.push(pid); }));
  trBlocs = (segs || []).length
    ? segs.map((s) => ({ minutes: s.minutes, coach: s.coach_person_id || "", court: s.court_id || "", note: s.note || "", players: ex[s.id] || [] }))
    : [{ minutes: Math.min(trEditing.dur || 60, 60), coach: trEditing.coachOpts[0] || "", court: (courtIds || [])[0] || "", note: "", players: [] }];
  renderTrEditor();
}

function trCourtList() {
  const all = (typeof resaCourtsAll !== "undefined" && resaCourtsAll.length) ? resaCourtsAll : [];
  if (trEditing.courtIds && trEditing.courtIds.length) return all.filter((c) => trEditing.courtIds.includes(Number(c.id)));
  return all;
}
function trTally() {
  const t = {}; trEditing.roster.forEach((pid) => (t[pid] = 0));
  trBlocs.forEach((b) => (b.players || []).forEach((pid) => { t[pid] = (t[pid] || 0) + (b.minutes || 0); }));
  return t;
}

function renderTrEditor() {
  const host = $("c-detail"); if (!host || !trEditing) return;
  const e = trEditing, tgt = e.dur || 0, tally = trTally();
  const tallyHtml = e.roster.map((pid) => {
    const m = tally[pid] || 0, cls = m === tgt ? "ok" : m > tgt ? "over" : "under";
    return `<span class="tr-tchip ${cls}">${esc(trShort(pid))} <b>${m}′</b>${tgt ? `/${tgt}` : ""}</span>`;
  }).join("");
  // Tally COACHS = temps réellement encadré (→ paie). Chaque coach de la séance devrait totaliser la durée.
  const coachMin = {}; (e.courseCoaches || []).forEach((id) => (coachMin[id] = 0));
  trBlocs.forEach((b) => { if (b.coach) coachMin[b.coach] = (coachMin[b.coach] || 0) + (b.minutes || 0); });
  const coachIdsShown = Object.keys(coachMin);
  const coachTallyHtml = coachIdsShown.map((id) => {
    const m = coachMin[id] || 0, cls = m === tgt ? "ok" : m > tgt ? "over" : "under";
    return `<span class="tr-tchip ${cls}">${esc(trShort(id))} <b>${trFmtH(m)}</b>${tgt ? `/${trFmtH(tgt)}` : ""}</span>`;
  }).join("");
  const mism = coachIdsShown.filter((id) => (coachMin[id] || 0) !== tgt);
  const warnHtml = mism.length
    ? `<div class="tr-warn">⚠️ Le temps encadré ne correspond pas à la durée de la séance (${trFmtH(tgt)}) pour&nbsp;: ${mism.map((id) => `<b>${esc(trShort(id))}</b> (${trFmtH(coachMin[id] || 0)})`).join(", ")}. Ils seront payés au temps saisi — vérifie que c'est voulu.</div>`
    : "";
  const coachOptions = (sel) => `<option value="">— coach —</option>` +
    e.coachOpts.map((id) => `<option value="${id}"${String(sel) === String(id) ? " selected" : ""}>${esc(trFull(id))}</option>`).join("");
  const courtOptions = (sel) => `<option value="">— court —</option>` +
    trCourtList().map((ct) => `<option value="${ct.id}"${String(sel) === String(ct.id) ? " selected" : ""}>${esc(ct.name)}</option>`).join("");
  const blocsHtml = trBlocs.map((b, i) => {
    const durs = TR_DURS.map((d) => `<button type="button" class="tr-dur${b.minutes === d ? " sel" : ""}" data-i="${i}" data-d="${d}">${d}′</button>`).join("");
    const chips = e.roster.map((pid) => {
      const on = (b.players || []).includes(pid);
      return `<button type="button" class="tr-pchip${on ? " on" : ""}" data-i="${i}" data-p="${pid}">${esc(trShort(pid))}</button>`;
    }).join("");
    return `<div class="tr-bloc">
      <div class="tr-bloc-head"><b>Bloc ${i + 1}</b><button type="button" class="tr-del" data-i="${i}" title="Supprimer ce bloc">✕</button></div>
      <div class="tr-row"><span class="tr-lbl">Durée</span><div class="tr-durs">${durs}</div></div>
      <div class="tr-row tr-sels">
        <label class="tr-lbl2">Coach <select class="tr-coach" data-i="${i}">${coachOptions(b.coach)}</select></label>
        <label class="tr-lbl2">Court <select class="tr-court" data-i="${i}">${courtOptions(b.court)}</select></label>
      </div>
      <div class="tr-row"><span class="tr-lbl">Joueurs</span><div class="tr-pchips">${chips || '<span class="muted">Aucun joueur</span>'}</div></div>
      <div class="tr-row"><span class="tr-lbl">Note</span><input type="text" class="tr-note" data-i="${i}" value="${esc(b.note || "")}" placeholder="ex. travail service / points" /></div>
    </div>`;
  }).join("");
  host.innerHTML = `
    <label class="cs-lbl">Détail de la séance <span class="muted" style="font-weight:400">— qui a joué avec qui, quel coach, combien de temps</span></label>
    <p class="muted" style="font-size:.8rem;margin:0 0 8px"><b>Ce détail remplace l'appel ET le calcul des heures</b> pour ce cours : un joueur dans ≥1 bloc = présent ; chaque coach est payé au temps saisi.</p>
    <div class="tr-tally-lbl">Joueurs</div>
    <div class="tr-tally">${tallyHtml || '<span class="muted">Aucun joueur.</span>'}</div>
    <div class="tr-tally-lbl">Coachs <span class="muted" style="font-weight:400">— temps encadré (paie)</span></div>
    <div class="tr-tally">${coachTallyHtml || '<span class="muted">Aucun coach.</span>'}</div>
    ${warnHtml}
    <p class="muted" style="font-size:.8rem;margin:2px 0 8px">🟢 complet · 🟠 incomplet · 🔴 dépassé. Un <b>joueur</b> peut faire moins ; un <b>coach</b> devrait couvrir toute la séance (sinon avertissement).</p>
    <div class="tr-blocs">${blocsHtml}</div>
    <div class="tr-ed-actions"><button type="button" class="tr-add">+ Ajouter un bloc</button><button type="button" class="tr-save">Enregistrer le détail</button><span class="tr-save-st muted"></span></div>`;
  const newBloc = () => ({ minutes: 60, coach: e.coachOpts[0] || "", court: (e.courtIds || [])[0] || "", note: "", players: [] });
  host.querySelector(".tr-add").addEventListener("click", () => { trBlocs.push(newBloc()); renderTrEditor(); });
  host.querySelector(".tr-save").addEventListener("click", trSave);
  host.querySelectorAll(".tr-dur").forEach((b) => b.addEventListener("click", () => { trBlocs[+b.dataset.i].minutes = +b.dataset.d; renderTrEditor(); }));
  host.querySelectorAll(".tr-del").forEach((b) => b.addEventListener("click", () => { trBlocs.splice(+b.dataset.i, 1); if (!trBlocs.length) trBlocs.push(newBloc()); renderTrEditor(); }));
  host.querySelectorAll(".tr-pchip").forEach((b) => b.addEventListener("click", () => { const arr = trBlocs[+b.dataset.i].players, pid = b.dataset.p, k = arr.indexOf(pid); if (k >= 0) arr.splice(k, 1); else arr.push(pid); renderTrEditor(); }));
  host.querySelectorAll(".tr-coach").forEach((s) => s.addEventListener("change", () => { trBlocs[+s.dataset.i].coach = s.value; }));
  host.querySelectorAll(".tr-court").forEach((s) => s.addEventListener("change", () => { trBlocs[+s.dataset.i].court = s.value; }));
  host.querySelectorAll(".tr-note").forEach((s) => s.addEventListener("input", () => { trBlocs[+s.dataset.i].note = s.value; }));
}

async function trSave() {
  const host = $("c-detail"); const st = host.querySelector(".tr-save-st");
  const valid = trBlocs.filter((b) => b.minutes > 0 && (b.players || []).length > 0);
  if (!valid.length) { uiAlert("Ajoute au moins un bloc avec une durée et au moins un joueur."); return; }
  st.textContent = "Enregistrement…";
  const id = trEditing.id;
  await sb.from("course_segments").delete().eq("course_id", id);           // remplace tout (cascade joueurs)
  const rows = valid.map((b, i) => ({ course_id: id, seq: i, minutes: b.minutes, coach_person_id: b.coach || null, court_id: b.court || null, note: b.note || null }));
  const { data: ins, error } = await sb.from("course_segments").insert(rows).select("id,seq");
  if (error) { st.textContent = "Erreur : " + error.message; return; }
  const pr = [];
  (ins || []).forEach((r) => (valid[r.seq].players || []).forEach((pid) => pr.push({ segment_id: r.id, person_id: pid })));
  if (pr.length) { const { error: e2 } = await sb.from("course_segment_players").insert(pr); if (e2) { st.textContent = "Erreur joueurs : " + e2.message; return; } }
  // Le détail REMPLACE les présences : on les dérive (présent = joue dans ≥1 bloc).
  const present = new Set(); valid.forEach((b) => (b.players || []).forEach((pid) => present.add(pid)));
  const coachPresent = new Set(); valid.forEach((b) => { if (b.coach) coachPresent.add(b.coach); });
  const attRows = [];
  (trEditing.children || []).forEach((pid) => attRows.push({ course_id: id, person_id: pid, status: present.has(pid) ? "present" : "absent", is_coach: false, marked_by: meId, marked_at: new Date().toISOString() }));
  coachPresent.forEach((pid) => attRows.push({ course_id: id, person_id: pid, status: "present", is_coach: true, marked_by: meId, marked_at: new Date().toISOString() }));
  if (attRows.length) await sb.from("attendance").upsert(attRows, { onConflict: "course_id,person_id" });
  st.textContent = "✓ Détail enregistré (présences mises à jour)";
}

// ---------- Onglet Stats séances (consultation fin d'année) ----------
let trStatData = null;
function loadTraining() {
  if (!$("tr-stat-season")) return;
  if (!trStatWired) { $("tr-stat-run").addEventListener("click", loadTrStats); $("tr-stat-csv").addEventListener("click", trStatsCsv); trStatWired = true; }
  trInitStatsFilters();
}
function trInitStatsFilters() {
  const ssel = $("tr-stat-season"); if (!ssel) return;
  const juns = (typeof seasonsOf === "function" ? seasonsOf("juniors") : []) || [];
  const cur = (typeof currentSeason === "function" ? currentSeason("juniors") : null);
  ssel.innerHTML = juns.map((s) => `<option value="${s.id}">${esc(s.label || (s.start_date + "→" + s.end_date))}</option>`).join("") || '<option value="">—</option>';
  if (cur) ssel.value = cur.id;
  const psel = $("tr-stat-player");
  const pro = people.filter((p) => (peopleRoles[p.id] || []).some((r) => ["pro", "pro-u18", "sport-etudes"].includes(r)))
    .sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""));
  psel.innerHTML = `<option value="">— Tous (paires globales) —</option>` +
    pro.map((p) => `<option value="${p.id}">${esc(trFull(p.id))}</option>`).join("");
}
async function loadTrStats() {
  const body = $("tr-stat-body");
  const juns = (typeof seasonsOf === "function" ? seasonsOf("juniors") : []) || [];
  const s = juns.find((x) => String(x.id) === $("tr-stat-season").value);
  if (!s) { body.innerHTML = '<p class="muted">Choisis une saison.</p>'; return; }
  body.innerHTML = '<p class="muted">Calcul…</p>';
  const { data: cs } = await sb.from("courses").select("id,course_date,course_types(name)").gte("course_date", s.start_date).lte("course_date", s.end_date);
  const proIds = (cs || []).filter((c) => TR_TYPE_RE.test(c.course_types?.name || "")).map((c) => c.id);
  if (!proIds.length) { body.innerHTML = '<p class="muted">Aucune séance sur cette saison.</p>'; return; }
  const { data: segs } = await sb.from("course_segments").select("id,course_id,minutes,coach_person_id").in("course_id", proIds);
  if (!(segs || []).length) { body.innerHTML = '<p class="muted">Aucun détail saisi sur cette saison.</p>'; return; }
  const { data: sp } = await sb.from("course_segment_players").select("segment_id,person_id").in("segment_id", segs.map((x) => x.id));
  const bySeg = {}; (sp || []).forEach((r) => (bySeg[r.segment_id] || (bySeg[r.segment_id] = [])).push(r.person_id));
  const pairMin = {}, pairCnt = {}, pcMin = {}, totMin = {}, sessOf = {};
  segs.forEach((seg) => {
    const pls = bySeg[seg.id] || [], m = seg.minutes || 0;
    pls.forEach((pid) => {
      totMin[pid] = (totMin[pid] || 0) + m;
      (sessOf[pid] || (sessOf[pid] = new Set())).add(seg.course_id);
      if (seg.coach_person_id) { const k = pid + "|" + seg.coach_person_id; pcMin[k] = (pcMin[k] || 0) + m; }
    });
    for (let i = 0; i < pls.length; i++) for (let j = i + 1; j < pls.length; j++) {
      const k = [pls[i], pls[j]].sort().join("|");
      pairMin[k] = (pairMin[k] || 0) + m; pairCnt[k] = (pairCnt[k] || 0) + 1;
    }
  });
  trStatData = { pairMin, pairCnt, pcMin, totMin, sessOf, season: s.label || (s.start_date + "→" + s.end_date) };
  const who = $("tr-stat-player").value;
  if (who) renderTrStatPlayer(who); else renderTrStatGlobal();
}
function renderTrStatPlayer(pid) {
  const { pairMin, pairCnt, pcMin, totMin, sessOf } = trStatData;
  const partners = Object.keys(pairMin).filter((k) => k.split("|").includes(pid))
    .map((k) => { const o = k.split("|").find((x) => x !== pid); return { id: o, min: pairMin[k], cnt: pairCnt[k] }; }).sort((a, b) => b.min - a.min);
  const coaches = Object.keys(pcMin).filter((k) => k.startsWith(pid + "|"))
    .map((k) => ({ id: k.split("|")[1], min: pcMin[k] })).sort((a, b) => b.min - a.min);
  const tbl = (rows) => `<div class="table-wrap"><table class="crm-table"><thead><tr><th>Nom</th><th>Temps cumulé</th><th>Blocs</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const pRows = partners.map((p) => `<tr><td>${esc(trFull(p.id))}</td><td>${trFmtH(p.min)}</td><td>${p.cnt}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">—</td></tr>';
  const cRows = coaches.map((c) => `<tr><td>${esc(trFull(c.id))}</td><td>${trFmtH(c.min)}</td><td>—</td></tr>`).join("") || '<tr><td colspan="3" class="muted">—</td></tr>';
  $("tr-stat-body").innerHTML =
    `<h3 style="margin:14px 0 4px">${esc(trFull(pid))} — ${trFmtH(totMin[pid] || 0)} au total · ${(sessOf[pid] ? sessOf[pid].size : 0)} séance(s)</h3>
     <h4 style="margin:14px 0 4px">Avec quels joueurs</h4>${tbl(pRows)}
     <h4 style="margin:16px 0 4px">Avec quels coachs</h4>${tbl(cRows)}`;
}
function renderTrStatGlobal() {
  const { pairMin, pairCnt } = trStatData;
  const rows = Object.keys(pairMin).map((k) => { const [a, b] = k.split("|"); return { a, b, min: pairMin[k], cnt: pairCnt[k] }; }).sort((x, y) => y.min - x.min);
  const body = rows.map((r) => `<tr><td>${esc(trFull(r.a))}</td><td>${esc(trFull(r.b))}</td><td>${trFmtH(r.min)}</td><td>${r.cnt}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">—</td></tr>';
  $("tr-stat-body").innerHTML =
    `<h3 style="margin:14px 0 6px">Toutes les paires — ${esc(trStatData.season)}</h3>
     <div class="table-wrap"><table class="crm-table"><thead><tr><th>Joueur A</th><th>Joueur B</th><th>Temps ensemble</th><th>Blocs</th></tr></thead><tbody>${body}</tbody></table></div>`;
}
function trStatsCsv() {
  if (!trStatData) { uiAlert("Lance d'abord un calcul."); return; }
  const { pairMin, pairCnt } = trStatData;
  const lines = [["Joueur A", "Joueur B", "Minutes ensemble", "Blocs"]];
  Object.keys(pairMin).map((k) => { const [a, b] = k.split("|"); return [trFull(a), trFull(b), pairMin[k], pairCnt[k]]; })
    .sort((x, y) => y[2] - x[2]).forEach((r) => lines.push(r));
  const csv = "﻿" + lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = `paires_${(trStatData.season || "saison").replace(/[^\w-]+/g, "_")}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
