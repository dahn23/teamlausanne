// Site public dynamique : mondes + pages détaillées (routage par ancre).
import { sb } from "./sb.js";
// ⚠ Ce dossier est publié sur un site Netlify SÉPARÉ (base directory = club) :
// il ne doit JAMAIS importer common.js / config.js de la racine, que cet
// autre site ne sert pas. Même règle que open/ (cf. CLAUDE.md).
const APP = "https://app.teamlausanne.ch";              // réservation et comptes
const frDate = (iso) => { const [a, m, j] = String(iso).slice(0, 10).split("-"); return `${j}.${m}.${a}`; };
import "./pretty-select.js";
import "./pretty-date.js";

const $ = (id) => document.getElementById(id);
const CONTACT_TARGET = "info@teamlausanne.ch"; // destinataire de tous les formulaires
const FLAG_CH = '<svg class="flag" viewBox="0 0 16 16" width="15" height="15" aria-label="Suisse"><rect width="16" height="16" fill="#d52b1e"/><rect x="6.6" y="3" width="2.8" height="10" fill="#fff"/><rect x="3" y="6.6" width="10" height="2.8" fill="#fff"/></svg>';
const FLAG_IE = '<svg class="flag" viewBox="0 0 16 16" width="15" height="15" aria-label="Irlande"><rect width="16" height="16" fill="#fff"/><rect width="5.33" height="16" fill="#169b62"/><rect x="10.67" width="5.33" height="16" fill="#ff883e"/></svg>';
const FLAG_FR = '<svg class="flag" viewBox="0 0 16 16" width="15" height="15" aria-label="France"><rect width="16" height="16" fill="#fff"/><rect width="5.33" height="16" fill="#0055a4"/><rect x="10.67" width="5.33" height="16" fill="#ef4135"/></svg>';
const ITF_URL = "https://www.itftennis.com/en/tournament/m25-lausanne/sui/2026/m-itf-sui-2026-004/";
const GAMEZONE_URL = "https://www.mytennis.ch/fr/tournois?keyword=gamezone";

