// Plannings hebdomadaires des jeunes élite (sport-études, pro, pro U18) :
// une page A4 paysage par joueur, à envoyer en début de semaine.
//
//   node tools/planning-hebdo/gen.cjs <lundi AAAA-MM-JJ> [seances.txt]
//   ex. node tools/planning-hebdo/gen.cjs 2026-11-09
//
// Les séances viennent d'un fichier texte extrait de la base avec
// requete.sql (voir README.md) — une ligne par séance :
//   Nom Prénom|filiere|JJ|HH:MM|HH:MM|Type de cours|Coachs|Courts
//
// Le PDF est imprimé par Chrome sans fenêtre, comme les plannings d'octobre
// 2026 (leurs fichiers portent « Skia/PDF », la signature de Chrome).
// Sortie dans exports/, qui est ignoré par Git : ce sont les horaires
// nominatifs de mineurs, ils ne doivent pas partir dans le dépôt.
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");

const RACINE = path.resolve(__dirname, "../..").replace(/\\/g, "/");
const KIT = `${RACINE}/tools/social-kit`;          // polices + logo de la charte
const ICI = __dirname.replace(/\\/g, "/");

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => { try { return fs.existsSync(p); } catch { return false; } });
if (!CHROME) { console.error("Chrome introuvable — il imprime les PDF."); process.exit(1); }

// ---- la semaine, déduite du lundi passé en argument ----
const lundi = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(lundi || "")) {
  console.error("usage : node tools/planning-hebdo/gen.cjs <lundi AAAA-MM-JJ> [seances.txt]");
  process.exit(1);
}
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
              "août", "septembre", "octobre", "novembre", "décembre"];
const NOMS_J = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const d0 = new Date(lundi + "T12:00:00Z");
if (d0.getUTCDay() !== 1) console.warn(`⚠️  ${lundi} n'est pas un lundi — la frise partira quand même de ce jour.`);

const JOURS = NOMS_J.map((lib, i) => {
  const d = new Date(d0); d.setUTCDate(d.getUTCDate() + i);
  return { jj: String(d.getUTCDate()).padStart(2, "0"), lib,
           date: `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`, d };
});
const dv = JOURS[4].d;
// « Lundi 9 – vendredi 13 novembre 2026 », et le mois répété s'il change en route.
const SEMAINE = d0.getUTCMonth() === dv.getUTCMonth()
  ? `Lundi ${d0.getUTCDate()} – vendredi ${dv.getUTCDate()} ${MOIS[dv.getUTCMonth()]} ${dv.getUTCFullYear()}`
  : `Lundi ${d0.getUTCDate()} ${MOIS[d0.getUTCMonth()]} – vendredi ${dv.getUTCDate()} ${MOIS[dv.getUTCMonth()]} ${dv.getUTCFullYear()}`;
const COURT = `${d0.getUTCDate()}-${dv.getUTCDate()} ${MOIS[dv.getUTCMonth()]}`;   // pour les noms de fichiers
const SORTIE = `${RACINE}/exports/Plannings ${COURT} ${dv.getUTCFullYear()}`;

const mn = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

// ---- familles de séances : la couleur vient du NOM du type, pas de sa couleur
// en base — Tennis et Physique y partagent le même bleu, ce qui rendrait la
// page illisible.
function famille(type) {
  if (/privé/i.test(type)) return { cle: "prive", nom: "Leçon privée", trait: "#b45309", fond: "#fdf2e3" };
  if (/physique/i.test(type)) return { cle: "phys", nom: "Physique", trait: "#1c7a45", fond: "#e9f6ee" };
  return { cle: "tennis", nom: "Tennis", trait: "#073eb5", fond: "#e9effc" };
}

