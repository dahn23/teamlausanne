// Site public dynamique : mondes + pages détaillées (routage par ancre).
import { sb, getSession, myRoles, hasAny, landingFor, CONSOLE_ROLES, frDate, jours } from "./common.js";
import "./pretty-select.js";
import { SEEDS, DRAPEAUX } from "./seeds-data.js";
import { hit } from "./hit.js";
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
  academie: {
    tag: "Academy", retour: "à l'Academy",
    logo: "assets/logo-academie.webp", heroLogo: "assets/logo-academie-blanc.png",
    slogan: "Jouer. Progresser. Ensemble.",
    desc: "Le centre de formation du Lausanne-Sports Tennis. Un parcours complet, du premier jeu à la performance, adapté à chaque âge dès 5 ans.",
    hero: "assets/photos/competition-2026-g1.jpg", heroPos: "center 40%",
    cta: [{ label: "Nos stages", type: "stages" }, { label: "Nos tournois GameZone", type: "gamezone" }, { label: "Nous contacter", type: "contact", source: "Renseignement pour l'Academy" }],
    sections: [
      { type: "rich", anchor: "philosophie", title: "Notre philosophie", body: [
        "Team Lausanne propose un encadrement complet du tennis, adapté à chaque âge et à chaque niveau de jeu, au sein d'une véritable pyramide de formation.",
        "Notre objectif : amener chaque jeune à un niveau au moins suffisant pour rejoindre une université américaine (NCAA) s'il le souhaite, une fois sa maturité suisse ou son baccalauréat français en poche.",
      ]},
      { type: "pyramid", title: "Notre stratégie de formation",
        sub: "À chaque étape, le volume d'entraînements et de tournois augmente progressivement : le jeune teste ainsi sa motivation dans le tennis — notre principal critère de sélection.",
        levels: [
          { name: "Pro · NCAA (USA) · Formation coach", meta: "dès 18 ans", href: "#pro" },
          { name: "Sport-études & Pro U18", meta: "places limitées", href: "#sport-etudes" },
          { name: "Performance", meta: "≈ 12–15 ans · 8 places", href: "#performance" },
          { name: "Compétition", meta: "≈ 10–13 ans · 16 places", href: "#competition" },
          { name: "Kids Tennis", meta: "4–10 ans · ouvert à tous", href: "#kids" },
        ],
        club: { title: "Filière Club", href: "#club-academy", body: [
          "En parallèle de la pyramide de sélection, la filière Club s'adresse à celles et ceux qui veulent développer leur tennis à leur rythme, une ou plusieurs fois par semaine.",
          "Avec la possibilité de disputer quelques compétitions ponctuelles — dont les interclubs, pour les membres du club.",
        ]},
        note: "L'âge n'est qu'un repère : la progression s'adapte à chacun, à 1–2 ans près. Celles et ceux qui ne rejoignent pas une filière sélective poursuivent en Club." },
      { type: "carousel", anchor: "programmes", eyebrow: "Cours pour tous", title: "Un programme pour chaque niveau",
        sub: "Du premier échange à la performance, un parcours clair pour progresser avec plaisir.",
        items: [
          { name: "Kids Tennis", photo: "assets/photos/kidstennis-2026.jpg", href: "#kids" },
          { name: "Club", photo: "assets/photos/club-2026.jpg", href: "#club-academy" },
          { name: "Compétition", photo: "assets/photos/competition-2026-card.jpg", href: "#competition" },
          { name: "Performance", photo: "assets/photos/performance-2026.jpg", href: "#performance" },
          { name: "Sport-études", photo: "assets/photos/sport-etudes-2026.jpg", href: "#sport-etudes" },
          { name: "Pro U18", photo: "assets/photos/pro-u18-2026.jpg", href: "#pro-u18" },
          { name: "Pro", photo: "assets/photos/pro-2026.jpg", href: "#pro" },
          { name: "Game Zone", photo: "assets/photos/gamezone-2026.jpg", href: "#gamezone" },
          { name: "Stages", photo: "assets/photos/stages-2026.jpg", href: "#stages" },
          { name: "Adultes et privés", photo: "assets/photos/adultes-2026.jpg", href: "#adultes" },
        ]},
    ],
  },

  tournoi: {
    tag: "Lausanne Open", retour: "au Lausanne Open",
    logo: "assets/logo-open.webp",
    slogan: "Vibrer. Rêver. Ensemble.",
    desc: "Lausanne Open — l'unique tournoi international de tennis masculin du canton de Vaud. Le circuit professionnel, chez nous, aux Plaines-du-Loup.",
    hero: "assets/photos/open-2026-6.jpg", heroPos: "center 30%",
    cta: [],
    sections: [
      { type: "stats", anchor: "tournoi", items: [["Août 2027", "prochaine édition"], ["30 000 $", "dotation"], ["Gratuit", "entrée libre"], ["ITF M25", "catégorie"]] },
      { type: "split", anchor: "presentation", title: "Le grand rendez-vous du tennis vaudois masculin", videoFile: "assets/video/lausanne-open-2026.mp4", poster: "assets/video/lausanne-open-2026.jpg", vertical: true, body: [
        "Le Lausanne Open réunit chaque année plusieurs dizaines de joueurs de toutes nationalités, pour la plupart classés à l'ATP, sur les courts de la Pontaise.",
        "L'accès est entièrement gratuit, toute la semaine.",
      ], link: { label: "Site & résultats ITF ↗", href: ITF_URL } },
      { type: "carousel", eyebrow: "Lausanne Open", title: "Une semaine d'événements",
        sub: "Entrée libre toute la semaine, animations grand public et hospitalité.",
        items: [
          { name: "Initiation pour les écoles", photo: "assets/photos/open-ecoles-2026.jpg" },
          { name: "Journée Team Lausanne", photo: "assets/photos/journee-famille-2026.jpg" },
          { name: "VIP · Tennis & Lunch", photo: "assets/photos/open-lunch-2026.jpg" },
        ]},
      { type: "seeds", anchor: "tetes-de-serie", title: "Voici les 8 têtes de série de l'édition 2026",
        sub: "Le tenant du titre, ancien numéro 1 mondial junior, et sept autres joueurs classés parmi les 650 meilleurs du monde. Classement ATP au moment du tirage." },
      { type: "ranking", anchor: "palmares", title: "Palmarès",
        head: ["Année", "Simple", "Double"],
        rows: [["2026", `${FLAG_CH} Henry Bernet`, `${FLAG_CH} Johan Niklès · ${FLAG_CH} Adrien Burdet`],
               ["2025", `${FLAG_CH} Henry Bernet`, `${FLAG_IE} Charles Barry · ${FLAG_FR} Max Westphal`]] },
      { type: "gallery", anchor: "photos", items: [
        "assets/photos/open-2026-1.jpg",
        "assets/photos/open-2026-2.jpg",
        "assets/photos/open-2026-3.jpg",
        "assets/photos/open-2026-4.jpg",
        "assets/photos/open-2026-5.jpg",
        "assets/photos/open-2026-7.jpg",
      ]},
      { type: "features", anchor: "infos", title: "Infos pratiques", items: [
        ["Dates", "Prochaine édition : août 2027."],
        ["Entrée libre", "Accès gratuit toute la semaine, sans billet."],
        ["Lieu", "TC Lausanne-Sports, Plaines-du-Loup, 1018 Lausanne."],
        ["Une question ?", "Écrivez-nous, nous répondons rapidement."],
      ], link: { label: "Nous écrire", scroll: "contact-lo" } },
      { type: "sponsors", anchor: "partenaires", title: "Partenaires du tournoi 2026",
        sub: "Le Lausanne Open n’existerait pas sans eux.", items: [
        { n: "Ville de Lausanne",              l: "ville-lausanne",      u: "https://www.lausanne.ch/" },
        { n: "Canton de Vaud",                 l: "canton-vaud",         u: "https://www.vd.ch/" },
        { n: "Swiss Tennis",                   l: "swiss-tennis",        u: "https://www.swisstennis.ch/" },
        { n: "Fonds du Sport Vaudois",         l: "fonds-sport-vaudois", u: "https://ffsv.ch/" },
        { n: "Association Vaudoise de Tennis", l: "vaud-tennis",         u: "https://www.vaud-tennis.ch/" },
        { n: "SVR Vins",                       l: "svr-vins",            u: "https://svrvins.ch/" },
        { n: "ibis Lausanne",                  l: "ibis",                u: "https://all.accor.com/hotel/6772/index.fr.shtml" },
        { n: "Garage de la Plaine",            l: "garage-plaine",       u: "https://www.garageplaine.ch/" },
        { n: "BS Architectes",                 l: "bs-architectes",      u: "https://bs-ac.ch/" },
        { n: "Cafés Cuendet",                  l: "cafes-cuendet",       u: "https://cafes-cuendet.ch/" },
        { n: "Boissons Gros de Vaud",          l: "boissons-gros-vaud",  u: "https://www.boissons-gros-de-vaud.ch/" },
        { n: "Nestlé Community",              l: "nestle",              u: "https://www.nestle.ch/fr/nestle-en-suisse/nestle-community" },
        { n: "Santé Prilly",                  l: "sante-prilly",        u: "https://www.santeprilly.ch/" },
        { n: "Sport et Solidarité",           l: "sport-solidarite",    u: "https://www.sportetsolidarite.ch/" },
      ]},
    ],
  },

};

