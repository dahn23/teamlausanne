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
const CONSOLE_ROLES = [...STAFF_ROLES, "prof", "coach_mental", "organisateur", "responsable", "affichage"];

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
  superadmin: ["dashboard", "pm", "membres", "anniv", "inscriptions", "prospects", "news", "mail", "newsletter", "roles", "resa", "winter", "lockers", "cours", "matchs", "lastscores", "phystests", "etudes", "mental", "csel", "gamezone", "caisse", "factures", "heures", "locks", "irrigation", "stages", "stats"],
  admin:      ["dashboard", "pm", "membres", "anniv", "inscriptions", "prospects", "news", "mail", "newsletter", "roles", "resa", "winter", "lockers", "cours", "matchs", "lastscores", "phystests", "etudes", "mental", "csel", "gamezone", "caisse", "factures", "heures", "locks", "irrigation", "stages", "stats"],
  secretaire: ["pm", "membres", "anniv", "inscriptions", "news", "mail", "newsletter", "resa", "winter", "lockers", "cours", "caisse", "locks", "irrigation", "stages", "stats"],
  head_coach: ["dashboard", "anniv", "resa", "cours", "matchs", "lastscores", "phystests", "mental", "stages", "prospects", "heures"],
  coach:      ["cours", "matchs", "lastscores", "phystests", "heures"],
  coach_physique: ["cours", "phystests", "heures"],
  moniteur:   ["cours", "heures"],
  affichage:  ["resa"],                      // ecran du club : grille des courts, lecture seule
  prof:       ["etudes"],
  coach_mental: ["mental", "heures"],
  organisateur: ["gamezone", "mail"],
  responsable:  ["gamezone"],
};
const ADMIN_TABS = [["dashboard", "Dashboard"], ["membres", "Répertoire"], ["inscriptions", "Inscriptions"], ["prospects", "Prospects"], ["news", "News"], ["mail", "Messagerie"], ["newsletter", "Newsletter"], ["roles", "Réglages"], ["resa", "Réserv."], ["winter", "Saison hiver"], ["lockers", "Casiers"], ["cours", "Cours"], ["matchs", "Feuille de match"], ["lastscores", "Last scores"], ["phystests", "Tests phys."], ["anniv", "Anniversaires"], ["etudes", "Études"], ["mental", "Mental"], ["csel", "CSEL"], ["gamezone", "GameZone"], ["caisse", "Caisse"], ["factures", "Factures"], ["heures", "Heures"], ["locks", "Serrures"], ["irrigation", "Arrosage"], ["stages", "Stages"], ["stats", "Stats"]];
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
  ["concierge", "Concierge"],   // salarié sans aucun accès à l'app (fiche + salaire seulement)
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
  const finTag = !!(myPersonId && (peopleRoles[myPersonId] || []).includes("finance"));  // tag CRM "finance" → onglet Factures
  let first = null; const allowedSet = new Set();
  document.querySelectorAll(".side-item[data-view]").forEach((b) => {
    const v = b.dataset.view;
    if (v === "bientot") return;
    const allowed = allowedFor(v) || (v === "gamezone" && isGzManager) || (v === "factures" && finTag);
    b.classList.toggle("hidden", !allowed);
    if (allowed) { allowedSet.add(v); if (!first) first = v; }
  });
  // Masquer un bloc entier si aucun de ses onglets n'est visible (pas de trait orphelin).
  document.querySelectorAll(".side-block").forEach((bl) => {
    const anyVisible = [...bl.querySelectorAll(".side-item[data-view]")]
      .some((b) => b.dataset.view !== "bientot" && !b.classList.contains("hidden"));
    bl.classList.toggle("hidden", !anyVisible);
  });
  // Le menu ET le contenu n'apparaissent qu'une fois la bonne vue choisie
  // (évite le flash de la vue Répertoire par défaut avant l'aiguillage par rôle).
  // On restaure le dernier onglet vu (si toujours autorisé), sinon le 1er.
  let saved = null; try { saved = localStorage.getItem("tl-view"); } catch (_) {}
  const target = (saved && allowedSet.has(saved)) ? saved : first;
  if (target) showView(target);
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
  $("return-course").addEventListener("click", () => showView(tennisNav?.back || "cours"));
  $("tn-prev").addEventListener("click", () => tennisNavStep(-1));
  $("tn-next").addEventListener("click", () => tennisNavStep(1));
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
  try { localStorage.setItem("tl-view", view); } catch (_) {}   // mémorise l'onglet pour le prochain rechargement
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
  if (view === "factures") loadFactures();
  if (view === "winter") loadWinter();
  if (view === "lockers") loadLockers();
  if (view === "lastscores") loadLastScores();
  if (view === "dashboard") loadDashboard();
  if (view === "pm") loadPM();
  if (view === "newsletter") loadNewsletters();
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
  $("rod-close").addEventListener("click", () => $("rodetail-modal").classList.add("hidden"));
  $("rodetail-modal").addEventListener("click", (e) => { if (e.target === $("rodetail-modal")) $("rodetail-modal").classList.add("hidden"); });
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
        el.addEventListener("click", () => isDisplayOnly ? showBookingDetail(b) : editBooking(b, h));
      } else {
        el.classList.add("rfree");
        el.dataset.court = c.id;
        el.dataset.hour = h;
        if (!isDisplayOnly) {
          el.addEventListener("mousedown", (e) => { e.preventDefault(); startDrag(c.id, h); });
          el.addEventListener("mouseover", () => overDrag(c.id, h));
        }
      }
      grid.appendChild(el);
    }
  }
}


// ---- Detail d'un cours en lecture seule (compte « affichage ») ----
// Aucune ecriture possible : la fonction RPC ne renvoie que des noms, et le
// compte n'a de toute facon pas les droits d'ecriture en base.
async function showBookingDetail(b) {
  const t = (x) => (x || "").slice(0, 5);
  $("rod-title").textContent = b.title || kindLabel(b.kind);
  const court = resaCourts.find((c) => c.id === b.court_id);
  $("rod-meta").textContent = [court ? court.name : "", `${t(b.start_time)} – ${t(b.end_time)}`, frDate(b.booking_date)]
    .filter(Boolean).join(" · ");
  const body = $("rod-body");
  $("rodetail-modal").classList.remove("hidden");
  if (!b.course_id) { body.innerHTML = '<p class="muted">Réservation simple — pas de groupe rattaché.</p>'; return; }
  body.innerHTML = '<p class="muted">Chargement…</p>';
  const { data, error } = await sb.rpc("affichage_course_detail", { p_course: b.course_id });
  if (error) { body.innerHTML = `<p class="muted">Détail indisponible : ${esc(error.message)}</p>`; return; }
  const coachs = (data || []).filter((r) => r.role === "coach").map((r) => r.nom);
  const joueurs = (data || []).filter((r) => r.role === "joueur").map((r) => r.nom);
  const bloc = (titre, liste) => liste.length
    ? `<p class="cs-lbl" style="margin:0 0 6px">${titre} <span class="muted">(${liste.length})</span></p>
       <ul style="margin:0 0 16px;padding-left:18px">${liste.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
    : `<p class="cs-lbl" style="margin:0 0 6px">${titre}</p><p class="muted" style="margin:0 0 16px">—</p>`;
  body.innerHTML = bloc("Encadrants", coachs) + bloc("Joueurs", joueurs);
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
  tennisNav = null; $("return-course").classList.add("hidden"); $("tennis-nav")?.classList.add("hidden");   // barre Tennis ré-affichée seulement via openPersonToTennis
  $("person-title").textContent = p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Fiche" : "Nouvelle personne";
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
  const mentalTabRole = canMentalView() && MENTAL_TAB_ROLES.some((r) => roles.includes(r)); // onglet Mental : encadrement mental + jeune de filière
  showPersonTab("mental", mentalTabRole);
  const tennisByRole = canTennisView() && TENNIS_ROLES.some((r) => roles.includes(r)); // onglet Tennis : filières compétition→pro, accès encadrement
  showPersonTab("tennis", tennisByRole);
  const isPlayer = ["sport-etudes", "pro", "pro-u18"].some((r) => roles.includes(r)); // contrat = sport-études / pro
  showPersonTab("contrat", isPlayer);
  showPersonTab("stages", false);
  const staffPayRole = [...COACH_ROLES, "prof", "coach-mental", "concierge", "secretaire", "admin"].some((r) => roles.includes(r));  // onglet Rémunération
  showPersonTab("coach", staffPayRole);
  const salTab = staffPayRole && canSalaries();   // fiches de salaire : staff payé, vues par l'administration (la personne : Heures › Mes fiches)
  showPersonTab("salaire", salTab);
  loadPersonSalaires(p ? p.id : null, salTab);
  const isCoachPerson = COACH_ROLES.some((r) => roles.includes(r)) || roles.includes("admin") || roles.includes("superadmin"); // sous-onglet Repas = coachs + admins (vide par défaut)
  showPersonTab("repas", isCoachPerson);
  loadPersonMeals(p ? p.id : null, isCoachPerson);
  $("p-iban").value = p?.iban || "";
  $("p-salary").value = p?.salary_monthly != null ? p.salary_monthly : "";
  $("p-salary-from").value = p?.salary_from || "";
  $("p-standing").value = p?.standing_order != null ? p.standing_order : "";
  $("p-byinv").checked = !!p?.pays_by_invoice;
  loadCoachRates(p ? p.id : null);
  loadPersonPay(p ? p.id : null, staffPayRole && canSalaries());
  setPersonTab("info");
  loadObjectives(p ? p.id : null);
  loadMedia(p ? p.id : null);
  loadPersonSeasons(p ? p.id : null);
  loadPersonPhysNotes(p ? p.id : null, !!p && canPhysNotes() && PHYS_NOTE_ROLES.some((r) => roles.includes(r)));   // fil « Physique » (sport-études / pro / pro U18)
  if (p) { loadReservations(p.id, resaByRole); loadCourses(p.id, coursByRole); loadPersonPhys(p.id, physByRole); loadPersonEtudes(p.id, etudesByRole); loadPersonSuivi(p.id, physByRole); loadPersonTennis(p.id, tennisByRole); loadPersonMental(p.id, mentalTabRole); loadPersonContract(p.id, isPlayer); loadPersonMatchs(p.id, physByRole || !!p.license_no); loadPersonStages(p.id); }
  else { $("resa-list").innerHTML = ""; $("resa-stats").innerHTML = ""; $("cours-content").innerHTML = ""; $("pp-results").innerHTML = ""; $("pe-stats").innerHTML = ""; $("ps-chan").innerHTML = ""; $("ptn-body").innerHTML = ""; $("pm-comp").innerHTML = ""; $("pc-body").innerHTML = ""; $("mrf-mount").innerHTML = ""; $("ps-participations").innerHTML = ""; }
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

// ---- Onglet « Tennis » de la fiche (commentaires techniques par thème et par saison) ----
// Filières concernées (person_roles) + accès de l'utilisateur (myAppRoles).
const TENNIS_ROLES = ["competition", "performance", "sport-etudes", "pro-u18", "pro"];
const TENNIS_THEMES = [["global", "Global"], ["coup_droit", "Coup droit"], ["revers", "Revers"], ["slice", "Slice"], ["service", "Service"], ["volee", "Volée"], ["tactique", "Tactique"]];
// Accès mental (canal de discussion + formulaires) : coach mental / head coach / admin / superadmin.
const MENTAL_TAB_ROLES = ["competition", "performance", "sport-etudes", "pro-u18", "pro"];
const canMentalView = () => hasAny(myAppRoles, ["coach_mental", "head_coach", "admin", "superadmin"]);
const canTennisView = () => hasAny(myAppRoles, ["coach", "head_coach", "coach_physique", "moniteur", "admin", "superadmin"]);
const canTennisEdit = () => hasAny(myAppRoles, ["head_coach", "admin", "superadmin"]);
// Nom cliquable (souligné) dans « Cours » : l'utilisateur a accès ET la personne a l'onglet Tennis.
const tennisReachable = (pid) => canTennisView() && hasRoleIn(pid, TENNIS_ROLES);
let courseRosters = {};        // course_id -> [pids éligibles Tennis] (rempli par loadCoursesDay)
let tennisNav = null;          // { list:[pids], idx, back:"cours" } quand on parcourt un cours

function openPersonToTennis(pid, courseId) {
  const back = document.querySelector(".view:not(.hidden)")?.id?.replace("view-", "") || "cours"; // d'où on vient
  const roster = (courseId && courseRosters[courseId] && courseRosters[courseId].length) ? courseRosters[courseId] : [pid];
  showTennisPlayer({ list: roster, idx: Math.max(0, roster.indexOf(pid)), back });
}
function showTennisPlayer(nav) {
  const pid = nav.list[nav.idx], p = people.find((x) => x.id === pid); if (!p) return;
  showView("membres");     // referme toute fiche + affiche la section Répertoire
  openPerson(p);           // remet à zéro la barre (return + nav)
  setPersonTab("tennis");
  tennisNav = nav;         // restauré APRÈS openPerson
  $("return-course").classList.remove("hidden");
  renderTennisNav();
}
function renderTennisNav() {
  const el = $("tennis-nav"); if (!el) return;
  if (!tennisNav || tennisNav.list.length < 2) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  $("tn-nav-pos").textContent = `${tennisNav.idx + 1} / ${tennisNav.list.length}`;
}
function tennisNavStep(d) {
  if (!tennisNav) return;
  const n = tennisNav.list.length;
  showTennisPlayer({ ...tennisNav, idx: (tennisNav.idx + d + n) % n });
}

// ===================================================================
//  Saison hiver — planning FIXE des abonnements (pour facturer l'hiver)
// ===================================================================
const WP_COURTS = ["4", "5", "6", "7", "10", "11", "Fitness"];
const WP_START_HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);   // 8h15 .. 21h15
const WP_DAYS = [["Lundi", 1], ["Mardi", 2], ["Mercredi", 3], ["Jeudi", 4], ["Vendredi", 5]];
// Statuts : libre → TeamLausanne(gratuit=0) → pré-réservé membre → pré-réservé non-membre → tarif membre → tarif normal(non-membre) → libre
const WP_ST_NEXT = { libre: "gratuit", gratuit: "pre_m", pre_m: "pre_nm", pre_nm: "membre", membre: "normal", normal: "libre" };
const WP_ST_ALL = ["libre", "gratuit", "pre_m", "pre_nm", "membre", "normal"];
const WP_ST_LABEL = { gratuit: "TeamLausanne (gratuit)", pre_m: "Pré-réservé membre", pre_nm: "Pré-réservé non-membre", membre: "Tarif membre", normal: "Tarif normal (non-membre)", libre: "Libre" };
let wpPrices = {}, wpPeak = {};
const wpPeakAt = (day, slot) => (wpPeak[String(day)] || []).includes(8 + slot);
function wpPriceOf(st, day, slot) {
  const peak = wpPeakAt(day, slot);
  if (st === "membre" || st === "pre_m") return Number(wpPrices[peak ? "hiver_membre_pleine" : "hiver_membre_creuse"] || 0);
  if (st === "normal" || st === "pre_nm") return Number(wpPrices[peak ? "hiver_nonmembre_pleine" : "hiver_nonmembre_creuse"] || 0);
  return 0;
}
const wpPriceTxt = (st, pr) => pr > 0 ? ((st === "pre_m" || st === "pre_nm") ? "~" + pr : String(pr)) : "";   // « ~ » = pré-réservé
function winterSeasonLabel() {
  const d = new Date(), y = d.getFullYear();
  const startY = d.getMonth() >= 4 ? y : y - 1;   // mai→déc = hiver y/y+1 ; janv→avril = (y-1)/y
  return `${startY}-${startY + 1}`;
}
let wpSeason = null, wpName = {}, wpStatus = {}, wpDay = 1;
async function loadWinter() {
  wpSeason = winterSeasonLabel();
  $("wp-season").textContent = wpSeason.replace("-", " – ");
  const [{ data }, { data: cfg }] = await Promise.all([
    sb.from("winter_plan").select("day,court,slot,player_name,status").eq("season", wpSeason),
    sb.from("app_settings").select("key,value").in("key", ["sub_prices", "peak"]),
  ]);
  wpPrices = {}; wpPeak = {};
  (cfg || []).forEach((r) => { if (r.key === "sub_prices") wpPrices = r.value || {}; if (r.key === "peak") wpPeak = r.value || {}; });
  wpName = {}; wpStatus = {};
  (data || []).forEach((r) => {
    const k = `${r.day}_${r.court}_${r.slot}`; wpName[k] = r.player_name || "";
    let s = r.status || "libre"; if (s === "coach") s = "membre"; if (s === "pre" || s === "confirme") s = "pre_nm";  // anciens statuts
    wpStatus[k] = s;
  });
  $("wp-days").innerHTML = WP_DAYS.map(([lbl, d]) =>
    `<button type="button" class="wp-day${d === wpDay ? " active" : ""}" data-day="${d}">${lbl}</button>`).join("");
  $("wp-days").querySelectorAll(".wp-day").forEach((b) =>
    b.addEventListener("click", () => { wpDay = Number(b.dataset.day); renderWinterGrid(); }));
  renderWinterGrid();
}
function renderWinterGrid() {
  $("wp-days").querySelectorAll(".wp-day").forEach((b) => b.classList.toggle("active", Number(b.dataset.day) === wpDay));
  const surf = (c) => c === "Fitness" ? "wp-surf-fitness" : ["4", "5", "6", "7"].includes(c) ? "wp-surf-clay" : ["10", "11"].includes(c) ? "wp-surf-indoor" : "";
  const head = `<tr><th class="wp-h-time"></th>${WP_COURTS.map((c) =>
    `<th class="wp-colh ${surf(c)}" data-court="${esc(c)}"><span>${c === "Fitness" ? "Fitness" : "Court " + c}</span>`
    + `<button type="button" class="wp-colmove" draggable="true" data-court="${esc(c)}" title="Glisser pour déplacer TOUTE la colonne vers un autre court">⠿ déplacer</button></th>`).join("")}</tr>`;
  const rows = WP_START_HOURS.map((h) => {
    const slot = h - 8, tlabel = `${h}h15&nbsp;–&nbsp;${h + 1}h15`;
    const cells = WP_COURTS.map((c) => {
      const k = `${wpDay}_${c}_${slot}`, val = wpName[k] || "", st = wpStatus[k] || "libre";
      const pr = wpPriceOf(st, wpDay, slot);
      return `<td class="wp-td wp-st-${st}" data-court="${esc(c)}" data-slot="${slot}"><div class="wp-cellin">`
        + `<button type="button" class="wp-dot" title="${esc(WP_ST_LABEL[st] || st)} — cliquer pour changer"></button>`
        + `<input type="text" class="wp-cell" value="${esc(val)}" placeholder="—" />`
        + `<span class="wp-price" title="${wpPeakAt(wpDay, slot) ? "heure pleine" : "heure creuse"}">${wpPriceTxt(st, pr)}</span></div></td>`;
    }).join("");
    return `<tr><th class="wp-time${wpPeakAt(wpDay, slot) ? " wp-peak" : ""}">${tlabel}</th>${cells}</tr>`;
  }).join("");
  $("wp-grid").innerHTML = `<table class="wp-table">${head}${rows}</table>`;
  renderWinterTotals();
  $("wp-grid").querySelectorAll(".wp-td").forEach((td) => {
    const court = td.dataset.court, slot = Number(td.dataset.slot);
    td.querySelector(".wp-cell").addEventListener("change", (e) => saveWinterCell(court, slot, e.target.value.trim(), td));
    const dot = td.querySelector(".wp-dot");
    dot.addEventListener("click", () => cycleWinterStatus(court, slot, td));
    // Glisser la pastille = déplacer 1 cours (échange les 2 cases).
    dot.setAttribute("draggable", "true");
    dot.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", `cell|${court}|${slot}`); e.dataTransfer.effectAllowed = "move"; td.classList.add("wp-dragging"); });
    dot.addEventListener("dragend", () => td.classList.remove("wp-dragging"));
    td.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; td.classList.add("wp-drop"); });
    td.addEventListener("dragleave", () => td.classList.remove("wp-drop"));
    td.addEventListener("drop", (e) => {
      e.preventDefault(); td.classList.remove("wp-drop");
      const d = (e.dataTransfer.getData("text/plain") || "").split("|");
      if (d[0] === "cell") swapWinter(d[1], Number(d[2]), court, slot);
    });
  });
  // Déplacer TOUTE une colonne (toutes les leçons du court) vers un autre court.
  $("wp-grid").querySelectorAll("th.wp-colh").forEach((th) => {
    const court = th.dataset.court, mv = th.querySelector(".wp-colmove");
    mv.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", `col|${court}`); e.dataTransfer.effectAllowed = "move"; th.classList.add("wp-dragging"); });
    mv.addEventListener("dragend", () => th.classList.remove("wp-dragging"));
    th.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; th.classList.add("wp-drop"); });
    th.addEventListener("dragleave", () => th.classList.remove("wp-drop"));
    th.addEventListener("drop", (e) => {
      e.preventDefault(); th.classList.remove("wp-drop");
      const d = (e.dataTransfer.getData("text/plain") || "").split("|");
      if (d[0] === "col") swapWinterColumns(d[1], court);
    });
  });
}
async function swapWinterColumns(sc, dc) {
  if (sc === dc) return;
  const ups = [];
  for (let slot = 0; slot < 14; slot++) {
    const ks = `${wpDay}_${sc}_${slot}`, kd = `${wpDay}_${dc}_${slot}`;
    const sN = wpName[ks] || "", sSt = wpStatus[ks] || "libre", dN = wpName[kd] || "", dSt = wpStatus[kd] || "libre";
    wpName[ks] = dN; wpStatus[ks] = dSt; wpName[kd] = sN; wpStatus[kd] = sSt;
    ups.push(winterUpsert(sc, slot), winterUpsert(dc, slot));
  }
  renderWinterGrid();
  await Promise.all(ups);
}
async function swapWinter(sc, ss, dc, ds) {
  if (sc === dc && ss === ds) return;
  const ks = `${wpDay}_${sc}_${ss}`, kd = `${wpDay}_${dc}_${ds}`;
  const sN = wpName[ks] || "", sSt = wpStatus[ks] || "libre";
  const dN = wpName[kd] || "", dSt = wpStatus[kd] || "libre";
  wpName[ks] = dN; wpStatus[ks] = dSt;   // échange
  wpName[kd] = sN; wpStatus[kd] = sSt;
  renderWinterGrid();
  await Promise.all([winterUpsert(sc, ss), winterUpsert(dc, ds)]);
}
async function winterUpsert(court, slot) {
  const k = `${wpDay}_${court}_${slot}`;
  return sb.from("winter_plan").upsert({
    season: wpSeason, day: wpDay, court, slot,
    player_name: wpName[k] || null, status: wpStatus[k] || "libre",
    updated_at: new Date().toISOString(), updated_by: meId,
  }, { onConflict: "season,day,court,slot" });
}
async function saveWinterCell(court, slot, name, td) {
  wpName[`${wpDay}_${court}_${slot}`] = name;
  const inp = td.querySelector(".wp-cell"); inp.classList.remove("wp-err");
  const { error } = await winterUpsert(court, slot);
  if (error) { inp.classList.add("wp-err"); return; }
  inp.classList.add("wp-saved"); setTimeout(() => inp.classList.remove("wp-saved"), 800);
}
async function cycleWinterStatus(court, slot, td) {
  const k = `${wpDay}_${court}_${slot}`;
  const next = WP_ST_NEXT[wpStatus[k]] || "gratuit"; wpStatus[k] = next;
  WP_ST_ALL.forEach((s) => td.classList.remove("wp-st-" + s));
  td.classList.add("wp-st-" + next);
  const pr = wpPriceOf(next, wpDay, slot), ps = td.querySelector(".wp-price"); if (ps) ps.textContent = wpPriceTxt(next, pr);
  const dot = td.querySelector(".wp-dot"); if (dot) dot.title = (WP_ST_LABEL[next] || next) + " — cliquer pour changer";
  renderWinterTotals();
  await winterUpsert(court, slot);
}
// Totaux (toute la semaine, toutes les cases à statut payant) : par catégorie, confirmé vs pré-réservé, par jour.
function renderWinterTotals() {
  const host = $("wp-totals"); if (!host) return;
  const cats = { membre: 0, normal: 0, pre_m: 0, pre_nm: 0 }, perDay = {}, nFree = {};
  for (const k of Object.keys(wpStatus)) {
    const st = wpStatus[k]; const p = k.split("_"); const day = Number(p[0]), slot = Number(p[2]);
    if (st === "gratuit") { nFree[day] = (nFree[day] || 0) + 1; continue; }
    if (!(st in cats)) continue;
    const pr = wpPriceOf(st, day, slot); cats[st] += pr;
    if (st === "membre" || st === "normal") perDay[day] = (perDay[day] || 0) + pr;
  }
  const conf = cats.membre + cats.normal, pre = cats.pre_m + cats.pre_nm;
  const chf = (n) => (Math.round(n * 100) / 100).toLocaleString("fr-CH") + " CHF";
  const tile = (cls, lbl, v, sub) => `<div class="wp-tile ${cls}"><span class="wp-tile-l">${lbl}</span><b>${v}</b>${sub ? `<span class="wp-tile-s">${sub}</span>` : ""}</div>`;
  const nFreeTot = Object.values(nFree).reduce((a, b) => a + b, 0);
  host.innerHTML = `<div class="wp-tiles">
      ${tile("membre", "Tarif membre", chf(cats.membre))}${tile("normal", "Tarif normal (non-membre)", chf(cats.normal))}
      ${tile("pre_m", "Pré-réservé membre", chf(cats.pre_m))}${tile("pre_nm", "Pré-réservé non-membre", chf(cats.pre_nm))}
      ${tile("gratuit", "TeamLausanne (gratuit)", nFreeTot + " case" + (nFreeTot > 1 ? "s" : ""))}
    </div>
    <div class="wp-tiles wp-tiles-main">
      ${tile("big", "Semaine — confirmé", chf(conf), "membre + non-membre")}${tile("pot", "+ pré-réservé", chf(pre), "potentiel")}
      ${WP_DAYS.map(([lbl, d]) => tile("day", lbl, chf(perDay[d] || 0), "confirmé")).join("")}
    </div>`;
}

// ===================================================================
//  Last scores — résultats récents des joueurs du répertoire (4 dernières semaines)
// ===================================================================
let lsWired = false, lsData = [];
async function loadLastScores() {
  if (!lsWired) {
    lsWired = true;
    $("ls-days").addEventListener("change", loadLastScores);
    $("ls-perfonly").addEventListener("change", renderLastScores);
    $("ls-player").addEventListener("change", renderLastScores);
  }
  const body = $("ls-body"); body.innerHTML = '<p class="muted">Chargement…</p>';
  const days = Number($("ls-days").value) || 14;
  const { data, error } = await sb.rpc("last_scores", { p_days: days });
  if (error) { body.innerHTML = `<p class="error">Erreur : ${esc(error.message)}</p>`; return; }
  lsData = data || [];
  // Liste déroulante des joueurs présents (triée par nom), en gardant la sélection si possible.
  const sel = $("ls-player"), cur = sel.value;
  const players = [...new Map(lsData.map((r) => [r.person_id, r.person_name])).entries()]
    .sort((a, b) => (a[1] || "").localeCompare(b[1] || ""));
  sel.innerHTML = `<option value="">Tous les joueurs</option>` + players.map(([id, nm]) => `<option value="${id}">${esc(nm || "—")}</option>`).join("");
  if (players.some(([id]) => id === cur)) sel.value = cur;
  renderLastScores();
}
function renderLastScores() {
  const body = $("ls-body"); if (!body) return;
  const pf = $("ls-player").value;
  let rows = pf ? lsData.filter((r) => r.person_id === pf) : lsData;
  if ($("ls-perfonly").checked) rows = rows.filter((r) => r.is_perf);
  const nPerf = lsData.filter((r) => r.is_perf).length;
  $("ls-sub").textContent = `— ${lsData.length} résultat${lsData.length > 1 ? "s" : ""} · ${nPerf} perf${nPerf > 1 ? "s" : ""}`;
  if (!rows.length) { body.innerHTML = '<p class="obj-empty">Aucun résultat sur la période.</p>'; return; }
  const cls = (c) => c ? ` <span class="ls-cls">${esc(c)}</span>` : "";
  body.innerHTML = `<div class="table-wrap"><table class="crm-table ls-table"><thead><tr>
      <th>Date</th><th>Tournoi</th><th>Joueur</th><th>Adversaire</th><th>Score</th></tr></thead><tbody>`
    + rows.map((r) => {
      const res = r.won === true ? '<span class="pm-w">V</span> ' : r.won === false ? '<span class="pm-l">D</span> ' : "";
      return `<tr class="${r.is_perf ? "ls-perf" : ""}">
        <td class="ls-date">${r.match_date ? frDate(r.match_date) : "—"}</td>
        <td>${esc(r.tournament_name || "—")}</td>
        <td><b>${esc(r.person_name || "—")}</b>${cls(r.person_class)}</td>
        <td>${esc(r.opponent_name || "—")}${cls(r.opponent_class)}</td>
        <td class="ls-score">${res}${esc(r.score || "")}${r.is_perf ? ' <span class="ls-badge">PERF</span>' : ""}</td>
      </tr>`;
    }).join("") + "</tbody></table></div>";
}

// ===================================================================
//  Dashboard (head coach / admin / superadmin) — vue anti-oubli
// ===================================================================
const dDaysAgo = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : 99999;
const dFD = (iso) => iso ? frDate(String(iso).slice(0, 10)) : "—";
function dashCard(title, inner) { return `<section class="dash-card"><h2 class="dash-h">${esc(title)}</h2>${inner}</section>`; }
async function loadDashboard() {
  const body = $("dash-body");
  if (!$("dash-refresh").dataset.w) { $("dash-refresh").dataset.w = "1"; $("dash-refresh").addEventListener("click", loadDashboard); }
  body.innerHTML = '<p class="muted">Chargement…</p>';
  const { data, error } = await sb.rpc("dashboard_data");
  if (error) { body.innerHTML = `<p class="error">${esc(error.message)}</p>`; return; }
  const D = data || {};
  $("dash-gen").textContent = D.generated_at ? "— " + frDateTime(D.generated_at) : "";
  body.innerHTML = `<div class="dash-grid">`
    + dashGeneral(D.general || {}) + dashMail(D.mail || {})
    + dashGroup("Pro · Pro U18 · Sport-études", D.se || {})
    + dashGroup("Compétition & Performance", D.comp || {})
    + dashClub(D.club || {}) + dashProspects(D.prospects || {}, (D.general || {}).lastup || {}) + `</div>`;
  // « Voir tous » : révèle les lignes masquées (.dash-more) du même bloc.
  body.querySelectorAll(".dash-showmore").forEach((b) => b.addEventListener("click", () => {
    let el = b.previousElementSibling;
    while (el && el.classList.contains("dash-li")) { el.classList.remove("hidden"); el = el.previousElementSibling; }
    b.remove();
  }));
}
function dashGeneral(g) {
  const lu = g.lastup || {};
  const line = (label, at, by) => { const red = dDaysAgo(at) > 10; return `<div class="dash-row"><span>${esc(label)}</span><span class="${red ? "dash-red" : ""}">${at ? dFD(at) : "jamais"}${by ? " · " + esc(by) : ""}${red ? " ⚠️" : ""}</span></div>`; };
  const cov = ((g.nocoach || []).length || (g.coachabs || []).length)
    ? (g.nocoach || []).map((c) => `<div class="dash-alert">Cours sans coach : <b>${esc(c.label)}</b> — ${dFD(c.date)}</div>`).join("")
      + (g.coachabs || []).map((c) => `<div class="dash-alert">Seul coach absent : <b>${esc(c.label)}</b> — ${dFD(c.date)}</div>`).join("")
    : `<div class="dash-ok">✓ Tous les cours à venir ont un coach attribué.</div>`;
  const unvAll = [...(g.unvalidated || []).map((c) => ({ date: c.date, label: c.label })),
                  ...(g.unvalidated_et || []).map((c) => ({ date: c.date, label: "Études" }))]
                 .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));  // plus récent en haut
  const unval = unvAll.length
    ? unvAll.map((c) => `<div class="dash-li">${dFD(c.date)} — ${esc(c.label)}</div>`).join("")
    : `<div class="dash-ok">✓ Tout est validé.</div>`;
  const bdays = g.birthdays || [];
  const bday = bdays.length
    ? bdays.map((b) => {
        const when = b.off === 0 ? "🎂 aujourd'hui" : b.off > 0 ? `dans ${b.off} j` : `il y a ${-b.off} j`;
        return `<div class="dash-li${b.off === 0 ? " dash-bday-today" : ""}"><b>${esc(b.name)}</b> — ${when} <span class="muted">(${b.age} ans)</span></div>`;
      }).join("")
    : '<div class="muted">Aucun anniversaire à ±3 jours.</div>';
  return dashCard("Général",
    `<h3 class="dash-sub">Dernières mises à jour <span class="muted" style="font-weight:400;font-size:.8rem">(⚠️ rouge = &gt; 10 jours)</span></h3>
     ${line("Tournois GameZone", lu.gz_at, lu.gz_by)}${line("Importer les matchs TeamLausanne", lu.matchs_at, lu.matchs_by)}
     <h3 class="dash-sub">Couverture coachs (cours à venir)</h3>${cov}
     <h3 class="dash-sub">Cours / études passés non validés (21 j)</h3>${unval}
     <h3 class="dash-sub">Anniversaires (J−3 → J+3)</h3>${bday}`);
}
function dashMail(m) {
  const boxes = (m.boxes || []).map((b) => `<div class="dash-row"><span>${esc(b.label)}</span><span><b>${b.recv7}</b> reçus</span></div>`).join("");
  const done = (m.done7 || []).map((d) => `<div class="dash-row"><span>${esc(d.who || "—")}</span><span>${d.traite} traité · ${d.repondu} répondu</span></div>`).join("") || '<div class="muted">—</div>';
  const avgby = (m.avg_by || []).map((d) => `<div class="dash-row"><span>${esc(d.who || "—")}</span><span>${d.hours != null ? d.hours + " h" : "—"} <span class="muted">(${d.n})</span></span></div>`).join("") || '<div class="muted">—</div>';
  return dashCard("Messagerie",
    `<h3 class="dash-sub">Reçus (7 jours)</h3>${boxes}
     <div class="dash-row"><span><b>À traiter</b> (toutes boîtes)</span><span class="${(m.a_traiter || 0) > 0 ? "dash-red" : ""}">${m.a_traiter || 0}</span></div>
     <h3 class="dash-sub">Traités / répondus (7 j) par personne</h3>${done}
     <h3 class="dash-sub">Délai moyen « à traiter → traité »</h3>
     <div class="dash-row"><span>Global</span><span>${m.avg_all_h != null ? m.avg_all_h + " h" : "—"}</span></div>${avgby}`);
}
function dashGroup(title, g) {
  const y = g.youths || [];
  const abs = y.filter((x) => (x.absences || []).length).map((x) => `<div class="dash-li"><b>${esc(x.name)}</b> : ${x.absences.map((a) => `${esc(a.label)} (${dFD(a.date)})`).join(", ")}</div>`).join("") || '<div class="dash-ok">✓ Aucune absence.</div>';
  const ret = y.filter((x) => (x.retards || []).length).map((x) => `<div class="dash-li"><b>${esc(x.name)}</b> : ${x.retards.map((a) => `${esc(a.label)} (${dFD(a.date)})`).join(", ")}</div>`).join("") || '<div class="dash-ok">✓ Aucun retard.</div>';
  const staleList = y.filter((x) => !x.tennis_last || dDaysAgo(x.tennis_last) > 21);
  const stale = staleList.length
    ? staleList.map((x, i) => `<div class="dash-li${i >= 5 ? " dash-more hidden" : ""}"><b>${esc(x.name)}</b> — ${x.tennis_last ? "dernière : " + dFD(x.tennis_last) : "aucune remarque"}</div>`).join("")
      + (staleList.length > 5 ? `<button type="button" class="dash-showmore ghost">Voir tous (${staleList.length})</button>` : "")
    : '<div class="dash-ok">✓ Tous ont une remarque récente.</div>';
  const forms = y.map((x) => `<div class="dash-row"><span>${esc(x.name)}</span><span>${x.coach_forms || 0}</span></div>`).join("") || '<div class="muted">—</div>';
  const suivi = (g.suivi || []).map((s) => `<div class="dash-li">${dFD(s.date)} · <b>${esc(s.youth || "—")}</b> — ${esc(s.author || "—")}${s.role ? ` (${esc(s.role)})` : ""} : ${esc(s.body || "")}</div>`).join("") || '<div class="muted">—</div>';
  const ls = (g.lastscores || []).map((s) => `<div class="dash-li${s.won ? " dash-win" : ""}">${dFD(s.date)} · <b>${esc(s.youth)}</b> vs ${esc(s.opponent || "—")}${s.oc ? ` (${esc(s.oc)})` : ""} — ${s.won === true ? "V" : s.won === false ? "D" : ""} ${esc(s.score || "")}</div>`).join("") || '<div class="muted">—</div>';
  const rep = (g.reports || []).map((s) => `<div class="dash-li">${dFD(s.date)} · <b>${esc(s.youth)}</b> vs ${esc(s.opponent || "—")} — ${s.result === "gagne" ? "Gagné" : s.result === "perdu" ? "Perdu" : ""} ${esc(s.score || "")} <span class="dash-tag">${esc(s.role)}</span></div>`).join("") || '<div class="muted">—</div>';
  return dashCard(title,
    `<h3 class="dash-sub">Absences (10 j)</h3>${abs}
     <h3 class="dash-sub">Retards (10 j)</h3>${ret}
     <h3 class="dash-sub">Sans remarque « Tennis » depuis &gt; 3 semaines</h3>${stale}
     <h3 class="dash-sub">Derniers messages « Suivi »</h3><div class="dash-scroll">${suivi}</div>
     <h3 class="dash-sub">Matchs (14 j)</h3><div class="dash-scroll">${ls}</div>
     <h3 class="dash-sub">Feuilles de match</h3><div class="dash-scroll">${rep}</div>
     <h3 class="dash-sub">Feuilles remplies par un coach (saison)</h3><div class="dash-scroll">${forms}</div>`);
}
function dashClub(c) {
  const abs = (c.abs_streak || []).map((x) => `<div class="dash-li"><b>${esc(x.name)}</b> — ${x.streak} absences de suite</div>`).join("") || '<div class="dash-ok">✓ Personne avec &gt; 2 absences de suite (2 sem.).</div>';
  const ret = (c.retards || []).map((x) => `<div class="dash-li"><b>${esc(x.name)}</b> — ${x.n} retards</div>`).join("") || '<div class="dash-ok">✓ Personne avec &gt; 3 retards (saison).</div>';
  return dashCard("Club & KidsTennis",
    `<h3 class="dash-sub">Plus de 2 absences de suite (2 semaines)</h3>${abs}
     <h3 class="dash-sub">Plus de 3 retards (saison)</h3>${ret}`);
}

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
  const [att, segs, books] = await Promise.all([
    fetchInChunks("attendance", "course_id,person_id,status", "course_id", courseIds, (q) => q.eq("is_coach", false)),
    fetchInChunks("course_segments", "id,course_id,minutes,note", "course_id", courseIds),
    fetchInChunks("court_bookings", "court_id,course_id", "course_id", courseIds),
  ]);
  // Un cours réservé sur le court « Fitness » compte comme physique (même si son type ne dit pas « physique »).
  const fitnessCourtIds = new Set(resaCourtsAll.filter(isFitnessCourt).map((c) => c.id));
  const physByCourt = new Set((books || []).filter((b) => fitnessCourtIds.has(b.court_id)).map((b) => b.course_id));
  const sp = segs.length ? await fetchInChunks("course_segment_players", "segment_id,person_id", "segment_id", segs.map((x) => x.id)) : [];
  const attByCourse = {}; att.forEach((a) => ((attByCourse[a.course_id] || (attByCourse[a.course_id] = {}))[a.person_id] = a.status));
  const segByCourse = {}; segs.forEach((sg) => (segByCourse[sg.course_id] || (segByCourse[sg.course_id] = [])).push(sg));
  const playersBySeg = {}; sp.forEach((r) => (playersBySeg[r.segment_id] || (playersBySeg[r.segment_id] = [])).push(r.person_id));
  const isPhys = (name) => /physique|fitness/i.test(name || "");
  const mk = () => ({ present: 0, absent: 0, late: 0, annonce: 0, g: { 1: 0, 2: 0, 3: 0, 4: 0 }, withMin: {}, total: 0, themes: {} });
  // Notes des blocs (« Coup droit », « Service + volée »…) regroupées par thème : même texte à l'accent, la casse,
  // la ponctuation et le pluriel près → une seule ligne, avec le total d'heures et les dates.
  const themeKey = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean).map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)).join(" ");
  const addTheme = (d, note, minutes, date) => {
    const raw = String(note || "").trim(); if (!raw) return;
    const k = themeKey(raw); if (!k) return;
    const t = d.themes[k] || (d.themes[k] = { minutes: 0, n: 0, dates: [], labels: {} });
    t.minutes += minutes; t.n++; if (!t.dates.includes(date)) t.dates.push(date);
    t.labels[raw] = (t.labels[raw] || 0) + 1;
  };
  const D = { tennis: mk(), phys: mk() };
  mine.forEach((p) => {
    const c = p.courses, cid = p.course_id;
    const d = (isPhys(c.course_types?.name) || physByCourt.has(cid)) ? D.phys : D.tennis;
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
        addTheme(d, sg.note, m, c.course_date);
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
  body.innerHTML = coursBoxHtml("Tennis", D.tennis, "tn") + coursBoxHtml("Physique", D.phys, "ph");
  body.querySelectorAll(".cours-more").forEach((b) => b.addEventListener("click", () => { const r = $(b.dataset.t + "-rest"); if (r) r.classList.remove("hidden"); b.remove(); }));
}

// Icônes « Team Lausanne » (trait bleu, comme le menu) : raquette pour Tennis, haltère pour Physique.
const COURS_ICONS = {
  tn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="14.5" cy="8.5" rx="5.5" ry="6.5" transform="rotate(35 14.5 8.5)"/><path d="M11 13.5 4.5 20"/><path d="M12.2 6.2l4.6 4.6M10.4 8.6l4.6 4.6M14.3 4.4l4.6 4.6"/><circle cx="5" cy="19.5" r="1.4"/></svg>',
  ph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4M21 10v4"/><rect x="5" y="8" width="3" height="8" rx="1"/><rect x="16" y="8" width="3" height="8" rx="1"/><path d="M8 12h8"/></svg>',
};
function coursBoxHtml(title, d, key) {
  const fmt = (m) => { const h = Math.floor(m / 60), r = m % 60; return h && r ? `${h}h${String(r).padStart(2, "0")}` : h ? `${h}h` : `${r}min`; };
  const head = `<div class="cours-box-h"><span class="cours-ico">${COURS_ICONS[key] || ""}</span>${esc(title)}</div>`;
  const marked = d.present + d.absent + d.late;
  if (!marked && !d.annonce) return `<div class="cours-box">${head}<p class="muted" style="font-size:.85rem;margin:6px 0 0">Aucun cours cette saison.</p></div>`;
  const pct = marked ? Math.round((d.present / marked) * 100) : 0;
  const partners = Object.entries(d.withMin).map(([id, m]) => ({ id, m })).sort((a, b) => b.m - a.m);
  const row = (p) => `<div class="att-row"><span class="att-d">${esc(trFull(p.id))}</span><span class="att-badge">${fmt(p.m)}</span></div>`;
  const shown = partners.slice(0, 8), rest = partners.slice(8);
  const partHtml = partners.length
    ? shown.map(row).join("") + (rest.length ? `<div id="${key}-rest" class="hidden">${rest.map(row).join("")}</div><button type="button" class="ghost cours-more" data-t="${key}" style="margin-top:6px">Afficher plus (${rest.length})</button>` : "")
    : '<span class="muted" style="font-size:.85rem">— personne —</span>';
  const chip = (cls, n, l) => `<span class="ck-chip ${cls}"><b>${n}</b> ${l}</span>`;
  // Thèmes travaillés (notes des blocs du head coach), regroupés, triés par temps, dans un menu replié.
  const themes = Object.values(d.themes || {}).map((t) => {
    const label = Object.entries(t.labels).sort((a, b) => b[1] - a[1])[0][0];
    const variants = Object.keys(t.labels).filter((l) => l !== label);
    return { label, variants, minutes: t.minutes, n: t.n, dates: t.dates.sort() };
  }).sort((a, b) => b.minutes - a.minutes);
  const themesHtml = themes.length ? `<details class="cours-themes">
      <summary><b>Thèmes travaillés</b> <span class="muted">— ${themes.length} thème${themes.length > 1 ? "s" : ""} · ${fmt(themes.reduce((a, t) => a + t.minutes, 0))}</span></summary>
      <div class="cours-themes-list">${themes.map((t) => `<div class="cours-theme" title="${esc(t.dates.map(frDate).join(", "))}">
        <span class="ct-lbl">${esc(t.label)}${t.variants.length ? ` <span class="muted ct-var">(aussi : ${esc(t.variants.join(", "))})</span>` : ""}</span>
        <span class="ct-meta"><b>${fmt(t.minutes)}</b> · ${t.n} bloc${t.n > 1 ? "s" : ""} · ${t.dates.length} jour${t.dates.length > 1 ? "s" : ""}</span></div>`).join("")}</div>
    </details>` : "";
  return `<div class="cours-box">
    ${head}
    <div class="cours-kpis">
      <div class="cours-kpi">
        <div class="ck-lbl">Présences</div>
        <div class="ck-val">${marked ? pct + " %" : "—"}<span class="ck-unit">${marked ? ` de présence sur ${marked} cours` : ""}</span></div>
        <div class="ck-chips">${chip("ok", d.present, "présent")}${chip("late", d.late, "retard")}${chip("ko", d.absent, "absent")}${d.annonce ? chip("", d.annonce, "annoncé") : ""}</div>
      </div>
      <div class="cours-kpi">
        <div class="ck-lbl">Temps de jeu réel</div>
        <div class="ck-val">${fmt(d.total)}<span class="ck-unit"> au total</span></div>
        <div class="ck-chips">${chip("", fmt(d.g[1]), "seul")}${chip("", fmt(d.g[2]), "à 2")}${chip("", fmt(d.g[3]), "à 3")}${chip("", fmt(d.g[4]), "à 4+")}</div>
      </div>
    </div>
    ${themesHtml}
    <div class="cours-line" style="margin-top:10px"><b>Joué avec</b></div>
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
let isHeadUser = false, isAdminUser = false, isCourseMgr = false, isDisplayOnly = false;
const QH = (() => { const a = []; for (let h = 7; h <= 22; h++) for (const m of [0, 15, 30, 45]) { if (h === 22 && m > 0) break; a.push(pad2(h) + ":" + pad2(m)); } return a; })();

function initCours(roles) {
  isHeadUser = roles.some((r) => ["superadmin", "admin", "head_coach"].includes(r));
  isCourseMgr = isHeadUser || roles.includes("secretaire"); // créer/éditer des cours = head/admin + secrétariat
  isDisplayOnly = roles.includes("affichage");     // compte d'affichage : aucune interaction sur la grille
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
// Âge (en années) à la date du cours — pour l'afficher entre parenthèses aux coachs.
const ageAt = (birthdate, refIso) => {
  if (!birthdate) return null;
  const b = new Date(birthdate), r = refIso ? new Date(refIso) : new Date();
  if (isNaN(b) || isNaN(r)) return null;
  let a = r.getFullYear() - b.getFullYear();
  if (r.getMonth() < b.getMonth() || (r.getMonth() === b.getMonth() && r.getDate() < b.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
};
// ---- Matchs récents (7 jours) dans Cours : 🔥 = perf (victoire contre mieux classé), 🎾 = a joué ; popup au clic ----
let rmMap = {}, rmAt = 0;
async function loadRecentMatches() {
  if (!canTennisView()) { rmMap = {}; return; }
  if (Date.now() - rmAt < 5 * 60e3) return;                 // cache 5 min
  const { data } = await sb.rpc("last_scores", { p_days: 7 });
  rmMap = {};
  for (const m of data || []) (rmMap[m.person_id] || (rmMap[m.person_id] = [])).push(m);
  rmAt = Date.now();
}
function rmBadge(pid) {
  const list = rmMap[pid]; if (!list || !list.length) return "";
  const perf = list.some((m) => m.is_perf);
  return `<button type="button" class="att-rm" data-person="${pid}" title="${perf ? "Perf" : "A joué"} ces 7 derniers jours — clique pour le détail">${perf ? "🔥" : "🎾"}</button>`;
}
function rmPopup(pid) {
  const list = rmMap[pid] || [];
  $("rm-title").textContent = personName(pid);
  $("rm-body").innerHTML = list.length ? `<table class="crm-table"><thead><tr><th>Date</th><th>Tournoi</th><th>Adversaire</th><th>Class.</th><th>Score</th><th></th></tr></thead><tbody>
    ${list.map((m) => `<tr class="${m.is_perf ? "rm-perf" : m.won === true ? "rm-win" : m.won === false ? "rm-loss" : ""}"><td style="white-space:nowrap">${frDate(m.match_date)}</td><td>${esc(m.tournament_name || "—")}</td><td>${esc(m.opponent_name || "—")}</td><td>${esc(m.opponent_class || "—")}</td><td style="white-space:nowrap">${esc(m.score || "—")}</td><td>${m.is_perf ? "🔥 Perf" : m.won === true ? "✓ Gagné" : m.won === false ? "✗ Perdu" : "—"}</td></tr>`).join("")}
    </tbody></table>` : '<p class="muted">Aucun match ces 7 derniers jours.</p>';
  $("rm-modal").classList.remove("hidden");
}
function attChip(course, coachIds, pid, isCoach, status) {
  const can = canMarkBox(course, coachIds, pid, isCoach);
  const cls = status === "present" ? "st-present" : status === "late" ? "st-late"
    : status === "absent" ? "st-absent" : (can ? "st-none" : "st-locked");
  const bday = isBirthday(pid, course.course_date);
  // Âge entre parenthèses pour les élèves (pas les coachs).
  const p = people.find((x) => x.id === pid);
  const age = (!isCoach && p?.birthdate) ? ageAt(p.birthdate, course.course_date) : null;
  const ageTxt = age != null ? ` <span class="att-age">(${age})</span>` : "";
  const reach = !isCoach && tennisReachable(pid);   // ↗ vers la fiche Tennis
  const nm = `${bday ? "🎁 " : ""}${esc(personName(pid))}${ageTxt}`;
  const chip = `<button type="button" class="att-chip ${cls}" data-course="${course.id}" data-person="${pid}"
    data-coach="${isCoach ? 1 : 0}" data-status="${status || ""}" data-can="${can ? 1 : 0}" data-cstart="${course.course_date}T${course.start_time}"
    title="${esc(personName(pid))}${age != null ? ` · ${age} ans` : ""}${bday ? " · anniversaire 🎁" : ""}">${nm}</button>`;
  // chip + ↗ regroupés dans .att-unit → 1 seul enfant par joueur (ne casse pas le masquage « > 4 »).
  const extra = (isCoach ? "" : rmBadge(pid)) + (reach ? `<button type="button" class="att-goto" data-person="${pid}" data-course="${course.id}" title="Ouvrir la fiche › Tennis">↗</button>` : "");
  return extra ? `<span class="att-unit">${chip}${extra}</span>` : chip;
}

// Une colonne (Coachs ou Élèves) de pastilles de présence. statusFn(pid) → statut.
function attCol(course, coachIds, list, isCoach, title, statusFn) {
  return `<div class="cs-att-col"><div class="cs-att-h">${title}</div>
    <div class="cs-att-items">${list.length
      ? list.map((pid) => attChip(course, coachIds, pid, isCoach, statusFn(pid))).join("")
      : '<span class="muted" style="font-size:.8rem">—</span>'}</div></div>`;
}

async function loadCoursesDay() {
  await loadRecentMatches();   // 🔥 / 🎾 à côté des joueurs (7 jours, cache 5 min)
  const date = $("cs-date").value;
  const { data: courses } = await sb.from("courses").select("*").eq("course_date", date).order("start_time");
  const ids = (courses || []).map((c) => c.id);
  let books = [], coaches = [], parts = [], att = [], segs = [];
  if (ids.length) {
    [books, coaches, parts, att, segs] = await Promise.all([
      sb.from("court_bookings").select("court_id,course_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_coaches").select("course_id,coach_person_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_participants").select("course_id,child_person_id").in("course_id", ids).then((r) => r.data || []),
      sb.from("attendance").select("course_id,person_id,status").in("course_id", ids).then((r) => r.data || []),
      sb.from("course_segments").select("course_id,minutes,course_segment_players(person_id)").in("course_id", ids).then((r) => r.data || []),
    ]);
  }
  const courtName = (id) => (resaCourtsAll.find((c) => c.id === id)?.name || "?").replace("Court ", "C");
  const attOf = (cid, pid) => att.find((a) => a.course_id === cid && a.person_id === pid)?.status || "";
  // Couverture par joueur d'un cours DÉTAILLÉ : minutes jouées (blocs) vs durée de la séance
  // → couleur (vert complet · orange incomplet · rouge 0/absent · bleu dépassé).
  const durMin = (c) => { const a = (c.start_time || "0:0").split(":").map(Number), b = (c.end_time || "0:0").split(":").map(Number); return (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]); };
  const segMin = {}; const segCourses = new Set();
  for (const s of segs) { segCourses.add(s.course_id); for (const x of (s.course_segment_players || [])) { const cc = (segMin[s.course_id] || (segMin[s.course_id] = {})); cc[x.person_id] = (cc[x.person_id] || 0) + (s.minutes || 0); } }
  const covClass = (course, pid) => {
    if (!segCourses.has(course.id)) return null;                      // détail pas encore fait
    const tgt = durMin(course), m = (segMin[course.id] && segMin[course.id][pid]) || 0;
    return m === 0 ? "st-absent" : m > tgt ? "cov-over" : m === tgt ? "st-present" : "st-late";
  };
  const col = (course, coachIds, list, isCoach, title) => attCol(course, coachIds, list, isCoach, title, (pid) => attOf(course.id, pid));

  // Espace coach (pas manager) : n'afficher QUE les cours où il est coach.
  const shownDay = (!isCourseMgr && myPersonId) ? (courses || []).filter((c) => coaches.some((x) => x.course_id === c.id && x.coach_person_id === myPersonId)) : (courses || []);
  courseRosters = {};   // liste des élèves « fiche Tennis » par cours (pour naviguer ‹ préc / suiv ›)
  $("cs-list").innerHTML = shownDay.length ? shownDay.map((c) => {
    const cts = books.filter((b) => b.course_id === c.id).map((b) => courtName(b.court_id)).join(", ");
    const coachIds = coaches.filter((x) => x.course_id === c.id).map((x) => x.coach_person_id);
    const childIds = parts.filter((x) => x.course_id === c.id).map((x) => x.child_person_id);
    courseRosters[c.id] = childIds.filter((pid) => tennisReachable(pid));
    const type = courseTypes.find((t) => t.id === c.course_type_id);
    const needMore = Math.max(coachIds.length, childIds.length) > 4;
    const nmeOf = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.first_name} ${p.last_name}` : ""; };
    const search = esc([c.title || "", type?.name || "", ...coachIds.map(nmeOf), ...childIds.map(nmeOf)].join(" ").toLowerCase());
    // Cours détaillé (pro/SE + plusieurs courts OU coachs) : les présences des jeunes
    // se gèrent via le détail (head coach) → ici en lecture seule (non cliquables).
    const courtCount = books.filter((b) => b.course_id === c.id).length;
    const detailed = !!type && TR_TYPE_RE.test(type.name || "") && (courtCount > 1 || coachIds.length > 1);
    const elevesCol = detailed
      ? `<div class="cs-att-col"><div class="cs-att-h">Élèves <span class="muted" style="font-weight:400;font-size:.72rem">· via détail</span></div><div class="cs-att-items">${childIds.length ? childIds.map((pid) => { const cls = covClass(c, pid) || (attOf(c.id, pid) === "present" ? "st-present" : attOf(c.id, pid) === "absent" ? "st-absent" : attOf(c.id, pid) === "late" ? "st-late" : "st-none"); const pp = people.find((x) => x.id === pid); const ag = pp?.birthdate ? ageAt(pp.birthdate, c.course_date) : null; const agT = ag != null ? ` <span class="att-age">(${ag})</span>` : ""; const reach = tennisReachable(pid); const sp = `<span class="att-chip ${cls}" data-can="0" data-detail="1" style="cursor:default" title="${esc(personName(pid))}${ag != null ? ` · ${ag} ans` : ""} — présence gérée par le head coach (détail)">${esc(personName(pid))}${agT}</span>`; const ex = rmBadge(pid) + (reach ? `<button type="button" class="att-goto" data-person="${pid}" data-course="${c.id}" title="Ouvrir la fiche › Tennis">↗</button>` : ""); return ex ? `<span class="att-unit">${sp}${ex}</span>` : sp; }).join("") : '<span class="muted" style="font-size:.8rem">—</span>'}</div></div>`
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
  L.querySelectorAll(".att-goto").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); openPersonToTennis(b.dataset.person, b.dataset.course); }));
  L.querySelectorAll(".att-rm").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); rmPopup(b.dataset.person); }));
  if (!$("rm-close").dataset.w) { $("rm-close").dataset.w = "1"; $("rm-close").addEventListener("click", () => $("rm-modal").classList.add("hidden")); $("rm-modal").addEventListener("click", (e) => { if (e.target === $("rm-modal")) $("rm-modal").classList.add("hidden"); }); }
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
    // Coach : présent / absent uniquement (jamais « en retard »). Règle pour TOUT LE MONDE (coach comme manager) :
    //  - avant l'ouverture (10 min avant) → clic = absence anticipée ;
    //  - en fenêtre, appel des élèves incomplet → refus (on ne peut pas marquer le coach présent) ;
    //  - appel complet → présent.
    const cstart = chip.dataset.cstart ? new Date(chip.dataset.cstart).getTime() : 0;
    const inWindow = !chip.dataset.cstart || Date.now() >= cstart - 10 * 60000;
    const kidsPending = !allKidsMarked(course);
    if (cur === "") {
      if (!inWindow) { next = "absent"; uiAlert("Le cours n'a pas encore commencé : le coach est noté ABSENT (absence anticipée). Reclique pour effacer."); }
      else if (kidsPending) { uiAlert("Appel incomplet : marque d'abord TOUS les élèves (présent / absent / retard) avant de marquer le coach présent."); return; }
      else next = "present";
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
  const myPresent = !!att.find((a) => a.person_id === myPersonId && a.is_coach && a.status === "present");
  const anyCoachPresent = coaches.some((pid) => att.some((a) => a.person_id === pid && a.is_coach && a.status === "present"));
  renderAttValidate(courseId, coaches, myPresent, anyCoachPresent);
  $("att-modal").classList.remove("hidden");
}

// La validation de l'heure = le coach s'est marqué PRÉSENT (plus de bouton séparé).
function renderAttValidate(courseId, coaches, myPresent, anyCoachPresent) {
  const host = $("att-validate"); if (!host) return;
  const iAmCoach = myPersonId && coaches.includes(myPersonId);
  if (iAmCoach) {
    host.innerHTML = myPresent
      ? `<span class="he-val">✓ Heure comptée dans tes heures (tu es marqué présent)</span>`
      : `<span class="muted" style="font-size:.85rem">Marque-toi « présent » ci-dessus pour que cette heure compte.</span>`;
  } else {
    host.innerHTML = anyCoachPresent
      ? `<span class="he-val">✓ Coach présent — heure comptée</span>`
      : `<span class="muted" style="font-size:.85rem">Aucun coach ne s'est encore marqué présent.</span>`;
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
  const code = src.replace("__KEY__", data.import_key).replace("__RCV__", location.origin + "/mt-receiver.html").replace("__WHO__", (meName || "").replace(/["\\]/g, ""));
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
    .replace("__RCV__", location.origin + "/gz-receiver.html")
    .replace("__WHO__", (meName || "").replace(/["\\]/g, ""));
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
  $("c-children").innerHTML = shown.map(([val, label]) => {
    const p = people.find((x) => String(x.id) === String(val));
    const age = p?.birthdate ? ageAt(p.birthdate) : null;   // âge à aujourd'hui
    const ageTxt = age != null ? ` <span class="att-age">(${age})</span>` : "";
    return `<button type="button" class="chip ${cPlayerSel.has(String(val)) ? "sel" : ""}" data-val="${val}">${esc(label)}${ageTxt}</button>`;
  }).join("")
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
    salary_monthly: $("p-salary").value.trim() === "" ? null : Number($("p-salary").value),
    salary_from: $("p-salary-from").value || null,
    standing_order: $("p-standing").value.trim() === "" ? null : Number($("p-standing").value),
    pays_by_invoice: $("p-byinv").checked,
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
    // Le LOGIN (auth.users.email) suit toujours le mail principal de la fiche : on
    // (re)synchronise à chaque enregistrement — l'edge ne fait rien si déjà identique
    // ou si la personne n'a pas de compte. Ré-enregistrer répare donc un login décalé.
    if (row.email) {
      const { data: le, error: leErr } = await sb.functions.invoke("admin-set-login", { body: { person_id: id, email: row.email } });
      let emsg = "";
      if (leErr) { emsg = leErr.message; try { emsg = (await leErr.context.json())?.error || emsg; } catch (_) {} }
      else if (le?.error) emsg = le.error;
      if (emsg) alert("Fiche enregistrée. Mais le LOGIN n'a pas pu être changé (" + emsg + "). L'ancien mail de connexion reste valable.");
      else if (le?.changed) alert("✓ Login mis à jour : cette personne se connectera désormais avec " + row.email + ".");
    }
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
const FILIERE_LABEL = { competition: "Compétition", performance: "Performance", club: "Club", kidstennis: "KidsTennis", adultes: "Adultes" };
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
    $("prosp-sub-suivi").classList.toggle("hidden", b.dataset.psub !== "suivi");
    if (b.dataset.psub === "suivi") loadProspectFollowups();
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
  const code = src.replace("__KEY__", data.import_key).replace("__RCV__", location.origin + "/prosp-results-receiver.html").replace("__WHO__", (meName || "").replace(/["\\]/g, ""));
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
  const code = src.replace("__KEY__", data.import_key).replace("__RCV__", location.origin + "/prosp-receiver.html").replace("__WHO__", (meName || "").replace(/["\\]/g, ""));
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
  $("heures-export-pdf").addEventListener("click", exportHeuresPdf);
  $("heures-send").addEventListener("click", sendHeuresToFiduciaire);
}
async function loadHeures() {
  initHeures();
  heuresYm = $("heures-month").value || ymNow();
  await renderMyHours();
  const isManager = hasAny(myAppRoles, ["superadmin", "admin", "secretaire", "head_coach"]);
  $("heures-recap").classList.toggle("hidden", !isManager);
  $("heures-export").classList.toggle("hidden", !isManager);
  $("heures-export-pdf").classList.toggle("hidden", !isManager);
  $("heures-send").classList.toggle("hidden", !canSalaries());   // envoi à la fiduciaire : admin/superadmin
  if (isManager) {
    const [{ data, error }] = await Promise.all([sb.rpc("staff_hours_month", { p_ym: heuresYm }), loadSalSlips()]);
    heuresData = error ? { coaches: [], profs: [] } : (data || { coaches: [], profs: [] });
    renderHeures();
    renderSalBox();
  }
}
async function renderMyHours() {
  const host = $("heures-mine"); if (!host) return;
  const { data } = await sb.rpc("my_hours_month", { p_ym: heuresYm });
  const m = data || {};
  const hasCoach = (m.coach_total || 0) > 0, hasProf = (m.prof_total || 0) > 0;
  if (!hasCoach && !hasProf) { host.innerHTML = ""; await renderMySalaires(); return; }
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
  await renderMySalaires();
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
    const salaried = x.salary != null;   // salarié : on garde les heures, mais salaire brut à la place de tarif/montant
    const { base, extra, total } = heAmount(x);
    const allVal = x.total_courses > 0 && x.courses === x.total_courses;
    const extraTxt = extra ? ` <span class="muted" style="font-size:.78rem">(dont ${extra.toLocaleString("fr-CH")} extra)</span>` : "";
    return `<tr${x.by_invoice ? ' class="he-inv" title="Sur facture : payé sur sa propre facture (montant attendu ci-contre), exclu du décompte fiduciaire et du paiement automatique"' : ""}>
      <td><b>${esc(x.name)}</b>${x.by_invoice ? ' <span class="he-inv-badge">sur facture</span>' : ""}</td><td>${x.total_courses}</td><td>${x.hours} h</td>
      <td>${salaried ? '<span class="he-sal">Salarié</span>' : (x.rate != null ? x.rate + ".–" : '<span class="muted">—</span>')}</td>
      <td>${salaried ? `<b>${total.toLocaleString("fr-CH")} CHF</b> <span class="muted" style="font-size:.78rem">brut / mois</span>${extraTxt}` : (base != null || extra ? `${total.toLocaleString("fr-CH")} CHF${extraTxt}` : "—")}</td>
      <td style="font-size:.8rem">${x.iban ? esc(x.iban) : '<span class="muted">—</span>'}</td>
      <td>${allVal ? '<span class="he-val">✓ ' + x.courses + "/" + x.total_courses + "</span>" : '<span class="muted">' + x.courses + "/" + x.total_courses + "</span>"}</td>
      ${salExtraCell(x.person_id, x.extra)}
      ${salNetCell(x.person_id)}
      <td class="he-acts"><button class="ghost he-detail" data-id="${x.person_id}" data-name="${esc(x.name)}">Détail</button></td></tr>`;
  }).join("");
  $("heures-profs").innerHTML = p.map((x) => {
    const allVal = x.total_days > 0 && x.days === x.total_days;
    return `<tr${x.by_invoice ? ' class="he-inv" title="Sur facture : payé sur sa propre facture, exclu du décompte fiduciaire et du paiement automatique"' : ""}>
      <td><b>${esc(x.name)}</b>${x.by_invoice ? ' <span class="he-inv-badge">sur facture</span>' : ""}</td><td>${x.total_days}</td><td>${x.hours} h</td>
      <td style="font-size:.8rem">${x.iban ? esc(x.iban) : '<span class="muted">—</span>'}</td>
      <td>${allVal ? '<span class="he-val">✓ ' + x.days + "/" + x.total_days + "</span>" : '<span class="muted">' + x.days + "/" + x.total_days + "</span>"}</td>
      ${salExtraCell(x.person_id, x.extra)}
      ${salNetCell(x.person_id)}
      <td></td></tr>`;
  }).join("");
  document.querySelectorAll("#heures-coaches .he-detail").forEach((b) => b.addEventListener("click", () => coachDetail(b.dataset.id, b.dataset.name)));
  document.querySelectorAll("#view-heures .sal-col").forEach((el) => el.classList.toggle("hidden", !canSalaries()));
  bindSalCells();
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
  const lines = [["Type", "Nom", "Cours/AM", "Heures", "Tarif", "Extra", "Montant", "IBAN", "Valide"]];
  for (const x of c) { const { base, extra, total } = heAmount(x); lines.push([x.by_invoice ? "Coach (sur facture)" : "Coach", x.name, x.courses, x.hours, x.salary != null ? "salarié" : (x.rate ?? ""), extra || "", (base != null || extra) ? total : "", x.iban ?? "", x.total_courses > 0 && x.courses === x.total_courses ? "oui" : "non"]); }
  for (const x of p) lines.push(["Prof", x.name, x.days, x.hours, "", x.extra ?? "", "", x.iban ?? "", x.total_days > 0 && x.days === x.total_days ? "oui" : "non"]);
  const csv = lines.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `heures-${heuresYm}.csv`; a.click();
}
// Décompte mensuel en PDF (fiduciaire) : coachs (heures, tarif OU salaire brut) + profs. jsPDF chargé à la demande.
const heuresMoisLbl = () => { const [yy, mm] = heuresYm.split("-"); return new Date(Number(yy), Number(mm) - 1, 1).toLocaleDateString("fr-CH", { month: "long", year: "numeric" }); };
async function buildHeuresPdf() {
  if (!window.jspdf) await facLoadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  if (!window.jspdf?.jsPDF?.API?.autoTable) await facLoadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  // Les personnes « sur facture » (indépendants) ne figurent PAS dans le décompte fiduciaire.
  const c = (heuresData.coaches || []).filter((x) => !x.by_invoice), p = (heuresData.profs || []).filter((x) => !x.by_invoice);
  const nInv = (heuresData.coaches || []).filter((x) => x.by_invoice).length + (heuresData.profs || []).filter((x) => x.by_invoice).length;
  const chf = (n) => (Math.round(Number(n) * 100) / 100).toLocaleString("fr-CH") + " CHF";
  doc.setFontSize(15); doc.text(`Décompte mensuel — ${heuresMoisLbl()}`, 14, 14);
  doc.setFontSize(9); doc.setTextColor(110); doc.text(`Team Lausanne · généré le ${frDate(new Date())}${nInv ? ` · ${nInv} intervenant(s) sur facture non inclus` : ""}`, 14, 20); doc.setTextColor(0);
  let total = 0;
  const coachRows = c.map((x) => {
    const sal = x.salary != null, { base, extra, total: t } = heAmount(x);
    if (base != null || extra) total += t;
    return [x.name, `${x.courses}/${x.total_courses}`, `${x.hours} h`, sal ? "Salarié" : (x.rate != null ? x.rate + ".–/h" : "—"),
            extra ? chf(extra) : "—", (base != null || extra) ? (sal ? chf(t) + " brut" : chf(t)) : "—", x.iban || "—"];
  });
  doc.autoTable({ startY: 26, head: [["Coach", "Cours validés", "Heures", "Tarif", "Extra (brut)", "Montant", "IBAN"]], body: coachRows.length ? coachRows : [["—", "", "", "", "", "", ""]],
    styles: { fontSize: 9 }, headStyles: { fillColor: [18, 60, 196] }, columnStyles: { 6: { fontSize: 8 } } });
  const profRows = p.map((x) => [x.name, `${x.days}/${x.total_days}`, `${x.hours} h`, x.extra ? chf(x.extra) : "—", x.iban || "—"]);
  doc.setFontSize(12); doc.text("Profs — études", 14, doc.lastAutoTable.finalY + 10);
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 13, head: [["Prof", "Après-midis validés", "Heures", "Extra (brut)", "IBAN"]], body: profRows.length ? profRows : [["—", "", "", "", ""]],
    styles: { fontSize: 9 }, headStyles: { fillColor: [18, 60, 196] }, columnStyles: { 4: { fontSize: 8 } } });
  doc.setFontSize(10); doc.text(`Total coachs (montants + salaires bruts + extras) : ${chf(total)}`, 14, doc.lastAutoTable.finalY + 10);
  return doc;
}
async function exportHeuresPdf() {
  const btn = $("heures-export-pdf"); btn.disabled = true;
  try { (await buildHeuresPdf()).save(`decompte-${heuresYm}.pdf`); }
  catch (e) { alert("Export PDF impossible : " + (e?.message || e)); }
  btn.disabled = false;
}
// Envoi du décompte à la fiduciaire : PDF généré + mail depuis info@ (visible dans Envoyés après la relève).
const FIDU_TO = "sara.ninetti@fimisa.ch", FIDU_FROM = "info@teamlausanne.ch";
async function sendHeuresToFiduciaire() {
  const c = heuresData.coaches || [], p = heuresData.profs || [];
  const nCoachPending = c.filter((x) => x.total_courses > 0 && x.courses !== x.total_courses).length;
  const nProfPending = p.filter((x) => x.total_days > 0 && x.days !== x.total_days).length;
  const warn = (nCoachPending || nProfPending) ? `\n\n⚠ Attention : ${nCoachPending} coach(s) et ${nProfPending} prof(s) n'ont pas encore tout validé ce mois-ci.` : "";
  if (!(await uiConfirm(`Les heures et les montants de ${heuresMoisLbl()} sont-ils bien corrects ?${warn}\n\nLe décompte PDF sera envoyé à Sara (${FIDU_TO}) depuis ${FIDU_FROM}. Confirmer l'envoi ?`))) return;
  const btn = $("heures-send"); btn.disabled = true; const lbl = btn.textContent; btn.textContent = "Envoi…";
  try {
    const doc = await buildHeuresPdf();
    const u8 = new Uint8Array(doc.output("arraybuffer")); let bin = "";
    for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    const b64 = btoa(bin);
    const subject = `Décompte des heures — ${heuresMoisLbl()}`;
    const text = "Salut Sara, j'espère que tu vas bien. Voici le PDF avec le décompte des heures du mois. Meilleures salutations, Dan.";
    const { data, error } = await sb.functions.invoke("mail-send", { body: { account: FIDU_FROM, to: FIDU_TO, subject, text,
      attachments: [{ filename: `decompte-${heuresYm}.pdf`, contentType: "application/pdf", content: b64 }] } });
    if (error) { let m = error.message; try { m = (await error.context.json())?.error || m; } catch (_) {} throw new Error(m); }
    if (data?.error) throw new Error(data.error);
    uiAlert(`✓ Décompte de ${heuresMoisLbl()} envoyé à ${FIDU_TO} depuis ${FIDU_FROM}. Il apparaîtra dans Messagerie › Envoyés à la prochaine relève.`);
  } catch (e) { uiAlert("Envoi impossible : " + (e?.message || e)); }
  btn.disabled = false; btn.textContent = lbl;
}

// ===================================================================
//  Fil « Physique » (Fiche › Tests physiques) : un seul fil, auteur + date/heure — sport-études / pro / pro U18
// ===================================================================
const PHYS_NOTE_ROLES = ["sport-etudes", "pro", "pro-u18"];
const canPhysNotes = () => hasAny(myAppRoles, ["coach", "coach_physique", "head_coach", "admin", "superadmin"]);
let pphPersonId = null, pphBound = false;
async function loadPersonPhysNotes(personId, show) {
  pphPersonId = personId;
  const sec = $("pph-sec"); if (!sec) return;
  sec.classList.toggle("hidden", !show);
  if (!show) { $("pph-list").innerHTML = ""; return; }
  if (!pphBound) {
    pphBound = true;
    $("pph-add").addEventListener("click", async () => {
      const ta = $("pph-new"), b = ta.value.trim(); if (!b || !pphPersonId) return;
      const { error } = await sb.from("phys_notes").insert({ player_person_id: pphPersonId, body: b, author_person_id: myPersonId, author_name: meName, author_role: myNoteRole(), created_by: meId });
      if (error) { uiAlert(error.message); return; }
      ta.value = ""; renderPhysNotes();
    });
  }
  renderPhysNotes();
}
async function renderPhysNotes() {
  const list = $("pph-list"); if (!list || !pphPersonId) return;
  const { data } = await sb.from("phys_notes").select("*").eq("player_person_id", pphPersonId).order("created_at", { ascending: false });
  const rows = data || [];
  const canAll = canTennisEdit();
  list.innerHTML = rows.length ? rows.map((r) => {
    const mine = r.created_by && r.created_by === meId;
    const edited = r.updated_at && r.updated_at !== r.created_at ? ' <span class="muted">(modifié)</span>' : "";
    return `<div class="obj-item tn-item" data-id="${r.id}">
      <div class="obj-meta"><span><b>${esc(r.author_name || "—")}</b>${r.author_role ? ` <span class="muted">· ${esc(r.author_role)}</span>` : ""}</span><span>${frDateTime(r.created_at)}${edited}</span></div>
      <div class="obj-body">${esc(r.body).replace(/\n/g, "<br/>")}</div>
      ${canAll || mine ? `<div class="obj-acts"><button type="button" class="edit">Modifier</button><button type="button" class="del">Supprimer</button></div>` : ""}</div>`;
  }).join("") : '<p class="obj-empty">Aucune remarque pour l\'instant.</p>';
  list.querySelectorAll(".del").forEach((b) => b.addEventListener("click", async () => {
    if (!await uiConfirm("Supprimer cette remarque ?")) return;
    await sb.from("phys_notes").delete().eq("id", b.closest(".tn-item").dataset.id);
    renderPhysNotes();
  }));
  list.querySelectorAll(".edit").forEach((b) => b.addEventListener("click", () => {
    const item = b.closest(".tn-item"), id = item.dataset.id, cur = rows.find((r) => r.id === id);
    item.querySelector(".obj-body").innerHTML = `<textarea class="tn-edit" rows="2" style="width:100%">${esc(cur.body)}</textarea>
      <div style="margin-top:6px"><button type="button" class="tn-save">Enregistrer</button></div>`;
    item.querySelector(".tn-save").addEventListener("click", async () => {
      const v = item.querySelector(".tn-edit").value.trim(); if (!v) return;
      const { error } = await sb.from("phys_notes").update({ body: v, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) { uiAlert(error.message); return; }
      renderPhysNotes();
    });
  }));
}

// ===================================================================
//  Prospects › Suivi (saisie manuelle) + bloc Dashboard « Prospects »
// ===================================================================
const PF_MODES = [["surveiller", "À surveiller (alerte 1 mois)"], ["mail", "Contact pris par mail (1 sem.)"], ["tel", "Contact pris par téléphone (1 sem.)"], ["attente", "En attente d'un retour (1 sem.)"], ["standby", "En standby (3 mois)"], ["aucune", "Pas de relance pour le moment"]];
const pfModeLbl = (m) => (PF_MODES.find(([k]) => k === m) || [m, m])[1];
function pfAlertDate(mode, last) {
  if (!last || mode === "aucune") return null;
  const d = new Date(last + "T00:00:00");
  if (mode === "surveiller") d.setMonth(d.getMonth() + 1); else if (mode === "standby") d.setMonth(d.getMonth() + 3); else d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}
let pfList = [], pfInit = false;
async function loadProspectFollowups() {
  if (!pfInit) {
    pfInit = true;
    $("pf-add").addEventListener("click", async () => {
      const { data: sess } = await sb.auth.getSession();
      const { error } = await sb.from("prospect_followups").insert({ created_by: sess?.session?.user?.id || null, last_contact: new Date().toISOString().slice(0, 10) });
      if (error) { uiAlert(error.message); return; }
      await loadProspectFollowups();
      const first = $("pf-rows").querySelector('input[data-k="first_name"]'); if (first) first.focus();
    });
    $("pf-show-done").addEventListener("change", renderProspectFollowups);
    $("pf-search").addEventListener("input", renderProspectFollowups);
  }
  const { data, error } = await sb.from("prospect_followups").select("*").order("created_at", { ascending: false });
  if (error) { $("pf-rows").innerHTML = `<tr><td colspan="12" class="muted">Erreur : ${esc(error.message)}</td></tr>`; return; }
  pfList = data || [];
  renderProspectFollowups();
}
function renderProspectFollowups() {
  const showDone = $("pf-show-done").checked, q = $("pf-search").value.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const rows = pfList.filter((r) => (showDone || !r.done) && (!q || [r.first_name, r.last_name, r.description, r.email, r.phone, r.license_no, r.ranking, r.status_text].some((v) => (v || "").toLowerCase().includes(q))));
  $("pf-empty").hidden = pfList.length > 0;
  const inp = (r, k, extra = "") => `<input class="pf-f" data-k="${k}" value="${esc(r[k] || "")}" ${extra} />`;
  $("pf-rows").innerHTML = rows.map((r) => {
    const al = pfAlertDate(r.mode, r.last_contact);
    const due = al && al <= today, soon = al && !due && al <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    return `<tr class="${r.done ? "muted" : due ? "pf-due" : ""}" data-id="${r.id}">
      <td>${inp(r, "first_name", 'placeholder="Prénom" style="width:110px"')}</td>
      <td>${inp(r, "last_name", 'placeholder="Nom" style="width:120px"')}</td>
      <td>${inp(r, "description", 'placeholder="ex. Garçon 12 ans" style="width:150px"')}</td>
      <td>${inp(r, "license_no", 'placeholder="n° licence" style="width:110px" title="Licence Swiss Tennis (facultatif)"')}</td>
      <td>${inp(r, "email", 'type="email" placeholder="—" style="width:180px"')}</td>
      <td>${inp(r, "phone", 'placeholder="—" style="width:120px"')}</td>
      <td>${inp(r, "ranking", 'placeholder="R5…" style="width:64px"')}</td>
      <td><select class="pf-f" data-k="mode">${PF_MODES.map(([k, l]) => `<option value="${k}"${r.mode === k ? " selected" : ""}>${l}</option>`).join("")}</select></td>
      <td><input class="pf-f" data-k="last_contact" type="date" value="${r.last_contact || ""}" style="width:130px" /></td>
      <td style="white-space:nowrap">${al ? `<span class="${due ? "dash-red" : soon ? "pf-soon" : "muted"}">${due ? "⚠️ " : ""}${frDate(al)}</span>` : '<span class="muted">—</span>'}</td>
      <td><textarea class="pf-f" data-k="status_text" rows="2" placeholder="Où ça en est…" style="width:220px">${esc(r.status_text || "")}</textarea></td>
      <td class="he-acts"><button type="button" class="ghost pf-done" title="${r.done ? "Réactiver" : "Archiver (plus suivi)"}">${r.done ? "↩" : "✓"}</button><button type="button" class="ghost pf-del" title="Supprimer">✕</button></td></tr>`;
  }).join("");
  const R = $("pf-rows");
  R.querySelectorAll(".pf-f").forEach((el) => el.addEventListener("change", async () => {
    const id = el.closest("tr").dataset.id, r = pfList.find((x) => x.id === id); if (!r) return;
    const k = el.dataset.k, v = el.value.trim() === "" ? (k === "last_contact" ? r.last_contact : null) : el.value.trim();
    const { error } = await sb.from("prospect_followups").update({ [k]: v, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { uiAlert("Enregistrement impossible : " + error.message); return; }
    r[k] = v; if (k === "mode" || k === "last_contact") renderProspectFollowups();
  }));
  R.querySelectorAll(".pf-done").forEach((b) => b.addEventListener("click", async () => {
    const id = b.closest("tr").dataset.id, r = pfList.find((x) => x.id === id); if (!r) return;
    await sb.from("prospect_followups").update({ done: !r.done, updated_at: new Date().toISOString() }).eq("id", id);
    r.done = !r.done; renderProspectFollowups();
  }));
  R.querySelectorAll(".pf-del").forEach((b) => b.addEventListener("click", async () => {
    const id = b.closest("tr").dataset.id, r = pfList.find((x) => x.id === id); if (!r) return;
    if (!(await uiConfirm(`Supprimer ${r.first_name || ""} ${r.last_name || ""} ? (définitif — sinon utilise ✓ pour archiver)`))) return;
    await sb.from("prospect_followups").delete().eq("id", id);
    pfList = pfList.filter((x) => x.id !== id); renderProspectFollowups();
  }));
}
// Bloc Dashboard « Prospects » : alertes échues / à venir (7 j) + les deux mises à jour d'import liées aux prospects.
function dashProspects(p, lu) {
  const today = new Date().toISOString().slice(0, 10);
  const line = (label, at, by) => { const red = dDaysAgo(at) > 10; return `<div class="dash-row"><span>${esc(label)}</span><span class="${red ? "dash-red" : ""}">${at ? dFD(at) : "jamais"}${by ? " · " + esc(by) : ""}${red ? " ⚠️" : ""}</span></div>`; };
  const alerts = p.alerts || [];
  const due = alerts.filter((a) => a.alert_at <= today), soon = alerts.filter((a) => a.alert_at > today);
  const li = (a) => `<div class="dash-li"><b>${esc(a.name || "—")}</b>${a.ranking ? ` <span class="muted">(${esc(a.ranking)})</span>` : ""} — ${esc(pfModeLbl(a.mode))}, dernière interaction ${dFD(a.last_contact)}${a.status_text ? `<div class="muted" style="font-size:.8rem">${esc(a.status_text)}</div>` : ""}</div>`;
  return dashCard("Prospects",
    `<h3 class="dash-sub">Dernières mises à jour <span class="muted" style="font-weight:400;font-size:.8rem">(⚠️ rouge = &gt; 10 jours)</span></h3>
     ${line("Importer les prospects", lu.rank_at, lu.rank_by)}${line("Importer les matchs des prospects", lu.scan_at, lu.scan_by)}
     <h3 class="dash-sub">À relancer maintenant <span class="muted" style="font-weight:400;font-size:.8rem">(${p.n_active || 0} suivi(s) actifs)</span></h3>
     ${due.length ? due.map(li).join("") : '<div class="dash-ok">✓ Aucune relance en retard.</div>'}
     <h3 class="dash-sub">À relancer dans les 7 jours</h3>
     ${soon.length ? soon.map((a) => li(a).replace("</b>", `</b> <span class="muted">→ ${dFD(a.alert_at)}</span>`)).join("") : '<div class="muted">—</div>'}`);
}

// ===================================================================
//  Newsletter : ciblage (répertoire / filières / GameZone / manuel) → envoi Resend → historique + métriques
// ===================================================================
const NL_ROLE_OPTS = [["kidstennis", "KidsTennis"], ["club", "Club"], ["competition", "Compétition"], ["performance", "Performance"], ["sport-etudes", "Sport-études"], ["pro-u18", "Pro U18"], ["pro", "Pro"], ["adultes", "Adultes"], ["membre", "Membres"], ["coach", "Coachs"], ["prof", "Profs"], ["official", "Officials"]];
const NL_ST = { brouillon: "Brouillon", envoi: "Envoi en cours", envoyee: "Envoyée" };
const NL_RST = { en_attente: "En attente", envoye: "Envoyé", delivre: "Délivré", ouvert: "Ouvert", clique: "Cliqué", rebond: "Rebond", spam: "Spam", erreur: "Erreur", desinscrit: "Désinscrit" };
let nlList = [], nlMetrics = {}, nlInit = false, nlEditId = null, nlAud = null;
const nlPct = (a, b) => (b ? Math.round((a / b) * 100) + " %" : "—");

function initNewsletter() {
  if (nlInit) return; nlInit = true;
  $("nl-new").addEventListener("click", () => nlOpen(null));
  $("nl-close").addEventListener("click", () => $("nl-modal").classList.add("hidden"));
  $("nl-count").addEventListener("click", nlComputeAudience);
  $("nl-save").addEventListener("click", async () => { const id = await nlSave(); if (id) { $("nl-status").textContent = "✓ Brouillon enregistré."; loadNewsletters(); } });
  $("nl-test").addEventListener("click", nlSendTest);
  $("nl-send").addEventListener("click", nlSendAll);
  document.querySelectorAll("#nl-modal .nl-rt").forEach((b) => b.addEventListener("mousedown", (e) => { e.preventDefault(); document.execCommand(b.dataset.cmd, false, null); }));
  // La barre d'outils d'ensemble a cede la place a l'editeur par blocs :
  // la mise en forme se fait desormais bloc par bloc, dans l'inspecteur.
  $("nl-all").addEventListener("change", () => { $("nl-roles").querySelectorAll("input").forEach((c) => { c.disabled = $("nl-all").checked; }); });
  $("nl-roles").innerHTML = NL_ROLE_OPTS.map(([v, l]) => `<label><input type="checkbox" class="nl-role" value="${v}" /> ${l}</label>`).join("");
  $("nl-setup").innerHTML = `<b>Mise en place (une fois)</b> — <a href="#" id="nl-setup-toggle">voir la marche à suivre</a>
    <div id="nl-setup-body" class="hidden" style="margin-top:8px;font-size:.86rem;line-height:1.5">
      1. Crée un compte sur <b>resend.com</b> (gratuit jusqu'à 3 000 e-mails / mois) et ajoute le domaine <b>teamlausanne.ch</b> : Resend te donne 3 enregistrements DNS (DKIM, SPF, DMARC) à créer chez Wix, comme pour le site. Active <b>Open &amp; click tracking</b> sur le domaine.<br>
      2. Crée une <b>API key</b> (Sending access) et colle-la dans Supabase › Edge Functions › Secrets sous le nom <b>RESEND_API_KEY</b>.<br>
      3. Resend › Webhooks › Add : URL <code>https://lnrmtwamuaqcubohontn.supabase.co/functions/v1/newsletter-webhook</code>, événements delivered / opened / clicked / bounced / complained ; colle le <b>Signing secret</b> dans Supabase sous <b>RESEND_WEBHOOK_SECRET</b>.<br>
      Tant que l'étape 2 n'est pas faite, « Test → moi » et « Envoyer » répondent « clé absente ».
    </div>`;
  $("nl-setup").classList.remove("hidden");
  $("nl-setup-toggle").addEventListener("click", (e) => { e.preventDefault(); $("nl-setup-body").classList.toggle("hidden"); });
}
async function loadNewsletters() {
  initNewsletter();
  const [{ data: rows, error }, { data: mets }] = await Promise.all([
    sb.from("newsletters").select("*").order("created_at", { ascending: false }),
    sb.from("newsletter_metrics").select("*"),
  ]);
  if (error) { $("nl-rows").innerHTML = `<tr><td colspan="13" class="muted">${esc(error.message)}</td></tr>`; return; }
  nlList = rows || []; nlMetrics = {}; for (const m of mets || []) nlMetrics[m.newsletter_id] = m;
  renderNewsletters();
}
function nlAudLabel(a) {
  if (!a) return "—";
  const parts = [];
  if (a.all_people) parts.push("Tout le répertoire");
  if (a.roles?.length) parts.push(a.roles.map((r) => (NL_ROLE_OPTS.find(([v]) => v === r) || [r, r])[1]).join(", "));
  if (a.gz_all) parts.push("GameZone (tous)"); else if (a.gz_season_id) parts.push("GameZone " + (a.gz_season_name || "saison"));
  if (a.extra_emails?.length) parts.push(`${a.extra_emails.length} e-mail(s) manuel(s)`);
  return parts.join(" · ") || "—";
}
function renderNewsletters() {
  $("nl-empty").hidden = nlList.length > 0;
  $("nl-rows").innerHTML = nlList.map((n) => {
    const m = nlMetrics[n.id] || {};
    const acts = n.status === "brouillon"
      ? `<button class="ghost nl-edit" data-id="${n.id}">Modifier</button><button class="ghost nl-del" data-id="${n.id}" title="Supprimer">✕</button>`
      : `<button class="ghost nl-view" data-id="${n.id}">Voir</button><button class="ghost nl-dup" data-id="${n.id}" title="Réutiliser comme brouillon">Dupliquer</button>`;
    return `<tr>
      <td>${frDateTime(n.sent_at || n.created_at)}</td>
      <td class="nl-subj"><b>${esc(n.subject || "(sans objet)")}</b></td>
      <td class="muted" style="font-size:.8rem;white-space:normal;max-width:220px">${esc(nlAudLabel(n.audience))}</td>
      <td>${m.n_total || 0}</td><td>${m.n_sent || 0}</td><td>${m.n_delivered || 0}</td>
      <td><b>${m.n_opened || 0}</b> <span class="muted">${nlPct(m.n_opened, m.n_sent)}</span></td>
      <td>${m.n_clicked || 0} <span class="muted">${nlPct(m.n_clicked, m.n_sent)}</span></td>
      <td class="${m.n_bounced ? "dash-red" : ""}">${m.n_bounced || 0}</td>
      <td class="${m.n_spam ? "dash-red" : ""}">${m.n_spam || 0}</td>
      <td>${m.n_unsub || 0}</td>
      <td><span class="nl-st ${n.status}">${NL_ST[n.status] || n.status}</span>${n.last_error ? `<div class="muted" style="font-size:.7rem;white-space:normal;max-width:180px" title="${esc(n.last_error)}">⚠ ${esc(n.last_error.slice(0, 60))}…</div>` : ""}</td>
      <td class="he-acts">${acts}</td></tr>`;
  }).join("");
  const R = $("nl-rows");
  R.querySelectorAll(".nl-edit").forEach((b) => b.addEventListener("click", () => nlOpen(nlList.find((x) => x.id === b.dataset.id))));
  R.querySelectorAll(".nl-view").forEach((b) => b.addEventListener("click", () => nlShowDetail(b.dataset.id)));
  R.querySelectorAll(".nl-dup").forEach((b) => b.addEventListener("click", () => { const n = nlList.find((x) => x.id === b.dataset.id); nlOpen({ ...n, id: null, status: "brouillon" }); }));
  R.querySelectorAll(".nl-del").forEach((b) => b.addEventListener("click", async () => {
    if (!(await uiConfirm("Supprimer ce brouillon ?"))) return;
    await sb.from("newsletters").delete().eq("id", b.dataset.id); loadNewsletters();
  }));
}
async function nlShowDetail(id) {
  const n = nlList.find((x) => x.id === id); if (!n) return;
  const m = nlMetrics[id] || {};
  const { data } = await sb.from("newsletter_recipients").select("email,name,source,status,open_count,click_count,error,sent_at").eq("newsletter_id", id).order("email");
  const rows = data || [];
  const kpi = (l, v, sub) => `<div><b>${v}</b>${esc(l)}${sub ? ` <span class="muted">${sub}</span>` : ""}</div>`;
  $("nl-detail").innerHTML = `<div class="crm-head" style="align-items:center"><h2 style="margin:0;font-size:1.1rem">${esc(n.subject)} <span class="muted" style="font-weight:400;font-size:.85rem">— ${n.sent_at ? "envoyée le " + frDateTime(n.sent_at) : NL_ST[n.status]}</span></h2><span class="spacer"></span><button type="button" class="ghost" id="nl-detail-close">Fermer</button></div>
    <div class="nl-kpi">${kpi("Destinataires", m.n_total || 0)}${kpi("Envoyés", m.n_sent || 0)}${kpi("Délivrés", m.n_delivered || 0, nlPct(m.n_delivered, m.n_sent))}${kpi("Ouvertures", m.n_opened || 0, nlPct(m.n_opened, m.n_sent))}${kpi("Clics", m.n_clicked || 0, nlPct(m.n_clicked, m.n_sent))}${kpi("Rebonds", m.n_bounced || 0)}${kpi("Spam", m.n_spam || 0)}${kpi("Désinscrits", m.n_unsub || 0)}${kpi("Erreurs", m.n_error || 0)}</div>
    <div class="table-wrap"><table class="crm-table"><thead><tr><th>E-mail</th><th>Nom</th><th>Source</th><th>Statut</th><th>Ouv.</th><th>Clics</th><th>Détail</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(r.email)}</td><td>${esc(r.name || "")}</td><td class="muted">${esc(r.source || "")}</td><td><span class="nl-rcpt-st ${r.status}">${NL_RST[r.status] || r.status}</span></td><td>${r.open_count || ""}</td><td>${r.click_count || ""}</td><td class="muted" style="font-size:.78rem">${esc(r.error || "")}</td></tr>`).join("")}
    </tbody></table></div>`;
  $("nl-detail").classList.remove("hidden");
  $("nl-detail-close").addEventListener("click", () => $("nl-detail").classList.add("hidden"));
  $("nl-detail").scrollIntoView({ behavior: "smooth", block: "start" });
}
// ---- Éditeur ----
async function nlOpen(n) {
  nlEditId = n?.id || null; nlAud = null;
  $("nl-title").textContent = n?.id ? "Modifier la newsletter" : "Nouvelle newsletter";
  $("nl-subject").value = n?.subject || "";
  $("nl-from-name").value = n?.from_name || "Team Lausanne Academy";
  $("nl-from-email").value = n?.from_email || "newsletter@teamlausanne.ch";
  $("nl-reply").value = n?.reply_to || "info@teamlausanne.ch";
  nlChargerBlocs(n);
  const a = n?.audience || {};
  $("nl-all").checked = !!a.all_people;
  $("nl-roles").querySelectorAll("input").forEach((c) => { c.checked = (a.roles || []).includes(c.value); c.disabled = !!a.all_people; });
  $("nl-gz-all").checked = !!a.gz_all;
  const { data: gs } = await sb.from("gz_seasons").select("id,name,is_current").order("start_date", { ascending: false });
  $("nl-gz-season").innerHTML = (gs || []).map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  $("nl-gz-season").value = a.gz_season_id || (gs || []).find((s) => s.is_current)?.id || (gs || [])[0]?.id || "";
  $("nl-gz-season-on").checked = !!a.gz_season_id;
  $("nl-extra").value = (a.extra_emails || []).join("\n");
  $("nl-count-res").textContent = ""; $("nl-preview").innerHTML = ""; $("nl-status").textContent = "";
  $("nl-modal").classList.remove("hidden");
}
function nlReadAudience() {
  const roles = [...$("nl-roles").querySelectorAll("input:checked")].map((c) => c.value);
  const gzSel = $("nl-gz-season");
  return {
    all_people: $("nl-all").checked, roles: $("nl-all").checked ? [] : roles,
    gz_all: $("nl-gz-all").checked,
    gz_season_id: (!$("nl-gz-all").checked && $("nl-gz-season-on").checked) ? (gzSel.value || null) : null,
    gz_season_name: (!$("nl-gz-all").checked && $("nl-gz-season-on").checked) ? (gzSel.options[gzSel.selectedIndex]?.textContent || "") : "",
    extra_emails: $("nl-extra").value.split(/[\n,;]+/).map((s) => s.trim()).filter((s) => /@/.test(s)),
  };
}
async function nlComputeAudience() {
  const aud = nlReadAudience();
  $("nl-count-res").textContent = "Calcul…";
  const { data, error } = await sb.rpc("newsletter_audience", { p_aud: aud });
  if (error) { $("nl-count-res").textContent = "Erreur : " + error.message; return null; }
  nlAud = data || [];
  const bySrc = {}; for (const r of nlAud) bySrc[r.source] = (bySrc[r.source] || 0) + 1;
  $("nl-count-res").innerHTML = `<b>${nlAud.length}</b> destinataire(s) uniques${nlAud.length ? " — " + Object.entries(bySrc).map(([k, v]) => `${esc(k)} : ${v}`).join(", ") : ""} <span class="muted">(désinscrits exclus)</span>`;
  $("nl-preview").innerHTML = nlAud.slice(0, 40).map((r) => `<div>${esc(r.email)}${r.name ? ` <span class="muted">· ${esc(r.name)}</span>` : ""}</div>`).join("") + (nlAud.length > 40 ? `<div class="muted">… et ${nlAud.length - 40} autres</div>` : "");
  return nlAud;
}
async function nlSave() {
  const subject = $("nl-subject").value.trim(), html = $("nl-body").innerHTML.trim();
  const { data: sess } = await sb.auth.getSession(); const uid = sess?.session?.user?.id || null;
  const row = { subject, html, blocks: nlBlocs, from_name: $("nl-from-name").value.trim() || "Team Lausanne Academy", from_email: $("nl-from-email").value.trim() || "newsletter@teamlausanne.ch", reply_to: $("nl-reply").value.trim() || null, audience: nlReadAudience() };
  let res;
  if (nlEditId) res = await sb.from("newsletters").update(row).eq("id", nlEditId).select("id").single();
  else res = await sb.from("newsletters").insert({ ...row, created_by: uid, status: "brouillon" }).select("id").single();
  if (res.error) { $("nl-status").textContent = "Erreur : " + res.error.message; return null; }
  nlEditId = res.data.id; return nlEditId;
}
async function nlSendTest() {
  if (!$("nl-subject").value.trim() || !nlCompiler(nlBlocs).trim()) { uiAlert("Objet et contenu obligatoires."); return; }
  const id = await nlSave(); if (!id) return;
  const { data: sess } = await sb.auth.getSession(); const me = sess?.session?.user?.email;
  $("nl-status").textContent = `Envoi du test à ${me}…`;
  const { data, error } = await sb.functions.invoke("newsletter-send", { body: { id, test_to: me } });
  if (error) { let m = error.message; try { m = (await error.context.json())?.error || m; } catch (_) {} $("nl-status").textContent = "Échec : " + m; return; }
  if (data?.error) { $("nl-status").textContent = "Échec : " + data.error; return; }
  $("nl-status").textContent = `✓ Test envoyé à ${me}. Vérifie le rendu (et le dossier spam) avant l'envoi réel.`;
  loadNewsletters();
}
async function nlSendAll() {
  if (!$("nl-subject").value.trim() || !nlCompiler(nlBlocs).trim()) { uiAlert("Objet et contenu obligatoires."); return; }
  const id = await nlSave(); if (!id) return;
  const aud = await nlComputeAudience(); if (!aud) return;
  if (!aud.length) { uiAlert("Aucun destinataire : ajuste le ciblage."); return; }
  if (!(await uiConfirm(`Envoyer « ${$("nl-subject").value.trim()} » à ${aud.length} destinataire(s) ? Cette action est définitive.`))) return;
  const btn = $("nl-send"); btn.disabled = true; $("nl-status").textContent = "Préparation des destinataires…";
  // (Re)construit la liste des destinataires en attente, puis envoie.
  await sb.from("newsletter_recipients").delete().eq("newsletter_id", id).eq("status", "en_attente");
  const rows = aud.map((r) => ({ newsletter_id: id, person_id: r.person_id, gz_participant_id: r.gz_participant_id, email: r.email, name: r.name, source: r.source }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("newsletter_recipients").upsert(rows.slice(i, i + 200), { onConflict: "newsletter_id,email", ignoreDuplicates: true });
    if (error) { $("nl-status").textContent = "Erreur : " + error.message; btn.disabled = false; return; }
  }
  await sb.from("newsletters").update({ n_recipients: rows.length }).eq("id", id);
  $("nl-status").textContent = `Envoi à ${rows.length} destinataire(s)… (ne ferme pas la fenêtre)`;
  const { data, error } = await sb.functions.invoke("newsletter-send", { body: { id } });
  btn.disabled = false;
  if (error) { let m = error.message; try { m = (await error.context.json())?.error || m; } catch (_) {} $("nl-status").textContent = "Échec : " + m; loadNewsletters(); return; }
  if (data?.error) { $("nl-status").textContent = "Échec : " + data.error; loadNewsletters(); return; }
  $("nl-modal").classList.add("hidden");
  await loadNewsletters();
  uiAlert(`✓ Newsletter envoyée à ${data.sent} destinataire(s)${data.errors ? ` (${data.errors} lot(s) en erreur, voir le détail)` : ""}. Les ouvertures et clics apparaîtront au fil des heures.`);
}

// ===================================================================
//  Casiers (vestiaires) : liste Hommes / Femmes, nom · e-mail · date · payé, sauvegarde automatique
// ===================================================================
let lkList = [], lkGender = "H", lkInit = false, lkQuery = "";
async function loadLockers() {
  if (!lkInit) {
    lkInit = true;
    document.querySelectorAll(".lk-subtab").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".lk-subtab").forEach((x) => x.classList.toggle("active", x === b));
      lkGender = b.dataset.g; loadLockers();
    }));
    $("lk-search").addEventListener("input", () => { lkQuery = $("lk-search").value.trim().toLowerCase(); renderLockers(); });
  }
  const { data, error } = await sb.from("lockers").select("*").eq("gender", lkGender).order("number");
  if (error) { $("lk-rows").innerHTML = `<tr><td colspan="7" class="muted">Erreur : ${esc(error.message)}</td></tr>`; return; }
  lkList = data || [];
  renderLockers();
}
function renderLockers() {
  const occ = lkList.filter((l) => (l.name || "").trim()).length, paid = lkList.filter((l) => (l.name || "").trim() && l.paid).length;
  $("lk-stats").innerHTML = `<div class="et-stat"><b>${lkList.length}</b><span>casiers</span></div>
    <div class="et-stat st-present"><b>${occ}</b><span>occupés</span></div>
    <div class="et-stat"><b>${lkList.length - occ}</b><span>libres</span></div>
    <div class="et-stat ${occ - paid ? "st-absent" : "st-present"}"><b>${occ - paid}</b><span>pas payés</span></div>`;
  const q = lkQuery;
  const rows = q ? lkList.filter((l) => String(l.number).includes(q) || (l.name || "").toLowerCase().includes(q) || (l.email || "").toLowerCase().includes(q)) : lkList;
  $("lk-empty").hidden = lkList.length > 0;
  $("lk-rows").innerHTML = rows.map((l) => {
    const free = !(l.name || "").trim();
    return `<tr class="${free ? "lk-free" : (l.paid ? "lk-paid" : "lk-due")}" data-id="${l.id}">
      <td><b>${l.number}</b></td>
      <td><input class="lk-f" data-k="name" value="${esc(l.name || "")}" placeholder="libre" /></td>
      <td><input class="lk-f" data-k="email" type="email" value="${esc(l.email || "")}" placeholder="—" /></td>
      <td><input class="lk-f lk-date" data-k="date" type="date" value="${l.date || ""}" /></td>
      <td style="text-align:center"><input class="lk-f" data-k="paid" type="checkbox" ${l.paid ? "checked" : ""} title="Payé" /></td>
      <td><input class="lk-f" data-k="note" value="${esc(l.note || "")}" placeholder="—" /></td>
      <td class="he-acts">${free ? "" : `<button type="button" class="ghost lk-clear" title="Libérer le casier">✕</button>`}</td></tr>`;
  }).join("");
  const R = $("lk-rows");
  R.querySelectorAll(".lk-f").forEach((inp) => inp.addEventListener("change", async () => {
    const id = inp.closest("tr").dataset.id, l = lkList.find((x) => x.id === id); if (!l) return;
    const k = inp.dataset.k; const v = inp.type === "checkbox" ? inp.checked : (inp.value.trim() || null);
    const { data: sess } = await sb.auth.getSession();
    const { error } = await sb.from("lockers").update({ [k]: v, updated_at: new Date().toISOString(), updated_by: sess?.session?.user?.id || null }).eq("id", id);
    if (error) { uiAlert("Enregistrement impossible : " + error.message); return; }
    l[k] = v; renderLockers();
  }));
  R.querySelectorAll(".lk-clear").forEach((b) => b.addEventListener("click", async () => {
    const id = b.closest("tr").dataset.id, l = lkList.find((x) => x.id === id); if (!l) return;
    if (!(await uiConfirm(`Libérer le casier ${l.number} (${l.name || ""}) ? Nom, e-mail, date et paiement seront effacés.`))) return;
    const { error } = await sb.from("lockers").update({ name: null, email: null, date: null, paid: false, note: null, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { uiAlert("Impossible : " + error.message); return; }
    Object.assign(l, { name: null, email: null, date: null, paid: false, note: null }); renderLockers();
  }));
}

// ===================================================================
//  Salaires — PDF de la fiduciaire → net à payer (Heures) → fiche de salaire par personne → Factures
// ===================================================================
const SAL_SENDER = "@fimisa.ch";                       // la fiduciaire (Sara Ninetti)
const canSalaries = () => hasAny(myAppRoles, ["admin", "superadmin"]);
let salSlips = [];                                     // salary_slips du mois affiché
let salPeople = null;                                  // staff payable (attribution manuelle)
let salParsed = null, salBytes = null, salMailId = null; // import en cours

async function loadSalSlips() {
  if (!canSalaries()) { salSlips = []; return; }
  const { data } = await sb.from("salary_slips").select("*").eq("ym", heuresYm);
  salSlips = data || [];
}
const salSlipOf = (pid) => salSlips.find((s) => s.person_id === pid);
// Montant d'une ligne coach : salaire brut OU heures × tarif, + extra (brut) du mois.
function heAmount(x) {
  const base = x.salary != null ? Number(x.salary) : (x.rate != null ? Math.round(x.hours * Number(x.rate) * 100) / 100 : null);
  const extra = x.extra != null ? Number(x.extra) : 0;
  return { base, extra, total: Math.round(((base || 0) + extra) * 100) / 100 };
}
function salExtraCell(pid, extra) {
  return `<td class="sal-col"><input class="sal-net sal-extra" data-pid="${pid}" type="number" step="0.05" value="${extra != null ? Number(extra).toFixed(2) : ""}" placeholder="—" title="Montant brut ajouté au salaire / aux heures" /></td>`;
}
// Ordre permanent (net mensuel déjà versé par la banque) d'une personne du mois affiché.
function heSO(pid) {
  const x = [...(heuresData.coaches || []), ...(heuresData.profs || [])].find((r) => r.person_id === pid);
  return x?.standing_order != null ? Number(x.standing_order) : null;
}
const heByInv = (pid) => !![...(heuresData.coaches || []), ...(heuresData.profs || [])].find((r) => r.person_id === pid)?.by_invoice;
// Montant qui partira en facture pour une fiche : net − ordre permanent (0 si couvert, 0 si « sur facture »).
function salToPay(s) {
  if (!s || !(s.net > 0) || heByInv(s.person_id)) return 0;
  const so = heSO(s.person_id);
  return Math.max(0, Math.round((Number(s.net) - (so || 0)) * 100) / 100);
}
function salNetCell(pid) {
  if (heByInv(pid)) return `<td class="sal-col"><span class="muted" style="font-size:.8rem" title="Payé sur sa propre facture (onglet Factures)">sur facture</span></td>`;
  const s = salSlipOf(pid);
  const val = s?.net != null ? Number(s.net).toFixed(2) : "";
  const so = heSO(pid);
  let soTxt = "";
  if (so != null) {
    const comp = salToPay(s);
    soTxt = `<span class="muted" style="font-size:.75rem;white-space:nowrap" title="Ordre permanent ${so.toFixed(2)} CHF">OP ${so.toLocaleString("fr-CH")}${s?.net > 0 ? (comp > 0 ? ` → <b style="color:#b45309">+${comp.toFixed(2)}</b>` : " ✓") : ""}</span>`;
  }
  return `<td class="sal-col"><span class="sal-cell"><input class="sal-net" data-pid="${pid}" type="number" step="0.05" min="0" value="${val}" placeholder="—" />
    ${s?.pdf_path ? `<button type="button" class="ghost sal-pdf" data-path="${esc(s.pdf_path)}" title="Voir la fiche de salaire">📄</button>` : ""}
    ${s?.invoice_id ? '<span class="sal-fact" title="Transmis à Factures">✓ facture</span>' : ""}${soTxt}</span></td>`;
}
function bindSalCells() {
  document.querySelectorAll("#view-heures .sal-net").forEach((inp) => inp.addEventListener("change", async () => {
    const pid = inp.dataset.pid, v = inp.value === "" ? null : Number(inp.value);
    const isExtra = inp.classList.contains("sal-extra");
    const { data: sess } = await sb.auth.getSession();
    const row = { person_id: pid, ym: heuresYm, updated_at: new Date().toISOString(), updated_by: sess?.session?.user?.id || null };
    row[isExtra ? "extra" : "net"] = v;
    const { error } = await sb.from("salary_slips").upsert(row, { onConflict: "person_id,ym" });
    if (error) { uiAlert("Enregistrement impossible : " + error.message); return; }
    if (isExtra) await loadHeures();                       // recalcule le montant (salaire/heures + extra)
    else { await loadSalSlips(); renderSalBox(); }
  }));
  document.querySelectorAll("#view-heures .sal-pdf").forEach((b) => b.addEventListener("click", () => salOpenPdf(b.dataset.path)));
}
async function salOpenPdf(path) {
  const { data, error } = await sb.storage.from("salaries").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) { uiAlert("PDF indisponible : " + (error?.message || "")); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}
// Encadré au-dessus des tableaux : PDF de la fiduciaire détecté dans les mails + import manuel + validation.
async function renderSalBox() {
  const host = $("heures-salaires"); if (!host) return;
  if (!canSalaries()) { host.innerHTML = ""; return; }
  // Mails de la fiduciaire avec un PDF, reçus entre le début du mois et ~2 mois après (les salaires arrivent le mois suivant)
  const [yy, mm] = heuresYm.split("-").map(Number);
  const from = new Date(yy, mm - 1, 1).toISOString(), to = new Date(yy, mm + 2, 1).toISOString();
  const { data: mails } = await sb.from("mail_messages").select("id,subject,received_at").ilike("from_address", "%" + SAL_SENDER).gte("received_at", from).lt("received_at", to).order("received_at", { ascending: false });
  let atts = [];
  if (mails?.length) {
    const { data } = await sb.from("mail_attachments").select("id,mail_id,filename,content_type").in("mail_id", mails.map((m) => m.id)).eq("is_inline", false);
    atts = (data || []).filter((a) => /pdf/i.test(a.content_type || "") || /\.pdf$/i.test(a.filename || ""));
  }
  // Un PDF déjà importé (pour N'IMPORTE quel mois) n'est plus proposé : le fichier d'août arrive en septembre.
  const imported = new Set();
  if (atts.length) {
    const { data: done } = await sb.from("salary_slips").select("mail_id").in("mail_id", [...new Set(atts.map((a) => a.mail_id))]);
    for (const d of done || []) imported.add(d.mail_id);
    atts = atts.filter((a) => !imported.has(a.mail_id));
  }
  const pendList = salSlips.filter((s) => !s.invoice_id && salToPay(s) > 0);
  const pending = pendList.length, pendAmt = pendList.reduce((a, s) => a + salToPay(s), 0);
  const covered = salSlips.filter((s) => s.net > 0 && !s.invoice_id && salToPay(s) === 0).length;   // couverts par l'ordre permanent
  const done = salSlips.filter((s) => s.invoice_id).length;
  const total = salSlips.reduce((a, s) => a + (Number(s.net) || 0), 0);
  const mailRows = atts.map((a) => {
    const m = mails.find((x) => x.id === a.mail_id);
    const isImp = imported.has(a.mail_id);
    return `<div class="sal-mail">📩 PDF de la fiduciaire reçu le <b>${frDate(m.received_at)}</b> — « ${esc(a.filename)} » <span class="muted">(${esc(m.subject || "")})</span>
      ${isImp ? '<span class="sal-fact">✓ importé</span>' : `<button type="button" class="sal-from-mail" data-att="${a.id}" data-mail="${a.mail_id}">Lire et importer</button>`}</div>`;
  }).join("");
  host.innerHTML = `<div class="sal-box">
    <div class="sal-mails">${mailRows || '<span class="muted" style="font-size:.88rem">Aucun PDF de salaires de la fiduciaire dans les mails pour ce mois.</span>'}</div>
    <div class="sal-acts">
      <label class="btnlike ghost" style="margin:0">Importer un PDF de salaires<input type="file" id="sal-file" accept="application/pdf" hidden /></label>
      <button type="button" id="sal-validate" ${pending ? "" : "disabled"} title="Crée une facture à payer par personne (net, IBAN) dans l'onglet Factures">✓ Valider les salaires${pending ? ` (${pending})` : ""}</button>
      <span class="muted" style="font-size:.85rem">${salSlips.length ? `Net total : <b>${total.toLocaleString("fr-CH", { minimumFractionDigits: 2 })} CHF</b>${pending ? ` · à payer via Factures : <b>${pendAmt.toLocaleString("fr-CH", { minimumFractionDigits: 2 })} CHF</b>` : ""}${covered ? ` · ${covered} couvert(s) par ordre permanent` : ""}${done ? ` · ${done} déjà transmis à Factures` : ""}` : "Saisis ou importe les nets à payer, puis valide."}</span>
    </div></div>`;
  host.querySelectorAll(".sal-from-mail").forEach((b) => b.addEventListener("click", () => salImportFromMail(b.dataset.att, b.dataset.mail)));
  $("sal-file").addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) salStartImport(new Uint8Array(await f.arrayBuffer()), null); });
  $("sal-validate").addEventListener("click", salValidate);
}
async function salImportFromMail(attId, mailId) {
  const { data, error } = await sb.from("mail_attachments").select("content_b64").eq("id", attId).single();
  if (error || !data?.content_b64) { uiAlert("Pièce jointe illisible : " + (error?.message || "")); return; }
  const bin = atob(data.content_b64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  salStartImport(bytes, mailId);
}
async function salLibs() {
  if (!window.pdfjsLib) {
    await facLoadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }
  if (!window.PDFLib) await facLoadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js");
}
const salNorm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim();
const salNum = (s) => { const m = String(s).replace(/[' ’ ]/g, "").match(/^-?\d+(?:\.\d{1,2})?$/); return m ? Number(m[0]) : null; };
const SAL_MONTHS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
// Lecture du PDF : une page = une personne. Nom (ligne sous « Monsieur/Madame », NOM en majuscules),
// AVS, période (→ mois), « Montant versé » (net = nombre le plus à droite sur la même ligne), brut (ligne « Totaux »).
async function salParsePdf(bytes) {
  const pdf = await window.pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
  const rows = [];
  for (let pn = 1; pn <= pdf.numPages; pn++) {
    const page = await pdf.getPage(pn);
    const tc = await page.getTextContent();
    const items = tc.items.filter((it) => it.str && it.str.trim()).map((it) => ({ s: it.str.trim(), x: it.transform[4], y: it.transform[5] }));
    const lines = [];
    for (const it of items) {
      const L = lines.find((l) => Math.abs(l.y - it.y) <= 2);
      if (L) L.items.push(it); else lines.push({ y: it.y, items: [it] });
    }
    lines.sort((a, b) => b.y - a.y);                                  // du haut vers le bas
    for (const l of lines) l.items.sort((a, b) => a.x - b.x);
    const txt = (l) => l.items.map((i) => i.s).join(" ");
    const nums = (l) => l.items.map((i) => salNum(i.s)).filter((v) => v != null);
    const all = lines.map(txt).join("\n");
    const lNet = lines.find((l) => /montant\s+vers/i.test(txt(l)));
    const net = lNet ? (nums(lNet).pop() ?? null) : null;
    const lTot = lines.find((l) => /^totaux/i.test(txt(l)) && nums(l).length && nums(l).every((v) => v > 0));
    const gross = lTot ? Math.max(...nums(lTot)) : null;
    let ym = null;
    const mPer = all.match(/p[ée]riode de salaire\s*:?\s*\d{2}\.(\d{2})\.(\d{4})/i);
    if (mPer) ym = `${mPer[2]}-${mPer[1]}`;
    else { const mT = salNorm(all).match(/bulletin de salaire\s+([a-z]+)\s+(\d{4})/); if (mT && SAL_MONTHS[mT[1]]) ym = `${mT[2]}-${String(SAL_MONTHS[mT[1]]).padStart(2, "0")}`; }
    const avs = (all.match(/756\.\d{4}\.\d{4}\.\d{2}/) || [null])[0];
    let name = lines.length ? txt(lines[0]) : "", first = "", last = "";
    const iCiv = lines.findIndex((l) => /^(monsieur|madame)$/i.test(txt(l)));
    const lName = iCiv >= 0 ? lines[iCiv + 1] : null;
    if (lName) {
      name = txt(lName);
      const toks = name.split(/\s+/);
      last = toks.filter((t) => t.length > 1 && t === t.toUpperCase() && /\p{L}/u.test(t)).join(" ");
      first = toks.filter((t) => !(t.length > 1 && t === t.toUpperCase() && /\p{L}/u.test(t))).join(" ");
    }
    rows.push({ page: pn, name, first, last, avs, ym, net, gross });
  }
  return rows;
}
async function salLoadPeople() {
  if (salPeople) return salPeople;
  const roles = [...COACH_ROLES, "prof", "coach-mental", "concierge", "admin", "superadmin", "secretaire", "finance"];
  const { data: pr } = await sb.from("person_roles").select("person_id").in("role", roles);
  const ids = [...new Set((pr || []).map((r) => r.person_id))];
  const { data } = ids.length ? await sb.from("people").select("id,first_name,last_name,avs,iban").in("id", ids).order("last_name") : { data: [] };
  salPeople = data || [];
  return salPeople;
}
function salMatch(row, people) {
  const digits = (s) => String(s || "").replace(/\D/g, "");
  if (row.avs) { const p = people.find((x) => x.avs && digits(x.avs) === digits(row.avs)); if (p) return p; }
  const rl = salNorm(row.last).split(" ").filter(Boolean), rf = salNorm(row.first).split(" ").filter(Boolean);
  const cands = people.filter((p) => {
    const pl = salNorm(p.last_name).split(" ").filter(Boolean);
    return rl.length && pl.some((t) => rl.includes(t));
  });
  if (cands.length === 1) return cands[0];
  const strict = cands.filter((p) => rf[0] && salNorm(p.first_name).split(" ")[0] === rf[0]);
  return strict.length === 1 ? strict[0] : null;
}
async function salStartImport(bytes, mailId) {
  try {
    await salLibs();
    const [rows, people] = await Promise.all([salParsePdf(bytes), salLoadPeople()]);
    if (!rows.length) { uiAlert("Aucune page lisible dans ce PDF."); return; }
    salParsed = rows.map((r) => ({ ...r, person_id: salMatch(r, people)?.id || "", include: true }));
    salBytes = bytes; salMailId = mailId;
    renderSalModal(people);
  } catch (e) { uiAlert("Lecture du PDF impossible : " + (e?.message || e)); }
}
function renderSalModal(people) {
  const opts = (sel) => `<option value="">— non attribué —</option>` + people.map((p) => `<option value="${p.id}"${p.id === sel ? " selected" : ""}>${esc(p.last_name + " " + p.first_name)}</option>`).join("");
  $("sal-rows").innerHTML = salParsed.map((r, i) => `<tr class="${r.person_id ? "" : "sal-unmatched"}">
    <td><input type="checkbox" class="sal-inc" data-i="${i}" ${r.include ? "checked" : ""} /></td>
    <td>${r.page}</td><td><b>${esc(r.name || "?")}</b></td><td style="font-size:.82rem">${esc(r.avs || "—")}</td>
    <td>${r.ym || '<span class="muted">?</span>'}${r.ym && r.ym !== heuresYm ? ' <span class="muted" style="font-size:.75rem">(≠ mois affiché)</span>' : ""}</td>
    <td>${r.gross != null ? r.gross.toFixed(2) : "—"}</td>
    <td><input type="number" step="0.05" class="sal-mnet" data-i="${i}" value="${r.net != null ? r.net.toFixed(2) : ""}" style="width:100px;text-align:right" /></td>
    <td><select class="sal-mperson" data-i="${i}">${opts(r.person_id)}</select></td></tr>`).join("");
  const n = salParsed.filter((r) => !r.person_id).length;
  $("sal-note").textContent = n ? `${n} page(s) non attribuée(s) : choisis la personne dans la liste (ou décoche pour ignorer).` : "Toutes les pages sont attribuées.";
  $("sal-rows").querySelectorAll(".sal-inc").forEach((c) => c.addEventListener("change", () => { salParsed[c.dataset.i].include = c.checked; }));
  $("sal-rows").querySelectorAll(".sal-mnet").forEach((c) => c.addEventListener("change", () => { salParsed[c.dataset.i].net = c.value === "" ? null : Number(c.value); }));
  $("sal-rows").querySelectorAll(".sal-mperson").forEach((c) => c.addEventListener("change", () => { salParsed[c.dataset.i].person_id = c.value; c.closest("tr").classList.toggle("sal-unmatched", !c.value); }));
  $("sal-close").onclick = () => $("sal-modal").classList.add("hidden");
  $("sal-import").onclick = salDoImport;
  $("sal-modal").classList.remove("hidden");
}
async function salDoImport() {
  const rows = salParsed.filter((r) => r.include && r.person_id && r.ym);
  if (!rows.length) { uiAlert("Aucune page à importer (attribue au moins une page à une personne)."); return; }
  const btn = $("sal-import"); btn.disabled = true; btn.textContent = "Import…";
  const { data: sess } = await sb.auth.getSession(); const uid = sess?.session?.user?.id || null;
  let ok = 0; const errs = [];
  try {
    const src = await window.PDFLib.PDFDocument.load(salBytes);
    for (const r of rows) {
      const doc = await window.PDFLib.PDFDocument.create();
      const [pg] = await doc.copyPages(src, [r.page - 1]); doc.addPage(pg);
      const out = await doc.save();
      const path = `${r.person_id}/${r.ym}.pdf`;
      const up = await sb.storage.from("salaries").upload(path, new Blob([out], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true });
      if (up.error) { errs.push(`${r.name} : ${up.error.message}`); continue; }
      const { error } = await sb.from("salary_slips").upsert({ person_id: r.person_id, ym: r.ym, net: r.net, gross: r.gross, pdf_path: path, source: "fiduciaire", mail_id: salMailId, updated_at: new Date().toISOString(), updated_by: uid }, { onConflict: "person_id,ym" });
      if (error) { errs.push(`${r.name} : ${error.message}`); continue; }
      const p = (salPeople || []).find((x) => x.id === r.person_id);
      if (r.avs && p && !p.avs) { await sb.from("people").update({ avs: r.avs }).eq("id", r.person_id); p.avs = r.avs; }  // on retient l'AVS → prochains imports exacts
      ok++;
    }
  } catch (e) { errs.push(e?.message || String(e)); }
  btn.disabled = false; btn.textContent = "Importer";
  $("sal-modal").classList.add("hidden");
  await loadHeures();
  uiAlert(`✓ ${ok} fiche(s) de salaire importée(s).${errs.length ? "\n\nErreurs :\n" + errs.join("\n") : ""}`);
}
async function salValidate() {
  const pending = salSlips.filter((s) => !s.invoice_id && salToPay(s) > 0);
  if (!pending.length) return;
  const total = pending.reduce((a, s) => a + salToPay(s), 0);
  const nComp = pending.filter((s) => heSO(s.person_id) != null).length;
  const [yy, mm] = heuresYm.split("-");
  const label = `Salaire net ${MOIS_FR[Number(mm) - 1]} ${yy}`;
  if (!(await uiConfirm(`Transmettre ${pending.length} paiement(s) à Factures — total ${total.toLocaleString("fr-CH", { minimumFractionDigits: 2 })} CHF ?${nComp ? ` (dont ${nComp} complément(s) au-delà de l'ordre permanent)` : ""} Une facture à payer sera créée par personne (validée si l'IBAN est connu). Les personnes couvertes par leur ordre permanent sont ignorées.`))) return;
  const { data, error } = await sb.rpc("salary_validate", { p_ym: heuresYm, p_label: label });
  if (error) { uiAlert("Validation impossible : " + error.message); return; }
  await loadHeures();
  uiAlert(`✓ ${data} facture(s) créée(s) dans l'onglet Factures. Génère ensuite le paiement (pain.001) depuis Factures.`);
}
// ---- Fiche › Coach › « Rémunération versée (brut) » : par saison (juniors), détail mensuel ----
let payPid = null;
async function loadPersonPay(pid, show) {
  payPid = pid;
  const block = $("pay-block"); if (!block) return;
  block.classList.toggle("hidden", !(pid && show));
  if (!pid || !show) return;
  const sel = $("pay-season");
  const list = seasonsOf("juniors");
  const cur = currentSeason("juniors");
  sel.innerHTML = list.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join("");
  sel.value = (cur || list[0])?.id || "";
  sel.onchange = renderPersonPay;
  renderPersonPay();
}
async function renderPersonPay() {
  const pid = payPid, sea = seasons.find((s) => s.id === $("pay-season").value);
  if (!pid || !sea) { $("pay-rows").innerHTML = ""; $("pay-foot").innerHTML = ""; return; }
  const { data, error } = await sb.rpc("person_pay_season", { p_person: pid, p_from: sea.start_date, p_to: sea.end_date });
  if (error) { $("pay-rows").innerHTML = `<tr><td colspan="8" class="muted">${esc(error.message)}</td></tr>`; return; }
  const rows = data || [];
  const chf = (n) => (Math.round(Number(n) * 100) / 100).toLocaleString("fr-CH", { minimumFractionDigits: 2 });
  const lbl = (ym) => { const [y, m] = ym.split("-"); const s = `${MOIS_FR[Number(m) - 1]} ${y}`; return s.charAt(0).toUpperCase() + s.slice(1); };
  const nowYm = ymNow();
  let tBrut = 0, tNet = 0, tH = 0;
  $("pay-rows").innerHTML = rows.map((r) => {
    const salaried = r.salary != null;
    const hoursPay = !salaried && r.rate != null ? Math.round(Number(r.coach_hours) * Number(r.rate) * 100) / 100 : 0;
    const base = salaried ? Number(r.salary) : hoursPay;
    const extra = r.extra != null ? Number(r.extra) : 0;
    const brut = Math.round((base + extra) * 100) / 100;
    const future = r.ym > nowYm;
    const empty = !future && !Number(r.coach_hours) && !Number(r.prof_hours) && !extra && !salaried && r.net == null;
    if (!future) { tBrut += brut; tNet += Number(r.net || 0); tH += Number(r.coach_hours) + Number(r.prof_hours); }
    return `<tr class="${future || empty ? "muted" : ""}">
      <td><b>${lbl(r.ym)}</b>${r.ym === nowYm ? ' <span class="muted" style="font-size:.75rem">(en cours)</span>' : ""}</td>
      <td>${Number(r.coach_hours) ? `${r.coach_hours} h <span class="muted" style="font-size:.75rem">(${r.coach_courses}/${r.coach_total})</span>` : "—"}</td>
      <td>${Number(r.prof_hours) ? `${r.prof_hours} h <span class="muted" style="font-size:.75rem">(${r.prof_days} ap.-m.)</span>` : "—"}</td>
      <td>${salaried ? '<span class="he-sal">Salarié</span>' : (r.rate != null ? r.rate + ".–" : "—")}</td>
      <td>${salaried ? chf(r.salary) : (hoursPay ? chf(hoursPay) : "—")}</td>
      <td>${future ? "—" : `<input class="sal-net pay-extra" data-ym="${r.ym}" type="number" step="0.05" value="${r.extra != null ? Number(r.extra).toFixed(2) : ""}" placeholder="—" />`}</td>
      <td>${!future && (brut || salaried) ? `<b>${chf(brut)}</b>` : "—"}</td>
      <td>${r.net != null ? chf(r.net) : "—"}</td></tr>`;
  }).join("");
  $("pay-foot").innerHTML = `<tr><td><b>Total saison ${esc(sea.label)}</b></td><td colspan="5" class="muted" style="font-size:.85rem">${Math.round(tH * 100) / 100} h au total (mois écoulés)</td><td><b>${chf(tBrut)} CHF</b></td><td>${tNet ? chf(tNet) + " CHF" : "—"}</td></tr>`;
  $("pay-rows").querySelectorAll(".pay-extra").forEach((inp) => inp.addEventListener("change", async () => {
    const v = inp.value === "" ? null : Number(inp.value);
    const { data: sess } = await sb.auth.getSession();
    const { error: e2 } = await sb.from("salary_slips").upsert({ person_id: pid, ym: inp.dataset.ym, extra: v, updated_at: new Date().toISOString(), updated_by: sess?.session?.user?.id || null }, { onConflict: "person_id,ym" });
    if (e2) { uiAlert("Enregistrement impossible : " + e2.message); return; }
    renderPersonPay();
  }));
}
// ---- Fiche › « Fiche de salaire » (admin) ----
async function loadPersonSalaires(pid, show) {
  if (!pid || !show) { $("psal-rows").innerHTML = ""; return; }
  const { data } = await sb.from("salary_slips").select("*").eq("person_id", pid).order("ym", { ascending: false });
  const rows = data || [];
  $("psal-empty").hidden = rows.length > 0;
  const lbl = (ym) => { const [y, m] = ym.split("-"); const s = `${MOIS_FR[Number(m) - 1]} ${y}`; return s.charAt(0).toUpperCase() + s.slice(1); };
  $("psal-rows").innerHTML = rows.map((s) => `<tr>
    <td><b>${lbl(s.ym)}</b></td><td>${s.gross != null ? Number(s.gross).toFixed(2) : "—"}</td><td>${s.net != null ? "<b>" + Number(s.net).toFixed(2) + " CHF</b>" : "—"}</td>
    <td>${s.pdf_path ? `<button type="button" class="ghost psal-pdf" data-path="${esc(s.pdf_path)}">📄 Voir</button>` : '<span class="muted">—</span>'}</td>
    <td>${s.invoice_id ? '<span class="sal-fact">✓ transmise</span>' : '<span class="muted">—</span>'}</td>
    <td class="he-acts">${canSalaries() ? `<button type="button" class="ghost psal-del" data-id="${s.id}" data-path="${esc(s.pdf_path || "")}" title="Supprimer">✕</button>` : ""}</td></tr>`).join("");
  $("psal-rows").querySelectorAll(".psal-pdf").forEach((b) => b.addEventListener("click", () => salOpenPdf(b.dataset.path)));
  $("psal-rows").querySelectorAll(".psal-del").forEach((b) => b.addEventListener("click", async () => {
    if (!(await uiConfirm("Supprimer cette fiche de salaire ?"))) return;
    if (b.dataset.path) await sb.storage.from("salaries").remove([b.dataset.path]);
    await sb.from("salary_slips").delete().eq("id", b.dataset.id);
    loadPersonSalaires(pid, true);
  }));
  const mIn = $("psal-month"); if (!mIn.value) mIn.value = ymNow();
  $("psal-file").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    const ym = mIn.value; if (!/^\d{4}-\d{2}$/.test(ym)) { uiAlert("Choisis d'abord le mois."); return; }
    $("psal-status").textContent = "Envoi…";
    const path = `${pid}/${ym}.pdf`;
    const up = await sb.storage.from("salaries").upload(path, f, { contentType: "application/pdf", upsert: true });
    if (up.error) { $("psal-status").textContent = "Erreur : " + up.error.message; return; }
    const { data: sess } = await sb.auth.getSession();
    await sb.from("salary_slips").upsert({ person_id: pid, ym, pdf_path: path, source: "manual", updated_at: new Date().toISOString(), updated_by: sess?.session?.user?.id || null }, { onConflict: "person_id,ym" });
    $("psal-status").textContent = "✓ Fiche déposée.";
    loadPersonSalaires(pid, true);
  };
}
// ---- Heures › « Mes fiches de salaire » (la personne ne voit que les siennes : RLS) ----
async function renderMySalaires() {
  const host = $("heures-mine"); if (!host || !myPersonId) return;
  const { data } = await sb.from("salary_slips").select("ym,net,pdf_path").eq("person_id", myPersonId).order("ym", { ascending: false }).limit(24);
  const rows = (data || []).filter((s) => s.pdf_path || s.net != null);
  if (!rows.length) return;
  const lbl = (ym) => { const [y, m] = ym.split("-"); const s = `${MOIS_FR[Number(m) - 1]} ${y}`; return s.charAt(0).toUpperCase() + s.slice(1); };
  const div = document.createElement("div"); div.className = "he-mine";
  div.innerHTML = `<div class="he-mine-h">Mes fiches de salaire</div>` + rows.map((s) => `<div class="he-mine-row"><span>${lbl(s.ym)}${s.net != null ? ` — net <b>${Number(s.net).toFixed(2)} CHF</b>` : ""}</span>
    ${s.pdf_path ? `<button type="button" class="ghost sal-pdf" data-path="${esc(s.pdf_path)}">📄 Voir la fiche</button>` : '<span class="muted" style="font-size:.85rem">PDF pas encore disponible</span>'}</div>`).join("");
  div.querySelectorAll(".sal-pdf").forEach((b) => b.addEventListener("click", () => salOpenPdf(b.dataset.path)));
  host.appendChild(div);
}

// ===================================================================
//  Factures (à payer) — upload PDF, validation, export fiduciaire
// ===================================================================
let facList = [], facAccts = [], facFilter = "", facInit = false, facEditId = null;
const FAC_ST = { a_valider: ["À valider", "fac-todo"], validee: ["Validée", "fac-done"], en_paiement: ["Paiement généré", "fac-pay"], payee: ["Payée", "fac-paid"] };
const FAC_ORDER = ["a_valider", "validee", "en_paiement", "payee"];
function initFactures() {
  if (facInit) return; facInit = true;
  $("fac-file").addEventListener("change", (e) => { facUpload([...e.target.files]); e.target.value = ""; });
  $("fac-export").addEventListener("click", facExportZip);
  $("fac-pain").addEventListener("click", facGenPain001);
  $("fac-close").addEventListener("click", () => $("fac-modal").classList.add("hidden"));
  $("fac-modal").addEventListener("click", (e) => { if (e.target === $("fac-modal")) $("fac-modal").classList.add("hidden"); });
  $("fac-save").addEventListener("click", facSave);
  document.querySelectorAll("#view-factures .fac-subtab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#view-factures .fac-subtab").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll("#view-factures .fac-sub").forEach((s) => s.classList.toggle("hidden", s.id !== "fac-sub-" + b.dataset.fsub));
    if (b.dataset.fsub === "tarifs") { renderFacTarifs(); renderFacPeak(); }
    if (b.dataset.fsub === "emises") loadOutInvoices();
  }));
  initOutInvoices();
}
// ===================================================================
//  Factures ÉMISES (à encaisser) : lot par filière → n° + référence RF → PDF QR-facture → envoi mail → suivi
// ===================================================================
const OI_ST = { a_envoyer: ["À envoyer", "fac-todo"], envoyee: ["Envoyée", "fac-pay"], payee: ["Payée", "fac-paid"], annulee: ["Annulée", ""] };
const OI_ORDER = ["a_envoyer", "envoyee", "payee", "annulee"];
// Lot par filière = filières « grille Tarifs » ; sport-études / pro / pro U18 = depuis le contrat de la fiche.
const OI_FILIERES = [["performance", "Performance"], ["competition", "Compétition"], ["club", "Club"], ["kidstennis", "KidsTennis"], ["adultes", "Adultes"]];
const OI_FIL_ALL = [...OI_FILIERES, ["sport-etudes", "Sport-études"], ["pro", "Pro"], ["pro-u18", "Pro U18"]];
const OI_FROM = "info@teamlausanne.ch";
let oiList = [], oiFilter = "", oiInit = false, oiPrep = [], oiSendIds = [], oiSel = new Set();
let oieId = null, oieDebtorPid = null, oiePlayerPid = null, oieSeason = null, oieFiliere = null;
const oiChf = (n) => Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");   // 1 234.50 (format QR-facture)
const oiFmt4 = (s) => String(s || "").replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
const oiFil = (v) => (OI_FIL_ALL.find(([k]) => k === v) || [v, v])[1];

function initOutInvoices() {
  if (oiInit) return; oiInit = true;
  $("oi-prep").addEventListener("click", oiOpenPrep);
  $("oi-close").addEventListener("click", () => $("oi-modal").classList.add("hidden"));
  $("oi-load").addEventListener("click", oiLoadPlayers);
  $("oi-generate").addEventListener("click", oiGenerate);
  $("oi-all").addEventListener("change", () => { $("oi-prep-rows").querySelectorAll(".oi-inc").forEach((c) => { c.checked = $("oi-all").checked; oiPrep[c.dataset.i].include = c.checked; }); oiUpdateGenBtn(); });
  $("oi-send-all").addEventListener("click", () => oiOpenSend(oiList.filter((x) => x.status === "a_envoyer" && x.pdf_path).map((x) => x.id)));
  $("oi-send-sel").addEventListener("click", () => { if (!oiSel.size) { uiAlert("Coche d'abord les factures à envoyer."); return; } oiOpenSend([...oiSel]); });
  $("oi-sel-all").addEventListener("change", () => { const on = $("oi-sel-all").checked; $("oi-rows").querySelectorAll(".oi-chk").forEach((c) => { c.checked = on; if (on) oiSel.add(c.dataset.id); else oiSel.delete(c.dataset.id); }); oiUpdateSelBtn(); });
  $("oi-send-close").addEventListener("click", () => $("oi-send-modal").classList.add("hidden"));
  $("oi-send-go").addEventListener("click", oiSendGo);
  ["oi-send-subject", "oi-send-text"].forEach((id) => $(id).addEventListener("input", oiSendPreview));
  ["oi-filiere", "oi-season", "oi-inst-total"].forEach((id) => $(id).addEventListener("change", oiLoadPlayers));   // liste chargée automatiquement
  // Éditeur (nouvelle / personnelle / blanche / modification)
  $("oi-new").addEventListener("click", () => oiOpenEdit(null));
  $("oie-close").addEventListener("click", () => $("oi-edit-modal").classList.add("hidden"));
  $("oie-add").addEventListener("click", () => { oieAddItem("", ""); });
  $("oie-save").addEventListener("click", oiSaveEdit);
  let t = null;
  $("oie-search").addEventListener("input", () => { clearTimeout(t); t = setTimeout(oieSearch, 250); });
  $("oie-search").addEventListener("blur", () => setTimeout(() => $("oie-results").classList.add("hidden"), 200));
}
function oiUpdateSelBtn() { $("oi-send-sel").textContent = `✉ Envoyer la sélection${oiSel.size ? ` (${oiSel.size})` : ""}`; }
async function loadOutInvoices() {
  initOutInvoices();
  if (!facAccts.length) { const { data: acc } = await sb.from("finance_accounts").select("*").order("sort"); facAccts = acc || []; }
  const { data, error } = await sb.from("out_invoices").select("*").order("number", { ascending: false });
  if (error) { $("oi-rows").innerHTML = `<tr><td colspan="9" class="muted">Erreur : ${esc(error.message)}</td></tr>`; return; }
  oiList = data || [];
  const pids = [...new Set(oiList.map((x) => x.person_id).filter(Boolean))];
  if (pids.length) {
    const { data: pl } = await sb.from("people").select("id,first_name,last_name").in("id", pids);
    const nm = {}; for (const p of pl || []) nm[p.id] = `${p.first_name} ${p.last_name}`;
    for (const x of oiList) x.player_name = nm[x.person_id] || "";
  }
  renderOiFilters(); renderOutInvoices();
  // PDF manquant (facture modifiée en base, échec précédent…) → régénéré automatiquement, en arrière-plan.
  const missing = oiList.filter((x) => !x.pdf_path && (x.status === "a_envoyer" || x.status === "envoyee"));
  if (missing.length && !oiRegen) {
    oiRegen = true;
    try { for (const x of missing) { try { await oiMakePdf(x); } catch (e) { console.warn("PDF", x.number, e); } } }
    finally { oiRegen = false; }
    renderOiFilters(); renderOutInvoices();
  }
}
let oiRegen = false;
function renderOiFilters() {
  const counts = { "": oiList.length };
  for (const f of oiList) counts[f.status] = (counts[f.status] || 0) + 1;
  const chip = (v, l) => `<button type="button" class="chip filt${oiFilter === v ? " sel" : ""}" data-st="${v}">${l} <span class="muted">(${counts[v] || 0})</span></button>`;
  $("oi-filters").innerHTML = chip("", "Toutes") + OI_ORDER.map((s) => chip(s, OI_ST[s][0])).join("");
  $("oi-filters").querySelectorAll(".filt").forEach((b) => b.addEventListener("click", () => { oiFilter = b.dataset.st; renderOiFilters(); renderOutInvoices(); }));
  const n = oiList.filter((x) => x.status === "a_envoyer" && x.pdf_path).length;
  $("oi-send-all").textContent = `✉ Envoyer les factures à envoyer${n ? ` (${n})` : ""}`;
  $("oi-send-all").disabled = !n;
}
function renderOutInvoices() {
  const rows = oiList.filter((f) => !oiFilter || f.status === oiFilter);
  $("oi-empty").hidden = rows.length > 0;
  for (const id of [...oiSel]) if (!oiList.find((x) => x.id === id && x.status !== "payee" && x.status !== "annulee")) oiSel.delete(id);
  $("oi-rows").innerHTML = rows.map((f) => {
    const [lbl, cls] = OI_ST[f.status] || [f.status, ""];
    const editable = f.status !== "payee" && f.status !== "annulee";
    const items = Array.isArray(f.items) && f.items.length ? f.items : (f.label ? [{ label: f.label, amount: f.amount }] : []);
    const acts = (editable ? `<button class="ghost oi-edit" data-id="${f.id}" title="Modifier (dates, articles, destinataire)">✎</button>` : "")
      + (f.status === "a_envoyer" && f.pdf_path ? `<button class="ghost oi-send" data-id="${f.id}">Envoyer</button>` : "")
      + (f.status === "envoyee" ? `<button class="ghost oi-send" data-id="${f.id}" title="Renvoyer">↻</button><button class="ghost oi-paid" data-id="${f.id}">Payée</button>` : "")
      + (editable ? `<button class="ghost oi-cancel" data-id="${f.id}" title="Annuler">✕</button>` : "");
    const dateIn = (k) => editable ? `<input type="date" class="oi-date" data-id="${f.id}" data-k="${k}" value="${f[k] || ""}" style="width:118px" />` : (f[k] ? frDate(f[k]) : "—");
    return `<tr class="${f.status === "annulee" ? "muted" : ""}">
      <td>${editable && f.pdf_path ? `<input type="checkbox" class="oi-chk" data-id="${f.id}" ${oiSel.has(f.id) ? "checked" : ""} />` : ""}</td>
      <td style="white-space:nowrap"><b>${esc(f.number)}</b>${f.reference ? `<div class="muted" style="font-size:.7rem">${esc(oiFmt4(f.reference))}</div>` : ""}</td>
      <td>${esc(f.debtor_name || "—")}</td>
      <td style="font-size:.8rem">${f.debtor_email ? esc(f.debtor_email) : '<span style="color:#b45309">—</span>'}</td>
      <td>${esc(f.player_name || "")}</td>
      <td class="muted" style="font-size:.82rem">${items.map((it) => `<div>${esc(it.label || "")}${items.length > 1 ? ` <span style="white-space:nowrap">— ${oiChf(it.amount || 0)}</span>` : ""}</div>`).join("")}</td>
      <td style="white-space:nowrap"><b>${oiChf(f.amount)}</b></td>
      <td style="white-space:nowrap">${dateIn("issue_date")}</td>
      <td style="white-space:nowrap">${dateIn("due_date")}</td>
      <td>${f.pdf_path ? `<button class="ghost oi-pdf" data-path="${esc(f.pdf_path)}">📄</button>` : `<button class="ghost oi-regen" data-id="${f.id}" title="Générer le PDF">⟳ PDF</button>`}</td>
      <td><span class="fac-st ${cls}">${lbl}</span>${f.sent_at ? `<div class="muted" style="font-size:.7rem">${frDate(f.sent_at)}</div>` : ""}</td>
      <td class="he-acts">${acts}</td></tr>`;
  }).join("");
  const R = $("oi-rows");
  R.querySelectorAll(".oi-chk").forEach((c) => c.addEventListener("change", () => { if (c.checked) oiSel.add(c.dataset.id); else oiSel.delete(c.dataset.id); oiUpdateSelBtn(); }));
  oiUpdateSelBtn();
  R.querySelectorAll(".oi-edit").forEach((b) => b.addEventListener("click", () => oiOpenEdit(oiList.find((x) => x.id === b.dataset.id))));
  R.querySelectorAll(".oi-date").forEach((inp) => inp.addEventListener("change", async () => {   // dates modifiables en ligne → PDF régénéré
    const f = oiList.find((x) => x.id === inp.dataset.id); if (!f) return;
    const patch = {}; patch[inp.dataset.k] = inp.value || null;
    const { error } = await sb.from("out_invoices").update(patch).eq("id", f.id);
    if (error) { uiAlert("Modification impossible : " + error.message); return; }
    Object.assign(f, patch);
    try { await oiMakePdf(f); } catch (e) { uiAlert(e?.message || e); }
    loadOutInvoices();
  }));
  R.querySelectorAll(".oi-pdf").forEach((b) => b.addEventListener("click", async () => {
    const { data, error } = await sb.storage.from("out_invoices").createSignedUrl(b.dataset.path, 600);
    if (error || !data?.signedUrl) { uiAlert("PDF indisponible : " + (error?.message || "")); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }));
  R.querySelectorAll(".oi-regen").forEach((b) => b.addEventListener("click", async () => { const f = oiList.find((x) => x.id === b.dataset.id); if (f) { await oiMakePdf(f); loadOutInvoices(); } }));
  R.querySelectorAll(".oi-send").forEach((b) => b.addEventListener("click", () => oiOpenSend([b.dataset.id])));
  R.querySelectorAll(".oi-paid").forEach((b) => b.addEventListener("click", async () => { await sb.from("out_invoices").update({ status: "payee", paid_at: new Date().toISOString() }).eq("id", b.dataset.id); loadOutInvoices(); }));
  R.querySelectorAll(".oi-cancel").forEach((b) => b.addEventListener("click", async () => {
    const f = oiList.find((x) => x.id === b.dataset.id);
    if (!(await uiConfirm(`Annuler la facture ${f?.number} ? (elle reste dans la liste, statut « Annulée »)`))) return;
    await sb.from("out_invoices").update({ status: "annulee" }).eq("id", b.dataset.id); loadOutInvoices();
  }));
}
// ---- Préparation d'un lot ----
async function oiOpenPrep() {
  await loadSeasonsList();
  const cur = currentSeason("juniors");
  $("oi-filiere").innerHTML = OI_FILIERES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  $("oi-season").innerHTML = seasonsOf("juniors").map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join("");
  if (cur) $("oi-season").value = cur.id;
  $("oi-acct").innerHTML = facAccts.map((a) => `<option value="${a.id}">${esc(a.name)} — ${esc(a.iban)}</option>`).join("");
  const def = facAccts.find((a) => a.is_default) || facAccts[0]; if (def) $("oi-acct").value = def.id;
  const due = new Date(); due.setDate(due.getDate() + 30); $("oi-due").value = due.toISOString().slice(0, 10);
  oiPrep = []; $("oi-prep-rows").innerHTML = ""; $("oi-prep-note").textContent = ""; $("oi-gen-status").textContent = ""; $("oi-generate").disabled = true;
  $("oi-modal").classList.remove("hidden");
  oiLoadPlayers();   // chargement automatique
}
function oiUpdateGenBtn() {
  const n = oiPrep.filter((r) => r.include && r.amount > 0).length;
  $("oi-generate").disabled = !n; $("oi-generate").textContent = n ? `Générer ${n} facture(s)` : "Générer les factures";
}
function oiAddr(p) { return p ? { street: (p.address || "").trim(), zip: (p.postal_code || "").trim(), city: (p.city || "").trim(), email: (p.email || "").trim() } : { street: "", zip: "", city: "", email: "" }; }
// Champ texte « Parent 1 / Parent 2 » de la fiche du jeune : « Nom Prénom · 079 … · email »
function oiParseParent(s) {
  if (!s || !String(s).trim()) return null;
  const parts = String(s).split("·").map((x) => x.trim()).filter(Boolean);
  const email = parts.find((x) => /@/.test(x)) || "";
  return { name: parts[0] || "", email };
}
// Candidats destinataires d'un joueur, par ordre de priorité : parent LIÉ (avec e-mail), Parent 1, Parent 2 (texte de la
// fiche, adresse postale = celle du jeune), parent lié sans e-mail, puis le joueur lui-même.
function oiDebtorCands(p, linkedParents) {
  const a = oiAddr(p); const c = [];
  for (const lp of linkedParents || []) { const la = oiAddr(lp); c.push({ key: "l:" + lp.id, pid: lp.id, name: `${lp.first_name} ${lp.last_name}`, street: la.street || a.street, zip: la.zip || a.zip, city: la.city || a.city, email: la.email, label: `${lp.last_name} ${lp.first_name} (parent lié)` }); }
  for (const [k, lbl] of [["parent1", "Parent 1"], ["parent2", "Parent 2"]]) { const pp = oiParseParent(p[k]); if (pp) c.push({ key: k, pid: null, name: pp.name, street: a.street, zip: a.zip, city: a.city, email: pp.email, label: `${pp.name} (${lbl})` }); }
  c.push({ key: "self", pid: p.id, name: `${p.first_name} ${p.last_name}`, street: a.street, zip: a.zip, city: a.city, email: a.email, label: `${p.last_name} ${p.first_name} (joueur)` });
  const def = c.find((x) => x.key.startsWith("l:") && x.email) || c.find((x) => (x.key === "parent1" || x.key === "parent2") && x.email) || c.find((x) => x.key.startsWith("l:")) || c[c.length - 1];
  return { cands: c, def };
}
async function oiLoadPlayers() {
  const fil = $("oi-filiere").value, seasonId = $("oi-season").value;
  const note = $("oi-prep-note"); note.textContent = "Chargement…";
  const { data: rp } = await sb.from("role_periods").select("person_id").eq("season_id", seasonId).eq("role", fil);
  const ids = [...new Set((rp || []).map((r) => r.person_id))];
  if (!ids.length) { note.textContent = `Aucun joueur en ${oiFil(fil)} pour cette saison (rôles par saison de la fiche).`; oiPrep = []; $("oi-prep-rows").innerHTML = ""; oiUpdateGenBtn(); return; }
  const [{ data: pl }, { data: gs }, { data: ct }, { data: st }] = await Promise.all([
    sb.from("people").select("id,first_name,last_name,address,postal_code,city,email,parent1,parent2").in("id", ids),
    sb.from("guardianships").select("guardian_id,child_id,relation").in("child_id", ids),
    sb.from("player_contracts").select("person_id,data").eq("season_id", seasonId).in("person_id", ids),
    sb.from("app_settings").select("value").eq("key", "sub_prices").maybeSingle(),
  ]);
  const gIds = [...new Set((gs || []).filter((g) => g.relation !== "sibling").map((g) => g.guardian_id))];
  const { data: gp } = gIds.length ? await sb.from("people").select("id,first_name,last_name,address,postal_code,city,email").in("id", gIds) : { data: [] };
  const byId = {}; for (const p of [...(pl || []), ...(gp || [])]) byId[p.id] = p;
  const grid = st?.value || {}; const gridPrice = parseFloat(grid[fil]);
  const nInst = parseInt($("oi-inst-total").value) || null;
  oiPrep = (pl || []).sort((a, b) => a.last_name.localeCompare(b.last_name)).map((p) => {
    const parents = (gs || []).filter((g) => g.child_id === p.id && g.relation !== "sibling").map((g) => byId[g.guardian_id]).filter(Boolean);
    const { cands, def } = oiDebtorCands(p, parents);   // parent lié / Parent 1 / Parent 2 / joueur
    const d = (ct || []).find((c) => c.person_id === p.id)?.data || {};
    const fee = parseFloat(d["Annual fee"]), cInst = parseInt(d["Instalments"]);
    let amount = null, source = "—";
    const total = nInst || cInst || 1;
    if (fee > 0) { amount = Math.round((fee / total) * 100) / 100; source = `contrat ${oiChf(fee)} ÷ ${total}`; }
    else if (gridPrice > 0) { amount = Math.round((gridPrice / total) * 100) / 100; source = `tarifs ${oiChf(gridPrice)} ÷ ${total}`; }
    return { include: amount > 0, person: p, cands, debtor: def.key, amount, source, total };
  });
  renderOiPrep();
  const missing = oiPrep.filter((r) => !(r.amount > 0)).length;
  note.textContent = `${oiPrep.length} joueur(s)${missing ? ` · ${missing} sans montant (pas de contrat ni de tarif : saisis-le ou décoche)` : ""}.`;
}
function renderOiPrep() {
  $("oi-prep-rows").innerHTML = oiPrep.map((r, i) => {
    const a = r.cands.find((c) => c.key === r.debtor) || r.cands[r.cands.length - 1];
    const addrOk = a.street && a.zip && a.city;
    return `<tr class="${r.include ? "" : "muted"}">
      <td><input type="checkbox" class="oi-inc" data-i="${i}" ${r.include ? "checked" : ""} /></td>
      <td><b>${esc(r.person.last_name + " " + r.person.first_name)}</b></td>
      <td><select class="oi-debtor" data-i="${i}">${r.cands.map((c) => `<option value="${c.key}"${c.key === r.debtor ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select></td>
      <td style="font-size:.82rem">${addrOk ? esc(`${a.street}, ${a.zip} ${a.city}`) : '<span style="color:#b45309">adresse incomplète</span>'}</td>
      <td style="font-size:.82rem">${a.email ? esc(a.email) : '<span style="color:#b45309">pas d\'e-mail</span>'}</td>
      <td class="muted" style="font-size:.8rem">${esc(r.source)}</td>
      <td><input type="number" step="0.05" min="0" class="oi-amt" data-i="${i}" value="${r.amount != null ? r.amount.toFixed(2) : ""}" style="width:100px;text-align:right" /></td></tr>`;
  }).join("");
  $("oi-prep-rows").querySelectorAll(".oi-inc").forEach((c) => c.addEventListener("change", () => { oiPrep[c.dataset.i].include = c.checked; c.closest("tr").classList.toggle("muted", !c.checked); oiUpdateGenBtn(); }));
  $("oi-prep-rows").querySelectorAll(".oi-amt").forEach((c) => c.addEventListener("change", () => { oiPrep[c.dataset.i].amount = c.value === "" ? null : Number(c.value); oiUpdateGenBtn(); }));
  $("oi-prep-rows").querySelectorAll(".oi-debtor").forEach((c) => c.addEventListener("change", () => { oiPrep[c.dataset.i].debtor = c.value; renderOiPrep(); }));
  oiUpdateGenBtn();
}
// Référence SCOR (ISO 11649) : « RF » + 2 chiffres de contrôle (mod 97-10) + n° de facture (chiffres).
function oiScor(base) {
  const s = (base + "RF00").toUpperCase().replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let m = 0; for (const ch of s) m = (m * 10 + Number(ch)) % 97;
  return "RF" + String(98 - m).padStart(2, "0") + base;
}
async function oiGenerate() {
  const rows = oiPrep.filter((r) => r.include && r.amount > 0);
  if (!rows.length) return;
  const fil = $("oi-filiere").value, seasonId = $("oi-season").value, sea = seasons.find((s) => s.id === seasonId);
  const acct = facAccts.find((a) => a.id === $("oi-acct").value) || facAccts[0];
  const instNo = parseInt($("oi-inst-no").value) || 1, due = $("oi-due").value || null, tpl = $("oi-label").value || "{filiere} {saison} — {joueur}";
  if (!acct?.iban) { uiAlert("Compte à créditer sans IBAN."); return; }
  if (!(await uiConfirm(`Générer ${rows.length} facture(s) « ${oiFil(fil)} ${sea?.label || ""} » — total ${oiChf(rows.reduce((a, r) => a + r.amount, 0))} CHF ? (numérotées, avec PDF QR-facture ; à envoyer ensuite)`))) return;
  const btn = $("oi-generate"); btn.disabled = true; const st = $("oi-gen-status");
  const { data: sess } = await sb.auth.getSession(); const uid = sess?.session?.user?.id || null;
  let ok = 0; const errs = [];
  for (const r of rows) {
    st.textContent = `Facture ${ok + 1}/${rows.length}…`;
    try {
      const a = r.cands.find((c) => c.key === r.debtor) || r.cands[r.cands.length - 1];
      const { data: num, error: e1 } = await sb.rpc("out_invoice_next_number"); if (e1) throw new Error(e1.message);
      const label = tpl.replace("{filiere}", oiFil(fil)).replace("{saison}", sea?.label || "").replace("{n}", instNo).replace("{total}", r.total).replace("{joueur}", r.person.first_name + " " + r.person.last_name);
      const inv = { number: num, season_id: seasonId, filiere: fil, person_id: r.person.id, debtor_person_id: a.pid,
        debtor_name: a.name, debtor_street: a.street || null, debtor_zip: a.zip || null, debtor_city: a.city || null, debtor_email: a.email || null,
        label, items: [{ label, amount: r.amount }], instalment_no: instNo, instalment_total: r.total, amount: r.amount, currency: "CHF", due_date: due,
        reference: oiScor(num.replace(/\D/g, "")), account_id: acct.id, status: "a_envoyer", created_by: uid };
      const { data: ins, error: e2 } = await sb.from("out_invoices").insert(inv).select().single(); if (e2) throw new Error(e2.message);
      await oiMakePdf({ ...ins, player_name: r.person.first_name + " " + r.person.last_name });
      ok++;
    } catch (e) { errs.push(`${r.person.last_name} : ${e?.message || e}`); }
  }
  st.textContent = ""; btn.disabled = false;
  $("oi-modal").classList.add("hidden");
  await loadOutInvoices();
  uiAlert(`✓ ${ok} facture(s) générée(s).${errs.length ? "\n\nErreurs :\n" + errs.join("\n") : ""}\n\nÉtape suivante : « Envoyer les factures à envoyer ».`);
}
// ---- PDF : facture A4 + section paiement QR-facture suisse (norme SIX v2.3, adresses structurées) ----
function oiSplitStreet(line) {
  const s = String(line || "").trim();
  const cp = s.match(/^(?:CP|Case postale|Postfach)\s*(\d+)\s*$/i); if (cp) return ["Case postale", cp[1]];
  const m = s.match(/^(.*?)[\s,]+(\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?)$/); return m ? [m[1].trim(), m[2]] : [s, ""];
}
function oiSpc(inv, acct) {
  const [cStreet, cNo] = oiSplitStreet(acct.addr_line1);
  const cm = String(acct.addr_line2 || "").trim().match(/^(\d{4})\s+(.+)$/); const cZip = cm ? cm[1] : "", cCity = cm ? cm[2] : String(acct.addr_line2 || "");
  const hasD = inv.debtor_name && inv.debtor_street && inv.debtor_zip && inv.debtor_city;
  const [dStreet, dNo] = oiSplitStreet(inv.debtor_street);
  const L = ["SPC", "0200", "1", acct.iban.replace(/\s+/g, ""),
    "S", acct.name.slice(0, 70), cStreet.slice(0, 70), cNo.slice(0, 16), cZip, cCity.slice(0, 35), "CH",
    "", "", "", "", "", "", "",
    Number(inv.amount).toFixed(2), inv.currency || "CHF",
    ...(hasD ? ["S", inv.debtor_name.slice(0, 70), dStreet.slice(0, 70), dNo.slice(0, 16), inv.debtor_zip, inv.debtor_city.slice(0, 35), "CH"] : ["", "", "", "", "", "", ""]),
    "SCOR", inv.reference, (inv.label || "").slice(0, 140), "EPD"];
  return { payload: L.join("\n"), cStreet, cNo, cZip, cCity, dStreet, dNo, hasD };
}
async function oiLibs() {
  if (!window.jspdf) await facLoadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  if (!window.qrcode) await facLoadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js");
  if (window.qrcode?.stringToBytesFuncs?.["UTF-8"]) window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
}
// Logo Team Lausanne (webp → PNG via canvas, jsPDF ne lit pas le webp), mis en cache.
let oiLogoPng = null;
async function oiLogo() {
  if (oiLogoPng) return oiLogoPng;
  try {
    const img = new Image(); img.src = "assets/logo-academie.webp"; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0); oiLogoPng = c.toDataURL("image/png");
  } catch (e) { console.warn("logo facture :", e); oiLogoPng = null; }
  return oiLogoPng;
}
async function oiBuildPdf(inv) {
  await oiLibs();
  const acct = facAccts.find((a) => a.id === inv.account_id) || facAccts.find((a) => a.is_default) || facAccts[0];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const T = (s, x, y, o = {}) => { doc.setFont("helvetica", o.b ? "bold" : "normal"); doc.setFontSize(o.s || 10); doc.text(String(s ?? ""), x, y, o.al ? { align: o.al } : undefined); };
  const sp = oiSpc(inv, acct);
  const cLines = [acct.name, [sp.cStreet, sp.cNo].filter(Boolean).join(" "), `${sp.cZip} ${sp.cCity}`.trim()];
  const dLines = sp.hasD ? [inv.debtor_name, [sp.dStreet, sp.dNo].filter(Boolean).join(" "), `${inv.debtor_zip} ${inv.debtor_city}`] : [inv.debtor_name || ""];
  // --- En-tête : logo Team Lausanne + titre + bandeau bleu (charte : bleu #1e3ad1) ---
  const BLUE = [30, 58, 209], INK = [15, 31, 110], LIGHT = [232, 237, 255], GREY = [110, 110, 110];
  const logo = await oiLogo();
  if (logo) doc.addImage(logo, "PNG", 18, 11, 26, 27);
  doc.setTextColor(...BLUE); T("FACTURE", 192, 24, { b: true, s: 26, al: "right" });
  doc.setTextColor(...GREY); T(`N° ${inv.number}`, 192, 31.5, { b: true, s: 12, al: "right" });
  doc.setFillColor(...BLUE); doc.rect(18, 43, 174, 1.6, "F");
  doc.setTextColor(...INK); T(acct.name, 18, 51, { b: true, s: 10.5 });
  doc.setTextColor(...GREY); T(`${cLines[1]} · ${cLines[2]} · ${OI_FROM}`, 18, 56, { s: 8.5 });
  // Encadré date / échéance / référence
  doc.setFillColor(...LIGHT); doc.roundedRect(118, 47.5, 74, 24.5, 2, 2, "F");
  const kv = (k, v, yy) => { doc.setTextColor(...GREY); T(k, 122, yy, { s: 7.5 }); doc.setTextColor(...INK); T(v, 188, yy, { b: true, s: 9, al: "right" }); };
  kv("Date", frDate(inv.issue_date), 54); kv("Échéance", inv.due_date ? frDate(inv.due_date) : "à réception", 60.5); kv("Référence", oiFmt4(inv.reference), 67);
  // Destinataire (fenêtre enveloppe, à gauche)
  let y = 82; doc.setTextColor(...GREY); T("FACTURÉ À", 18, y - 5, { b: true, s: 7 }); doc.setTextColor(0);
  for (const l of dLines) { T(l, 18, y, { s: 11 }); y += 5.5; }
  if (inv.person_id && (!inv.player_name || !inv.player_gender)) {   // nom + genre du joueur (Joueur / Joueuse)
    const { data: pj } = await sb.from("people").select("first_name,last_name,gender").eq("id", inv.person_id).maybeSingle();
    if (pj) { inv.player_name = `${pj.first_name} ${pj.last_name}`; inv.player_gender = pj.gender || ""; }
  }
  if (inv.player_name && inv.player_name !== inv.debtor_name) {
    const who = inv.player_gender === "F" ? "Joueuse" : inv.player_gender === "M" ? "Joueur" : "Joueur·euse";
    doc.setTextColor(...GREY); T(`${who} : ${inv.player_name}`, 18, y + 1, { s: 8.5 }); doc.setTextColor(0);
  }
  // --- Articles (en-tête bleu, lignes alternées) ---
  const items = Array.isArray(inv.items) && inv.items.length ? inv.items : [{ label: inv.label || "", amount: inv.amount }];
  y = 106;
  doc.setFillColor(...BLUE); doc.rect(18, y, 174, 8, "F"); doc.setTextColor(255);
  T("Désignation", 21, y + 5.5, { b: true, s: 9 }); T("Montant CHF", 189, y + 5.5, { b: true, s: 9, al: "right" }); doc.setTextColor(0);
  let yi = y + 8, zebra = false;
  for (const it of items) {
    const desc = doc.splitTextToSize(it.label || "", 135); const h = desc.length * 5 + 4;
    if (zebra) { doc.setFillColor(...LIGHT); doc.rect(18, yi, 174, h, "F"); } zebra = !zebra;
    T(desc, 21, yi + 5.5, { s: 10 }); T(oiChf(it.amount || 0), 189, yi + 5.5, { s: 10, al: "right" });
    yi += h;
  }
  doc.setDrawColor(...BLUE); doc.setLineWidth(0.6); doc.line(18, yi, 192, yi); doc.setLineWidth(0.2); doc.setDrawColor(0);
  doc.setTextColor(...INK); T("Total à payer", 120, yi + 8.5, { b: true, s: 12 }); T(`CHF ${oiChf(inv.amount)}`, 189, yi + 8.5, { b: true, s: 13, al: "right" });
  doc.setTextColor(...GREY);
  T(`Payable jusqu'au ${inv.due_date ? frDate(inv.due_date) : "réception"} au moyen de la QR-facture ci-dessous (référence ${oiFmt4(inv.reference)}).`, 18, yi + 18, { s: 8.5 });
  doc.setTextColor(...INK); T("Merci pour votre confiance", 18, yi + 27, { b: true, s: 13 });
  doc.setTextColor(...GREY); T("Team Lausanne Academy", 18, yi + 32, { s: 9 });
  doc.setTextColor(0);
  // --- Section paiement (bas de page : récépissé 62 mm + section paiement 148 mm, hauteur 105 mm) ---
  const Y = 192;
  doc.setLineDashPattern([1.5, 1], 0); doc.setDrawColor(0); doc.line(0, Y, 210, Y); doc.line(62, Y, 62, 297); doc.setLineDashPattern([], 0);
  T("À détacher avant le versement", 105, Y - 1.5, { s: 6, al: "center" });
  const ibanF = oiFmt4(acct.iban), refF = oiFmt4(inv.reference);
  // Récépissé
  T("Récépissé", 5, Y + 7, { b: true, s: 11 });
  T("Compte / Payable à", 5, Y + 15, { b: true, s: 6 }); T(ibanF, 5, Y + 18.5, { s: 8 }); cLines.forEach((l, i) => T(l, 5, Y + 22 + i * 3.5, { s: 8 }));
  T("Référence", 5, Y + 36, { b: true, s: 6 }); T(refF, 5, Y + 39.5, { s: 8 });
  T("Payable par", 5, Y + 45, { b: true, s: 6 }); dLines.forEach((l, i) => T(l, 5, Y + 48.5 + i * 3.5, { s: 8 }));
  T("Monnaie", 5, Y + 76, { b: true, s: 6 }); T("Montant", 22, Y + 76, { b: true, s: 6 }); T("CHF", 5, Y + 80, { s: 8 }); T(oiChf(inv.amount), 22, Y + 80, { s: 8 });
  T("Point de dépôt", 57, Y + 83, { b: true, s: 6, al: "right" });
  // Section paiement : QR
  T("Section paiement", 67, Y + 7, { b: true, s: 11 });
  const qr = window.qrcode(0, "M"); qr.addData(sp.payload, "Byte"); qr.make();
  const n = qr.getModuleCount(), qx = 67, qy = Y + 17, qs = 46, ms = qs / n;
  doc.setFillColor(0);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(qx + c * ms, qy + r * ms, ms + 0.02, ms + 0.02, "F");
  const cx = qx + qs / 2, cy = qy + qs / 2;            // croix suisse 7 × 7 mm au centre
  doc.setFillColor(255); doc.rect(cx - 3.5, cy - 3.5, 7, 7, "F"); doc.setFillColor(0); doc.rect(cx - 3.1, cy - 3.1, 6.2, 6.2, "F");
  doc.setFillColor(255); doc.rect(cx - 0.6, cy - 2.1, 1.2, 4.2, "F"); doc.rect(cx - 2.1, cy - 0.6, 4.2, 1.2, "F");
  T("Monnaie", 67, Y + 70, { b: true, s: 8 }); T("Montant", 87, Y + 70, { b: true, s: 8 }); T("CHF", 67, Y + 74.5, { s: 10 }); T(oiChf(inv.amount), 87, Y + 74.5, { s: 10 });
  // Section paiement : informations
  const X = 118;
  T("Compte / Payable à", X, Y + 15, { b: true, s: 8 }); T(ibanF, X, Y + 19, { s: 10 }); cLines.forEach((l, i) => T(l, X, Y + 23 + i * 4, { s: 10 }));
  T("Référence", X, Y + 38, { b: true, s: 8 }); T(refF, X, Y + 42, { s: 10 });
  T("Informations supplémentaires", X, Y + 48, { b: true, s: 8 }); T(doc.splitTextToSize(inv.label || "", 85).slice(0, 2), X, Y + 52, { s: 9 });
  T("Payable par", X, Y + 62, { b: true, s: 8 }); dLines.forEach((l, i) => T(l, X, Y + 66 + i * 4, { s: 10 }));
  return doc;
}
async function oiMakePdf(inv) {
  const doc = await oiBuildPdf(inv);
  const path = `${inv.id}.pdf`;
  const up = await sb.storage.from("out_invoices").upload(path, new Blob([doc.output("arraybuffer")], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error("PDF : " + up.error.message);
  await sb.from("out_invoices").update({ pdf_path: path }).eq("id", inv.id);
  inv.pdf_path = path;
}
// ---- Envoi par mail (depuis info@, PDF joint) ----
const oiVars = (tpl, f) => tpl.replace(/\{destinataire\}/g, f.debtor_name || "").replace(/\{joueur\}/g, f.player_name || "").replace(/\{numero\}/g, f.number || "")
  .replace(/\{montant\}/g, oiChf(f.amount)).replace(/\{echeance\}/g, f.due_date ? frDate(f.due_date) : "réception").replace(/\{libelle\}/g, f.label || "").replace(/\{reference\}/g, oiFmt4(f.reference));
function oiOpenSend(ids) {
  oiSendIds = ids.filter((id) => { const f = oiList.find((x) => x.id === id); return f && f.pdf_path; });
  if (!oiSendIds.length) { uiAlert("Aucune facture avec PDF à envoyer."); return; }
  const noMail = oiSendIds.map((id) => oiList.find((x) => x.id === id)).filter((f) => !f.debtor_email);
  $("oi-send-count").textContent = oiSendIds.length;
  $("oi-send-status").textContent = noMail.length ? `⚠ ${noMail.length} sans e-mail (${noMail.map((f) => f.debtor_name).join(", ")}) : elles seront ignorées.` : "";
  oiSendPreview();
  $("oi-send-modal").classList.remove("hidden");
}
function oiSendPreview() {
  const f = oiList.find((x) => x.id === oiSendIds[0]); if (!f) return;
  $("oi-send-preview").innerHTML = `<b>Aperçu (${esc(f.number)}, à ${esc(f.debtor_email || "?")})</b><br><b>${esc(oiVars($("oi-send-subject").value, f))}</b><br><span style="white-space:pre-wrap">${esc(oiVars($("oi-send-text").value, f))}</span>`;
}
async function oiSendGo() {
  const btn = $("oi-send-go"); btn.disabled = true; const st = $("oi-send-status");
  let ok = 0; const errs = [];
  for (const id of oiSendIds) {
    const f = oiList.find((x) => x.id === id); if (!f || !f.debtor_email) continue;
    st.textContent = `Envoi ${ok + 1}/${oiSendIds.length} — ${f.number}…`;
    try {
      const { data: blob, error: e1 } = await sb.storage.from("out_invoices").download(f.pdf_path); if (e1) throw new Error(e1.message);
      const b64 = await fileToB64(blob);
      const { data, error } = await sb.functions.invoke("mail-send", { body: { account: OI_FROM, to: f.debtor_email, subject: oiVars($("oi-send-subject").value, f), text: oiVars($("oi-send-text").value, f),
        attachments: [{ filename: `facture-${f.number}.pdf`, contentType: "application/pdf", content: b64 }] } });
      if (error) { let m = error.message; try { m = (await error.context.json())?.error || m; } catch (_) {} throw new Error(m); }
      if (data?.error) throw new Error(data.error);
      await sb.from("out_invoices").update({ status: "envoyee", sent_at: new Date().toISOString() }).eq("id", id);
      ok++;
    } catch (e) { errs.push(`${f.number} : ${e?.message || e}`); }
  }
  btn.disabled = false; st.textContent = "";
  $("oi-send-modal").classList.add("hidden");
  await loadOutInvoices();
  uiAlert(`✓ ${ok} facture(s) envoyée(s) depuis ${OI_FROM}.${errs.length ? "\n\nErreurs :\n" + errs.join("\n") : ""}`);
}

// ---- Éditeur d'une facture émise : nouvelle (personnelle / blanche) ou modification ----
async function oiOpenEdit(inv, preset) {
  if (!facAccts.length) { const { data: acc } = await sb.from("finance_accounts").select("*").order("sort"); facAccts = acc || []; }
  oieId = inv?.id || null; oieDebtorPid = inv?.debtor_person_id || preset?.debtor_person_id || null; oiePlayerPid = inv?.person_id || preset?.person_id || null;
  oieSeason = inv?.season_id || preset?.season_id || null; oieFiliere = inv?.filiere || preset?.filiere || null;
  const src = inv || preset || {};
  $("oie-title").textContent = inv ? `Facture ${inv.number}` : "Nouvelle facture";
  $("oie-search").value = ""; $("oie-results").classList.add("hidden");
  $("oie-name").value = src.debtor_name || ""; $("oie-email").value = src.debtor_email || "";
  $("oie-street").value = src.debtor_street || ""; $("oie-zip").value = src.debtor_zip || ""; $("oie-city").value = src.debtor_city || "";
  $("oie-issue").value = src.issue_date || new Date().toISOString().slice(0, 10);
  const due = new Date(); due.setDate(due.getDate() + 30);
  $("oie-due").value = src.due_date || due.toISOString().slice(0, 10);
  $("oie-acct").innerHTML = facAccts.map((a) => `<option value="${a.id}">${esc(a.name)} — ${esc(a.iban)}</option>`).join("");
  $("oie-acct").value = src.account_id || (facAccts.find((a) => a.is_default) || facAccts[0])?.id || "";
  $("oie-note").value = src.note || "";
  $("oie-items").innerHTML = "";
  const items = Array.isArray(src.items) && src.items.length ? src.items : (src.label ? [{ label: src.label, amount: src.amount }] : [{ label: "", amount: "" }]);
  for (const it of items) oieAddItem(it.label, it.amount);
  $("oie-status").textContent = "";
  $("oi-edit-modal").classList.remove("hidden");
}
function oieAddItem(label, amount) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td><input class="oie-l" value="${esc(label || "")}" placeholder="Désignation" style="width:100%" /></td>
    <td><input class="oie-a" type="number" step="0.05" value="${amount !== "" && amount != null ? Number(amount).toFixed(2) : ""}" style="width:120px;text-align:right" /></td>
    <td><button type="button" class="ghost oie-rm" title="Retirer">✕</button></td>`;
  $("oie-items").appendChild(tr);
  tr.querySelector(".oie-rm").addEventListener("click", () => { tr.remove(); oieTotal(); });
  tr.querySelector(".oie-a").addEventListener("input", oieTotal);
  oieTotal();
}
function oieItems() { return [...$("oie-items").querySelectorAll("tr")].map((tr) => ({ label: tr.querySelector(".oie-l").value.trim(), amount: tr.querySelector(".oie-a").value === "" ? 0 : Math.round(Number(tr.querySelector(".oie-a").value) * 100) / 100 })).filter((it) => it.label || it.amount); }
function oieTotal() { $("oie-total").textContent = oiChf(oieItems().reduce((a, it) => a + (it.amount || 0), 0)); }
async function oieSearch() {
  const q = $("oie-search").value.trim(); const box = $("oie-results");
  if (q.length < 2) { box.classList.add("hidden"); return; }
  const { data } = await sb.from("people").select("id,first_name,last_name,address,postal_code,city,email").or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`).order("last_name").limit(15);
  const rows = data || [];
  box.innerHTML = rows.length ? rows.map((p) => `<button type="button" class="oie-hit" data-id="${p.id}"><b>${esc(p.last_name)} ${esc(p.first_name)}</b> <span class="muted">${esc([p.address, p.postal_code, p.city].filter(Boolean).join(", ") || "sans adresse")}${p.email ? " · " + esc(p.email) : ""}</span></button>`).join("") : '<span class="muted" style="padding:6px 10px;display:block">Aucun résultat</span>';
  box.classList.remove("hidden");
  box.querySelectorAll(".oie-hit").forEach((b) => b.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const p = rows.find((x) => x.id === b.dataset.id); if (!p) return;
    oieDebtorPid = p.id; if (!oiePlayerPid) oiePlayerPid = p.id;
    $("oie-name").value = `${p.first_name} ${p.last_name}`; $("oie-email").value = p.email || "";
    $("oie-street").value = p.address || ""; $("oie-zip").value = p.postal_code || ""; $("oie-city").value = p.city || "";
    $("oie-search").value = ""; box.classList.add("hidden");
  }));
}
async function oiSaveEdit() {
  const items = oieItems();
  const amount = Math.round(items.reduce((a, it) => a + (it.amount || 0), 0) * 100) / 100;
  const name = $("oie-name").value.trim();
  if (!name) { uiAlert("Indique le destinataire (personne du répertoire ou nom libre)."); return; }
  if (!items.length || !(amount > 0)) { uiAlert("Ajoute au moins un article avec un montant."); return; }
  const btn = $("oie-save"); btn.disabled = true; $("oie-status").textContent = "Enregistrement…";
  try {
    const { data: sess } = await sb.auth.getSession(); const uid = sess?.session?.user?.id || null;
    const patch = { debtor_person_id: oieDebtorPid, debtor_name: name, debtor_email: $("oie-email").value.trim() || null,
      debtor_street: $("oie-street").value.trim() || null, debtor_zip: $("oie-zip").value.trim() || null, debtor_city: $("oie-city").value.trim() || null,
      issue_date: $("oie-issue").value || new Date().toISOString().slice(0, 10), due_date: $("oie-due").value || null,
      account_id: $("oie-acct").value || null, note: $("oie-note").value.trim() || null,
      items, amount, label: items.map((it) => it.label).filter(Boolean).join(" · ").slice(0, 140) };
    let row;
    if (oieId) {
      const { data, error } = await sb.from("out_invoices").update(patch).eq("id", oieId).select().single(); if (error) throw new Error(error.message); row = data;
    } else {
      const { data: num, error: e1 } = await sb.rpc("out_invoice_next_number"); if (e1) throw new Error(e1.message);
      const ins = { ...patch, number: num, reference: oiScor(num.replace(/\D/g, "")), person_id: oiePlayerPid, season_id: oieSeason, filiere: oieFiliere, currency: "CHF", status: "a_envoyer", created_by: uid };
      const { data, error } = await sb.from("out_invoices").insert(ins).select().single(); if (error) throw new Error(error.message); row = data;
    }
    $("oie-status").textContent = "PDF…";
    await oiMakePdf(row);
    $("oi-edit-modal").classList.add("hidden");
    await loadOutInvoices();
  } catch (e) { $("oie-status").textContent = "Erreur : " + (e?.message || e); }
  btn.disabled = false;
}
// ---- Sport-études / pro : n factures depuis le contrat de la fiche (montant annuel ÷ n, échéances mensuelles) ----
async function oiFromContract(personId, seasonId, d, n, startDate) {
  if (!facAccts.length) { const { data: acc } = await sb.from("finance_accounts").select("*").order("sort"); facAccts = acc || []; }
  const fee = parseFloat(d["Annual fee"]); n = parseInt(n) || parseInt(d["Instalments"]) || 1;
  if (!(fee > 0)) { uiAlert("Renseigne d'abord le montant annuel du contrat (et enregistre-le)."); return 0; }
  const sea = seasons.find((s) => s.id === seasonId);
  const [{ data: p }, { data: gs }] = await Promise.all([
    sb.from("people").select("id,first_name,last_name,address,postal_code,city,email,parent1,parent2").eq("id", personId).single(),
    sb.from("guardianships").select("guardian_id,relation").eq("child_id", personId),
  ]);
  const gIds = (gs || []).filter((g) => g.relation !== "sibling").map((g) => g.guardian_id);
  const { data: gp } = gIds.length ? await sb.from("people").select("id,first_name,last_name,address,postal_code,city,email").in("id", gIds) : { data: [] };
  const a = oiDebtorCands(p, gp || []).def;   // parent lié avec e-mail > Parent 1 > Parent 2 > joueur
  const debtor = { id: a.pid, first_name: a.name, last_name: "" };
  const acct = facAccts.find((x) => x.is_default) || facAccts[0]; if (!acct?.iban) { uiAlert("Aucun compte à créditer configuré."); return 0; }
  const prog = d["Programme"] || "Sport-études";
  const each = Math.round((fee / n) * 100) / 100, last = Math.round((fee - each * (n - 1)) * 100) / 100;   // dernier = solde exact
  const start = startDate ? new Date(startDate + "T00:00:00") : new Date();
  if (!(await uiConfirm(`Générer ${n} facture(s) de ${oiChf(each)} CHF (contrat ${oiChf(fee)} CHF, ${prog} ${sea?.label || ""}) pour ${p.first_name} ${p.last_name}, destinataire ${a.name}${a.email ? " <" + a.email + ">" : " (sans e-mail)"}, échéances mensuelles dès le ${frDate(start)} ?`))) return 0;
  const { data: sess } = await sb.auth.getSession(); const uid = sess?.session?.user?.id || null;
  let ok = 0; const errs = [];
  for (let i = 1; i <= n; i++) {
    try {
      const due = new Date(start.getFullYear(), start.getMonth() + (i - 1), start.getDate());
      const issue = new Date(due); issue.setDate(issue.getDate() - 30); const today = new Date();
      const label = `${prog} ${sea?.label || ""} — échéance ${i}/${n} — ${p.first_name} ${p.last_name}`;
      const { data: num, error: e1 } = await sb.rpc("out_invoice_next_number"); if (e1) throw new Error(e1.message);
      const amt = i === n ? last : each;
      const inv = { number: num, season_id: seasonId, filiere: d["Programme"] === "pro" ? "pro" : "sport-etudes", person_id: personId, debtor_person_id: debtor.id,
        debtor_name: a.name, debtor_street: a.street || null, debtor_zip: a.zip || null, debtor_city: a.city || null, debtor_email: a.email || null,
        label, instalment_no: i, instalment_total: n, items: [{ label, amount: amt }], amount: amt, currency: "CHF",
        issue_date: (issue < today ? today : issue).toISOString().slice(0, 10), due_date: due.toISOString().slice(0, 10),
        reference: oiScor(num.replace(/\D/g, "")), account_id: acct.id, status: "a_envoyer", created_by: uid };
      const { data: ins, error: e2 } = await sb.from("out_invoices").insert(inv).select().single(); if (e2) throw new Error(e2.message);
      await oiMakePdf({ ...ins, player_name: `${p.first_name} ${p.last_name}` });
      ok++;
    } catch (e) { errs.push(`${i}/${n} : ${e?.message || e}`); }
  }
  uiAlert(`✓ ${ok} facture(s) générée(s) → Factures › Émises (à envoyer).${errs.length ? "\n\nErreurs :\n" + errs.join("\n") : ""}`);
  return ok;
}

// Grille heures pleines/creuses — MÊME réglage que les prix de réservation (app_settings clé 'peak',
// format { "1":[17,18,…], … } avec 1=lundi…7=dimanche et l'heure = début du créneau). Une seule matrice.
const PEAK_DAYS = [["Lun", 1], ["Mar", 2], ["Mer", 3], ["Jeu", 4], ["Ven", 5], ["Sam", 6], ["Dim", 7]];
const PEAK_HOURS = Array.from({ length: 14 }, (_, i) => 8 + i);
function defaultPeakMap() {
  const m = {}; const add = (d, h) => { (m[String(d)] || (m[String(d)] = [])).push(h); };
  for (let d = 1; d <= 7; d++) for (let h = 17; h <= 21; h++) add(d, h);   // soirs
  for (const d of [6, 7]) for (let h = 10; h <= 21; h++) add(d, h);        // week-end dès 10h15
  for (let d = 1; d <= 5; d++) { add(d, 12); add(d, 13); }                 // mi-journée
  for (const h of [14, 15, 16]) add(3, h);                                 // mercredi aprem
  for (const k of Object.keys(m)) m[k] = [...new Set(m[k])];
  return m;
}
let facPeakMap = null;
async function renderFacPeak() {
  const host = $("fac-peak"); if (!host) return;
  if (!facPeakMap) {
    const { data } = await sb.from("app_settings").select("value").eq("key", "peak").maybeSingle();
    const v = (data && data.value && typeof data.value === "object") ? data.value : null;
    facPeakMap = (v && Object.keys(v).length) ? v : defaultPeakMap();
  }
  const has = (d, h) => (facPeakMap[String(d)] || []).includes(h);
  const head = `<tr><th></th>${PEAK_DAYS.map(([l]) => `<th>${l}</th>`).join("")}</tr>`;
  const rows = PEAK_HOURS.map((h) => `<tr><th class="wp-time">${h}h15</th>${PEAK_DAYS.map(([, d]) => `<td class="pk-cell${has(d, h) ? " pk-on" : ""}" data-d="${d}" data-h="${h}"></td>`).join("")}</tr>`).join("");
  host.innerHTML = `<div class="table-wrap" style="max-width:660px"><table class="wp-table pk-table">${head}${rows}</table></div>
    <div style="margin-top:10px"><button type="button" id="fac-peak-save">Enregistrer</button><span id="fac-peak-status" class="muted" style="margin-left:10px;font-size:.85rem"></span></div>`;
  host.querySelectorAll(".pk-cell").forEach((c) => c.addEventListener("click", () => {
    const d = c.dataset.d, h = Number(c.dataset.h); const arr = facPeakMap[d] || (facPeakMap[d] = []);
    const i = arr.indexOf(h); if (i >= 0) { arr.splice(i, 1); c.classList.remove("pk-on"); } else { arr.push(h); c.classList.add("pk-on"); }
  }));
  $("fac-peak-save").addEventListener("click", async () => {
    const clean = {}; for (const k of Object.keys(facPeakMap)) { if ((facPeakMap[k] || []).length) clean[k] = [...facPeakMap[k]].sort((a, b) => a - b); }
    const { error } = await sb.from("app_settings").upsert({ key: "peak", value: clean, updated_at: new Date().toISOString() }, { onConflict: "key" });
    facPeakMap = clean; settings.peak = clean;
    $("fac-peak-status").textContent = error ? "Erreur : " + error.message : "✓ Enregistré (prix des réservations mis à jour aussi)";
  });
}
// Grille des tarifs d'abonnement par filière (app_settings clé 'sub_prices').
const FAC_TARIF_ROWS = [["kidstennis", "KidsTennis"], ["club", "Club"], ["competition", "Compétition"], ["performance", "Performance"], ["adultes", "Adultes"],
  ["hiver_membre_pleine", "Saison hiver — membre · heure pleine"], ["hiver_membre_creuse", "Saison hiver — membre · heure creuse"],
  ["hiver_nonmembre_pleine", "Saison hiver — non-membre · heure pleine"], ["hiver_nonmembre_creuse", "Saison hiver — non-membre · heure creuse"]];
async function renderFacTarifs() {
  const host = $("fac-tarifs"); if (!host) return;
  const { data } = await sb.from("app_settings").select("value").eq("key", "sub_prices").maybeSingle();
  const cur = (data && data.value) || {};
  host.innerHTML = `<div class="fac-tarif-grid">${FAC_TARIF_ROWS.map(([k, l]) =>
    `<label class="fac-tarif-row"><span>${esc(l)}</span><span class="fac-tarif-in"><input type="number" step="0.05" min="0" data-k="${k}" value="${cur[k] != null ? cur[k] : ""}" placeholder="—" /> CHF</span></label>`).join("")}</div>
    <div style="margin-top:12px"><button type="button" id="fac-tarif-save">Enregistrer les tarifs</button><span id="fac-tarif-status" class="muted" style="margin-left:10px;font-size:.85rem"></span></div>`;
  $("fac-tarif-save").addEventListener("click", async () => {
    const val = {};
    host.querySelectorAll("input[data-k]").forEach((i) => { const v = i.value.trim(); if (v !== "") val[i.dataset.k] = Number(v); });
    const { error } = await sb.from("app_settings").upsert({ key: "sub_prices", value: val, updated_at: new Date().toISOString() }, { onConflict: "key" });
    $("fac-tarif-status").textContent = error ? "Erreur : " + error.message : "✓ Tarifs enregistrés";
    settings.sub_prices = val;
  });
}
async function loadFactures() {
  initFactures();
  if (!facAccts.length) { const { data: acc } = await sb.from("finance_accounts").select("*").order("sort"); facAccts = acc || []; }
  const { data, error } = await sb.from("invoices").select("*").order("created_at", { ascending: false });
  if (error) { $("fac-rows").innerHTML = `<tr><td colspan="7" class="muted">Erreur : ${esc(error.message)}</td></tr>`; return; }
  facList = data || [];
  renderFacFilters(); renderFactures();
  facAutoScanQR();   // factures venues des mails (ou sans montant) : lecture du QR en arrière-plan
}
// Lit le QR des factures encore sans montant (surtout celles créées depuis un mail),
// par petits lots, et met à jour la ligne. qr_raw non nul = déjà tenté (on ne rescanne pas).
let facScanning = false;
async function facAutoScanQR() {
  if (facScanning) return;
  const todo = facList.filter((f) => f.pdf_path && f.qr_raw == null && f.amount == null).slice(0, 4);
  if (!todo.length) return;
  facScanning = true;
  let changed = false;
  for (const f of todo) {
    try {
      const { data } = await sb.storage.from("invoices").download(f.pdf_path);
      if (!data) continue;
      const file = new File([data], f.filename || "facture.pdf", { type: "application/pdf" });
      const qr = await facReadSwissQR(file);
      const patch = { qr_raw: qr?.raw || "" };   // "" = scanné sans QR (évite de rescanner)
      if (qr) {
        patch.amount = qr.amount ?? null;
        patch.creditor_iban = qr.iban || null;
        patch.reference = qr.reference || null;
        patch.currency = qr.currency || "CHF";
        if (!f.creditor_name && qr.creditor) patch.creditor_name = qr.creditor;
        if (!f.explanation && qr.message) patch.explanation = qr.message;
      }
      await sb.from("invoices").update(patch).eq("id", f.id);
      changed = true;
    } catch (_) {}
  }
  facScanning = false;
  if (changed && !$("view-factures").classList.contains("hidden")) loadFactures();  // recharge → traite le lot suivant
}
function renderFacFilters() {
  const counts = { "": facList.length };
  for (const f of facList) counts[f.status] = (counts[f.status] || 0) + 1;
  const chip = (v, l) => `<button type="button" class="chip filt${facFilter === v ? " sel" : ""}" data-st="${v}">${l} <span class="muted">(${counts[v] || 0})</span></button>`;
  $("fac-filters").innerHTML = chip("", "Toutes") + FAC_ORDER.map((s) => chip(s, FAC_ST[s][0])).join("");
  $("fac-filters").querySelectorAll(".filt").forEach((b) => b.addEventListener("click", () => { facFilter = b.dataset.st; renderFacFilters(); renderFactures(); }));
}
function renderFactures() {
  const rows = facList.filter((f) => !facFilter || f.status === facFilter);
  $("fac-empty").hidden = rows.length > 0;
  $("fac-rows").innerHTML = rows.map((f) => {
    const [lbl, cls] = FAC_ST[f.status] || [f.status, ""];
    const amt = f.amount != null ? Number(f.amount).toFixed(2) + " CHF" : '<span class="muted">?</span>';
    const acts = `<button class="ghost fac-edit" data-id="${f.id}">Détail</button>`
      + (f.status === "a_valider" ? `<button class="ghost fac-val" data-id="${f.id}">Valider</button>` : "")
      + ((f.status === "validee" || f.status === "en_paiement") ? `<button class="ghost fac-pay" data-id="${f.id}">Marquer payée</button>` : "")
      + `<button class="ghost fac-del" data-id="${f.id}" title="Supprimer">✕</button>`;
    return `<tr>
      <td><b>${esc(f.creditor_name || "—")}</b>${f.source === "mail" ? ' <span class="muted" style="font-size:.75rem">✉</span>' : ""}${f.source === "salaire" ? ' <span title="Salaire (onglet Heures)" style="font-size:.8rem">💰</span>' : ""}</td>
      <td class="muted" style="font-size:.84rem;max-width:340px">${esc((f.explanation || "").slice(0, 160))}</td>
      <td style="white-space:nowrap">${amt}</td>
      <td style="white-space:nowrap">${f.due_date ? frDate(f.due_date) : "—"}</td>
      <td>${f.pdf_path ? `<button class="ghost fac-pdf" data-id="${f.id}">📄 Voir</button>` : "—"}</td>
      <td><span class="fac-st ${cls}">${lbl}</span></td>
      <td class="he-acts">${acts}</td></tr>`;
  }).join("");
  const R = $("fac-rows");
  R.querySelectorAll(".fac-edit").forEach((b) => b.addEventListener("click", () => openFac(b.dataset.id)));
  R.querySelectorAll(".fac-pdf").forEach((b) => b.addEventListener("click", () => facOpenPdf(b.dataset.id)));
  R.querySelectorAll(".fac-val").forEach((b) => b.addEventListener("click", () => facSetStatus(b.dataset.id, "validee")));
  R.querySelectorAll(".fac-pay").forEach((b) => b.addEventListener("click", () => facSetStatus(b.dataset.id, "payee")));
  R.querySelectorAll(".fac-del").forEach((b) => b.addEventListener("click", () => facDelete(b.dataset.id)));
}
async function facUpload(files) {
  const pdfs = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  if (!pdfs.length) { uiAlert("Ajoute un fichier PDF."); return; }
  const { data: sess } = await sb.auth.getSession(); const uid = sess?.session?.user?.id;
  const lbl = document.querySelector('#view-factures .btnlike'); const lblTxt = lbl && lbl.firstChild ? lbl.firstChild.textContent : "";
  if (lbl && lbl.firstChild) lbl.firstChild.textContent = "Lecture du QR…";
  let withQr = 0;
  for (const f of pdfs) {
    const path = `${crypto.randomUUID()}.pdf`;
    const up = await sb.storage.from("invoices").upload(path, f, { contentType: "application/pdf", upsert: false });
    if (up.error) { uiAlert("Upload impossible : " + up.error.message); continue; }
    const qr = await facReadSwissQR(f);   // lecture du QR-facture suisse (best-effort)
    if (qr) withQr++;
    await sb.from("invoices").insert({
      source: "upload", pdf_path: path, filename: f.name, created_by: uid, status: "a_valider",
      creditor_name: qr?.creditor || null, creditor_iban: qr?.iban || null,
      amount: qr?.amount ?? null, currency: qr?.currency || "CHF",
      reference: qr?.reference || null, qr_message: qr?.message || null, qr_raw: qr?.raw || null,
      explanation: qr?.message || null,
    });
  }
  if (lbl && lbl.firstChild) lbl.firstChild.textContent = lblTxt;
  await loadFactures();
  uiAlert(`✓ ${pdfs.length} facture(s) ajoutée(s)${withQr ? `, ${withQr} avec montant/IBAN lus du QR` : ""}. Complète l'explication puis valide.`);
}
// Lecture du QR-facture suisse (Swiss QR-bill) d'un PDF, côté client (pdf.js + jsQR).
async function facReadSwissQR(file) {
  try {
    if (!window.pdfjsLib) {
      await facLoadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    }
    if (!window.jsQR) await facLoadScript("https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    for (let pn = pdf.numPages; pn >= 1; pn--) {          // le QR est souvent en bas / dernière page
      const page = await pdf.getPage(pn);
      const vp = page.getViewport({ scale: 2.5 });
      const canvas = document.createElement("canvas"); canvas.width = vp.width; canvas.height = vp.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code?.data && code.data.startsWith("SPC")) return facParseSPC(code.data);
    }
  } catch (e) { console.warn("QR-facture:", e); }
  return null;
}
// Payload Swiss QR-bill (SPC) : champs séparés par des retours ligne, positions fixes.
function facParseSPC(raw) {
  const f = raw.split(/\r?\n/);
  if (f[0] !== "SPC") return null;
  const amt = f[18] && !isNaN(parseFloat(f[18])) ? parseFloat(f[18]) : null;
  return { iban: (f[3] || "").trim(), creditor: (f[5] || "").trim(), amount: amt,
    currency: (f[19] || "CHF").trim(), reference: (f[28] || "").trim(), message: (f[29] || "").trim(), raw };
}
function openFac(id) {
  const f = facList.find((x) => x.id === id); if (!f) return;
  facEditId = id;
  $("fac-creditor").value = f.creditor_name || "";
  $("fac-iban").value = f.creditor_iban || "";
  $("fac-amount").value = f.amount != null ? f.amount : "";
  $("fac-ref").value = f.reference || "";
  $("fac-due").value = f.due_date || "";
  $("fac-expl").value = f.explanation || "";
  const defId = (facAccts.find((a) => a.is_default) || facAccts[0])?.id || "";
  $("fac-acct").innerHTML = facAccts.map((a) => `<option value="${a.id}">${esc(a.name)} — ${esc(a.iban)}</option>`).join("");
  $("fac-acct").value = f.debtor_account_id || defId;
  renderFacStatusBtns(f.status);
  $("fac-msave").textContent = "";
  $("fac-modal").classList.remove("hidden");
}
function renderFacStatusBtns(cur) {
  $("fac-status-btns").innerHTML = FAC_ORDER.map((s) => `<button type="button" class="fac-stbtn ${FAC_ST[s][1]}${cur === s ? " on" : ""}" data-st="${s}">${FAC_ST[s][0]}</button>`).join("");
  $("fac-status-btns").querySelectorAll(".fac-stbtn").forEach((b) => b.addEventListener("click", () => facModalStatus(b.dataset.st)));
}
async function facModalStatus(status) {
  if (!facEditId) return;
  await facSetStatus(facEditId, status);          // met à jour (avec horodatage) + recharge la liste
  const f = facList.find((x) => x.id === facEditId);
  if (f) renderFacStatusBtns(f.status);           // reflète le changement dans la fiche
}
async function facSave() {
  if (!facEditId) return;
  const patch = {
    creditor_name: $("fac-creditor").value.trim() || null,
    creditor_iban: $("fac-iban").value.trim() || null,
    amount: $("fac-amount").value ? Number($("fac-amount").value) : null,
    reference: $("fac-ref").value.trim() || null,
    due_date: $("fac-due").value || null,
    explanation: $("fac-expl").value.trim() || null,
    debtor_account_id: $("fac-acct").value || null,
  };
  $("fac-msave").textContent = "Enregistrement…";
  const { error } = await sb.from("invoices").update(patch).eq("id", facEditId);
  if (error) { $("fac-msave").textContent = "Erreur : " + error.message; return; }
  $("fac-modal").classList.add("hidden");
  await loadFactures();
}
async function facSetStatus(id, status) {
  const f = facList.find((x) => x.id === id);
  if (status === "validee" && f && (f.amount == null || !f.creditor_name)) {
    if (!(await uiConfirm("Cette facture n'a pas de créancier/montant renseigné. Valider quand même ?"))) return;
  }
  const patch = { status };
  if (status === "validee") { patch.validated_at = new Date().toISOString(); const { data: s } = await sb.auth.getSession(); patch.validated_by = s?.session?.user?.id || null; }
  if (status === "payee") patch.paid_at = new Date().toISOString();
  await sb.from("invoices").update(patch).eq("id", id);
  await loadFactures();
}
async function facDelete(id) {
  const f = facList.find((x) => x.id === id);
  if (!(await uiConfirm(`Supprimer la facture ${f?.creditor_name ? "« " + f.creditor_name + " »" : ""} ? (définitif)`))) return;
  if (f?.pdf_path) await sb.storage.from("invoices").remove([f.pdf_path]);
  await sb.from("invoices").delete().eq("id", id);
  if (f?.source === "mail" && f.mail_id) await sb.from("mail_messages").update({ has_invoice: false }).eq("id", f.mail_id);
  await loadFactures();
}
async function facOpenPdf(id) {
  const f = facList.find((x) => x.id === id); if (!f?.pdf_path) return;
  const { data, error } = await sb.storage.from("invoices").createSignedUrl(f.pdf_path, 3600);
  if (error || !data?.signedUrl) { uiAlert("PDF indisponible : " + (error?.message || "")); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}
function facLoadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function facExportZip() {
  const rows = facList.filter((f) => f.status !== "a_valider");  // validées + payées
  if (!rows.length) { uiAlert("Aucune facture validée à exporter."); return; }
  const btn = $("fac-export"); btn.disabled = true; const old = btn.textContent; btn.textContent = "Préparation…";
  try {
    if (!window.JSZip) await facLoadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
    const zip = new window.JSZip();
    const lines = [["Créancier", "Montant CHF", "Échéance", "Statut", "Fichier", "Explication"]];
    let n = 0;
    for (const f of rows) {
      const base = `${(f.creditor_name || "facture").replace(/[^\w\-]+/g, "_")}_${f.amount || ""}`;
      const name = `${base}_${(f.id || "").slice(0, 6)}.pdf`;
      if (f.pdf_path) { const { data } = await sb.storage.from("invoices").download(f.pdf_path); if (data) { zip.file(name, data); n++; } }
      lines.push([f.creditor_name || "", f.amount ?? "", f.due_date || "", (FAC_ST[f.status] || [f.status])[0], name, (f.explanation || "").replace(/\n/g, " ")]);
    }
    zip.file("recapitulatif.csv", "﻿" + lines.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n"));
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `factures-${new Date().toISOString().slice(0, 10)}.zip`; a.click();
    uiAlert(`✓ ${n} PDF exporté(s) + récapitulatif.`);
  } catch (e) { uiAlert("Export impossible : " + (e?.message || e)); }
  btn.disabled = false; btn.textContent = old;
}
// ---- PostFinance : génération du fichier de paiement pain.001 (multi-comptes) ----
const xmlEsc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function facTxXml(f, id, fmt) {
  const ref = (f.reference || "").replace(/\s+/g, "");
  let rmt;
  if (/^\d{27}$/.test(ref)) rmt = `<RmtInf><Strd><CdtrRefInf><Tp><CdOrPrtry><Prtry>QRR</Prtry></CdOrPrtry></Tp><Ref>${xmlEsc(ref)}</Ref></CdtrRefInf></Strd></RmtInf>`;
  else if (/^RF\d/i.test(ref)) rmt = `<RmtInf><Strd><CdtrRefInf><Tp><CdOrPrtry><Cd>SCOR</Cd></CdOrPrtry></Tp><Ref>${xmlEsc(ref)}</Ref></CdtrRefInf></Strd></RmtInf>`;
  else rmt = `<RmtInf><Ustrd>${xmlEsc((f.explanation || f.reference || f.creditor_name || "Paiement").slice(0, 140))}</Ustrd></RmtInf>`;
  return `<CdtTrfTxInf><PmtId><InstrId>${xmlEsc(id)}</InstrId><EndToEndId>${xmlEsc(ref || "NOTPROVIDED")}</EndToEndId></PmtId>`
    + `<Amt><InstdAmt Ccy="${xmlEsc(f.currency || "CHF")}">${fmt(f.amount)}</InstdAmt></Amt>`
    + `<Cdtr><Nm>${xmlEsc((f.creditor_name || "Créancier").slice(0, 70))}</Nm></Cdtr>`
    + `<CdtrAcct><Id><IBAN>${xmlEsc((f.creditor_iban || "").replace(/\s+/g, ""))}</IBAN></Id></CdtrAcct>${rmt}</CdtTrfTxInf>`;
}
async function facGenPain001() {
  if (!facAccts.length) { const { data } = await sb.from("finance_accounts").select("*").order("sort"); facAccts = data || []; }
  const defAcct = facAccts.find((a) => a.is_default) || facAccts[0];
  if (!defAcct) { uiAlert("Aucun compte à débiter configuré."); return; }
  const rows = facList.filter((f) => f.status === "validee" && f.creditor_iban && f.amount > 0);
  if (!rows.length) { uiAlert("Aucune facture VALIDÉE avec IBAN + montant. (Valide d'abord les factures.)"); return; }
  const groups = new Map();
  for (const f of rows) {
    const acc = facAccts.find((a) => a.id === f.debtor_account_id) || defAcct;
    if (!groups.has(acc.id)) groups.set(acc.id, { acc, items: [] });
    groups.get(acc.id).items.push(f);
  }
  const total = rows.reduce((a, f) => a + Number(f.amount), 0);
  if (!(await uiConfirm(`Générer le paiement pour ${rows.length} facture(s) — total ${total.toFixed(2)} CHF, sur ${groups.size} compte(s) ? Les factures passeront en « Paiement généré » et ne seront plus reprises.`))) return;
  const now = new Date();
  const msgId = "TL" + now.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const exec = new Date(now.getTime() + 864e5).toISOString().slice(0, 10);
  const fmt = (n) => Number(n).toFixed(2);
  let gi = 0;
  const pmtInfs = [...groups.values()].map(({ acc, items }) => {
    gi++;
    const sub = items.reduce((a, f) => a + Number(f.amount), 0);
    const addr = (acc.addr_line1 || acc.addr_line2) ? `<PstlAdr>${acc.addr_line1 ? `<AdrLine>${xmlEsc(acc.addr_line1)}</AdrLine>` : ""}${acc.addr_line2 ? `<AdrLine>${xmlEsc(acc.addr_line2)}</AdrLine>` : ""}</PstlAdr>` : "";
    const tx = items.map((f, i) => facTxXml(f, `${msgId}-${gi}-${i + 1}`, fmt)).join("");
    return `<PmtInf><PmtInfId>${msgId}-${gi}</PmtInfId><PmtMtd>TRF</PmtMtd><BtchBookg>false</BtchBookg><NbOfTxs>${items.length}</NbOfTxs><CtrlSum>${fmt(sub)}</CtrlSum><PmtTpInf><InstrPrty>NORM</InstrPrty></PmtTpInf><ReqdExctnDt>${exec}</ReqdExctnDt><Dbtr><Nm>${xmlEsc(acc.name)}</Nm>${addr}</Dbtr><DbtrAcct><Id><IBAN>${xmlEsc(acc.iban.replace(/\s+/g, ""))}</IBAN></Id></DbtrAcct><DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt><ChrgBr>SLEV</ChrgBr>${tx}</PmtInf>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<CstmrCdtTrfInitn>
<GrpHdr><MsgId>${msgId}</MsgId><CreDtTm>${now.toISOString().slice(0, 19)}</CreDtTm><NbOfTxs>${rows.length}</NbOfTxs><CtrlSum>${fmt(total)}</CtrlSum><InitgPty><Nm>${xmlEsc(defAcct.name)}</Nm></InitgPty></GrpHdr>
${pmtInfs}
</CstmrCdtTrfInitn>
</Document>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  a.download = `paiement-${now.toISOString().slice(0, 10)}.xml`; a.click();
  await sb.from("invoices").update({ status: "en_paiement" }).in("id", rows.map((f) => f.id));
  await loadFactures();
  uiAlert(`✓ Fichier généré : ${rows.length} facture(s), total ${fmt(total)} CHF. Dépose-le dans PostFinance (import ISO 20022 / pain.001), vérifie et signe. Les factures sont passées en « Paiement généré » ; marque-les « Payée » une fois exécutées.`);
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

// ---- Onglet « Tennis » : commentaires techniques par thème, par saison ----
let ptnPersonId = null;
async function loadPersonTennis(personId, byRole) {
  ptnPersonId = personId;
  showPersonTab("tennis", byRole);
  if (!personId || !byRole) { $("ptn-body").innerHTML = ""; return; }
  await loadSeasonsList();
  const cur = currentSeason("juniors")?.id;
  const sel = $("ptn-season");
  sel.innerHTML = seasonsOf("juniors").map((s) => seasonOpt(s, cur)).join("") || '<option value="">—</option>';
  if (cur) sel.value = cur;   // force la saison en cours (sinon pretty-select n'applique pas la valeur)
  sel.onchange = () => renderTennisSeason();
  renderTennisSeason();
}

async function renderTennisSeason() {
  const body = $("ptn-body"); if (!body || !ptnPersonId) return;
  const seasonId = $("ptn-season").value || null;
  if (!seasonId) { body.innerHTML = '<p class="obj-empty">Choisis une saison.</p>'; return; }
  body.innerHTML = '<p class="muted">Chargement…</p>';
  const { data } = await sb.from("tennis_notes").select("*")
    .eq("player_person_id", ptnPersonId).eq("season_id", seasonId)
    .order("created_at", { ascending: false });
  const rows = data || [];
  const canEdit = canTennisEdit();
  const byTheme = {}; rows.forEach((r) => (byTheme[r.theme] || (byTheme[r.theme] = [])).push(r));
  body.innerHTML = TENNIS_THEMES.map(([key, label]) => {
    const list = byTheme[key] || [];
    const items = list.map((r) => {
      const edited = r.updated_at && r.updated_at !== r.created_at ? ' <span class="muted">(modifié)</span>' : "";
      return `<div class="obj-item tn-item" data-id="${r.id}">
        <div class="obj-meta"><span><b>${esc(r.author_name || "—")}</b></span><span>${frDateTime(r.created_at)}${edited}</span></div>
        <div class="obj-body">${esc(r.body).replace(/\n/g, "<br/>")}</div>
        ${canEdit ? `<div class="obj-acts"><button type="button" class="edit">Modifier</button><button type="button" class="del">Supprimer</button></div>` : ""}</div>`;
    }).join("");
    return `<section class="tn-theme" data-theme="${key}">
      <div class="tn-th">${esc(label)}</div>
      <div class="obj-add"><textarea class="tn-new" rows="2" placeholder="Ajouter un commentaire…"></textarea>
        <button type="button" class="tn-add">Ajouter</button></div>
      <div class="obj-list">${items || '<p class="obj-empty">—</p>'}</div></section>`;
  }).join("");

  body.querySelectorAll(".tn-theme").forEach((sec) => {
    const theme = sec.dataset.theme;
    sec.querySelector(".tn-add").addEventListener("click", async () => {
      const ta = sec.querySelector(".tn-new"), b = ta.value.trim(); if (!b) return;
      const { error } = await sb.from("tennis_notes").insert({
        player_person_id: ptnPersonId, season_id: seasonId, theme, body: b,
        author_person_id: myPersonId, author_name: meName, author_role: myNoteRole(), created_by: meId });
      if (error) { alert(error.message); return; }
      renderTennisSeason();
    });
  });
  body.querySelectorAll(".del").forEach((b) => b.addEventListener("click", async () => {
    if (!await uiConfirm("Supprimer ce commentaire ?")) return;
    await sb.from("tennis_notes").delete().eq("id", b.closest(".tn-item").dataset.id);
    renderTennisSeason();
  }));
  body.querySelectorAll(".edit").forEach((b) => b.addEventListener("click", () => {
    const item = b.closest(".tn-item"), id = item.dataset.id, cur = rows.find((r) => r.id === id);
    item.querySelector(".obj-body").innerHTML = `<textarea class="tn-edit" rows="2" style="width:100%">${esc(cur.body)}</textarea>
      <div style="margin-top:6px"><button type="button" class="tn-save">Enregistrer</button></div>`;
    item.querySelector(".tn-save").addEventListener("click", async () => {
      const nb = item.querySelector(".tn-edit").value.trim(); if (!nb) return;
      await sb.from("tennis_notes").update({ body: nb, updated_at: new Date().toISOString() }).eq("id", id);
      renderTennisSeason();
    });
  }));
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
    <div class="pc-actions"><button type="button" id="pc-save">Enregistrer le contrat</button><span id="pc-status" class="muted"></span></div>
    <div class="pc-sec" id="pc-inv-sec"><h4>Facturation</h4>
      <p class="muted" style="font-size:.85rem;margin:0 0 8px">Découpe le montant annuel du contrat <b>enregistré</b> en n factures (échéances mensuelles), destinataire = parent lié (sinon le joueur). Les factures se retrouvent dans <b>Factures › Émises</b>, où tu peux modifier dates et articles avant l'envoi.</p>
      <div class="pc-grid">
        <label class="pc-f"><span>Nombre de factures</span><input id="pc-inv-n" type="number" min="1" value="${esc(d["Instalments"] || "10")}" /></label>
        <label class="pc-f"><span>Première échéance</span><input id="pc-inv-start" type="date" value="${esc(d["Start date"] || new Date().toISOString().slice(0, 10))}" /></label>
        <label class="pc-f"><span>Montant par facture (auto)</span><input id="pc-inv-each" type="text" disabled /></label>
      </div>
      <div class="pc-actions"><button type="button" id="pc-gen-inv" ${d["Annual fee"] > 0 ? "" : "disabled"}>Générer les factures</button><span id="pc-inv-status" class="muted"></span></div>
    </div>`;
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
  // Facturation depuis le contrat (montant enregistré ÷ n)
  const updEach = () => { const n = parseInt($("pc-inv-n").value) || 0, fee = parseFloat(d["Annual fee"]); $("pc-inv-each").value = (fee > 0 && n > 0) ? oiChf(fee / n) + " CHF" : ""; };
  $("pc-inv-n").addEventListener("input", updEach); updEach();
  sb.from("out_invoices").select("id,status").eq("person_id", pcPersonId).eq("season_id", seasonId).then(({ data: ex }) => {
    const live = (ex || []).filter((x) => x.status !== "annulee").length;
    if (live) $("pc-inv-status").textContent = `${live} facture(s) déjà générée(s) pour cette saison (Factures › Émises).`;
  });
  $("pc-gen-inv").addEventListener("click", async () => {
    $("pc-gen-inv").disabled = true;
    await oiFromContract(pcPersonId, seasonId, d, $("pc-inv-n").value, $("pc-inv-start").value);
    $("pc-gen-inv").disabled = false; renderPersonContract();
  });
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
      if (b.dataset.sub === "formulaire") loadMentalForms();
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
  mentalThread("mn-thread", yid);
  renderMnCompForms(yid);
  mproudFetch(yid).then((r) => renderProudInto($("mn-proud"), r));
  $("mn-part-list").classList.add("hidden");
  $("mn-part-detail").classList.remove("hidden");
  window.scrollTo(0, 0);
}
function loadMnComments(yid) { mnYouthId = yid; youthNotes("mn-chan", yid); }

// ---- Formulaires « Compétition » remplis par le jeune (lecture seule, console) ----
const MCF_PREP = [["horaires", "Horaires et routines de préparation"], ["specifique", "Spécifique à cette compétition / ce qui peut être différent"], ["represente", "Ce que cette compétition représente pour moi"], ["objectifs", "Mes objectifs"], ["tester", "Ce que je vais tester de nouveau"], ["sentir", "Comment je veux me sentir"]];
const MCF_ANALYSE = [["highlight", "Mon highlight"], ["avant", "Ressenti avant"], ["pendant", "Ressenti pendant"], ["apres", "Ressenti après"], ["satisfait", "Satisfait·e de / ce qui est bien allé"], ["mieux", "Ce qui pourrait être mieux"], ["different", "Différent de ce que j'avais pensé"], ["retour_coach", "Retour de l'entraîneur"], ["appris", "Ce que j'ai appris"]];
async function mcfFetch(yid) {
  const { data } = await sb.from("mental_comp_forms").select("*").eq("youth_person_id", yid).order("comp_date", { ascending: false, nullsFirst: false });
  return data || [];
}
function renderMcfInto(host, rows) {
  if (!host) return;
  if (!rows.length) { host.innerHTML = '<p class="obj-empty">Aucun formulaire rempli pour l\'instant.</p>'; return; }
  const block = (title, arr, obj) => {
    const items = arr.filter(([k]) => (obj || {})[k]).map(([k, l]) => `<div class="mcf-field"><b>${esc(l)}</b><p>${esc(obj[k]).replace(/\n/g, "<br/>")}</p></div>`).join("");
    return items ? `<div class="mcf-block"><h4>${esc(title)}</h4>${items}</div>` : "";
  };
  host.innerHTML = rows.map((c) => {
    const prep = block("Préparation (avant)", MCF_PREP, c.prep);
    const bil = block("Analyse (après)", MCF_ANALYSE, c.bilan);
    return `<div class="mcf-card"><div class="mcf-head"><b>${esc(c.competition || "Compétition")}</b>${c.comp_date ? ` <span class="muted">${frDate(c.comp_date)}</span>` : ""}${c.lieu ? ` · ${esc(c.lieu)}` : ""}</div>${prep || '<p class="obj-empty">Préparation non remplie.</p>'}${bil}</div>`;
  }).join("");
}
async function renderMnCompForms(yid) {
  const host = $("mn-comp"); if (!host) return;
  if (!yid) { host.innerHTML = ""; return; }
  renderMcfInto(host, await mcfFetch(yid));
}
// Ouvre la fiche du jeune directement sur l'onglet Mental (formulaires compétition).
function openPersonToMental(pid) {
  const p = people.find((x) => x.id === pid); if (!p) return;
  showView("membres"); openPerson(p); setPersonTab("mental");
}
// Sous-onglet « Formulaire » du menu Mental : aperçu des 2 formulaires + derniers remplis.
async function loadMentalForms() {
  const host = $("mn-forms"); if (!host) return;
  host.innerHTML = '<p class="muted">Chargement…</p>';
  const { data } = await sb.from("mental_comp_forms").select("id,youth_person_id,competition,comp_date,prep,bilan")
    .order("comp_date", { ascending: false, nullsFirst: false }).limit(100);
  const rows = data || [];
  const nameOf = (pid) => { const p = people.find((x) => x.id === pid); return p ? `${p.first_name} ${p.last_name}` : "—"; };
  const preview = (title, arr) => `<div class="mcf-block"><h4>${esc(title)}</h4>${arr.map(([, l]) => `<div class="mcf-field"><b>${esc(l)}</b></div>`).join("")}</div>`;
  const subs = rows.length ? rows.map((c) => {
    const prepN = Object.values(c.prep || {}).filter((v) => (v || "").trim()).length;
    const bilN = Object.values(c.bilan || {}).filter((v) => (v || "").trim()).length;
    return `<button type="button" class="mnf-row" data-y="${c.youth_person_id}">
      <span class="mnf-who"><b>${esc(nameOf(c.youth_person_id))}</b> · ${esc(c.competition || "Compétition")}</span>
      <span class="muted">${c.comp_date ? frDate(c.comp_date) : ""}</span>
      <span class="mnf-badges"><span class="comp-badge ${prepN ? "on" : ""}">Prép ${prepN ? "✓" : "·"}</span><span class="comp-badge ${bilN ? "on" : ""}">Analyse ${bilN ? "✓" : "·"}</span></span></button>`;
  }).join("") : '<p class="obj-empty">Aucun formulaire rempli pour l\'instant.</p>';
  host.innerHTML = `
    <div class="rg-card">
      <h3 style="margin-top:0">Formulaires « Compétition »</h3>
      <p class="muted" style="font-size:.9rem;margin:0">Les jeunes de compétition remplissent ces 2 formulaires dans leur portail <b>« Mon espace » → Compét.</b> Les réponses apparaissent dans la <b>fiche du jeune → onglet Mental</b> et dans <b>Participants</b>.</p>
    </div>
    <div class="rg-card">
      <h3 style="margin-top:0">Derniers formulaires remplis</h3>
      <div class="mnf-list">${subs}</div>
    </div>
    <div class="rg-card">
      <h3 style="margin-top:0">Aperçu des 2 formulaires (ce que remplit le jeune)</h3>
      ${preview("Préparation — avant la compétition", MCF_PREP)}
      ${preview("Analyse — après la compétition", MCF_ANALYSE)}
    </div>`;
  host.querySelectorAll(".mnf-row").forEach((b) => b.addEventListener("click", () => openPersonToMental(b.dataset.y)));
}

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
// ---- « 3 fiertés après l'entraînement » (lecture seule côté console) ----
async function mproudFetch(yid) { const { data } = await sb.rpc("portal_proud_list", { p_youth: yid }); return data || []; }
function renderProudInto(host, rows) {
  if (!host) return;
  if (!rows.length) { host.innerHTML = '<p class="obj-empty">Aucune fierté notée pour l\'instant.</p>'; return; }
  host.innerHTML = rows.map((r) => `<div class="mcf-card"><div class="mcf-head"><b>${frDate(r.entry_date)}</b></div>
    <ol class="proud-ol">${[r.p1, r.p2, r.p3].filter(Boolean).map((p) => `<li>${esc(p)}</li>`).join("") || "<li class='muted'>—</li>"}</ol></div>`).join("");
}

// ---- Canal de discussion mental (jeune <-> encadrement) : message / lien / document ----
async function mentalThread(mountId, youthId) {
  const el = $(mountId); if (!el) return;
  if (!youthId) { el.innerHTML = ""; return; }
  const { data } = await sb.rpc("mental_thread_list", { p_youth: youthId });
  const rows = data || [];
  const msgs = rows.length ? rows.map(mtMsgHtml).join("") : '<p class="obj-empty">Aucun message. Démarre la discussion ci-dessous.</p>';
  el.innerHTML = `<div class="mt-thread">${msgs}</div>
    <div class="mt-composer">
      <textarea class="mt-body" rows="2" placeholder="Écrire un message au jeune…"></textarea>
      <input type="url" class="mt-link" placeholder="Lien (https://…) — optionnel" />
      <div class="mt-crow"><label class="mt-file-lbl">📎 Document<input type="file" class="mt-file" hidden></label><span class="mt-file-name muted"></span><span class="spacer"></span><button type="button" class="mt-send">Envoyer</button></div>
      <span class="mt-status muted"></span>
    </div>`;
  const fi = el.querySelector(".mt-file");
  fi.addEventListener("change", () => { el.querySelector(".mt-file-name").textContent = fi.files[0]?.name || ""; });
  el.querySelector(".mt-send").addEventListener("click", () => mentalThreadSend(mountId, youthId, el));
  el.querySelectorAll(".mt-file-dl").forEach((b) => b.addEventListener("click", () => mtOpenFile(b.dataset.path)));
  el.querySelectorAll(".mt-del").forEach((b) => b.addEventListener("click", async () => { if (!await uiConfirm("Supprimer ce message ?")) return; await sb.rpc("mental_thread_delete", { p_id: b.dataset.id }); mentalThread(mountId, youthId); }));
}
function mtMsgHtml(m) {
  const side = m.author_is_staff ? "staff" : "youth";
  const canDel = m.created_by === meId || hasAny(myAppRoles, ["superadmin", "admin", "head_coach", "coach_mental"]);
  const link = m.link_url ? `<a href="${esc(m.link_url)}" target="_blank" rel="noopener" class="mt-linkout">🔗 ${esc(m.link_url)}</a>` : "";
  const file = m.file_path ? `<button type="button" class="mt-file-dl" data-path="${esc(m.file_path)}">📎 ${esc(m.file_name || "document")}</button>` : "";
  const body = m.body ? esc(m.body).replace(/\n/g, "<br/>") : "";
  return `<div class="mt-msg ${side}"><div class="mt-meta"><b>${esc(m.author_name || "—")}</b> <span class="mt-role ${side}">${m.author_is_staff ? "Coach" : "Joueur"}</span> <span class="muted">${frDateTime(m.created_at)}</span>${canDel ? ` <button type="button" class="mt-del" data-id="${m.id}" title="Supprimer">✕</button>` : ""}</div>${body ? `<div class="mt-text">${body}</div>` : ""}${link}${file}</div>`;
}
async function mentalThreadSend(mountId, youthId, el) {
  const body = el.querySelector(".mt-body").value.trim();
  const link = el.querySelector(".mt-link").value.trim();
  const fi = el.querySelector(".mt-file"), f = fi.files[0];
  if (!body && !link && !f) return;
  const st = el.querySelector(".mt-status"); st.textContent = "Envoi…";
  let file_path = null, file_name = null;
  if (f) {
    if (f.size > 15 * 1024 * 1024) { st.textContent = "Fichier trop lourd (max 15 Mo)."; return; }
    const path = `${youthId}/${crypto.randomUUID()}_${f.name.replace(/[^\w.\-]/g, "_")}`;
    const up = await sb.storage.from("mental").upload(path, f);
    if (up.error) { st.textContent = "Échec de l'envoi du fichier : " + up.error.message; return; }
    file_path = path; file_name = f.name;
  }
  const { error } = await sb.rpc("mental_thread_post", { p_youth: youthId, p_body: body || null, p_link: link || null, p_file_path: file_path, p_file_name: file_name });
  if (error) { st.textContent = "Erreur : " + error.message; return; }
  mentalThread(mountId, youthId);
}
async function mtOpenFile(path) {
  const { data, error } = await sb.storage.from("mental").createSignedUrl(path, 120);
  if (error || !data) { alert("Impossible d'ouvrir le fichier."); return; }
  window.open(data.signedUrl, "_blank");
}

// Sous-onglet « Mental » de la fiche : discussion + formulaires compétition + 3 fiertés.
async function loadPersonMental(personId, show) {
  const ids = ["pm-thread", "pm-comp", "pm-proud"];
  if (!personId || !show) { showPersonTab("mental", false); ids.forEach((id) => { const e = $(id); if (e) e.innerHTML = ""; }); return; }
  showPersonTab("mental", true);
  mentalThread("pm-thread", personId);
  renderMcfInto($("pm-comp"), await mcfFetch(personId));
  renderProudInto($("pm-proud"), await mproudFetch(personId));
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

// Colonnes légères pour la LISTE (sans body_text/body_html, parfois énormes avec images
// base64) → chargement rapide. Le contenu est chargé à l'ouverture d'un mail (openMail).
const MAIL_COLS = "id,account_address,direction,from_name,from_address,to_address,subject,snippet,received_at,is_read,status,assigned_user,tags,imap_uid,created_at,message_id,comment,treated_by,treated_at,att_fetched,pushed,has_invoice";
let mailSearchT = null;
async function loadMail() {
  $("view-mail").classList.remove("mail-showdetail");  // (re)entree dans la messagerie : mobile = liste d'abord
  if (!$("mail-search").dataset.wired) {
    $("mail-search").dataset.wired = "1";
    $("mail-search").addEventListener("input", () => { $("mail-search-clear").classList.toggle("hidden", !$("mail-search").value); clearTimeout(mailSearchT); mailSearchT = setTimeout(refreshMailView, 250); });
    $("mail-search-clear").addEventListener("click", () => { $("mail-search").value = ""; $("mail-search-clear").classList.add("hidden"); $("mail-search").focus(); refreshMailView(); });
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
      const { data: msgs } = await sb.from("mail_messages").select(MAIL_COLS).order("received_at", { ascending: false }).limit(300);
      if (msgs) { mailMsgs = msgs; renderMailAccts(); refreshMailView(); }
    }, 60000);
    // Fermer (✕) : on enregistre avant de jeter la fenêtre, sinon le message est perdu
    // sans retour possible (la pastille de restauration disparaît elle aussi).
    $("mailc-close").addEventListener("click", async () => {
      if (mailcIsDirty()) await mailComposeSaveDraft(true);
      $("mailc-modal").classList.add("hidden"); $("mailc-restore").classList.add("hidden");
    });
    // Filet de sécurité : enregistrement automatique toutes les 10 s si quelque chose a bougé.
    setInterval(() => { if (mailcIsOpen() && mailcIsDirty() && !mailcSaving) mailComposeSaveDraft(true); }, 10000);
    // Quitter/recharger la page ne laisse pas le temps d'écrire en base → on prévient.
    window.addEventListener("beforeunload", (e) => {
      if (mailcIsOpen() && mailcIsDirty()) { e.preventDefault(); e.returnValue = ""; }
    });
    $("mailc-modal").addEventListener("click", (e) => { if (e.target === $("mailc-modal")) mailComposeMinimize(); });  // clic hors carte = réduire (ne perd rien)
    $("mailc-min").addEventListener("click", mailComposeMinimize);
    $("mailc-restore").addEventListener("click", () => { $("mailc-restore").classList.add("hidden"); $("mailc-modal").classList.remove("hidden"); });
    $("mailc-draft").addEventListener("click", mailComposeSaveDraft);
    $("mail-drafts-btn").addEventListener("click", openMailDrafts);
    $("maildrafts-close").addEventListener("click", () => $("maildrafts-modal").classList.add("hidden"));
    $("maildrafts-modal").addEventListener("click", (e) => { if (e.target === $("maildrafts-modal")) $("maildrafts-modal").classList.add("hidden"); });
    $("mailc-send").addEventListener("click", mailComposeSend);
    document.querySelectorAll("#mailc-modal .rt-btn").forEach((b) => b.addEventListener("mousedown", (e) => { e.preventDefault(); document.execCommand(b.dataset.cmd, false, null); }));
    $("mailc-color").addEventListener("input", (e) => { document.execCommand("foreColor", false, e.target.value); $("mailc-body").focus(); });
    brancherLien("mailc-link", "mailc-body");
    $("mailc-file").addEventListener("change", (e) => { for (const f of e.target.files) { if (f.size > 8 * 1024 * 1024) { alert(`${f.name} dépasse 8 Mo — trop lourd.`); continue; } mailcFiles.push(f); } e.target.value = ""; renderMailcFiles(); });
    attachEmailAC($("mailc-to")); attachEmailAC($("mailc-cc")); attachEmailAC($("mailc-bcc"));  // autocompletion adresses
  }
  const [{ data: accts }, { data: msgs }] = await Promise.all([
    sb.from("mail_accounts").select("*").order("sort_order"),
    sb.from("mail_messages").select(MAIL_COLS).order("received_at", { ascending: false }).limit(300),
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
  loadAddrBook();    // carnet d'adresses pour l'autocomplétion des champs À / Cc / Cci
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
    // Recherche = TOUT l'historique, indépendamment des filtres actifs (boîte, reçus/envoyés,
    // statut, attribution). Seule exception : un official reste verrouillé sur tournoi@.
    const safe = q.replace(/[,()%*]/g, " ").trim();
    let query = sb.from("mail_messages").select(MAIL_COLS).order("received_at", { ascending: false }).limit(150)
      .or(`subject.ilike.%${safe}%,from_name.ilike.%${safe}%,from_address.ilike.%${safe}%,to_address.ilike.%${safe}%,body_text.ilike.%${safe}%`);
    if (mailTournoiOnly) query = query.eq("account_address", MAIL_TOURNOI);
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
    try { await reg.showNotification("Notifications activées ✓", { body: "Tu recevras les nouveaux mails ici.", icon: "assets/pwa/admin-icon-192.png", badge: "assets/pwa/admin-badge.png?v=5", tag: "mail" }); } catch (_) {}
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
  brancherLien("mail-d-link", "mail-d-replyhtml");
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
let mailcDraftId = null;   // id du brouillon en cours d'édition (mail_compose_drafts), sinon null
let mailcDraftFiles = [];  // métadonnées des pièces jointes déjà dans le stockage
let mailcMissingFiles = []; // celles qu'on n'a pas pu retélécharger : à conserver, pas à supprimer
let mailcLastSig = "";     // contenu au dernier enregistrement → détecte les modifications
let mailcSaving = false;   // évite deux enregistrements simultanés
function openMailCompose(prefill) {
  if (prefill instanceof Event) prefill = null;  // appelé comme handler → pas de préremplissage
  const pf = prefill || {};
  mailcDraftId = pf.draftId || null;
  $("mailc-restore").classList.add("hidden");   // on rouvre en grand → plus de pastille réduite
  const froms = mailTournoiOnly ? mailAccounts.filter((a) => a.address === MAIL_TOURNOI) : mailAccounts;
  const cur = pf.account || (mailTournoiOnly ? MAIL_TOURNOI : (mailFilterAddr || (mailAccounts[0]?.address) || ""));
  $("mailc-from").innerHTML = froms.map((a) => `<option value="${esc(a.address)}">${esc(a.label)} — ${esc(a.address)}</option>`).join("");
  if (cur) $("mailc-from").value = cur;
  $("mailc-to").value = pf.to || "";
  $("mailc-cc").value = pf.cc || "";
  $("mailc-bcc").value = pf.bcc || "";
  $("mailc-subject").value = pf.subject || "";
  $("mailc-body").innerHTML = pf.bodyHtml || "";
  $("mailc-status").textContent = "";
  mailcFiles = Array.isArray(pf.files) ? pf.files.slice() : [];
  mailcDraftFiles = Array.isArray(pf.fileMeta) ? pf.fileMeta.slice() : [];
  mailcMissingFiles = Array.isArray(pf.missing) ? pf.missing.slice() : [];
  renderMailcFiles();
  if (mailcMissingFiles.length) {
    $("mailc-status").textContent = `⚠ ${mailcMissingFiles.length} pièce(s) jointe(s) illisible(s) pour l'instant — conservées, réessaie plus tard.`;
  }
  $("mailc-modal").classList.remove("hidden");
  mailcLastSig = mailcSignature();   // un message fraîchement ouvert n'est pas « modifié »
  setTimeout(() => $("mailc-to").focus(), 50);
}
// Réduire : cache la fenêtre mais garde tout en mémoire (DOM) → pastille pour rouvrir.
function mailComposeMinimize() {
  const subj = $("mailc-subject").value.trim();
  $("mailc-restore").textContent = "✉ " + (subj || "Nouveau message") + "  ⤢";
  $("mailc-restore").classList.remove("hidden");
  $("mailc-modal").classList.add("hidden");
}
// ---- Pièces jointes des brouillons (bucket privé mail-drafts, migration 53) ----
// Les objets File du navigateur ne peuvent pas être écrits en base : on les monte dans
// le stockage et on ne garde que leurs métadonnées dans mail_compose_drafts.files.
const MAILC_BUCKET = "mail-drafts";
let mailcUid = null;
async function mailcMyUid() {
  if (!mailcUid) { const { data } = await sb.auth.getSession(); mailcUid = data?.session?.user?.id || null; }
  return mailcUid;
}
// Monte les fichiers pas encore stockés, retire ceux que l'utilisateur a enlevés.
async function mailcSyncFiles(draftId, prevMeta) {
  const uid = await mailcMyUid();
  if (!uid) throw new Error("session introuvable");
  for (const f of mailcFiles) {
    if (f._path) continue;                                   // déjà dans le stockage
    const safe = f.name.replace(/[^\w.\-]+/g, "_");
    const path = `${uid}/${draftId}/${crypto.randomUUID()}-${safe}`;
    const { error } = await sb.storage.from(MAILC_BUCKET)
      .upload(path, f, { contentType: f.type || "application/octet-stream" });
    if (error) throw new Error(`${f.name} : ${error.message}`);
    f._path = path;
  }
  // Un fichier qu'on n'a pas réussi à retélécharger est absent de mailcFiles sans que
  // l'utilisateur l'ait retiré : il ne doit surtout pas être compté comme supprimé,
  // sinon une coupure réseau à la réouverture le détruirait pour de bon.
  const injoignables = mailcMissingFiles.map((m) => m.path);
  const keep = new Set([...mailcFiles.map((f) => f._path), ...injoignables]);
  const stale = (prevMeta || []).map((m) => m.path).filter((p) => p && !keep.has(p));
  if (stale.length) await sb.storage.from(MAILC_BUCKET).remove(stale);
  return mailcFiles
    .map((f) => ({ path: f._path, name: f.name, type: f.type || "application/octet-stream", size: f.size }))
    .concat(mailcMissingFiles);                              // conservés tels quels
}
// Rouvre un brouillon : retélécharge les pièces jointes en objets File (cf. mailForward).
// Renvoie aussi celles qui n'ont pas pu être lues, pour ne pas les perdre.
async function mailcLoadFiles(meta) {
  const out = [], manquants = [];
  for (const m of meta || []) {
    const { data, error } = await sb.storage.from(MAILC_BUCKET).download(m.path);
    if (error || !data) { manquants.push(m); continue; }
    const f = new File([data], m.name || "fichier", { type: m.type || "application/octet-stream" });
    f._path = m.path;
    out.push(f);
  }
  return { files: out, manquants };
}
// Vide le dossier de stockage d'un brouillon (après envoi ou suppression).
async function mailcPurgeFiles(draftId) {
  const uid = await mailcMyUid();
  if (!uid || !draftId) return;
  const dir = `${uid}/${draftId}`;
  const { data } = await sb.storage.from(MAILC_BUCKET).list(dir);
  if (data?.length) await sb.storage.from(MAILC_BUCKET).remove(data.map((o) => `${dir}/${o.name}`));
}

// ---- Enregistrement automatique ----
// Signature du contenu : permet de n'enregistrer que si quelque chose a bougé.
function mailcSignature() {
  return [$("mailc-to").value, $("mailc-cc").value, $("mailc-bcc").value, $("mailc-subject").value,
    $("mailc-body").innerHTML, mailcFiles.map((f) => `${f.name}:${f.size}`).join("|")].join("\u0000");
}
function mailcHasContent() {
  return !!($("mailc-to").value.trim() || $("mailc-subject").value.trim()
    || $("mailc-body").innerText.trim() || mailcFiles.length);
}
// Ouverte en grand OU réduite en pastille : dans les deux cas le message est vivant.
function mailcIsOpen() {
  return !$("mailc-modal").classList.contains("hidden") || !$("mailc-restore").classList.contains("hidden");
}
function mailcIsDirty() { return mailcHasContent() && mailcSignature() !== mailcLastSig; }

// Enregistrer le brouillon, pièces jointes comprises.
async function mailComposeSaveDraft(silent) {
  if (silent instanceof Event) silent = false;   // branchée telle quelle sur le bouton « Enregistrer le brouillon »
  if (mailcSaving) return;
  mailcSaving = true;
  const st = $("mailc-status");
  const row = {
    account: $("mailc-from").value || null, to_addr: $("mailc-to").value.trim() || null,
    cc: $("mailc-cc").value.trim() || null, bcc: $("mailc-bcc").value.trim() || null,
    subject: $("mailc-subject").value.trim() || null, body_html: $("mailc-body").innerHTML.trim() || null,
    updated_at: new Date().toISOString(),
  };
  try {
    if (mailcDraftId) {
      const { error } = await sb.from("mail_compose_drafts").update(row).eq("id", mailcDraftId);
      if (error) throw error;
    } else {
      const r = await sb.from("mail_compose_drafts").insert(row).select("id").single();
      if (r.error) throw r.error;
      mailcDraftId = r.data.id;
    }
    // Le dossier de stockage est nommé d'après l'id : il faut donc le brouillon d'abord.
    const meta = await mailcSyncFiles(mailcDraftId, mailcDraftFiles);
    const { error } = await sb.from("mail_compose_drafts").update({ files: meta }).eq("id", mailcDraftId);
    if (error) throw error;
    mailcDraftFiles = meta;
    mailcLastSig = mailcSignature();
    st.textContent = silent
      ? "✓ Enregistré à " + new Date().toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })
      : "✓ Brouillon enregistré";
  } catch (e) {
    st.textContent = "Échec du brouillon : " + (e?.message || e);
  }
  mailcSaving = false;
}
async function openMailDrafts() {
  const box = $("maildrafts-list");
  box.innerHTML = '<p class="muted">Chargement…</p>';
  $("maildrafts-modal").classList.remove("hidden");
  const { data } = await sb.from("mail_compose_drafts").select("*").order("updated_at", { ascending: false });
  const rows = data || [];
  box.innerHTML = rows.length ? rows.map((d) => `<div class="mdft-item" data-id="${d.id}">
      <button type="button" class="mdft-open" data-id="${d.id}"><b>${esc(d.subject || "(sans objet)")}</b>
        <span class="muted">${esc(d.to_addr || "—")} · ${frDateTime(d.updated_at)}</span></button>
      <button type="button" class="mdft-del" data-id="${d.id}" title="Supprimer">✕</button></div>`).join("")
    : '<p class="obj-empty">Aucun brouillon.</p>';
  box.querySelectorAll(".mdft-open").forEach((b) => b.addEventListener("click", async () => {
    const d = rows.find((x) => x.id === b.dataset.id); if (!d) return;
    b.disabled = true;
    const meta = Array.isArray(d.files) ? d.files : [];
    const { files, manquants } = await mailcLoadFiles(meta);   // retélécharge les pièces jointes
    $("maildrafts-modal").classList.add("hidden");
    openMailCompose({ draftId: d.id, account: d.account, to: d.to_addr, cc: d.cc, bcc: d.bcc,
      subject: d.subject, bodyHtml: d.body_html, files, fileMeta: meta, missing: manquants });
  }));
  box.querySelectorAll(".mdft-del").forEach((b) => b.addEventListener("click", async () => {
    if (!await uiConfirm("Supprimer ce brouillon ?")) return;
    await mailcPurgeFiles(b.dataset.id);               // pas de fichiers orphelins dans le bucket
    await sb.from("mail_compose_drafts").delete().eq("id", b.dataset.id);
    if (mailcDraftId === b.dataset.id) { mailcDraftId = null; mailcDraftFiles = []; }
    openMailDrafts();
  }));
}
// Transférer un message : ouvre « Nouveau message » prérempli (objet Fwd:, corps cité,
// pièces jointes d'origine reprises). Le destinataire reste à saisir.
function b64ToFile(b64, name, type) {
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name || "fichier", { type: type || "application/octet-stream" });
}
async function mailForward(m) {
  const { data: atts } = await sb.from("mail_attachments").select("filename,content_type,content_b64").eq("mail_id", m.id).eq("is_inline", false);
  const files = (atts || []).filter((a) => a.content_b64).map((a) => b64ToFile(a.content_b64, a.filename, a.content_type));
  const subj = /^fwd?\s*:/i.test(m.subject || "") ? m.subject : "Fwd: " + (m.subject || "(sans objet)");
  const who = (m.direction || "in") === "out"
    ? "À : " + esc(m.to_address || "")
    : "De : " + esc(m.from_name ? `${m.from_name} <${m.from_address}>` : (m.from_address || ""));
  const orig = m.body_html || esc(m.body_text || "").replace(/\n/g, "<br>");
  const quoted = `<br><br>---------- Message transféré ----------<br>${who}<br>Objet : ${esc(m.subject || "")}<br>Date : ${esc(mailDT(m.received_at))}<br><br>${orig}`;
  openMailCompose({ account: m.account_address, subject: subj, bodyHtml: quoted, files });
}
function renderMailcFiles() {
  const box = $("mailc-files"); if (!box) return;
  box.innerHTML = mailcFiles.map((f, i) => `<span class="rt-file">📎 ${esc(f.name)} <button type="button" data-i="${i}" aria-label="Retirer">✕</button></span>`).join("");
  box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { mailcFiles.splice(+b.dataset.i, 1); renderMailcFiles(); }));
}
// ---- Carnet d'adresses + autocomplétion des champs À / Cc / Cci ----
let mailAddrBook = [];
async function loadAddrBook() {
  const book = new Map();
  const add = (email, name) => {
    if (!email) return;
    const e = String(email).trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return;
    const k = e.toLowerCase(); const cur = book.get(k);
    if (!cur) book.set(k, { email: e, name: name || "" });
    else if (name && !cur.name) cur.name = name;
  };
  for (const p of people) {                                   // répertoire
    const nm = `${p.first_name || ""} ${p.last_name || ""}`.trim();
    add(p.email, nm);
    for (const e of (p.emails || [])) add(e, nm);
  }
  try { const { data } = await sb.rpc("mail_addressbook"); for (const r of (data || [])) add(r.email, r.name); } catch (_) {}
  mailAddrBook = [...book.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
}
// Autocomplétion multi-adresses (le dernier segment après une virgule est complété).
function attachEmailAC(input) {
  if (!input) return;
  input.setAttribute("autocomplete", "off");
  if (input.dataset.ac) return; input.dataset.ac = "1";
  const dd = document.createElement("div"); dd.className = "mail-ac"; dd.hidden = true;
  document.body.appendChild(dd);
  let items = [], active = -1;
  const token = () => { const v = input.value; const i = v.lastIndexOf(","); return v.slice(i + 1).trim(); };
  const pick = (email) => { const v = input.value; const i = v.lastIndexOf(","); input.value = (i >= 0 ? v.slice(0, i + 1) + " " : "") + email + ", "; close(); input.focus(); };
  const close = () => { dd.hidden = true; active = -1; };
  const render = () => {
    const q = token().toLowerCase();
    if (q.length < 2) { close(); return; }
    items = mailAddrBook.filter((c) => c.email.toLowerCase().includes(q) || (c.name || "").toLowerCase().includes(q)).slice(0, 8);
    if (!items.length) { close(); return; }
    dd.innerHTML = items.map((c, i) => `<div class="mail-ac-it${i === active ? " on" : ""}" data-i="${i}"><b>${esc(c.name || c.email)}</b>${c.name ? `<span>${esc(c.email)}</span>` : ""}</div>`).join("");
    const r = input.getBoundingClientRect();
    dd.style.left = r.left + "px"; dd.style.top = (r.bottom + 2) + "px"; dd.style.width = r.width + "px";
    dd.hidden = false;
    dd.querySelectorAll(".mail-ac-it").forEach((el) => el.addEventListener("mousedown", (e) => { e.preventDefault(); pick(items[+el.dataset.i].email); }));
  };
  input.addEventListener("input", render);
  input.addEventListener("focus", render);
  input.addEventListener("blur", () => setTimeout(close, 150));
  input.addEventListener("keydown", (e) => {
    if (dd.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, items.length - 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(items[active].email); }
    else if (e.key === "Escape") close();
  });
}
async function mailComposeSend() {
  const account = $("mailc-from").value, to = $("mailc-to").value.trim(), subject = $("mailc-subject").value.trim();
  const cc = $("mailc-cc").value.trim(), bcc = $("mailc-bcc").value.trim();
  const html = $("mailc-body").innerHTML.trim(), text = $("mailc-body").innerText.trim();
  const st = $("mailc-status");
  if (!to) { st.textContent = "Indique un destinataire."; return; }
  if (!text && !mailcFiles.length) { st.textContent = "Écris un message."; return; }
  const btn = $("mailc-send"); btn.disabled = true; st.textContent = "Envoi…";
  try {
    const attachments = [];
    for (const f of mailcFiles) attachments.push({ filename: f.name, contentType: f.type || "application/octet-stream", content: await fileToB64(f) });
    const { data, error } = await sb.functions.invoke("mail-send", { body: { account, to, cc: cc || undefined, bcc: bcc || undefined, subject, text, html: html || undefined, attachments } });
    if (error) { let m = error.message; try { m = (await error.context.json())?.error || m; } catch (_) {} st.textContent = "Échec : " + m; }
    else if (data?.error) { st.textContent = "Échec : " + data.error; }
    else {
      if (mailcDraftId) {
        await mailcPurgeFiles(mailcDraftId);           // message parti : le brouillon et ses fichiers aussi
        await sb.from("mail_compose_drafts").delete().eq("id", mailcDraftId);
        mailcDraftId = null;
      }
      mailcFiles = []; mailcDraftFiles = []; mailcMissingFiles = []; mailcLastSig = "";
      $("mailc-restore").classList.add("hidden");
      $("mailc-modal").classList.add("hidden"); await loadMail();
    }
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
    const cc = ($("mail-d-cc")?.value || "").trim(), bcc = ($("mail-d-bcc")?.value || "").trim();
    const { data, error } = await sb.functions.invoke("mail-send", { body: { id, text, html: html || undefined, cc: cc || undefined, bcc: bcc || undefined, attachments } });
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
      <div class="mail-item-foot"><span class="mail-acctbadge">${esc(acctLabel(m.account_address))}</span>${m.has_invoice ? '<span class="mail-inv-badge" title="Une facture de ce mail a été ajoutée à l\'onglet Factures">📄 Facture</span>' : ""}
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
  // Contenu (body) chargé à la demande (exclu de la liste pour la vitesse), puis mis en cache.
  if (m.body_html === undefined && m.body_text === undefined) {
    const { data: bd } = await sb.from("mail_messages").select("body_text,body_html").eq("id", id).maybeSingle();
    if (bd) { m.body_text = bd.body_text; m.body_html = bd.body_html; const c = mailMsgs.find((x) => x.id === id); if (c && c !== m) { c.body_text = bd.body_text; c.body_html = bd.body_html; } }
  }
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
        <button type="button" class="rt-btn" id="mail-d-link" title="Insérer un lien (surligner un mot puis cliquer)">🔗</button>
        <label class="rt-color" title="Couleur du texte">A<input type="color" id="mail-d-color" value="#000000" /></label>
        <label class="rt-attach" title="Joindre un fichier">📎 Joindre<input type="file" id="mail-d-file" multiple hidden /></label>
        <button type="button" id="mail-d-suggest" class="rt-suggest" title="Rédiger une réponse automatiquement">✨ Proposer une réponse</button>
      </div>
      <div class="mail-d-cc">
        <input id="mail-d-cc" type="text" autocomplete="off" placeholder="Cc (copie, optionnel)" />
        <input id="mail-d-bcc" type="text" autocomplete="off" placeholder="Cci (copie cachée, optionnel)" />
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
      <div class="mail-d-head-top"><h3>${esc(m.subject || "(sans objet)")}</h3><button type="button" id="mail-d-forward" class="ghost mail-d-fwd" title="Transférer ce message">↪ Transférer</button></div>
      <div class="mail-d-meta">${isOut ? "À " + esc(m.to_address || "") : "<b>" + esc(m.from_name || "") + "</b> &lt;" + esc(m.from_address || "") + "&gt;"} <span class="muted">· ${esc(acctLabel)} · ${mailDT(m.received_at)}</span></div>
    </div>
    ${m.has_invoice ? `<div class="mail-inv-note">📄 Une facture de ce mail a été ajoutée à l'onglet <b>Factures</b>. Tu peux passer ce mail en « Traité ».</div>` : ""}
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
  $("mail-d-forward").addEventListener("click", () => mailForward(m));  // transfert (in ET out)
  $("mail-detail").scrollTop = 0;
  window.scrollTo(0, 0);
  if (!isOut) {
    mailWireCompose();
    $("mail-detail").querySelectorAll(".mail-stbtns .mail-fbtn").forEach((b) => b.addEventListener("click", () => mailSetStatus(m, b.dataset.st)));
    $("mail-d-unread").addEventListener("click", async () => { m.is_read = false; mailSyncCache(m); await sb.from("mail_messages").update({ is_read: false }).eq("id", id); renderMailAccts(); refreshMailView(); });
    attachEmailAC($("mail-d-cc")); attachEmailAC($("mail-d-bcc"));  // autocompletion Cc/Cci de la réponse
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
      $("csel-sub-totaux").classList.toggle("hidden", cselSub !== "totaux");
      $("csel-reset").classList.toggle("hidden", cselSub !== "repas");
      // Totaux = vue par mois : la navigation par semaine et le PDF hebdo n'ont pas de sens ici.
      ["csel-prev", "csel-next", "csel-week", "csel-range", "csel-pdf"].forEach((id) => { const e = $(id); if (e) e.classList.toggle("hidden", cselSub === "totaux"); });
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
  if (cselSub === "repas") renderCselRepas(dates); else if (cselSub === "totaux") renderCselTotaux(); else renderCselEtudes(dates);
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
// Totaux de repas par MOIS sur la saison juniors en cours (même règle que la vue hebdo :
// défaut = contrat du jeune « <Jour> lunch » / repas déclarés du coach, puis exceptions par semaine).
async function renderCselTotaux() {
  const body = $("csel-totaux-body"); if (!body) return;
  body.innerHTML = '<p class="muted">Calcul…</p>';
  const season = currentSeason("juniors");
  if (!season) { body.innerHTML = '<p class="muted" style="font-size:.85rem">Aucune saison juniors en cours.</p>'; return; }
  const { data: rps } = await sb.from("role_periods").select("person_id").eq("season_id", season.id).in("role", CSEL_ROLES);
  const ids = [...new Set((rps || []).map((r) => r.person_id))];
  const [cRes, oRes, dRes] = await Promise.all([
    ids.length ? sb.from("player_contracts").select("person_id,data").eq("season_id", season.id).in("person_id", ids) : Promise.resolve({ data: [] }),
    sb.from("csel_meal_overrides").select("week_start,person_id,dow,present").gte("week_start", cselMondayOf(season.start_date)).lte("week_start", season.end_date),
    sb.from("coach_meal_defaults").select("person_id,dow"),
  ]);
  const contract = {}; for (const c of cRes.data || []) contract[c.person_id] = c.data || {};
  const ovr = {};  // week_start -> person -> dow -> present
  for (const o of oRes.data || []) ((ovr[o.week_start] = ovr[o.week_start] || {})[o.person_id] = ovr[o.week_start][o.person_id] || {})[o.dow] = o.present;
  const coachDef = {}; for (const r of dRes.data || []) (coachDef[r.person_id] = coachDef[r.person_id] || new Set()).add(r.dow);
  const youthDef = (pid, dow) => contract[pid]?.[PC_DAYS[dow - 1][0] + " lunch"] === "Oui";
  const months = {};  // "YYYY-MM" -> { y, c }
  for (let d = new Date(season.start_date + "T00:00:00"), end = new Date(season.end_date + "T00:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = (d.getDay() + 6) % 7 + 1; if (dow > 5) continue;                  // lun=1 … ven=5
    const iso = isoA(d), ws = cselMondayOf(iso), ym = iso.slice(0, 7), m = months[ym] || (months[ym] = { y: 0, c: 0 });
    const on = (pid, dflt) => { const o = ovr[ws]?.[pid]?.[dow]; return o === undefined ? dflt : o; };
    for (const pid of ids) if (on(pid, youthDef(pid, dow))) m.y++;
    for (const pid of Object.keys(coachDef)) if (on(pid, coachDef[pid].has(dow))) m.c++;
  }
  const keys = Object.keys(months).sort();
  const lbl = (ym) => { const [y, mo] = ym.split("-"); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("fr-CH", { month: "long", year: "numeric" }); };
  let ty = 0, tc = 0;
  const rows = keys.map((ym) => { const m = months[ym]; ty += m.y; tc += m.c; return `<tr><td><b>${esc(lbl(ym))}</b></td><td class="csel-c">${m.y}</td><td class="csel-c">${m.c}</td><td class="csel-c"><b>${m.y + m.c}</b></td></tr>`; }).join("");
  body.innerHTML = `<div class="tbl-wrap"><table class="crm-table csel-table">
    <thead><tr><th>Mois</th><th>Jeunes</th><th>Coachs / staff</th><th>Total repas</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" class="muted">Aucune donnée.</td></tr>'}</tbody>
    <tfoot><tr class="csel-tot"><td><b>Saison ${esc(season.label || "")}</b></td><td class="csel-c"><b>${ty}</b></td><td class="csel-c"><b>${tc}</b></td><td class="csel-c"><b>${ty + tc}</b></td></tr></tfoot></table></div>`;
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
    // admin / superadmin : ✎ ouvre le popup de choix des profs (plusieurs possibles)
    const editBtn = canEditProfs ? `<button type="button" class="et-prof-edit" data-day="${d.id}" data-date="${d.day}" title="Choisir le(s) prof(s) de cette journée">✎</button>` : "";
    html += `<tr class="${notMine ? "et-notmine" : ""}"><td class="et-datecell"><div><b>${etDow(d.day)}</b> ${frDate(d.day)}</div><div class="et-dprofs">${dprofs}${editBtn}</div></td>`
      + youths.map((y) => { const s = attOf(d.id, y.id); const lk = !dayOpen; const due = s !== "not_planned"; const lockTitle = notMine ? "Vous ne pouvez pas valider les présences d'un jour qui ne vous est pas attribué" : "Vous ne pouvez pas valider les présences avant 12h50"; return `<td><button type="button" class="att-chip et-cell ${due ? (mine ? "et-due " : "et-due-lock ") : ""}${lk ? "st-locked" : ET_CLS[s]}" ${lk ? `data-locked="1" data-lockmsg="${esc(lockTitle)}"` : ""} data-day="${d.id}" data-youth="${y.id}" data-status="${s}">${ET_LBL[s]}</button></td>`; }).join("")
      + "</tr>";
  }
  cont.innerHTML = html + "</tbody></table>";
  cont.querySelectorAll(".et-cell").forEach((c) => c.addEventListener("click", () => {
    if (c.dataset.locked) { uiAlert(c.dataset.lockmsg || "Saisie non disponible pour ce jour."); return; }
    etCycle(c);
  }));
  cont.querySelectorAll(".et-presence").forEach((b) => b.addEventListener("click", () => etProfPresence(b)));
  cont.querySelectorAll(".et-prof-edit").forEach((b) => b.addEventListener("click", () => openEtProfModal(b.dataset.day, b.dataset.date)));
  if (!$("et-prof-save").dataset.w) {
    $("et-prof-save").dataset.w = "1";
    $("et-prof-save").addEventListener("click", saveEtProfModal);
    $("et-prof-close").addEventListener("click", () => $("et-prof-modal").classList.add("hidden"));
    $("et-prof-modal").addEventListener("click", (e) => { if (e.target === $("et-prof-modal")) $("et-prof-modal").classList.add("hidden"); });
  }
}
// Popup admin : choisir le(s) prof(s) d'une journée d'études (cases à cocher, plusieurs possibles).
let etProfDay = null;
async function openEtProfModal(dayId, dayIso) {
  etProfDay = dayId;
  $("et-prof-date").textContent = `${etDow(dayIso)} ${frDate(dayIso)}`;
  const { data: cur } = await sb.from("etudes_day_profs").select("prof_person_id").eq("day_id", dayId);
  const assigned = new Set((cur || []).map((r) => r.prof_person_id));
  const opts = people.filter((p) => hasRoleIn(p.id, ["prof"])).sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
  $("et-prof-list").innerHTML = opts.length
    ? opts.map((p) => `<label class="et-prof-opt"><input type="checkbox" value="${p.id}"${assigned.has(p.id) ? " checked" : ""} /> <span>${esc(p.first_name)} ${esc(p.last_name)}</span></label>`).join("")
    : '<p class="muted">Aucune personne avec le tag « Prof » dans le répertoire.</p>';
  $("et-prof-modal").classList.remove("hidden");
}
async function saveEtProfModal() {
  if (!etProfDay) return;
  const wanted = new Set([...$("et-prof-list").querySelectorAll("input:checked")].map((i) => i.value));
  const { data: cur } = await sb.from("etudes_day_profs").select("prof_person_id").eq("day_id", etProfDay);
  const have = new Set((cur || []).map((r) => r.prof_person_id));
  const toAdd = [...wanted].filter((id) => !have.has(id)).map((id) => ({ day_id: etProfDay, prof_person_id: id }));
  const toDel = [...have].filter((id) => !wanted.has(id));
  if (toAdd.length) await sb.from("etudes_day_profs").insert(toAdd);
  if (toDel.length) await sb.from("etudes_day_profs").delete().eq("day_id", etProfDay).in("prof_person_id", toDel);
  $("et-prof-modal").classList.add("hidden");
  loadEtudesCalendar();
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
    const m = tally[pid] || 0, cls = m === 0 ? "absent" : m === tgt ? "ok" : m > tgt ? "over" : "under";
    return `<span class="tr-tchip ${cls}">${esc(trShort(pid))} <b>${m}′</b>${tgt ? `/${tgt}` : ""}</span>`;
  }).join("");
  // Tally COACHS = temps réellement encadré (→ paie). Chaque coach de la séance devrait totaliser la durée.
  const coachMin = {}; (e.courseCoaches || []).forEach((id) => (coachMin[id] = 0));
  trBlocs.forEach((b) => { if (b.coach) coachMin[b.coach] = (coachMin[b.coach] || 0) + (b.minutes || 0); });
  const coachIdsShown = Object.keys(coachMin);
  const coachTallyHtml = coachIdsShown.map((id) => {
    const m = coachMin[id] || 0, cls = m === 0 ? "absent" : m === tgt ? "ok" : m > tgt ? "over" : "under";
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
    <p class="muted" style="font-size:.8rem;margin:2px 0 8px">🟢 complet · 🟠 incomplet · 🔴 absent (0) · 🔵 dépassé. Un <b>joueur</b> peut faire moins ; un <b>coach</b> devrait couvrir toute la séance (sinon avertissement).</p>
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

// ============================================================
//  Project Manager — tableau facon Trello
//  Colonnes, cartes, membres et etiquettes vivent en base : l'equipe ajoute
//  une colonne ou une personne sans qu'on touche au code.
// ============================================================
let pmCols = [], pmMembers = [], pmLabels = [], pmCards = [];
let pmCarte = null;                 // carte ouverte dans la fiche
let pmFiltre = { membre: null, etiquette: null };

async function loadPM() {
  const [c, m, l, k] = await Promise.all([
    sb.from("pm_columns").select("*").order("sort_order"),
    sb.from("pm_members").select("*").eq("active", true).order("sort_order"),
    sb.from("pm_labels").select("*").order("sort_order"),
    sb.from("pm_cards").select("*, pm_card_members(member_id), pm_card_labels(label_id), pm_attachments(id), pm_checklist(id,done)").order("sort_order"),
  ]);
  pmCols = c.data || []; pmMembers = m.data || []; pmLabels = l.data || []; pmCards = k.data || [];
  pmRenderFiltres();
  pmRenderBoard();
}

const pmMembre = (id) => pmMembers.find((x) => x.id === id);
const pmLabel  = (id) => pmLabels.find((x) => x.id === id);
const pmIdsM = (c) => (c.pm_card_members || []).map((x) => x.member_id);
const pmIdsL = (c) => (c.pm_card_labels || []).map((x) => x.label_id);

function pmRenderFiltres() {
  const z = $("pm-filtres"); if (!z) return;
  const pastille = (m) =>
    `<button type="button" class="pm-fm${pmFiltre.membre === m.id ? " on" : ""}" data-fm="${m.id}"
       style="background:${esc(m.color)}" title="${esc(m.name)}">${esc(m.initials)}</button>`;
  const etiq = (l) =>
    `<button type="button" class="pm-fl${pmFiltre.etiquette === l.id ? " on" : ""}" data-fl="${l.id}"
       style="background:${esc(l.color)}">${esc(l.name)}</button>`;
  z.innerHTML = `<span class="pm-f-titre">Filtrer</span>
    <span class="pm-f-groupe">${pmMembers.map(pastille).join("")}</span>
    <span class="pm-f-groupe">${pmLabels.map(etiq).join("")}</span>
    ${(pmFiltre.membre || pmFiltre.etiquette) ? `<button type="button" class="ghost pm-f-raz">Tout afficher</button>` : ""}`;
}

// Une carte passe le filtre si elle satisfait les deux criteres actifs.
const pmVisible = (c) =>
  (!pmFiltre.membre || pmIdsM(c).includes(pmFiltre.membre)) &&
  (!pmFiltre.etiquette || pmIdsL(c).includes(pmFiltre.etiquette));

function pmRenderBoard() {
  const b = $("pm-board"); if (!b) return;
  if (!pmCols.length) { b.innerHTML = '<p class="muted">Aucune colonne. Commence par en créer une.</p>'; return; }
  const auj = new Date().toISOString().slice(0, 10);
  b.innerHTML = pmCols.map((col) => {
    const cartes = pmCards.filter((c) => c.column_id === col.id && pmVisible(c));
    return `<section class="pm-col" data-col="${col.id}">
      <header class="pm-col-head">
        <h2 class="pm-col-nom" data-rename="${col.id}" title="Renommer">${esc(col.name)}</h2>
        <span class="pm-col-nb">${cartes.length}</span>
        <button type="button" class="pm-col-x" data-delcol="${col.id}" title="Supprimer la colonne">✕</button>
      </header>
      <div class="pm-col-body" data-drop="${col.id}">
        ${cartes.map((c) => {
          const retard = c.due_date && c.due_date < auj;
          const nPJ = (c.pm_attachments || []).length;
          return `<article class="pm-card" data-card="${c.id}">
            ${pmIdsL(c).length ? `<div class="pm-card-labels">${pmIdsL(c).map((id) => {
              const l = pmLabel(id); return l ? `<span class="pm-chip" style="background:${esc(l.color)}" title="${esc(l.name)}"></span>` : ""; }).join("")}</div>` : ""}
            <div class="pm-card-titre">${esc(c.title)}</div>
            <div class="pm-card-bas">
              <span class="pm-card-infos">
                ${c.due_date ? `<span class="pm-date${retard ? " pm-retard" : ""}">${frDate(c.due_date)}</span>` : ""}
                ${c.description ? `<span class="pm-ico" title="Description">≡</span>` : ""}
                ${(() => { const l = c.pm_checklist || []; if (!l.length) return "";
                  const f = l.filter((x) => x.done).length;
                  return `<span class="pm-chk-badge${f === l.length ? " pm-chk-ok" : ""}" title="Liste de contrôle">☑ ${f}/${l.length}</span>`; })()}
                ${nPJ ? `<span class="pm-ico" title="${nPJ} pièce(s) jointe(s)">📎${nPJ}</span>` : ""}
              </span>
              <span class="pm-card-membres">${pmIdsM(c).map((id) => {
                const m = pmMembre(id); return m ? `<span class="pm-ini" style="background:${esc(m.color)}" title="${esc(m.name)}">${esc(m.initials)}</span>` : ""; }).join("")}</span>
            </div>
          </article>`;
        }).join("")}
      </div>
      <button type="button" class="pm-add" data-add="${col.id}">＋ Ajouter une carte</button>
    </section>`;
  }).join("");
  pmBrancherGlisser();
}

// ---- Glisser-deposer ----
// Ecrit avec les evenements « pointer » et non avec le glisser-deposer HTML5 :
// celui-ci n'existe pas sur ecran tactile, le tableau etait donc fige sur
// tablette et sur telephone. Les evenements pointer couvrent la souris et le
// doigt avec le meme code.
//
// La zone de depot est la COLONNE entiere, et plus seulement la pile de cartes :
// on peut viser une colonne vide, l'espace sous la derniere carte, l'en-tete ou
// le bouton d'ajout. Avant, seule la pile elle-meme acceptait le depot, ce qui
// rendait une colonne vide (24 px de haut) quasiment impossible a atteindre.
//
// Le rang reste un nombre a virgule : deposer entre deux cartes revient a
// prendre le milieu de leurs rangs, sans renumeroter la colonne entiere.

const PM_SEUIL = 6;            // px parcourus avant de parler de glisser
const PM_APPUI_DOIGT = 180;    // ms d'appui avant d'armer le glisser au doigt
let pmD = null;                // geste en cours
let pmFinGlisse = 0;           // horodatage du dernier depot (voir le clic)

function pmBrancherGlisser() {
  document.querySelectorAll(".pm-card").forEach((el) => {
    el.addEventListener("pointerdown", pmPrise);
  });
}

function pmPrise(e) {
  if (e.button > 0) return;                       // clic droit ou molette
  if (e.target.closest("button,a,input,select,textarea")) return;
  const el = e.currentTarget;
  pmD = {
    id: el.dataset.card, el, actif: false,
    x0: e.clientX, y0: e.clientY,
    // A la souris le glisser est arme tout de suite ; au doigt il faut un appui
    // franc, sinon on confisquerait le defilement des qu'on effleure une carte.
    arme: e.pointerType === "mouse",
    minuteur: null,
  };
  if (!pmD.arme) {
    pmD.minuteur = setTimeout(() => {
      if (!pmD) return;
      pmD.arme = true;
      if (navigator.vibrate) navigator.vibrate(12);  // « c'est bon, tu tiens la carte »
    }, PM_APPUI_DOIGT);
  }
  document.addEventListener("pointermove", pmBouge);
  document.addEventListener("pointerup", pmLache);
  document.addEventListener("pointercancel", pmLache);
  // Non passif : c'est la seule facon d'empecher la page de defiler pendant
  // qu'on deplace une carte au doigt.
  document.addEventListener("touchmove", pmRetenirPage, { passive: false });
}

function pmRetenirPage(e) { if (pmD && pmD.actif) e.preventDefault(); }

function pmBouge(e) {
  if (!pmD) return;
  const loin = Math.hypot(e.clientX - pmD.x0, e.clientY - pmD.y0);
  if (!pmD.actif) {
    // Doigt qui part avant l'appui franc : l'intention etait de faire defiler.
    if (!pmD.arme) { if (loin > PM_SEUIL) pmRelacher(); return; }
    if (loin < PM_SEUIL) return;
    pmDemarrer(e);
  }
  pmSuivre(e);
}

function pmDemarrer(e) {
  const r = pmD.el.getBoundingClientRect();
  pmD.actif = true;
  pmD.dx = r.left - e.clientX;        // ou le curseur mord dans la carte
  pmD.dy = r.top - e.clientY;

  // La carte qui suit le curseur. C'est une copie : l'originale quitte le flux,
  // remplacee par un trou de meme taille qui montre ou elle retombera.
  const f = pmD.el.cloneNode(true);
  f.classList.add("pm-fantome");
  f.style.width = r.width + "px";
  document.body.appendChild(f);
  pmD.fantome = f;

  const trou = document.createElement("div");
  trou.className = "pm-trou";
  trou.style.height = r.height + "px";
  pmD.trou = trou;
  pmD.el.replaceWith(trou);
}

function pmSuivre(e) {
  pmD.fantome.style.transform =
    `translate(${e.clientX + pmD.dx}px, ${e.clientY + pmD.dy}px) rotate(2.5deg)`;

  // Le fantome est en pointer-events:none : elementFromPoint voit au travers.
  const sous = document.elementFromPoint(e.clientX, e.clientY);
  const col = sous && sous.closest(".pm-col");
  document.querySelectorAll(".pm-col").forEach((c) => c.classList.toggle("pm-survol", c === col));
  if (!col) return;

  // Le trou se glisse avant la premiere carte dont on a depasse le milieu.
  const zone = col.querySelector(".pm-col-body");
  let avant = null;
  for (const el of zone.querySelectorAll(".pm-card")) {
    const r = el.getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) { avant = el; break; }
  }
  if (avant) zone.insertBefore(pmD.trou, avant); else zone.appendChild(pmD.trou);

  pmDefilerBord(e.clientX);
}

// Avec beaucoup de colonnes le tableau deborde : on le fait defiler quand le
// curseur approche d'un bord, sinon les colonnes hors ecran sont hors d'atteinte.
function pmDefilerBord(x) {
  const b = $("pm-board"); if (!b) return;
  const r = b.getBoundingClientRect();
  const marge = 70;
  if (x < r.left + marge) b.scrollLeft -= 18;
  else if (x > r.right - marge) b.scrollLeft += 18;
}

function pmLache() {
  if (!pmD) return;
  if (pmD.actif) pmPoser(); else pmRelacher();
}

// Fin du geste sans depot (simple clic, ou defilement au doigt).
function pmRelacher() {
  if (!pmD) return;
  clearTimeout(pmD.minuteur);
  if (pmD.fantome) pmD.fantome.remove();
  if (pmD.trou) pmD.trou.replaceWith(pmD.el);
  pmD = null;
  document.removeEventListener("pointermove", pmBouge);
  document.removeEventListener("pointerup", pmLache);
  document.removeEventListener("pointercancel", pmLache);
  document.removeEventListener("touchmove", pmRetenirPage);
  document.querySelectorAll(".pm-col").forEach((c) => c.classList.remove("pm-survol"));
}

async function pmPoser() {
  const trou = pmD.trou, id = pmD.id;
  const zone = trou.parentElement;
  const colId = zone.dataset.drop;
  const carte = pmCards.find((c) => c.id === id);

  // Position du trou parmi les cartes de la colonne d'arrivee.
  const enfants = [...zone.children];
  const avantTrou = enfants.slice(0, enfants.indexOf(trou));
  const idx = avantTrou.filter((el) => el.classList.contains("pm-card")).length;
  const rangs = enfants.filter((el) => el.classList.contains("pm-card"))
    .map((el) => pmCards.find((c) => c.id === el.dataset.card)?.sort_order ?? 0);

  const precedent = idx > 0 ? rangs[idx - 1] : null;
  const suivant = idx < rangs.length ? rangs[idx] : null;
  const rang = precedent === null && suivant === null ? 1
    : precedent === null ? suivant - 1
    : suivant === null ? precedent + 1
    : (precedent + suivant) / 2;

  pmFinGlisse = Date.now();     // pour que le clic de fin n'ouvre pas la fiche
  pmRelacher();
  if (!carte) return;

  const avant = { column_id: carte.column_id, sort_order: carte.sort_order };
  carte.column_id = colId; carte.sort_order = rang;
  pmRenderBoard();              // on affiche tout de suite, on enregistre ensuite

  const { error } = await sb.from("pm_cards")
    .update({ column_id: colId, sort_order: rang, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    // L'ecran ne doit pas montrer un deplacement que la base a refuse.
    Object.assign(carte, avant);
    pmRenderBoard();
    uiModal("Le déplacement n'a pas été enregistré : " + error.message);
  }
}

// Echap annule le geste en cours et remet la carte a sa place.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pmD) pmRelacher();
});

// ---- Fiche d'une carte ----
function pmOuvrir(carte) {
  pmCarte = carte;
  $("pm-title").value = carte.title || "";
  $("pm-desc").value = carte.description || "";
  $("pm-start").value = carte.start_date || "";
  $("pm-due").value = carte.due_date || "";
  $("pm-col").innerHTML = pmCols.map((c) =>
    `<option value="${c.id}"${c.id === carte.column_id ? " selected" : ""}>${esc(c.name)}</option>`).join("");
  const mSel = pmIdsM(carte), lSel = pmIdsL(carte);
  $("pm-members").innerHTML = pmMembers.map((m) =>
    `<button type="button" class="pm-pick pm-pick-m${mSel.includes(m.id) ? " on" : ""}" data-m="${m.id}"
       style="--c:${esc(m.color)}"><span class="pm-ini" style="background:${esc(m.color)}">${esc(m.initials)}</span>${esc(m.name)}</button>`).join("");
  $("pm-labels").innerHTML = pmLabels.map((l) =>
    `<button type="button" class="pm-pick pm-pick-l${lSel.includes(l.id) ? " on" : ""}" data-l="${l.id}"
       style="--c:${esc(l.color)}"><span class="pm-chip" style="background:${esc(l.color)}"></span>${esc(l.name)}</button>`).join("");
  $("pm-etat").textContent = "";
  pmRenderCheck();
  pmRenderFichiers();
  $("pm-modal").classList.remove("hidden");
  setTimeout(() => $("pm-title").focus(), 60);
}
function pmFermer() { $("pm-modal").classList.add("hidden"); pmCarte = null; }

async function pmRenderFichiers() {
  const z = $("pm-files"); if (!z || !pmCarte) return;
  const { data } = await sb.from("pm_attachments")
    .select("id,filename,content_type,size_bytes").eq("card_id", pmCarte.id).order("created_at");
  z.innerHTML = (data || []).length
    ? data.map((f) => `<span class="pm-file"><button type="button" class="pm-file-nom" data-dl="${f.id}">${esc(f.filename)}</button>
        <span class="muted">${Math.max(1, Math.round((f.size_bytes || 0) / 1024))} Ko</span>
        <button type="button" class="pm-file-x" data-rmfile="${f.id}" title="Retirer">✕</button></span>`).join("")
    : '<span class="muted">Aucune pièce jointe.</span>';
}

// ---- Enregistrement de la fiche ----
async function pmEnregistrer() {
  if (!pmCarte) return;
  const titre = $("pm-title").value.trim();
  if (!titre) { $("pm-etat").textContent = "Il faut un titre."; return; }
  $("pm-etat").textContent = "Enregistrement…";
  const maj = {
    title: titre,
    description: $("pm-desc").value.trim() || null,
    start_date: $("pm-start").value || null,
    due_date: $("pm-due").value || null,
    column_id: $("pm-col").value,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from("pm_cards").update(maj).eq("id", pmCarte.id);
  if (error) { $("pm-etat").textContent = "Erreur : " + error.message; return; }

  // Membres et etiquettes : on remplace l'ensemble, plus simple et plus sur
  // que de calculer les differences.
  const mSel = [...$("pm-members").querySelectorAll(".pm-pick.on")].map((b) => b.dataset.m);
  const lSel = [...$("pm-labels").querySelectorAll(".pm-pick.on")].map((b) => b.dataset.l);
  await sb.from("pm_card_members").delete().eq("card_id", pmCarte.id);
  await sb.from("pm_card_labels").delete().eq("card_id", pmCarte.id);
  if (mSel.length) await sb.from("pm_card_members").insert(mSel.map((id) => ({ card_id: pmCarte.id, member_id: id })));
  if (lSel.length) await sb.from("pm_card_labels").insert(lSel.map((id) => ({ card_id: pmCarte.id, label_id: id })));

  $("pm-etat").textContent = "Enregistré.";
  await loadPM();
  setTimeout(pmFermer, 350);
}

// ---- Actions du tableau ----
document.addEventListener("click", async (e) => {
  if (!$("view-pm") || $("view-pm").classList.contains("hidden")) {
    // La fiche est hors de la vue : on la laisse repondre meme masquee.
    if (!e.target.closest("#pm-modal")) return;
  }

  const ajout = e.target.closest("[data-add]");
  if (ajout) {
    const titre = (await uiPrompt("Titre de la carte")) || "";
    if (!titre.trim()) return;
    const rangs = pmCards.filter((c) => c.column_id === ajout.dataset.add).map((c) => c.sort_order);
    const { data, error } = await sb.from("pm_cards").insert({
      column_id: ajout.dataset.add, title: titre.trim(),
      sort_order: (rangs.length ? Math.max(...rangs) : 0) + 1,
    }).select("*, pm_card_members(member_id), pm_card_labels(label_id), pm_attachments(id), pm_checklist(id,done)").single();
    if (error) return uiModal("Création impossible : " + error.message);
    pmCards.push(data); pmRenderBoard(); pmOuvrir(data);
    return;
  }

  const carte = e.target.closest(".pm-card");
  // Un depot se termine par un clic : sans ce garde-fou, ranger une carte
  // ouvrirait sa fiche dans la foulee.
  if (carte && Date.now() - pmFinGlisse > 300) {
    const c = pmCards.find((x) => x.id === carte.dataset.card); if (c) pmOuvrir(c); return;
  }
  if (carte) return;

  const ren = e.target.closest("[data-rename]");
  if (ren) {
    const col = pmCols.find((c) => c.id === ren.dataset.rename);
    const nom = await uiPrompt("Nom de la colonne", col?.name || "");
    if (!nom || !nom.trim()) return;
    await sb.from("pm_columns").update({ name: nom.trim() }).eq("id", ren.dataset.rename);
    return loadPM();
  }

  const del = e.target.closest("[data-delcol]");
  if (del) {
    const col = pmCols.find((c) => c.id === del.dataset.delcol);
    const n = pmCards.filter((c) => c.column_id === del.dataset.delcol).length;
    const ok = await uiModal(n
      ? `Supprimer « ${col?.name} » et ses ${n} carte(s) ? Cette action est définitive.`
      : `Supprimer la colonne « ${col?.name} » ?`, { confirm: true });
    if (!ok) return;
    await sb.from("pm_columns").delete().eq("id", del.dataset.delcol);
    return loadPM();
  }

  const fm = e.target.closest("[data-fm]");
  if (fm) { pmFiltre.membre = pmFiltre.membre === fm.dataset.fm ? null : fm.dataset.fm;
            pmRenderFiltres(); pmRenderBoard(); return; }
  const fl = e.target.closest("[data-fl]");
  if (fl) { pmFiltre.etiquette = pmFiltre.etiquette === fl.dataset.fl ? null : fl.dataset.fl;
            pmRenderFiltres(); pmRenderBoard(); return; }
  if (e.target.closest(".pm-f-raz")) { pmFiltre = { membre: null, etiquette: null };
                                       pmRenderFiltres(); pmRenderBoard(); return; }

  // Dans la fiche : les boutons de selection basculent.
  const pick = e.target.closest("#pm-modal .pm-pick");
  if (pick) { pick.classList.toggle("on"); return; }
});

// ---- Pieces jointes ----
// Stockees en base64 dans la table, comme celles de la messagerie. Le plafond
// evite qu'une video mette la fiche a genoux.
const PM_MAX_PJ = 5 * 1024 * 1024;
async function pmAjouterFichiers(fichiers) {
  if (!pmCarte) return;
  for (const f of fichiers) {
    if (f.size > PM_MAX_PJ) { await uiModal(`« ${f.name} » dépasse 5 Mo et n'a pas été ajouté.`); continue; }
    const b64 = await new Promise((ok) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(",")[1] || "");
      r.readAsDataURL(f);
    });
    const { error } = await sb.from("pm_attachments").insert({
      card_id: pmCarte.id, filename: f.name, content_type: f.type || null,
      size_bytes: f.size, content_b64: b64,
    });
    if (error) await uiModal("Ajout impossible : " + error.message);
  }
  await pmRenderFichiers();
  await loadPM();
}

document.addEventListener("click", async (e) => {
  if (e.target.closest("#pm-close")) return pmFermer();
  if (e.target.closest("#pm-save")) return pmEnregistrer();
  if (e.target.closest("#pm-file-btn")) return $("pm-file-input").click();

  const dl = e.target.closest("[data-dl]");
  if (dl) {
    const { data } = await sb.from("pm_attachments").select("*").eq("id", dl.dataset.dl).single();
    if (!data) return;
    const a = document.createElement("a");
    a.href = `data:${data.content_type || "application/octet-stream"};base64,${data.content_b64}`;
    a.download = data.filename;
    document.body.appendChild(a); a.click(); a.remove();
    return;
  }
  const rm = e.target.closest("[data-rmfile]");
  if (rm) {
    if (!(await uiModal("Retirer cette pièce jointe ?", { confirm: true }))) return;
    await sb.from("pm_attachments").delete().eq("id", rm.dataset.rmfile);
    await pmRenderFichiers(); return loadPM();
  }
  if (e.target.closest("#pm-delete")) {
    if (!pmCarte) return;
    if (!(await uiModal(`Supprimer « ${pmCarte.title} » ? Cette action est définitive.`, { confirm: true }))) return;
    await sb.from("pm_cards").delete().eq("id", pmCarte.id);
    pmFermer(); return loadPM();
  }

  // Ajouts depuis l'entete de la vue.
  if (e.target.closest("#pm-new-col")) {
    const nom = await uiPrompt("Nom de la nouvelle colonne");
    if (!nom || !nom.trim()) return;
    const rangs = pmCols.map((c) => c.sort_order);
    await sb.from("pm_columns").insert({ name: nom.trim(), sort_order: (rangs.length ? Math.max(...rangs) : 0) + 1 });
    return loadPM();
  }
  if (e.target.closest("#pm-new-member")) {
    const nom = await uiPrompt("Nom de la personne");
    if (!nom || !nom.trim()) return;
    // Initiales proposees a partir du nom, modifiables.
    const auto = nom.trim().split(/\s+/).map((x) => x[0] ?? "").join("").slice(0, 2).toUpperCase();
    const ini = (await uiPrompt("Initiales (2 lettres)", auto)) || auto;
    const coul = (await uiPrompt("Couleur (code hexadécimal)", "#073eb5")) || "#073eb5";
    const rangs = pmMembers.map((m) => m.sort_order);
    await sb.from("pm_members").insert({
      name: nom.trim(), initials: ini.trim().slice(0, 3).toUpperCase(),
      color: coul.trim(), sort_order: (rangs.length ? Math.max(...rangs) : 0) + 1 });
    return loadPM();
  }
  if (e.target.closest("#pm-new-label")) {
    const nom = await uiPrompt("Nom de l'étiquette");
    if (!nom || !nom.trim()) return;
    const coul = (await uiPrompt("Couleur (code hexadécimal)", "#4bbf73")) || "#4bbf73";
    const rangs = pmLabels.map((l) => l.sort_order);
    await sb.from("pm_labels").insert({ name: nom.trim(), color: coul.trim(),
      sort_order: (rangs.length ? Math.max(...rangs) : 0) + 1 });
    return loadPM();
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "pm-file-input" && e.target.files?.length) {
    pmAjouterFichiers([...e.target.files]);
    e.target.value = "";
  }
});

// ---- Liste de controle d'une carte ----
async function pmRenderCheck() {
  const z = $("pm-chk"); if (!z || !pmCarte) return;
  const { data } = await sb.from("pm_checklist")
    .select("*").eq("card_id", pmCarte.id).order("sort_order");
  const l = data || [];
  const faits = l.filter((x) => x.done).length;
  $("pm-chk-compte").textContent = l.length ? `${faits}/${l.length}` : "";
  z.innerHTML = l.length
    ? `<div class="pm-chk-barre"><span style="width:${l.length ? Math.round(faits / l.length * 100) : 0}%"></span></div>` +
      l.map((x) => `<label class="pm-chk-item${x.done ? " fait" : ""}">
        <input type="checkbox" data-chk="${x.id}"${x.done ? " checked" : ""} />
        <span>${esc(x.text)}</span>
        <button type="button" class="pm-chk-x" data-rmchk="${x.id}" title="Retirer">✕</button></label>`).join("")
    : '<p class="muted" style="margin:2px 0 6px;font-size:.85rem">Aucun point pour l’instant.</p>';
}

document.addEventListener("change", async (e) => {
  const c = e.target.closest("[data-chk]");
  if (!c) return;
  await sb.from("pm_checklist").update({ done: c.checked }).eq("id", c.dataset.chk);
  await pmRenderCheck();
  await loadPM();          // l'avancement change sur la carte du tableau
});

document.addEventListener("click", async (e) => {
  const rm = e.target.closest("[data-rmchk]");
  if (!rm) return;
  e.preventDefault();
  await sb.from("pm_checklist").delete().eq("id", rm.dataset.rmchk);
  await pmRenderCheck();
  await loadPM();
});

document.addEventListener("submit", async (e) => {
  if (e.target.id !== "pm-chk-form") return;
  e.preventDefault();
  if (!pmCarte) return;
  const champ = $("pm-chk-new");
  const texte = champ.value.trim();
  if (!texte) return;
  const { data } = await sb.from("pm_checklist").select("sort_order").eq("card_id", pmCarte.id);
  const rangs = (data || []).map((x) => x.sort_order);
  const { error } = await sb.from("pm_checklist").insert({
    card_id: pmCarte.id, text: texte,
    sort_order: (rangs.length ? Math.max(...rangs) : 0) + 1,
  });
  if (error) return uiModal("Ajout impossible : " + error.message);
  champ.value = "";
  champ.focus();           // on enchaine les points sans reprendre la souris
  await pmRenderCheck();
  await loadPM();
});

// ---- Insertion d'un lien dans un editeur de texte riche ----
// Le meme geste sert dans la messagerie (nouveau message et reponse) et dans la
// newsletter : on surligne un mot, on donne une adresse, le mot devient le lien.
// Sans selection, c'est l'adresse elle-meme qui est ecrite.
function urlPropre(v) {
  const s = String(v || "").trim();
  if (!s || s === "https://") return "";
  if (/^(https?:|mailto:|tel:)/i.test(s)) return s;
  // Une adresse e-mail saisie telle quelle devient un lien mailto.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "mailto:" + s;
  // Sinon on suppose le web : sans schema, le navigateur ferait un lien
  // relatif a la console, qui ne menerait nulle part.
  return "https://" + s.replace(/^\/+/, "");
}

function brancherLien(boutonId, editeurId) {
  const b = $(boutonId);
  if (!b || b.dataset.lienPret) return;
  b.dataset.lienPret = "1";
  b.addEventListener("mousedown", async (e) => {
    e.preventDefault();
    // La selection disparait des que la fenetre de saisie s'ouvre : on la
    // memorise avant, et on la retablit apres.
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const mot = range ? range.toString().trim() : "";
    const saisie = await uiPrompt(mot ? `Lien pour « ${mot} »` : "Adresse du lien", "https://");
    const url = urlPropre(saisie);
    if (!url) return;
    $(editeurId)?.focus();
    if (range) { sel.removeAllRanges(); sel.addRange(range); }
    const s2 = window.getSelection();
    if (s2 && !s2.isCollapsed) document.execCommand("createLink", false, url);
    else document.execCommand("insertHTML", false, `<a href="${esc(url)}">${esc(url)}</a>`);
  });
}

// ============================================================
//  Newsletter — editeur par blocs
//  Les blocs sont la source de verite ; le HTML envoye en est la compilation.
//  Contrainte de l'e-mail : pas de flexbox ni de grille, pas de feuille de
//  style externe. Tout passe par des tableaux et des styles en ligne, seule
//  mise en page que Outlook et Gmail rendent de la meme facon.
// ============================================================
const NL_LARGEUR = 552;          // 600 px de gabarit moins 24 px de marge de chaque cote

// Couleurs de la charte 2026 (« Court Colours »), les memes que le site.
const NL_C = {
  bleu: "#073eb5", encre: "#04205e", mint: "#b2fd13", mintEncre: "#14300a",
  prussien: "#003652", ocean: "#137297",
  texte: "#1a1f36", gris: "#69708a", ligne: "#e4e8f0", fond: "#f3f5fa",
};

// Polices de marque. Acumin Pro et Circe ne peuvent pas etre servies dans un
// e-mail : presque aucune messagerie ne charge de police distante, et Outlook
// n'en charge aucune. La charte prevoit justement Noto Sans comme repli
// officiel dans ce cas — d'ou ces piles, qui tentent la police de marque quand
// elle est installee sur le poste et retombent proprement sinon.
const NL_POLICE = "'Acumin Pro','Noto Sans',Helvetica,Arial,sans-serif";
const NL_POLICE_T = "Circe,'Noto Sans',Helvetica,Arial,sans-serif";

const NL_LOGO = "https://teamlausanne.ch/assets/logo-academie-blanc.png";

const NL_MODELES = {
  entete: { t: "entete", logo: NL_LOGO, fond: NL_C.bleu, trait: true },
  titre:  { t: "titre", texte: "Votre titre", align: "left", couleur: NL_C.encre, taille: 24 },
  texte:  { t: "texte", html: "Votre texte…", align: "left" },
  image:  { t: "image", src: "", alt: "", href: "", largeur: 100 },
  bouton: { t: "bouton", texte: "En savoir plus", href: "https://teamlausanne.ch",
            bg: NL_C.bleu, fg: "#ffffff", align: "center" },
  duo:    { t: "duo", src: "", alt: "", html: "Votre texte…", sens: "image-gauche" },
  bandeau: { t: "bandeau", texte: "CHF 490.–", sous: "Saison complète",
             bg: NL_C.mint, fg: NL_C.mintEncre },
  chiffres: { t: "chiffres", items: [ { n: "35", l: "semaines" },
                                      { n: "2h", l: "de tennis" },
                                      { n: "1h", l: "de physique" } ] },
  sep:    { t: "sep" },
  espace: { t: "espace", h: 24 },
  pied:   { t: "pied",
            html: "Team Lausanne Academy · Chemin du Stade 3, 1007 Lausanne<br />"
                + '<a href="https://teamlausanne.ch" style="color:#69708a">teamlausanne.ch</a> · '
                + '<a href="mailto:info@teamlausanne.ch" style="color:#69708a">info@teamlausanne.ch</a>' },
};
const NL_NOMS = { entete: "En-tête", titre: "Titre", texte: "Texte", image: "Image",
                  bouton: "Bouton", duo: "Image + texte", bandeau: "Bandeau",
                  chiffres: "Chiffres", sep: "Séparateur", espace: "Espace",
                  pied: "Pied de page" };

// --- Compilation d'un bloc en HTML d'e-mail ---
// Tableaux et styles en ligne uniquement : ni flexbox, ni grille, ni classe, ni
// balise <style>. Outlook ignore tout le reste et la mise en page s'effondrerait.
function nlBlocHtml(b) {
  const al = (x) => (x === "center" ? "center" : x === "right" ? "right" : "left");
  switch (b.t) {
    case "entete": {
      const fond = b.fond || NL_C.bleu;
      const logo = b.logo
        ? `<img src="${esc(b.logo)}" alt="Team Lausanne Academy" width="88" style="display:block;width:88px;max-width:88px;height:auto;border:0;margin:0 auto" />`
        : "";
      // Le filet mint sous le bandeau : un <td> de 4 px, pas une bordure — les
      // bordures fines sautent d'un client a l'autre.
      const trait = b.trait === false ? ""
        : `<tr><td bgcolor="${NL_C.mint}" style="height:4px;font-size:0;line-height:0">&nbsp;</td></tr>`;
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px">
        <tr><td align="center" bgcolor="${fond}" style="padding:26px 20px">${logo}</td></tr>${trait}</table>`;
    }
    case "titre":
      return `<h2 style="margin:0 0 14px;font-family:${NL_POLICE_T};font-size:${+b.taille || 24}px;line-height:1.25;color:${b.couleur || NL_C.encre};text-align:${al(b.align)};font-weight:700">${b.texte || ""}</h2>`;
    case "texte":
      return `<div style="margin:0 0 14px;font-family:${NL_POLICE};font-size:15px;line-height:1.6;color:${NL_C.texte};text-align:${al(b.align)}">${b.html || ""}</div>`;
    case "image": {
      if (!b.src) return "";
      const w = Math.round(NL_LARGEUR * Math.min(100, Math.max(10, +b.largeur || 100)) / 100);
      const img = `<img src="${esc(b.src)}" alt="${esc(b.alt || "")}" width="${w}" style="display:block;width:${w}px;max-width:100%;height:auto;border:0;border-radius:8px" />`;
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:0 0 14px">${b.href ? `<a href="${esc(b.href)}">${img}</a>` : img}</td></tr></table>`;
    }
    case "bouton":
      // Bouton en tableau : les <a> stylises sont ignores par Outlook.
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="${al(b.align)}" style="padding:4px 0 18px">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="${b.bg || NL_C.bleu}" style="border-radius:999px">
        <a href="${esc(b.href || "#")}" style="display:inline-block;padding:12px 26px;font-family:${NL_POLICE};font-size:15px;font-weight:700;color:${b.fg || "#ffffff"};text-decoration:none;border-radius:999px">${esc(b.texte || "")}</a>
        </td></tr></table></td></tr></table>`;
    case "duo": {
      const img = b.src
        ? `<img src="${esc(b.src)}" alt="${esc(b.alt || "")}" width="256" style="display:block;width:100%;max-width:256px;height:auto;border:0;border-radius:8px" />`
        : "";
      const txt = `<div style="font-family:${NL_POLICE};font-size:15px;line-height:1.6;color:${NL_C.texte}">${b.html || ""}</div>`;
      const a = b.sens === "image-droite" ? txt : img;
      const c = b.sens === "image-droite" ? img : txt;
      // width en pourcentage : les colonnes se serrent sur petit ecran plutot
      // que de deborder, sans dependre des media queries.
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px"><tr>
        <td width="48%" valign="top" style="padding:0 10px 0 0">${a}</td>
        <td width="52%" valign="top">${c}</td></tr></table>`;
    }
    case "bandeau": {
      // Bande de couleur pour un prix, une date, une accroche.
      const sous = b.sous
        ? `<div style="margin:4px 0 0;font-family:${NL_POLICE};font-size:14px;line-height:1.4;color:${b.fg || NL_C.mintEncre};opacity:.85">${esc(b.sous)}</div>`
        : "";
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px">
        <tr><td align="center" bgcolor="${b.bg || NL_C.mint}" style="padding:20px 18px;border-radius:10px">
        <div style="font-family:${NL_POLICE_T};font-size:26px;line-height:1.2;font-weight:700;color:${b.fg || NL_C.mintEncre}">${esc(b.texte || "")}</div>${sous}
        </td></tr></table>`;
    }
    case "chiffres": {
      const items = (b.items || []).slice(0, 4);
      if (!items.length) return "";
      const w = Math.floor(100 / items.length);
      const cell = (x) => `<td width="${w}%" align="center" valign="top" style="padding:0 6px">
        <div style="font-family:${NL_POLICE_T};font-size:30px;line-height:1.1;font-weight:700;color:${NL_C.bleu}">${esc(x.n || "")}</div>
        <div style="margin:4px 0 0;font-family:${NL_POLICE};font-size:13px;line-height:1.4;color:${NL_C.gris}">${esc(x.l || "")}</div></td>`;
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px"><tr>${items.map(cell).join("")}</tr></table>`;
    }
    case "sep":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:6px 0 18px"><div style="border-top:1px solid ${NL_C.ligne};font-size:0;line-height:0">&nbsp;</div></td></tr></table>`;
    case "espace":
      return `<div style="height:${+b.h || 24}px;font-size:0;line-height:0">&nbsp;</div>`;
    case "pied":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:14px 0 0">
        <tr><td style="padding:16px 0 0;border-top:1px solid ${NL_C.ligne}">
        <div style="font-family:${NL_POLICE};font-size:12px;line-height:1.6;color:${NL_C.gris};text-align:center">${b.html || ""}</div>
        </td></tr></table>`;
    default: return "";
  }
}
const nlCompiler = (blocs) => (blocs || []).map(nlBlocHtml).join("\n");


// --- Modeles prets a l'emploi ---
// Chaque modele est une simple liste de blocs : rien de fige, tout se modifie
// ensuite comme une composition faite a la main. Les couleurs viennent de
// NL_C, donc un changement de charte se repercute partout d'un coup.
const NL_GABARITS = [
  {
    id: "actus", nom: "Actualités du club",
    desc: "En-tête, édito, deux actualités en image + texte, bouton.",
    blocs: () => [
      { t: "entete", logo: NL_LOGO, fond: NL_C.bleu, trait: true },
      { t: "titre", texte: "Les nouvelles de l’Academy", align: "left", couleur: NL_C.encre, taille: 26 },
      { t: "texte", align: "left",
        html: "Bonjour,<br />Voici ce qui se passe au club ce mois-ci — les résultats, les prochaines dates et quelques nouvelles de nos équipes." },
      { t: "sep" },
      { t: "duo", src: "", alt: "", sens: "image-gauche",
        html: "<b>Première actualité</b><br />Quelques lignes pour raconter ce qui s’est passé, avec une photo à gauche." },
      { t: "duo", src: "", alt: "", sens: "image-droite",
        html: "<b>Deuxième actualité</b><br />Et une seconde, image à droite pour aérer la lecture." },
      { t: "bouton", texte: "Lire la suite", href: "https://teamlausanne.ch",
        bg: NL_C.bleu, fg: "#ffffff", align: "center" },
      { t: "pied", html: NL_MODELES.pied.html },
    ],
  },
  {
    id: "stage", nom: "Stage / camp",
    desc: "Photo pleine largeur, dates en chiffres, prix en bandeau mint, inscription.",
    blocs: () => [
      { t: "entete", logo: NL_LOGO, fond: NL_C.bleu, trait: true },
      { t: "titre", texte: "Stages d’automne", align: "center", couleur: NL_C.encre, taille: 28 },
      { t: "texte", align: "center",
        html: "Une semaine de tennis, de jeux et de progrès, encadrée par nos coachs." },
      { t: "image", src: "", alt: "", href: "", largeur: 100 },
      { t: "chiffres", items: [ { n: "5", l: "jours" }, { n: "4h", l: "par jour" }, { n: "6-16", l: "ans" } ] },
      { t: "bandeau", texte: "CHF 390.–", sous: "La semaine, repas de midi inclus",
        bg: NL_C.mint, fg: NL_C.mintEncre },
      { t: "bouton", texte: "Inscrire mon enfant", href: "https://teamlausanne.ch/stages.html",
        bg: NL_C.bleu, fg: "#ffffff", align: "center" },
      { t: "pied", html: NL_MODELES.pied.html },
    ],
  },
  {
    id: "event", nom: "Invitation à un événement",
    desc: "En-tête prussien, date en bandeau, programme, bouton d’inscription.",
    blocs: () => [
      { t: "entete", logo: NL_LOGO, fond: NL_C.prussien, trait: true },
      { t: "titre", texte: "Vous êtes invités", align: "center", couleur: NL_C.encre, taille: 28 },
      { t: "bandeau", texte: "Samedi 18 octobre", sous: "Dès 14h00 · Courts de Vidy",
        bg: NL_C.prussien, fg: "#ffffff" },
      { t: "texte", align: "left",
        html: "Le programme de la journée :<ul><li>14h00 — accueil</li><li>15h00 — animations</li><li>18h00 — apéritif</li></ul>" },
      { t: "bouton", texte: "Je m’inscris", href: "https://teamlausanne.ch",
        bg: NL_C.bleu, fg: "#ffffff", align: "center" },
      { t: "pied", html: NL_MODELES.pied.html },
    ],
  },
  {
    id: "resultats", nom: "Résultats & performances",
    desc: "Chiffres de la saison, portraits de joueurs, mot de la fin.",
    blocs: () => [
      { t: "entete", logo: NL_LOGO, fond: NL_C.bleu, trait: true },
      { t: "titre", texte: "Les résultats du mois", align: "left", couleur: NL_C.encre, taille: 26 },
      { t: "chiffres", items: [ { n: "12", l: "tournois" }, { n: "34", l: "victoires" }, { n: "5", l: "titres" } ] },
      { t: "sep" },
      { t: "duo", src: "", alt: "", sens: "image-gauche",
        html: "<b>Nom du joueur</b><br />Classement, tournoi gagné, et une phrase sur sa performance." },
      { t: "duo", src: "", alt: "", sens: "image-gauche",
        html: "<b>Nom du joueur</b><br />Classement, tournoi gagné, et une phrase sur sa performance." },
      { t: "texte", align: "left", html: "Bravo à toutes et à tous — et rendez-vous le mois prochain." },
      { t: "pied", html: NL_MODELES.pied.html },
    ],
  },
  {
    id: "simple", nom: "Message simple",
    desc: "L’essentiel : en-tête, un titre, un texte, une signature.",
    blocs: () => [
      { t: "entete", logo: NL_LOGO, fond: NL_C.bleu, trait: true },
      { t: "titre", texte: "Une information importante", align: "left", couleur: NL_C.encre, taille: 24 },
      { t: "texte", align: "left", html: "Bonjour,<br /><br />Votre message ici.<br /><br />Sportivement,<br />L’équipe Team Lausanne Academy" },
      { t: "pied", html: NL_MODELES.pied.html },
    ],
  },
];

function nlRenderGabarits() {
  const z = $("nl-gabarits"); if (!z) return;
  z.innerHTML = NL_GABARITS.map((g) => `<button type="button" class="nl-gab" data-gab="${g.id}" title="${esc(g.desc)}">
      <span class="nl-gab-apercu">${nlApercuGabarit(g)}</span>
      <span class="nl-gab-nom">${esc(g.nom)}</span></button>`).join("");
}

// Petit croquis du modele : quelques barres qui evoquent sa structure. Plus
// lisible qu'une miniature du HTML reel, qui serait illisible a cette taille.
function nlApercuGabarit(g) {
  return g.blocs().slice(0, 7).map((b) => {
    if (b.t === "entete") return `<i style="height:9px;background:${b.fond}"></i>`;
    if (b.t === "titre") return `<i style="height:5px;width:70%;background:${NL_C.encre}"></i>`;
    if (b.t === "bandeau") return `<i style="height:8px;background:${b.bg}"></i>`;
    if (b.t === "image") return `<i style="height:12px;background:#c9d3e6"></i>`;
    if (b.t === "bouton") return `<i style="height:5px;width:42%;margin:0 auto;background:${b.bg};border-radius:9px"></i>`;
    if (b.t === "duo") return `<i style="height:7px;background:linear-gradient(90deg,#c9d3e6 46%,#e8ecf4 46%)"></i>`;
    if (b.t === "chiffres") return `<i style="height:6px;background:linear-gradient(90deg,${NL_C.bleu} 30%,transparent 30% 35%,${NL_C.bleu} 35% 65%,transparent 65% 70%,${NL_C.bleu} 70%)"></i>`;
    if (b.t === "sep") return `<i style="height:1px;background:#d6dceb"></i>`;
    return `<i style="height:3px;background:#e2e7f1"></i>`;
  }).join("");
}

// --- Etat de l'editeur ---

let nlBlocs = [];
let nlSel = -1;            // index du bloc selectionne

function nlRender() {
  const toile = $("nl-toile"); if (!toile) return;
  toile.innerHTML = nlBlocs.length
    ? nlBlocs.map((b, i) => `<div class="nl-bloc${i === nlSel ? " sel" : ""}" data-bloc="${i}">
        <div class="nl-bloc-outils">
          <span class="nl-bloc-nom">${esc(NL_NOMS[b.t] || b.t)}</span>
          <button type="button" data-up="${i}" title="Monter"${i === 0 ? " disabled" : ""}>↑</button>
          <button type="button" data-down="${i}" title="Descendre"${i === nlBlocs.length - 1 ? " disabled" : ""}>↓</button>
          <button type="button" data-dup="${i}" title="Dupliquer">⧉</button>
          <button type="button" data-del="${i}" title="Supprimer">✕</button>
        </div>
        <div class="nl-bloc-vue">${nlBlocHtml(b) || '<span class="muted">Bloc vide — complétez-le à droite.</span>'}</div>
      </div>`).join("")
    : '<p class="muted nl-vide">Ajoutez un bloc pour commencer : titre, texte, image, bouton…</p>';
  nlRenderInspecteur();
  nlSync();
}

// Le HTML compile est garde a jour dans le champ cache : l'envoi et
// l'enregistrement continuent de lire newsletters.html sans rien savoir des blocs.
function nlSync() { const c = $("nl-body"); if (c) c.innerHTML = nlCompiler(nlBlocs); }

function nlRenderInspecteur() {
  const z = $("nl-insp"); if (!z) return;
  const b = nlBlocs[nlSel];
  if (!b) { z.innerHTML = '<p class="muted">Cliquez un bloc pour le modifier.</p>'; return; }
  const champ = (lab, html) => `<label class="nl-champ"><span>${lab}</span>${html}</label>`;
  const align = (v) => `<select data-f="align">
    <option value="left"${v === "left" ? " selected" : ""}>Gauche</option>
    <option value="center"${v === "center" ? " selected" : ""}>Centré</option>
    <option value="right"${v === "right" ? " selected" : ""}>Droite</option></select>`;
  let html = `<h4 class="nl-insp-titre">${esc(NL_NOMS[b.t] || b.t)}</h4>`;
  if (b.t === "titre") {
    html += champ("Texte", `<input type="text" data-f="texte" value="${esc(b.texte || "")}" />`)
         +  champ("Alignement", align(b.align))
         +  champ("Taille (px)", `<input type="number" data-f="taille" min="14" max="40" value="${+b.taille || 24}" />`)
         +  champ("Couleur", `<input type="color" data-f="couleur" value="${esc(b.couleur || "#04205e")}" />`);
  } else if (b.t === "texte") {
    html += champ("Contenu", `<div class="rt-edit nl-rich" contenteditable="true" data-f="html">${b.html || ""}</div>`)
         +  `<div class="nl-rich-outils">
              <button type="button" class="rt-btn" data-rt="bold"><b>G</b></button>
              <button type="button" class="rt-btn" data-rt="italic"><i>I</i></button>
              <button type="button" class="rt-btn" data-rt="insertUnorderedList">•</button>
              <button type="button" class="rt-btn" id="nl-bloc-link" title="Insérer un lien">🔗</button>
            </div>`
         +  champ("Alignement", align(b.align));
  } else if (b.t === "image") {
    html += champ("Image", `<div class="nl-img-zone">
              <input type="text" data-f="src" placeholder="https://… ou importez" value="${esc(b.src || "")}" />
              <button type="button" id="nl-img-up" class="ghost">Importer</button>
              <input type="file" id="nl-img-file" accept="image/*" hidden /></div>`)
         +  champ("Texte alternatif", `<input type="text" data-f="alt" value="${esc(b.alt || "")}" />`)
         +  champ("Lien au clic", `<input type="text" data-f="href" placeholder="https://…" value="${esc(b.href || "")}" />`)
         +  champ("Largeur (%)", `<input type="range" data-f="largeur" min="25" max="100" value="${+b.largeur || 100}" />`);
  } else if (b.t === "bouton") {
    html += champ("Libellé", `<input type="text" data-f="texte" value="${esc(b.texte || "")}" />`)
         +  champ("Lien", `<input type="text" data-f="href" value="${esc(b.href || "")}" />`)
         +  champ("Alignement", align(b.align))
         +  champ("Fond", `<input type="color" data-f="bg" value="${esc(b.bg || "#073eb5")}" />`)
         +  champ("Texte", `<input type="color" data-f="fg" value="${esc(b.fg || "#ffffff")}" />`);
  } else if (b.t === "duo") {
    html += champ("Image", `<div class="nl-img-zone">
              <input type="text" data-f="src" placeholder="https://… ou importez" value="${esc(b.src || "")}" />
              <button type="button" id="nl-img-up" class="ghost">Importer</button>
              <input type="file" id="nl-img-file" accept="image/*" hidden /></div>`)
         +  champ("Texte", `<div class="rt-edit nl-rich" contenteditable="true" data-f="html">${b.html || ""}</div>`)
         +  champ("Disposition", `<select data-f="sens">
              <option value="image-gauche"${b.sens !== "image-droite" ? " selected" : ""}>Image à gauche</option>
              <option value="image-droite"${b.sens === "image-droite" ? " selected" : ""}>Image à droite</option></select>`);
  } else if (b.t === "espace") {
    html += champ("Hauteur (px)", `<input type="range" data-f="h" min="8" max="80" value="${+b.h || 24}" />`);
  } else if (b.t === "entete") {
    html += champ("Logo (URL)", `<div class="nl-img-zone">
              <input type="text" data-f="logo" value="${esc(b.logo || "")}" />
              <button type="button" id="nl-img-up" class="ghost">Importer</button>
              <input type="file" id="nl-img-file" accept="image/*" hidden /></div>`)
         +  champ("Fond", `<input type="color" data-f="fond" value="${esc(b.fond || NL_C.bleu)}" />`)
         +  champ("Filet mint", `<select data-f="trait">
              <option value="oui"${b.trait !== false ? " selected" : ""}>Oui</option>
              <option value="non"${b.trait === false ? " selected" : ""}>Non</option></select>`);
  } else if (b.t === "bandeau") {
    html += champ("Texte", `<input type="text" data-f="texte" value="${esc(b.texte || "")}" />`)
         +  champ("Sous-titre", `<input type="text" data-f="sous" value="${esc(b.sous || "")}" />`)
         +  champ("Fond", `<input type="color" data-f="bg" value="${esc(b.bg || NL_C.mint)}" />`)
         +  champ("Texte", `<input type="color" data-f="fg" value="${esc(b.fg || NL_C.mintEncre)}" />`);
  } else if (b.t === "chiffres") {
    // Une ligne de reglages par chiffre : le nombre et son libelle.
    const items = b.items || [];
    html += items.map((x, i) => `<div class="nl-chiffre">
        <input type="text" data-chn="${i}" value="${esc(x.n || "")}" placeholder="35" />
        <input type="text" data-chl="${i}" value="${esc(x.l || "")}" placeholder="semaines" />
        <button type="button" data-chdel="${i}" title="Retirer">✕</button></div>`).join("")
      + (items.length < 4 ? `<button type="button" id="nl-ch-add" class="ghost nl-ch-add">+ Ajouter un chiffre</button>` : "");
  } else if (b.t === "pied") {
    html += champ("Contenu", `<div class="rt-edit nl-rich" contenteditable="true" data-f="html">${b.html || ""}</div>`)
         +  `<div class="nl-rich-outils">
              <button type="button" class="rt-btn" data-rt="bold"><b>G</b></button>
              <button type="button" class="rt-btn" id="nl-bloc-link" title="Insérer un lien">🔗</button>
            </div>`;
  } else {
    html += '<p class="muted">Ce bloc n’a pas de réglage.</p>';
  }
  z.innerHTML = html;
  brancherLien("nl-bloc-link", null);
}

// --- Interactions de l'editeur ---
document.addEventListener("click", async (e) => {
  const pal = e.target.closest("[data-nlnew]");
  if (pal) {
    const modele = NL_MODELES[pal.dataset.nlnew];
    if (!modele) return;
    const bloc = JSON.parse(JSON.stringify(modele));
    const ou = nlSel >= 0 ? nlSel + 1 : nlBlocs.length;
    nlBlocs.splice(ou, 0, bloc); nlSel = ou; nlRender(); return;
  }
  const sel = e.target.closest("[data-bloc]");
  if (sel && !e.target.closest(".nl-bloc-outils")) { nlSel = +sel.dataset.bloc; nlRender(); return; }

  const up = e.target.closest("[data-up]");
  if (up) { const i = +up.dataset.up; if (i > 0) { [nlBlocs[i - 1], nlBlocs[i]] = [nlBlocs[i], nlBlocs[i - 1]]; nlSel = i - 1; nlRender(); } return; }
  const dn = e.target.closest("[data-down]");
  if (dn) { const i = +dn.dataset.down; if (i < nlBlocs.length - 1) { [nlBlocs[i + 1], nlBlocs[i]] = [nlBlocs[i], nlBlocs[i + 1]]; nlSel = i + 1; nlRender(); } return; }
  const du = e.target.closest("[data-dup]");
  if (du) { const i = +du.dataset.dup; nlBlocs.splice(i + 1, 0, JSON.parse(JSON.stringify(nlBlocs[i]))); nlSel = i + 1; nlRender(); return; }
  const de = e.target.closest("[data-del]");
  if (de) { const i = +de.dataset.del; nlBlocs.splice(i, 1); nlSel = Math.min(nlSel, nlBlocs.length - 1); nlRender(); return; }

  const rt = e.target.closest("[data-rt]");
  if (rt) { e.preventDefault(); document.execCommand(rt.dataset.rt, false, null); return; }
  if (e.target.closest("#nl-img-up")) { $("nl-img-file")?.click(); return; }

  // Modeles prets a l'emploi. On previent : le contenu en cours sera remplace.
  const gab = e.target.closest("[data-gab]");
  if (gab) {
    const g = NL_GABARITS.find((x) => x.id === gab.dataset.gab);
    if (!g) return;
    if (nlBlocs.length && !(await uiConfirm(
      `Charger le modèle « ${g.nom} » ? Le contenu en cours sera remplacé.`))) return;
    nlBlocs = g.blocs();
    nlSel = 0; nlRender();
    $("nl-toile")?.scrollTo({ top: 0 });
    return;
  }

  // Chiffres : ajouter ou retirer une colonne.
  if (e.target.closest("#nl-ch-add")) {
    const b = nlBlocs[nlSel]; if (!b) return;
    (b.items = b.items || []).push({ n: "", l: "" }); nlRender(); return;
  }
  const chd = e.target.closest("[data-chdel]");
  if (chd) {
    const b = nlBlocs[nlSel]; if (!b?.items) return;
    b.items.splice(+chd.dataset.chdel, 1); nlRender(); return;
  }
});


// Les reglages s'appliquent a la frappe : le rendu suit sans bouton a presser.
document.addEventListener("input", (e) => {
  const f = e.target.closest("#nl-insp [data-f]");
  if (!f || nlSel < 0) return;
  const b = nlBlocs[nlSel]; if (!b) return;
  const cle = f.dataset.f;
  b[cle] = f.isContentEditable ? f.innerHTML : f.value;
  // Le bloc de saisie ne doit pas etre redessine pendant qu'on y ecrit :
  // le curseur sauterait au debut a chaque touche.
  if (f.isContentEditable) { nlApercuSeul(); return; }
  nlRender();
});

// Les deux champs d'un chiffre (le nombre et son libelle) ne passent pas par
// data-f : ils visent une case du tableau items.
document.addEventListener("input", (e) => {
  const n = e.target.closest("#nl-insp [data-chn]");
  const l = e.target.closest("#nl-insp [data-chl]");
  if (!n && !l) return;
  const b = nlBlocs[nlSel]; if (!b?.items) return;
  const el = n || l;
  const i = +(n ? el.dataset.chn : el.dataset.chl);
  if (!b.items[i]) return;
  b.items[i][n ? "n" : "l"] = el.value;
  // On redessine la seule vue : reconstruire l'inspecteur ferait perdre le focus.
  nlApercuSeul();
});

document.addEventListener("change", (e) => {
  const f = e.target.closest("#nl-insp select[data-f]");
  if (!f || nlSel < 0 || !nlBlocs[nlSel]) return;
  // Le filet de l'en-tete est un booleen : un <select> rend « oui »/« non ».
  nlBlocs[nlSel][f.dataset.f] = f.dataset.f === "trait" ? f.value === "oui" : f.value;
  nlRender();
});

// Redessine la seule vue du bloc courant, en laissant l'inspecteur intact.
function nlApercuSeul() {
  const vue = document.querySelector(`.nl-bloc[data-bloc="${nlSel}"] .nl-bloc-vue`);
  if (vue) vue.innerHTML = nlBlocHtml(nlBlocs[nlSel]) || "";
  nlSync();
}

// --- Import d'une image ---
document.addEventListener("change", async (e) => {
  if (e.target.id !== "nl-img-file" || !e.target.files?.length) return;
  const f = e.target.files[0];
  e.target.value = "";
  if (f.size > 5 * 1024 * 1024) return uiModal("Image trop lourde : 5 Mo au maximum.");
  const nom = `${Date.now()}-${f.name.replace(/[^\w.-]+/g, "-")}`;
  const { error } = await sb.storage.from("newsletter").upload(nom, f, { contentType: f.type, upsert: false });
  if (error) return uiModal("Import impossible : " + error.message);
  const { data } = sb.storage.from("newsletter").getPublicUrl(nom);
  const b = nlBlocs[nlSel];
  if (!b) return;
  // L'en-tete range son image dans « logo », les autres blocs dans « src ».
  b[b.t === "entete" ? "logo" : "src"] = data.publicUrl;
  nlRender();
});

// --- Chargement / enregistrement ---
// Une newsletter d'avant l'editeur n'a pas de blocs : son HTML devient un bloc
// de texte, pour que rien ne soit perdu.
function nlChargerBlocs(n) {
  nlRenderGabarits();
  if (Array.isArray(n?.blocks) && n.blocks.length) nlBlocs = n.blocks;
  else if (n?.html?.trim()) nlBlocs = [{ t: "texte", html: n.html, align: "left" }];
  else nlBlocs = [];
  nlSel = nlBlocs.length ? 0 : -1;
  nlRender();
}
