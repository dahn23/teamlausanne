// Page publique GameZone : classement des victoires + photos des vainqueurs.
// Ne lit que des fonctions SECURITY DEFINER exposant nom + victoires + photo
// (aucune donnée de contact / finance). Photos sans nom (décharge parentale).
import { sb } from "./common.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const CUP = (color, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4z"/><path d="M8 5.5H5V7a3 3 0 0 0 3 3M16 5.5h3V7a3 3 0 0 1-3 3"/><path d="M10 13.5V16h4v-2.5M8 20h8M12 16v4"/></svg>`;
const MEDAL = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#c8901f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M8.5 3l3.5 6 3.5-6"/><circle cx="12" cy="15" r="5"/></svg>`;

function trophies(w) {
  const cup = w >= 10 ? CUP("#c8901f", 20) : w >= 5 ? CUP("#9aa3ad", 17) : "";
  const medals = MEDAL.repeat(Math.min(w, 12)) + (w > 12 ? " …" : "");
  return `${cup ? `<span class="gz-cup">${cup}</span>` : ""}<span class="gz-medals">${medals}</span>`;
}

async function loadRanking(season) {
  const { data, error } = await sb.rpc("gz_public_ranking", { p_season: season || null });
  if (error) { $("gzp-ranking").innerHTML = `<p class="muted">Classement indisponible.</p>`; return; }
  const rows = data || [];
  if (!rows.length) { $("gzp-ranking").innerHTML = `<p class="muted">Pas encore de vainqueur cette saison.</p>`; return; }
  $("gzp-ranking").innerHTML = rows.map((r, i) => `
    <div class="gz-rank-row${i < 3 ? " top" : ""}">
      <span class="gz-rank-pos">${i + 1}</span>
      <span class="gz-rank-name">${esc(r.first_name)} ${esc(r.last_name)}</span>
      <span class="gz-rank-tro">${trophies(Number(r.wins))}</span>
      <span class="gz-rank-w">${r.wins}</span>
    </div>`).join("");
}

async function loadPhotos(season) {
  const { data, error } = await sb.rpc("gz_public_winner_photos", { p_season: season || null });
  const rows = error ? [] : (data || []);
  if (!rows.length) { $("gzp-photos").innerHTML = `<p class="muted">Les photos des vainqueurs apparaîtront ici.</p>`; return; }
  $("gzp-photos").innerHTML = rows.map((p) => `<div class="gz-photo-card"><img src="${esc(p.photo_url)}" loading="lazy" alt="Vainqueur GameZone" /></div>`).join("");
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
