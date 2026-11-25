// ===========================================================================
//  i18n.js — les libellés d'INTERFACE du site public, en deux langues
// ---------------------------------------------------------------------------
// Ici : les mots du cadre — navigation, boutons, intitulés de formulaire,
// messages d'erreur. PAS le contenu des pages : celui-là vit dans
// contenu.js (français) et contenu-en.js (anglais), parce qu'il est aussi lu
// par le chatbot comme base de connaissances.
//
// Même parti pris que open/i18n.js pour l'app du tournoi : des DONNÉES, pas
// du code. Traduire, c'est traduire du texte, pas relire un programme.
//
// RÈGLE : toute clé présente en fr doit l'être en en. La vérification tourne
// au build (build.mjs) et le fait échouer — un libellé oublié, c'est un mot
// français au milieu d'une page anglaise, et personne ne le voit avant un
// visiteur.
// ===========================================================================

export const UI = {
  fr: {
    // --- cadre général ---
    langue_nom: "Français",
    langue_code: "fr",
    langue_autre_nom: "English",
    basculer_langue: "Read this page in English",
    locale: "fr_CH",

    // --- navigation ---
    nav_club: "Club",
    nav_academie: "Academy",
    nav_tournoi: "Lausanne Open",
    nav_business: "Business & partenaires",
    nav_contact: "Contact",
    nav_reserver: "Réserver",
    nav_actualites: "Actualités",
    nav_accueil: "Accueil",
    nav_menu: "Menu",
    nav_fermer: "Fermer",
    nav_autres_pages: "Les autres pages",
    decouvrir_aussi: "Découvrir aussi",
    chemin_actualites: "/actualites",
    alt_academie: "Team Lausanne Academy, école de tennis à Lausanne",

    // --- liens et boutons récurrents ---
    en_savoir_plus: "En savoir plus",
    voir: "Voir",
    toutes_actualites: "Toutes les actualités",
    nous_ecrire: "Écrivez-nous",
    retour_accueil: "Retour à l'accueil",
    telecharger: "Télécharger",
    itineraire: "Itinéraire",

    // --- actualités ---
    actus_titre: "Actualités",
    actus_vide: "Pas encore d'article.",
    actus_lire: "Lire l'article",

    // --- page introuvable ---
    introuvable_titre: "Page introuvable",
    introuvable_texte: "n'existe pas, ou n'existe plus.",

    // --- formulaires ---
    form_nom: "Nom",
    form_email: "Email",
    form_message: "Message",
    form_envoyer: "Envoyer",
    form_envoye: "Message envoyé, merci !",
    form_erreur: "L'envoi a échoué. Réessayez, ou écrivez-nous directement.",

    // --- pied de page ---
    pied_adresse: "Route des Plaines-du-Loup 7, 1018 Lausanne",
    pied_droits: "Tous droits réservés",
    pied_confidentialite: "Confidentialité",
  },

  en: {
    // --- cadre général ---
    langue_nom: "English",
    langue_code: "en",
    langue_autre_nom: "Français",
    basculer_langue: "Lire cette page en français",
    locale: "en_GB",

    // --- navigation ---
    nav_club: "Club",
    nav_academie: "Academy",
    nav_tournoi: "Lausanne Open",
    nav_business: "Business & partners",
    nav_contact: "Contact",
    nav_reserver: "Book a court",
    nav_actualites: "News",
    nav_accueil: "Home",
    nav_menu: "Menu",
    nav_fermer: "Close",
    nav_autres_pages: "The other pages",
    decouvrir_aussi: "Also worth a look",
    // ⚠ Les actualités ne sont pas encore traduites : on renvoie vers la
    // page française plutôt que vers un /en/news qui n'existe pas. À changer
    // le jour où les articles ont leur version anglaise (champs title_en /
    // body_en dans news_articles).
    chemin_actualites: "/actualites",
    alt_academie: "Team Lausanne Academy, tennis school in Lausanne",

    // --- liens et boutons récurrents ---
    en_savoir_plus: "Find out more",
    voir: "View",
    toutes_actualites: "All news",
    nous_ecrire: "Get in touch",
    retour_accueil: "Back to the home page",
    telecharger: "Download",
    itineraire: "Directions",

    // --- actualités ---
    actus_titre: "News",
    actus_vide: "No articles yet.",
    actus_lire: "Read the article",

    // --- page introuvable ---
    introuvable_titre: "Page not found",
    introuvable_texte: "does not exist, or no longer exists.",

    // --- formulaires ---
    form_nom: "Name",
    form_email: "Email",
    form_message: "Message",
    form_envoyer: "Send",
    form_envoye: "Message sent — thank you!",
    form_erreur: "Sending failed. Please try again, or write to us directly.",

    // --- pied de page ---
    pied_adresse: "Route des Plaines-du-Loup 7, 1018 Lausanne, Switzerland",
    pied_droits: "All rights reserved",
    pied_confidentialite: "Privacy",
  },
};

