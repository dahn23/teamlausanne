// =====================================================================
//  LAUSANNE OPEN — console SPECTATEURS (welcome.lausanneopen.ch)
//  Tout le contenu est ici, en français. Volontairement sans backend :
//  cette console ne se modifie qu'en éditant ce fichier. Seul l'order of
//  play du jour est lu en direct dans la base (le même que celui que
//  l'organisation dépose depuis le backend des joueurs).
// =====================================================================

const ITF = "https://www.itftennis.com/en/tournament/m25-lausanne/sui/2026/m-itf-sui-2026-004";
export const LIENS = {
  oop:       `${ITF}/order-of-play/`,
  tableau:   `${ITF}/draws-and-results/`,
  live:      `${ITF}/live-scores/`,
  itf:       `${ITF}/overview/`,
  instagram: "https://www.instagram.com/lausanne_sports_tennis",
  site:      "https://www.lausanneopen.ch",
  maps:      "https://www.google.com/maps/search/?api=1&query=Route+des+Plaines-du-Loup+7+1018+Lausanne",
  tel:       "+41216461350",
  telAffiche:"+41 21 646 13 50",
};

/* ------------------------------------------------------------ TOURNOI */
export const TOURNOI = {
  titre: "Bienvenue au Lausanne Open",
  chapo: "L'unique tournoi international de tennis masculin du canton de Vaud. Huit jours de circuit professionnel aux Plaines-du-Loup — et l'entrée est libre.",
  badges: ["ITF M25", "23–30 août 2026", "30 000 $", "Entrée libre"],
  infos: [
    ["Dates", "Du dimanche 23 au dimanche 30 août 2026"],
    ["Lieu", "Lausanne-Sports Tennis<br>Route des Plaines-du-Loup 7, 1018 Lausanne"],
    ["Entrée", "Libre et gratuite, toute la semaine, sans billet"],
    ["Catégorie", "ITF M25 · 30 000 $ de dotation"],
    ["Édition", "2ᵉ édition — le tournoi a été créé en 2025"],
    ["Sur place", "Club-house, restaurant et terrasse ouverts à tous"],
    ["Renseignements", `<a href="tel:${LIENS.tel}">${LIENS.telAffiche}</a>`],
  ],
  aSavoir: [
    "Les matchs s'enchaînent du matin au soir : il y a toujours quelque chose à voir en arrivant à l'improviste.",
    "Le court central est le meilleur endroit pour suivre les têtes de série ; les courts annexes offrent une proximité qu'aucun grand tournoi ne permet.",
    "Le silence pendant les points et les applaudissements entre les jeux : la règle vaut ici comme ailleurs.",
    "Samedi, la Journée Team Lausanne se déroule en marge du tableau, ouverte à toutes et tous.",
  ],
};

/* -------------------------------------------------- TÊTES DE SÉRIE */
// Classements ATP au moment du tirage. « photo » renvoie à
// assets/players/<nom>.jpg ; sans photo, une pastille aux initiales est
// dessinée à la place. On n'écrit ici que des faits vérifiés.
export const SEEDS = [
  { n: 1, nom: "Andrey Chepelev", pays: "Neutre", drapeau: "neutre", atp: 353, photo: "chepelev",
    bio: "Né le 2 août 1998. Il arrive avec le meilleur classement du tableau. Meilleur classement en carrière : 339ᵉ mondial." },
  { n: 2, nom: "Gabriele Piraino", pays: "Italie", drapeau: "it", atp: 404, photo: "piraino",
    bio: "22 ans, formé sur le circuit junior italien. Meilleur classement en carrière : 321ᵉ mondial." },
  { n: 3, nom: "Johan Nikles", pays: "Suisse", drapeau: "ch", atp: 412, photo: "nikles",
    bio: "Genevois né le 23 mars 1997, l'un des visages familiers du tennis romand. Meilleur classement : 256ᵉ mondial en juillet 2022." },
  { n: 4, nom: "Henry Bernet", pays: "Suisse", drapeau: "ch", atp: 430, photo: "bernet",
    bio: "Tenant du titre : il a remporté le Lausanne Open 2025. Né le 25 janvier 2007, il a gagné l'Open d'Australie junior le jour de ses 18 ans — sixième Suisse à décrocher un Grand Chelem junior, après Federer, Wawrinka, Günthardt, Valent et Stricker." },
  { n: 5, nom: "Lorenzo Carboni", pays: "Italie", drapeau: "it", atp: 481, photo: "carboni",
    bio: "Jeune joueur italien en progression sur le circuit ITF. Meilleur classement en carrière : 415ᵉ mondial." },
  { n: 6, nom: "Luca Staeheli", pays: "Suisse", drapeau: "ch", atp: 521, photo: "staeheli",
    bio: "Il arrive lancé : il vient de remporter l’ITF M25 de Muttenz, le 16 août. À 521ᵉ mondial, il est au meilleur classement de sa carrière." },
  { n: 7, nom: "Dimitris Sakellaridis", pays: "Grèce", drapeau: "gr", atp: 556, photo: "sakellaridis",
    bio: "Né le 30 avril 2006, numéro 1 mondial junior en octobre 2024. Il connaît déjà les lieux : finaliste du double au Lausanne Open 2025. À 556ᵉ mondial, il est au meilleur classement de sa carrière." },
  { n: 8, nom: "Alexander Weis", pays: "Italie", drapeau: "it", atp: 594,
    bio: "Né le 24 avril 1997 à Bolzano, la même région que Jannik Sinner et Andreas Seppi. Professionnel depuis 2015, meilleur classement : 285ᵉ mondial." },
];

