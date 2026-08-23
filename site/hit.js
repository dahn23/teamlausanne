// =====================================================================
//  Mesure de fréquentation — volontairement minimale.
//  Aucun cookie, aucune adresse IP, aucun service tiers : le navigateur
//  tire un identifiant aléatoire une fois pour toutes et le garde dans son
//  stockage local. On compte donc des appareils et des pages, jamais des
//  personnes. Si le stockage est refusé (navigation privée), la visite
//  n'est simplement pas comptée — rien ne casse.
// =====================================================================
import { sb } from "./common.js";

const CLE = "lo_visitor";

function visiteur() {
  try {
    let v = localStorage.getItem(CLE);
    if (!v) {
      v = (crypto.randomUUID && crypto.randomUUID()) ||
          "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
          });
      localStorage.setItem(CLE, v);
    }
    return v;
  } catch { return null; }
}

/** Enregistre une vue. N'échoue jamais bruyamment : la mesure ne doit
 *  jamais empêcher la page de s'afficher. */
export function hit(site, page, lang) {
  const v = visiteur();
  if (!v) return;
  sb.rpc("lo_hit", { p_site: site, p_page: page, p_visitor: v, p_lang: lang || null })
    .then(() => {}, () => {});
}
