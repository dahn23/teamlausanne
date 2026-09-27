// Source des vignettes assets/phys/*.svg — relancer : deno run --allow-write tools/pictos-physique.js assets/phys
// Générateur des vignettes d'exercices (trait fin bleu Team Lausanne).
// Usage : deno run --allow-write pictos.js <dossier_sortie>
const OUT = Deno.args[0] || "./out";
const B = "#1e3ad1", L = "#9db4f3", A = "#6f8fe8";
const W = 200, H = 140, G = 124;
const P = (pts) => "M" + pts.map((p) => p.join(" ")).join(" L");
const line = (pts, c = B, w = 3.2) => `<path d="${P(pts)}" stroke="${c}" stroke-width="${w}"/>`;
const head = ([x, y], r = 8.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${B}" stroke-width="3"/>`;
const arrow = (d, c = A) => `<path d="${d}" stroke="${c}" stroke-width="2.2" marker-end="url(#ar)"/>`;
const arrow2 = (d, c = A) => `<path d="${d}" stroke="${c}" stroke-width="2.2" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
const ground = `<path d="M18 ${G + 1}H182" stroke="#c9d6f7" stroke-width="2" stroke-dasharray="2 7"/>`;
const txt = (x, y, s, size = 11) => `<text x="${x}" y="${y}" fill="${A}" stroke="none" font-family="Inter,Arial,sans-serif" font-size="${size}" font-weight="700" text-anchor="middle">${s}</text>`;
// Silhouette : tronc, jambes et bras (le côté « loin » en bleu clair pour donner du relief).
function fig(p) {
  let s = "";
  if (p.farLeg) s += line(p.farLeg, L);
  if (p.farArm) s += line(p.farArm, L);
  s += line([p.neck, p.hip]);
  if (p.leg) s += line(p.leg);
  if (p.arm) s += line(p.arm);
  s += head(p.head);
  return s;
}
const svg = (body, noGround) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round">
<defs><marker id="ar" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M1 1L8 5L1 9" fill="none" stroke="${A}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
${noGround ? "" : ground}${body}</svg>`;
const wall = (x) => `<path d="M${x} 20V${G + 1}" stroke="#c9d6f7" stroke-width="5"/>`;
const band = (d) => `<path d="${d}" stroke="#f08a24" stroke-width="2.4" stroke-dasharray="1 0"/>`;
const mat = `<path d="M34 ${G - 2}H166" stroke="#dbe5fb" stroke-width="6"/>`;

const PICTOS = {
  // ---------- Échauffement ----------
  footing: svg(fig({ head: [108, 26], neck: [106, 35], hip: [96, 72],
    leg: [[96, 72], [112, 88], [106, 110], [113, 112]], farLeg: [[96, 72], [86, 94], [68, 100]],
    arm: [[104, 42], [90, 50], [84, 62]], farArm: [[104, 42], [114, 54], [122, 46]] })
    + line([[46, 50], [66, 50]], L, 2.2) + line([[40, 64], [62, 64]], L, 2.2) + line([[48, 78], [66, 78]], L, 2.2)),
  pas_chasses: svg(fig({ head: [100, 30], neck: [100, 39], hip: [100, 76],
    leg: [[100, 76], [116, 98], [122, 123]], farLeg: [[100, 76], [84, 98], [78, 123]],
    arm: [[100, 46], [116, 58], [124, 66]], farArm: [[100, 46], [84, 58], [76, 66]] })
    + arrow2("M52 104H148")),
  genoux: svg(fig({ head: [100, 24], neck: [100, 33], hip: [100, 70],
    leg: [[100, 70], [122, 72], [120, 96], [126, 98]], farLeg: [[100, 70], [98, 97], [96, 123]],
    arm: [[100, 40], [86, 48], [82, 60]], farArm: [[100, 40], [112, 50], [118, 42]] })
    + arrow("M140 96V70")),
  fente_rotation: svg(fig({ head: [100, 34], neck: [100, 43], hip: [100, 80],
    leg: [[100, 80], [126, 94], [128, 123]], farLeg: [[100, 80], [80, 104], [62, 121]],
    arm: [[100, 50], [118, 50], [132, 46]], farArm: [[100, 50], [84, 54], [72, 50]] })
    + arrow("M86 30 Q100 18 116 28")),
  balancer: svg(wall(60) + fig({ head: [96, 26], neck: [96, 35], hip: [96, 72],
    leg: [[96, 72], [120, 84], [140, 92]], farLeg: [[96, 72], [96, 97], [96, 123]],
    arm: [[96, 42], [78, 48], [62, 48]], farArm: [[96, 42], [104, 56], [106, 70]] })
    + arrow("M84 110 Q116 126 150 104")),
  rotation_epaule: svg(band("M40 60 L96 60") + wall(38) + fig({ head: [110, 24], neck: [110, 33], hip: [110, 72],
    leg: [[110, 72], [114, 97], [116, 123]], farLeg: [[110, 72], [106, 97], [104, 123]],
    arm: [[110, 42], [110, 60], [96, 60]], farArm: [[110, 42], [114, 60], [118, 76]] })
    + arrow("M94 76 Q82 70 80 56")),
  rowing: svg(wall(42) + band("M44 62 L104 64") + fig({ head: [128, 26], neck: [128, 35], hip: [132, 74],
    leg: [[132, 74], [126, 98], [132, 123]], farLeg: [[132, 74], [138, 98], [140, 123]],
    arm: [[128, 44], [140, 60], [110, 64]], farArm: [[128, 44], [136, 58], [110, 62]] })
    + arrow("M150 44H172")),
  marche_laterale: svg(fig({ head: [100, 36], neck: [100, 45], hip: [98, 80],
    leg: [[98, 80], [120, 98], [124, 123]], farLeg: [[98, 80], [80, 98], [76, 123]],
    arm: [[100, 52], [116, 64], [116, 76]], farArm: [[100, 52], [84, 64], [84, 76]] })
    + band("M84 99 L116 99") + arrow2("M44 112H72") + arrow2("M128 112H156")),
  cercles_bras: svg(fig({ head: [100, 34], neck: [100, 43], hip: [100, 80],
    leg: [[100, 80], [106, 102], [108, 123]], farLeg: [[100, 80], [94, 102], [92, 123]],
    arm: [[100, 50], [122, 50], [142, 50]], farArm: [[100, 50], [78, 50], [58, 50]] })
    + `<circle cx="148" cy="50" r="13" stroke="${A}" stroke-width="2" stroke-dasharray="3 5"/><circle cx="52" cy="50" r="13" stroke="${A}" stroke-width="2" stroke-dasharray="3 5"/>`),
  reactivite: svg(fig({ head: [100, 22], neck: [100, 31], hip: [100, 66],
    leg: [[100, 66], [112, 84], [110, 104]], farLeg: [[100, 66], [88, 84], [90, 104]],
    arm: [[100, 38], [114, 50], [118, 60]], farArm: [[100, 38], [86, 50], [82, 60]] })
    + line([[82, 114], [118, 114]], L, 2) + arrow("M126 92H170") + arrow("M74 92H30") + arrow("M100 116 L100 132")),
  // ---------- Décrassage ----------
  marche: svg(fig({ head: [102, 26], neck: [102, 35], hip: [100, 74],
    leg: [[100, 74], [110, 98], [116, 123]], farLeg: [[100, 74], [92, 98], [84, 122]],
    arm: [[102, 42], [96, 60], [96, 76]], farArm: [[102, 42], [110, 58], [114, 72]] })
    + `<path d="M140 40 q8 -8 16 0 t16 0" stroke="${L}" stroke-width="2.2"/><path d="M140 54 q8 -8 16 0 t16 0" stroke="${L}" stroke-width="2.2"/>`),
  boire: svg(`<path d="M66 44h20v10l6 8v56a6 6 0 0 1-6 6H66a6 6 0 0 1-6-6V62l6-8z" stroke="${B}" stroke-width="3"/><path d="M68 36h16v8H68z" stroke="${B}" stroke-width="3"/><path d="M60 84h32" stroke="${L}" stroke-width="2.4"/>`
    + `<circle cx="136" cy="96" r="24" stroke="${B}" stroke-width="3"/><path d="M136 72q2-12 10-14" stroke="${B}" stroke-width="3"/><path d="M140 64q12-6 18 2q-10 6-18-2z" stroke="${A}" stroke-width="2.4"/>`),
  quadriceps: svg(fig({ head: [100, 24], neck: [100, 33], hip: [100, 72],
    leg: [[100, 72], [100, 97], [100, 123]], farLeg: [[100, 72], [102, 96], [80, 82]],
    arm: [[100, 40], [92, 60], [82, 80]], farArm: [[100, 40], [114, 52], [124, 46]] })),
  ischios_banc: svg(`<path d="M120 94h52M128 94v30M164 94v30" stroke="#c9d6f7" stroke-width="5"/>` + fig({ head: [96, 44], neck: [100, 52], hip: [86, 82],
    leg: [[86, 82], [118, 88], [148, 90], [150, 82]], farLeg: [[86, 82], [84, 104], [82, 123]],
    arm: [[98, 58], [114, 68], [126, 78]], farArm: [[98, 58], [108, 72], [118, 82]] })),
  mollets_mur: svg(wall(150) + fig({ head: [124, 34], neck: [120, 43], hip: [104, 76],
    leg: [[104, 76], [118, 98], [124, 123]], farLeg: [[104, 76], [84, 100], [66, 123]],
    arm: [[118, 48], [134, 50], [148, 44]], farArm: [[118, 48], [132, 56], [148, 52]] })),
  fessiers_assis: svg(mat + fig({ head: [82, 56], neck: [84, 65], hip: [80, 112],
    leg: [[80, 112], [112, 80], [122, 112]], farLeg: [[80, 112], [152, 117]],
    arm: [[83, 74], [102, 90], [114, 84]], farArm: [[83, 74], [68, 94], [60, 114]] })),
  epaule_croise: svg(fig({ head: [100, 26], neck: [100, 35], hip: [100, 74],
    leg: [[100, 74], [104, 98], [106, 123]], farLeg: [[100, 74], [96, 98], [94, 123]],
    arm: [[100, 44], [80, 50], [62, 52]], farArm: [[100, 44], [108, 60], [84, 52]] })
    + arrow("M58 66 Q70 76 86 72")),
  avant_bras: svg(fig({ head: [86, 26], neck: [86, 35], hip: [86, 74],
    leg: [[86, 74], [90, 98], [92, 123]], farLeg: [[86, 74], [82, 98], [80, 123]],
    arm: [[86, 44], [110, 46], [134, 48], [140, 62]], farArm: [[86, 44], [104, 58], [138, 52]] })
    + arrow("M154 52 Q160 62 152 72")),
  respiration_assis: svg(mat + fig({ head: [100, 44], neck: [100, 53], hip: [100, 96],
    leg: [[100, 96], [128, 108], [100, 116]], farLeg: [[100, 96], [72, 108], [100, 116]],
    arm: [[100, 62], [122, 82], [128, 104]], farArm: [[100, 62], [78, 82], [72, 104]] })
    + txt(150, 44, "4 s", 12) + txt(150, 60, "6 s", 12) + `<path d="M36 40 q8 -8 16 0 t16 0" stroke="${L}" stroke-width="2.2"/>`),
  // ---------- Soir ----------
  respiration_dos: svg(mat + fig({ head: [44, 108], neck: [53, 110], hip: [96, 114],
    leg: [[96, 114], [118, 88], [140, 118]], farLeg: [[96, 114], [114, 90], [136, 119]],
    arm: [[60, 111], [72, 100], [82, 104]], farArm: [[60, 111], [70, 118], [76, 118]] })
    + `<path d="M76 90 q6 -8 12 0" stroke="${A}" stroke-width="2.2"/>` + txt(150, 50, "4 s", 12) + txt(150, 66, "6 s", 12)),
  chat_vache: svg(mat + fig({ head: [52, 82], neck: [60, 76], hip: [128, 76],
    leg: [[128, 76], [132, 118], [158, 120]], farLeg: [[128, 76], [126, 118], [152, 120]],
    arm: [[64, 76], [66, 98], [66, 119]], farArm: [[64, 76], [70, 98], [72, 119]] })
    + `<path d="M64 76 Q96 56 128 76" stroke="${L}" stroke-width="2.2" stroke-dasharray="3 5"/>` + arrow2("M96 50 L96 34")),
  rotation_dos: svg(mat + fig({ head: [58, 70], neck: [64, 76], hip: [128, 80],
    leg: [[128, 80], [130, 119], [156, 121]], farLeg: [[128, 80], [124, 119], [150, 121]],
    arm: [[68, 78], [68, 98], [68, 119]], farArm: [[68, 78], [76, 56], [80, 34]] })
    + arrow("M92 50 Q96 30 84 22")),
  fente_ouverture: svg(fig({ head: [84, 64], neck: [90, 70], hip: [110, 90],
    leg: [[110, 90], [132, 96], [140, 123]], farLeg: [[110, 90], [84, 108], [58, 121]],
    arm: [[92, 72], [96, 96], [100, 122]], farArm: [[92, 72], [98, 46], [102, 22]] })
    + arrow("M118 36 Q120 20 108 14")),
  psoas: svg(`<path d="M52 ${G - 3}h24" stroke="#dbe5fb" stroke-width="7"/>` + fig({ head: [100, 30], neck: [100, 39], hip: [98, 78],
    leg: [[98, 78], [128, 82], [132, 123]], farLeg: [[98, 78], [80, 104], [62, 120], [44, 122]],
    arm: [[100, 46], [110, 62], [124, 74]], farArm: [[100, 46], [106, 62], [118, 78]] })
    + arrow("M84 66 L104 66")),
  ischios_dos: svg(mat + fig({ head: [40, 110], neck: [49, 112], hip: [96, 116],
    leg: [[96, 116], [108, 72], [118, 30]], farLeg: [[96, 116], [150, 118]],
    arm: [[58, 113], [86, 70], [116, 36]], farArm: [[58, 113], [84, 76], [114, 34]] })
    + band("M116 36 L114 28") + `<path d="M112 28 q6 -4 10 2" stroke="#f08a24" stroke-width="2.4"/>`),
  fessier_4: svg(mat + fig({ head: [38, 110], neck: [47, 112], hip: [92, 116],
    leg: [[92, 116], [112, 84], [140, 84]], farLeg: [[92, 116], [128, 106], [116, 86]],
    arm: [[56, 113], [84, 96], [106, 90]], farArm: [[56, 113], [82, 102], [104, 94]] })),
  enfant: svg(mat + fig({ head: [74, 114], neck: [80, 110], hip: [124, 96],
    leg: [[124, 96], [110, 118], [142, 120]], farLeg: [[124, 96], [112, 119], [144, 121]],
    arm: [[86, 108], [62, 116], [38, 119]], farArm: [[86, 108], [64, 113], [40, 116]] })
    + `<path d="M150 60 q8 -8 16 0 t16 0" stroke="${L}" stroke-width="2.2"/>`),
};

await Deno.mkdir(OUT, { recursive: true });
for (const [k, v] of Object.entries(PICTOS)) await Deno.writeTextFile(`${OUT}/${k}.svg`, v);
await Deno.writeTextFile(`${OUT}/_planche.html`, `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;display:grid;grid-template-columns:repeat(5,1fr);width:1200px;gap:10px;padding:10px;background:#f4f6fb">`
  + Object.keys(PICTOS).map((k) => `<figure style="margin:0;background:#fff;border-radius:12px;padding:6px;text-align:center"><img src="${k}.svg" style="width:100%"><figcaption style="font-size:11px">${k}</figcaption></figure>`).join("") + "</body>");
console.log(Object.keys(PICTOS).length, "vignettes");