// ---- lecture des séances ----
const FICHIER = (process.argv[3] || `${ICI}/seances.txt`).replace(/\\/g, "/");
if (!fs.existsSync(FICHIER)) { console.error(`Fichier de séances introuvable : ${FICHIER}\nVoir tools/planning-hebdo/README.md`); process.exit(1); }
const joueurs = new Map();
let nLignes = 0;
for (const [i, ligne] of fs.readFileSync(FICHIER, "utf8").split("\n").entries()) {
  if (!ligne.trim()) continue;
  const p = ligne.split("|");
  if (p.length !== 8) { console.error(`Ligne ${i + 1} : ${p.length} champs au lieu de 8 — ignorée.`); continue; }
  const [nom, filiere, jour, h1, h2, type, coach, court] = p.map((x) => x.trim());
  if (!JOURS.some((j) => j.jj === jour)) { console.error(`Ligne ${i + 1} : le jour « ${jour} » n'est pas dans la semaine du ${lundi} — ignorée.`); continue; }
  if (!joueurs.has(nom)) joueurs.set(nom, { nom, filiere, seances: [] });
  joueurs.get(nom).seances.push({ jour, h1, h2, type, coach, court, d: mn(h1), f: mn(h2) });
  nLignes++;
}
if (!joueurs.size) { console.error("Aucune séance lue."); process.exit(1); }

// ---- bornes de la frise : on s'adapte à la semaine, à l'heure pleine ----
const toutes = [...joueurs.values()].flatMap((j) => j.seances);
const H0 = Math.min(8 * 60, Math.floor(Math.min(...toutes.map((s) => s.d)) / 60) * 60);
const H1 = Math.max(18 * 60, Math.ceil(Math.max(...toutes.map((s) => s.f)) / 30) * 30);

// ---- heures réellement passées au club : UNION des créneaux, pas leur somme.
// Deux séances qui se chevauchent ne font pas deux fois des heures.
function heuresUnion(seances) {
  let total = 0;
  for (const { jj } of JOURS) {
    const iv = seances.filter((s) => s.jour === jj).map((s) => [s.d, s.f]).sort((a, b) => a[0] - b[0]);
    let cd = null, cf = null;
    for (const [d, f] of iv) {
      if (cd === null) { cd = d; cf = f; }
      else if (d <= cf) cf = Math.max(cf, f);
      else { total += cf - cd; cd = d; cf = f; }
    }
    if (cd !== null) total += cf - cd;
  }
  return total / 60;
}

// ---- chevauchements : on les SIGNALE, on ne les cache pas. Un jeune ne peut
// pas être à deux endroits : c'est une erreur de planning à corriger avant
// d'envoyer.
const conflits = [];
for (const j of joueurs.values()) {
  for (const { jj, lib } of JOURS) {
    const l = j.seances.filter((s) => s.jour === jj).sort((a, b) => a.d - b.d);
    for (let i = 1; i < l.length; i++) {
      if (l[i].d < l[i - 1].f) {
        conflits.push(`${j.nom} — ${lib} : ${l[i - 1].h1}–${l[i - 1].h2} ${l[i - 1].type} / ${l[i].h1}–${l[i].h2} ${l[i].type}`);
      }
    }
  }
}

// ---- colonnes côte à côte pour les séances qui se chevauchent ----
function colonnes(liste) {
  const l = liste.slice().sort((a, b) => a.d - b.d || a.f - b.f);
  const grappes = [];
  let g = [], finMax = -1;
  for (const s of l) {
    if (g.length && s.d >= finMax) { grappes.push(g); g = []; finMax = -1; }
    g.push(s); finMax = Math.max(finMax, s.f);
  }
  if (g.length) grappes.push(g);
  for (const gr of grappes) {
    const fins = [];
    for (const s of gr) {
      let c = fins.findIndex((f) => f <= s.d);
      if (c < 0) { c = fins.length; fins.push(0); }
      fins[c] = s.f; s.col = c;
    }
    for (const s of gr) s.cols = fins.length;
  }
  return l;
}

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const LIB_FIL = { "sport-etudes": "SPORT-ÉTUDES", "pro": "PRO", "pro-u18": "PRO U18" };

