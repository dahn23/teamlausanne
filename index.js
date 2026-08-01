// Site public dynamique : un seul écran qui bascule entre 3 mondes,
// chacun avec un contenu riche (sections). Photos = valeurs par défaut,
// remplaçables depuis la console admin (TODO site_media).
import { sb, getSession } from "./common.js";

const $ = (id) => document.getElementById(id);
const CONTACT_MAIL = "admin@lstennis.ch";
const OPEN_MAIL = "info@lausanneopen.ch";

// ===================================================================
//  CONTENU DES 3 MONDES
// ===================================================================
const WORLDS = {
  // ---------------------------------------------------------------
  club: {
    tag: "Le Club",
    logo: "assets/logo-club.webp",
    slogan: "Jouer. S'amuser. Ensemble.",
    desc: "Le club de tennis historique de Lausanne, aux Plaines-du-Loup depuis 1911. Devenez membre, jouez librement toute l'année et vivez la compétition en interclubs.",
    hero: "assets/photos/p1.jpg",
    cta: [{ label: "Réserver un court", type: "login" }],
    sections: [
      { type: "features", title: "Le club, c'est…", items: [
        ["Devenir membre", "Accès à tous les courts, intérieurs et extérieurs, toute l'année."],
        ["Jouer librement", "Réservation en ligne en quelques secondes, été comme hiver."],
        ["Interclubs", "Portez les couleurs du club en championnat suisse par équipes."],
        ["Restaurant & club-house", "Un lieu de vie convivial au cœur des Plaines-du-Loup."],
      ]},
      { type: "timeline", title: "Notre histoire", items: [
        ["1911", "Fondation du club par des personnalités du Montriond F.C. Premier court au chemin du Signal, puis deux courts aux Plaines-du-Loup."],
        ["1939", "Le club compte déjà 8 terrains."],
        ["1954", "12 terrains et installation sur le site du Stade de la Pontaise."],
        ["1965–1980", "Âge d'or : champion de Suisse en 1965, 1967, 1968, 1974 et 1980 — 12 titres, 3ᵉ du palmarès de Ligue nationale A."],
        ["1980", "Inauguration du club-house actuel."],
        ["1991", "Première bulle hivernale."],
        ["2004", "Halle couverte avec deux courts en synthétique."],
      ], note: "Le club a vu passer de grands noms : Thierry Grin (finaliste de Coupe Davis 1992), Marie-Gaïané Mikaelian et Timea Bacsinszky." },
      { type: "features", title: "Nos infrastructures", items: [
        ["12 courts", "8 en terre battue, 2 en dur (halle), 2 en synthétique."],
        ["Bulle d'hiver", "4 courts en terre battue couverts et chauffés l'hiver."],
        ["Restaurant", "Restauration et club-house ouverts aux membres et visiteurs."],
        ["Réservation en ligne", "Réservez votre terrain d'un clic, depuis votre mobile."],
      ]},
      { type: "committee", title: "Le comité",
        members: [
          ["Kazem Huber", "Président"],
          ["Bertrand Gygax", "Vice-président"],
          ["Arsalan Huber", "Trésorier"],
          ["Laurent Aubert", "Infrastructures"],
          ["Philémon Isakov", "Compétition"],
          ["Loïc Colotti", "Communication"],
          ["Serge Devaud", "Membre consultant"],
        ],
        honor: ["Serge Devaud", "Françoise Tribolet", "Remo Zeraschi"] },
      { type: "contact", title: "Contact & accès",
        lines: ["Lausanne-Sports Tennis", "Stade de la Pontaise", "Route des Plaines-du-Loup 8", "1018 Lausanne"],
        phone: "+41 21 646 13 50", email: CONTACT_MAIL,
        hours: "Secrétariat : lun–ven, 15h00–17h00" },
      { type: "gallery", items: ["assets/photos/p5.jpg", "assets/photos/p7.jpg"] },
    ],
  },

  // ---------------------------------------------------------------
  academie: {
    tag: "L'Académie",
    logo: "assets/logo-academie.webp",
    slogan: "Grandir. Progresser. Ensemble.",
    desc: "Le centre de formation du Lausanne-Sports Tennis. Un parcours complet, du premier jeu à la performance, adapté à chaque âge dès 5 ans.",
    hero: "assets/photos/p6.jpg",
    cta: [{ label: "Nous contacter", type: "mail" }],
    sections: [
      { type: "rich", title: "Notre philosophie", body: [
        "Team Lausanne propose un encadrement complet du tennis, adapté à chaque âge et à chaque niveau de jeu.",
        "Nous accompagnons le développement de chaque joueuse et joueur, de l'initiation jusqu'à la compétition professionnelle, au sein d'une véritable pyramide de formation.",
      ]},
      { type: "offers", title: "Nos offres", items: [
        { name: "KidsTennis", meta: "dès 5 ans", detail: "Initiation ludique et progressive pour les plus jeunes." },
        { name: "Cours en groupe", meta: "tous niveaux", detail: "Cours pour tous, encadrés par niveau et par âge." },
        { name: "Cours privés", meta: "sur mesure", detail: "Leçons individuelles selon vos objectifs." },
        { name: "Loisir", meta: "", detail: "Progresser à son rythme, dans le plaisir du jeu." },
        { name: "Compétition", meta: "", detail: "Filière encadrée pour les joueurs de compétition." },
        { name: "Performance", meta: "haut niveau", detail: "Encadrement renforcé vers le meilleur niveau." },
      ]},
      { type: "rich", title: "Sport-études", body: [
        "Le programme de référence pour concilier études et entraînement intensif, dans un cadre optimal (14–19 ans).",
        "35 semaines selon le calendrier vaudois : 2h de tennis, 1h de préparation physique et 4h d'études encadrées par jour. Écoles partenaires à distance (Institut DOMI, EPSU, CNED), responsable pédagogique dédié et assistants issus de l'EPFL et de l'UNIL.",
        "Objectif : maturité fédérale suisse ou baccalauréat français, avec des débouchés en université, NCAA ou vers le circuit professionnel.",
      ], note: "Dès 21'600 CHF / année, repas de midi inclus." },
      { type: "offers", title: "Pro U18 & Pro", items: [
        { name: "Pro U18", meta: "après la scolarité", detail: "Deux entraînements par jour, 46 semaines en Suisse + 15 semaines sur le circuit ITF junior pour monter dans la hiérarchie mondiale." },
        { name: "Pro", meta: "circuit ITF / ATP", detail: "Viser les points ATP, encadrement complet (médical, physio, mental, cordage). 46 semaines d'entraînement et 15 tournois à l'étranger par an." },
      ], note: "Dès 34'800 CHF / année. Des solutions de soutien financier existent." },
      { type: "offers", title: "Stages · vacances scolaires", items: [
        { name: "KidsTennis", meta: "4–9 ans", detail: "Matin 9h–12h : 1h30 de tennis + 1h30 d'activité. 250 CHF/sem." },
        { name: "Loisir journée", meta: "9–18 ans", detail: "9h–17h, repas inclus : 3h de tennis + activités. 450 CHF/sem." },
        { name: "Loisir demi-journée", meta: "9–18 ans", detail: "Matin ou après-midi : 1h30 de tennis + 1h30 d'activité. 290 CHF/sem." },
        { name: "Train Like a Pro", meta: "10–19 ans, dès R7", detail: "Journée intensive : 4h de tennis + physique et bien-être. 790 CHF/sem." },
      ], note: "–20 % dès la 2ᵉ semaine ou pour plusieurs membres d'une même famille." },
      { type: "rich", title: "Game Zone", body: [
        "Chaque week-end, des tournois juniors sur une seule journée, avec deux matchs garantis par participant·e.",
        "Un format idéal pour se lancer en compétition, cumuler de l'expérience et grimper au classement de la saison.",
      ], link: { label: "Consulter les prochains tournois ↗", href: "https://www.mytennis.ch/fr/tournois?keyword=gamezone" } },
      { type: "gallery", items: ["assets/photos/p4.jpg", "assets/photos/p1.jpg"] },
    ],
  },

  // ---------------------------------------------------------------
  tournoi: {
    tag: "Le Tournoi",
    logo: "assets/logo-open.webp",
    slogan: "Vibrer. Rêver. Ensemble.",
    desc: "Lausanne Open — l'unique tournoi international de tennis masculin du canton de Vaud. Le circuit professionnel, chez nous, aux Plaines-du-Loup.",
    hero: "assets/photos/p2.jpg",
    cta: [{ label: "Infos & billetterie", type: "mailopen" }],
    sections: [
      { type: "stats", items: [
        ["23–30 août", "2026"],
        ["30 000 $", "dotation"],
        ["Gratuit", "entrée libre"],
        ["ITF M25", "catégorie"],
      ]},
      { type: "rich", title: "Le tournoi", body: [
        "Le Lausanne Open réunit chaque année plusieurs dizaines de joueurs de toutes nationalités, pour la plupart classés à l'ATP, sur les courts de la Pontaise.",
        "Vainqueur 2025 : Henry Bernet, joueur suisse de 18 ans.",
      ], link: { label: "Tableau & résultats ITF ↗", href: "https://www.itftennis.com/en/tournament-calendar/mens-world-tennis-tour-calendar/" } },
      { type: "rich", title: "Entrée libre", body: [
        "L'accès au tournoi est entièrement gratuit, toute la semaine. Venez vivre le tennis professionnel au plus près des joueurs, sans billet.",
      ]},
      { type: "rich", title: "Journée Team Lausanne — samedi 29 août", body: [
        "Dès 11h, une journée familiale gratuite et ouverte à tous : initiation, mini tennis, cibles et bien d'autres animations (matériel et raquettes fournis).",
        "Vers 12h30, exhibition de tennis en fauteuil roulant. Et côté pros : demi-finales à 11h et 13h30, finale du double vers 15h.",
      ], note: "Cadeau-souvenir offert à celles et ceux qui s'inscrivent en ligne." },
      { type: "rich", title: "Initiation pour les écoles", body: [
        "Toute la semaine du tournoi, une initiation gratuite est proposée aux écoles de la région, encadrée par des coachs certifié·e·s.",
        "Matériel et raquettes fournis, cadeau-souvenir pour chaque enfant, et la possibilité d'assister à de vrais matchs professionnels.",
      ]},
      { type: "rich", title: "VIP · Tennis & Lunch", body: [
        "Vivez le tournoi au plus près des joueurs avec l'expérience « Tennis & Lunch », proposée du lundi au vendredi sur invitation personnalisée.",
        "Des offres de partenariat sur mesure sont disponibles : naming du court central et de la zone VIP, banderoles, stands, visibilité digitale…",
      ], link: { label: "Nous contacter", href: "mailto:" + OPEN_MAIL } },
      { type: "sponsors", title: "Ils soutiennent le tournoi", items: [
        "Team Lausanne", "Canton de Vaud", "Swiss Tennis", "Ville de Lausanne",
        "Services Industriels de Lausanne", "SVR Vins", "Cafés Cuéndet",
        "Fondation Sport et Solidarité", "Isaac", "PhysioPlus Lausanne",
        "Les Roches", "Boissons Gros de Vaud", "Chopfab Boxer", "Aquatis Hôtel", "Bertholet Mathis",
      ]},
      { type: "gallery", items: ["assets/photos/p8.jpg", "assets/photos/p3.jpg"] },
    ],
  },
};

