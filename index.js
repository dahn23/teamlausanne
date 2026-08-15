// Site public dynamique : mondes + pages détaillées (routage par ancre).
import { sb, getSession, frDate, jours } from "./common.js";
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
      { type: "instagram", anchor: "vie", title: "Vie du club", handle: "lausanne_sports_tennis",
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

  academie: {
    tag: "Academy", logo: "assets/logo-academie.webp",
    slogan: "Grandir. Progresser. Ensemble.",
    desc: "Le centre de formation du Lausanne-Sports Tennis. Un parcours complet, du premier jeu à la performance, adapté à chaque âge dès 5 ans.",
    hero: "assets/webflow/hero-academy.webp",
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
          { name: "KidsTennis", meta: "4–10 ans · ouvert à tous", href: "#kids" },
        ],
        club: { title: "Filière Club", href: "#club-academy", body: [
          "En parallèle de la pyramide de sélection, la filière Club s'adresse à celles et ceux qui veulent développer leur tennis à leur rythme, une ou plusieurs fois par semaine.",
          "Avec la possibilité de disputer quelques compétitions ponctuelles — dont les interclubs, pour les membres du club.",
        ]},
        note: "L'âge n'est qu'un repère : la progression s'adapte à chacun, à 1–2 ans près. Celles et ceux qui ne rejoignent pas une filière sélective poursuivent en Club." },
      { type: "carousel", anchor: "programmes", eyebrow: "Cours pour tous", title: "Un programme pour chaque niveau",
        sub: "Du premier échange à la performance, un parcours clair pour progresser avec plaisir.",
        items: [
          { name: "KidsTennis", photo: "assets/webflow/prog-kids.webp", href: "#kids" },
          { name: "Club", photo: "assets/webflow/prog-club.webp", href: "#club-academy" },
          { name: "Compétition", photo: "assets/webflow/prog-competition.webp", href: "#competition" },
          { name: "Performance", photo: "assets/webflow/prog-performance.webp", href: "#performance" },
          { name: "Sport-études", photo: "assets/webflow/sport-studies.jpg", href: "#sport-etudes" },
          { name: "Pro U18", photo: "assets/webflow/coaching-technique.jpg", href: "#pro-u18" },
          { name: "Pro", photo: "assets/webflow/physical-training.jpg", href: "#pro" },
          { name: "Game Zone", photo: "assets/webflow/event-gamezone.webp", href: "#gamezone" },
          { name: "Stages", photo: "assets/webflow/prog-adults.webp", href: "#stages" },
        ]},
      { type: "team", title: "Team Compétition & Performance",
        sub: "Nos jeunes des filières sélectives Compétition et Performance (photos et noms à venir).", count: 20 },
      { type: "team", title: "Team Sport-études, Pro & Pro U18",
        sub: "Nos joueuses et joueurs des filières élite (photos et noms à venir).", count: 15 },
      { type: "coaches", anchor: "coaches", title: "Notre équipe de coachs",
        items: [
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
        "Boissons Gros de Vaud", "BS Architectes", "Garage-carrosserie de la Plaine",
        "Ibis Hotels", "Fonds du Sport vaudois", "Nestlé Community",
      ]},
    ],
  },

  business: {
    tag: "Business & partenaires", logo: "assets/logo-club.webp",
    slogan: "S'associer. Rayonner. Ensemble.",
    desc: "Associez votre entreprise à un club historique et à une académie de formation reconnue, au cœur de Lausanne.",
    hero: "assets/webflow/cta-young.jpg",
    cta: [{ label: "Devenir partenaire", type: "scroll", target: "biz-contact" }],
    sections: [
      { type: "rich", anchor: "presidents", title: "Club des Présidents", body: [
        "Une offre exclusive et networking : chaque vendredi matin, jouez 2h en halle couverte (été comme hiver), puis prolongez autour d'un apéro dînatoire sur le court.",
        "15 crédits à utiliser librement pour inviter vos clients ou partenaires, des coachs pour animer, une thématique par vendredi — et un soutien reversé aux jeunes de l'académie.",
      ], link: { label: "Rejoindre le Club des Présidents", href: "presidents.html" } },
      { type: "features", anchor: "avantages", title: "Avantages & offres partenaires", items: [
        ["Visibilité", "Présence sur les courts, le site et les supports de communication."],
        ["Réseau", "Accès au Club des Présidents et aux événements du club."],
        ["Hospitalité", "Invitations au Lausanne Open et moments privilégiés."],
        ["Sur mesure", "Des formules de partenariat adaptées à vos objectifs."],
      ]},
      { type: "rich", anchor: "devenir", title: "Devenir partenaire", body: [
        "Vous souhaitez associer votre marque au tennis lausannois ? Construisons ensemble un partenariat qui vous ressemble.",
      ], link: { label: "Nous contacter", scroll: "biz-contact" } },
      { type: "rich", anchor: "privatisation", title: "Privatisations & événements d'entreprise", body: [
        "Organisez votre événement d'entreprise au club : entraînement privatisé pour votre entreprise, team-building tennis avec apéro ou repas, dans un cadre unique aux Plaines-du-Loup.",
      ], link: { label: "Demander une offre", scroll: "biz-contact" } },
      { type: "contactform", anchor: "contact", title: "Parlons-en",
        lead: "Devenir partenaire, privatiser un moment au club ou rejoindre le Club des Présidents ? Laissez-nous vos coordonnées, on vous rappelle — ou appelez directement Raphaël.",
        person: "Raphaël Vergnaud", role: "Partenariats — Team Lausanne", tel: "+41799550694", telLabel: "079 955 06 94" },
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
        ], link: { label: "Une question ? Nous écrire", contact: "Renseignement pour les stages" } },
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
      ], note: "Repas de midi inclus.", link: { label: "Nous écrire", contact: "Renseignement pour l'Academy" } },
      { type: "gallery", items: ["assets/photos/p6.jpg", "assets/photos/coach3.jpg"] },
    ],
  },
  competition: {
    world: "academie", title: "Compétition", subtitle: "L'entrée en compétition, dès ~10 ans",
    hero: "assets/webflow/prog-competition.webp",
    sections: [
      { type: "rich", title: "Entrer en compétition", body: [
        "La filière Compétition accueille les jeunes d'environ 10 à 13 ans qui veulent se mesurer aux autres et progresser dans un cadre encadré.",
        "16 places par sélection. L'âge reste un simple repère : celles et ceux qui ne rejoignent pas la filière poursuivent en Club.",
      ]},
      { type: "features", title: "Le programme", items: [
        ["≈ 10–13 ans", "Filière sélective, 16 places."],
        ["Encadrement", "Entraînements réguliers en petits groupes de niveau."],
        ["Compétition", "Tournois juniors et GameZone tout au long de la saison."],
        ["Progression", "Passerelle naturelle vers la filière Performance."],
      ], link: { label: "Nous écrire", contact: "Cours juniors" } },
      { type: "enroll", title: "Demander une inscription", filiere: "competition", ranking: true,
        lead: "Intéressé(e) par la filière Compétition ? Remplissez ce formulaire, le secrétariat vous recontacte." },
      { type: "gallery", items: ["assets/webflow/prog-competition.webp", "assets/photos/kids2.jpg"] },
    ],
  },
  performance: {
    world: "academie", title: "Performance", subtitle: "La filière élite junior, ~12–15 ans",
    hero: "assets/webflow/prog-performance.webp",
    sections: [
      { type: "rich", title: "Viser le meilleur niveau", body: [
        "La filière Performance s'adresse aux jeunes d'environ 12 à 15 ans prêts à s'investir davantage. Elle se chevauche avec la Compétition : l'âge n'est pas un frein, c'est une évolution qui s'adapte à 1–2 ans près.",
        "8 places par sélection. Les autres poursuivent en Club ou en Compétition.",
      ]},
      { type: "features", title: "Le programme", items: [
        ["≈ 12–15 ans", "Filière élite, 8 places."],
        ["Volume", "Charge d'entraînement renforcée, physique intégré."],
        ["Suivi", "Encadrement rapproché et planification individualisée."],
        ["Objectif", "Accès au Sport-études et à la voie Pro U18."],
      ], link: { label: "Nous écrire", contact: "Cours juniors" } },
      { type: "enroll", title: "Demander une inscription", filiere: "performance", ranking: true,
        lead: "Intéressé(e) par la filière Performance ? Remplissez ce formulaire, le secrétariat vous recontacte." },
      { type: "gallery", items: ["assets/webflow/prog-performance.webp", "assets/photos/coach1.jpg"] },
    ],
  },
  "pro-u18": {
    world: "academie", title: "Pro U18", subtitle: "Après la scolarité, viser le circuit ITF junior",
    hero: "assets/webflow/coaching-technique.jpg",
    sections: [
      { type: "rich", title: "Monter dans la hiérarchie mondiale", body: [
        "Après la scolarité obligatoire, le programme Pro U18 permet de s'entraîner à plein temps tout en participant au circuit ITF junior.",
        "Cinq semaines de tournois à l'étranger par an, deux entraînements quotidiens et un suivi rapproché pour progresser au classement mondial.",
      ]},
      { type: "features", title: "Une journée type", items: [
        ["09h00–10h00", "Préparation physique (mercredi : 14h–16h)."],
        ["10h15–12h15", "Tennis, session du matin."],
        ["13h15–15h15", "Tennis, session de l'après-midi."],
        ["Suivi", "Rapports bihebdomadaires et planification annuelle."],
      ]},
      { type: "features", title: "Ce qui est inclus", items: [
        ["Médical & physio", "Suivi médical, physiothérapie et tests réguliers."],
        ["Préparation mentale", "Un accompagnement mental intégré."],
        ["Cordage & équipement", "Cordages et vêtements fournis."],
        ["Tournois", "5 semaines de tournois à l'étranger par an."],
      ], link: { label: "Nous écrire", contact: "Renseignement pour l'Academy" } },
      { type: "gallery", items: ["assets/photos/coach3.jpg", "assets/webflow/physical-training.jpg"] },
    ],
  },
  pro: {
    world: "academie", title: "Pro", subtitle: "Un accompagnement sur mesure vers le circuit professionnel",
    hero: "assets/photos/coach2.jpg",
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
      ], link: { label: "Nous écrire", contact: "Renseignement pour l'Academy" } },
      { type: "gallery", items: ["assets/photos/coach2.jpg", "assets/photos/open-serve.jpg"] },
    ],
  },
  kids: {
    world: "academie", title: "KidsTennis", subtitle: "Les cours juniors des 4–9 ans, toute l'année",
    hero: "assets/photos/kids3.jpg",
    sections: [
      { type: "rich", title: "Apprendre en s'amusant", body: [
        "KidsTennis initie les enfants de 4 à 9 ans au tennis de façon ludique et progressive, tout au long de l'année scolaire.",
        "Le jeu avant tout : coordination, motricité et plaisir, avec du matériel adapté à chaque âge et un encadrement de proximité.",
      ]},
      { type: "features", title: "L'offre", items: [
        ["4–9 ans", "Cours juniors sur toute la saison (31 août 2026 → 2 juillet 2027)."],
        ["45 minutes", "Une séance de 45 minutes par semaine."],
        ["1 coach / 4 enfants", "Un suivi personnalisé en tout petit groupe."],
        ["Offert", "T-shirt Team Lausanne offert, raquette prêtée si besoin."],
      ]},
      { type: "features", title: "Horaires", items: [
        ["Mercredi", "13h15–14h00 ou 14h00–14h45."],
        ["Mardi ou jeudi", "16h30–17h15."],
        ["Sur mesure", "Cours supplémentaires possibles en fin d'après-midi."],
      ], link: { label: "Nous écrire", contact: "Cours juniors" } },
      { type: "rich", title: "Tarif", body: [
        "CHF 490.– pour la saison complète, soit environ 44 CHF par mois.",
      ]},
      { type: "enroll", title: "Demander une inscription", filiere: "kidstennis", ranking: false,
        lead: "Envie d'inscrire votre enfant à KidsTennis ? Remplissez ce formulaire, le secrétariat vous recontacte." },
      { type: "gallery", items: ["assets/photos/kids1.jpg", "assets/photos/kids2.jpg"] },
    ],
  },
  "club-academy": {
    world: "academie", title: "Club", subtitle: "L'entraînement à son rythme, toute l'année",
    hero: "assets/webflow/prog-club.webp",
    sections: [
      { type: "rich", title: "Jouer et progresser, sans pression", body: [
        "L'offre Club s'adresse à celles et ceux qui veulent jouer 1 ou plusieurs heures par semaine toute l'année — débutants comme plus avancés.",
        "Un entraînement régulier pour progresser à son rythme, avec la possibilité d'ajouter une deuxième séance par semaine.",
      ]},
      { type: "features", title: "L'offre", items: [
        ["Toute l'année", "Du 31 août 2026 au 2 juillet 2027."],
        ["1h / semaine", "Possibilité de prendre 2 entraînements par semaine."],
        ["1 coach / 4 jeunes", "Un encadrement de proximité."],
        ["Offert", "T-shirt Team Lausanne offert."],
      ]},
      { type: "features", title: "Horaires", items: [
        ["Lun · Mar · Jeu · Ven", "17h15 – 19h15."],
        ["Mercredi", "13h15 – 19h15."],
      ]},
      { type: "ranking", title: "Tarifs · saison 2026/27", head: ["Jour", "Prix / saison"], rows: [
        ["Lundi", "770.–"], ["Mardi", "815.–"], ["Mercredi", "815.–"], ["Jeudi", "790.–"], ["Vendredi", "770.–"],
      ]},
      { type: "features", title: "Et la compétition ?", items: [
        ["Ponctuelle", "Quelques compétitions au fil de la saison, selon l'envie et sans obligation."],
        ["Interclubs", "Pour les membres du club, possibilité de participer aux interclubs selon disponibilité."],
      ], link: { label: "Nous écrire", contact: "Cours juniors" } },
      { type: "enroll", title: "Demander une inscription", filiere: "club", ranking: false,
        lead: "Envie de rejoindre l'offre Club ? Remplissez ce formulaire, le secrétariat vous recontacte." },
    ],
  },
  gamezone: {
    world: "academie", title: "Game Zone", subtitle: "Des tournois juniors presque tous les week-ends",
    hero: "assets/photos/kids2.jpg",
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
  const ctaHTML = `<button class="btn-cta ghost" data-back="${d.world}">← Retour à ${esc(w.tag.toLowerCase())}</button>`;
  paintHero({ logo: w.logo, hero: d.hero, tag: w.tag, slogan: d.title, desc: d.subtitle, ctaHTML });
  $("world-main").innerHTML = d.sections.map(sectionWrap).join("");
  animate();
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
// « Réserver » / « Jouer librement » : on va toujours sur la page de réservation
// (publique). La connexion se fait là-bas, seulement au moment de réserver.
const memberAction = () => { location.href = "reservation.html"; };
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
    requestAnimationFrame(() => document.querySelector(`[data-anchor="${a}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
  requestAnimationFrame(() => document.querySelector(`[data-anchor="${at}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  history.replaceState(null, "", location.pathname + location.hash);
})();
