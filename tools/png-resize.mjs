// Redimensionne un PNG 8 bits non entrelace sans dependance : zlib suffit.
// Sert a fabriquer le logo du pied de mail (160 px) depuis l'original 1024 px.
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const [, , src, dst, largeurVoulue] = process.argv;
const buf = readFileSync(src);
if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("pas un PNG");

let p = 8, W = 0, H = 0, prof = 0, type = 0, entrelace = 0;
const idat = [];
while (p < buf.length) {
  const len = buf.readUInt32BE(p), nom = buf.toString("ascii", p + 4, p + 8);
  const data = buf.subarray(p + 8, p + 8 + len);
  if (nom === "IHDR") {
    W = data.readUInt32BE(0); H = data.readUInt32BE(4);
    prof = data[8]; type = data[9]; entrelace = data[12];
  } else if (nom === "IDAT") idat.push(data);
  else if (nom === "IEND") break;
  p += 12 + len;
}
if (prof !== 8 || entrelace !== 0) throw new Error(`profondeur ${prof} / entrelace ${entrelace} non gere`);
const canaux = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
if (!canaux) throw new Error(`type de couleur ${type} non gere`);

// Defiltrage : chaque ligne porte son filtre en tete (PNG 9.2).
const brut = inflateSync(Buffer.concat(idat));
const pas = W * canaux, px = Buffer.alloc(H * pas);
for (let y = 0; y < H; y++) {
  const f = brut[y * (pas + 1)];
  const ligne = brut.subarray(y * (pas + 1) + 1, y * (pas + 1) + 1 + pas);
  for (let x = 0; x < pas; x++) {
    const a = x >= canaux ? px[y * pas + x - canaux] : 0;
    const b = y > 0 ? px[(y - 1) * pas + x] : 0;
    const c = x >= canaux && y > 0 ? px[(y - 1) * pas + x - canaux] : 0;
    let v = ligne[x];
    if (f === 1) v += a;
    else if (f === 2) v += b;
    else if (f === 3) v += (a + b) >> 1;
    else if (f === 4) {
      const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
      v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
    }
    px[y * pas + x] = v & 255;
  }
}

// Reduction par moyenne de boite : plus propre qu'un echantillonnage simple
// sur un logo a aplats, ou le crenelage se verrait tout de suite.
const NW = Math.max(1, parseInt(largeurVoulue, 10));
const NH = Math.max(1, Math.round(H * NW / W));
const npas = NW * canaux, sortie = Buffer.alloc(NH * (npas + 1));
for (let y = 0; y < NH; y++) {
  sortie[y * (npas + 1)] = 0;
  const y0 = Math.floor(y * H / NH), y1 = Math.max(y0 + 1, Math.floor((y + 1) * H / NH));
  for (let x = 0; x < NW; x++) {
    const x0 = Math.floor(x * W / NW), x1 = Math.max(x0 + 1, Math.floor((x + 1) * W / NW));
    for (let c = 0; c < canaux; c++) {
      let s = 0, n = 0;
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) { s += px[yy * pas + xx * canaux + c]; n++; }
      sortie[y * (npas + 1) + 1 + x * canaux + c] = Math.round(s / n);
    }
  }
}

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc = (b) => { let c = -1; for (const o of b) c = crcTable[(c ^ o) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (nom, data) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
  const nd = Buffer.concat([Buffer.from(nom, "ascii"), data]);
  const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(nd));
  return Buffer.concat([l, nd, cc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(NW, 0); ihdr.writeUInt32BE(NH, 4);
ihdr[8] = 8; ihdr[9] = type; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
writeFileSync(dst, Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(sortie, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]));
console.log(`${W}x${H} -> ${NW}x${NH}, ${readFileSync(dst).length} octets`);
