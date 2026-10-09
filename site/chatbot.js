// chatbot.js — l'assistant, côté visiteur.
//
// Autonome : aucune dépendance, aucun client Supabase, rien à charger. Il parle
// à trois adresses de l'edge function « chatbot » et c'est tout. S'il échoue à
// n'importe quel moment, il ne s'affiche pas — un site sans bulle vaut mieux
// qu'une bulle qui ne répond pas.
//
// Il ne s'installe QUE sur le site public. Ni la console, ni Mon espace : ce
// bot ne connaît que des données publiques, et le proposer à quelqu'un de
// connecté laisserait croire qu'il voit son dossier.
//
// L'historique vit dans la BASE, pas ici. Le navigateur ne garde que
// l'identifiant de la conversation, pour la retrouver d'une page à l'autre.

import { SUPABASE_URL } from "./config.js";

const API = `${SUPABASE_URL}/functions/v1/chatbot`;
const CLE_CONV = "tl-bot-conv";
const CLE_BULLE = "tl-bot-bulle";   // la bulle d'accueil, refermée pour la visite

// ---------------------------------------------------------------------------
//  Markdown
// ---------------------------------------------------------------------------
// Volontairement minuscule, et surtout : on n'injecte JAMAIS de HTML venu du
// modèle. Tout est échappé d'abord, les quelques balises autorisées sont
// reconstruites ensuite. Un assistant qui écrit dans la page est une surface
// d'attaque ; celui-ci n'écrit que du texte.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Les liens vers notre propre domaine deviennent relatifs : le visiteur reste
// sur le site qu'il parcourt, y compris une préview ou le domaine du tournoi.
function lienLocal(url) {
  try {
    const u = new URL(url, location.href);
    if (u.hostname === location.hostname) return u.pathname + u.search + u.hash;
    if (/(^|\.)teamlausanne\.ch$/i.test(u.hostname)) return u.pathname + u.search + u.hash;
    return u.href;
  } catch { return url; }
}

function enLiens(t) {
  // [texte](url) d'abord, puis les adresses nues qui restent.
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_, txt, url) => {
    const h = url.startsWith("mailto:") ? url : lienLocal(url);
    const ext = /^https?:/.test(h);
    return `<a href="${esc(h)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(txt)}</a>`;
  });
  t = t.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<)]+)/g, (m, av, url) => {
    if (/>$/.test(av)) return m;
    const h = lienLocal(url.startsWith("www.") ? "https://" + url : url);
    const ext = /^https?:/.test(h);
    return `${av}<a href="${esc(h)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(url)}</a>`;
  });
  return t.replace(/(^|[\s(])([\w.+-]+@[\w.-]+\.\w{2,})/g, '$1<a href="mailto:$2">$2</a>');
}

export function md(src) {
  const lignes = String(src || "").split("\n");
  const out = [];
  let liste = false;
  const fermer = () => { if (liste) { out.push("</ul>"); liste = false; } };

  for (const brute of lignes) {
    const l = brute.trim();
    if (!l) { fermer(); continue; }
    // Une ligne entièrement en gras sert de petit titre : c'est ainsi que le
    // modèle structure, et un <p><b> au milieu du texte se lit mal.
    const titre = /^\*\*(.+)\*\*:?$/.exec(l);
    if (titre) { fermer(); out.push(`<b class="bot-h">${enLiens(esc(titre[1]))}</b>`); continue; }
    if (/^[-*]\s+/.test(l)) {
      if (!liste) { out.push("<ul>"); liste = true; }
      out.push(`<li>${gras(enLiens(esc(l.replace(/^[-*]\s+/, ""))))}</li>`);
      continue;
    }
    fermer();
    out.push(`<p>${gras(enLiens(esc(l)))}</p>`);
  }
  fermer();
  return out.join("");
}
const gras = (t) => t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

// ---------------------------------------------------------------------------
//  Le widget
// ---------------------------------------------------------------------------

const SVG_FERMER = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SVG_POUCE = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 11v8H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h3zm0 0 4.5-8a2 2 0 0 1 3.8 1.2L14.5 8h4.3a2 2 0 0 1 2 2.5l-1.8 7A2 2 0 0 1 17 19H7" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';

let conf = null, convId = null, enVol = false, panneau = null, fil = null, champ = null;

const el = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
const bas = () => { if (fil) fil.scrollTop = fil.scrollHeight; };

function ajouter(role, texte, index) {
  const b = el(`<div class="bot-msg bot-${role}"><div class="bot-bulle"></div></div>`);
  b.querySelector(".bot-bulle").innerHTML = role === "bot" ? md(texte) : esc(texte);
  if (role === "bot" && index != null) {
    const p = el(`<div class="bot-pouces">
      <button type="button" class="bot-pouce" data-note="1" aria-label="Réponse utile">${SVG_POUCE}</button>
      <button type="button" class="bot-pouce bot-bas" data-note="-1" aria-label="Réponse pas utile">${SVG_POUCE}</button>
    </div>`);
    p.querySelectorAll(".bot-pouce").forEach((btn) => btn.addEventListener("click", () => {
      p.querySelectorAll(".bot-pouce").forEach((x) => x.classList.remove("choisi"));
      btn.classList.add("choisi");
      fetch(`${API}/feedback`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversation_id: convId, index, note: Number(btn.dataset.note) }) }).catch(() => {});
    }));
    b.appendChild(p);
  }
  fil.appendChild(b); bas();
  return b;
}

