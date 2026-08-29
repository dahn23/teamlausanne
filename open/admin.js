// =====================================================================
//  LAUSANNE OPEN — Backend (accès par mot de passe, sans compte)
//  Le mot de passe n'est jamais stocké en clair côté base : il est
//  vérifié par la fonction lo_admin() (hash bcrypt). Ici on le garde
//  uniquement en sessionStorage, le temps de l'onglet du navigateur.
// =====================================================================
import { sb } from "./sb.js";
import { svg, ico, big } from "./icons.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janv.", "févr.", "mars", "avril", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const toDate = (s) => new Date(String(s).slice(0, 10) + "T00:00:00");
const frJour = (s) => { const d = toDate(s); return `${DAYS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => iso(new Date());
const demain = () => { const d = new Date(); d.setDate(d.getDate() + 1); return iso(d); };
const hhmm = (t) => String(t || "").slice(0, 5);
const frDateTime = (s) => {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
// datetime-local <-> ISO (le navigateur travaille en heure locale, c'est ce qu'on veut)
const toLocalInput = (s) => {
  if (!s) return "";
  const d = new Date(s);
  return `${iso(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

let PWD = sessionStorage.getItem("lo_pwd") || "";

async function api(action, payload = {}) {
  const { data, error } = await sb.rpc("lo_admin", { p_pwd: PWD, p_action: action, p_payload: payload });
  if (error) throw new Error(error.message);
  return data;
}
async function apiFees(action, payload = {}) {
  const { data, error } = await sb.rpc("lo_admin_fees", { p_pwd: PWD, p_action: action, p_payload: payload });
  if (error) throw new Error(error.message);
  return data;
}

async function apiPaella(action, payload = {}) {
  const { data, error } = await sb.rpc("lo_admin_paella", { p_pwd: PWD, p_action: action, p_payload: payload });
  if (error) throw new Error(error.message);
  return data;
}

async function apiStats() {
  const { data, error } = await sb.rpc("lo_stats", { p_pwd: PWD });
  if (error) throw new Error(error.message);
  return data;
}

async function apiList(what) {
  const { data, error } = await sb.rpc("lo_admin_list", { p_pwd: PWD, p_what: what });
  if (error) throw new Error(error.message);
  return data || [];
}

/* ============================================================ accès */
$("gate-form").onsubmit = async (e) => {
  e.preventDefault();
  PWD = $("pwd").value;
  $("gate-err").textContent = "";
  try {
    await api("check");
    sessionStorage.setItem("lo_pwd", PWD);
    open_();
  } catch (err) { $("gate-err").textContent = err.message; PWD = ""; }
};

$("logout").onclick = () => { sessionStorage.removeItem("lo_pwd"); location.reload(); };

function open_() {
  $("gate").classList.add("hidden");
  $("app").classList.remove("hidden");
  renderTabs();
  window.addEventListener("hashchange", route);
  route();
}

if (PWD) api("check").then(open_).catch(() => { sessionStorage.removeItem("lo_pwd"); PWD = ""; });

/* ========================================================== onglets */
const SECTIONS = [
  { id: "acces",     label: `${svg("lock")}Onglets` },
  { id: "infos",     label: `${svg("megaphone")}Infos officielles` },
  { id: "navette",   label: `${svg("bus")}Navette` },
  { id: "resto",     label: `${svg("utensils")}Restaurant` },
  { id: "hotel",     label: `${svg("bed")}Hôtel` },
  { id: "oop",       label: `${svg("clipboard")}Order of play` },
  { id: "practice",  label: `${svg("racket")}Practice` },
  { id: "fees",      label: `${svg("medal")}Paiements` },
  { id: "murs",      label: `${svg("chat")}Sparring / Roommate` },
  { id: "paella",    label: `${svg("utensils")}Paella` },
  { id: "stats",     label: `${svg("trend")}Fréquentation` },
  { id: "reglages",  label: `${svg("gear")}Réglages` },
];
let cur = "acces";

function renderTabs() {
  $("tabs").innerHTML = SECTIONS.map((s) =>
    `<button class="lo-tab" data-tab="${s.id}">${s.label}</button>`).join("");
  $("tabs").onclick = (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) location.hash = "#" + b.dataset.tab;
  };
}
function route() {
  const want = (location.hash || "").replace("#", "") || "acces";
  cur = SECTIONS.some((s) => s.id === want) ? want : "acces";
  document.querySelectorAll(".lo-tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === cur));
  window.scrollTo(0, 0);
  const v = $("view");
  v.onclick = null;
  v.innerHTML = `<span class="spin"></span>`;
  ({ acces: vAcces, infos: vInfos, navette: vNavette, resto: vResto, hotel: vHotel,
     oop: vOop, practice: vPractice, fees: vFees, murs: vMurs, stats: vStats,
     paella: vPaella, reglages: vReglages }[cur])(v);
}

/* petit utilitaire : exécute une action puis re-rend la section */
async function run(fn) {
  try { await fn(); route(); }
  catch (e) { alert(e.message); }
}

/* =================================================== ONGLETS BLOQUÉS */
const TAB_LABELS = {
  welcome: ["Welcome", "Infos sur Lausanne, la Suisse, le club, l'académie, le tournoi"],
  info: ["Official info", "Le canal de messages officiels"],
  logistics: ["Hotel & Food", "Hôtel, navette et restaurant"],
  oop: ["Order of play", "Le PDF du jour"],
  practice: ["Practice", "Réservation des courts d'entraînement"],
  sparring: ["Sparring", "Le mur « je cherche un sparring »"],
  roommate: ["Roommate", "Le mur « je cherche un roommate »"],
};

async function vAcces(v) {
  const { data } = await sb.from("lo_settings").select("value").eq("key", "tabs").single();
  const tabs = (data && data.value) || {};
  v.innerHTML = `
    <h2 class="lo-h2">Onglets de l'app joueurs</h2>
    <p class="hint">Un onglet désactivé disparaît complètement de l'app : personne ne peut ni le voir,
       ni y écrire. Pratique pour ouvrir « Practice » seulement quand le planning est prêt.</p>
    ${Object.keys(TAB_LABELS).map((k) => `
      <div class="toggle">
        <div><b>${TAB_LABELS[k][0]}</b><small>${TAB_LABELS[k][1]}</small></div>
        <label class="sw"><input type="checkbox" data-tab="${k}" ${tabs[k] !== false ? "checked" : ""} /><i></i></label>
      </div>`).join("")}`;
  v.onclick = async (e) => {
    const c = e.target.closest("input[data-tab]");
    if (!c) return;
    const next = { ...tabs, [c.dataset.tab]: c.checked };
    try { await api("setting_set", { key: "tabs", value: next }); tabs[c.dataset.tab] = c.checked; }
    catch (err) { alert(err.message); c.checked = !c.checked; }
  };
}

/* ================================================ INFOS OFFICIELLES */
async function vInfos(v) {
  const { data } = await sb.from("lo_messages").select("*")
    .order("pinned", { ascending: false }).order("created_at", { ascending: false });
  const list = data || [];
  v.innerHTML = `
    <h2 class="lo-h2">Infos officielles</h2>
    <p class="hint">Ces messages s'affichent aux joueurs dans l'onglet « Official info », le plus récent en haut.
       L'app des joueurs se rafraîchit toute seule chaque minute. <b>Écris en anglais.</b></p>
    <button class="btn block" id="add" style="margin-bottom:18px">+ Nouveau message</button>
    ${list.length ? list.map((m) => `
      <div class="adm-row">
        <div class="grow">
          <b>${m.pinned ? svg("pin", "mk") : ""}${m.level !== "info" ? svg("alert", "mk " + m.level) : ""}${esc(m.title || "(sans titre)")}</b>
          <small>${esc(m.body)}</small>
          <small style="margin-top:5px;opacity:.6">${frDateTime(m.created_at)}</small>
        </div>
        <div class="adm-actions">
          <button class="btn ghost" data-edit="${m.id}">${svg("pencil")}</button>
          <button class="btn danger" data-del="${m.id}">${svg("trash")}</button>
        </div>
      </div>`).join("") : `<div class="empty">Aucun message publié.</div>`}`;

  const form = (m = {}) => sheet(m.id ? "Modifier le message" : "Nouveau message", `
    <label class="f">Titre (optionnel)<input id="f-title" value="${esc(m.title || "")}" placeholder="Rain delay" /></label>
    <label class="f">Message<textarea id="f-body" placeholder="Play is suspended until 14:00...">${esc(m.body || "")}</textarea></label>
    <label class="f">Niveau
      <select id="f-level">
        <option value="info">Info</option>
        <option value="warning" ${m.level === "warning" ? "selected" : ""}>Important (orange)</option>
        <option value="urgent" ${m.level === "urgent" ? "selected" : ""}>Urgent (rouge)</option>
      </select></label>
    <div class="toggle" style="margin-top:4px"><div><b>Épingler en haut</b></div>
      <label class="sw"><input type="checkbox" id="f-pin" ${m.pinned ? "checked" : ""} /><i></i></label></div>`,
    async () => {
      const body = $("f-body").value.trim();
      if (!body) { alert("Le message est vide."); return false; }
      await api("msg_save", { id: m.id ?? null, title: $("f-title").value.trim(), body,
        level: $("f-level").value, pinned: $("f-pin").checked });
      route();
    });

  $("add").onclick = () => form();
  v.onclick = (e) => {
    const ed = e.target.closest("[data-edit]");
    if (ed) return form(list.find((m) => m.id === Number(ed.dataset.edit)));
    const dl = e.target.closest("[data-del]");
    if (dl && confirm("Supprimer ce message ?")) run(() => api("msg_del", { id: Number(dl.dataset.del) }));
  };
}

/* ============================================================ NAVETTE */
async function vNavette(v) {
  const { data } = await sb.from("lo_shuttle").select("*")
    .order("day", { ascending: true, nullsFirst: true }).order("sort").order("dep_time");
  const list = data || [];
  v.innerHTML = `
    <h2 class="lo-h2">Navette</h2>
    <p class="hint">Laisse la date vide pour un horaire valable <b>tous les jours</b>. Les horaires passés
       disparaissent automatiquement de l'app des joueurs.</p>
    <button class="btn block" id="add" style="margin-bottom:18px">+ Nouvel horaire</button>
    ${list.length ? list.map((s) => `
      <div class="adm-row">
        <div class="grow">
          <b>${hhmm(s.dep_time)} — ${esc(s.from_place || "?")} → ${esc(s.to_place || "?")}</b>
          <small>${s.day ? frJour(s.day) : "Tous les jours"}${s.note ? ` · ${esc(s.note)}` : ""}</small>
        </div>
        <div class="adm-actions">
          <button class="btn ghost" data-edit="${s.id}">${svg("pencil")}</button>
          <button class="btn danger" data-del="${s.id}">${svg("trash")}</button>
        </div>
      </div>`).join("") : `<div class="empty">Aucun horaire de navette.</div>`}`;

  const form = (s = {}) => sheet(s.id ? "Modifier l'horaire" : "Nouvel horaire", `
    <div class="grid2">
      <label class="f">Date (vide = tous les jours)<input type="date" id="f-day" value="${esc(s.day || "")}" /></label>
      <label class="f">Heure de départ<input type="time" id="f-time" value="${hhmm(s.dep_time) || "08:00"}" /></label>
    </div>
    <div class="grid2">
      <label class="f">Départ de<input id="f-from" value="${esc(s.from_place || "")}" placeholder="Hotel ibis" /></label>
      <label class="f">Arrivée à<input id="f-to" value="${esc(s.to_place || "")}" placeholder="Tennis Club" /></label>
    </div>
    <label class="f">Remarque (optionnel)<input id="f-note" value="${esc(s.note || "")}" placeholder="Minibus 8 places" /></label>`,
    async () => {
      await api("shuttle_save", { id: s.id ?? null, day: $("f-day").value, dep_time: $("f-time").value,
        from_place: $("f-from").value.trim(), to_place: $("f-to").value.trim(), note: $("f-note").value.trim(), sort: 0 });
      route();
    });

  $("add").onclick = () => form();
  v.onclick = (e) => {
    const ed = e.target.closest("[data-edit]");
    if (ed) return form(list.find((s) => s.id === Number(ed.dataset.edit)));
    const dl = e.target.closest("[data-del]");
    if (dl && confirm("Supprimer cet horaire ?")) run(() => api("shuttle_del", { id: Number(dl.dataset.del) }));
  };
}

/* ========================================================= RESTAURANT */
async function vResto(v) {
  const [{ data: menu }, { data: st }] = await Promise.all([
    sb.from("lo_menu").select("*").order("sort").order("id"),
    sb.from("lo_settings").select("value").eq("key", "restaurant").single(),
  ]);
  const list = menu || [];
  const s = (st && st.value) || {};
  v.innerHTML = `
    <h2 class="lo-h2">Restaurant</h2>
    <div class="sec-title">Le restaurant</div>
    <div class="card">
      <label class="f">Nom<input id="r-name" value="${esc(s.name || "")}" /></label>
      <label class="f">Adresse<input id="r-addr" value="${esc(s.address || "")}" /></label>
      <label class="f">Note affichée aux joueurs â <b>laisse vide</b> pour la version traduite automatiquement
        <textarea id="r-note" placeholder="Vide = texte traduit dans les 5 langues">${esc(s.note || "")}</textarea></label>
      <button class="btn block" id="r-save">Enregistrer</button>
    </div>
    <div class="sec-title">Le menu joueurs</div>
    <p class="hint">Décoche « visible » pour retirer un plat de l’app sans le supprimer. Les plats du menu de base sont traduits automatiquement dans les 5 langues ; un plat que tu ajoutes s’affiche tel que tu l’écris.</p>
    <button class="btn block" id="add" style="margin-bottom:18px">+ Nouveau plat</button>
    ${list.length ? list.map((m) => `
      <div class="adm-row">
        <div class="grow">
          <b>${m.active ? "" : svg("eyeoff", "mk off")}${esc(m.name)}${m.price != null ? ` — ${Number(m.price).toFixed(2)} CHF` : ""}</b>
          <small>${esc(m.description || "")}</small>
        </div>
        <div class="adm-actions">
          <button class="btn ghost" data-edit="${m.id}">${svg("pencil")}</button>
          <button class="btn danger" data-del="${m.id}">${svg("trash")}</button>
        </div>
      </div>`).join("") : `<div class="empty">Aucun plat.</div>`}`;

  $("r-save").onclick = () => run(() => api("setting_set", { key: "restaurant",
    value: { name: $("r-name").value.trim(), address: $("r-addr").value.trim(), note: $("r-note").value.trim() } }));

  const form = (m = {}) => sheet(m.id ? "Modifier le plat" : "Nouveau plat", `
    <label class="f">Nom du plat (anglais)<input id="f-name" value="${esc(m.name || "")}" placeholder="Pasta bolognese" /></label>
    <label class="f">Description<input id="f-desc" value="${esc(m.description || "")}" placeholder="With a side salad" /></label>
    <div class="grid2">
      <label class="f">Prix (CHF)<input type="number" step="0.05" id="f-price" value="${m.price != null ? m.price : "15.00"}" /></label>
      <label class="f">Ordre<input type="number" id="f-sort" value="${m.sort ?? 0}" /></label>
    </div>
    <div class="toggle"><div><b>Visible dans l'app</b></div>
      <label class="sw"><input type="checkbox" id="f-act" ${m.active === false ? "" : "checked"} /><i></i></label></div>`,
    async () => {
      const name = $("f-name").value.trim();
      if (!name) { alert("Le nom est vide."); return false; }
      await api("menu_save", { id: m.id ?? null, name, description: $("f-desc").value.trim(),
        price: $("f-price").value, sort: Number($("f-sort").value) || 0, active: $("f-act").checked });
      route();
    });

  $("add").onclick = () => form();
  v.onclick = (e) => {
    const ed = e.target.closest("[data-edit]");
    if (ed) return form(list.find((m) => m.id === Number(ed.dataset.edit)));
    const dl = e.target.closest("[data-del]");
    if (dl && confirm("Supprimer ce plat ?")) run(() => api("menu_del", { id: Number(dl.dataset.del) }));
  };
}

/* ============================================================== HÔTEL */
async function vHotel(v) {
  const { data } = await sb.from("lo_settings").select("value").eq("key", "hotel").single();
  const h = (data && data.value) || {};
  v.innerHTML = `
    <h2 class="lo-h2">Hôtel officiel</h2>
        <div class="card">
      <label class="f">Nom<input id="h-name" value="${esc(h.name || "")}" /></label>
      <label class="f">Adresse<input id="h-addr" value="${esc(h.address || "")}" placeholder="Rue ..., 1004 Lausanne" /></label>
      <label class="f">Téléphone<input id="h-tel" value="${esc(h.phone || "")}" /></label>
      <label class="f">Lien Google Maps (laisse vide = généré depuis l'adresse)
        <input id="h-maps" value="${esc(h.maps || "")}" /></label>
      <label class="f">Note affichée aux joueurs â <b>laisse vide</b> pour la version traduite automatiquement
        <textarea id="h-note" placeholder="Vide = texte traduit dans les 5 langues">${esc(h.note || "")}</textarea></label>
      <button class="btn block" id="h-save">Enregistrer</button>
    </div>`;
  $("h-save").onclick = () => run(() => api("setting_set", { key: "hotel", value: {
    name: $("h-name").value.trim(), address: $("h-addr").value.trim(),
    phone: $("h-tel").value.trim(), maps: $("h-maps").value.trim(), note: $("h-note").value.trim() } }));
}

/* ====================================================== ORDER OF PLAY */
async function vOop(v) {
  const { data } = await sb.from("lo_oop").select("day,filename,mime,updated_at").order("day", { ascending: false });
  const list = data || [];
  v.innerHTML = `
    <h2 class="lo-h2">Order of play</h2>
    <p class="hint">Un fichier par jour (PDF ou photo, 6 Mo max). Réimporter un fichier pour un jour déjà
       présent <b>remplace</b> l'ancien. Le fichier apparaît immédiatement dans l'app des joueurs.</p>
    <div class="card">
      <div class="grid2">
        <label class="f">Jour<input type="date" id="o-day" value="${today()}" /></label>
        <label class="f">Fichier
          <input type="file" id="o-file" accept="application/pdf,image/*" style="padding:9px" /></label>
      </div>
      <button class="btn block" id="o-up">Importer</button>
      <p class="err" id="o-err"></p>
    </div>
    <div class="sec-title">Fichiers publiés</div>
    ${list.length ? list.map((o) => `
      <div class="adm-row">
        <div class="grow"><b>${frJour(o.day)}</b>
          <small>${esc(o.filename)} · mis à jour le ${frDateTime(o.updated_at)}</small>
          ${list.some((x) => x.filename === o.filename && x.day !== o.day)
            ? `<small class="warn-line">${svg("alert")} même fichier qu'un autre jour — à vérifier</small>` : ""}</div>
        <div class="adm-actions"><button class="btn danger" data-del="${o.day}">${svg("trash")}</button></div>
      </div>`).join("") : `<div class="empty">Aucun fichier publié.</div>`}`;

  $("o-up").onclick = async () => {
    const f = $("o-file").files[0];
    const day = $("o-day").value;
    $("o-err").textContent = "";
    if (!day) { $("o-err").textContent = "Choisis un jour."; return; }
    if (!f) { $("o-err").textContent = "Choisis un fichier."; return; }
    if (f.size > 6 * 1024 * 1024) { $("o-err").textContent = "Fichier trop lourd (6 Mo max)."; return; }
    // Piege classique : on retelecharge le programme du jour depuis le site de
    // l'ITF, le navigateur le range dans les telechargements a cote du
    // precedent, et on repique l'ancien fichier. Le nom est le meme, personne
    // ne voit rien, et les joueurs lisent le programme de la veille. Si ce nom
    // de fichier sert deja pour un autre jour, on demande confirmation.
    const deja = list.find((o) => o.filename === f.name && o.day !== day);
    if (deja && !confirm(
        `« ${f.name} » est déjà publié pour ${frJour(deja.day)}.\n\n` +
        `C'est bien le bon fichier pour ${frJour(day)} ?\n` +
        `(Si tu viens de le retélécharger, vérifie que tu n'as pas repris l'ancien.)`)) {
      return;
    }
    $("o-up").disabled = true;
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      await api("oop_set", { day, filename: f.name, mime: f.type || "application/pdf", data: b64 });
      route();
    } catch (e) { $("o-err").textContent = e.message; $("o-up").disabled = false; }
  };

  v.onclick = (e) => {
    const dl = e.target.closest("[data-del]");
    if (dl && confirm("Supprimer l'order of play de ce jour ?")) run(() => api("oop_del", { day: dl.dataset.del }));
  };
}

/* =========================================================== PRACTICE */
async function vPractice(v) {
  const [{ data: pd }, bookings] = await Promise.all([
    sb.from("lo_practice_days").select("*").order("day"),
    apiList("bookings"),
  ]);
  const days = pd || [];
  const byDay = {};
  bookings.forEach((b) => { (byDay[b.day] ||= []).push(b); });

  v.innerHTML = `
    <h2 class="lo-h2">Practice</h2>
    <p class="hint">Une journée = une liste de courts + une plage horaire découpée en créneaux.
       « Visible à partir de » permet d'ouvrir le lendemain la veille à 18h00 : tant que l'heure n'est pas
       atteinte, la journée n'existe pas pour les joueurs.</p>
    <button class="btn block" id="add" style="margin-bottom:18px">+ Ouvrir une journée</button>
    ${days.length ? days.map((d) => {
      const bk = (byDay[d.day] || []);
      return `
      <div class="card">
        <h3>${ico("racket")} ${frJour(d.day)}</h3>
        <div class="kv" style="margin-bottom:10px">
          <div><span>Courts</span><b>${esc((d.court_names || []).join(", "))}</b></div>
          <div><span>Horaires</span><b>${hhmm(d.first_time)} → ${hhmm(d.last_time)} · ${d.slot_min} min</b></div>
          <div><span>Visible</span><b>${d.visible_from ? `dès le ${frDateTime(d.visible_from)}` : "tout de suite"}</b></div>
          <div><span>Inscriptions</span><b>${bk.length} · 2 places par créneau</b></div>
        </div>
        ${bk.length ? bk.map((b) => `
          <div class="adm-row" style="margin-bottom:6px">
            <div class="grow"><b>${hhmm(b.start_time)} · ${esc(b.court)} · place ${b.seat || 1}</b><small>${esc(b.player_name)}</small></div>
            <div class="adm-actions">
              <button class="btn ghost" data-bedit="${b.id}">${svg("pencil")}</button>
              <button class="btn danger" data-bdel="${b.id}">${svg("trash")}</button>
            </div>
          </div>`).join("") : `<p class="hint" style="margin:0">Aucune inscription.</p>`}
        <div class="sheet-row" style="margin-top:12px">
          <button class="btn ghost small" data-badd="${d.day}">+ Inscrire un joueur</button>
          <button class="btn ghost small" data-edit="${d.day}">Modifier la journée</button>
          <button class="btn danger small" data-del="${d.day}">Supprimer</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty">Aucune journée ouverte.</div>`}`;

  const formDay = (d = {}) => sheet(d.day ? "Modifier la journée" : "Ouvrir une journée", `
    <label class="f">Jour<input type="date" id="f-day" value="${esc(d.day || demain())}" ${d.day ? "readonly" : ""} /></label>
    <label class="f">Courts (séparés par une virgule)
      <input id="f-courts" value="${esc((d.court_names || ["Court 1", "Court 2"]).join(", "))}" placeholder="Court 1, Court 2" /></label>
    <div class="grid2">
      <label class="f">Premier créneau<input type="time" id="f-first" value="${hhmm(d.first_time) || "09:00"}" /></label>
      <label class="f">Dernier créneau<input type="time" id="f-last" value="${hhmm(d.last_time) || "18:00"}" /></label>
    </div>
    <label class="f">Durée d'un créneau (minutes)
      <select id="f-slot">
        ${[15, 30, 45, 60].map((n) => `<option value="${n}" ${(d.slot_min || 30) === n ? "selected" : ""}>${n} min</option>`).join("")}
      </select></label>
    <label class="f">Visible à partir de (vide = tout de suite)
      <input type="datetime-local" id="f-vis" value="${toLocalInput(d.visible_from)}" /></label>
    <label class="f">Note affichée aux joueurs (anglais)
      <input id="f-note" value="${esc(d.note || "")}" placeholder="Courts 5 and 6, clay" /></label>`,
    async () => {
      const courts = $("f-courts").value.split(",").map((s) => s.trim()).filter(Boolean);
      if (!courts.length) { alert("Indique au moins un court."); return false; }
      const vis = $("f-vis").value;
      await api("pday_save", { day: $("f-day").value, court_names: courts,
        first_time: $("f-first").value, last_time: $("f-last").value,
        slot_min: Number($("f-slot").value), visible_from: vis ? new Date(vis).toISOString() : "",
        note: $("f-note").value.trim() });
      route();
    });

  const formBooking = (b = {}, day = null) => {
    const d = days.find((x) => x.day === (b.day || day));
    if (!d) return;
    const slots = [];
    const [h0, m0] = d.first_time.split(":").map(Number);
    const [h1, m1] = d.last_time.split(":").map(Number);
    for (let t = h0 * 60 + m0; t <= h1 * 60 + m1; t += d.slot_min) {
      slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    }
    sheet(b.id ? "Modifier l'inscription" : "Inscrire un joueur", `
      <label class="f">Nom du joueur<input id="f-name" value="${esc(b.player_name || "")}" /></label>
      ${b.id ? "" : `
      <div class="grid2">
        <label class="f">Court<select id="f-court">${(d.court_names || []).map((c) =>
          `<option>${esc(c)}</option>`).join("")}</select></label>
        <label class="f">Heure<select id="f-start">${slots.map((s) =>
          `<option>${s}</option>`).join("")}</select></label>
      </div>`}`,
      async () => {
        const name = $("f-name").value.trim();
        if (name.length < 2) { alert("Nom trop court."); return false; }
        await api("pb_save", b.id
          ? { id: b.id, player_name: name }
          : { day: d.day, court: $("f-court").value, start_time: $("f-start").value, player_name: name });
        route();
      });
  };

  $("add").onclick = () => formDay();
  v.onclick = (e) => {
    const t = (a) => e.target.closest(`[data-${a}]`);
    let b;
    if ((b = t("edit"))) return formDay(days.find((d) => d.day === b.dataset.edit));
    if ((b = t("del"))) {
      if (confirm("Supprimer cette journée ET toutes ses inscriptions ?"))
        return run(() => api("pday_del", { day: b.dataset.del }));
      return;
    }
    if ((b = t("badd"))) return formBooking({}, b.dataset.badd);
    if ((b = t("bedit"))) return formBooking(bookings.find((x) => x.id === Number(b.dataset.bedit)));
    if ((b = t("bdel"))) {
      if (confirm("Supprimer cette inscription ?")) return run(() => api("pb_del", { id: Number(b.dataset.bdel) }));
    }
  };
}

/* ====================================================== PAIEMENTS */
// Encaissement des frais d inscription, jour par jour. Trois moyens de
// paiement ; recliquer sur celui deja choisi annule l encaissement.
const MOYENS = [
  { k: "cash",  label: "Cash" },
  { k: "card",  label: "Carte" },
  { k: "twint", label: "Twint" },
];

async function vFees(v) {
  // Une seule liste, celle des qualifications : ni choix de journee, ni
  // saisie manuelle. Les joueurs sont deja en base.
  const liste = await apiList("fees");
  const payes = liste.filter((f) => f.method).length;

  v.innerHTML = `
    <h2 class="lo-h2">Paiements</h2>

    <div class="fees-price">
      <b>34 CHF</b><span>36 €</span><span>40 US$</span>
    </div>

    <p class="lo-lead" style="margin:-6px 0 16px">
      <b>${payes}</b> encaissé${payes > 1 ? "s" : ""} sur ${liste.length} joueurs.
    </p>

    ${liste.length ? `<div class="fees-list">${liste.map((f) => `
      <div class="fee${f.method ? " paid" : ""}">
        <b>${esc(f.player)}</b>
        <div class="fee-btns">${MOYENS.map((m) => `<button class="fee-b${f.method === m.k ? " on" : ""}"
           data-pay="${f.id}" data-m="${m.k}">${m.label}</button>`).join("")}</div>
      </div>`).join("")}</div>
      <p class="hint" style="margin-top:14px">Un clic encaisse et passe le nom en vert.
         Recliquer sur le même moyen annule.</p>`
    : `<div class="empty">Aucun joueur enregistré.</div>`}`;

  v.onclick = async (e) => {
    const p = e.target.closest("[data-pay]");
    if (!p) return;
    // l affichage bascule des le clic : au bureau, on encaisse vite
    const bloc = p.closest(".fee");
    const etait = p.classList.contains("on");
    bloc.querySelectorAll(".fee-b").forEach((x) => x.classList.remove("on"));
    if (!etait) p.classList.add("on");
    bloc.classList.toggle("paid", !etait);
    try { await apiFees("fees_set", { id: Number(p.dataset.pay), method: p.dataset.m }); }
    catch (err) { alert(err.message); }
  };
}

/* ================================================ SPARRING / ROOMMATE */
async function vMurs(v) {
  const posts = await apiList("posts");
  const box = (kind, titre) => {
    const list = posts.filter((p) => p.kind === kind);
    return `<div class="sec-title">${titre} <span style="margin-left:auto;font-size:.8rem;color:var(--muted)">${list.length}</span></div>
      ${list.length ? list.map((p) => `
        <div class="adm-row">
          <div class="grow"><b>${esc(p.author || "Anonyme")}</b><small>${esc(p.body)}</small>
            <small style="margin-top:5px;opacity:.6">${frDateTime(p.created_at)}</small></div>
          <div class="adm-actions">
            <button class="btn ghost" data-edit="${p.id}">${svg("pencil")}</button>
            <button class="btn danger" data-del="${p.id}">${svg("trash")}</button>
          </div>
        </div>`).join("") : `<div class="empty">Aucun message.</div>`}`;
  };
  v.innerHTML = `
    <h2 class="lo-h2">Sparring &amp; Roommate</h2>
    <p class="hint">Modération des deux murs. Pour fermer un mur complètement, va dans l'onglet
       « Onglets » et désactive-le.</p>
    ${box("sparring", `${svg("users","mk")} Je cherche un sparring`)}
    ${box("roommate", `${svg("bed","mk")} Je cherche un roommate`)}`;

  v.onclick = (e) => {
    const ed = e.target.closest("[data-edit]");
    if (ed) {
      const p = posts.find((x) => x.id === Number(ed.dataset.edit));
      return sheet("Modifier le message", `
        <label class="f">Auteur<input id="f-a" value="${esc(p.author || "")}" /></label>
        <label class="f">Message<textarea id="f-b">${esc(p.body)}</textarea></label>`,
        async () => { await api("post_save", { id: p.id, author: $("f-a").value.trim(), body: $("f-b").value.trim() }); route(); });
    }
    const dl = e.target.closest("[data-del]");
    if (dl && confirm("Supprimer ce message ?")) run(() => api("post_del", { id: Number(dl.dataset.del) }));
  };
}

/* ============================================ PAELLA (soiree joueurs) */
async function vPaella(v) {
  const s = await apiPaella("list");
  const liste = s.inscrits || [];

  v.innerHTML = `
    <h2 class="lo-h2">Paella du mardi soir</h2>
    <p class="hint">Soirée des joueurs, mardi dès 18h00 au Restaurant du Tennis.
       Les inscriptions viennent de l’app des joueurs et de la console spectateurs.
       Pour fermer les inscriptions, désactive l’onglet dans « Onglets ».</p>

    <div class="grid2">
      <label class="f">Inscriptions<input value="${liste.length}" readonly /></label>
      <label class="f">Couverts à prévoir<input value="${s.couverts}" readonly /></label>
    </div>

    <button class="btn block" id="pa-add" style="margin-bottom:16px">+ Inscrire quelqu’un</button>

    ${liste.length ? liste.map((p) => `
      <div class="adm-row">
        <div class="grow"><b>${esc(p.name)}${p.guests ? ` +${p.guests}` : ""}</b>
          <small>${1 + (p.guests || 0)} couvert${1 + (p.guests || 0) > 1 ? "s" : ""} · ${frDateTime(p.created_at)}</small></div>
        <div class="adm-actions">
          <button class="btn ghost" data-edit="${p.id}">${svg("pencil")}</button>
          <button class="btn danger" data-del="${p.id}">${svg("trash")}</button>
        </div>
      </div>`).join("") : `<div class="empty">Aucune inscription pour l’instant.</div>`}`;

  const form = (p = {}) => sheet(p.id ? "Modifier l’inscription" : "Inscrire quelqu’un", `
    <label class="f">Nom<input id="f-n" value="${esc(p.name || "")}" /></label>
    <label class="f">Accompagnants
      <select id="f-g">${[0, 1, 2, 3].map((g) =>
        `<option value="${g}" ${(p.guests || 0) === g ? "selected" : ""}>+${g}</option>`).join("")}</select></label>`,
    async () => {
      const nom = $("f-n").value.trim();
      if (nom.length < 2) { alert("Nom trop court."); return false; }
      await apiPaella("save", { id: p.id ?? null, name: nom, guests: Number($("f-g").value) });
      route();
    });

  $("pa-add").onclick = () => form();
  v.onclick = (e) => {
    const ed = e.target.closest("[data-edit]");
    if (ed) return form(liste.find((p) => p.id === Number(ed.dataset.edit)));
    const dl = e.target.closest("[data-del]");
    if (dl && confirm("Retirer cette inscription ?"))
      run(() => apiPaella("del", { id: Number(dl.dataset.del) }));
  };
}

/* ====================================================== FREQUENTATION */
const SITES = { players: "App joueurs", welcome: "Console spectateurs", site: "lausanneopen.ch" };

async function vStats(v) {
  const s = await apiStats();
  const barre = (val, max) => `<span class="bar" style="width:${max ? Math.round(val / max * 100) : 0}%"></span>`;

  const maxPage = Math.max(1, ...s.parPage.map((p) => p.visiteurs));
  const maxHeure = Math.max(1, ...s.parHeure.map((h) => h.visiteurs));

  v.innerHTML = `
    <h2 class="lo-h2">Fréquentation</h2>
    <p class="hint">Sans cookie ni adresse IP : chaque navigateur tire un identifiant
       aléatoire gardé chez lui. On compte donc des <b>appareils</b>, pas des personnes,
       et la mesure démarre à la mise en place de ce compteur.</p>

    <div class="grid2">
      <label class="f">Appareils au total<input value="${s.total.visiteurs}" readonly /></label>
      <label class="f">Pages vues<input value="${s.total.vues}" readonly /></label>
    </div>

    <div class="sec-title">${svg("calendar", "mk")} Par jour</div>
    ${s.parJour.length ? `<div class="stat-rows">${s.parJour.map((j) => `
      <div class="adm-row"><div class="grow">
        <b>${frJour(j.day)} · ${esc(SITES[j.site] || j.site)}</b>
        <small>${j.visiteurs} appareil${j.visiteurs > 1 ? "s" : ""} · ${j.vues} vues</small>
      </div></div>`).join("")}</div>` : `<div class="empty">Pas encore de données.</div>`}

    <div class="sec-title">${svg("clipboard", "mk")} Pages les plus consultées</div>
    ${s.parPage.length ? `<div class="stat-rows">${s.parPage.map((p) => `
      <div class="stat-line">
        <span class="stat-lbl">${esc(SITES[p.site] || p.site)} ‹ ${esc(p.page)}</span>
        <span class="stat-bar">${barre(p.visiteurs, maxPage)}</span>
        <span class="stat-num">${p.visiteurs}</span>
      </div>`).join("")}</div>` : ""}

    <div class="sec-title">${svg("bulb", "mk")} Aujourd’hui, heure par heure</div>
    ${s.parHeure.length ? `<div class="stat-rows">${s.parHeure.map((h) => `
      <div class="stat-line">
        <span class="stat-lbl">${String(h.hour).padStart(2, "0")}h</span>
        <span class="stat-bar">${barre(h.visiteurs, maxHeure)}</span>
        <span class="stat-num">${h.visiteurs}</span>
      </div>`).join("")}</div>` : `<div class="empty">Rien encore aujourd’hui.</div>`}

    ${s.parLangue.length ? `<div class="sec-title">${svg("users", "mk")} Langues</div>
      <div class="stat-rows">${s.parLangue.map((l) => `
        <div class="stat-line"><span class="stat-lbl">${esc((l.lang || "?").toUpperCase())}</span>
          <span class="stat-bar">${barre(l.visiteurs, Math.max(1, ...s.parLangue.map((x) => x.visiteurs)))}</span>
          <span class="stat-num">${l.visiteurs}</span></div>`).join("")}</div>` : ""}`;
}

/* =========================================================== RÃGLAGES */
async function vReglages(v) {
  const { data } = await sb.from("lo_settings").select("key,value").in("key", ["balls", "practice_intro"]);
  const g = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  v.innerHTML = `
    <h2 class="lo-h2">Réglages</h2>
    <div class="sec-title">Textes de l'onglet Practice</div>
    <div class="card">
      <label class="f">Introduction â laisse vide pour la version traduite
        <textarea id="s-intro" placeholder="Vide = texte traduit dans les 5 langues">${esc((g.practice_intro || {}).text || "")}</textarea></label>
      <label class="f">Encadré « balles » â laisse vide pour la version traduite
        <textarea id="s-balls" placeholder="Vide = texte traduit dans les 5 langues">${esc((g.balls || {}).text || "")}</textarea></label>
      <button class="btn block" id="s-save">Enregistrer</button>
    </div>
    <div class="sec-title">Mot de passe du backend</div>
    <div class="card">
      <p class="hint">Il n'y a qu'un seul mot de passe, partagé par l'organisation. Change-le après le tournoi.</p>
      <label class="f">Nouveau mot de passe<input type="password" id="s-p1" autocomplete="new-password" /></label>
      <label class="f">Confirmer<input type="password" id="s-p2" autocomplete="new-password" /></label>
      <button class="btn block" id="s-pwd">Changer le mot de passe</button>
      <p class="err" id="s-err"></p>
    </div>
    <div class="sec-title">Liens</div>
    <div class="card">
      <div class="kv">
        <div><span>App joueurs</span><b><a href="/" target="_blank">l'adresse du site</a></b></div>
        <div><span>Ce backend</span><b>/admin</b></div>
      </div>
    </div>`;

  $("s-save").onclick = () => run(async () => {
    await api("setting_set", { key: "practice_intro", value: { text: $("s-intro").value.trim() } });
    await api("setting_set", { key: "balls", value: { text: $("s-balls").value.trim() } });
  });

  $("s-pwd").onclick = async () => {
    const p1 = $("s-p1").value, p2 = $("s-p2").value;
    $("s-err").textContent = "";
    if (p1.length < 6) { $("s-err").textContent = "6 caractères minimum."; return; }
    if (p1 !== p2) { $("s-err").textContent = "Les deux mots de passe diffèrent."; return; }
    try {
      await api("set_password", { new: p1 });
      PWD = p1;
      sessionStorage.setItem("lo_pwd", p1);
      alert("Mot de passe changé. Note-le bien !");
      route();
    } catch (e) { $("s-err").textContent = e.message; }
  };
}

/* ------------------------------------------------------------ modale */
function sheet(title, inner, onOk, okLabel = "Enregistrer") {
  const el = $("sheet");
  el.innerHTML = `<div class="sheet"><div class="sheet-in">
      <h3>${esc(title)}</h3><div style="height:10px"></div>
      ${inner}
      <div class="sheet-row">
        <button class="btn ghost" id="sh-no">Annuler</button>
        <button class="btn" id="sh-ok">${esc(okLabel)}</button>
      </div></div></div>`;
  const close = () => { el.innerHTML = ""; };
  $("sh-no").onclick = close;
  el.querySelector(".sheet").onclick = (e) => { if (e.target.classList.contains("sheet")) close(); };
  $("sh-ok").onclick = async () => {
    $("sh-ok").disabled = true;
    try {
      const ok = await onOk();
      if (ok !== false) close();
    } catch (e) { alert(e.message); }
    const btn = $("sh-ok");
    if (btn) btn.disabled = false;
  };
  const first = el.querySelector("input,textarea");
  if (first) first.focus();
}