// ===================================================================
//  PAGES DÉTAILLÉES
// ===================================================================
const DETAILS = {
  "journee-team-lausanne": {
    world: "tournoi", title: "Journée Team Lausanne", subtitle: "Samedi, en marge du Lausanne Open — ouvert à toutes et tous",
    hero: "assets/photos/open-kids.jpg",
    sections: [
      { type: "rich", title: "Une journée de fête autour du tennis", body: [
        "En marge du Lausanne Open, la Journée Team Lausanne met le tennis à la portée de tous, petits et grands, dans une ambiance conviviale.",
        "Venez jouer, tester, apprendre et vibrer — l'accès est libre.",
      ]},
      { type: "features", title: "Au programme", items: [
        ["Dès 11h", "Jouez avec nos meilleurs joueurs."],
        ["Radar", "Testez la vitesse de votre service."],
        ["Les petits", "Initiation pour les enfants."],
        ["Vers 15h", "On termine par la finale du double."],
      ]},
      { type: "gallery", items: ["assets/photos/open-kids.jpg", "assets/photos/open-serve.jpg"] },
    ],
  },
  stages: {
    world: "academie", title: "Nos stages", subtitle: "Vacances scolaires — dix semaines de stages à Lausanne",
    hero: "assets/photos/stages-2026.jpg",
    sections: [
      { type: "formules", title: "Les formules",
        intro: "Du mini-tennis à l'entraînement de compétiteur, choisis la formule selon ton âge et tes envies, encadré par nos coachs aux Plaines-du-Loup. <b>−20 % dès la 2ᵉ semaine</b> ou pour un 2ᵉ membre de la famille.",
        items: [
          { name: "Kids Tennis", age: "4 à 9 ans", lines: ["9h00–12h00", "1h30 de tennis + 1h30 d'activité", "Repas non inclus"], price: "250 CHF" },
          { name: "Loisirs", age: "9 à 18 ans", lines: ["9h00–17h00", "3h de tennis + 3h30 d'activité", "Repas inclus"], price: "450 CHF" },
          { name: "Loisirs ½ journée", age: "9 à 18 ans", lines: ["9h00–12h00 ou 14h00–17h00", "1h30 de tennis + 1h30 d'activité", "Repas non inclus"], price: "290 CHF" },
          { name: "Entraîne-toi comme un pro", age: "10 à 19 ans · dès R7", lines: ["9h00–17h00", "4h de tennis + 1h30 physique + 1h d'activité", "Repas inclus · option privé +240 CHF (3h)"], price: "790 CHF", pro: true },
          { name: "Stage adultes", age: "18 ans et +", lines: ["18h15–19h45 · uniquement certaines semaines en été", "1h30 de tennis par jour"], price: "240 CHF" },
        ], link: { label: "Une question ? Nous écrire", contact: "Renseignement pour les stages" } },
      { type: "stageform", title: "Réserve ta place" },
    ],
  },
  "sport-etudes": {
    world: "academie", title: "Sport-études", subtitle: "Concilier études et tennis, au plus haut niveau",
    hero: "assets/photos/sport-etudes-2026.jpg", heroPos: "42% 22%",
    sections: [
      { type: "rich", title: "Le programme de référence", body: [
        "Le sport-études permet aux 14–19 ans de concilier études et entraînement intensif, dans un cadre optimal et un suivi individualisé.",
        "Le programme s'étend sur 35 semaines selon le calendrier vaudois et combine tennis, préparation physique et études encadrées.",
      ]},
      { type: "stats", items: [["35", "semaines / an"], ["2h", "tennis / jour"], ["1h", "physique / jour"], ["4h", "études / jour"]] },
      { type: "features", title: "Un encadrement complet", items: [
        ["Repas de midi", "Repas de midi inclus, pris sur place."],
        ["Écoles partenaires", "Enseignement à distance avec l'Institut DOMI, l'EPSU et le CNED."],
        ["Responsable pédagogique", "Un référent dédié : organisation, méthodologie, suivi des échéances."],
        ["Soutien académique", "Des assistants issus de l'EPFL et de l'UNIL, selon les besoins."],
        ["Objectif diplôme", "Maturité fédérale suisse ou baccalauréat français."],
        ["Médical & physio", "Suivi médical, physiothérapie et tests réguliers."],
        ["Préparation mentale", "Un accompagnement mental intégré."],
      ]},
      { type: "rich", title: "Et après ?", body: [
        "Le programme développe autonomie, discipline et gestion du temps.",
        "Débouchés : université suisse, institutions américaines (NCAA) ou carrière tennistique professionnelle.",
      ], link: { label: "Nous écrire", contact: "Renseignement pour l'Academy" } },
      { type: "gallery", items: ["assets/photos/sport-etudes-2026-g1.jpg", "assets/photos/sport-etudes-2026-g2.jpg"] },
    ],
  },
  competition: {
    world: "academie", title: "Compétition",
    subtitle: "Entraînement structuré et matchs, pour les jeunes prêts à passer un cap : gagner en régularité, en confiance et en esprit de compétition, sur un parcours de progression clair.",
    hero: "assets/photos/competition-2026.jpg",
    cta: { label: "Demander des informations", scroll: "enroll-sec" },
    sections: [
      { type: "keywords", label: "Ce qui fait la filière Compétition", items: [
        "Filière sélective", "Petits groupes de niveau", "Tournois juniors",
        "GameZone", "Esprit de compétition", "Vers la Performance",
      ]},
      { type: "split", photos: [
          "assets/photos/competition-2026-s2.jpg", "assets/photos/competition-2026-s1.jpg",
          "assets/photos/competition-2026-s3.jpg", "assets/photos/competition-2026-s4.jpg",
        ],
        eyebrow: "Un cap à passer", title: "Entrer en compétition", body: [
          "La filière Compétition accueille les jeunes d'environ 10 à 13 ans qui veulent se mesurer aux autres et progresser dans un cadre encadré.",
          "16 places par sélection. L'âge reste un simple repère : celles et ceux qui ne rejoignent pas la filière poursuivent en Club.",
        ], link: { label: "Rejoindre la filière", scroll: "enroll-sec", cta: true } },
      { type: "perks", eyebrow: "Ce qui distingue la filière",
        title: "Un cadre pensé pour la compétition",
        lead: "Pour celles et ceux qui sont prêts à s'entraîner plus régulièrement et à jouer les matchs qui font progresser.", items: [
          ["Environ 10 à 13 ans", "Une filière sélective, seize places par sélection."],
          ["Groupes de niveau", "Des entraînements réguliers, encadrés, en tout petits groupes homogènes."],
          ["Tournois et GameZone", "La compétition tout au long de la saison, préparée avec les coachs."],
          ["Une passerelle", "La suite naturelle du parcours est la filière Performance."],
        ]},
      { type: "slots", eyebrow: "La semaine type",
        title: "Entraînements et tarif",
        lead: "Deux rendez-vous par semaine : deux heures de tennis et une heure de préparation physique.", items: [
          { titre: "Séance 1", heures: ["1 h de tennis"] },
          { titre: "Séance 2", heures: ["1 h de tennis", "1 h de physique"] },
        ],
        prix: { label: "Saison complète · 35 semaines", montant: "CHF 1'990.–",
                detail: "2 h de tennis et 1 h de physique par semaine",
                cta: { label: "Rejoindre la filière", scroll: "enroll-sec" } },
        note: "La filière ouvre ensuite sur la Performance." },
      { type: "faq", eyebrow: "Questions fréquentes",
        title: "Tout ce qu'il faut savoir avant de se lancer", items: [
          ["À qui s'adresse la filière ?", "Aux joueuses et joueurs d'environ 10 à 13 ans qui ont déjà des bases solides et veulent s'entraîner plus régulièrement pour entrer en compétition."],
          ["Est-ce adapté aux débutants ?", "Non. On commence par Kids Tennis ou par la filière Club. La Compétition suppose des bases déjà acquises."],
          ["Comment se fait la sélection ?", "Selon l'âge, le niveau, le parcours et la motivation. La filière compte seize places, et l'âge n'est qu'un repère, à un ou deux ans près."],
          ["Sur quoi travaille-t-on ?", "La régularité technique, la lecture tactique, le déplacement et l'attitude en match — ce qui fait la différence une fois le score lancé."],
          ["Quelles compétitions ?", "Les tournois juniors et les GameZone, tout au long de la saison, avec les coachs pour préparer et débriefer."],
          ["Et ensuite ?", "La filière Performance prend le relais pour celles et ceux qui confirment."],
        ]},
      { type: "enroll", title: "Demander une inscription", filiere: "competition", ranking: true,
        lead: "Intéressé(e) par la filière Compétition ? Remplissez ce formulaire, le secrétariat vous recontacte." },
    ],
  },
  performance: {
    world: "academie", title: "Performance",
    subtitle: "La filière qui fait le lien entre la Compétition et le Sport-études : charge d'entraînement renforcée, préparation physique intégrée et exigence du match, pour les jeunes prêts à passer à la vitesse supérieure.",
    hero: "assets/photos/performance-2026.jpg",
    cta: { label: "Demander des informations", scroll: "enroll-sec" },
    sections: [
      { type: "keywords", label: "Ce qui fait la filière Performance", items: [
        "Entraînement renforcé", "Préparation physique", "Exigence du match",
        "Suivi individualisé", "Filière sélective", "Vers le Sport-études",
      ]},
      { type: "split", photos: [
          "assets/photos/performance-2026-s1.jpg", "assets/photos/performance-2026-s2.jpg",
          "assets/photos/performance-2026-s3.jpg",
        ],
        eyebrow: "Une étape qui compte", title: "Viser le meilleur niveau", body: [
          "La filière Performance s'adresse aux jeunes d'environ 12 à 15 ans prêts à s'investir davantage. Elle se chevauche avec la Compétition : l'âge n'est pas un frein, c'est une évolution qui s'adapte à 1–2 ans près.",
          "8 places par sélection. Les autres poursuivent en Club ou en Compétition.",
        ], link: { label: "Rejoindre la filière", scroll: "enroll-sec", cta: true } },
      { type: "perks", eyebrow: "Pourquoi on progresse ici",
        title: "Un cadre plus exigeant pour franchir un palier",
        lead: "Tout est pensé pour celles et ceux qui sont prêts à s'entraîner davantage et à tenir cette exigence sur une saison.", items: [
          ["Environ 12 à 15 ans", "Une filière sélective, huit places par sélection."],
          ["Volume renforcé", "Une charge d'entraînement plus élevée, avec le physique intégré à la semaine."],
          ["Suivi rapproché", "Un encadrement de proximité et une planification individualisée."],
          ["La suite du parcours", "L'accès au Sport-études, puis à la voie Pro U18."],
        ]},
      { type: "slots", eyebrow: "La semaine type",
        title: "Entraînements et tarif",
        lead: "Quatre rendez-vous par semaine : cinq heures de tennis et une heure de préparation physique.", items: [
          { titre: "Séance 1", heures: ["2 h de tennis"] },
          { titre: "Séance 2", heures: ["1 h de tennis"] },
          { titre: "Séance 3", heures: ["1 h de tennis", "1 h de physique"] },
          { titre: "Séance 4", heures: ["1 h de tennis"] },
        ],
        prix: { label: "Saison complète · 35 semaines", montant: "CHF 4'490.–",
                detail: "5 h de tennis et 1 h de physique par semaine",
                cta: { label: "Rejoindre la filière", scroll: "enroll-sec" } },
        note: "La filière ouvre ensuite sur le Sport-études." },
      { type: "faq", eyebrow: "Questions fréquentes",
        title: "Tout ce qu'il faut savoir avant de s'engager", items: [
          ["Quelle différence avec la Compétition ?", "La Compétition installe les habitudes de match. La Performance va plus loin : davantage de volume d'entraînement, la préparation physique intégrée, un suivi individualisé et un lien clair vers le Sport-études."],
          ["À qui s'adresse la filière ?", "Aux joueuses et joueurs d'environ 12 à 15 ans, déjà réguliers en compétition, prêts à s'investir davantage sur toute une saison."],
          ["Comment se fait la sélection ?", "Huit places, attribuées selon le niveau, le parcours et l'engagement. L'âge n'est qu'un repère : la filière se chevauche avec la Compétition, à un ou deux ans près."],
          ["Sur quoi travaille-t-on ?", "Le geste, la lecture tactique, le déplacement et la préparation physique, avec l'exigence du match comme fil conducteur."],
          ["Et si la sélection ne passe pas ?", "On poursuit en Compétition ou en Club. Rien n'est figé : l'évolution se fait à son rythme, et la porte reste ouverte la saison suivante."],
          ["Et ensuite ?", "Le Sport-études prend le relais, puis la voie Pro U18 pour celles et ceux qui confirment."],
        ]},
      { type: "enroll", title: "Demander une inscription", filiere: "performance", ranking: true,
        lead: "Intéressé(e) par la filière Performance ? Remplissez ce formulaire, le secrétariat vous recontacte." },
    ],
  },
  "pro-u18": {
    world: "academie", title: "Pro U18", subtitle: "Après la scolarité, viser le circuit ITF junior",
    hero: "assets/photos/pro-u18-2026.jpg", heroPos: "55% 12%",
    sections: [
      { type: "rich", title: "Monter dans la hiérarchie mondiale", body: [
        "Après la scolarité obligatoire, le programme Pro U18 permet de s'entraîner à plein temps tout en participant au circuit ITF junior.",
        "Cinq semaines de tournois à l'étranger par an, deux entraînements quotidiens et un suivi rapproché pour progresser au classement mondial.",
      ]},
      { type: "features", title: "Une journée type", items: [
        ["09h00–10h00", "Préparation physique."],
        ["10h15–12h15", "Tennis, session du matin."],
        ["13h15–15h15", "Tennis, session de l'après-midi."],
        ["Suivi", "Planification annuelle."],
      ]},
      { type: "features", title: "Ce qui est inclus", items: [
        ["Repas de midi", "Repas de midi inclus, pris sur place."],
        ["Médical & physio", "Suivi médical, physiothérapie et tests réguliers."],
        ["Préparation mentale", "Un accompagnement mental intégré."],
        ["Cordage & équipement", "Cordages et vêtements fournis."],
        ["Tournois", "5 semaines de tournois à l'étranger par an."],
      ], link: { label: "Nous écrire", contact: "Renseignement pour l'Academy" } },
      { type: "gallery", items: ["assets/photos/pro-u18-2026-g1.jpg", "assets/webflow/physical-training.jpg"] },
    ],
  },
  pro: {
    world: "academie", title: "Pro", subtitle: "Un accompagnement sur mesure vers le circuit professionnel",
    hero: "assets/photos/pro-2026.jpg", heroPos: "center 42%",
    sections: [
      { type: "rich", title: "Du sur-mesure", body: [
        "Au niveau professionnel, il n'y a pas d'offre standard : chaque joueuse et joueur bénéficie d'un programme entièrement personnalisé.",
        "L'encadrement s'adapte aux déplacements à l'étranger, au calendrier de tournois, aux objectifs de classement et au projet de chacun — entraînement, préparation physique et mentale, physiothérapie, logistique.",
      ], link: { label: "Nous écrire", contact: "Renseignement pour l'Academy" } },
      { type: "features", title: "Ce que nous adaptons", items: [
        ["Calendrier", "Programme construit autour de vos tournois et déplacements."],
        ["Encadrement", "Coach référent, physique, mental et physio selon les besoins."],
        ["Objectifs", "Points ATP/WTA, classement, préparation de saison."],
        ["Flexibilité", "Sessions ajustées à votre rythme et vos absences."],
      ]},
      { type: "rich", title: "Une solution 360°, y compris financière", body: [
        "Le tennis professionnel a un coût. Nous construisons ensemble une solution 360° qui inclut la partie financière, pour vous permettre de vous concentrer sur le jeu.",
      ]},
      { type: "features", title: "Des solutions de financement", items: [
        ["Interclubs", "Financement via la participation aux interclubs."],
        ["Cours rémunérés", "Donner des cours de tennis rémunérés au sein de l'académie."],
        ["Journées GameZone", "Organiser des journées de tournoi GameZone."],
        ["Formations coaching", "Prise en charge de formations de coaching."],
        ["Logement", "Solutions de logement sur Lausanne."],
      ], link: { label: "Nous écrire", contact: "Renseignement pour l'Academy" } },
      { type: "gallery", items: ["assets/photos/pro-2026-g1.jpg", "assets/photos/open-serve.jpg"] },
    ],
  },
  kids: {
    world: "academie", title: "Kids Tennis", subtitle: "Le tennis dès 4 ans, dans un cadre ludique, structuré et bienveillant : nos cours posent des bases solides et donnent le goût du jeu dès les toutes premières séances.",
    hero: "assets/photos/kidstennis-2026.jpg",
    cta: { label: "Demander un cours d'essai", scroll: "enroll-sec" },
    sections: [
      { type: "keywords", label: "Ce qui fait le Kids Tennis", items: [
        "Apprendre en jouant", "Encadrement adapté à l'âge", "Prendre confiance",
        "Cadre bienveillant", "Progression structurée", "Petits groupes",
      ]},
      { type: "split", photos: [
          "assets/photos/kids-ambiance.jpg", "assets/photos/kids-2026-1.jpg",
          "assets/photos/kids-open.jpg", "assets/photos/kids-2026-2.jpg",
        ],
        eyebrow: "Un premier pas qui compte", title: "Apprendre le jeu comme il faut", body: [
          "Kids Tennis initie les enfants de 4 à 9 ans au tennis de façon ludique et progressive, tout au long de l'année scolaire.",
          "Le jeu avant tout : coordination, motricité et plaisir, avec du matériel adapté à chaque âge et un encadrement de proximité.",
        ], link: { label: "Inscrire mon enfant", scroll: "enroll-sec", cta: true } },
      { type: "perks", eyebrow: "Pourquoi les parents nous choisissent",
        title: "Le bon cadre pour démarrer et progresser",
        lead: "Tout est pensé pour que votre enfant apprenne, prenne du plaisir et progresse à son rythme.", items: [
          ["Quatre enfants par coach", "Un tout petit groupe : de l'attention, des retours immédiats et de vrais progrès."],
          ["Toute la saison", "Une séance de 45 minutes par semaine, du 31 août 2026 au 2 juillet 2027."],
          ["T-shirt offert", "Le t-shirt Team Lausanne Academy est offert à chaque enfant."],
          ["Raquette prêtée", "Pas de matériel ? Nous prêtons la raquette, il n'y a qu'à venir jouer."],
        ]},
      { type: "slots", eyebrow: "Trouver le bon moment",
        title: "Horaires et tarif",
        lead: "Choisissez le créneau qui s'accorde avec la semaine de votre enfant.", items: [
          { titre: "Mercredi", heures: ["13h30 – 14h15", "14h15 – 15h00"] },
          { titre: "Mardi ou jeudi", heures: ["16h30 – 17h15"] },
          { titre: "Sur mesure", heures: ["Fin d'après-midi"], note: "Des cours supplémentaires sont possibles : écrivez-nous." },
        ],
        prix: { label: "Saison complète", montant: "CHF 490.–", detail: "45 minutes par semaine, matériel et t-shirt compris",
                cta: { label: "Inscrire mon enfant", scroll: "enroll-sec" } } },
      { type: "faq", eyebrow: "Questions fréquentes",
        title: "Tout ce qu'il faut savoir avant de commencer", items: [
          ["Mon enfant doit-il avoir déjà joué ?", "Non. Le programme convient aussi bien aux enfants qui découvrent le tennis qu'à ceux qui ont déjà commencé."],
          ["À quel âge peut-on débuter ?", "Dès 4 ans environ, avec des séances adaptées à l'âge et au niveau. À ce stade, l'accent est mis sur la coordination, le déplacement et le plaisir de jouer."],
          ["Comment les groupes sont-ils formés ?", "Selon l'âge, le niveau, l'expérience et les disponibilités, pour que chaque enfant apprenne dans le bon environnement."],
          ["De quel matériel a-t-il besoin ?", "Une tenue de sport confortable et des chaussures de tennis. La raquette peut être prêtée, en particulier pour les débutants."],
          ["Comment mon enfant progresse-t-il ?", "Par un encadrement adapté à son âge, du travail de coordination, les bases techniques et les retours réguliers de l'équipe de coachs."],
        ]},
      { type: "enroll", title: "Demander une inscription", filiere: "kidstennis", ranking: false,
        lead: "Envie d'inscrire votre enfant à Kids Tennis ? Remplissez ce formulaire, le secrétariat vous recontacte." },
    ],
  },
  "club-academy": {
    world: "academie", title: "Club",
    subtitle: "Des entraînements encadrés, une à deux fois par semaine, pour tous les niveaux : progresser à son rythme, rester en mouvement et prendre du plaisir sur le court, toute l'année.",
    hero: "assets/photos/club-2026.jpg",
    cta: { label: "Demander des informations", scroll: "enroll-sec" },
    sections: [
      { type: "keywords", label: "Ce qui fait l'offre Club", items: [
        "Ambiance club", "Encadrement professionnel", "Progression régulière",
        "Apprendre en jouant", "Petits groupes", "Sur la durée",
      ]},
      { type: "split", photos: [
          "assets/photos/club-2026-2.jpg", "assets/photos/club-2026-1.jpg",
          "assets/photos/club-2026-3.jpg",
        ],
        eyebrow: "Un lieu pour jouer et progresser", title: "Jouer et progresser, sans pression", body: [
          "L'offre Club s'adresse à celles et ceux qui veulent jouer 1 ou plusieurs heures par semaine toute l'année — débutants comme plus avancés.",
          "Un entraînement régulier pour progresser à son rythme, avec la possibilité d'ajouter une deuxième séance par semaine.",
        ], link: { label: "Rejoindre le Club", scroll: "enroll-sec", cta: true } },
      { type: "perks", eyebrow: "Pourquoi rejoindre le Club",
        title: "Le bon équilibre entre encadrement et liberté",
        lead: "Tout est prévu pour que chacun trouve son rythme, quel que soit son niveau de départ.", items: [
          ["Quatre jeunes par coach", "Un encadrement de proximité, avec des retours immédiats sur le court."],
          ["Toute la saison", "Une heure par semaine, du 31 août 2026 au 2 juillet 2027."],
          ["Jusqu'à deux séances", "Possibilité d'ajouter un deuxième entraînement hebdomadaire."],
          ["T-shirt offert", "Le t-shirt Team Lausanne est offert à chaque joueuse et joueur."],
        ]},
      { type: "slots", eyebrow: "Trouver le bon moment",
        title: "Horaires et tarifs",
        lead: "Le tarif dépend du jour choisi ; le t-shirt Team Lausanne est compris dans tous les cas.", items: [
          { titre: "Lundi", heures: ["17h15 – 19h15"], prix: "770.–" },
          { titre: "Mardi", heures: ["17h15 – 19h15"], prix: "815.–" },
          { titre: "Mercredi", heures: ["13h15 – 19h15"], prix: "815.–" },
          { titre: "Jeudi", heures: ["17h15 – 19h15"], prix: "790.–" },
          { titre: "Vendredi", heures: ["17h15 – 19h15"], prix: "770.–" },
        ],
        prix: { label: "Saison complète", montant: "dès CHF 770.–",
                detail: "selon le jour choisi · t-shirt Team Lausanne compris",
                cta: { label: "Rejoindre le Club", scroll: "enroll-sec" } } },
      { type: "faq", eyebrow: "Questions fréquentes",
        title: "Tout ce qu'il faut savoir avant de commencer", items: [
          ["Faut-il déjà savoir jouer ?", "Un peu d'expérience aide, mais chacun est orienté vers le bon groupe selon son niveau, son âge et son parcours."],
          ["Comment les groupes sont-ils formés ?", "Selon l'âge, le niveau, les horaires et les besoins de chacun, pour que tout le monde s'entraîne dans le bon environnement."],
          ["À quelle fréquence s'entraîne-t-on ?", "Une heure par semaine sur le créneau choisi, avec la possibilité d'ajouter un deuxième entraînement."],
          ["Et la compétition ?", "Quelques compétitions au fil de la saison, selon l'envie et sans obligation. Les membres du club peuvent aussi disputer les interclubs, selon les disponibilités."],
          ["Qu'est-ce qui est compris ?", "L'entraînement encadré en groupe, le suivi de la progression tout au long de la saison, et le t-shirt Team Lausanne."],
        ]},
      { type: "enroll", title: "Demander une inscription", filiere: "club", ranking: false,
        lead: "Envie de rejoindre l'offre Club ? Remplissez ce formulaire, le secrétariat vous recontacte." },
    ],
  },
  adultes: {
    world: "academie", title: "Cours adultes et privés", subtitle: "Saison 2026-2027 — cours privés, semi-privés et de groupe, tous niveaux",
    hero: "assets/photos/adultes-2026.jpg", heroPos: "center 45%",
    sections: [
      { type: "rich", title: "Cours adultes et privés, toute la saison", body: [
        "Team Lausanne Cours Adultes est l'association qui organise désormais l'ensemble des cours adultes et privés du TC Lausanne-Sports et de Team Lausanne.",
        "Cours privés, semi-privés et de groupe pour adultes, tous niveaux, du débutant au joueur classé, en français ou en anglais.",
      ]},
      { type: "features", title: "En pratique", items: [
        ["Lieu", "TC Lausanne-Sports, Route des Plaines-du-Loup 7, 1018 Lausanne."],
        ["Saison", "Du 26 octobre 2026 au 2 juillet 2027."],
        ["Rythme", "Cours d'une heure, un créneau hebdomadaire fixe réservé pour toute la saison (29 à 31 semaines selon le jour choisi)."],
        ["Fréquence", "1×, 2× ou 3× par semaine, avec possibilité de créneaux de 2 h consécutives."],
        ["Langue", "Cours donnés en français ou en anglais."],
      ]},
      { type: "features", title: "Nos formules", items: [
        ["Cours privé", "1 personne : progression sur mesure avec le coach."],
        ["Cours semi-privé", "2 personnes : un partenaire de jeu, l'attention du coach."],
        ["Cours de groupe — 3 personnes", "Petit groupe de niveau homogène."],
        ["Cours de groupe — 4 personnes", "Le format le plus convivial, échanges et points joués."],
        ["Formule flexible", "Rejoindre n'importe quel cours de groupe (3 ou 4 personnes) selon votre niveau et vos disponibilités."],
      ]},
      { type: "rich", title: "Cours d'essai en septembre", body: [
        "Durant le mois de septembre 2026, des cours d'essai à tarif réduit vous permettent de tester avant de vous engager sur la saison complète.",
      ], link: { label: "Demander un cours d'essai", scroll: "enroll-form" } },
      { type: "features", title: "Conditions", items: [
        ["Engagement", "Inscription pour l'ensemble de la saison, créneau réservé."],
        ["Absences", "Cours non remboursés, sauf blessure ou maladie de longue durée avec certificat médical : remboursement possible après 4 semaines d'absence continue."],
        ["Cours privé", "Replanifiable selon les disponibilités du club et des coachs."],
        ["Semi-privé et groupe", "Cours non rattrapables."],
        ["Paiement", "En 1 ou 3 fois."],
        ["Places", "Limitées, attribuées par ordre d'inscription, confirmées à réception du paiement ou du premier acompte."],
      ]},
      { type: "enroll", filiere: "adultes", adultes: true, title: "Ça m'intéresse — cours d'essai ou informations",
        lead: "Sans engagement : indiquez la formule qui vous intéresse et vos disponibilités, le responsable des cours adultes et privés, Renato Lombardi, vous recontactera pour vous proposer un créneau, un coach et les tarifs." },
    ],
  },
  gamezone: {
    world: "academie", title: "Game Zone", subtitle: "Des tournois juniors presque tous les week-ends",
    hero: "assets/photos/gamezone-2026.jpg",
    sections: [
      { type: "rich", title: "Le concept", body: [
        "Presque tous les week-ends, la Game Zone propose des tournois juniors sur une seule journée, avec deux matchs garantis par participant·e.",
        "Le format idéal pour se lancer en compétition et cumuler de l'expérience — et aller décrocher la grande coupe à la 10ᵉ victoire ! Une petite coupe est déjà remise dès 5 victoires, et une médaille à chaque victoire.",
      ], link: { label: "Consulter les prochains tournois ↗", href: GAMEZONE_URL } },
      { type: "gzphotos" },
      { type: "gzwinners", title: "Nos vainqueurs de la saison" },
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
  // Allure des boutons de l'accueil (pilule blanche, disque fluo, fleche).
  if (link.cta) {
    const cible = link.scroll ? `data-scroll="${esc(link.scroll)}"` : `data-contact="${esc(link.contact)}"`;
    return `<button class="btn-cta wsec-cta" ${cible}>${esc(link.label)}</button>`;
  }
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

// Balle de tennis des bandeaux de mots-cles : disque plein, et les deux coutures
// reprennent la couleur du fond pour se decouper dedans.
const BALLE = `<svg class="kw-balle" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <circle cx="12" cy="12" r="10" fill="currentColor"/>
  <path d="M4.7 5.1a9.4 9.4 0 0 1 3.1 6.9 9.4 9.4 0 0 1-3.1 6.9M19.3 5.1a9.4 9.4 0 0 0-3.1 6.9 9.4 9.4 0 0 0 3.1 6.9"
        fill="none" stroke="var(--kw-fond)" stroke-width="1.7" stroke-linecap="round"/>
</svg>`;

function sectionHTML(sec) {
  switch (sec.type) {
    case "split":
      return `<section class="split${(sec.video || sec.videoFile) ? " split-hasvideo" : ""}">
        ${(sec.video || sec.videoFile)
          ? (sec.videoFile
            ? `<div class="split-media split-video${sec.vertical ? " split-video-vertical" : ""}"><video class="split-native" controls playsinline preload="metadata" poster="${esc(sec.poster || "")}"><source src="${esc(sec.videoFile)}" type="video/mp4" />Votre navigateur ne peut pas lire cette vidéo.</video></div>`
            : `<div class="split-media split-video${sec.vertical ? " split-video-vertical" : ""}"><iframe src="https://www.youtube.com/embed/${esc(sec.video)}" title="${esc(sec.title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`)
          : sec.photos
            ? `<div class="split-media split-scroller">${sec.photos.map((p, i) =>
                `<div class="ss-photo${i ? "" : " on"}" style="background-image:url('${p}')"></div>`).join("")}
                <div class="ss-dots">${sec.photos.map((_, i) =>
                  `<button type="button" class="ss-dot${i ? "" : " on"}" data-ss="${i}" aria-label="Photo ${i + 1}"></button>`).join("")}</div>
              </div>`
            : `<div class="split-media" style="background-image:url('${sec.photo}')"></div>`}
        <div class="split-body">${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}<h2>${esc(sec.title)}</h2>
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

    case "seeds":
      return `<section class="wsec" data-anchor="${esc(sec.anchor || "")}"><h2>${esc(sec.title)}</h2>
        ${sec.sub ? `<p class="wsec-sub">${esc(sec.sub)}</p>` : ""}
        <div class="seed-grid">${SEEDS.map((s) => {
          const sommet = s.atp === s.best;
          return `<article class="seed-card">
            <div class="seed-img">
              <img src="assets/players/${esc(s.photo)}" alt="${esc(s.nom)}" loading="lazy" />
              <span class="seed-num">${s.n}</span>
            </div>
            <div class="seed-txt">
              <h3><span class="seed-flag">${DRAPEAUX[s.drapeau] || DRAPEAUX.neutre}</span>${esc(s.nom)}</h3>
              <p class="seed-rank">ATP ${s.atp} · ${sommet ? "au meilleur de sa carrière" : `meilleur : ${s.best}ᵉ`}</p>
              <p class="seed-bio">${esc(s.bio)}</p>
            </div>
          </article>`;
        }).join("")}</div></section>`;

    case "sponsors":
      return `<section class="wsec" data-anchor="${esc(sec.anchor || "")}"><h2>${esc(sec.title)}</h2>
        ${sec.sub ? `<p class="wsec-sub">${esc(sec.sub)}</p>` : ""}
        <div class="sponsor-wall">${sec.items.map((s) =>
          `<a class="sponsor" href="${esc(s.u)}" target="_blank" rel="noopener" title="${esc(s.n)}">
             <img src="assets/lo/sponsors/${esc(s.l)}.png" alt="${esc(s.n)}" loading="lazy" />
             <span>${esc(s.n)}</span></a>`).join("")}</div></section>`;

    // Une serie de cartes. Rendue deux fois : l'originale et une copie inerte,
    // pour que le defilement puisse boucler sans saut visible.
    case "carousel": {
      const carte = (items, mkPill) => items.map((o) =>
        `<article class="ccard"><div class="ccard-media${o.plan ? " ccard-media-plan" : ""}" style="background-image:url('${o.photo}')"></div>
          ${mkPill(o)}</article>`).join("");
      const pillInerte = (o) =>
        `<span class="ccard-pill ccard-pill-static">${esc(o.name)}<span class="ccard-arrow" aria-hidden="true">↗</span></span>`;
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
        <div class="carousel"><div class="carousel-track" style="--n:${sec.items.length}">
          ${carte(sec.items, pill)}
          <!-- Copie de la serie : c'est elle qui rend la boucle continue. Retiree
               de l'arbre d'accessibilite, et ses pastilles sont inertes pour ne
               pas creer de doublons au clavier. -->
          <div class="carousel-clone" aria-hidden="true">${carte(sec.items, pillInerte)}</div>
        </div></div></section>`;
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

    // Le parcours de formation, presente en etapes numerotees plutot qu'en
    // pyramide de barres. Les niveaux sont saisis du sommet vers la base
    // (Pro d'abord) ; on les inverse ici pour qu'ils se lisent 01 -> 05, du
    // premier echange a la performance.
    case "pyramid": {
      const etapes = sec.levels.slice().reverse();
      return `<section class="wsec"><h2>${esc(sec.title)}</h2>
        ${sec.sub ? `<p class="wsec-sub">${esc(sec.sub)}</p>` : ""}
        <div class="path-wrap">
          <ol class="path">${etapes.map((l, i) => {
            const num = String(i + 1).padStart(2, "0");
            const inner = `<span class="path-num">${num}</span>
              <span class="path-name">${esc(l.name)}</span>
              <span class="path-meta">${esc(l.meta)}</span>`;
            return l.href
              ? `<li><a class="path-step" href="${esc(l.href)}">${inner}<span class="path-go">↗</span></a></li>`
              : `<li><div class="path-step">${inner}</div></li>`;
          }).join("")}</ol>
          ${sec.club ? `<aside class="path-club">
            <h3>${esc(sec.club.title)}</h3>
            ${sec.club.body.map((p) => `<p>${esc(p)}</p>`).join("")}
            ${sec.club.href ? `<a class="path-club-link" href="${esc(sec.club.href)}">Découvrir le Club ↗</a>` : ""}
          </aside>` : ""}
        </div>
        ${sec.note ? `<p class="wsec-note">${esc(sec.note)}</p>` : ""}</section>`;
    }

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
      return `<section class="wsec enroll-sec"><h2>${esc(sec.title || "Demande d'inscription")}</h2>
        ${sec.lead ? `<p class="muted" style="max-width:640px;margin:-6px 0 22px">${esc(sec.lead)}</p>` : ""}
        <form id="enroll-form" class="cform" style="max-width:720px" data-filiere="${esc(sec.filiere)}">
          <div class="cf-row">
            <label class="cf-field"><span>Prénom</span><input type="text" id="en-first" required /></label>
            <label class="cf-field"><span>Nom</span><input type="text" id="en-last" required /></label>
          </div>
          ${sec.adultes ? "" : `<div class="cf-row">
            <label class="cf-field"><span>Date de naissance</span><input type="date" id="en-birth" required /></label>
            <label class="cf-field"><span>N° AVS</span><input type="text" id="en-avs" placeholder="756.XXXX.XXXX.XX" /></label>
          </div>`}
          <div class="cf-row">
            <label class="cf-field"><span>Téléphone</span><input type="tel" id="en-phone" autocomplete="tel" required /></label>
            <label class="cf-field"><span>Email</span><input type="email" id="en-email" autocomplete="email" required /></label>
          </div>
          ${sec.ranking ? `<label class="cf-field"><span>Classement</span><input type="text" id="en-ranking" placeholder="ex. R4, N3, sans classement…" /></label>` : ""}
          ${sec.adultes ? `<div class="cf-row">
            <label class="cf-field"><span>Formule souhaitée</span><select id="en-formule" required>
              <option value="">— choisir —</option>
              <option>Cours d'essai (septembre)</option>
              <option>Cours privé — 1 personne</option>
              <option>Cours semi-privé — 2 personnes</option>
              <option>Cours de groupe — 3 personnes</option>
              <option>Cours de groupe — 4 personnes</option>
              <option>Formule flexible</option>
            </select></label>
            <label class="cf-field"><span>Fréquence</span><select id="en-freq">
              <option>1× par semaine</option><option>2× par semaine</option><option>3× par semaine</option>
            </select></label>
          </div>
          <label class="cf-field"><span>Vos disponibilités</span><textarea id="en-dispo" rows="3" placeholder="ex. lundi et mercredi soir dès 18h, samedi matin…" required></textarea></label>
          <label class="cf-field"><span>Niveau / remarques</span><textarea id="en-comment" rows="2" placeholder="Niveau actuel, classement éventuel, langue souhaitée…"></textarea></label>` : `<label class="cf-field"><span>Commentaire</span><textarea id="en-comment" rows="3"></textarea></label>`}
          <button type="submit" id="en-btn">${sec.adultes ? "Envoyer ma demande" : "Envoyer ma demande d'inscription"}</button>
          <p id="en-error" class="error" hidden></p>
        </form>
        <div id="en-done" class="hidden" style="max-width:720px;background:var(--accent-soft);border-radius:16px;padding:24px;text-align:center">
          <p style="font-size:1.15rem;font-weight:800;color:var(--blue-ink);margin:0 0 6px">Merci, votre demande est envoyée !</p>
          <p class="muted" style="margin:0">${sec.adultes ? "Renato Lombardi, responsable des cours adultes et privés, vous recontactera rapidement pour en discuter. Rien n'est engagé à ce stade." : "Le secrétariat vous recontacte rapidement."}</p>
        </div></section>`;

    // ---- Bandeau de mots-cles ----
    // Meme principe que le carrousel : la serie est rendue deux fois et la piste
    // se translate d'exactement une serie, d'ou une boucle sans saut visible.
    case "keywords":
      return `<section class="wsec kw-band" aria-label="${esc(sec.label || "Nos points forts")}">
        <div class="kw-piste">${[0, 1].map((copie) =>
          `<ul class="kw-serie"${copie ? ' aria-hidden="true"' : ""}>${sec.items.map((m) =>
            `<li class="kw">${BALLE}${esc(m)}</li>`).join("")}</ul>`).join("")}
        </div></section>`;

    // ---- Atouts numerotes ----
    case "perks":
      return `<section class="wsec perks">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.lead ? `<p class="perks-lead">${esc(sec.lead)}</p>` : ""}
        </div>
        <div class="perk-grid">${sec.items.map(([h, t], k) =>
          `<article class="perk"><span class="perk-num" aria-hidden="true">${String(k + 1).padStart(2, "0")}</span>
            <h3>${esc(h)}</h3><p>${esc(t)}</p></article>`).join("")}</div>
        ${linkHTML(sec.link)}</section>`;

    // ---- Creneaux et tarif ----
    case "slots":
      return `<section class="wsec slots">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
          ${sec.lead ? `<p class="perks-lead">${esc(sec.lead)}</p>` : ""}
        </div>
        <div class="slot-grid">${sec.items.map((o) =>
          `<article class="slot"><span class="slot-titre">${esc(o.titre)}</span>
            <ul class="slot-heures">${o.heures.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
            ${o.note ? `<p class="slot-note">${esc(o.note)}</p>` : ""}
            ${o.prix ? `<span class="slot-tarif">${esc(o.prix)}</span>` : ""}</article>`).join("")}</div>
        ${sec.prix ? `<div class="slot-prix">
          <span class="slot-prix-quoi">${esc(sec.prix.label)}</span>
          <b class="slot-prix-montant">${esc(sec.prix.montant)}</b>
          ${sec.prix.detail ? `<span class="slot-prix-detail">${esc(sec.prix.detail)}</span>` : ""}
          ${sec.prix.cta ? `<button class="btn-cta slot-prix-cta" data-scroll="${esc(sec.prix.cta.scroll)}">${esc(sec.prix.cta.label)}</button>` : ""}
        </div>` : ""}
        ${sec.note ? `<p class="slots-note">${esc(sec.note)}</p>` : ""}
        ${linkHTML(sec.link)}</section>`;

    // ---- Questions frequentes ----
    // <details> natif : ouverture au clic comme au clavier, sans une ligne de JS.
    case "faq":
      return `<section class="wsec faq">
        <div class="perks-head">
          ${sec.eyebrow ? `<span class="eyebrow">${esc(sec.eyebrow)}</span>` : ""}
          <h2>${esc(sec.title)}</h2>
        </div>
        <div class="faq-list">${sec.items.map(([q, r]) =>
          `<details class="faq-item"><summary><span class="faq-q">${esc(q)}</span>
            <span class="faq-signe" aria-hidden="true"></span></summary>
            <div class="faq-rep"><p>${esc(r)}</p></div></details>`).join("")}</div>
        ${linkHTML(sec.link)}</section>`;

    default: return "";
  }
}

function paintHero({ logo, heroLogo, hero, heroPos, tag, slogan, desc, ctaHTML, sloganEntier }) {
  $("nav-logo").src = logo;
  $("hero-bg").style.backgroundImage = `url("${hero}")`;
  $("hero-bg").style.backgroundPosition = heroPos || "center";   // point d'intérêt (visages) par page
  $("hero-logo").src = heroLogo || logo;   // hero sur photo : version blanche si le monde en a une
  $("hero-tag").textContent = tag;
  // Un span par mot : c'est ce qui rend chaque mot survolable separement, pour
  // le slogan de l'accueil. Le titre d'une page de filiere, lui, est un seul
  // nom (« Kids Tennis ») : il prend un trait continu et non un par mot.
  // innerHTML est sur ici, le texte vient de la configuration et passe par esc().
  $("hero-slogan").innerHTML = sloganEntier
    ? `<span class="hs-w hs-w-entier">${esc(slogan)}</span>`
    : String(slogan).split(/\s+/).filter(Boolean)
        .map((mot) => `<span class="hs-w">${esc(mot)}</span>`).join(" ");
  $("hero-desc").textContent = desc;
  $("hero-cta").innerHTML = ctaHTML;
}

// ---- Petit defile de photos dans un split ----
// Un seul minuteur pour toute la page, relance a chaque rendu : les elements
// sont recrees par innerHTML, donc rien ne s'empile d'un rendu a l'autre.
let scrollerMinuteur = null;
function demarrerScrollers() {
  clearInterval(scrollerMinuteur);
  const boites = [...document.querySelectorAll(".split-scroller")];
  if (!boites.length) return;
  const montrer = (b, vers) => {
    const photos = [...b.querySelectorAll(".ss-photo")];
    const points = [...b.querySelectorAll(".ss-dot")];
    const i = photos.findIndex((p) => p.classList.contains("on"));
    const n = ((vers ?? i + 1) + photos.length) % photos.length;
    photos.forEach((p, k) => p.classList.toggle("on", k === n));
    points.forEach((p, k) => p.classList.toggle("on", k === n));
  };
  boites.forEach((b) => b.addEventListener("click", (e) => {
    const d = e.target.closest("[data-ss]");
    if (!d) return;
    montrer(b, +d.dataset.ss);
    // Le visiteur a choisi sa photo : on lui laisse le temps de la regarder.
    b.dataset.pause = "1";
    clearTimeout(b._reprise);
    b._reprise = setTimeout(() => delete b.dataset.pause, 9000);
  }));
  scrollerMinuteur = setInterval(() => boites.forEach((b) => {
    if (!b.dataset.pause && !b.matches(":hover")) montrer(b);
  }), 4200);
}

// ---- Carrousel des programmes ----
// L'avancee est pilotee ici, a une vitesse en pixels par seconde, et non par une
// animation CSS : la duree venait d'un calc() sur une variable personnalisee,
// que les moteurs ne resolvent pas tous pareil — le defilement n'avait donc pas
// la meme allure d'un navigateur a l'autre. On defile la vue plutot que de
// translater la piste, ce qui laisse au visiteur une vraie barre a tirer.
// Secondes par carte : c'est la formule d'origine (duree = nombre de cartes x
// 3.4 s pour parcourir une serie), reprise telle quelle pour garder exactement
// l'allure qu'avait Chrome, a toutes les largeurs d'ecran.
const CAR_SEC_PAR_CARTE = 3.4;
let carBoucle = null;
function lancerCarrousel() {
  cancelAnimationFrame(carBoucle);
  const doux = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vues = [...document.querySelectorAll(".carousel")];
  if (!vues.length || doux) return;

  const etats = vues.map((vue) => {
    const cartes = [...vue.querySelectorAll(".ccard")];
    const etat = { vue, cartes, moitie: cartes.length / 2, survol: false, jusqua: 0, reste: 0 };
    // Le visiteur reprend la main : on se tait un moment.
    const main = () => { etat.jusqua = performance.now() + 2500; };
    vue.addEventListener("pointerenter", () => (etat.survol = true));
    vue.addEventListener("pointerleave", () => (etat.survol = false));
    vue.addEventListener("focusin", () => (etat.survol = true));
    vue.addEventListener("focusout", () => (etat.survol = false));
    vue.addEventListener("wheel", main, { passive: true });
    vue.addEventListener("touchstart", main, { passive: true });
    vue.addEventListener("pointerdown", main);
    return etat;
  });

  let precedent = 0;
  const pas = (t) => {
    // Plafonne : apres un onglet en arriere-plan, dt vaudrait plusieurs secondes
    // et le carrousel ferait un bond.
    const dt = precedent ? Math.min((t - precedent) / 1000, 0.05) : 0;
    precedent = t;
    for (const e of etats) {
      if (e.moitie < 1 || e.survol || t < e.jusqua) continue;
      // Largeur d'une serie, mesuree : la carte n et la carte 0 portent la meme
      // image, donc revenir de cette distance ne se voit pas.
      const serie = e.cartes[e.moitie].offsetLeft - e.cartes[0].offsetLeft;
      if (serie <= 0) continue;
      // On accumule les fractions : un pas peut faire moins d'un pixel par
      // image, et scrollLeft pourrait les perdre.
      e.reste += (serie / (e.moitie * CAR_SEC_PAR_CARTE)) * dt;
      const entier = Math.floor(e.reste);
      if (entier) {
        e.reste -= entier;
        e.vue.scrollLeft += entier;
        if (e.vue.scrollLeft >= serie) e.vue.scrollLeft -= serie;
      }
    }
    carBoucle = requestAnimationFrame(pas);
  };
  carBoucle = requestAnimationFrame(pas);
}

function renderWorld(key) {
  const w = WORLDS[key];
  document.body.dataset.world = key;
  document.querySelectorAll(".sw").forEach((b) => b.classList.toggle("active", b.dataset.world === key));
  const ctaHTML = w.cta.map((c) =>
    c.type === "contact" ? `<button class="btn-cta" data-contact="${esc(c.source)}">${esc(c.label)}</button>`
    : c.type === "scroll" ? `<button class="btn-cta" data-scroll="${esc(c.target)}">${esc(c.label)}</button>`
    : `<button class="btn-cta" data-cta="${c.type}">${esc(c.label)}</button>`).join("");
  paintHero({ logo: w.logo, heroLogo: w.heroLogo, hero: w.hero, heroPos: w.heroPos, tag: w.tag, slogan: w.slogan, desc: w.desc, ctaHTML });
  $("world-main").innerHTML = w.sections.map(sectionWrap).join("");
  animate();
  demarrerScrollers();
  lancerCarrousel();
}

function renderDetail(id) {
  const d = DETAILS[id];
  const w = WORLDS[d.world];
  document.body.dataset.world = d.world;
  document.querySelectorAll(".sw").forEach((b) => b.classList.toggle("active", b.dataset.world === d.world));
  // Une page de filiere peut porter son propre appel a l'action ; il passe
  // devant le retour, qui devient secondaire.
  const ctaPage = !d.cta ? ""
    : d.cta.scroll ? `<button class="btn-cta" data-scroll="${esc(d.cta.scroll)}">${esc(d.cta.label)}</button>`
    : `<button class="btn-cta" data-contact="${esc(d.cta.contact)}">${esc(d.cta.label)}</button>`;
  const ctaHTML = ctaPage + `<button class="btn-cta ghost" data-back="${d.world}">← Retour ${esc(w.retour)}</button>`;
  paintHero({ logo: w.logo, heroLogo: w.heroLogo, hero: d.hero, heroPos: d.heroPos, tag: w.tag, slogan: d.title, desc: d.subtitle, ctaHTML, sloganEntier: true });
  $("world-main").innerHTML = d.sections.map(sectionWrap).join("");
  animate();
  demarrerScrollers();
  lancerCarrousel();
  if ($("stgp-list")) stgLoad();
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

// ===================================================================
//  Routage : deux mondes (Academy, Lausanne Open) + pages de détail.
//  Sur le domaine lausanneopen.ch, le site n'affiche QUE le tournoi (ni barre, ni pied de page),
//  jusqu'à ce que ce domaine soit redirigé vers teamlausanne.ch/#tournoi.
//  Aucune connexion ni réservation sur le site public : l'app vit sur app.teamlausanne.ch.
// ===================================================================
const LO_ONLY = /lausanneopen/i.test(location.hostname);
const DEFAULT_WORLD = LO_ONLY ? "tournoi" : "academie";
if (LO_ONLY) document.body.classList.add("lo-only");
const TITLES = {
  academie: ["Team Lausanne Academy — Tennis à Lausanne, du Kids Tennis au Pro", "Team Lausanne Academy : le centre de formation tennis des Plaines-du-Loup à Lausanne. Kids Tennis, Club, Compétition, Performance, Sport-études, Pro U18, Pro, stages et tournois GameZone."],
  tournoi: ["Lausanne Open — ITF M25, prochaine édition août 2027", "Lausanne Open : l’unique tournoi international de tennis masculin du canton de Vaud. ITF M25, 30 000 $ de dotation, entrée libre. Prochaine édition en août 2027 aux Plaines-du-Loup."],
};
function setTitle(world, sub) {
  const t = TITLES[world] || TITLES.academie;
  document.title = sub ? `${sub} — ${world === "tournoi" ? "Lausanne Open" : "Team Lausanne Academy"}` : t[0];
  const m = document.querySelector('meta[name="description"]'); if (m) m.setAttribute("content", t[1]);
  // Texte du formulaire « Nous écrire » selon le monde affiché
  const cs = document.querySelector("#contact-lo .wsec-sub");
  if (cs) cs.textContent = world === "tournoi"
    ? "Une question sur le Lausanne Open, une demande de presse, un partenariat — écrivez-nous, nous répondons rapidement."
    : "Une question sur l'Academy — écrivez-nous, nous répondons rapidement.";
}
function route() {
  const h = location.hash.replace("#", "");
  hit("site", h || "accueil");
  if (DETAILS[h] && WORLDS[DETAILS[h].world] && (!LO_ONLY || DETAILS[h].world === "tournoi")) { renderDetail(h); setTitle(DETAILS[h].world, DETAILS[h].title); }
  else if (WORLDS[h] && !LO_ONLY) { renderWorld(h); setTitle(h); }
  else { renderWorld(DEFAULT_WORLD); setTitle(DEFAULT_WORLD); }
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

// ---- Contact : le formulaire « Nous écrire » en bas de page ----
function openContact(source) {
  const t = $("contact-lo"); if (!t) return;
  const sel = t.querySelector('input[name="nom"]');
  const msg = t.querySelector('textarea[name="message"]');
  if (msg && source && !msg.value) msg.value = source + " : ";
  t.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => sel?.focus(), 600);
}

// ---- Inscription à un stage (page détail #stages) ----
let stgCats = {}, stgSessions = [], stgCurrent = null, stgLinks = {};
const stgDays = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
const stgEff = (p, d) => Math.round(Number(p) * Math.min(d, 5) / 5 * 100) / 100;

async function stgLoad() {
  const [{ data: cs }, { data: ss }, { data: links }] = await Promise.all([
    sb.from("stage_categories").select("*"),
    sb.from("stage_sessions").select("*").order("start_date"),
    sb.from("stage_session_categories").select("session_id,category_id"),
  ]);
  stgCats = {};
  for (const c of cs || []) stgCats[c.id] = c;
  stgLinks = {};
  for (const l of links || []) (stgLinks[l.session_id] = stgLinks[l.session_id] || []).push(l.category_id);
  // On n'affiche que les stages ayant au moins une catégorie ouverte
  stgSessions = (ss || []).filter((s) => (stgLinks[s.id] || []).length);
  stgRenderList();
}
// Catégories ouvertes d'un stage (objets), triées par prix
function stgOpenCats(s) {
  return (stgLinks[s.id] || []).map((id) => stgCats[id]).filter(Boolean).sort((a, b) => (a.price || 0) - (b.price || 0));
}
function stgRenderList() {
  const L = $("stgp-list"); if (!L) return;
  if (!stgSessions.length) { L.innerHTML = '<p class="muted">Aucun stage ouvert aux inscriptions pour le moment. Reviens bientôt !</p>'; return; }
  L.innerHTML = stgSessions.map((s) => {
    const d = stgDays(s.start_date, s.end_date);
    const oc = stgOpenCats(s);
    const prices = oc.map((c) => stgEff(c.price || 0, d));
    const priceLbl = prices.length ? (Math.min(...prices) === Math.max(...prices) ? `${prices[0]} CHF` : `dès ${Math.min(...prices)} CHF`) : "—";
    const img = s.image_url || oc.find((c) => c.image_url)?.image_url;
    const dates = s.start_date === s.end_date ? frDate(s.start_date) : `${frDate(s.start_date)} → ${frDate(s.end_date)}`;
    const badges = oc.map((c) => `<span class="stg-tag">${esc(c.name)}</span>`).join("");
    return `<article class="stg-pub-card">
      ${img ? `<img src="${img}" alt="" class="stg-pub-img" loading="lazy"/>` : '<div class="stg-pub-img stg-pub-noimg"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M4.7 6.5c3.2 2 3.2 9 0 11M19.3 6.5c-3.2 2-3.2 9 0 11"/></svg></div>'}
      <div class="stg-pub-body"><h3>${esc(s.title || "Stage")}</h3>
        <div class="stg-pub-dates">${dates} · ${jours(d)}</div>
        <div class="stg-pub-badges">${badges}</div>
        <div class="stg-pub-foot"><span class="stg-pub-price">${priceLbl}</span>
          <button class="stg-pub-cta" data-stg="${s.id}">S'inscrire</button></div></div></article>`;
  }).join("");
  L.querySelectorAll(".stg-pub-cta").forEach((b) => b.addEventListener("click", () => stgOpenForm(b.dataset.stg)));
}
// Applique la catégorie choisie : prix + champs conditionnels
function stgApplyCat() {
  const c = stgCats[$("f-category").value] || {};
  const d = stgDays(stgCurrent.start_date, stgCurrent.end_date), base = stgEff(c.price || 0, d);
  const addon = Number(c.private_addon_price) || 0;
  // Option heures privées (ex. « Entraîne-toi comme un pro »)
  $("f-addon-wrap").classList.toggle("hidden", !addon);
  if (addon) $("f-addon-label").textContent = `Ajouter 3h de tennis privé (+${addon} CHF)`;
  else $("f-addon").checked = false;
  const price = base + (addon && $("f-addon").checked ? addon : 0);
  const dates = `${frDate(stgCurrent.start_date)}${stgCurrent.end_date !== stgCurrent.start_date ? " → " + frDate(stgCurrent.end_date) : ""}`;
  $("stgp-modal-meta").innerHTML = `${dates} · ${jours(d)} · <b>${price} CHF</b>`;
  $("f-cat-info").textContent = [c.meal ? "repas inclus" : "", c.tshirt ? "t-shirt offert" : ""].filter(Boolean).join(" · ");
  $("f-tshirt-wrap").classList.toggle("hidden", !c.tshirt);
  $("f-meal-wrap").classList.toggle("hidden", !c.meal);
  $("f-ranking-wrap").classList.toggle("hidden", !c.ask_ranking);
}
function stgOpenForm(id) {
  stgCurrent = stgSessions.find((s) => s.id === id);
  const oc = stgOpenCats(stgCurrent);
  $("stgp-modal-title").textContent = stgCurrent.title || "Stage";
  $("f-category").innerHTML = oc.map((c) => `<option value="${c.id}">${esc(c.name)} — ${stgEff(c.price || 0, stgDays(stgCurrent.start_date, stgCurrent.end_date))} CHF</option>`).join("");
  $("stgp-form").reset(); $("f-meal-text").disabled = true;
  stgApplyCat();
  $("stgp-form").classList.remove("hidden"); $("stgp-done").classList.add("hidden"); $("stgp-error").hidden = true;
  $("stgp-modal").classList.remove("hidden");
}
function stgCloseForm() { $("stgp-modal").classList.add("hidden"); stgCurrent = null; }
$("stgp-close").addEventListener("click", stgCloseForm);
$("stgp-modal").addEventListener("click", (e) => { if (e.target === $("stgp-modal")) stgCloseForm(); });
$("f-category").addEventListener("change", stgApplyCat);
$("f-addon").addEventListener("change", stgApplyCat);
document.addEventListener("change", (e) => { if (e.target.name === "meal") $("f-meal-text").disabled = e.target.value !== "autre"; });
$("stgp-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("stgp-error"); err.hidden = true;
  const c = stgCats[$("f-category").value] || {};
  if (!c.id) { err.textContent = "Choisis une catégorie."; err.hidden = false; return; }
  let meal = null;
  if (c.meal) { const sel = document.querySelector('input[name="meal"]:checked')?.value; meal = sel === "autre" ? ($("f-meal-text").value.trim() || "À préciser") : "Aucune"; }
  const addon = Number(c.private_addon_price) || 0;
  const row = { stage_id: stgCurrent.id, category_id: c.id,
    first_name: $("f-first").value.trim(), last_name: $("f-last").value.trim(),
    email: $("f-email").value.trim(), birth_date: $("f-birth").value || null,
    tshirt_size: c.tshirt ? ($("f-tshirt").value || null) : null, meal_restriction: meal,
    ranking: c.ask_ranking ? ($("f-ranking").value.trim() || null) : null,
    private_addon: addon > 0 && $("f-addon").checked,
    comment: $("f-comment").value.trim() || null };
  const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Envoi…";
  const { error } = await sb.from("stage_registrations").insert(row);
  if (error) { err.textContent = "Erreur : " + error.message; err.hidden = false; btn.disabled = false; btn.textContent = "Envoyer mon inscription"; return; }
  $("stgp-form").classList.add("hidden"); $("stgp-done").classList.remove("hidden");
});

