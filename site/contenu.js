// ===========================================================================
//  contenu.js — tout le texte du site, en DONNÉES
// ---------------------------------------------------------------------------
// Ce fichier ne contient pas une ligne de code : uniquement un objet littéral.
// C'est délibéré, et c'est ce qui permet deux lectures de la MÊME source :
//
//   · index.js l'importe et construit les pages ;
//   · le chatbot (edge function « chatbot ») va le chercher à son adresse
//     publique, le lit comme de la donnée et en fait sa base de connaissances.
//
// Le bot n'exécute donc jamais notre JavaScript, et il ne peut pas répondre à
// côté du site : il lit le site. Un prix corrigé ici est corrigé pour les deux.
//
// DEUX RÈGLES À TENIR, sous peine de casser la relecture par le bot :
//   1. Pas de référence croisée, pas d'appel de fonction, pas de calcul. Deux
//      renvois sont admis, sous forme de texte, et résolus par index.js :
//        · "@coachs"            → la liste coachs ci-dessous
//        · { type: "mention" }  → le bloc mention_image ci-dessous
//   2. Pas de virgule finale exotique ni de commentaire /* */ à l'intérieur
//      des valeurs : les commentaires // en début de ligne sont admis.
// ===========================================================================

export const CONTENU = {

// ---- L'équipe de coachs ---------------------------------------------------
// Liste unique : la page « Nos coachs » (details.coaches) et le carrousel de
// l'accueil la lisent toutes deux. Une photo manquante se remplace ici, une
// filière change ici, et les deux endroits suivent.
coachs:
[
  { slug: "mariano-palena", role: "Head coach", nom: "Mariano Palena",
    resume: "Coach international, il accompagne des joueurs professionnels dans leur développement technique, mental et personnel.",
    tags: ["Sport-études & Pro", "Compétition", "Performance"],
    bio: [
      "Argentin d'origine, Mariano Palena entraîne depuis ses 18 ans. Passionné de tennis et de transmission, il accompagne les jeunes joueurs dans leur développement sportif, mental et personnel.",
    ],
    citation: "Mon rôle est d'aider les jeunes à aimer le processus et à devenir autonomes. Avant d'être des joueurs de tennis, nous sommes des personnes. Les valeurs passent toujours en premier.",
    classement: ["Niveau estimé N4/R1 en Suisse."],
    formations: [
      "Formation de l'Association argentine de tennis, niveaux 1 et 2.",
      "ITF niveau III.",
      "Formations complémentaires en biomécanique, préparation physique et psychologie du sport.",
      // Meme tournure que pour Loris et Seline : « en cours » pour ce qui n'est
      // pas encore acquis, pour ne pas laisser croire au diplome obtenu.
      "Entraîneur B : formation en cours.",
    ],
    parcours: [
      "Expérience auprès de juniors de tous âges, y compris sur le circuit ITF Junior.",
      "A entraîné des joueurs professionnels classés jusqu'au top 350 ATP.",
      "A accompagné des joueuses entrées dans le top 100 WTA, sur les tournois WTA et en Grand Chelem.",
      "Expérience d'entraîneur en Argentine, en Italie, en Espagne et en Arabie saoudite.",
      "Head coach des groupes Sport-études & Pro depuis plus de deux ans.",
    ]},

  { slug: "yann-perez", role: "Coach", nom: "Yann Perez",
    resume: "Coach performance, il associe l'expérience de la compétition à une approche exigeante, intense et respectueuse.",
    tags: ["Sport-études & Pro"],
    bio: [
      "Yann Perez a rejoint l'académie il y a cinq ans. En parallèle de son métier de coach, il a mené des études universitaires tout en continuant à jouer en compétition.",
      "Discipline, intensité et respect sont au cœur de son approche sur le court.",
    ],
    classement: ["Classement actuel : R1 (290).", "Meilleur classement : R1 (189)."],
    formations: [
      "Entraîneur J+S.",
      "Brevet d'enseignement pour joueurs avancés.",
      "Coach Youth Sport.",
      "Swiss Tennis Physis Coach.",
    ],
    parcours: [
      "Deux fois champion vaudois.",
      "Finaliste des interclubs juniors.",
      "Sparring-partner de joueurs ATP.",
      "Stages d'entraînement en Espagne.",
    ]},

  { slug: "loris-gander", role: "Coach", nom: "Loris Gander",
    resume: "Joueur de compétition en activité et coach, il partage son expérience des tournois avec patience, enthousiasme et passion.",
    tags: ["Kids Tennis", "Club", "Compétition", "Stages"],
    bio: [
      "Loris Gander a 19 ans et joue au tennis depuis l'âge de trois ans. Il s'entraîne quotidiennement dans la filière Pro de la Team Lausanne Academy, avec l'objectif de devenir joueur professionnel, tout en transmettant sa passion comme coach au sein de l'académie.",
      "Patient et passionné, Loris aime partager son énergie et son goût du tennis avec les jeunes qu'il encadre.",
    ],
    classement: ["Classement actuel et meilleur classement : N4 (148)."],
    formations: ["Formation Jeunesse+Sport en cours."],
    parcours: [
      "A disputé plusieurs tournois ITF juniors à l'étranger.",
      "Expérience sur quelques tournois ITF adultes.",
      "Coach à la Team Lausanne Academy depuis un an.",
      "Accompagnement ponctuel sur les tournois.",
    ]},

  { slug: "seline-rivarolli", role: "Coach", nom: "Séline Rivarolli",
    resume: "Coach des plus jeunes, elle construit des séances positives et motivantes, faites d'énergie, de plaisir et de goût du jeu.",
    tags: ["Kids Tennis", "Club", "Stages"],
    bio: [
      "Séline Rivarolli a 19 ans et joue au tennis depuis l'âge de quatre ans. Une blessure l'a empêchée de poursuivre en compétition, mais sa passion est restée intacte et elle la transmet aujourd'hui aux plus jeunes.",
      "Séline transmet sa passion comme on la lui a transmise : avec motivation, énergie et le sourire.",
    ],
    classement: ["Classement actuel : R6.", "Meilleur classement : R3."],
    formations: [
      "Diplôme d'aide-monitrice de tennis.",
      "Formation J+S prévue en août 2026.",
    ],
    parcours: [
      "A disputé plusieurs championnats vaudois.",
      "A participé aux championnats suisses.",
      "Expérience de l'entraînement en académie.",
    ]},

  // Propos recueillis aupres de Celyan. Une seule photo pour les deux
  // emplacements, faute d'une deuxieme : en carte (386/340) elle perd ses
  // bords et garde toute sa hauteur, donc le visage tient. En bas de
  // fiche (620/320) c'est le haut et le bas qui sautent, et un cadrage
  // centre lui coupait la tete — d'ou portraitPos, qui remonte le cadre.
  // Sport-etudes est SA filiere, pas celle qu'il encadre : il donne le
  // Kids Tennis, le Club, la Competition et les stages.
  { slug: "celyan-lorival", role: "Coach", nom: "Célyan Lorival",
    portrait: "assets/photos/coaches/celyan-lorival.jpg", portraitPos: "center 24%",
    resume: "Joueur en sport-études et coach depuis deux ans, il transmet avec patience ce qu'il continue d'apprendre sur le court.",
    tags: ["Kids Tennis", "Club", "Compétition", "Stages"],
    bio: [
      "Célyan Lorival est en sport-études au Lausanne-Sports depuis cinq ans, avec le bac en ligne de mire. Il enseigne depuis environ deux ans, du Kids Tennis à la Compétition, en cours comme en stage.",
      "Revers à une main, et un faible avoué pour l'ambiance des interclubs. Patient et motivé, il aime transmettre autant que jouer.",
    ],
    classement: ["Classement actuel et meilleur classement : R2."],
    formations: [
      "Jeunesse+Sport, formation continue 1.",
      "Jeunesse+Sport, formation continue 2.",
      "Official Swiss Tennis.",
    ],
    parcours: [
      "Cinq ans de sport-études au Lausanne-Sports.",
      "Enseigne depuis deux ans : Kids Tennis, Club, Compétition et stages.",
    ]},

  { slug: "talia-picci", role: "Coach junior", nom: "Talia Picci",
    resume: "Compétitrice R1 en activité, elle accompagne les jeunes dans des séances vivantes, détendues et motivantes, centrées sur l'engagement et le plaisir.",
    tags: ["Kids Tennis", "Club", "Stages"],
    bio: [
      "Talia Picci a 18 ans et vise une carrière professionnelle. Classée R1, elle dispute des tournois presque chaque week-end et aborde progressivement le circuit international.",
      "Son entraînement repose sur l'engagement et le plaisir. Quand les joueurs fournissent de vrais efforts, elle aime les récompenser par des jeux, dans une ambiance détendue et motivante.",
    ],
    classement: ["Classement actuel : R1 (117).", "Meilleur classement : R1 (99)."],
    formations: ["Certification Tennis loisir, niveau 1."],
    parcours: [
      "Compétitrice active sur le circuit national.",
      "Débuts sur les tournois internationaux.",
      "Intervient en Kids Tennis, dans les groupes Club et sur les stages.",
    ]},
],

// Droit à l'image : même mention au bas des quatre filières sans contrat signé
// — Kids Tennis, Club, Compétition, Performance. Sport-études, Pro U18 et Pro
// ne l'ont pas : leur contrat traite déjà la question.
//
// Elle est écrite une fois et réutilisée : quatre copies finiraient par
// diverger, et une mention légale qui ne dit pas la même chose d'une page à
// l'autre ne vaut rien.
//
// ⚠️ Informer n'est pas obtenir un consentement. Pour l'image d'un mineur
// utilisée en communication, la base solide reste l'accord explicite du
// représentant légal, recueilli à l'inscription. Cette mention informe et
// ouvre un droit d'opposition tracé — elle aide, elle ne remplace pas une case
// à cocher dans le formulaire.
mention_image:
{
  type: "mention", title: "Droit à l'image",
  body: "Dans le cadre des cours, stages, tournois et événements, Team Lausanne Academy "
    + "réalise des photographies et des vidéos, susceptibles d'être utilisées pour sa "
    + "communication : site internet, réseaux sociaux, newsletter et supports imprimés. "
    + "Ces images ne sont ni vendues ni cédées à des tiers à des fins "
    + "commerciales, et les mineurs n'y sont jamais identifiés au-delà de leur prénom. "
    + "Le représentant légal peut s'opposer à cette utilisation à tout moment, sans "
    + "justification et sans conséquence sur la participation, et demander le retrait "
    + "d'une image déjà publiée en écrivant à info@teamlausanne.ch : nous y donnons "
    + "suite dans les meilleurs délais. Les données sont traitées conformément à la loi "
    + "fédérale sur la protection des données (LPD).",
},

// ---- Les trois mondes -----------------------------------------------------
worlds:
{
  academie: {
    tag: "Academy", retour: "à l'Academy",
    logo: "assets/logo-academie.webp", heroLogo: "assets/logo-academie-blanc.png",
    slogan: "Jouer. Progresser. Ensemble.",
    desc: "Le centre de formation du Lausanne-Sports Tennis. Un parcours complet, du premier jeu à la performance, adapté à chaque âge dès 5 ans.",
    hero: "assets/photos/competition-2026-g1.jpg", heroPos: "center 40%",
    cta: [{ label: "Nos stages", type: "stages" }, { label: "Nos tournois GameZone", type: "gamezone" }, { label: "Notre programme Sport-Études", type: "sport-etudes" }],
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
      // Les coachs sur l'accueil : une pyramide de filieres ne dit pas QUI
      // encadre. En carrousel plutot qu'en grille — six cartes en grille
      // auraient repousse tout le bas de page — et SANS defilement automatique :
      // la bande sombre « Un programme pour chaque niveau » defile juste en
      // dessous, et deux mouvements l'un sur l'autre fatiguent.
      { type: "coachs", piste: true, anchor: "coachs", eyebrow: "Celles et ceux qui encadrent",
        title: "Nos coachs",
        lead: "Du Kids Tennis au Pro, la même équipe et la même exigence. Cliquez sur une carte pour lire son parcours.",
        lien: { label: "Voir toute l'équipe", href: "#coaches" },
        items: "@coachs" },
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
      { type: "calendrier", anchor: "calendrier", eyebrow: "Agenda",
        title: "Le calendrier de la saison",
        lead: "Vacances scolaires, jours fériés, fermetures de l'académie et stages : les dates à retenir, au même endroit." },
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
      { type: "stats", anchor: "tournoi", variant: "board", items: [
        { v: "Août 2027", l: "prochaine édition", ico: "date",     scroll: "infos" },
        { v: "30 000 $",  l: "dotation",          ico: "coupe" },
        { v: "Gratuit",   l: "entrée libre",      ico: "billet",   scroll: "infos" },
        { v: "ITF M25",   l: "catégorie",         ico: "ecusson",  href: ITF_URL },
      ] },
      // Video YouTube « Lausanne Open 2026 — les meilleurs moments ». L'affiche
      // est servie par le site : rien n'est demande a YouTube tant qu'on ne
      // clique pas, et le lecteur (et sa marque) n'apparait qu'a la lecture.
      { type: "split", anchor: "presentation", title: "Le grand rendez-vous du tennis vaudois masculin",
        video: "S1kulGoQPNM", poster: "assets/video/lausanne-open-2026-film.jpg", body: [
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
      { type: "palmares", anchor: "palmares", title: "Palmarès",
        sub: "Les vainqueurs du Lausanne Open, édition après édition.",
        editions: [
          { an: "2026", simple: { f: FLAG_CH, n: "Henry Bernet" },
            double: [{ f: FLAG_CH, n: "Johan Niklès" }, { f: FLAG_CH, n: "Adrien Burdet" }] },
          { an: "2025", simple: { f: FLAG_CH, n: "Henry Bernet" },
            double: [{ f: FLAG_IE, n: "Charles Barry" }, { f: FLAG_FR, n: "Max Westphal" }] },
        ] },
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
        sub: "Le Lausanne Open n’existerait pas sans eux." },
    ],
  },

},

// ---- Les pages détaillées -------------------------------------------------
details:
{
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
    world: "academie", title: "Nos stages",
    subtitle: "Pendant les vacances scolaires, des stages de tennis pour les 4 à 18 ans et pour les adultes : de la découverte ludique à la semaine intensive, encadrés par nos coachs aux Plaines-du-Loup.",
    hero: "assets/photos/stages-2026.jpg",
    cta: { label: "Choisir mon stage", scroll: "stagesec" },
    sections: [
      { type: "keywords", label: "Ce qui fait nos stages", items: [
        "Vacances scolaires", "Dix semaines par an", "Tennis et activités",
        "Des 4 ans aux adultes", "Petits groupes", "Aux Plaines-du-Loup",
      ]},
      { type: "formules", eyebrow: "Les formules",
        title: "Une semaine à la mesure de chacun",
        intro: "Du mini-tennis à l'entraînement de compétiteur, choisis selon ton âge et tes envies. <b>−20 % dès la 2ᵉ semaine</b> ou pour un 2ᵉ membre de la famille.",
        libelles: { "4-9": "4 à 9 ans", "9-18": "9 à 18 ans", adultes: "Adultes" },
        items: [
          { name: "Kids Tennis", groupe: "4-9", age: "4 à 9 ans", rythme: "Découvrir & s'amuser",
            horaire: "9h00 – 12h00",
            lines: ["1h30 de tennis + 1h30 d'activité", "Repas non inclus"], price: "250 CHF" },
          { name: "Loisirs ½ journée", groupe: "9-18", age: "9 à 18 ans", rythme: "Progresser & se faire plaisir",
            horaire: "9h00 – 12h00 ou 14h00 – 17h00",
            lines: ["1h30 de tennis + 1h30 d'activité", "Repas non inclus"], price: "290 CHF" },
          { name: "Loisirs journée", groupe: "9-18", age: "9 à 18 ans", rythme: "Progresser & se faire plaisir",
            horaire: "9h00 – 17h00",
            lines: ["3h de tennis + 3h30 d'activité", "Repas inclus"], price: "450 CHF" },
          { name: "Entraîne-toi comme un pro", groupe: "9-18", age: "10 à 19 ans · dès R7", rythme: "Haute performance",
            horaire: "9h00 – 17h00",
            lines: ["4h de tennis + 1h30 physique + 1h d'activité", "Repas inclus", "Option cours privé +240 CHF (3h)"],
            price: "790 CHF", pro: true },
          { name: "Stage adultes", groupe: "adultes", age: "18 ans et +", rythme: "Entraînement adultes",
            horaire: "18h15 – 19h45",
            lines: ["1h30 de tennis par jour", "Certaines semaines d'été uniquement"], price: "240 CHF" },
        ]},
      { type: "stageform", eyebrow: "Prochaines dates", title: "Réserve ta place",
        lead: "Choisis ta semaine : le formulaire s'ouvre en un clic, et le secrétariat confirme ton inscription." },
    ],
  },
  "sport-etudes": {
    world: "academie", title: "Sport-études",
    subtitle: "Concilier les études et un entraînement quotidien, de 14 à 19 ans : deux heures de tennis, une heure de physique et quatre heures de cours encadrés par jour, avec un suivi individuel du premier jour au diplôme.",
    // Cadrage : le joueur est a gauche de l'image. En largeur d'ecran, la photo
    // deborde en hauteur et seule la valeur verticale compte — 40 % garde la
    // raquette et la balle. Sur telephone c'est l'inverse, la photo deborde en
    // largeur : 30 % retient le joueur dans le cadre au lieu de le rogner.
    hero: "assets/photos/sport-etudes-2026.jpg", heroPos: "30% 40%",
    // La photo reste le poster : elle s'affiche tout de suite, pendant le
    // chargement de la video, et demeure seule sur telephone et en mode
    // « animations reduites ». La video ne fait que passer par-dessus.
    heroVideo: "assets/video/sport-etudes-hero.mp4",
    cta: { label: "Recevoir la brochure", scroll: "brochure" },
    sections: [
      { type: "keywords", label: "Ce qui fait le Sport-études", items: [
        "Études encadrées", "Entraînement quotidien", "Suivi individualisé",
        "Repas inclus", "Écoles partenaires", "Vers la maturité",
      ]},
      { type: "split", photos: [
          "assets/photos/sport-etudes-2026-g1.jpg", "assets/photos/sport-etudes-2026-g2.jpg",
        ],
        eyebrow: "Le programme de référence", title: "Étudier et s'entraîner, sans choisir", body: [
          "Le sport-études permet aux 14–19 ans de concilier études et entraînement intensif, dans un cadre optimal et un suivi individualisé.",
          "Le programme s'étend sur 35 semaines selon le calendrier vaudois et combine tennis, préparation physique et études encadrées.",
        ], link: { label: "Recevoir la brochure", scroll: "brochure", cta: true } },
      { type: "stats", items: [["35", "semaines / an"], ["2h", "tennis / jour"], ["1h", "physique / jour"], ["4h", "études / jour"]] },
      // Titre et accroche repris de la video elle-meme, pour ne rien affirmer
      // sur un contenu que je n'ai pas vu.
      { type: "filmsec", eyebrow: "En images", title: "Viser haut, préparer son avenir",
        lead: "Le programme Sport-études en vidéo.",
        poster: "assets/photos/sport-etudes-video.jpg",
        video: "ZBRb8MNP0nI" },
      { type: "perks", eyebrow: "Un encadrement complet",
        title: "Tout est prévu autour du joueur",
        lead: "Les études, le corps et la tête : rien n'est laissé de côté pendant les trois à cinq ans du parcours.", items: [
          ["Repas de midi", "Inclus et pris sur place, entre l'entraînement et les cours."],
          ["Écoles partenaires", "Enseignement à distance avec l'Institut DOMI, l'EPSU et le CNED."],
          ["Responsable pédagogique", "Un référent dédié : organisation, méthodologie, suivi des échéances."],
          ["Soutien académique", "Des assistants issus de l'EPFL et de l'UNIL, selon les besoins."],
          ["Objectif diplôme", "Maturité fédérale suisse ou baccalauréat français."],
          ["Médical et physio", "Suivi médical, physiothérapie et tests réguliers."],
          ["Préparation mentale", "Un accompagnement mental intégré à la semaine."],
          ["Et après", "Université suisse, institutions américaines (NCAA) ou circuit professionnel."],
        ]},
      { type: "students", eyebrow: "On vous présente",
        title: "Nos athlètes",
        lead: "Derrière le programme, il y a d'abord des joueuses et des joueurs. Touchez une carte pour en savoir plus.", items: [
          { nom: "Talia Dupasquier Picci", age: "18 ans", classement: "R1 (117)",
            photo: "assets/photos/eleve-talia-picci.jpg",
            mytennis: "19757017",
            mot: "Dix-huit ans et déjà joueuse professionnelle : vivre de son tennis, c'est le projet. Un tournoi presque chaque week-end, et les premiers rendez-vous internationaux. Elle donne des cours en stage et au Kids Tennis. Son moteur : aller chercher tout ce qu'elle peut, et passer au-dessus de son R1.",
            tags: ["Meilleur classement : R1 (99)", "Certifiée loisir niveau 1"] },
          { nom: "Célyan Lorival", age: "18 ans", classement: "R2",
            photo: "assets/photos/eleve-celyan-lorival.jpg",
            mytennis: "19764390",
            mot: "Cinq ans de sport-études au Lausanne-Sports, et le bac en ligne de mire. Revers à une main, faible avoué pour l'ambiance des interclubs. Il enseigne depuis deux ans, en cours comme en stage : patient, et autant motivé par transmettre que par jouer.",
            tags: ["J+S continue 1", "J+S continue 2", "Official Swiss Tennis"] },
          // Propos recueillis aupres de Nadia, remis a la 3e personne.
          { nom: "Nadia Dévaud", age: "15 ans", classement: "R5",
            photo: "assets/photos/eleve-nadia-devaud.jpg",
            mytennis: "19822148",
            mot: "Quinze ans, classée R5, et un an de sport-études au Lausanne-Sports. Un jeu offensif, porté par son coup droit. Son but : atteindre le niveau professionnel." },
          // Propos recueillis aupres de Hektor, remis a la 3e personne comme
          // les autres portraits.
          { nom: "Hektor Vitone", age: "13 ans", classement: "R4",
            photo: "assets/photos/eleve-hektor-vitone.jpg",
            mytennis: "19874388",
            mot: "Treize ans, classé R4, et une première année au Lausanne-Sports. Plutôt joueur de fond de court. Son rêve : vivre de son tennis et intégrer le top 100 mondial." },
          // Propos recueillis aupres d'Isabella, remis a la 3e personne comme les
          // autres portraits. Elle se donne R4 : son classement passe donc de R5
          // a R4 ici aussi, sinon la pastille contredirait son texte.
          { nom: "Isabella Stadelmann", age: "14 ans", classement: "R4",
            photo: "assets/photos/eleve-isabella-stadelmann.jpg",
            mytennis: "19803666",
            mot: "Quatorze ans, classée R4, et une deuxième année de sport-études au Lausanne-Sports. Un jeu agressif, porté vers l'avant. Ambitieuse et perfectionniste, toujours en quête du meilleur d'elle-même." },
          // Yuma : texte encore provisoire, il ne dit que ce qu'on sait de source
          // sure (filiere et classement Swiss Tennis). A remplacer des qu'on a sa
          // vraie presentation — il est le dernier.
          { nom: "Yuma Olgiati", age: "17 ans", classement: "R4",
            photo: "assets/photos/eleve-yuma-olgiati.jpg",
            mytennis: "19800610",
            mot: "En sport-études au Lausanne-Sports, classé R4. Sa présentation arrive prochainement." },
          // Propos recueillis aupres d'Ylan, remis a la 3e personne comme les
          // autres portraits. ATTENTION : son objectif est date (« d'ici Noel »).
          // A relire apres les fetes, sinon la phrase vieillira mal.
          { nom: "Ylan Allenspach", age: "16 ans", classement: "R5",
            photo: "assets/photos/eleve-ylan-allenspach.jpg",
            mytennis: "19796976",
            mot: "Seize ans, classé R5, et une première année au Lausanne-Sports. Joueur offensif, il aime prendre le jeu à son compte et s'appuie sur son coup droit pour faire la différence. Entraînements et tournois occupent une grande place dans son quotidien, avec l'envie de se mesurer à des joueurs toujours plus forts. Son objectif est clair : passer R3 d'ici Noël, et continuer à repousser ses limites." },
          // Propos recueillis aupres de Max, remis a la 3e personne comme les
          // autres portraits. Sa formule sur l'equipe est gardee telle quelle :
          // c'est la plus parlante des siennes.
          { nom: "Max Marten", age: "16 ans", classement: "R3",
            photo: "assets/photos/eleve-max-marten.jpg",
            mytennis: "19781973",
            mot: "Seize ans, classé R3. Il se dépasse chaque jour à l'entraînement pour aller chercher son objectif, et aime repousser ses limites. Surtout, il adore jouer en équipe : c'est ensemble qu'on va le plus loin. Motivé, travailleur, toujours prêt à progresser." },
        ]},
      { type: "brochure", anchor: "brochure",
        eyebrow: "Brochure 2026", title: "Le programme en détail, dans votre boîte mail",
        lead: "Le déroulé d'une semaine, les écoles partenaires, l'encadrement et les conditions d'admission — onze pages pour tout savoir avant de nous écrire.",
        doc: "assets/brochures/sport-etudes-2026-fr.pdf",
        bouton: "Recevoir la brochure",
        mention: "Votre adresse sert uniquement à vous envoyer la brochure et à vous recontacter. Pas de liste de diffusion." },
      { type: "faq", eyebrow: "Questions fréquentes",
        title: "Tout ce qu'il faut savoir avant de postuler", items: [
          ["À qui s'adresse le programme ?", "Aux joueuses et joueurs de 14 à 19 ans qui veulent s'entraîner tous les jours sans renoncer à leur scolarité."],
          ["Comment se passent les cours ?", "À distance, avec l'Institut DOMI, l'EPSU ou le CNED, dans nos locaux et sous la conduite d'un responsable pédagogique. Quatre heures par jour, encadrées."],
          ["Quel diplôme prépare-t-on ?", "La maturité fédérale suisse ou le baccalauréat français, selon le parcours de chacun."],
          ["À quoi ressemble une journée ?", "Deux heures de tennis, une heure de préparation physique et quatre heures d'études, avec le repas de midi pris sur place."],
          ["Et après le Sport-études ?", "L'université en Suisse, une institution américaine (NCAA) ou le circuit professionnel. Le programme développe l'autonomie et la gestion du temps qui servent dans les trois cas."],
          ["Comment postuler ?", "Demandez la brochure ou écrivez-nous : nous convenons d'un échange, puis d'une évaluation sur le court."],
        ]},
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
          ["Trois rendez-vous", "Des après-midis réservés à la filière, en plus de la semaine : tennis, physique, mental et esprit d'équipe."],
          ["Une passerelle", "La suite naturelle du parcours est la filière Performance."],
        ]},
      // Dates annoncees aux familles par la newsletter du 28 septembre 2026.
      // Seul le 7 octobre a un horaire communique.
      { type: "rdv", eyebrow: "En plus de la semaine",
        title: "Les rendez-vous de la saison",
        lead: "Trois après-midis réservés aux joueuses et joueurs de la filière. Chaque rendez-vous s'ouvre sur un temps commun, puis se poursuit en ateliers avec nos coachs. Des joueurs de l'Académie viennent partager leur expérience.",
        ateliers: [["Tennis", "balle", "fluo"], ["Préparation physique", "haltere", "blue"], ["Mental", "cerveau", "ocean"], ["Esprit d'équipe", "equipe", "prussian"]],
        items: [
          { jour: "Mercredi", date: "7 octobre", an: "2026", heures: "16 h 00 – 18 h 30" },
          { jour: "Samedi", date: "20 février", an: "2027" },
          { jour: "Samedi", date: "17 avril", an: "2027" },
        ],
        note: "Participation sur inscription. Les horaires et les informations pratiques sont communiqués avant chaque rendez-vous.",
        link: { label: "S'inscrire à un rendez-vous", contact: "Rendez-vous Compétition" } },
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
      { type: "mention" },
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
          ["Six rendez-vous", "Des après-midis réservés à la filière, en plus de la semaine : tennis, physique, mental et esprit d'équipe."],
          ["La suite du parcours", "L'accès au Sport-études, puis à la voie Pro U18."],
        ]},
      // Dates annoncees aux familles par la newsletter du 28 septembre 2026.
      // Seul le 7 octobre a un horaire communique.
      { type: "rdv", eyebrow: "En plus de la semaine",
        title: "Les rendez-vous de la saison",
        lead: "Six après-midis réservés aux joueuses et joueurs de la filière. Chaque rendez-vous s'ouvre sur un temps d'accueil, puis se poursuit en ateliers avec nos coachs, aux côtés de joueurs de l'Académie.",
        ateliers: [["Tennis", "balle", "fluo"], ["Préparation physique", "haltere", "blue"], ["Mental", "cerveau", "ocean"], ["Esprit d'équipe", "equipe", "prussian"]],
        items: [
          { jour: "Mercredi", date: "7 octobre", an: "2026", heures: "16 h 00 – 18 h 30" },
          { jour: "Samedi", date: "16 janvier", an: "2027" },
          { jour: "Samedi", date: "20 février", an: "2027" },
          { jour: "Samedi", date: "20 mars", an: "2027" },
          { jour: "Samedi", date: "17 avril", an: "2027" },
          { jour: "Samedi", date: "15 mai", an: "2027" },
        ],
        note: "Participation sur inscription. Les horaires et les informations pratiques sont communiqués avant chaque rendez-vous.",
        link: { label: "S'inscrire à un rendez-vous", contact: "Rendez-vous Performance" } },
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
      { type: "mention" },
    ],
  },
  "pro-u18": {
    world: "academie", title: "Pro U18",
    subtitle: "Après la scolarité obligatoire, l'entraînement devient le métier : deux sessions de tennis par jour, le physique tous les matins et le circuit ITF junior en ligne de mire, pour celles et ceux qui veulent voir jusqu'où ça peut aller.",
    hero: "assets/photos/pro-u18-2026.jpg", heroPos: "55% 12%",
    cta: { label: "Recevoir le dossier", scroll: "brochure" },
    sections: [
      { type: "keywords", label: "Ce qui fait le Pro U18", items: [
        "Entraînement à plein temps", "Circuit ITF junior", "Deux sessions par jour",
        "Partenariat physio", "Préparation mentale", "Classement mondial",
      ]},
      { type: "split", photos: [
          "assets/photos/pro-u18-2026-s1.jpg", "assets/photos/pro-u18-2026-s2.jpg",
          "assets/photos/pro-u18-2026-s3.jpg",
        ],
        eyebrow: "Le tennis comme métier", title: "S'entraîner à plein temps, viser le monde", body: [
          "La scolarité obligatoire terminée, les journées se libèrent : deux sessions de tennis, une heure de préparation physique chaque matin, et le reste du temps pour récupérer et se soigner.",
          "Le classement mondial junior se construit en tournoi. Le programme est bâti autour du calendrier ITF, avec une planification pensée sur l'année entière.",
        ], link: { label: "Recevoir le dossier", scroll: "brochure", cta: true } },
      { type: "stats", items: [
        ["46", "semaines d'entraînement"],
        ["5", "matchs locaux"],
        ["2", "sessions de tennis / jour"],
        ["5h", "de jeu quotidien"],
      ]},
      { type: "slots", eyebrow: "La semaine type",
        title: "Une journée de joueur professionnel",
        lead: "Le physique ouvre la matinée, le tennis occupe le reste de la journée.", items: [
          { titre: "09h00 – 10h00", heures: ["Préparation physique"], note: "lun → ven" },
          { titre: "10h15 – 12h15", heures: ["Tennis, session du matin"], note: "lun → ven" },
          { titre: "13h15 – 15h15", heures: ["Tennis, session de l'après-midi"], note: "lun, mar, jeu, ven" },
        ],
        note: "Le calendrier de tournois se superpose à la semaine type : pendant les déplacements, l'entraînement se poursuit sur place." },
      { type: "perks", eyebrow: "Ce qui est compris",
        title: "Tout est prévu autour du joueur",
        lead: "Le corps, la tête et la logistique : rien ne doit détourner l'attention du jeu.", items: [
          ["Partenariat physio", "Un partenariat avec un physiothérapeute : rendez-vous obtenus rapidement et prise en charge assurée."],
          ["Préparation mentale", "Une séance avec le coach mental toutes les deux semaines, intégrée au programme."],
          ["Retours réguliers", "Des retours suivis et un point régulier sur la progression, les objectifs et la planification."],
          ["Repas de midi", "Inclus et pris sur place, entre les deux sessions."],
          ["Cordage et équipement", "Cordages, raquettes et habillement complet fournis."],
        ],
        note: "Les tournois ne sont pas compris dans le programme : vols, logement, repas et inscriptions restent à la charge du joueur." },
      { type: "faq", eyebrow: "Questions fréquentes",
        title: "Tout ce qu'il faut savoir avant de s'engager", items: [
          ["À qui s'adresse le Pro U18 ?", "Aux joueuses et joueurs sortis de la scolarité obligatoire, déjà installés en compétition, prêts à faire du tennis leur occupation principale et à voyager pour jouer."],
          ["Faut-il arrêter les études ?", "Non. Le programme s'accommode d'une formation à distance ou d'un apprentissage aménagé — l'horaire libère les fins d'après-midi et les soirées. On en discute au cas par cas."],
          ["Combien de tournois par an ?", "Il n'y a pas de nombre fixe. Le calendrier se construit avec le joueur et ses coachs, selon son niveau, sa forme et ses objectifs du moment — une saison ne ressemble pas à la suivante. Les déplacements s'organisent au cas par cas : selon le tournoi et les joueurs engagés, le voyage se fait seul ou à plusieurs, accompagné ou non par un coach de l'académie."],
          ["Comment se mesure la progression ?", "Par le classement mondial junior, et par des points réguliers avec les coachs portant sur le jeu, le physique et la planification."],
          ["Qui paie les déplacements ?", "Les frais de voyage — vols, logement, repas et inscriptions aux tournois — restent à la charge du joueur. Le reste de l'encadrement est compris dans le programme."],
          ["Et après le Pro U18 ?", "La filière Pro prend le relais pour celles et ceux qui passent sur le circuit professionnel, avec un programme entièrement sur mesure."],
        ]},
      // Pas de tarif affiché : le programme se discute. Le dossier sert de point
      // d'entrée, et la conversation s'engage à partir de là.
      { type: "brochure", anchor: "brochure", sujet: "Pro U18",
        eyebrow: "Dossier Pro U18", title: "Le programme en détail, puis on en parle",
        lead: "Le déroulé d'une semaine, le calendrier de tournois, l'encadrement et les conditions d'admission : nous vous envoyons le dossier complet, puis nous reprenons contact pour en discuter de vive voix.",
        bouton: "Recevoir le dossier",
        mention: "Votre adresse sert uniquement à vous envoyer le dossier et à vous recontacter. Pas de liste de diffusion." },
    ],
  },
  pro: {
    world: "academie", title: "Pro",
    subtitle: "À ce niveau, il n'y a pas d'offre standard : chaque joueuse et joueur a son calendrier, ses objectifs de classement et son encadrement. Nous construisons le programme autour de vous — jeu, corps, tête, logistique et financement.",
    hero: "assets/photos/pro-2026.jpg", heroPos: "center 42%",
    cta: { label: "Recevoir le dossier", scroll: "brochure" },
    sections: [
      { type: "keywords", label: "Ce qui fait la filière Pro", items: [
        "Programme sur mesure", "Circuit ATP / WTA", "Encadrement complet",
        "Solutions de financement", "Jusqu'à 15 semaines de tournois", "Logement à Lausanne",
      ]},
      { type: "split", photos: [
          "assets/photos/pro-2026-g1.jpg", "assets/photos/open-serve.jpg",
          // Photo verticale dans un cadre large : le cadrage vise la tête plutôt
          // que le centre. 42 % est la valeur la plus haute qui garde la tête sur mobile, où
          // le cadre est bien plus aplati (776 px d'image visibles contre 1075
          // sur grand écran) ; au-delà, la tête sort par le haut.
          { src: "assets/photos/pro-2026-court.jpg", pos: "center 42%" },
        ],
        eyebrow: "Du sur-mesure, pas un forfait", title: "Un programme construit autour de vous", body: [
          "Au niveau professionnel, deux joueurs n'ont jamais le même calendrier. L'encadrement s'adapte aux tournois, aux déplacements, aux blessures et aux objectifs de points — pas l'inverse.",
          "Coach référent, préparation physique et mentale, physiothérapie, logistique de voyage : on assemble ce dont vous avez besoin, et rien de plus.",
        ], link: { label: "Recevoir le dossier", scroll: "brochure", cta: true } },
      { type: "stats", items: [
        ["15", "semaines de tournois / an"],
        ["46", "semaines d'entraînement"],
        ["360°", "d'encadrement"],
        ["1", "programme par joueur"],
      ]},
      { type: "perks", eyebrow: "Ce que nous adaptons",
        title: "Quatre leviers, réglés à votre situation",
        lead: "Le programme se construit en entretien, puis se réajuste au fil de la saison.", items: [
          ["Le calendrier", "Construit autour de vos tournois et de vos déplacements, y compris les absences longues."],
          ["L'encadrement", "Coach référent, physique, mental et physiothérapie — selon les besoins du moment."],
          ["Les objectifs", "Points ATP ou WTA, progression au classement, préparation d'une saison ou d'un retour de blessure."],
          ["Le rythme", "Sessions ajustées à votre charge, à la récupération et aux impératifs du circuit."],
        ]},
      { type: "split", photos: ["assets/webflow/sport-studies.jpg"],
        eyebrow: "La question qu'on n'ose pas poser", title: "Une solution 360°, y compris financière", body: [
          "Le tennis professionnel coûte cher, et c'est souvent ce qui arrête les carrières avant le niveau de jeu. Nous préférons en parler dès le premier entretien.",
          "Plusieurs leviers existent au sein de l'académie pour alléger la facture — et ils se combinent.",
        ] },
      { type: "perks", eyebrow: "Des solutions de financement",
        title: "Cinq façons d'alléger la note",
        lead: "Aucune n'est automatique : elles se construisent avec vous, selon votre profil et vos disponibilités.", items: [
          ["Interclubs", "Un financement via la participation aux interclubs sous les couleurs du club."],
          ["Cours rémunérés", "Donner des cours au sein de l'académie, à un rythme compatible avec l'entraînement."],
          ["Journées GameZone", "Organiser des journées de tournoi junior, rémunérées."],
          ["Formations de coaching", "La prise en charge de formations reconnues, utiles pour l'après-carrière."],
          ["Logement", "Des solutions de logement sur Lausanne, à proximité des courts."],
        ]},
      { type: "faq", eyebrow: "Questions fréquentes",
        title: "Ce qu'il faut savoir avant d'en discuter", items: [
          ["À qui s'adresse la filière Pro ?", "Aux joueuses et joueurs qui disputent déjà des tournois internationaux et structurent leur saison autour du résultat et du classement."],
          ["Y a-t-il un tarif fixe ?", "Non, et c'est volontaire : le programme dépend du nombre de semaines sur place, de l'encadrement retenu et du calendrier. Le tarif se fixe en entretien, une fois le programme défini."],
          ["Qui paie les déplacements ?", "Les frais de voyage — vols, logement, repas et inscriptions — restent à la charge du joueur, comme partout sur le circuit. Le reste se discute."],
          ["Peut-on venir sur une partie de saison seulement ?", "Oui. Certains viennent en bloc de préparation, d'autres à l'année. Le programme s'ajuste à la durée."],
          ["Et si je me blesse ?", "Le suivi physio et médical fait partie de l'encadrement, et le programme est réajusté pendant la reprise plutôt que suspendu."],
          ["Comment commence-t-on ?", "Par un entretien. On y parle jeu, calendrier, objectifs et budget — puis on construit le programme."],
        ]},
      // Aucun tarif ici : le programme est sur mesure et se construit en
      // entretien. Le dossier ouvre la conversation.
      { type: "brochure", anchor: "brochure", sujet: "Pro",
        eyebrow: "Dossier Pro", title: "Parlons de votre saison",
        lead: "Encadrement, calendrier, logistique et solutions de financement : nous vous envoyons le dossier, puis nous prenons le temps d'en discuter et de construire le programme avec vous.",
        bouton: "Recevoir le dossier",
        mention: "Votre adresse sert uniquement à vous envoyer le dossier et à vous recontacter. Pas de liste de diffusion." },
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
      { type: "mention" },
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
          "Un entraînement régulier pour progresser à son rythme, avec la possibilité d'ajouter autant de séances hebdomadaires qu'on le souhaite.",
        ], link: { label: "Rejoindre le Club", scroll: "enroll-sec", cta: true } },
      { type: "perks", eyebrow: "Pourquoi rejoindre le Club",
        title: "Le bon équilibre entre encadrement et liberté",
        lead: "Tout est prévu pour que chacun trouve son rythme, quel que soit son niveau de départ.", items: [
          ["Quatre jeunes par coach", "Un encadrement de proximité, avec des retours immédiats sur le court."],
          ["Toute la saison", "Une heure par semaine, du 31 août 2026 au 2 juillet 2027."],
          ["Autant de séances qu'on veut", "Un deuxième, un troisième entraînement hebdomadaire : le rythme se choisit librement."],
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
                cta: { label: "Rejoindre le Club", scroll: "enroll-sec" } } },
      { type: "faq", eyebrow: "Questions fréquentes",
        title: "Tout ce qu'il faut savoir avant de commencer", items: [
          ["Faut-il déjà savoir jouer ?", "Un peu d'expérience aide, mais chacun est orienté vers le bon groupe selon son niveau, son âge et son parcours."],
          ["Comment les groupes sont-ils formés ?", "Selon l'âge, le niveau, les horaires et les besoins de chacun, pour que tout le monde s'entraîne dans le bon environnement."],
          ["À quelle fréquence s'entraîne-t-on ?", "Une heure par semaine sur le créneau choisi, et autant d'entraînements supplémentaires que souhaité."],
          ["Et la compétition ?", "Quelques compétitions au fil de la saison, selon l'envie et sans obligation. Les membres du club peuvent aussi disputer les interclubs, selon les disponibilités."],
          ["Qu'est-ce qui est compris ?", "L'entraînement encadré en groupe, le suivi de la progression tout au long de la saison, et le t-shirt Team Lausanne."],
        ]},
      { type: "enroll", title: "Demander une inscription", filiere: "club", ranking: false,
        lead: "Envie de rejoindre l'offre Club ? Remplissez ce formulaire, le secrétariat vous recontacte." },
      { type: "mention" },
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
      { type: "features", title: "Conditions", items: [
        ["Engagement", "Inscription pour l'ensemble de la saison, créneau réservé."],
        ["Absences", "Cours non remboursés, sauf blessure ou maladie de longue durée avec certificat médical : remboursement possible après 4 semaines d'absence continue."],
        ["Rattrapage", "Tous les cours — privés, semi-privés et de groupe — sont non rattrapables."],
        ["Paiement", "En 1 ou 3 fois."],
        ["Places", "Limitées, attribuées par ordre d'inscription, confirmées à réception du paiement ou du premier acompte."],
      ]},
      { type: "enroll", filiere: "adultes", adultes: true, title: "Ça m'intéresse",
        lead: "Sans engagement : indiquez la formule qui vous intéresse et vos disponibilités, le responsable des cours adultes et privés vous recontactera pour vous proposer un créneau, un coach et les tarifs." },
    ],
  },
  gamezone: {
    world: "academie", title: "Game Zone",
    subtitle: "Des tournois juniors presque tous les week-ends, sur une seule journée et deux matchs garantis. Une médaille à chaque victoire, une coupe dès la cinquième, et la grande coupe à la dixième — de quoi se lancer en compétition sans pression.",
    hero: "assets/photos/gamezone-2026.jpg", heroPos: "55% 45%",
    heroLogo: "assets/logo-gamezone-blanc.png",
    sections: [
      { type: "rich", title: "Le concept", body: [
        "Presque tous les week-ends, la Game Zone propose des tournois juniors sur une seule journée, avec deux matchs garantis par participant.",
        "Le format idéal pour se lancer en compétition et cumuler de l'expérience — et aller décrocher la grande coupe à la 10ᵉ victoire ! Une petite coupe est déjà remise dès 5 victoires, et une médaille à chaque victoire.",
      ], link: { label: "Consulter les prochains tournois ↗", href: GAMEZONE_URL } },
      { type: "gzphotos" },
      { type: "gzwinners", title: "Nos vainqueurs de la saison" },
    ],
  },
  // ---- Nos coachs ----------------------------------------------------------
  // Reprise de la page Webflow teamlausanne.webflow.io/coaches, traduite et
  // remise au gabarit du site : meme banniere, meme bandeau de mots-cles, meme
  // pied de page que Kids Tennis ou Competition. Les photos ont ete rapatriees
  // dans assets/photos/coaches/ — elles vivaient sur le CDN de Webflow, qui
  // disparaitra avec le projet.
  //
  // « Camps » devient « Stages » : c'est le mot employe partout ailleurs sur le
  // site, et les familles cherchent celui-la.
  coaches: {
    world: "academie", title: "Nos coachs",
    subtitle: "Notre équipe réunit des expériences qui couvrent le Kids Tennis, le Club, la Compétition, la Performance, le Sport-études et le Pro. Chaque coach construit un cadre où l'on progresse avec clarté, régularité et confiance.",
    hero: "assets/photos/coaches-hero.webp", heroPos: "center 35%",
    cta: { label: "Nous écrire", contact: "Nos coachs" },
    sections: [
      { type: "keywords", label: "Ce qui fait notre encadrement", items: [
        "Du Kids Tennis au Pro", "Des coachs diplômés", "Un suivi individuel",
        "Une équipe soudée", "De l'expérience internationale", "La progression avant tout",
      ]},
      { type: "coachs", eyebrow: "Notre équipe de coachs",
        title: "Une équipe tournée vers la progression",
        lead: "Nos coachs travaillent ensemble, pour que l'encadrement reste cohérent à tous les niveaux — des premières balles jusqu'au Sport-études et au Pro.",
        // La meme liste sert la page « Nos coachs » et le carrousel de
        // l'accueil : une seule source, pas deux a tenir a jour.
        items: "@coachs" },
      { type: "mention" },
    ],
  },
},

};
