// Page publique GameZone : classement des victoires + photos des vainqueurs.
// Ne lit que des fonctions SECURITY DEFINER exposant nom + victoires + photo
// (aucune donnée de contact / finance). Photos sans nom (décharge parentale).
import { sb } from "./common.js";
import "./pretty-select.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const CUP = (color, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4z"/><path d="M8 5.5H5V7a3 3 0 0 0 3 3M16 5.5h3V7a3 3 0 0 1-3 3"/><path d="M10 13.5V16h4v-2.5M8 20h8M12 16v4"/></svg>`;
const MEDAL = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#c8901f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M8.5 3l3.5 6 3.5-6"/><circle cx="12" cy="15" r="5"/></svg>`;

function trophies(w) {
  const cup = w >= 10 ? CUP("#c8901f", 20) : w >= 5 ? CUP("#9aa3ad", 17) : "";
  const medals = MEDAL.repeat(Math.min(w, 12)) + (w > 12 ? " …" : "");
  return `${cup ? `<span class="gz-cup">${cup}</span>` : ""}<span class="gz-medals">${medals}</span>`;
}

const PREVIEW = 12;
async function loadRanking(season) {
  const { data, error } = await sb.rpc("gz_public_ranking", { p_season: season || null });
  if (error) { $("gzp-ranking").innerHTML = `<p class="muted">Liste indisponible.</p>`; return; }
  const rows = data || [];
  if (!rows.length) { $("gzp-ranking").innerHTML = `<p class="muted">Pas encore de vainqueur cette saison.</p>`; return; }
  const row = (r, i) => `
    <div class="gz-rank-row${i < 3 ? " top" : ""}">
      <span class="gz-rank-pos">${r.wins}</span>
      <span class="gz-rank-name">${esc(r.first_name)} ${esc(r.last_name)}</span>
      <span class="gz-rank-tro">${trophies(Number(r.wins))}</span>
    </div>`;
  const shown = rows.slice(0, PREVIEW).map(row).join("");
  const rest = rows.slice(PREVIEW).map(row).join("");
  $("gzp-ranking").innerHTML = shown +
    (rest ? `<div id="gzp-more" class="hidden">${rest}</div>
      <button type="button" id="gzp-showall" class="gz-showall">Afficher tous les vainqueurs (${rows.length})</button>` : "");
  const btn = $("gzp-showall");
  if (btn) btn.addEventListener("click", () => { $("gzp-more").classList.remove("hidden"); btn.remove(); });
}


// Photos des vainqueurs : clic → agrandissement plein écran (flèches, clavier ← → Échap, glisser au doigt).
function gzBindLightbox(wrap, urls) {
  wrap.onclick = (e) => {   // onclick (et pas addEventListener) : la liste est re-rendue à chaque changement de saison
    const img = e.target.closest("img"); if (!img) return;
    gzOpenLightbox(urls, Math.max(0, urls.indexOf(img.getAttribute("src"))));
  };
}
function gzOpenLightbox(urls, start) {
  let i = start;
  const ov = document.createElement("div");
  ov.className = "gz-lb";
  ov.innerHTML = `<button type="button" class="gz-lb-x" aria-label="Fermer">✕</button>
    <button type="button" class="gz-lb-nav gz-lb-prev" aria-label="Photo précédente">‹</button>
    <img class="gz-lb-img" alt="Vainqueur GameZone" />
    <button type="button" class="gz-lb-nav gz-lb-next" aria-label="Photo suivante">›</button>
    <div class="gz-lb-count"></div>`;
  const img = ov.querySelector(".gz-lb-img"), count = ov.querySelector(".gz-lb-count");
  const show = (n) => { i = (n + urls.length) % urls.length; img.src = urls[i]; count.textContent = `${i + 1} / ${urls.length}`; };
  const close = () => { document.removeEventListener("keydown", onKey); document.removeEventListener("wheel", noScroll); document.removeEventListener("touchmove", noScroll); ov.remove(); };
  const onKey = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") show(i - 1); else if (e.key === "ArrowRight") show(i + 1); };
  if (urls.length < 2) ov.classList.add("gz-lb-single");
  ov.addEventListener("click", (e) => {
    if (e.target.closest(".gz-lb-prev")) show(i - 1);
    else if (e.target.closest(".gz-lb-next")) show(i + 1);
    else if (e.target !== img) close();
  });
  let x0 = null;
  ov.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  ov.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
  });
  document.addEventListener("keydown", onKey);
  // Pas de body{overflow:hidden} : sur ce site, ça ramène la page en haut (le body fait la hauteur de l'écran) et la
  // visionneuse semblait ne pas s'ouvrir. On bloque la molette et le glisser à la place, tant qu'elle est ouverte.
  const noScroll = (e) => { if (!e.target.closest(".gz-lb")) e.preventDefault(); };
  document.addEventListener("wheel", noScroll, { passive: false });
  document.addEventListener("touchmove", noScroll, { passive: false });
  document.body.appendChild(ov);
  show(i);
}
async function loadPhotos(season) {
  const { data, error } = await sb.rpc("gz_public_winner_photos", { p_season: season || null });
  const rows = error ? [] : (data || []);
  if (!rows.length) { $("gzp-photos").innerHTML = `<p class="muted">Les photos des vainqueurs apparaîtront ici.</p>`; return; }
  $("gzp-photos").innerHTML = rows.map((p) => `<div class="gz-photo-card"><img src="${esc(p.photo_url)}" loading="lazy" alt="Vainqueur GameZone" /></div>`).join("");
  gzBindLightbox($("gzp-photos"), rows.map((p) => p.photo_url));
}

async function init() {
  const { data: seasons } = await sb.rpc("gz_public_seasons");
  const list = seasons || [];
  const sel = $("gzp-season");
  sel.innerHTML = list.map((s) => `<option value="${s.id}"${s.is_current ? " selected" : ""}>${esc(s.name)}</option>`).join("");
  const current = (list.find((s) => s.is_current) || list[0] || {}).id || "";
  const refresh = () => { loadRanking(sel.value); loadPhotos(sel.value); };
  sel.addEventListener("change", refresh);
  sel.value = current;
  refresh();
}

init();