// ===================================================================
//  MONDES
// ===================================================================
const WORLDS = {
  club: {
    tag: "Le Club", logo: "assets/logo-club.webp",
    slogan: "Votre club, toute l'année.",
    desc: "Le club de tennis historique de Lausanne, aux Plaines-du-Loup depuis 1911. Devenez membre, jouez toute l'année et vivez la compétition en interclubs.",
    hero: "assets/club/hero-balls.jpg",
    cta: [{ label: "Réserver un court", type: "login" }],
    sections: [
      { type: "split", anchor: "cotisation", title: "Votre club, toute l'année", photo: "assets/club/club-racket.jpg", body: [
        "Devenez membre du Lausanne-Sports Tennis : jouez librement sur tous les courts extérieurs durant tout l'été, et profitez de conditions avantageuses sur les courts couverts en hiver.",
        "L'adhésion est payante (cotisation annuelle). Elle vous ouvre la réservation en ligne, le club-house et le restaurant, au cœur des Plaines-du-Loup.",
      ], link: { label: "Réserver un court", action: "login" } },
      { type: "carousel", eyebrow: "Le club", title: "Jouer toute l'année, à deux pas du centre",
        sub: "Devenez membre et profitez de tous les courts, du club-house et de la compétition.",
        items: [
          { name: "Devenir membre", photo: "assets/club/devenir-membre.png", href: "#devenir-membre" },
          { name: "Jouer librement", photo: "assets/club/jouer-librement.jpg", login: true },
          { name: "Plan des courts", photo: "assets/club/plan-courts.webp", plan: true },
          { name: "Interclubs 2027", photo: "assets/club/interclubs.jpg" },
          { name: "Interclubs juniors 2027", photo: "assets/club/interclubs-juniors.jpg" },
        ]},
      { type: "instagram", anchor: "vie", title: "Vie du club", handle: "team_lausanne_academy",
        photos: ["assets/webflow/tennis-day.webp", "assets/webflow/prog-club.webp",
          "assets/webflow/coaching-technique.jpg", "assets/webflow/physical-training.jpg",
          "assets/webflow/stage-development.webp", "assets/webflow/cta-young.jpg"] },
      { type: "agenda", anchor: "agenda", title: "Agenda du club", items: [
        { date: "2 mai", title: "Apéro d'ouverture", detail: "& 1ʳᵉ rencontre de LNB" },
        { date: "5 juin", title: "Buffet canadien", detail: "Joue avec la LNB !" },
        { date: "28 juil. – 2 août", title: "Short Set Open", detail: "" },
        { date: "23 – 30 août", title: "Lausanne Open", detail: "" },
        { date: "Fin septembre", title: "Tournoi interne", detail: "" },
        { date: "Fin septembre", title: "Assemblée générale", detail: "" },
        { date: "À venir", title: "Repas de soutien", detail: "" },
      ] },
      { type: "timeline", title: "Notre histoire", items: [
        ["1911", "Fondation par des personnalités du Montriond F.C. Premier court au chemin du Signal, puis deux courts aux Plaines-du-Loup."],
        ["1939", "Le club compte déjà 8 terrains."],
        ["1954", "12 terrains et installation sur le site du Stade de la Pontaise."],
        ["1965–1980", "Âge d'or : champion de Suisse en 1965, 1967, 1968, 1974 et 1980 — 12 titres, 3ᵉ du palmarès de Ligue nationale A."],
        ["1980", "Inauguration du club-house actuel."],
        ["1991", "Première bulle hivernale."],
        ["2004", "Halle couverte avec deux courts en synthétique."],
      ], note: "Le club a vu passer de grands noms : Thierry Grin (finaliste de Coupe Davis 1992), Marie-Gaïané Mikaelian et Timea Bacsinszky." },
      { type: "features", anchor: "installations", title: "Nos installations", items: [
        ["12 courts", "8 en terre battue, 2 en dur (halle), 2 en synthétique."],
        ["Bulle d'hiver", "4 courts en terre battue couverts et chauffés l'hiver."],
        ["Restaurant", "Restauration et club-house ouverts aux membres et visiteurs."],
        ["Réservation en ligne", "Réservez votre terrain d'un clic, depuis votre mobile."],
      ]},
      { type: "committee", anchor: "comite", title: "Le comité",
        members: [["Kazem Huber", "Président"], ["Bertrand Gygax", "Vice-président"],
          ["Arsalan Huber", "Trésorier"], ["Laurent Aubert", "Infrastructures"],
          ["Philémon Isakov", "Compétition"], ["Loïc Colotti", "Communication"],
          ["Serge Devaud", "Membre consultant"]],
        honor: ["Serge Devaud", "Françoise Tribolet", "Remo Zeraschi"] },
      { type: "restaurant", anchor: "resto", title: "Restaurant du Tennis Lausanne-Sports",
        body: [
          "Chez Paco & Victor — le club-house et son restaurant vous accueillent au cœur des Plaines-du-Loup, membres comme visiteurs.",
          "Formule à volonté · Terrasse · Idéal pour regarder le sport. À deux pas des courts, pour se retrouver avant ou après le jeu.",
        ],
        phone: "+41 21 646 13 48",
        hours: "Lun 07h30–20h00 · Mar–Ven 07h30–00h00 · Sam–Dim 09h00–19h00" },
      { type: "contact", anchor: "contact", title: "Contact & accès",
        lines: ["Lausanne-Sports Tennis", "Stade de la Pontaise", "Route des Plaines-du-Loup 7", "1018 Lausanne"],
        phone: "+41 21 646 13 50", contact: "Club — Contact", hours: "Secrétariat : lun–ven, 9h00–12h00 & 13h00–17h00" },
    ],
  },

};

// ===================================================================
//  PAGES DÉTAILLÉES
// ===================================================================
const DETAILS = {
  "devenir-membre": {
    world: "club", title: "Devenir membre", subtitle: "Rejoignez le Lausanne-Sports Tennis aux Plaines-du-Loup",
    hero: "assets/club/devenir-hero.jpg",
    sections: [
      { type: "rich", title: "Jouez toute l'année", body: [
        "En devenant membre du Lausanne-Sports Tennis, vous jouez librement sur les courts extérieurs tout l'été et profitez de conditions avantageuses sur les courts couverts en hiver.",
        "L'adhésion vous ouvre la réservation en ligne, le club-house et le restaurant, au cœur des Plaines-du-Loup.",
      ]},
      { type: "pricing", title: "Tarifs d'adhésion — Cotisations", items: [
        ["Actifs", "420.00 CHF"], ["Couples", "700.00 CHF"], ["Familles", "800.00 CHF"],
        ["Étudiants, apprentis (25 ans max)", "270.00 CHF"], ["Juniors (jusqu'à 18 ans)", "150.00 CHF"],
        ["Enfants (jusqu'à 12 ans)", "90.00 CHF"], ["Membres passifs", "60.00 CHF"],
      ], note: "Cotisation annuelle. La demande ci-dessous ne vaut pas paiement : le secrétariat vous recontacte pour finaliser." },
      { type: "memberform", title: "Demande d'adhésion",
        lead: "Remplissez le formulaire, le secrétariat revient vers vous pour finaliser votre adhésion." },
    ],
  },
};

