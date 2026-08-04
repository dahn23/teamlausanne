// Site public dynamique : mondes + pages détaillées (routage par ancre).
import { sb, getSession } from "./common.js";

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
    slogan: "Jouer. S'amuser. Ensemble.",
    desc: "Le club de tennis historique de Lausanne, aux Plaines-du-Loup depuis 1911. Devenez membre, jouez librement toute l'année et vivez la compétition en interclubs.",
    hero: "assets/photos/p1.jpg",
    cta: [{ label: "Réserver un court", type: "login" }],
    sections: [
      { type: "split", anchor: "cotisation", title: "Votre club, toute l'année", photo: "assets/photos/p5.jpg", body: [
        "Devenez membre du Lausanne-Sports Tennis : jouez librement sur tous les courts extérieurs durant tout l'été, et profitez de conditions avantageuses sur les courts couverts en hiver.",
        "L'adhésion est payante (cotisation annuelle). Elle vous ouvre la réservation en ligne, le club-house et le restaurant, au cœur des Plaines-du-Loup.",
      ], link: { label: "Réserver un court", action: "login" } },
      { type: "carousel", eyebrow: "Le club", title: "Jouer toute l'année, à deux pas du centre",
        sub: "Devenez membre et profitez de tous les courts, du club-house et de la compétition.",
        items: [
          { name: "Devenir membre", photo: "assets/webflow/prog-club.webp", href: "#academie" },
          { name: "Jouer librement", photo: "assets/webflow/tennis-day.webp", login: true },
          { name: "Interclubs", photo: "assets/webflow/prog-competition.webp" },
          { name: "Restaurant & club-house", photo: "assets/webflow/cta-young.jpg" },
        ]},
      { type: "instagram", anchor: "vie", title: "Vie du club", handle: "lausanne_sports_tennis",
        photos: ["assets/webflow/tennis-day.webp", "assets/webflow/prog-club.webp",
          "assets/webflow/coaching-technique.jpg", "assets/webflow/physical-training.jpg",
          "assets/webflow/stage-development.webp", "assets/webflow/cta-young.jpg"] },
      { type: "agenda", anchor: "agenda", title: "Agenda du club", items: [
        { date: "À venir", title: "Apéro d'ouverture", detail: "Le coup d'envoi de la saison, entre membres." },
        { date: "À venir", title: "Soirée des membres", detail: "Une soirée conviviale pour toute la communauté du club." },
        { date: "À venir", title: "Repas canadien", detail: "Chacun apporte un plat à partager." },
        { date: "À venir", title: "Repas de soutien", detail: "Un moment festif au profit du club." },
        { date: "Saison", title: "Interclubs & animations", detail: "Matchs par équipes et animations tout au long de l'année." },
      ], note: "Dates précises communiquées prochainement." },
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
        phone: "+41 21 646 13 50", contact: "Club — Contact", hours: "Secrétariat : lun–ven, 15h00–17h00" },
    ],
  },

  academie: {
    tag: "Academy", logo: "assets/logo-academie.webp",
    slogan: "Grandir. Progresser. Ensemble.",
    desc: "Le centre de formation du Lausanne-Sports Tennis. Un parcours complet, du premier jeu à la performance, adapté à chaque âge dès 5 ans.",
    hero: "assets/webflow/hero-academy.webp",
    cta: [{ label: "Nos stages", type: "stages" }, { label: "Nous contacter", type: "contact", source: "Academy — Contact" }],
    sections: [
      { type: "rich", title: "Notre philosophie", body: [
        "Team Lausanne propose un encadrement complet du tennis, adapté à chaque âge et à chaque niveau de jeu.",
        "Nous accompagnons le développement de chaque joueuse et joueur, de l'initiation jusqu'à la compétition professionnelle, au sein d'une véritable pyramide de formation.",
      ]},
      { type: "carousel", anchor: "programmes", eyebrow: "Cours pour tous", title: "Un programme pour chaque niveau",
        sub: "Du premier échange à la compétition, un parcours clair pour progresser avec plaisir.",
        items: [
          { name: "KidsTennis", photo: "assets/webflow/prog-kids.webp", href: "#kids" },
          { name: "Sport-études", photo: "assets/webflow/sport-studies.jpg", href: "#sport-etudes" },
          { name: "Pro U18 & Pro", photo: "assets/webflow/prog-performance.webp", href: "#pro" },
          { name: "Compétition", photo: "assets/webflow/prog-competition.webp" },
          { name: "Loisir / Club", photo: "assets/webflow/prog-club.webp" },
          { name: "Game Zone", photo: "assets/webflow/event-gamezone.webp", href: "#gamezone" },
          { name: "Stages", photo: "assets/webflow/prog-adults.webp", href: "#stages" },
        ]},
      { type: "coaches", anchor: "coaches", title: "Notre équipe de coachs", items: [
        { name: "Mariano Palena", role: "Head Coach", photo: "assets/webflow/coach-mariano.jpg" },
        { name: "Yann Perez", role: "Coach", photo: "assets/webflow/coach-yann.jpg" },
        { name: "Loris Gander", role: "Coach", photo: "assets/webflow/coach-loris.jpg" },
        { name: "Séline Rivarolli", role: "Coach jeunesse", photo: "assets/webflow/coach-seline.jpg" },
        { name: "Talia Picci", role: "Coach junior", photo: "assets/webflow/coach-talia.jpg" },
      ]},
    ],
  },

  tournoi: {
    tag: "Lausanne Open", logo: "assets/logo-open.webp",
    slogan: "Vibrer. Rêver. Ensemble.",
    desc: "Lausanne Open — l'unique tournoi international de tennis masculin du canton de Vaud. Le circuit professionnel, chez nous, aux Plaines-du-Loup.",
    hero: "assets/photos/open-serve.jpg",
    cta: [],
    sections: [
      { type: "stats", anchor: "tournoi", items: [["23–30 août", "2026"], ["30 000 $", "dotation"], ["Gratuit", "entrée libre"], ["ITF M25", "catégorie"]] },
      { type: "split", anchor: "presentation", title: "Le grand rendez-vous du tennis vaudois masculin", video: "Pw8oWWAlv40", body: [
        "Le Lausanne Open réunit chaque année plusieurs dizaines de joueurs de toutes nationalités, pour la plupart classés à l'ATP, sur les courts de la Pontaise.",
        "L'accès est entièrement gratuit, toute la semaine.",
      ], link: { label: "Site & résultats ITF ↗", href: ITF_URL } },
      { type: "carousel", eyebrow: "Lausanne Open", title: "Une semaine d'événements",
        sub: "Entrée libre toute la semaine, animations grand public et hospitalité.",
        items: [
          { name: "Initiation pour les écoles", photo: "assets/photos/open-kids.jpg" },
          { name: "Journée Team Lausanne", photo: "assets/photos/open-wheelchair.jpg", href: "#journee-team-lausanne" },
          { name: "VIP · Tennis & Lunch", photo: "assets/photos/open-lunch.jpg", goto: { world: "business", anchor: "devenir" } },
        ]},
      { type: "ranking", anchor: "palmares", title: "Palmarès",
        head: ["Année", "Simple", "Double"],
        rows: [["2025", `${FLAG_CH} Henry Bernet`, `${FLAG_IE} Charles Barry · ${FLAG_FR} Max Westphal`]] },
      { type: "gallery", anchor: "photos", items: [
        "assets/photos/open-trophy.jpg",
        { src: "assets/photos/open-double1.jpg", pos: "center 22%" },
        { src: "assets/photos/open-double2.jpg", pos: "center 12%" },
        { src: "assets/photos/open-player.jpg", pos: "center 28%" },
      ]},
      { type: "features", anchor: "infos", title: "Infos pratiques", items: [
        ["Dates", "Du 23 au 30 août 2026."],
        ["Entrée libre", "Accès gratuit toute la semaine, sans billet."],
        ["Lieu", "TC Lausanne-Sports, Plaines-du-Loup, 1018 Lausanne."],
        ["Une question ?", "Écrivez-nous, nous répondons rapidement."],
      ], link: { label: "Nous écrire", contact: "Lausanne Open" } },
      { type: "sponsors", anchor: "partenaires", title: "Partenaires du tournoi", items: [
        "Team Lausanne", "Canton de Vaud", "Swiss Tennis", "Ville de Lausanne",
        "Services Industriels de Lausanne", "SVR Vins", "Cafés Cuéndet",
        "Fondation Sport et Solidarité", "PhysioPlus Lausanne", "Boissons Gros de Vaud",
        "BS Architectes", "Garage-carrosserie de la Plaine", "Ibis Hotels", "Fonds du Sport vaudois",
      ]},
    ],
  },

  business: {
    tag: "Business & partenaires", logo: "assets/logo-club.webp",
    slogan: "S'associer. Rayonner. Ensemble.",
    desc: "Associez votre entreprise à un club historique et à une académie de formation reconnue, au cœur de Lausanne.",
    hero: "assets/webflow/cta-young.jpg",
    cta: [{ label: "Devenir partenaire", type: "contact", source: "Devenir partenaire" }],
    sections: [
      { type: "rich", anchor: "presidents", title: "Club des Présidents", body: [
        "Le Club des Présidents réunit les dirigeantes et dirigeants d'entreprise qui soutiennent le club et l'académie.",
        "Un réseau privilégié : rencontres, moments conviviaux autour du tennis et visibilité auprès d'une communauté engagée.",
      ], link: { label: "Rejoindre le Club des Présidents", contact: "Club des Présidents" } },
      { type: "logos", anchor: "sponsors", title: "Nos sponsors", items: [
        "assets/webflow/sp-lausanne-sport.png", "assets/webflow/sp-ville-lausanne.png",
        "assets/webflow/sp-vaud.png", "assets/webflow/sp-aquatis.png",
        "assets/webflow/sp-isaac.png", "assets/webflow/sp-sil.png", "assets/webflow/sp-les-roches.png",
      ]},
      { type: "features", anchor: "avantages", title: "Avantages & offres partenaires", items: [
        ["Visibilité", "Présence sur les courts, le site et les supports de communication."],
        ["Réseau", "Accès au Club des Présidents et aux événements du club."],
        ["Hospitalité", "Invitations au Lausanne Open et moments privilégiés."],
        ["Sur mesure", "Des formules de partenariat adaptées à vos objectifs."],
      ]},
      { type: "rich", anchor: "devenir", title: "Devenir partenaire", body: [
        "Vous souhaitez associer votre marque au tennis lausannois ? Construisons ensemble un partenariat qui vous ressemble.",
      ], link: { label: "Nous contacter", contact: "Devenir partenaire" } },
      { type: "rich", anchor: "privatisation", title: "Privatisations & événements d'entreprise", body: [
        "Organisez votre événement d'entreprise au club : séminaire, team-building tennis, apéritif ou repas dans un cadre unique aux Plaines-du-Loup.",
      ], link: { label: "Demander une offre", contact: "Privatisations / événements d'entreprise" } },
    ],
  },
};