// ---- GameZone : photos (carrousel animé) + tableau des vainqueurs ----
const GZ_CUP = (color, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M8 4h8v4.5a4 4 0 0 1-8 0V4z"/><path d="M8 5.5H5V7a3 3 0 0 0 3 3M16 5.5h3V7a3 3 0 0 1-3 3"/><path d="M10 13.5V16h4v-2.5M8 20h8M12 16v4"/></svg>`;
const gzCups = (w) => (w >= 10 ? GZ_CUP("#c8901f", 18) : w >= 5 ? GZ_CUP("#9aa3ad", 16) : "");

// Uniquement la saison EN COURS (la RPC la renvoie toujours, même sans tournoi encore importé).
async function loadGamezone() {
  const { data: seasons } = await sb.rpc("gz_public_seasons");
  const cur = (seasons || []).find((s) => s.is_current) || (seasons || [])[0];
  const seasonId = cur ? cur.id : null;
  loadGzPhotos(seasonId);
  loadGzWinners(seasonId);
}

async function loadGzPhotos(seasonId) {
  const wrap = $("gz-photos-carousel"); if (!wrap) return;
  const { data } = await sb.rpc("gz_public_winner_photos", { p_season: seasonId });
  const rows = data || [];
  if (!rows.length) { wrap.innerHTML = `<p class="muted">Les photos des vainqueurs apparaîtront ici.</p>`; return; }
  const imgs = rows.map((p) => `<div class="gzc-card"><img src="${esc(p.photo_url)}" loading="lazy" alt="Vainqueur GameZone"/></div>`).join("");
  // Peu de photos → statique (pas de duplication ni d'animation) ; sinon défilement animé.
  if (rows.length < 5) wrap.innerHTML = `<div class="gzc-track gzc-static">${imgs}</div>`;
  else wrap.innerHTML = `<div class="gzc-track">${imgs}${imgs}</div>`;
}

async function loadGzWinners(seasonId) {
  const box = $("gz-winners"); if (!box) return;
  const { data, error } = await sb.rpc("gz_public_ranking", { p_season: seasonId });
  const rows = error ? [] : (data || []);
  if (!rows.length) { box.innerHTML = `<p class="muted">Pas encore de vainqueur cette saison.</p>`; return; }
  const PREVIEW = 10;
  const tr = (r, hidden) => `<tr${hidden ? ' class="gzw-hidden hidden"' : ""}><td>${esc(r.first_name)} ${esc(r.last_name)}</td><td>${gzCups(Number(r.wins))} ${r.wins}</td></tr>`;
  const body = rows.map((r, i) => tr(r, i >= PREVIEW)).join("");
  const hasMore = rows.length > PREVIEW;
  box.innerHTML = `<table class="ranking"><thead><tr><th>Joueur·euse</th><th>Victoires</th></tr></thead><tbody>${body}</tbody></table>
    ${hasMore ? `<button type="button" id="gzw-more-btn" class="gz-showall">+ Afficher tous les vainqueurs (${rows.length})</button>` : ""}`;
  const btn = $("gzw-more-btn");
  if (btn) btn.addEventListener("click", () => { box.querySelectorAll(".gzw-hidden").forEach((el) => el.classList.remove("hidden")); btn.remove(); });
}

// ===================================================================
//  Interactions globales (délégation)
// ===================================================================
document.addEventListener("click", (e) => {
  // Onglets du haut / étapes du pied de page : changement de monde (Academy ↔ Lausanne Open).
  const sw = e.target.closest(".sw[data-world], .flow-step[data-world]");
  if (sw) {
    if (LO_ONLY) return;
    // Mobile / écran tactile : le 1er tap sur un onglet ouvre sa liste d'accès directs, le 2e tap navigue.
    const wrap = sw.closest(".sw-wrap"), menu = wrap?.querySelector(".sw-menu");
    const touch = window.matchMedia("(hover: none)").matches || window.innerWidth <= 760;
    if (menu && touch && !wrap.classList.contains("open")) {
      document.querySelectorAll(".sw-wrap.open").forEach((w) => w.classList.remove("open"));
      wrap.classList.add("open");
      return;
    }
    document.querySelectorAll(".sw-wrap.open").forEach((w) => w.classList.remove("open"));
    location.hash = sw.dataset.world; return;
  }
  // Tap ailleurs : referme les listes ouvertes (les liens de la liste naviguent normalement).
  if (!e.target.closest(".sw-wrap")) document.querySelectorAll(".sw-wrap.open").forEach((w) => w.classList.remove("open"));
  else if (e.target.closest(".sw-menu a")) setTimeout(() => document.querySelectorAll(".sw-wrap.open").forEach((w) => w.classList.remove("open")), 50);
  const contact = e.target.closest("[data-contact]");
  if (contact) { openContact(contact.dataset.contact); return; }
  const cta = e.target.closest("[data-cta]");
  if (cta) {
    const t = cta.dataset.cta;
    if (t === "stages") location.hash = "stages";
    else if (t === "gamezone") location.hash = "gamezone";
    return;
  }
  const plan = e.target.closest("[data-plan]");
  if (plan) { $("plan-img").src = plan.dataset.plan; $("plan-modal").classList.remove("hidden"); return; }
  const scroll = e.target.closest("[data-scroll]");
  if (scroll) {
    // la cible peut etre designee par sa classe ou par son identifiant
    const t = scroll.dataset.scroll;
    (document.querySelector("." + t) || document.getElementById(t))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const goto = LO_ONLY ? null : e.target.closest("[data-goto]");   // menu déroulant : aller à une section d'un monde
  if (goto) {
    const w = goto.dataset.goto, a = goto.dataset.anchor;
    history.replaceState(null, "", "#" + w);
    renderWorld(w);
    requestAnimationFrame(() => document.querySelector(`[data-anchor="${a}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return;
  }
  const back = e.target.closest("[data-back]");
  if (back) { location.hash = back.dataset.back; return; }
  // navigation entre mondes desactivee : ce site ne montre que le tournoi
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

// Demande d'inscription (pages de filière : Compétition, Performance, Club, Kids Tennis)
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "enroll-form") return;
  e.preventDefault();
  const err = $("en-error"); err.hidden = true;
  const btn = $("en-btn"); btn.disabled = true; btn.textContent = "Envoi…";
  const v = (id) => ($(id) ? $(id).value.trim() : "");
  // Formulaire adultes : formule + fréquence + disponibilités rangées dans le commentaire (même table, tag « adultes »).
  const adult = [v("en-formule") ? "Formule : " + v("en-formule") : "", v("en-freq") ? "Fréquence : " + v("en-freq") : "", v("en-dispo") ? "Disponibilités : " + v("en-dispo") : ""].filter(Boolean);
  const comment = [...adult, v("en-comment")].filter(Boolean).join("\n") || null;
  const row = {
    filiere: e.target.dataset.filiere,
    first_name: v("en-first"), last_name: v("en-last"),
    birthdate: $("en-birth") ? ($("en-birth").value || null) : null,
    avs: v("en-avs") || null, phone: v("en-phone") || null, email: v("en-email") || null,
    ranking: $("en-ranking") ? (v("en-ranking") || null) : null,
    comment,
  };
  const { error } = await sb.from("enrollment_requests").insert(row);
  btn.disabled = false; btn.textContent = e.target.dataset.filiere === "adultes" ? "Envoyer ma demande" : "Envoyer ma demande d'inscription";
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
  requestAnimationFrame(() => document.querySelector(`[data-anchor="${at}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  history.replaceState(null, "", location.pathname + location.hash);
})();

// ---- Bandeau social : navigation par fleches ----
// La photo courante vient se caler exactement dans la fenetre du cadre
// Instagram, pour que les deux ne fassent qu'un. Le HTML porte trois series
// (copie, serie reelle, copie) : quand l'index sort de la serie centrale, on se
// replie d'une serie sans transition, ce qui rend la boucle continue sans saut
// visible et garantit des photos des deux cotes du cadre.
(() => {
  const piste = document.querySelector(".insta-track");
  const scene = document.querySelector(".insta-stage");
  if (!piste || !scene) return;
  const vues = [...piste.querySelectorAll("li:not(.insta-clone) img")];
  const n = vues.length;
  if (!n) return;

  // La piste contient trois series : copie, serie reelle, copie. On demarre
  // sur la serie reelle (position n) pour que le cadre soit entoure de photos
  // des les deux cotes — sinon la gauche reste vide au chargement.
  let i = n;

  // Pas = largeur d'une vignette + espacement, lus au moment du calcul :
  // les deux dependent du viewport (clamp et gap en CSS).
  const pas = () => {
    const l = vues[0].getBoundingClientRect().width;
    const g = parseFloat(getComputedStyle(piste).gap) || 0;
    return l + g;
  };
  const placer = (anime) => {
    const l = vues[0].getBoundingClientRect().width;
    const x = scene.clientWidth / 2 - (i * pas() + l / 2);
    piste.style.transition = anime ? "transform .45s cubic-bezier(.4,0,.2,1)" : "none";
    if (anime) void piste.offsetWidth;   // force le recalcul, sinon la transition ne demarre pas
    piste.style.transform = `translateX(${x}px)`;
  };

  const aller = (d) => {
    // Repli AVANT de bouger, et non a la fin de l'animation precedente : rien ne
    // depend donc d'une minuterie ni d'un evenement de fin, qui se ratent ou se
    // font attendre (onglet en arriere-plan) et figeaient les fleches.
    // La vignette k et la vignette k+n portent la meme photo : se recaler d'une
    // serie, sans transition, ne se voit pas.
    if (i >= 2 * n) { i -= n; placer(false); }
    else if (i < n) { i += n; placer(false); }
    i += d;
    placer(true);
  };

  document.querySelector(".insta-prev")?.addEventListener("click", () => aller(-1));
  document.querySelector(".insta-next")?.addEventListener("click", () => aller(1));

  // Les images se chargent en differe : on replace des que les dimensions sont
  // connues, sinon le premier calage tombe a cote.
  const recaler = () => placer(false);
  vues.forEach((v) => v.complete || v.addEventListener("load", recaler, { once: true }));
  addEventListener("resize", recaler);
  requestAnimationFrame(recaler);
})();

// ---- Formulaire « Nous ecrire » ----
// Il ne partait qu'a Netlify, dont les envois n'atterrissent que dans le tableau
// de bord de l'hebergeur — personne dans l'equipe ne les y lisait. Il ecrit
// desormais dans contact_messages, d'ou un declencheur les recopie dans la boite
// de la console (voir db/59_contact_vers_messagerie.sql).
// L'envoi a Netlify est conserve, mais au mieux : c'est l'ecriture en base qui
// decide si le visiteur voit un succes.
document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.id !== "lo-form") return;
  e.preventDefault();
  const btn = $("lo-send"), msg = $("lo-msg");
  const lu = (n) => (f.querySelector(`[name="${n}"]`)?.value || "").trim();
  const nom = lu("nom"), email = lu("email"), texte = lu("message");
  if (!nom || !email || !texte) return;
  btn.disabled = true; msg.className = "lo-msg"; msg.textContent = "Envoi…";

  const { error } = await sb.from("contact_messages").insert({
    source: "Nous écrire",
    name: nom.slice(0, 200),
    email: email.slice(0, 200),
    message: texte.slice(0, 4000),          // la base refuse au-dela
  });

  if (error) {
    msg.className = "lo-msg ko";
    msg.textContent = "L’envoi a échoué. Écrivez-nous directement à info@teamlausanne.ch.";
    btn.disabled = false;
    return;
  }
  // Trace chez Netlify, sans consequence si elle echoue.
  fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(new FormData(f)).toString(),
  }).catch(() => {});

  f.reset();
  msg.className = "lo-msg ok";
  msg.textContent = "Merci, votre message est parti. Nous vous répondrons tout bientôt.";
  btn.disabled = false;
});
