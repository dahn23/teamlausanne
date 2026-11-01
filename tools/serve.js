// Petit serveur statique pour regarder la console et Mon espace en local (node tools/serve.js).
// Ne sert qu'au développement : en production, Netlify sert le dossier tel quel.
const http = require("http"), fs = require("fs"), path = require("path");
const RACINE = path.resolve(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/connexion.html";
  if (p === "/console") p = "/admin.html";
  const f = path.join(RACINE, p);
  if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" }); res.end("404 " + p); return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream",
    "cache-control": "no-store" });
  fs.createReadStream(f).pipe(res);
}).listen(4173, () => console.log("http://localhost:4173"));