// ===================================================================
//  PAGES DÉTAILLÉES
// ===================================================================
const DETAILS = {
  "journee-team-lausanne": {
    world: "tournoi", title: "Journée Team Lausanne", subtitle: "Samedi, en marge du Lausanne Open — ouvert à toutes et tous",
    hero: "assets/photos/open-wheelchair.jpg",
    sections: [
      { type: "rich", title: "Une journée de fête autour du tennis", body: [
        "En marge du Lausanne Open, la Journée Team Lausanne met le tennis à la portée de tous, petits et grands, dans une ambiance conviviale.",
        "Venez jouer, tester, apprendre et vibrer — l'accès est libre.",
      ]},
      { type: "features", title: "Au programme", items: [
        ["Dès 11h", "Jouez avec nos meilleurs joueurs."],
        ["Radar", "Testez la vitesse de votre service."],
        ["Les petits", "Initiation pour les enfants."],
        ["Tennis-fauteuil", "Exhibition entre les deux demi-finales."],
        ["Vers 17h", "On termine par la finale du double."],
      ]},
      { type: "gallery", items: ["assets/photos/open-wheelchair.jpg", "assets/photos/open-kids.jpg"] },
    ],
  },
  stages: {
    world: "academie", title: "Nos stages", subtitle: "Vacances scolaires — dix semaines de stages à Lausanne",
    hero: "assets/webflow/stage-discovery.webp",
    sections: [
      { type: "formules", title: "Les formules",
        intro: "Du mini-tennis à l'entraînement de compétiteur, choisis la formule selon ton âge et tes envies, encadré par nos coachs aux Plaines-du-Loup. <b>−20 % dès la 2ᵉ semaine</b> ou pour un 2ᵉ membre de la famille.",
        items: [
          { name: "KidsTennis", age: "4 à 9 ans", lines: ["9h00–12h00", "1h30 de tennis + 1h30 d'activité", "Repas non inclus"], price: "250 CHF" },
          { name: "Loisirs", age: "9 à 18 ans", lines: ["9h00–17h00", "3h de tennis + 3h30 d'activité", "Repas inclus"], price: "450 CHF" },
          { name: "Loisirs ½ journée", age: "9 à 18 ans", lines: ["9h00–12h00 ou 14h00–17h00", "1h30 de tennis + 1h30 d'activité", "Repas non inclus"], price: "290 CHF" },
          { name: "Entraîne-toi comme un pro", age: "10 à 19 ans · dès R7", lines: ["9h00–17h00", "4h de tennis + 1h30 physique + 1h d'activité", "Repas inclus · option privé +240 CHF (3h)"], price: "790 CHF", pro: true },
          { name: "Stage adultes", age: "18 ans et +", lines: ["18h15–19h45 · semaines 4, 5 et 9", "1h30 de tennis par jour"], price: "240 CHF" },
        ]},
      { type: "stageform", title: "Réserve ta place" },
    ],
  },
  "sport-etudes": {
    world: "academie", title: "Sport-études", subtitle: "Concilier études et tennis, au plus haut niveau",
    hero: "assets/photos/coach1.jpg",
    sections: [
      { type: "rich", title: "Le programme de référence", body: [
        "Le sport-études permet aux 14–19 ans de concilier études et entraînement intensif, dans un cadre optimal et un suivi individualisé.",
        "Le programme s'étend sur 35 semaines selon le calendrier vaudois et combine tennis, préparation physique et études encadrées.",
      ]},
      { type: "stats", items: [["35", "semaines / an"], ["2h", "tennis / jour"], ["1h", "physique / jour"], ["4h", "études / jour"]] },
      { type: "features", title: "Un encadrement complet", items: [
        ["Écoles partenaires", "Enseignement à distance avec l'Institut DOMI, l'EPSU et le CNED."],
        ["Responsable pédagogique", "Un référent dédié : organisation, méthodologie, suivi des échéances."],
        ["Soutien académique", "Des assistants issus de l'EPFL et de l'UNIL, selon les besoins."],
        ["Objectif diplôme", "Maturité fédérale suisse ou baccalauréat français."],
      ]},
      { type: "rich", title: "Et après ?", body: [
        "Le programme développe autonomie, discipline et gestion du temps.",
        "Débouchés : université suisse, institutions américaines (NCAA) ou carrière tennistique professionnelle.",
      ], note: "Dès 21'600 CHF / année (10 mensualités possibles), repas de midi inclus." },
      { type: "gallery", items: ["assets/photos/p6.jpg", "assets/photos/coach3.jpg"] },
    ],
  },
  pro: {
    world: "academie", title: "Pro U18 & Pro", subtitle: "Le grand saut vers le circuit professionnel",
    hero: "assets/photos/coach2.jpg",
    sections: [
      { type: "stats", items: [["46", "semaines en Suisse"], ["15", "tournois / an"], ["2×", "sessions / jour"], ["dès 34 800.–", "CHF / an"]] },
      { type: "offers", title: "Deux programmes", items: [
        { name: "Pro U18", meta: "après la scolarité", detail: "Deux entraînements par jour et 15 semaines par an sur le circuit ITF junior pour monter dans la hiérarchie mondiale." },
        { name: "Pro", meta: "circuit ITF / ATP", detail: "Viser les points ATP, participer activement au circuit ITF et progresser au classement mondial." },
      ]},
      { type: "features", title: "Une journée type", items: [
        ["09h00–10h00", "Préparation physique (mercredi : 14h–16h)."],
        ["10h15–12h15", "Tennis, session du matin."],
        ["13h15–15h15", "Tennis, session de l'après-midi."],
        ["Suivi", "Rapports bihebdomadaires et planification annuelle."],
      ]},
      { type: "features", title: "Services inclus", items: [
        ["Médical & physio", "Suivi médical, physiothérapie et tests physiques réguliers."],
        ["Préparation mentale", "Un accompagnement mental intégré au programme."],
        ["Cordage & équipement", "Cordages et vêtements fournis."],
        ["Repas", "Repas de midi du lundi au vendredi."],
      ]},
      { type: "rich", title: "Accessible à tous les talents", body: [
        "Des solutions de soutien financier existent pour permettre aux jeunes de réaliser leurs ambitions sportives.",
      ], note: "Forfait dès 34'800 CHF / an. Option heures privées : 2'800 CHF (80 CHF/h sur 35 semaines). Frais à l'étranger à charge du joueur." },
      { type: "gallery", items: ["assets/photos/coach3.jpg", "assets/photos/p2.jpg"] },
    ],
  },
  kids: {
    world: "academie", title: "KidsTennis", subtitle: "Le tennis des enfants, dès 5 ans",
    hero: "assets/photos/kids3.jpg",
    sections: [
      { type: "rich", title: "Apprendre en s'amusant", body: [
        "KidsTennis initie les enfants dès 5 ans au tennis de façon ludique et progressive.",
        "Le jeu avant tout : coordination, motricité et plaisir, avec du matériel adapté à chaque âge et de petits groupes.",
      ]},
      { type: "features", title: "Notre approche", items: [
        ["Par le jeu", "Des exercices ludiques pour progresser sans s'en rendre compte."],
        ["Matériel adapté", "Raquettes et balles évolutives (rouge, orange, vert)."],
        ["Petits groupes", "Un encadrement de proximité pour chaque enfant."],
        ["Progression", "Un parcours clair vers la compétition et la Game Zone."],
      ]},
      { type: "offers", title: "KidsTennis en stage", items: [
        { name: "Stage KidsTennis", meta: "4–9 ans", detail: "Le matin, 9h–12h : 1h30 de tennis + 1h30 d'activité. 250 CHF / semaine." },
      ], note: "–20 % dès la 2ᵉ semaine ou pour plusieurs enfants d'une même famille." },
      { type: "gallery", items: ["assets/photos/kids1.jpg", "assets/photos/kids2.jpg"] },
    ],
  },
  gamezone: {
    world: "academie", title: "Game Zone", subtitle: "Des tournois juniors chaque week-end",
    hero: "assets/photos/kids2.jpg",
    sections: [
      { type: "rich", title: "Le concept", body: [
        "Chaque week-end, la Game Zone propose des tournois juniors sur une seule journée, avec deux matchs garantis par participant·e.",
        "Le format idéal pour se lancer en compétition, cumuler de l'expérience et grimper au classement de la saison.",
      ], link: { label: "Consulter les prochains tournois ↗", href: GAMEZONE_URL } },
      { type: "podium", title: "Classement 2025 / 2026", items: [
        ["Vincent Rauschert", "9 victoires"], ["Maxime Dietschy", "7 victoires"], ["Fabien Jaton", "7 victoires"],
      ]},
      { type: "ranking", title: "Les meilleurs de la saison",
        head: ["Joueur·euse", "Victoires"],
        rows: [
          ["Alexandre Josserand", "4"], ["Ilian Benboubker", "4"], ["Isaac Silmont", "4"],
          ["Jack Doriel", "4"], ["José Matias Herrera Arriagada", "4"], ["Karl Isgren", "4"],
          ["Matias Gerard", "4"], ["Melwan Gamba", "4"],
        ], note: "Suivis de plus de 200 joueuses et joueurs classés sur la saison." },
      { type: "gallery", items: ["assets/photos/kids1.jpg", "assets/photos/p4.jpg"] },
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
        <div class="podium">${sec.items.map(([n, v], i) =>
          `<div class="pod pod-${i + 1}"><div class="pod-rank">${i + 1}</div>
            <b>${esc(n)}</b><span>${esc(v)}</span></div>`).join("")}</div></section>`;

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
          `<article class="ccard"><div class="ccard-media" style="background-image:url('${o.photo}')"></div>
            ${pill(o)}</article>`).join("")}</div></section>`;
    }

    case "formules":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.intro ? `<p class="stg-intro">${sec.intro}</p>` : ""}
        <div class="formula-grid">${sec.items.map((f) =>
          `<div class="formula${f.pro ? " formula-pro" : ""}"><h3>${esc(f.name)}</h3>
            <div class="formula-age">${esc(f.age)}</div>
            <ul>${f.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
            <div class="formula-price">${esc(f.price)}</div></div>`).join("")}</div></section>`;

    case "stageform":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div id="stgp-list" class="stg-pub-list"><p class="muted">Chargement…</p></div></section>`;

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

    case "coaches":
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        <div class="coach-grid">${sec.items.map((c) =>
          `<figure class="coach"><div class="coach-photo" style="background-image:url('${c.photo}')"></div>
            <figcaption><b>${esc(c.name)}</b><span>${esc(c.role)}</span></figcaption></figure>`).join("")}</div></section>`;

    case "gallery":
      return `<section class="wsec"><div class="gallery">${sec.items.map((it) => {
        const src = typeof it === "string" ? it : it.src;
        const pos = (typeof it === "object" && it.pos) ? `;background-position:${it.pos}` : "";
        return `<div class="gphoto" style="background-image:url('${src}')${pos}"></div>`;
      }).join("")}</div></section>`;

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
  const ctaHTML = w.cta.map((c) => c.type === "contact"
    ? `<button class="btn-cta" data-contact="${esc(c.source)}">${esc(c.label)}</button>`
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
  const ctaHTML = `<button class="btn-cta ghost" data-back="${d.world}">← Retour à ${esc(w.tag.toLowerCase())}</button>`;
  paintHero({ logo: w.logo, hero: d.hero, tag: w.tag, slogan: d.title, desc: d.subtitle, ctaHTML });
  $("world-main").innerHTML = d.sections.map(sectionWrap).join("");
  animate();
  if ($("stgp-list")) stgLoad();
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

// ===================================================================
//  Connexion
// ===================================================================
const modal = $("login-modal");
const openModal = () => modal.classList.remove("hidden");
const closeModal = () => modal.classList.add("hidden");
// Si déjà connecté : le bouton mène à l'espace membre au lieu d'ouvrir le login.
let hasSession = false;
const memberAction = () => { if (hasSession) location.href = "reservation.html"; else openModal(); };
$("open-login").addEventListener("click", memberAction);
$("close-login").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("login-error"); err.hidden = true; $("login-btn").disabled = true;
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(), password: $("password").value });
  $("login-btn").disabled = false;
  if (error) { err.textContent = "Connexion impossible : " + error.message; err.hidden = false; return; }
  location.href = "reservation.html";
});
// On NE redirige plus automatiquement : on reste sur le site vitrine même connecté.
getSession().then((s) => { hasSession = !!s; });

// ---- Contact : page à part (contact.html?src=…) ----
function openContact(source) {
  location.href = "contact.html?src=" + encodeURIComponent(source || "Contact");
}

// ---- Inscription à un stage (page détail #stages) ----
let stgCats = {}, stgSessions = [], stgCurrent = null;
const stgDays = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
const stgEff = (p, d) => Math.round(Number(p) * Math.min(d, 5) / 5 * 100) / 100;

async function stgLoad() {
  const [{ data: cs }, { data: ss }] = await Promise.all([
    sb.from("stage_categories").select("*"),
    sb.from("stage_sessions").select("*").order("start_date"),
  ]);
  stgCats = {};
  for (const c of cs || []) stgCats[c.id] = c;
  stgSessions = ss || [];
  stgRenderList();
}
function stgRenderList() {
  const L = $("stgp-list"); if (!L) return;
  if (!stgSessions.length) { L.innerHTML = '<p class="muted">Aucun stage ouvert aux inscriptions pour le moment. Reviens bientôt !</p>'; return; }
  L.innerHTML = stgSessions.map((s) => {
    const c = stgCats[s.category_id] || {}, d = stgDays(s.start_date, s.end_date), price = stgEff(c.price || 0, d);
    const dates = s.start_date === s.end_date ? s.start_date : `${s.start_date} → ${s.end_date}`;
    const badges = `${c.meal ? '<span class="stg-tag">Repas inclus</span>' : ""}${c.tshirt ? '<span class="stg-tag">T-shirt offert</span>' : ""}`;
    return `<article class="stg-pub-card">
      ${c.image_url ? `<img src="${c.image_url}" alt="" class="stg-pub-img" loading="lazy"/>` : '<div class="stg-pub-img stg-pub-noimg"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M4.7 6.5c3.2 2 3.2 9 0 11M19.3 6.5c-3.2 2-3.2 9 0 11"/></svg></div>'}
      <div class="stg-pub-body"><h3>${esc(s.title || c.name || "Stage")}</h3>
        <div class="stg-pub-dates">${dates} · ${d} jour(s)</div>
        <div class="stg-pub-badges">${badges}</div>
        <div class="stg-pub-foot"><span class="stg-pub-price">${price} CHF</span>
          <button class="stg-pub-cta" data-stg="${s.id}">S'inscrire</button></div></div></article>`;
  }).join("");
  L.querySelectorAll(".stg-pub-cta").forEach((b) => b.addEventListener("click", () => stgOpenForm(b.dataset.stg)));
}
function stgOpenForm(id) {
  stgCurrent = stgSessions.find((s) => s.id === id);
  const c = stgCats[stgCurrent.category_id] || {}, d = stgDays(stgCurrent.start_date, stgCurrent.end_date), price = stgEff(c.price || 0, d);
  $("stgp-modal-title").textContent = stgCurrent.title || c.name || "Stage";
  $("stgp-modal-meta").innerHTML = `${stgCurrent.start_date}${stgCurrent.end_date !== stgCurrent.start_date ? " → " + stgCurrent.end_date : ""} · <b>${price} CHF</b>`;
  $("f-tshirt-wrap").classList.toggle("hidden", !c.tshirt);
  $("f-meal-wrap").classList.toggle("hidden", !c.meal);
  $("stgp-form").reset(); $("f-meal-text").disabled = true;
  $("stgp-form").classList.remove("hidden"); $("stgp-done").classList.add("hidden"); $("stgp-error").hidden = true;
  $("stgp-modal").classList.remove("hidden");
}
function stgCloseForm() { $("stgp-modal").classList.add("hidden"); stgCurrent = null; }
$("stgp-close").addEventListener("click", stgCloseForm);
$("stgp-modal").addEventListener("click", (e) => { if (e.target === $("stgp-modal")) stgCloseForm(); });
document.addEventListener("change", (e) => { if (e.target.name === "meal") $("f-meal-text").disabled = e.target.value !== "autre"; });
$("stgp-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("stgp-error"); err.hidden = true;
  const c = stgCats[stgCurrent.category_id] || {};
  let meal = null;
  if (c.meal) { const sel = document.querySelector('input[name="meal"]:checked')?.value; meal = sel === "autre" ? ($("f-meal-text").value.trim() || "À préciser") : "Aucune"; }
  const row = { stage_id: stgCurrent.id, first_name: $("f-first").value.trim(), last_name: $("f-last").value.trim(),
    email: $("f-email").value.trim(), birth_date: $("f-birth").value || null,
    tshirt_size: c.tshirt ? ($("f-tshirt").value || null) : null, meal_restriction: meal, comment: $("f-comment").value.trim() || null };
  const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Envoi…";
  const { error } = await sb.from("stage_registrations").insert(row);
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; btn.disabled = false; btn.textContent = "Envoyer mon inscription"; return; }
  $("stgp-form").classList.add("hidden"); $("stgp-done").classList.remove("hidden");
});

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
    return;
  }
  const scroll = e.target.closest("[data-scroll]");
  if (scroll) { document.querySelector("." + scroll.dataset.scroll)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  const goto = e.target.closest("[data-goto]");
  if (goto) {
    const w = goto.dataset.goto, a = goto.dataset.anchor;
    history.replaceState(null, "", "#" + w);
    renderWorld(w);
    requestAnimationFrame(() => document.querySelector(`[data-anchor="${a}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return;
  }
  const back = e.target.closest("[data-back]");
  if (back) { location.hash = back.dataset.back; return; }
  const sw = e.target.closest(".sw, .flow-step");
  if (sw && sw.dataset.world) { location.hash = sw.dataset.world; }
});

window.addEventListener("hashchange", route);
route();

// Arrivée depuis une autre page avec ?at=<ancre> : défiler vers la section.
(() => {
  const at = new URLSearchParams(location.search).get("at");
  if (!at) return;
  requestAnimationFrame(() => document.querySelector(`[data-anchor="${at}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  history.replaceState(null, "", location.pathname + location.hash);
})();