async function envoyer(texte) {
  if (enVol || !texte.trim()) return;
  enVol = true;
  champ.value = "";
  champ.style.height = "auto";
  panneau.querySelector(".bot-sugg")?.remove();
  ajouter("moi", texte);
  const attente = el('<div class="bot-msg bot-bot"><div class="bot-bulle bot-points"><i></i><i></i><i></i></div></div>');
  fil.appendChild(attente); bas();

  try {
    const r = await fetch(`${API}/message`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: texte, conversation_id: convId, page: location.hash || "/" }),
    });
    const d = await r.json();
    attente.remove();
    if (d?.reponse) {
      convId = d.conversation_id;
      try { sessionStorage.setItem(CLE_CONV, convId); } catch {}
      ajouter("bot", d.reponse, d.index);
    } else {
      ajouter("bot", d?.error || "Je n'ai pas réussi à répondre. Réessaie dans un instant, ou écris-nous à info@teamlausanne.ch.");
    }
  } catch {
    attente.remove();
    ajouter("bot", "La connexion a échoué. Réessaie, ou écris-nous à info@teamlausanne.ch.");
  } finally {
    enVol = false;
    champ.focus();
  }
}

function construire() {
  const bouton = el(`<button type="button" class="bot-rond" aria-label="Ouvrir l'assistant">
    <img src="assets/logo-academie-blanc.png" alt="" /></button>`);

  panneau = el(`<div class="bot-panneau" role="dialog" aria-modal="false" aria-label="Assistant Team Lausanne" hidden>
    <header class="bot-tete">
      <img src="assets/logo-academie-blanc.png" alt="" />
      <div><b>Team Lausanne</b><span>en ligne</span></div>
      <button type="button" class="bot-x" aria-label="Fermer">${SVG_FERMER}</button>
    </header>
    <div class="bot-fil"></div>
    <form class="bot-pied">
      <textarea rows="1" placeholder="Pose ta question…" maxlength="800" aria-label="Votre question"></textarea>
      <button type="submit" aria-label="Envoyer">↑</button>
    </form>
    <p class="bot-note">Assistant automatique — il peut se tromper. Pour une demande personnelle,
      écris à <a href="mailto:info@teamlausanne.ch">info@teamlausanne.ch</a>.</p>
  </div>`);

  document.body.append(bouton, panneau);
  fil = panneau.querySelector(".bot-fil");
  champ = panneau.querySelector("textarea");

  // La bulle d'accueil : une seule fois par visite, refermable.
  let bulle = null;
  try {
    if (!sessionStorage.getItem(CLE_BULLE) && conf.accueil) {
      bulle = el(`<div class="bot-bulle-accueil"><p></p><button type="button" aria-label="Masquer">${SVG_FERMER}</button></div>`);
      bulle.querySelector("p").textContent = conf.accueil;
      bulle.querySelector("button").addEventListener("click", (e) => {
        e.stopPropagation();
        bulle.remove();
        try { sessionStorage.setItem(CLE_BULLE, "1"); } catch {}
      });
      bulle.addEventListener("click", () => ouvrir());
      document.body.appendChild(bulle);
      setTimeout(() => bulle.classList.add("vu"), 900);
    }
  } catch {}

  function ouvrir() {
    bulle?.remove();
    try { sessionStorage.setItem(CLE_BULLE, "1"); } catch {}
    panneau.hidden = false;
    document.documentElement.classList.add("bot-ouvert");
    if (!fil.children.length) {
      if (conf.accueil) ajouter("bot", conf.accueil);
      const s = (conf.suggestions || []).slice(0, 6);
      if (s.length) {
        const sg = el('<div class="bot-sugg"></div>');
        for (const q of s) {
          const b = el(`<button type="button"></button>`);
          b.textContent = q;
          b.addEventListener("click", () => envoyer(q));
          sg.appendChild(b);
        }
        fil.appendChild(sg);
      }
    }
    bas();
    setTimeout(() => champ.focus(), 50);
  }
  function fermer() {
    panneau.hidden = true;
    document.documentElement.classList.remove("bot-ouvert");
  }

  bouton.addEventListener("click", () => (panneau.hidden ? ouvrir() : fermer()));
  panneau.querySelector(".bot-x").addEventListener("click", fermer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panneau.hidden) fermer(); });

  panneau.querySelector(".bot-pied").addEventListener("submit", (e) => { e.preventDefault(); envoyer(champ.value); });
  // Entrée envoie, Maj+Entrée va à la ligne — comme partout ailleurs.
  champ.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(champ.value); }
  });
  // Le champ grandit avec le texte, jusqu'à cinq lignes.
  champ.addEventListener("input", () => {
    champ.style.height = "auto";
    champ.style.height = Math.min(champ.scrollHeight, 120) + "px";
  });
}

// ---------------------------------------------------------------------------

(async function demarrer() {
  // Jamais sur la console ni sur Mon espace : ce bot ne sait que du public.
  if (/\/(console|admin|espace)/.test(location.pathname)) return;
  try {
    const r = await fetch(`${API}/config`);
    conf = await r.json();
  } catch { return; }                      // injoignable : pas de bulle, pas de bouton
  if (!conf || conf.bot !== "maison") return;   // éteint en console : rien ne s'affiche
  try { convId = sessionStorage.getItem(CLE_CONV); } catch {}
  construire();
})();
