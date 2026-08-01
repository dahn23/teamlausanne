// Site public dynamique : un seul écran qui bascule entre 3 mondes.
import { sb, getSession } from "./common.js";

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------
//  Données des 3 mondes (photos = valeurs par défaut, remplaçables
//  depuis la console admin — voir loadPhotoOverrides()).
// ---------------------------------------------------------------
const WORLDS = {
  club: {
    tag: "Le Club",
    logo: "assets/logo-club.webp",
    slogan: "Jouer. S'amuser. Ensemble.",
    desc: "Le club de tennis historique de Lausanne, aux Plaines-du-Loup. Devenez membre, jouez librement toute l'année et vivez la compétition en interclubs.",
    hero: "assets/photos/p1.jpg",
    cta: [{ label: "Réserver un court", type: "login" }],
    features: [
      ["Devenir membre", "Accès à tous les courts, intérieurs et extérieurs, toute l'année."],
      ["Jouer librement", "Réservation en ligne en quelques secondes, été comme hiver."],
      ["Interclubs", "Portez les couleurs du club en championnat suisse par équipes."],
      ["Restaurant & club-house", "Un lieu de vie convivial au cœur des Plaines-du-Loup."],
    ],
    gallery: ["assets/photos/p5.jpg", "assets/photos/p7.jpg"],
  },
  academie: {
    tag: "L'Académie",
    logo: "assets/logo-academie.webp",
    slogan: "Grandir. Progresser. Ensemble.",
    desc: "Le centre de formation du Lausanne-Sports Tennis. Un parcours complet, du premier jeu à la performance, adapté à chaque âge dès 5 ans.",
    hero: "assets/photos/p6.jpg",
    cta: [{ label: "Nous contacter", type: "mail" }],
    features: [
      ["KidsTennis · dès 5 ans", "Initiation ludique et progressive pour les plus jeunes."],
      ["Sport-études", "Études et entraînement intensif combinés (14–19 ans)."],
      ["Pro & Pro U18", "Encadrement quotidien pour viser le circuit professionnel."],
      ["Cours privés & en groupe", "Leçons individuelles ou en petit groupe, selon vos objectifs."],
      ["Loisir", "Progresser à son rythme, dans le plaisir du jeu."],
      ["Compétition & Performance", "Filières encadrées pour les joueurs de compétition."],
    ],
    gallery: ["assets/photos/p4.jpg", "assets/photos/p1.jpg"],
  },
  tournoi: {
    tag: "Le Tournoi",
    logo: "assets/logo-open.webp",
    slogan: "Vibrer. Rêver. Ensemble.",
    desc: "Lausanne Open — l'unique tournoi international de tennis masculin du canton de Vaud. Le circuit professionnel, chez nous, aux Plaines-du-Loup.",
    hero: "assets/photos/p2.jpg",
    cta: [{ label: "Infos & billetterie", type: "mail" }],
    stats: [
      ["23–30 août", "2026"],
      ["30 000 $", "dotation"],
      ["Gratuit", "entrée libre"],
      ["Plaines-du-Loup", "Lausanne"],
    ],
    features: [
      ["Journée Team Lausanne", "Le samedi : animations et tennis pour toute la famille."],
      ["Initiations écoles", "Le tournoi ouvre ses portes aux écoles de la région."],
      ["Offres VIP", "Vivez le tournoi au plus près des joueurs."],
      ["Au cœur du circuit", "Les futurs grands noms du tennis, à Lausanne."],
    ],
    gallery: ["assets/photos/p8.jpg", "assets/photos/p3.jpg"],
  },
};

const CONTACT_MAIL = "admin@lstennis.ch";
let current = "club";

// ---------------------------------------------------------------
//  Rendu d'un monde
// ---------------------------------------------------------------
function renderWorld(key) {
  const w = WORLDS[key];
  if (!w) return;
  current = key;
  document.body.dataset.world = key;

  // switcher actif
  document.querySelectorAll(".sw").forEach((b) =>
    b.classList.toggle("active", b.dataset.world === key));

  // nav + hero
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
    });
    cta.appendChild(b);
  }

  // contenu principal
  const main = $("world-main");
  main.innerHTML = "";

  if (w.stats) {
    const row = document.createElement("div");
    row.className = "stat-row";
    for (const [b, s] of w.stats)
      row.insertAdjacentHTML("beforeend", `<div class="stat"><b>${b}</b><span>${s}</span></div>`);
    main.appendChild(row);
  }

  const grid = document.createElement("div");
  grid.className = "feature-grid";
  for (const [h, t] of w.features)
    grid.insertAdjacentHTML("beforeend", `<div class="feature"><h3>${h}</h3><p>${t}</p></div>`);
  main.appendChild(grid);

  if (w.gallery) {
    const g = document.createElement("div");
    g.className = "gallery";
    for (const src of w.gallery) {
      const im = document.createElement("div");
      im.className = "gphoto";
      im.style.backgroundImage = `url("${src}")`;
      g.appendChild(im);
    }
    main.appendChild(g);
  }

  // petite transition
  $("hero-content").classList.remove("fade-in");
  void $("hero-content").offsetWidth;
  $("hero-content").classList.add("fade-in");
  main.classList.remove("fade-in");
  void main.offsetWidth;
  main.classList.add("fade-in");
}

function switchWorld(key) {
  if (key === current) return;
  renderWorld(key);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------------------------------------------------------
//  Connexion
// ---------------------------------------------------------------
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

// Déjà connecté → espace membres
getSession().then((s) => { if (s) location.href = "reservation.html"; });

// ---------------------------------------------------------------
//  Écouteurs de bascule + démarrage
// ---------------------------------------------------------------
document.querySelectorAll("[data-world]").forEach((el) =>
  el.addEventListener("click", () => switchWorld(el.dataset.world)));

renderWorld("club");
