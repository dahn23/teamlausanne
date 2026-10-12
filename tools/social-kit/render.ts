// Rendu d'un modèle du kit en image PNG, avec Chrome sans fenêtre.
//   deno run --allow-read --allow-write --allow-run render.ts <modele> <donnees.json> <sortie.png> [largeur hauteur] [--transparent]
//   ex. deno run -A render.ts story-annonce exemples/annonce.json sortie/annonce.png
// Les chemins de photos dans le JSON : absolus (C:/…) ; ils sont convertis en file:///.
const [modele, json, out, w = "1080", h = "1920", ...rest] = Deno.args;
if (!modele || !json || !out) { console.error("usage : render.ts <modele> <donnees.json> <sortie.png> [largeur hauteur] [--transparent]"); Deno.exit(1); }
const transparent = rest.includes("--transparent") || w === "--transparent" || h === "--transparent";
const KIT = decodeURIComponent(new URL(".", import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const abs = (p: string) => /^[A-Za-z]:[\\/]/.test(p) ? p.replace(/\\/g, "/") : `${Deno.cwd().replace(/\\/g, "/")}/${p}`;
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"]
  .find((p) => { try { Deno.statSync(p); return true; } catch { return false; } });
if (!CHROME) { console.error("Chrome introuvable"); Deno.exit(1); }
const fileUrl = (p: string) => /^(https?|file|data):/.test(p) ? p : "file:///" + encodeURI(abs(p).replace(/^\/+/, ""));
const data = JSON.parse(await Deno.readTextFile(json));
// Toute valeur « photo » (aussi dans les listes) devient une URL de fichier ; un chemin relatif part du dossier du JSON.
const jsonDir = abs(json).replace(/[^/]+$/, "");
const photoUrl = (p: string) => /^(https?|file|data):/.test(p) || /^[A-Za-z]:[\\/]/.test(p) ? fileUrl(p) : fileUrl(jsonDir + p);
const fix = (o: unknown): unknown => Array.isArray(o) ? o.map(fix)
  : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === "photo" && typeof v === "string" ? photoUrl(v) : fix(v)])) : o;
const url = `${fileUrl(`${KIT}templates/${modele}.html`)}#${encodeURIComponent(JSON.stringify(fix(data)))}`;
const width = /^\d+$/.test(w) ? w : "1080", height = /^\d+$/.test(h) ? h : "1920";
const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--virtual-time-budget=4000",
  `--window-size=${width},${height}`, `--screenshot=${abs(out)}`, url];
if (transparent) args.splice(3, 0, "--default-background-color=00000000");
const r = await new Deno.Command(CHROME, { args, stdout: "null", stderr: "null" }).output();
console.log(r.success ? `✓ ${out}` : "✗ échec du rendu");
