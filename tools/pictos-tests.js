// Source des vignettes assets/phys/tests/*.svg — relancer : node tools/pictos-tests.js assets/phys/tests
// Vignettes des tests physiques (même trait fin bleu que tools/pictos-physique.js, dont ce fichier
// reprend les primitives). Une vignette par mesure : le jeune reconnaît le test d'un coup d'oeil,
// la description écrite reste dessous pour le détail du protocole.
const fs = require("fs");
const OUT = process.argv[2] || "./out";
const B = "#1e3ad1", L = "#9db4f3", A = "#6f8fe8", O = "#f08a24";
const W = 200, H = 140, G = 124;
const P = (pts) => "M" + pts.map((p) => p.join(" ")).join(" L");
const line = (pts, c = B, w = 3.2) => `<path d="${P(pts)}" stroke="${c}" stroke-width="${w}"/>`;
const head = ([x, y], r = 8.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${B}" stroke-width="3"/>`;
const arrow = (d, c = A) => `<path d="${d}" stroke="${c}" stroke-width="2.2" marker-end="url(#ar)"/>`;
const arrow2 = (d, c = A) => `<path d="${d}" stroke="${c}" stroke-width="2.2" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
const dash = (d, c = L, w = 2) => `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-dasharray="3 5"/>`;
const ground = `<path d="M18 ${G + 1}H182" stroke="#c9d6f7" stroke-width="2" stroke-dasharray="2 7"/>`;
const txt = (x, y, s, size = 11) => `<text x="${x}" y="${y}" fill="${A}" stroke="none" font-family="Inter,Arial,sans-serif" font-size="${size}" font-weight="700" text-anchor="middle">${s}</text>`;
function fig(p) {
  let s = "";
  if (p.farLeg) s += line(p.farLeg, L);
  if (p.farArm) s += line(p.farArm, L);
  s += line([p.neck, p.hip]);
  if (p.leg) s += line(p.leg);
  if (p.arm) s += line(p.arm);
  s += head(p.head, p.r || 8.5);
  return s;
}
const svg = (body, noGround) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none" stroke-linecap="round" stroke-linejoin="round">
<defs><marker id="ar" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M1 1L8 5L1 9" fill="none" stroke="${A}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
${noGround ? "" : ground}${body}</svg>`;
// Miroir exact : le même dessin vu de l'autre côté (bras droit / bras gauche, main droite / main gauche).
const flip = (body) => `<g transform="translate(${W},0) scale(-1,1)">${body}</g>`;
const wall = (x) => `<path d="M${x} 16V${G + 1}" stroke="#c9d6f7" stroke-width="5"/>`;
const mat = `<path d="M30 ${G - 2}H170" stroke="#dbe5fb" stroke-width="6"/>`;
const ball = ([x, y], r = 10) => `<circle cx="${x}" cy="${y}" r="${r}" stroke="${O}" stroke-width="3"/><path d="M${x - r} ${y}h${2 * r}" stroke="${O}" stroke-width="1.6"/>`;
// Le filet : bande haute pleine, mailles en pointillé dessous.
const net = (x) => `<path d="M${x} 60V${G}" stroke="#c9d6f7" stroke-width="3"/><path d="M${x - 7} 60h14" stroke="#c9d6f7" stroke-width="5"/>`
  + `<path d="M${x - 6} 72h12M${x - 6} 86h12M${x - 6} 100h12M${x - 6} 114h12" stroke="#dbe5fb" stroke-width="1.6"/>`;
// La marche (ou la boxe) sur laquelle le jeune se tient pour la souplesse debout.
const step = (x0, x1, yTop) => `<path d="M${x0} ${yTop}H${x1}" stroke="#c9d6f7" stroke-width="5"/>`
  + `<path d="M${x0 + 4} ${yTop}V${G}M${x1 - 4} ${yTop}V${G}" stroke="#dbe5fb" stroke-width="3"/>`;

// Le lancer à 1 bras et la poigne servent deux fois chacun (droite / gauche) : le dessin est écrit
// une seule fois, la version opposée est son miroir.
const LANCER_BRAS = net(164) + fig({ head: [58, 34], neck: [58, 43], hip: [58, 84],
  leg: [[58, 84], [86, 104], [92, 123]], farLeg: [[58, 84], [40, 104], [32, 123]],
  arm: [[58, 50], [80, 42], [98, 46]], farArm: [[58, 50], [44, 64], [40, 78]] })
  + ball([112, 48], 9) + arrow("M126 46 Q148 40 158 56");
// Le dynamomètre et la main qui le serre. Les doigts TRAVERSENT la poignée : dessinés à côté
// d'elle ils ne serrent rien, et une paume en rectangle fait un second boîtier jumeau.
const POIGNE = `<rect x="100" y="44" width="42" height="62" rx="10" stroke="${B}" stroke-width="3"/>`
  + `<circle cx="121" cy="66" r="12" stroke="${B}" stroke-width="2.4"/><path d="M121 66 L128 58" stroke="${B}" stroke-width="2.4"/>`
  + `<path d="M92 54V100" stroke="${L}" stroke-width="8"/>`
  + line([[76, 64], [99, 64]]) + line([[74, 76], [99, 76]]) + line([[74, 88], [99, 88]]) + line([[78, 98], [97, 98]])
  + line([[74, 64], [72, 98]])
  + `<path d="M80 58 q10 -8 20 0" stroke="${B}" stroke-width="3"/>`
  + line([[20, 114], [70, 94]], L) + arrow("M110 28 L110 40");

const PICTOS = {
  // ---------- Lancers (puissance) ----------
  // Dos au mur, médecine-ball à 2 mains : la balle part loin sans que les omoplates ne décollent.
  lancer_mur: svg(wall(44) + fig({ head: [66, 30], neck: [66, 39], hip: [66, 80],
    leg: [[66, 80], [72, 102], [74, 123]], farLeg: [[66, 80], [60, 102], [58, 123]],
    arm: [[66, 48], [88, 44], [108, 44]], farArm: [[66, 48], [88, 52], [106, 52]] })
    + ball([122, 48]) + arrow("M140 48H178")),
  // À 1 bras, pied opposé devant, face au filet.
  lancer_droite: svg(LANCER_BRAS),
  lancer_gauche: svg(flip(LANCER_BRAS)),
  // Médecine-ball par-dessus la tête, comme une touche de football, les pieds parallèles.
  lancer_tete: svg(fig({ head: [72, 56], neck: [72, 65], hip: [72, 100],
    leg: [[72, 100], [80, 112], [81, 123]], farLeg: [[72, 100], [64, 112], [63, 123]],
    arm: [[72, 70], [54, 52], [58, 32]], farArm: [[72, 70], [90, 52], [86, 32]] })
    + ball([72, 18]) + arrow("M94 18 Q138 24 158 60")),
  // ---------- Sauts ----------
  // Saut en extension à 2 pieds, le plus loin possible : mesure à l'arrière de la chaussure.
  saut_horizontal: svg(fig({ head: [92, 46], neck: [92, 55], hip: [86, 84],
    leg: [[86, 84], [112, 86], [128, 96]], farLeg: [[86, 84], [110, 92], [126, 102]],
    arm: [[92, 60], [112, 54], [130, 48]], farArm: [[92, 60], [110, 60], [128, 56]] })
    + dash("M40 108 Q94 48 146 102") + dash("M40 100V118") + dash("M146 102V118")
    + arrow2("M40 118H146") + txt(93, 136, "cm")),
  // Saut à 2 pieds le plus haut possible, les jambes tendues en l'air.
  saut_vertical: svg(fig({ head: [86, 32], neck: [86, 41], hip: [86, 74],
    leg: [[86, 74], [90, 96], [92, 110]], farLeg: [[86, 74], [82, 96], [80, 110]],
    arm: [[86, 50], [98, 34], [102, 20]], farArm: [[86, 50], [74, 34], [70, 20]] })
    + dash("M92 112H150") + dash(`M92 ${G}H150`) + arrow2(`M150 ${G}V112`) + txt(170, 90, "cm")),
  // ---------- Force ----------
  // Force de poigne, mesurée à l'appareil (dynamomètre).
  prehension_d: svg(POIGNE + txt(114, 100, "kg"), true),
  prehension_g: svg(flip(POIGNE) + txt(86, 100, "kg"), true),
  // ---------- Souplesse ----------
  // Assis, jambes tendues : aller chercher le plus loin possible avec les mains.
  // Jambes en trait clair, bras qui va chercher en trait franc : sinon tronc, bras et jambes
  // se referment en un triangle plein où l'on ne distingue plus le geste.
  souplesse_assise: svg(mat
    + line([[56, 112], [126, 118], [132, 106]], L) + line([[56, 112], [128, 113], [134, 100]], L)
    + line([[74, 86], [56, 112]]) + line([[74, 94], [108, 88], [144, 102]])
    + head([78, 80], 8)
    + dash("M134 96V62") + arrow("M140 74H174") + txt(158, 66, "cm")),
  // Debout sur une marche, pointes de pieds au bord : descendre les mains le plus bas possible.
  souplesse_escalier: svg(step(74, 128, 92) + fig({ head: [110, 46], r: 8, neck: [104, 56], hip: [98, 76],
    leg: [[98, 76], [100, 92]], farLeg: [[98, 76], [96, 92]],
    arm: [[103, 60], [112, 86], [118, 110]], farArm: [[103, 60], [108, 88], [114, 112]] })
    + dash("M118 110H156") + dash("M128 92H156") + arrow2("M156 92V110") + txt(176, 104, "cm")),
  // Distance entre les acromions (os de l'épaule) — la mesure de référence du test à la corde.
  dist_epaules: svg(head([100, 40], 11) + line([[100, 54], [100, 106]])
    + line([[74, 62], [126, 62]])
    + line([[74, 62], [68, 94]], L) + line([[126, 62], [132, 94]], L)
    + `<circle cx="74" cy="62" r="4.5" fill="#fff" stroke="${A}" stroke-width="2.4"/><circle cx="126" cy="62" r="4.5" fill="#fff" stroke="${A}" stroke-width="2.4"/>`
    + dash("M74 62V22") + dash("M126 62V22") + arrow2("M74 26H126") + txt(100, 18, "cm"), true),
  // Bras tendus, une corde devant soi, la passer derrière en gardant les mains le plus proches possible.
  // Les mains montent bien au-dessus de la tête et la corde les surplombe : sinon les bras
  // encerclent le visage et la corde se lit comme un chapeau.
  // De profil : les bras montent devant, la corde passe par-dessus la tête et redescend dans le dos.
  // De face, deux bras levés encadrent le visage et la vignette se lit comme une porte, pas comme un geste.
  epaules_corde: svg(fig({ head: [92, 38], r: 9, neck: [92, 47], hip: [92, 86],
    leg: [[92, 86], [86, 106], [82, 123]], farLeg: [[92, 86], [98, 106], [100, 123]],
    arm: [[92, 54], [78, 34], [72, 18]], farArm: [[92, 54], [82, 38], [76, 22]] })
    + `<path d="M72 18 Q118 14 130 54 Q136 80 126 96" stroke="${O}" stroke-width="2.8"/>`
    + `<circle cx="72" cy="18" r="4" fill="#fff" stroke="${B}" stroke-width="2.4"/>`
    + arrow("M52 36 Q70 8 110 12")),
  // Allongé sur le ventre, nez au sol, un bâton tenu à 40 cm : le lever le plus haut possible.
  // Les bras montent franchement, sinon tête, tronc et bras s'alignent en une seule diagonale.
  epaules_poignets: svg(mat + fig({ head: [78, 104], r: 8, neck: [86, 107], hip: [146, 116],
    leg: [[146, 116], [176, 119]], farLeg: [[146, 116], [174, 122]],
    arm: [[96, 110], [72, 90], [56, 68]], farArm: [[96, 110], [70, 96], [54, 76]] })
    + line([[34, 62], [78, 62]], B, 4.5)
    + `<circle cx="50" cy="62" r="3.5" fill="#fff" stroke="${B}" stroke-width="2.2"/><circle cx="64" cy="62" r="3.5" fill="#fff" stroke="${B}" stroke-width="2.2"/>`
    + dash("M34 62H22") + arrow(`M22 ${G - 4}V62`) + txt(36, 46, "le plus haut", 10)),
  // Allongé sur le ventre, bras derrière les oreilles : lever le buste, mesure entre le nez et le sol.
  tronc_cou: svg(mat + fig({ head: [66, 72], r: 8, neck: [74, 81], hip: [146, 118],
    leg: [[146, 118], [178, 120]], farLeg: [[146, 118], [176, 123]],
    arm: [[90, 93], [112, 104], [132, 112]], farArm: [[90, 93], [110, 108], [130, 116]] })
    + dash("M60 76H38") + dash(`M38 ${G - 2}H66`) + arrow2(`M38 76V${G - 2}`) + txt(24, 102, "cm")),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [k, v] of Object.entries(PICTOS)) fs.writeFileSync(`${OUT}/${k}.svg`, v);
console.log(Object.keys(PICTOS).length + " vignettes -> " + OUT);