function page(j) {
  const h = heuresUnion(j.seances);
  const heures = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ",");
  const lignesH = [];
  for (let t = H0; t <= H1; t += 60) lignesH.push(t);

  const cols = JOURS.map(({ jj, lib, date }) => {
    const blocs = colonnes(j.seances.filter((s) => s.jour === jj)).map((s) => {
      const f = famille(s.type);
      const top = ((s.d - H0) / (H1 - H0)) * 100, haut = ((s.f - s.d) / (H1 - H0)) * 100;
      const larg = 100 / s.cols, gauche = s.col * larg;
      return `<div class="bloc" style="top:${top.toFixed(3)}%;height:${haut.toFixed(3)}%;left:calc(${gauche}% + 1px);width:calc(${larg}% - 2px);--trait:${f.trait};--fond:${f.fond}">
        <div class="bh">${s.h1.replace(":", "h")} – ${s.h2.replace(":", "h")}</div>
        <div class="bt">${esc(f.nom)}</div>
        <div class="bs">${esc(s.coach)}</div>
        <div class="bc">${esc(s.court)}</div>
      </div>`;
    }).join("");
    return `<div class="jour"><div class="jh"><b>${lib}</b><span>${date}</span></div><div class="corps">${blocs}</div></div>`;
  }).join("");

  const hhmm = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Planning ${esc(j.nom)}</title><style>
@font-face { font-family:"TL"; src:url("file:///${KIT}/fonts/NotoSans-Regular.ttf"); font-weight:400 }
@font-face { font-family:"TL"; src:url("file:///${KIT}/fonts/NotoSans-SemiBold.ttf"); font-weight:600 }
@font-face { font-family:"TL"; src:url("file:///${KIT}/fonts/NotoSans-ExtraBold.ttf"); font-weight:800 }
@font-face { font-family:"TLD"; src:url("file:///${KIT}/fonts/NotoSansDisplay-CondensedExtraBold.ttf"); font-weight:800 }
@page { size:A4 landscape; margin:0 }
*{box-sizing:border-box;margin:0;padding:0}
body{width:297mm;height:210mm;padding:8mm 9mm 6mm;font-family:"TL",sans-serif;color:#141414;
     display:flex;flex-direction:column;-webkit-print-color-adjust:exact;print-color-adjust:exact}