let current = "club";

// ===================================================================
//  RENDU
// ===================================================================
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function sectionHTML(sec) {
  switch (sec.type) {
    case "features":
      return `<section class="wsec">
        ${sec.title ? `<h2>${esc(sec.title)}</h2>` : ""}
        <div class="feature-grid">${sec.items.map(([h, t]) =>
          `<div class="feature"><h3>${esc(h)}</h3><p>${esc(t)}</p></div>`).join("")}</div>
      </section>`;

    case "offers":
      return `<section class="wsec">
        <h2>${esc(sec.title)}</h2>
        <div class="offer-grid">${sec.items.map((o) =>
          `<div class="offer"><div class="offer-top"><h3>${esc(o.name)}</h3>
            ${o.meta ? `<span class="offer-meta">${esc(o.meta)}</span>` : ""}</div>
            <p>${esc(o.detail)}</p></div>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}
      </section>`;

    case "timeline":
      return `<section class="wsec">
        <h2>${esc(sec.title)}</h2>
        <div class="timeline">${sec.items.map(([y, t]) =>
          `<div class="tl-row"><div class="tl-year">${esc(y)}</div><div class="tl-text">${esc(t)}</div></div>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}
      </section>`;

    case "committee":
      return `<section class="wsec">
        <h2>${esc(sec.title)}</h2>
        <div class="committee">${sec.members.map(([n, r]) =>
          `<div class="cm"><b>${esc(n)}</b><span>${esc(r)}</span></div>`).join("")}</div>
        ${sec.honor ? `<p class="wsec-note">Membres d'honneur : ${sec.honor.map(esc).join(" · ")}</p>` : ""}
      </section>`;

    case "contact":
      return `<section class="wsec">
        <h2>${esc(sec.title)}</h2>
        <div class="contact-card">
          <p>${sec.lines.map(esc).join("<br>")}</p>
          <p><a href="tel:${esc(sec.phone.replace(/\s/g, ""))}">${esc(sec.phone)}</a> ·
             <a href="mailto:${esc(sec.email)}">${esc(sec.email)}</a></p>
          ${sec.hours ? `<p class="muted">${esc(sec.hours)}</p>` : ""}
        </div>
      </section>`;

    case "rich":
      return `<section class="wsec">
        <h2>${esc(sec.title)}</h2>
        <div class="rich">${sec.body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}
        ${sec.link ? `<a class="wsec-link" href="${esc(sec.link.href)}" target="_blank" rel="noopener">${esc(sec.link.label)}</a>` : ""}
      </section>`;

    case "stats":
      return `<section class="wsec"><div class="stat-row">${sec.items.map(([b, s]) =>
        `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("")}</div></section>`;

    case "sponsors":
      return `<section class="wsec">
        <h2>${esc(sec.title)}</h2>
        <div class="sponsors">${sec.items.map((n) =>
          `<span class="sponsor">${esc(n)}</span>`).join("")}</div>
      </section>`;

    case "gallery":
      return `<section class="wsec"><div class="gallery">${sec.items.map((src) =>
        `<div class="gphoto" style="background-image:url('${src}')"></div>`).join("")}</div></section>`;

    default:
      return "";
  }
}

function renderWorld(key) {
  const w = WORLDS[key];
  if (!w) return;
  current = key;
  document.body.dataset.world = key;

  document.querySelectorAll(".sw").forEach((b) =>
    b.classList.toggle("active", b.dataset.world === key));

  $("nav-logo").src = w.logo;
  $("hero-bg").style.backgroundImage = `url("${w.hero}")`;
  $("hero-logo").src = w.logo;
  $("hero-tag").textContent = w.tag;
  $("hero-slogan").textContent = w.slogan;
  $("hero-desc").textContent = w.desc;

  const cta = $("hero-cta");
  cta.innerHTML = "";
  for (const c of w.cta) {
    const b = document.createElement("button");
    b.className = "btn-cta";
    b.textContent = c.label;
    b.addEventListener("click", () => {
      if (c.type === "login") openModal();
      else if (c.type === "mail") location.href = `mailto:${CONTACT_MAIL}`;
      else if (c.type === "mailopen") location.href = `mailto:${OPEN_MAIL}`;
    });
    cta.appendChild(b);
  }

  const main = $("world-main");
  main.innerHTML = w.sections.map(sectionHTML).join("");

  for (const el of [$("hero-content"), main]) {
    el.classList.remove("fade-in");
    void el.offsetWidth;
    el.classList.add("fade-in");
  }
}

function switchWorld(key) {
  if (key === current) return;
  renderWorld(key);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ===================================================================
//  Connexion
// ===================================================================
const modal = $("login-modal");
const openModal = () => modal.classList.remove("hidden");
const closeModal = () => modal.classList.add("hidden");

$("open-login").addEventListener("click", openModal);
$("close-login").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("login-error");
  err.hidden = true;
  $("login-btn").disabled = true;
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value,
  });
  $("login-btn").disabled = false;
  if (error) { err.textContent = "Connexion impossible : " + error.message; err.hidden = false; return; }
  location.href = "reservation.html";
});

getSession().then((s) => { if (s) location.href = "reservation.html"; });

// ===================================================================
//  Bascule + démarrage
// ===================================================================
document.querySelectorAll("[data-world]").forEach((el) =>
  el.addEventListener("click", () => switchWorld(el.dataset.world)));

renderWorld("club");
