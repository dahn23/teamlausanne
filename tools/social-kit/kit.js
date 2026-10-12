// Kit réseaux sociaux Team Lausanne — utilitaires communs aux modèles (templates/*.html).
// Les données arrivent dans l'ancre de l'adresse : modele.html#{"titre":"…"} (render.ts s'en charge).
window.DATA = (() => {
  try { return JSON.parse(decodeURIComponent(location.hash.slice(1)) || "{}"); } catch (_) { return {}; }
})();
const D = window.DATA;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Met un ou plusieurs mots en vert : « Tournoi d'*automne* » → <em>automne</em> (le vert = 10 % de la charte).
const vert = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em class="v">$1</em>').replace(/\n/g, "<br>");
// Traits « balle qui file » de la charte : courbes fines, vert + blanc, posées en fond.
function sweep(w, h, opts = {}) {
  const c1 = opts.c1 || "var(--vert)", c2 = opts.c2 || "rgba(255,255,255,.55)", y = opts.y ?? 0.62, s = opts.spread ?? 1;
  const p = (dy, k) => `M ${-0.05 * w} ${h * (y + dy)} C ${w * 0.3} ${h * (y + dy - 0.10 * k)}, ${w * 0.62} ${h * (y + dy + 0.06 * k)}, ${w * 1.08} ${h * (y + dy - 0.13 * k)}`;
  return `<svg class="sweep" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="left:0;top:0">
    <path d="${p(0, s)}" fill="none" stroke="${c1}" stroke-width="7" stroke-linecap="round"/>
    <path d="${p(0.018, s * 1.1)}" fill="none" stroke="${c2}" stroke-width="3" stroke-linecap="round"/>
    <path d="${p(0.034, s * 0.9)}" fill="none" stroke="${c1}" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>
  </svg>`;
}
// Photo : chemin local (file:///) ou https ; position du cadrage « 50% 30% ».
const photo = (src, pos) => src ? `background-image:url('${String(src).replace(/'/g, "%27")}');background-position:${pos || "50% 35%"}` : "";