/* ===========================================================================
 *  CHROME_EN — le GABARIT traduit (menu, pied de page, formulaires)
 * ---------------------------------------------------------------------------
 * index.html est écrit en français : c'est la langue du site, et le rester
 * évite de transformer chaque libellé en appel de fonction. Pour l'anglais,
 * build.mjs applique cette table au gabarit, une fois, avant d'écrire la page.
 *
 * Chaque entrée est le FRAGMENT HTML EXACT à remplacer, délimiteurs compris
 * (« >Nom</ » et non « Nom »). ⚠ C'est indispensable : « Nom » seul se
 * retrouve dans « Prénom et nom », dans des attributs et dans du texte de
 * contenu — une recherche par mot nu abîmerait la page à trois endroits
 * qu'on ne verrait pas.
 *
 * ⚠⚠ Un fragment qui ne correspond plus FAIT ÉCHOUER LE BUILD (build.mjs).
 * C'est voulu : si quelqu'un retouche le menu français sans toucher ici, la
 * page anglaise repartirait avec ce libellé en français, et personne ne le
 * verrait avant un visiteur. Mieux vaut un déploiement qui s'arrête en
 * nommant la ligne à corriger.
 *
 * NE SE TRADUISENT PAS, et c'est normal qu'ils soient absents de la table :
 * « Team Lausanne Academy », « Kids Tennis », « Club », « Performance »,
 * « Pro », « Pro U18 », « Game Zone », « Lausanne Open », « Academy »,
 * « Contact », « Email », « XL », les adresses et le compte Instagram.
 * =========================================================================== */
