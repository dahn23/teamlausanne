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
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".mp4": "video/mp4", ".pdf": "application/pdf",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2", ".avif": "image/avif", ".gif": "image/gif" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  // Ces deux raccourcis n'ont de sens qu'à la racine du dépôt : sur le site
  // public, « / » c'est l'accueil.
  if (p === "/") p = SOUS ? "/index.html" : "/connexion.html";
  if (!SOUS && p === "/console") p = "/admin.html";
  let f = path.join(RACINE, p);
  // Netlify sert « /sport-etudes » depuis sport-etudes.html et « /en/ » depuis
  // en/index.html. Ce serveur-ci ne le faisait pas : toute adresse publique
  // tombait en 404 en local, donc on ne pouvait PAS relire le site chez soi —
  // et c'est ainsi que trois bogues d'affichage sont partis en production le
  // 25.11.2026, vérifiés au curl faute de pouvoir les ouvrir.
  // ⚠ Essayer « .html » AVANT « /index.html » : c'est l'ordre de Netlify, et
  // les pages sont posées à plat exprès (voir build.mjs).
  const existe = (x) => fs.existsSync(x) && !fs.statSync(x).isDirectory();
  if (!existe(f)) {
    const candidats = [f + ".html", path.join(f, "index.html"),
      // Et comme en production, une adresse inconnue rend 404.html — avec le
      // VRAI code 404, sinon un lien mort passerait pour une page valide.
      path.join(RACINE, "404.html")];
    f = candidats.find(existe) || f;
  }
  if (!f.startsWith(RACINE) || !existe(f)) {
    res.writeHead(404, { "content-type": "text/plain" }); res.end("404 " + p); return;
  }
  if (path.basename(f) === "404.html" && !p.endsWith("404.html")) {
    res.writeHead(404, { "content-type": TYPES[".html"], "cache-control": "no-store" });
    fs.createReadStream(f).pipe(res); return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream",
    "cache-control": "no-store" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (dossier : ${RACINE})`));
