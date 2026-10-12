// Sous-titres animés Team Lausanne (style TikTok) à partir de la transcription Whisper, mot par mot.
//   1) whisper-cli -m <modèle> -l fr -f audio.wav -ml 1 -sow -oj -of mots      (un mot par segment, en JSON)
//   2) deno run -A soustitres.ts mots.json sortie.ass [9x16|4x5|16x9] [debut_s fin_s]
//   3) ffmpeg … -vf "subtitles=sortie.ass:fontsdir=<kit>/fonts" …
// Rendu : 2 à 4 mots à la fois, en Noto Sans Black blanc, contour bleu prusse ; le mot prononcé passe en vert
// (Energizing Mint Green). Un extrait (debut/fin en secondes) ramène les temps à zéro.
const [inJson, outAss, format = "9x16", debutS, finS] = Deno.args;
if (!inJson || !outAss) { console.error("usage : soustitres.ts mots.json sortie.ass [9x16|4x5|16x9] [debut fin]"); Deno.exit(1); }
const DIM: Record<string, [number, number]> = { "9x16": [1080, 1920], "4x5": [1080, 1350], "16x9": [1920, 1080], "1x1": [1080, 1080] };
const [W, H] = DIM[format] || DIM["9x16"];
const t0 = debutS ? Number(debutS) : 0, t1 = finS ? Number(finS) : Infinity;

type Mot = { t: string; a: number; b: number };
const j = JSON.parse(await Deno.readTextFile(inJson));
const ms = (s: string) => { const [h, m, r] = s.replace(",", ".").split(":"); return (+h * 3600 + +m * 60 + parseFloat(r)); };
let mots: Mot[] = (j.transcription || []).map((s: { text: string; timestamps: { from: string; to: string } }) =>
  ({ t: String(s.text).trim(), a: ms(s.timestamps.from), b: ms(s.timestamps.to) }))
  .filter((m: Mot) => m.t && !/^\[.*\]$/.test(m.t));
// Ponctuation isolée (« , » « . ») : on la recolle au mot précédent.
mots = mots.reduce((acc: Mot[], m) => { if (/^[,.;:!?…»)]+$/.test(m.t) && acc.length) { acc[acc.length - 1].t += m.t; acc[acc.length - 1].b = m.b; } else acc.push({ ...m }); return acc; }, []);
// Noms propres que Whisper écorche (compléter au besoin).
const CORR: Record<string, string> = { lauzanne: "Lausanne", lozanne: "Lausanne", "game zone": "GameZone", gamezone: "GameZone", academie: "Academy", pleineduloup: "Plaines-du-Loup", pleinduloup: "Plaines-du-Loup", plainesduloup: "Plaines-du-Loup", plaineduloup: "Plaines-du-Loup" };
mots = mots.map((m) => { const k = m.t.toLowerCase().replace(/[^a-zà-ÿ ]/g, ""); const c = CORR[k]; return c ? { ...m, t: m.t.replace(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ-]*/, c) } : m; });
mots = mots.filter((m) => m.b > t0 && m.a < t1).map((m) => ({ ...m, a: Math.max(0, m.a - t0), b: Math.min(t1, m.b) - t0 }));

// Groupes de 2 à 4 mots, coupés à la ponctuation forte, aux pauses (> 0,45 s) ou au-delà de ~18 caractères.
const groupes: Mot[][] = []; let g: Mot[] = [];
for (const m of mots) {
  const len = g.reduce((n, x) => n + x.t.length + 1, 0) + m.t.length;
  const pause = g.length && m.a - g[g.length - 1].b > 0.45;
  if (g.length && (g.length >= 4 || len > 18 || pause)) { groupes.push(g); g = []; }
  g.push(m);
  if (/[.!?]$/.test(m.t)) { groupes.push(g); g = []; }
}
if (g.length) groupes.push(g);

const tc = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return `${h}:${String(m).padStart(2, "0")}:${x.toFixed(2).padStart(5, "0")}`; };
const escA = (s: string) => s.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")");
const fs = format === "16x9" ? 80 : 112;                      // taille du texte
const marge = format === "16x9" ? 110 : Math.round(H * 0.24); // hauteur depuis le bas (au-dessus de l'interface Insta/TikTok)
// Couleurs ASS en &HBBGGRR& : blanc, vert #B2FD13 → &H13FDB2&, bleu prusse #003652 → &H523600&
const VERT = "&H13FDB2&";
let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TL,Noto Sans Black,${fs},&H00FFFFFF,&H00FFFFFF,&H00523600,&H64523600,0,0,0,0,100,100,0,0,1,8,3,2,60,60,${marge},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
groupes.forEach((grp, gi) => {
  const prochain = gi + 1 < groupes.length ? groupes[gi + 1][0].a : Infinity;
  for (let i = 0; i < grp.length; i++) {
    const a = grp[i].a, b = i + 1 < grp.length ? grp[i + 1].a : Math.min(grp[i].b + 0.15, prochain);
    if (b <= a) continue;
    // Majuscules sur les MOTS seulement (les codes ASS comme \c sont sensibles à la casse).
    const txt = grp.map((m, k) => k === i ? `{\\c${VERT}}${escA(m.t.toUpperCase())}{\\c&HFFFFFF&}` : escA(m.t.toUpperCase())).join(" ");
    // Petit « pop » sur le premier mot du groupe.
    const pop = i === 0 ? "{\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}" : "";
    ass += `Dialogue: 0,${tc(a)},${tc(b)},TL,,0,0,0,,${pop}${txt}\n`;
  }
});
await Deno.writeTextFile(outAss, ass);
console.log(`✓ ${outAss} — ${mots.length} mots, ${groupes.length} groupes`);