export const CHROME_EN = [
  // --- titre de l'onglet, repris ensuite par build.mjs page par page ---
  ["<title>École de tennis à Lausanne — Team Lausanne Academy</title>",
   "<title>Tennis school in Lausanne — Team Lausanne Academy</title>"],

  // --- barre de navigation ---
  ['aria-label="Retour à l\'accueil"', 'aria-label="Back to the home page"'],
  ['aria-label="Choisir un univers"', 'aria-label="Choose a world"'],
  [">TC Lausanne-Sports ↗<", ">TC Lausanne-Sports ↗<"],
  [">Le Club ↗<", ">The Club ↗<"],
  ['aria-label="Voir les sections de l\'Academy"', 'aria-label="See the Academy sections"'],
  ['aria-label="Les sections de l\'Academy"', 'aria-label="The Academy sections"'],
  ['aria-label="Fermer le menu"', 'aria-label="Close the menu"'],

  // --- menu Academy, colonne 1 ---
  [">Pour débuter<", ">To get started<"],
  [">4–10 ans · ouvert à tous<", ">ages 4–10 · open to all<"],
  [">Adultes et privés<", ">Adults and private<"],
  // « President's Club » et non « Circle » : nom confirmé par Raphael le
  // 25.11.2026. C'est le nom de la chose, pas une traduction à retrouver.
  // ⚠ Le lien AUTANT que le libellé, comme pour « Confidentialité » : la
  // version anglaise de la page vit à /en/presidents-club.
  ['<a class="swm-l" href="/cercle-du-president"><span class="swm-n">Cercle du Président</span>',
   '<a class="swm-l" href="/en/presidents-club"><span class="swm-n">President\'s Club</span>'],
  ['<a class="sw" href="/cercle-du-president">', '<a class="sw" href="/en/presidents-club">'],
  [">réseautage · vendredi matin<", ">networking · Friday morning<"],
  // ⚠ PAS « The Club » ici, même si le nom complet est « President's Club » :
  // ce libellé court voisine dans la barre avec « The Club ↗ », qui désigne
  // le TC Lausanne-Sports. Deux boutons côte à côte portant le même mot pour
  // deux choses différentes — vu à l'écran, corrigé aussitôt.
  [">Le Cercle<", ">President's<"],

  // --- menu Academy, colonne 2 ---
  [">Pour progresser et jouer<", ">To improve and compete<"],
  [">Compétition<", ">Competition<"],
  [">≈ 10–13 ans · 16 places<", ">approx. ages 10–13 · 16 places<"],
  [">≈ 12–15 ans · 8 places<", ">approx. ages 12–15 · 8 places<"],
  [">Stages<", ">Camps<"],
  [">vacances scolaires<", ">school holidays<"],
  [">tournois juniors<", ">junior tournaments<"],
  [">tous niveaux<", ">all levels<"],

  // --- menu Academy, colonne 3 ---
  [">Pour viser haut<", ">To aim high<"],
  [">Sport-études<", ">Sport Studies<"],
  [">14–19 ans · places limitées<", ">ages 14–19 · limited places<"],
  [">après la scolarité<", ">after compulsory school<"],
  [">dès 18 ans<", ">from age 18<"],

  // --- menu Academy, colonne 4 ---
  [">L'académie<", ">The academy<"],
  [">Accueil de l'Academy<", ">Academy home<"],
  [">la vue d'ensemble<", ">the whole picture<"],
  [">Nos coachs<", ">Our coaches<"],
  [">l'équipe d'encadrement<", ">the coaching team<"],
  [">Actualités<", ">News<"],
  [">le journal du club<", ">the club journal<"],
  [">Le calendrier<", ">The calendar<"],
  [">vacances, stages, fermetures<", ">holidays, camps, closures<"],
  [">Nous écrire<", ">Get in touch<"],
  [">une question, un essai<", ">a question, a trial lesson<"],

  // --- hero ---
  [">Changez d'univers ↑<", ">Switch world ↑<"],

  // --- formulaire de contact + plan ---
  // ⚠ Pas d'entrée pour « <h2>Nous écrire</h2> » : la paire générique
  // « >Nous écrire< » passe avant et l'a déjà traduit. En ajouter une seconde
  // ferait échouer la vérification sur un fragment qui n'existe plus.
  // ⚠ Jamais de recherche À TRAVERS un saut de ligne : l'indentation du
  // gabarit changerait un jour, et la règle cesserait de correspondre. Une
  // phrase coupée en deux lignes se traduit donc en deux fragments.
  [">Une question sur l'Academy —", ">A question about the Academy —"],
  ["écrivez-nous, nous répondons rapidement.</p>", "write to us, we answer quickly.</p>"],
  [">Ne pas remplir : <", ">Do not fill in: <"],
  [">Prénom et nom *<", ">First name and surname *<"],
  [">E-mail *<", ">Email *<"],
  [">Message *<", ">Message *<"],
  [">Envoyer<", ">Send<"],
  ["<h2>Où nous trouver</h2>", "<h2>Where to find us</h2>"],
  ['title="Plan d acces — Route des Plaines-du-Loup 7, 1018 Lausanne"',
   'title="Directions — Route des Plaines-du-Loup 7, 1018 Lausanne"'],

  // --- partenaires et réseaux ---
  [">Nos partenaires officiels<", ">Our official partners<"],
  [">Suivez-nous<", ">Follow us<"],
  // ⚠ Sans point final : c'est un titre, et aucun autre titre du site n'en
  // porte (« Où nous trouver », « Un lieu, trois mondes »). Raphael l'avait
  // écrit avec — à remettre d'un mot si c'est voulu.
  ["<h2>Le club, au jour le jour</h2>", "<h2>A day in the life at Team Lausanne</h2>"],
  [">Entraînements, tournois, vie du club — tout se passe sur Instagram.<",
   ">Training, tournaments, club life — it all happens on Instagram.<"],
  [">Lausanne, Suisse<", ">Lausanne, Switzerland<"],
  [">SUIVEZ-NOUS<", ">FOLLOW US<"],
  ['aria-label="Photos precedentes"', 'aria-label="Previous photos"'],
  ['aria-label="Photos suivantes"', 'aria-label="Next photos"'],

  // --- pied de page ---
  ["<h2>Un lieu, trois mondes</h2>", "<h2>One place, three worlds</h2>"],
  [">Tout se joue au même endroit, aux Plaines-du-Loup à Lausanne.",
   ">It all happens in one place, at the Plaines-du-Loup in Lausanne."],
  // Les trois verbes sont ceux des trois marches juste en dessous — Play,
  // Progress, Enjoy. La phrase les reprend mot pour mot, sinon le texte
  // annonce une chose et les pastilles en disent une autre.
  ["Le club où l'on joue, l'academy où l'on progresse, le tournoi où l'on vibre.</p>",
   "The club where you play, the academy where you progress, the tournament where you enjoy it.</p>"],
  // Les trois marches du parcours, mots donnés par Raphael : un verbe nu,
  // comme le slogan « Play. Progress. Together. » qu'elles reprennent.
  ["<h3>On joue</h3>", "<h3>Play</h3>"],
  ["<h3>On progresse</h3>", "<h3>Progress</h3>"],
  ["<h3>On vibre</h3>", "<h3>Enjoy</h3>"],
  [">Un lieu, plusieurs mondes<", ">One place, several worlds<"],
  [">Jouer. Grandir. Vibrer. Ensemble.<", ">Play. Grow. Enjoy. Together.<"],
  ["© 2026 Team Lausanne — Club · Academy · Tournoi", "© 2026 Team Lausanne — Club · Academy · Tournament"],
  // ⚠ Le LIEN autant que le libellé : traduire « Confidentialité » en
  // « Privacy » sans changer le href aurait envoyé l'anglophone sur la
  // politique française. Un mot anglais menant à une page française est pire
  // qu'un mot français, parce qu'il ne prévient pas.
  ['<a href="/confidentialite">Confidentialité</a>', '<a href="/en/privacy">Privacy</a>'],

  // --- visionneuse et plan des courts ---
  ['aria-label="Photo en grand"', 'aria-label="Photo enlarged"'],
  ['aria-label="Photo précédente"', 'aria-label="Previous photo"'],
  ['aria-label="Photo suivante"', 'aria-label="Next photo"'],
  ['alt="Plan des courts — Team Lausanne, Plaines-du-Loup"',
   'alt="Court map — Team Lausanne, Plaines-du-Loup"'],

  // --- inscription à un stage ---
  // ⚠ Sans le « < » final : ces libellés de <label> sont suivis d'un retour à
  // la ligne, pas d'une balise fermante.
  [">Catégorie de stage", ">Camp category"],
  [">Prénom<", ">First name<"],
  [">Nom<", ">Surname<"],
  [">Date de naissance<", ">Date of birth<"],
  [">Taille de t-shirt (offert)", ">T-shirt size (free)"],
  [">— choisir —<", ">— choose —<"],
  [">4-6 ans<", ">4-6 years<"],
  [">8-10 ans<", ">8-10 years<"],
  [">12-14 ans<", ">12-14 years<"],
  [">Restriction / allergie alimentaire<", ">Dietary restriction / allergy<"],
  // ⚠ L'espace de tête compte : ces deux libellés suivent un <input radio />.
  ["> Aucune<", "> None<"],
  ["> À préciser :<", "> Please specify:<"],
  ['placeholder="Allergie, régime…"', 'placeholder="Allergy, diet…"'],
  [">Classement tennis", ">Tennis ranking"],
  ['placeholder="ex. R4, N3, sans classement…"', 'placeholder="e.g. R4, N3, unranked…"'],
  [">L'horaire des 3h de tennis privé sera communiqué le premier jour du stage.<",
   ">The timing of the 3h of private tennis will be given on the first day of the camp.<"],
  [">Commentaire (optionnel)<", ">Comment (optional)<"],
  [">Envoyer mon inscription<", ">Send my registration<"],
  [">Inscription reçue, merci !<", ">Registration received — thank you!<"],
  [">Tu recevras un email de confirmation avec la facture. À très bientôt !<",
   ">You will receive a confirmation email with the invoice. See you very soon!<"],

  // --- fermer (plusieurs boutons portent le même libellé) ---
  ['aria-label="Fermer"', 'aria-label="Close"'],

  /* --- Données structurées du site (JSON-LD) -----------------------------
   * Invisibles pour un lecteur, et c'est précisément pourquoi elles se
   * seraient fait oublier : ce sont elles que lisent EN PREMIER les
   * résultats enrichis de Google et les moteurs de réponse (ChatGPT,
   * Perplexity, Claude). Laissées en français, elles auraient fait décrire
   * l'académie en français à un visiteur anglophone qui pose la question à
   * une IA — soit exactement le public qu'on cherche à atteindre.
   * ⚠ Seuls les CHAMPS DE TEXTE sont traduits. Les @type, les adresses, les
   * coordonnées et les URL sont du vocabulaire schema.org ou des données :
   * les toucher casserait le balisage. */
  // ⚠ Avec « "name": » devant : « Compétition » et « Sport-études » sont déjà
  // traduits ailleurs sous la forme « >Compétition< » (le menu). Sans ce
  // préfixe, la règle du menu passerait d'abord et celle-ci ne trouverait
  // plus rien — ou, pire, toucherait un texte de contenu.
  ['"name": "Compétition"', '"name": "Competition"'],
  ['"name": "Sport-études"', '"name": "Sport Studies"'],
  ["École de tennis Team Lausanne", "Team Lausanne tennis school"],
  ["Centre de formation de tennis du TC Lausanne-Sports, aux Plaines-du-Loup à Lausanne. École de tennis dès 4 ans, filières compétition et performance, sport-études, programmes Pro U18 et Pro, cours adultes et stages. 12 courts en été, dont 6 couverts en hiver. Organisateur du Lausanne Open (ITF M25).",
   "The tennis training centre of TC Lausanne-Sports, at the Plaines-du-Loup in Lausanne. Tennis school from age 4, competition and performance pathways, sport studies, Pro U18 and Pro programmes, adult lessons and camps. 12 courts in summer, 6 of them covered in winter. Host of the Lausanne Open (ITF M25)."],
  ["Jouer. Progresser. Ensemble.", "Play. Progress. Together."],
  ["Courts de tennis (été)", "Tennis courts (summer)"],
  ["Courts couverts (hiver, mi-octobre à mi-avril)", "Covered courts (winter, mid-October to mid-April)"],
  ["Lausanne Open — tournoi ITF M25 organisé par Team Lausanne",
   "Lausanne Open — ITF M25 tournament hosted by Team Lausanne"],
  ["Les programmes de Team Lausanne Academy", "Team Lausanne Academy programmes"],
  ["Le tennis dès 4 ans, dans un cadre ludique, structuré et bienveillant.",
   "Tennis from age 4, in a playful, structured and supportive setting."],
  ["Une à deux fois par semaine, pour progresser à son rythme et prendre du plaisir.",
   "Once or twice a week, to improve at your own pace and enjoy it."],
  ["Cours adultes et privés", "Adult and private lessons"],
  ["Cours privés, semi-privés et de groupe, adaptés à votre rythme.",
   "Private, semi-private and group lessons, suited to your pace."],
  ["Entraînement structuré et matchs, pour les jeunes prêts à passer un cap. Seize places.",
   "Structured training and matches, for young players ready to step up. Sixteen places."],
  ["Le lien entre la Compétition et le Sport-études : charge d'entraînement renforcée, préparation physique intégrée. Huit places.",
   "The link between Competition and Sport Studies: a heavier training load, physical preparation built in. Eight places."],
  ["Deux heures de tennis, une heure de préparation physique et quatre heures de cours par jour, avec l'Institut DOMI, l'EPSU ou le CNED. Maturité fédérale suisse ou baccalauréat français.",
   "Two hours of tennis, one hour of physical preparation and four hours of lessons a day, with Institut DOMI, EPSU or CNED. Swiss federal maturité or French baccalauréat."],
  ["L'entraînement devient le métier : deux sessions par jour et le circuit.",
   "Training becomes the job: two sessions a day and the circuit."],
  ["Pas d'offre standard : un calendrier, des objectifs et un encadrement sur mesure, dès 18 ans.",
   "No standard offer: a tailored calendar, tailored goals and tailored support, from age 18."],
  ["Stages de tennis", "Tennis camps"],
  ["Pendant les vacances scolaires, de la découverte ludique à la semaine intensive, pour les 4 à 18 ans et pour les adultes.",
   "During the school holidays, from playful discovery to an intensive week, for ages 4 to 18 and for adults."],
  ["Des tournois juniors presque chaque week-end, sur une journée, deux matchs garantis.",
   "Junior tournaments almost every weekend, over a single day, two matches guaranteed."],
];

// Le libellé, avec repli sur le français plutôt que sur une chaîne vide : un
// mot français sur une page anglaise se voit et se corrige ; un trou, non.
export const t = (lang, cle) => (UI[lang] && UI[lang][cle]) || UI.fr[cle] || "";

// Les clés manquantes d'une langue. build.mjs s'en sert pour échouer fort.
export function clesManquantes(lang) {
  const ref = Object.keys(UI.fr);
  return ref.filter((k) => !(k in (UI[lang] || {})));
}