// ===================================================================
//  RENDU
// ===================================================================
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function linkHTML(link) {
  if (!link) return "";
  if (link.action === "login")
    return `<button class="wsec-link" data-login>${esc(link.label)}</button>`;
  if (link.contact)
    return `<button class="contact-cta" data-contact="${esc(link.contact)}">${esc(link.label)}</button>`;
  if (link.scroll)
    return `<button class="contact-cta" data-scroll="${esc(link.scroll)}">${esc(link.label)}</button>`;
  const ext = link.href.startsWith("http");
  return `<a class="wsec-link" href="${esc(link.href)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(link.label)}</a>`;
}

function sectionWrap(sec) {
  let html = sectionHTML(sec);
  if (sec.anchor) html = html.replace("<section ", `<section data-anchor="${sec.anchor}" `);
  return html;
}

function sectionHTML(sec) {
  switch (sec.type) {
    case "split":
      return `<section class="split${sec.video ? " split-hasvideo" : ""}">
        ${sec.video
          ? `<div class="split-media split-video"><iframe src="https://www.youtube.com/embed/${esc(sec.video)}" title="${esc(sec.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
          : `<div class="split-media" style="background-image:url('${sec.photo}')"></div>`}
        <div class="split-body"><h2>${esc(sec.title)}</h2>
          ${sec.body.map((p) => `<p>${esc(p)}</p>`).join("")}${linkHTML(sec.link)}</div>
      </section>`;

    case "features":
      return `<section class="wsec">${sec.title ? `<h2>${esc(sec.title)}</h2>` : ""}
        <div class="feature-grid">${sec.items.map(([h, t]) =>
          `<div class="feature"><h3>${esc(h)}</h3><p>${esc(t)}</p></div>`).join("")}</div>
        ${linkHTML(sec.link)}</section>`;

    case "cards":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="card-grid">${sec.items.map((o) =>
          `<a class="pcard" href="${esc(o.href)}">
            <div class="pcard-media" style="background-image:url('${o.photo}')"></div>
            <div class="pcard-body"><div class="offer-top"><h3>${esc(o.name)}</h3>
              ${o.meta ? `<span class="offer-meta">${esc(o.meta)}</span>` : ""}</div>
              <p>${esc(o.detail)}</p><span class="pcard-more">En savoir plus →</span></div>
          </a>`).join("")}</div></section>`;

    case "offers":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="offer-grid">${sec.items.map((o) =>
          `<div class="offer"><div class="offer-top"><h3>${esc(o.name)}</h3>
            ${o.meta ? `<span class="offer-meta">${esc(o.meta)}</span>` : ""}</div>
            <p>${esc(o.detail)}</p></div>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "timeline":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="timeline">${sec.items.map(([y, t]) =>
          `<div class="tl-row"><div class="tl-year">${esc(y)}</div><div class="tl-text">${esc(t)}</div></div>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "committee":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="committee">${sec.members.map(([n, r]) =>
          `<div class="cm"><b>${esc(n)}</b><span>${esc(r)}</span></div>`).join("")}</div>
        ${sec.honor ? `<p class="wsec-note">Membres d'honneur : ${sec.honor.map(esc).join(" · ")}</p>` : ""}</section>`;

    case "contact":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="contact-card"><p>${sec.lines.map(esc).join("<br>")}</p>
          <p><a href="tel:${esc(sec.phone.replace(/\s/g, ""))}">${esc(sec.phone)}</a></p>
          ${sec.hours ? `<p class="muted">${esc(sec.hours)}</p>` : ""}
          <button class="contact-cta" data-contact="${esc(sec.contact || sec.title)}">Nous écrire</button></div></section>`;

    case "rich":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="rich">${sec.body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}${linkHTML(sec.link)}</section>`;

    case "stats":
      return `<section class="wsec"><div class="stat-row">${sec.items.map(([b, s]) =>
        `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("")}</div></section>`;

    case "podium":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="podium">${sec.items.map(([n, w], i) =>
          `<div class="pod pod-${i + 1}"><div class="pod-rank">${esc(String(w))}</div>
            <b>${esc(n)}</b><span>victoires</span></div>`).join("")}</div>
        ${linkHTML(sec.link)}</section>`;

    case "ranking":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <table class="ranking"><thead><tr>${sec.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${sec.rows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "sponsors":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="sponsor-wall">${sec.items.map((n) =>
          `<div class="sponsor">${esc(n)}</div>`).join("")}</div></section>`;

    case "carousel": {
      const pill = (o) => {
        const inner = `${esc(o.name)}<span class="ccard-arrow" aria-hidden="true">↗</span>`;
        if (o.plan) return `<button class="ccard-pill" data-plan="${esc(o.photo)}">${inner}</button>`;
        if (o.login) return `<button class="ccard-pill" data-login>${inner}</button>`;
        if (o.goto) return `<button class="ccard-pill" data-goto="${esc(o.goto.world)}" data-anchor="${esc(o.goto.anchor)}">${inner}</button>`;
        if (!o.href) return `<span class="ccard-pill ccard-pill-static">${inner}</span>`;
        const ext = o.href.startsWith("http");
        const tgt = ext ? ' target="_blank" rel="noopener"' : "";
        return `<a class="ccard-pill" href="${esc(o.href)}"${tgt}>${inner}</a>`;
      };
      return `<section class="wsec carousel-sec">
        <div class="carousel-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.sub ? `<p class="carousel-sub">${esc(sec.sub)}</p>` : ""}
        </div>
        <div class="carousel">${sec.items.map((o) =>
          `<article class="ccard"><div class="ccard-media${o.plan ? " ccard-media-plan" : ""}" style="background-image:url('${o.photo}')"></div>
            ${pill(o)}</article>`).join("")}</div></section>`;
    }

    case "formules":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.intro ? `<p class="stg-intro">${sec.intro}</p>` : ""}
        <div class="formula-grid">${sec.items.map((f) =>
          `<div class="formula${f.pro ? " formula-pro" : ""}"><h3>${esc(f.name)}</h3>
            <div class="formula-age">${esc(f.age)}</div>
            <ul>${f.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
            <div class="formula-price">${esc(f.price)}</div></div>`).join("")}</div>
        ${linkHTML(sec.link)}</section>`;

    case "stageform":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div id="stgp-list" class="stg-pub-list"><p class="muted">Chargement…</p></div></section>`;

    case "pricing":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="pricing-list">${sec.items.map(([label, price]) =>
          `<div class="pricing-row"><span class="pl-label">${esc(label)}</span><span class="pl-dots"></span><span class="pl-price">${esc(price)}</span></div>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "memberform":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.lead ? `<p class="muted" style="max-width:640px;margin:-6px 0 22px">${esc(sec.lead)}</p>` : ""}
        <form id="member-form" class="cform" style="max-width:720px">
          <div class="cf-row">
            <label class="cf-field"><span>Prénom</span><input type="text" id="m-first" required /></label>
            <label class="cf-field"><span>Nom</span><input type="text" id="m-last" required /></label>
          </div>
          <div class="cf-row">
            <label class="cf-field"><span>Email</span><input type="email" id="m-email" autocomplete="email" required /></label>
            <label class="cf-field"><span>Téléphone</span><input type="tel" id="m-phone" autocomplete="tel" required /></label>
          </div>
          <div class="cf-row">
            <label class="cf-field"><span>Date de naissance</span><input type="date" id="m-birth" required /></label>
            <label class="cf-field"><span>Adresse</span><input type="text" id="m-address" required /></label>
          </div>
          <div class="cf-row">
            <label class="cf-field"><span>NPA</span><input type="text" id="m-npa" required /></label>
            <label class="cf-field"><span>Localité</span><input type="text" id="m-city" required /></label>
          </div>
          <label class="cf-field"><span>Message</span><textarea id="m-message" rows="3"></textarea></label>
          <label class="m-consent"><input type="checkbox" id="m-consent" required />
            <span>J'ai lu et j'accepte le <a href="assets/Reglement_TCLS_2026.pdf" target="_blank" rel="noopener">règlement du club (PDF)</a>.</span></label>
          <button type="submit" id="m-btn">Envoyer ma demande d'adhésion</button>
          <p id="m-error" class="error" hidden></p>
        </form>
        <div id="m-done" class="hidden" style="max-width:720px;background:var(--accent-soft);border-radius:16px;padding:24px;text-align:center">
          <p style="font-size:1.15rem;font-weight:800;color:var(--blue-ink);margin:0 0 6px">Merci, votre demande est envoyée !</p>
          <p class="muted" style="margin:0">Le secrétariat vous recontacte pour finaliser votre adhésion.</p>
        </div></section>`;

    case "gzphotos":
      return `<section class="wsec"><div id="gz-photos-carousel" class="gz-carousel"></div></section>`;

    case "gzwinners":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div id="gz-winners"><p class="muted">Chargement…</p></div></section>`;

    case "logos":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="logo-wall">${sec.items.map((src) => `<img src="${src}" alt="" loading="lazy" />`).join("")}</div></section>`;

    case "agenda":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="agenda">${sec.items.map((e) =>
          `<div class="ag-item"><div class="ag-date">${esc(e.date)}</div>
            <div class="ag-body"><b>${esc(e.title)}</b>${e.detail ? `<span>${esc(e.detail)}</span>` : ""}</div></div>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "restaurant":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="resto">${sec.photo ? `<div class="resto-photo" style="background-image:url('${sec.photo}')"></div>` : ""}
          <div class="resto-body">${sec.body.map((p) => `<p>${esc(p)}</p>`).join("")}
            ${sec.phone ? `<p><b>Tél. direct :</b> <a href="tel:${esc(sec.phone.replace(/\s/g, ""))}">${esc(sec.phone)}</a></p>` : ""}
            ${sec.hours ? `<p class="muted">${esc(sec.hours)}</p>` : ""}</div></div></section>`;

    case "instagram":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <p class="wsec-sub">La vie du club en images — suivez <a href="https://instagram.com/${esc(sec.handle)}" target="_blank" rel="noopener">@${esc(sec.handle)}</a>.</p>
        <div class="ig-grid">${(sec.photos || []).map((src) =>
          `<a class="ig-cell" href="https://instagram.com/${esc(sec.handle)}" target="_blank" rel="noopener" style="background-image:url('${src}')"></a>`).join("")}</div></section>`;

    case "pyramid":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.sub ? `<p class="wsec-sub">${esc(sec.sub)}</p>` : ""}
        <div class="pyramid-wrap">
          <div class="pyramid">${sec.levels.map((l, i) => {
            const w = sec.levels.length > 1 ? 46 + i * (54 / (sec.levels.length - 1)) : 100;
            const inner = `<b>${esc(l.name)}</b><span>${esc(l.meta)}</span>`;
            return l.href
              ? `<a class="pyr-level" href="${esc(l.href)}" style="width:${w}%">${inner}<span class="pyr-arrow">↗</span></a>`
              : `<div class="pyr-level" style="width:${w}%">${inner}</div>`;
          }).join("")}</div>
          ${sec.club ? `<aside class="pyr-club">
            <h3>${esc(sec.club.title)}</h3>
            ${sec.club.body.map((p) => `<p>${esc(p)}</p>`).join("")}
            ${sec.club.href ? `<a class="pyr-club-link" href="${esc(sec.club.href)}">Découvrir le Club ↗</a>` : ""}
          </aside>` : ""}
        </div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "team": {
      const n = sec.count || (sec.items ? sec.items.length : 0);
      const av = '<div class="coach-photo ph-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg></div>';
      const tiles = Array.from({ length: n }, () => `<figure class="coach team-ph">${av}<figcaption><b>À venir</b><span>Team member</span></figcaption></figure>`).join("");
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.sub ? `<p class="wsec-sub">${esc(sec.sub)}</p>` : ""}
        <div class="coach-grid">${tiles}</div></section>`;
    }

    case "coaches":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.sub ? `<p class="wsec-sub">${sec.sub}</p>` : ""}
        <div class="coach-grid">${sec.items.map((c) =>
          `<figure class="coach"><div class="coach-photo" style="background-image:url('${c.photo}')"></div>
            <figcaption><b>${esc(c.name)}</b><span>${esc(c.role)}</span>
              ${c.private ? `<span class="coach-priv">Cours privés · ${c.phone ? `<a href="tel:${esc(c.phone.replace(/\s/g, ""))}">${esc(c.phone)}</a>` : "sur demande"}</span>` : ""}
            </figcaption></figure>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;

    case "gallery":
      return `<section class="wsec"><div class="gallery">${sec.items.map((it) => {
        const src = typeof it === "string" ? it : it.src;
        const pos = (typeof it === "object" && it.pos) ? `;background-position:${it.pos}` : "";
        return `<div class="gphoto" style="background-image:url('${src}')${pos}"></div>`;
      }).join("")}</div></section>`;

    case "contactform":
      return `<section class="wsec biz-contact" data-anchor="${esc(sec.anchor || "contact")}">
        <h2>${esc(sec.title)}</h2>
        ${sec.lead ? `<p class="muted" style="max-width:640px;margin:-6px 0 22px">${esc(sec.lead)}</p>` : ""}
        <div class="biz-contact-grid">
          <div class="biz-raph">
            <div class="biz-raph-name">${esc(sec.person)}</div>
            <div class="biz-raph-role">${esc(sec.role)}</div>
            <a class="biz-phone" href="tel:${esc((sec.tel || "").replace(/\s/g, ""))}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L7.8 9.8a16 16 0 0 0 6 6l1.4-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>
              ${esc(sec.telLabel)}</a>
          </div>
          <form id="biz-form" class="cform">
            <label class="cf-field"><span>Votre demande</span>
              <select id="biz-subject">
                <option>Devenir partenaire</option>
                <option>Privatisation / événement d'entreprise</option>
                <option>Club des Présidents</option>
                <option>Sponsoring</option>
                <option>Autre</option>
              </select></label>
            <div class="cf-row">
              <label class="cf-field"><span>Nom et prénom</span><input type="text" id="biz-name" required /></label>
              <label class="cf-field"><span>Entreprise / fonction</span><input type="text" id="biz-company" /></label>
            </div>
            <div class="cf-row">
              <label class="cf-field"><span>Email</span><input type="email" id="biz-email" required /></label>
              <label class="cf-field"><span>Téléphone</span><input type="tel" id="biz-phone" /></label>
            </div>
            <label class="cf-field"><span>Message</span><textarea id="biz-message" rows="4"></textarea></label>
            <button type="submit" id="biz-btn">Envoyer ma demande</button>
            <p id="biz-error" class="error" hidden></p>
          </form>
          <div id="biz-done" class="hidden biz-done">
            <p style="font-size:1.15rem;font-weight:800;color:var(--blue-ink);margin:0 0 6px">Merci, c'est envoyé !</p>
            <p class="muted" style="margin:0">Nous revenons vers vous très vite.</p>
          </div>
        </div></section>`;

    case "enroll":
      return `<section class="wsec"><h2>${esc(sec.title || "Demande d'inscription")}</h2>
        ${sec.lead ? `<p class="muted" style="max-width:640px;margin:-6px 0 22px">${esc(sec.lead)}</p>` : ""}
        <form id="enroll-form" class="cform" style="max-width:720px" data-filiere="${esc(sec.filiere)}">
          <div class="cf-row">
            <label class="cf-field"><span>Prénom</span><input type="text" id="en-first" required /></label>
            <label class="cf-field"><span>Nom</span><input type="text" id="en-last" required /></label>
          </div>
          <div class="cf-row">
            <label class="cf-field"><span>Date de naissance</span><input type="date" id="en-birth" required /></label>
            <label class="cf-field"><span>N° AVS</span><input type="text" id="en-avs" placeholder="756.XXXX.XXXX.XX" /></label>
          </div>
          <div class="cf-row">
            <label class="cf-field"><span>Téléphone</span><input type="tel" id="en-phone" autocomplete="tel" required /></label>
            <label class="cf-field"><span>Email</span><input type="email" id="en-email" autocomplete="email" required /></label>
          </div>
          ${sec.ranking ? `<label class="cf-field"><span>Classement</span><input type="text" id="en-ranking" placeholder="ex. R4, N3, sans classement…" /></label>` : ""}
          <label class="cf-field"><span>Commentaire</span><textarea id="en-comment" rows="3"></textarea></label>
          <button type="submit" id="en-btn">Envoyer ma demande d'inscription</button>
          <p id="en-error" class="error" hidden></p>
        </form>
        <div id="en-done" class="hidden" style="max-width:720px;background:var(--accent-soft);border-radius:16px;padding:24px;text-align:center">
          <p style="font-size:1.15rem;font-weight:800;color:var(--blue-ink);margin:0 0 6px">Merci, votre demande est envoyée !</p>
          <p class="muted" style="margin:0">Le secrétariat vous recontacte rapidement.</p>
        </div></section>`;

    default: return "";
  }
}

function paintHero({ logo, hero, tag, slogan, desc, ctaHTML }) {
  $("nav-logo").src = logo;
  $("hero-bg").style.backgroundImage = `url("${hero}")`;
  $("hero-logo").src = logo;
  $("hero-tag").textContent = tag;
  $("hero-slogan").textContent = slogan;
  $("hero-desc").textContent = desc;
  $("hero-cta").innerHTML = ctaHTML;
}

function renderWorld(key) {
  const w = WORLDS[key];
  document.body.dataset.world = key;
  document.querySelectorAll(".sw").forEach((b) => b.classList.toggle("active", b.dataset.world === key));
  const ctaHTML = w.cta.map((c) =>
    c.type === "contact" ? `<button class="btn-cta" data-contact="${esc(c.source)}">${esc(c.label)}</button>`
    : c.type === "scroll" ? `<button class="btn-cta" data-scroll="${esc(c.target)}">${esc(c.label)}</button>`
    : `<button class="btn-cta" data-cta="${c.type}">${esc(c.label)}</button>`).join("");
  paintHero({ logo: w.logo, hero: w.hero, tag: w.tag, slogan: w.slogan, desc: w.desc, ctaHTML });
  $("world-main").innerHTML = w.sections.map(sectionWrap).join("");
  animate();
}

function renderDetail(id) {
  const d = DETAILS[id];
  const w = WORLDS[d.world];
  document.body.dataset.world = d.world;
  document.querySelectorAll(".sw").forEach((b) => b.classList.toggle("active", b.dataset.world === d.world));
  const ctaHTML = `<button class="btn-cta ghost" data-back="${d.world}">← Retour ${esc(w.retour)}</button>`;
  paintHero({ logo: w.logo, hero: d.hero, tag: w.tag, slogan: d.title, desc: d.subtitle, ctaHTML });
  $("world-main").innerHTML = d.sections.map(sectionWrap).join("");
  animate();
  // (le site du club n'a ni stages ni GameZone : ils vivent sur teamlausanne.ch)
  if ($("gz-winners") || $("gz-photos-carousel")) loadGamezone();
}

let revealCheck = null;
function animate() {
  for (const el of [$("hero-content"), $("world-main")]) {
    el.classList.remove("fade-in"); void el.offsetWidth; el.classList.add("fade-in");
  }
  // Révélation au défilement (approche scroll : robuste, jamais de contenu
  // bloqué invisible même si un observer échoue).
  if (revealCheck) window.removeEventListener("scroll", revealCheck);
  const secs = [...document.querySelectorAll("#world-main > section")];
  secs.forEach((s) => s.classList.add("reveal"));
  revealCheck = () => {
    for (const s of secs)
      if (!s.classList.contains("in") && s.getBoundingClientRect().top < window.innerHeight * 0.88) s.classList.add("in");
    if (secs.every((s) => s.classList.contains("in"))) { window.removeEventListener("scroll", revealCheck); revealCheck = null; }
  };
  revealCheck();
  window.addEventListener("scroll", revealCheck, { passive: true });
}

function route() {
  const h = location.hash.replace("#", "");
  if (DETAILS[h]) renderDetail(h);
  else renderWorld(WORLDS[h] ? h : "club");
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

// ---- Réserver un court : c'est l'application qui gère les comptes ----
// Le site du club n'a PAS de connexion à lui : un deuxième écran de login
// sur un deuxième domaine, c'est un mot de passe perdu de plus. Le bouton
// « Réserver » envoie vers l'application, qui sait déjà qui est membre.
function memberAction() { location.href = APP + "/"; }

// ---- Contact : page à part (contact.html?src=…) ----
function openContact() {
  // Pas de page contact.html sur ce site : la section « Contact & accès » du
  // club porte déjà l'adresse, le téléphone et les horaires.
  document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
}

// Descendre jusqu’à une section du monde affiché.
// ⚠ Deux pièges, et les deux faisaient que le menu ne menait nulle part :
//  1. on cherche DANS #world-main — les liens du menu portent eux aussi
//     data-anchor, et un querySelector sur tout le document tombait sur le
//     lien lui-même, donc on « descendait » vers le haut de la page ;
//  2. la page GRANDIT après le rendu (images, sections révélées) : viser une
//     seule fois à la frame suivante marchait pour une section proche et
//     ratait toutes les autres. On vise donc, puis on corrige deux fois.
function allerAAncre(a) {
  if (!a) return;
  const viser = () => document.querySelector(`#world-main [data-anchor="${a}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(viser);
  setTimeout(viser, 250);
  setTimeout(viser, 700);
}

// ===================================================================
//  Interactions globales (délégation)
// ===================================================================
document.addEventListener("click", (e) => {
  const login = e.target.closest("[data-login]");
  if (login) { memberAction(); return; }
  const contact = e.target.closest("[data-contact]");
  if (contact) { openContact(contact.dataset.contact); return; }
  const cta = e.target.closest("[data-cta]");
  if (cta) {
    const t = cta.dataset.cta;
    if (t === "login") memberAction();
    else if (t === "stages") location.hash = "stages";
    else if (t === "gamezone") location.hash = "gamezone";
    return;
  }
  const plan = e.target.closest("[data-plan]");
  if (plan) { $("plan-img").src = plan.dataset.plan; $("plan-modal").classList.remove("hidden"); return; }
  const scroll = e.target.closest("[data-scroll]");
  if (scroll) { document.querySelector("." + scroll.dataset.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  const goto = e.target.closest("[data-goto]");
  if (goto) {
    const w = goto.dataset.goto, a = goto.dataset.anchor;
    history.replaceState(null, "", "#" + w);
    renderWorld(w);
    allerAAncre(a);
    return;
  }
  const back = e.target.closest("[data-back]");
  if (back) { location.hash = back.dataset.back; return; }
  const sw = e.target.closest(".sw, .flow-step");
  if (sw && sw.dataset.world) { location.hash = sw.dataset.world; }
});

// Popup "Plan des courts" : fermeture
$("plan-close").addEventListener("click", () => $("plan-modal").classList.add("hidden"));
$("plan-modal").addEventListener("click", (e) => { if (e.target === $("plan-modal")) $("plan-modal").classList.add("hidden"); });

// Formulaire de demande d'adhésion (page "Devenir membre")
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "member-form") return;
  e.preventDefault();
  if (!$("m-consent").checked) { const er = $("m-error"); er.textContent = "Merci d'accepter le règlement du club."; er.hidden = false; return; }
  const err = $("m-error"); err.hidden = true;
  const btn = $("m-btn"); btn.disabled = true; btn.textContent = "Envoi…";
  const v = (id) => $(id).value.trim();
  const msg = [
    "Téléphone : " + v("m-phone"),
    "Date de naissance : " + v("m-birth"),
    "Adresse : " + v("m-address") + ", " + v("m-npa") + " " + v("m-city"),
    "Règlement du club : accepté ✔",
    v("m-message") ? "\nMessage : " + v("m-message") : "",
  ].join("\n");
  const { error } = await sb.from("contact_messages").insert({
    source: "Adhésion — Club",
    name: v("m-first") + " " + v("m-last"),
    email: v("m-email"),
    message: msg,
  });
  btn.disabled = false; btn.textContent = "Envoyer ma demande d'adhésion";
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  $("member-form").classList.add("hidden");
  $("m-done").classList.remove("hidden");
});

// Formulaire de contact business (en bas de la page "business")
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "biz-form") return;
  e.preventDefault();
  const err = $("biz-error"); err.hidden = true;
  const btn = $("biz-btn"); btn.disabled = true; btn.textContent = "Envoi…";
  const parts = [];
  if ($("biz-company").value.trim()) parts.push("Entreprise / fonction : " + $("biz-company").value.trim());
  if ($("biz-phone").value.trim()) parts.push("Téléphone : " + $("biz-phone").value.trim());
  const m = $("biz-message").value.trim();
  if (m) { if (parts.length) parts.push(""); parts.push(m); }
  const { error } = await sb.from("contact_messages").insert({
    source: "Business — " + $("biz-subject").value,
    name: $("biz-name").value.trim(),
    email: $("biz-email").value.trim(),
    message: parts.join("\n") || null,
  });
  btn.disabled = false; btn.textContent = "Envoyer ma demande";
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  $("biz-form").classList.add("hidden");
  $("biz-done").classList.remove("hidden");
});

// Demande d'inscription (pages de filière : Compétition, Performance, Club, KidsTennis)
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "enroll-form") return;
  e.preventDefault();
  const err = $("en-error"); err.hidden = true;
  const btn = $("en-btn"); btn.disabled = true; btn.textContent = "Envoi…";
  const v = (id) => ($(id) ? $(id).value.trim() : "");
  const row = {
    filiere: e.target.dataset.filiere,
    first_name: v("en-first"), last_name: v("en-last"),
    birthdate: $("en-birth").value || null,
    avs: v("en-avs") || null, phone: v("en-phone") || null, email: v("en-email") || null,
    ranking: $("en-ranking") ? (v("en-ranking") || null) : null,
    comment: v("en-comment") || null,
  };
  const { error } = await sb.from("enrollment_requests").insert(row);
  btn.disabled = false; btn.textContent = "Envoyer ma demande d'inscription";
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; return; }
  $("enroll-form").classList.add("hidden");
  $("en-done").classList.remove("hidden");
});

window.addEventListener("hashchange", route);
route();

// Arrivée depuis une autre page avec ?at=<ancre> : défiler vers la section.
(() => {
  const at = new URLSearchParams(location.search).get("at");
  if (!at) return;
  allerAAncre(at);
  history.replaceState(null, "", location.pathname + location.hash);
})();
