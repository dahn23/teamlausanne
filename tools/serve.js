// Petit serveur statique pour regarder la console et Mon espace en local (node tools/serve.js).
// Ne sert qu'au développement : en production, Netlify sert le dossier tel quel.
// Deux sites vivent dans ce dépôt : la racine (console + Mon espace) et site/
// (le site public, publié par Netlify avec « site » comme dossier de base).
// Les chemins du site public sont relatifs à SON dossier : servi depuis la
// racine, sous /site/, style.css et index.js partent chercher /site/style.css
// — et tout tombe en 404. D'où un dossier et un port en arguments :
//   node tools/serve.js            → la racine sur 4173 (console, Mon espace)
//   node tools/serve.js site 4174  → le site public sur 4174
const http = require("http"), fs = require("fs"), path = require("path");
const SOUS = process.argv[2] || "";
const PORT = Number(process.argv[3]) || 4173;
const RACINE = path.resolve(__dirname, "..", SOUS);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  // Ces deux raccourcis n'ont de sens qu'à la racine du dépôt : sur le site
  // public, « / » c'est l'accueil.
  if (p === "/") p = SOUS ? "/index.html" : "/connexion.html";
  if (!SOUS && p === "/console") p = "/admin.html";
  const f = path.join(RACINE, p);
  if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" }); res.end("404 " + p); return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream",
    "cache-control": "no-store" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (dossier : ${RACINE})`));