/* ---- entête ---- */
.tete{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:3mm;border-bottom:.5mm solid #003652}
.ident{display:flex;align-items:center;gap:3.2mm}
.logo{width:11mm;height:11.35mm;background:#003652;flex:none;
      -webkit-mask:url("file:///${KIT}/assets/logo-academy.png") center/contain no-repeat}
.sur{font-size:6.2pt;font-weight:800;letter-spacing:.14em;color:#137297}
.nom{font-family:"TLD","TL",sans-serif;font-weight:800;font-size:23pt;line-height:1;text-transform:uppercase;color:#003652;margin-top:.6mm}
.droite{text-align:right;padding-top:1mm}
.droite .q{font-size:6.6pt;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}
.droite .s{font-size:10.5pt;font-weight:800;color:#003652;margin-top:.8mm}
/* ---- grille ---- */
.grille{flex:1;display:flex;margin-top:3.5mm;min-height:0}
/* L'axe des heures est une colonne comme les autres : il porte le MÊME entête
   (vide) que les jours, sinon ses repères flottent au-dessus de la grille. */
.axe{width:11mm;flex:none;display:flex;flex-direction:column}
.axe .ac{flex:1;position:relative}
.axe .t{position:absolute;right:1.8mm;transform:translateY(-50%);font-size:6.4pt;color:#9ca3af}
.jours{flex:1;display:flex;gap:1.4mm;min-width:0}
.jour{flex:1;display:flex;flex-direction:column;min-width:0}
.jh{text-align:center;padding-bottom:1.6mm}
.jh b{display:block;font-size:9pt;font-weight:800;color:#003652}
.jh span{display:block;font-size:6.4pt;color:#9ca3af;margin-top:.3mm}
.corps{flex:1;position:relative;background:#fafafa;border:.2mm solid #e8e8e8;border-radius:1mm;overflow:hidden}
.lignes{position:absolute;inset:0}
.lignes i{position:absolute;left:0;right:0;border-top:.2mm solid #ececec}
/* ---- blocs ---- */
.bloc{position:absolute;overflow:hidden;border-radius:.9mm;background:var(--fond);
      border-left:1mm solid var(--trait);padding:.9mm 1.2mm;line-height:1.18}
.bh{font-size:5.6pt;font-weight:600;color:var(--trait);letter-spacing:.01em}
.bt{font-size:8pt;font-weight:800;color:#141414;margin-top:.2mm}
.bs{font-size:5.9pt;color:#374151;margin-top:.4mm}
.bc{font-size:5.6pt;color:#8b9099}
/* ---- pied ---- */
.pied{display:flex;align-items:center;justify-content:space-between;margin-top:2.6mm;
      padding-top:1.8mm;border-top:.2mm solid #e8e8e8;font-size:6.6pt;color:#6b7280}
.leg{display:flex;gap:4.5mm}
.leg i{display:inline-block;width:2.2mm;height:2.2mm;border-radius:.5mm;margin-right:1.1mm;vertical-align:-.2mm}
.tot{font-weight:600;color:#374151}
</style></head><body>
<div class="tete">
  <div class="ident"><div class="logo"></div>
    <div><div class="sur">TEAM LAUSANNE ACADEMY${LIB_FIL[j.filiere] ? " · " + LIB_FIL[j.filiere] : ""}</div>
         <div class="nom">${esc(j.nom)}</div></div></div>
  <div class="droite"><div class="q">Planning de la semaine</div><div class="s">${SEMAINE}</div></div>
</div>
<div class="grille">
  <div class="axe"><div class="jh"><b>&nbsp;</b><span>&nbsp;</span></div>
    <div class="ac">${lignesH.map((t) => `<div class="t" style="top:${(((t - H0) / (H1 - H0)) * 100).toFixed(3)}%">${hhmm(t)}</div>`).join("")}</div></div>
  <div class="jours">${cols}</div>
</div>
<div class="pied">
  <div class="leg">
    <span><i style="background:#073eb5"></i>Tennis</span>
    <span><i style="background:#1c7a45"></i>Préparation physique</span>
    <span><i style="background:#b45309"></i>Leçon privée</span>
  </div>
  <div class="tot">${j.seances.length} séance${j.seances.length > 1 ? "s" : ""} · ${heures} h d'entraînement dans la semaine</div>
</div>
<script>
// Les traits horaires sont posés après coup : ils doivent suivre la hauteur
// réelle de la colonne, qui dépend de la place prise par l'entête du jour.
document.querySelectorAll(".corps").forEach((c) => {
  const d = document.createElement("div"); d.className = "lignes";
  const n = ${lignesH.length};
  for (let i = 0; i < n; i++) { const l = document.createElement("i"); l.style.top = (i * 100 / (n - 1)) + "%"; d.appendChild(l); }
  c.insertBefore(d, c.firstChild);
});
</script>
</body></html>`;
}

// ---- rendu ----
fs.mkdirSync(SORTIE, { recursive: true });
const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "planning-")).replace(/\\/g, "/");
const noms = [...joueurs.keys()].sort((a, b) => a.localeCompare(b, "fr"));
console.log(`Semaine : ${SEMAINE}\nFrise   : ${hhmmG(H0)} → ${hhmmG(H1)}\n`);
function hhmmG(t) { return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; }
for (const nom of noms) {
  const j = joueurs.get(nom);
  const html = `${tmp}/${nom.replace(/[\\/:*?"<>|]/g, "-")}.html`;
  fs.writeFileSync(html, page(j), "utf8");
  const pdf = `${SORTIE}/Planning ${COURT} - ${nom}.pdf`;
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer",
    "--allow-file-access-from-files", "--virtual-time-budget=3000",
    `--print-to-pdf=${pdf}`, `file:///${encodeURI(html)}`], { stdio: "ignore" });
  const h = heuresUnion(j.seances);
  console.log(`✓ ${nom.padEnd(22)} ${String(j.seances.length).padStart(2)} séances · ${h} h`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${noms.length} PDF (${nLignes} séances) → ${SORTIE}`);
if (conflits.length) {
  console.log(`\n⚠️  ${conflits.length} chevauchement(s) — un jeune ne peut pas être à deux endroits :`);
  for (const c of conflits) console.log("   " + c);
  console.log("   Les deux séances sont dessinées côte à côte ; les heures du pied de page ne les comptent qu'une fois.");
}