/* ------------------------------------------------------------ PALMARÈS */
export const PALMARES_NOTE =
  "Le Lausanne Open a été créé en 2025 : cette semaine en est la deuxième édition. " +
  "Un seul nom au palmarès pour l'instant, et il revient défendre son titre.";

export const PALMARES = [
  { annee: "2025", simple: "🇨🇭 Henry Bernet", double: "🇮🇪 Charles Barry · 🇫🇷 Max Westphal" },
];

/* ---------------------------------------------------------------- CLUB */
export const CLUB = {
  titre: "Lausanne-Sports Tennis",
  chapo: "Le club de tennis historique de la ville, fondé en 1911 et installé aux Plaines-du-Loup depuis 1954. C'est lui qui organise le Lausanne Open — et il est ouvert à de nouveaux membres.",
  avantages: [
    { icon: "calendar", titre: "Réserver en ligne, toute l'année",
      texte: "Douze courts : dix extérieurs et deux couverts. La réservation se fait en ligne, depuis le téléphone, jusqu'à la dernière minute." },
    { icon: "utensils", titre: "Le club-house et son restaurant",
      texte: "Un vrai lieu de vie au cœur des Plaines-du-Loup : terrasse sur les courts, restaurant ouvert midi et soir, et l'apéro d'après-match qui va avec." },
    { icon: "trophy", titre: "La compétition, à tous les niveaux",
      texte: "Interclubs adultes et juniors, tournoi interne à la rentrée, et l'ambiance d'un club qui suit ses équipes." },
    { icon: "users", titre: "Un club, pas seulement des courts",
      texte: "Soirées et tournois maison : l’adhésion ouvre la porte à une vie de club, pas juste à un créneau de réservation." },
    { icon: "medal", titre: "Le tennis professionnel chez soi",
      texte: "Une semaine par an, le circuit international s'installe sur vos courts d'entraînement. Peu de clubs peuvent en dire autant." },
  ],
  contact: "Envie de nous rejoindre ? Passez au club-house pendant le tournoi, on vous fera visiter — ou appelez-nous.",
};

/* ------------------------------------------------------------ ACADÉMIE */
export const ACADEMY = {
  titre: "Team Lausanne Academy",
  chapo: "L'académie de formation installée sur le même site que le club. Elle accompagne les jeunes des premiers échanges jusqu'au circuit professionnel — et propose des stages ouverts à tous pendant les vacances.",
  offres: [
    { icon: "ball", titre: "Stages de vacances",
      texte: "À chaque période de vacances scolaires, des stages à la semaine ou à la journée, par niveau et par âge. Tennis le matin, jeux et activités l'après-midi. Rabais dès la deuxième semaine ou pour un deuxième membre de la famille." },
    { icon: "racket", titre: "Cours juniors",
      texte: "Du mini-tennis dès 4 ans à l'entraînement de compétiteur : des groupes constitués par niveau, encadrés toute l'année par les coachs de l'académie." },
    { icon: "trophy", titre: "Journées GameZone",
      texte: "Presque tous les week-ends, des tournois juniors sur une seule journée, avec deux matchs garantis par participant. L'entrée idéale dans la compétition." },
    { icon: "city", titre: "Sport-études",
      texte: "École et tennis combinés, avec un encadrement scolaire sur place : les jeunes s'entraînent sans sacrifier leur scolarité." },
    { icon: "trend", titre: "Pro U18 et Élite",
      texte: "Après la scolarité obligatoire, un entraînement à plein temps construit autour du circuit ITF junior, puis un accompagnement individuel sur le circuit professionnel." },
    { icon: "users", titre: "Une équipe complète",
      texte: "Coachs, préparation physique, préparation mentale et physiothérapie : le suivi ne s'arrête pas au bord du court." },
  ],
};

/* --------------------------------------------------------- PARTENAIRES */
export const PARTENAIRES = [
  { nom: "Ville de Lausanne",        logo: "ville-lausanne",      url: "https://www.lausanne.ch/" },
  { nom: "Canton de Vaud",           logo: "canton-vaud",         url: "https://www.vd.ch/" },
  { nom: "Swiss Tennis",             logo: "swiss-tennis",        url: "https://www.swisstennis.ch/" },
  { nom: "Fonds du Sport Vaudois",   logo: "fonds-sport-vaudois", url: "https://ffsv.ch/" },
  { nom: "Association Vaudoise de Tennis", logo: "vaud-tennis",   url: "https://www.vaud-tennis.ch/" },
  { nom: "SVR Vins",                 logo: "svr-vins",            url: "https://svrvins.ch/" },
  { nom: "ibis Lausanne",            logo: "ibis",                url: "https://all.accor.com/hotel/6772/index.fr.shtml" },
  { nom: "Garage de la Plaine",      logo: "garage-plaine",       url: "https://garagedelaplaine.ch/" },
  { nom: "BS Architectes",           logo: "bs-architectes",      url: "https://bs-ac.ch/" },
  { nom: "Cafés Cuendet",            logo: "cafes-cuendet",       url: "https://cafes-cuendet.ch/" },
  { nom: "Boissons Gros de Vaud",    logo: "boissons-gros-vaud",  url: "https://www.boissons-gros-de-vaud.ch/" },
  { nom: "Nestlé Community",         logo: "nestle",              url: "https://www.nestle.ch/fr/nestle-en-suisse/nestle-community" },
  { nom: "Santé Prilly",             logo: "sante-prilly",        url: "https://www.santeprilly.ch/" },
  { nom: "Sport et Solidarité",      logo: "sport-solidarite",    url: "https://www.sportetsolidarite.ch/" },
];
