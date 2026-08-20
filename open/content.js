// =====================================================================
//  Contenu des pages « Welcome », en 5 langues.
//  Volontairement écrit en DONNÉES (titres, listes, paires clé/valeur)
//  et pas en HTML : le HTML est fabriqué une seule fois dans app.js, donc
//  traduire = traduire du texte, jamais du balisage.
//  Pour corriger un texte, c'est ici et nulle part ailleurs.
// =====================================================================

export const MAPS_CLUB =
  "https://www.google.com/maps/search/?api=1&query=Route+des+Plaines-du-Loup+7+1018+Lausanne";
export const ITF_URL =
  "https://www.itftennis.com/en/tournament/m25-lausanne/sui/2026/m-itf-sui-2026-004/";

/* Photos : open/assets/visit/. Une carte sans photo affiche un dégradé
   avec son icône en filigrane — rien ne casse si le fichier manque. */

export const WELCOME = {

/* ==================================================================== EN */
en: {
  city: {
    photo: "hero",
    hero: { title: "Welcome to Lausanne",
      text: "The Olympic Capital — a city of hills between Lake Geneva and the vineyards, and the home of the Lausanne Open.",
      badges: [] },
    cards: [
      { icon: "city", title: "The city in short", list: [
        "Capital of the canton of Vaud, around 140,000 inhabitants — the fourth largest city in Switzerland.",
        "Home of the <b>International Olympic Committee</b> since 1915, hence the name «&nbsp;Olympic Capital&nbsp;».",
        "Built on steep hills between the lake (373&nbsp;m) and the forest above (about 700&nbsp;m). Expect stairs.",
        "The old town is dominated by the <b>Gothic cathedral</b>. Every night between 22:00 and 02:00 a watchman still calls out the hours from the belfry — a tradition kept alive since 1405.",
        "French is the local language. English is widely spoken, especially by younger people.",
      ]},
      { icon: "metro", title: "Getting around", list: [
        "The <b>m2 metro</b> is the only metro in Switzerland — it climbs from Ouchy on the lakefront up through the city centre.",
        "Ask at your hotel reception for the free <b>Lausanne Transport Card</b> — hotel guests normally travel free on buses and metro.",
        "Taxis are expensive. Uber operates in the city.",
        "The club is at the <b>Plaines-du-Loup</b>, north of the centre — bus lines serve the Pontaise stadium.",
      ]},
    ],
  },
  swiss: { cards: [
    { icon: "swiss", title: "Practical Switzerland", kv: [
      ["Currency", "Swiss franc (CHF)"], ["Cards", "Accepted almost everywhere"],
      ["Power", "230 V · plug type J"], ["Language", "French"], ["Time zone", "CET / CEST"] ]},
    { icon: "bulb", title: "Small things that help", list: [
      "<b>Cash:</b> you will rarely need it. Contactless card and phone payment work everywhere. Euros are sometimes accepted, but change comes in CHF.",
      "<b>Plugs:</b> Swiss sockets are type J. A standard European two-pin plug fits without an adapter; a three-pin one does <i>not</i>.",
      "<b>Water:</b> tap water is drinkable everywhere, including the street fountains. Fill your bottle.",
      "<b>Tipping:</b> service is included. No tip is expected — rounding up is a friendly gesture, nothing more.",
      "<b>Shops</b> close around 18:30–19:00 and on Sundays. The shops inside the main train station are the exception.",
    ]},
    { icon: "phone", title: "Emergency numbers", kv: [
      ["Ambulance", "144"], ["Police", "117"], ["Fire", "118"], ["European emergency", "112"] ],
      note: "For anything medical during the tournament, speak to the tournament office first — a physiotherapist is on site during play." },
  ]},
  club: { cards: [
    { icon: "racket", title: "Lausanne-Sports Tennis",
      text: "The tournament is hosted by <b>Lausanne-Sports Tennis</b>, the historic tennis club of the city, founded in <b>1911</b> and established next to the Pontaise stadium since 1954.",
      kv: [["Address", "Route des Plaines-du-Loup 7<br>1018 Lausanne"], ["Courts", "12 (10 outdoor · 2 indoor)"]],
      link: { href: MAPS_CLUB, label: "Open in Maps ↗" } },
    { icon: "utensils", title: "Club-house & restaurant",
      text: "The club-house and its restaurant are open to players all week. A dedicated players menu is served during the tournament — see the <b>Stay</b> tab." },
  ]},
  academy: { cards: [
    { icon: "trend", title: "Team Lausanne Academy",
      text: "Team Lausanne is the performance academy based at the same site. It takes players from the first steps on court all the way to the professional circuit.",
      list: [
        "<b>Sport-études</b> — school and tennis combined, with academic supervision on site.",
        "<b>Pro U18</b> — full-time training built around the ITF junior circuit, with several weeks of tournaments abroad each year.",
        "<b>Elite</b> — individual programmes for players on the professional circuit: training, physical and mental preparation, physiotherapy, travel logistics.",
      ]},
  ]},
  open: {
    hero: { title: "Lausanne Open 2026",
      text: "The only international men's tennis tournament in the canton of Vaud. Professional tennis, at home, at the Plaines-du-Loup.",
      badges: ["ITF M25", "23–30 August 2026", "$30,000", "Free entry"] },
    cards: [
      { icon: "trophy", title: "2025 champions", kv: [
        ["Singles", "🇨🇭 Henry Bernet"], ["Doubles", "🇮🇪 Charles Barry<br>🇫🇷 Max Westphal"] ]},
      { icon: "calendar", title: "Around the tournament", list: [
        "Entry is <b>free all week</b>, no ticket needed — invite whoever you like.",
        "School initiations, the Team Lausanne day on Saturday, and VIP lunches run alongside the draw.",
        "Draws, results and live scores are on the ITF website.",
      ], link: { href: ITF_URL, label: "ITF tournament page ↗" } },
    ],
  },
  visit: { cards: [
    { photo: "olympic", icon: "medal", title: "The Olympic Museum",
      text: "The obvious one, and genuinely good. On the lakefront in Ouchy, ten minutes from the centre by the m2 metro. The park and the terrace café are free even if you skip the museum." },
    { photo: "cathedral", icon: "church", title: "Cathedral & old town",
      text: "The 13th-century cathedral sits at the top of the old town — climb the tower for the best view over the lake and the Alps. Below it, narrow streets and Place de la Palud with its Saturday market." },
    { photo: "hero", icon: "waves", title: "Ouchy & the lake",
      text: "The lakefront promenade is where Lausanne goes to breathe. Swim, paddle, or take a <b>CGN boat</b> — a beautiful ride across to Évian in France (bring your passport or ID)." },
    { photo: "lavaux", icon: "wine", title: "Lavaux vineyards",
      text: "Twenty minutes east by train: terraced vineyards climbing from the water, a UNESCO World Heritage site. Get off at Cully or Rivaz and walk between the villages. The best afternoon you can have here." },
    { photo: "chillon", icon: "castle", title: "Chillon Castle",
      text: "One hour by train, near Montreux: a medieval castle standing on a rock in the lake. Worth the trip on a rest day." },
    { photo: "sauvabelin", icon: "tree", title: "Sauvabelin & Plateforme 10",
      text: "Above the city, the Sauvabelin lake and its wooden tower — 302 steps, a full view of the lake and the Alps. Next to the train station, <b>Plateforme 10</b> gathers three art museums in one modern district." },
    { photo: "evening.webp", icon: "moon", title: "In the evening",
      text: "The <b>Flon</b> district — a former warehouse quarter turned into bars, restaurants and cinemas — is where the city goes out. Ten minutes on foot from the station." },
  ]},
},

/* ==================================================================== FR */
fr: {
  city: {
    photo: "hero",
    hero: { title: "Bienvenue à Lausanne",
      text: "La Capitale olympique — une ville de collines entre le Léman et les vignes, et le port d'attache du Lausanne Open.",
      badges: [] },
    cards: [
      { icon: "city", title: "La ville en bref", list: [
        "Chef-lieu du canton de Vaud, environ 140 000 habitants — quatrième ville de Suisse.",
        "Siège du <b>Comité International Olympique</b> depuis 1915, d'où le nom de «&nbsp;Capitale olympique&nbsp;».",
        "Bâtie sur des collines raides entre le lac (373&nbsp;m) et la forêt (environ 700&nbsp;m). Prévois des escaliers.",
        "La vieille ville est dominée par la <b>cathédrale gothique</b>. Chaque nuit, entre 22h et 2h, un guetteur crie encore les heures du haut du beffroi — une tradition maintenue depuis 1405.",
        "On parle français. L'anglais est très répandu, surtout chez les jeunes.",
      ]},
      { icon: "metro", title: "Se déplacer", list: [
        "Le <b>métro m2</b> est le seul métro de Suisse — il grimpe d'Ouchy, au bord de l'eau, jusqu'au centre-ville.",
        "Demande à la réception de ton hôtel la <b>Lausanne Transport Card</b> gratuite — les clients des hôtels voyagent gratuitement en bus et métro.",
        "Les taxis sont chers. Uber fonctionne en ville.",
        "Le club est aux <b>Plaines-du-Loup</b>, au nord du centre — des lignes de bus desservent le stade de la Pontaise.",
      ]},
    ],
  },
  swiss: { cards: [
    { icon: "swiss", title: "La Suisse en pratique", kv: [
      ["Monnaie", "Franc suisse (CHF)"], ["Cartes", "Acceptées presque partout"],
      ["Électricité", "230 V · prise type J"], ["Langue", "Français"], ["Fuseau", "CET / CEST"] ]},
    { icon: "bulb", title: "Ce qui aide vraiment", list: [
      "<b>Espèces :</b> tu n'en auras presque jamais besoin. Le sans-contact fonctionne partout. Les euros sont parfois acceptés, mais la monnaie est rendue en CHF.",
      "<b>Prises :</b> le type J suisse. Une fiche européenne à 2 broches rentre sans adaptateur ; une fiche à 3 broches <i>non</i>.",
      "<b>Eau :</b> l'eau du robinet se boit partout, y compris aux fontaines de rue. Remplis ta gourde.",
      "<b>Pourboire :</b> le service est compris. Aucun pourboire n'est attendu — arrondir est un simple geste.",
      "<b>Les magasins</b> ferment vers 18h30–19h et le dimanche. Ceux de la gare font exception.",
    ]},
    { icon: "phone", title: "Numéros d'urgence", kv: [
      ["Ambulance", "144"], ["Police", "117"], ["Pompiers", "118"], ["Urgence européenne", "112"] ],
      note: "Pour tout problème médical pendant le tournoi, passe d'abord par le bureau du tournoi — un physiothérapeute est sur place pendant les matchs." },
  ]},
  club: { cards: [
    { icon: "racket", title: "Lausanne-Sports Tennis",
      text: "Le tournoi est organisé par le <b>Lausanne-Sports Tennis</b>, le club historique de la ville, fondé en <b>1911</b> et installé à côté du stade de la Pontaise depuis 1954.",
      kv: [["Adresse", "Route des Plaines-du-Loup 7<br>1018 Lausanne"], ["Courts", "12 (10 extérieurs · 2 couverts)"]],
      link: { href: MAPS_CLUB, label: "Ouvrir dans Maps ↗" } },
    { icon: "utensils", title: "Club-house & restaurant",
      text: "Le club-house et son restaurant sont ouverts aux joueurs toute la semaine. Un menu joueurs est servi pendant le tournoi — voir l'onglet <b>Séjour</b>." },
  ]},
  academy: { cards: [
    { icon: "trend", title: "Team Lausanne Academy",
      text: "Team Lausanne est l'académie de performance installée sur le même site. Elle accompagne les joueurs des premiers pas sur le court jusqu'au circuit professionnel.",
      list: [
        "<b>Sport-études</b> — école et tennis combinés, avec un encadrement scolaire sur place.",
        "<b>Pro U18</b> — entraînement à plein temps construit autour du circuit ITF junior, avec plusieurs semaines de tournois à l'étranger chaque année.",
        "<b>Élite</b> — programmes individuels pour les joueurs du circuit professionnel : entraînement, préparation physique et mentale, physiothérapie, logistique.",
      ]},
  ]},
  open: {
    hero: { title: "Lausanne Open 2026",
      text: "L'unique tournoi international de tennis masculin du canton de Vaud. Le circuit professionnel, chez nous, aux Plaines-du-Loup.",
      badges: ["ITF M25", "23–30 août 2026", "30 000 $", "Entrée libre"] },
    cards: [
      { icon: "trophy", title: "Vainqueurs 2025", kv: [
        ["Simple", "🇨🇭 Henry Bernet"], ["Double", "🇮🇪 Charles Barry<br>🇫🇷 Max Westphal"] ]},
      { icon: "calendar", title: "Autour du tournoi", list: [
        "L'entrée est <b>gratuite toute la semaine</b>, sans billet — invite qui tu veux.",
        "Initiations pour les écoles, Journée Team Lausanne le samedi et déjeuners VIP accompagnent le tableau.",
        "Tableaux, résultats et scores en direct sont sur le site de l'ITF.",
      ], link: { href: ITF_URL, label: "Page ITF du tournoi ↗" } },
    ],
  },
  visit: { cards: [
    { photo: "olympic", icon: "medal", title: "Le Musée Olympique",
      text: "L'évidence, et il est vraiment bien. Au bord de l'eau à Ouchy, à dix minutes du centre par le m2. Le parc et la terrasse sont gratuits même sans visiter le musée." },
    { photo: "cathedral", icon: "church", title: "Cathédrale & vieille ville",
      text: "La cathédrale du XIIIᵉ siècle domine la vieille ville — monte à la tour pour la plus belle vue sur le lac et les Alpes. En dessous, les ruelles et la place de la Palud avec son marché du samedi." },
    { photo: "hero", icon: "waves", title: "Ouchy & le lac",
      text: "La promenade du bord du lac, c'est là que Lausanne respire. Baignade, paddle, ou un <b>bateau CGN</b> — une belle traversée jusqu'à Évian, en France (passeport ou carte d'identité)." },
    { photo: "lavaux", icon: "wine", title: "Les vignes de Lavaux",
      text: "Vingt minutes à l'est en train : des terrasses de vignes qui montent depuis l'eau, classées au patrimoine mondial de l'UNESCO. Descends à Cully ou Rivaz et marche entre les villages. Le plus bel après-midi d'ici." },
    { photo: "chillon", icon: "castle", title: "Le château de Chillon",
      text: "Une heure de train, près de Montreux : un château médiéval posé sur un rocher dans le lac. Le déplacement vaut le coup un jour sans match." },
    { photo: "sauvabelin", icon: "tree", title: "Sauvabelin & Plateforme 10",
      text: "Au-dessus de la ville, le lac de Sauvabelin et sa tour en bois — 302 marches, vue complète sur le lac et les Alpes. À côté de la gare, <b>Plateforme 10</b> réunit trois musées d'art dans un quartier moderne." },
    { photo: "evening.webp", icon: "moon", title: "Le soir",
      text: "Le <b>Flon</b> — ancien quartier d'entrepôts devenu bars, restaurants et cinémas — c'est là que la ville sort. Dix minutes à pied de la gare." },
  ]},
},

/* ==================================================================== DE */
de: {
  city: {
    photo: "hero",
    hero: { title: "Willkommen in Lausanne",
      text: "Die Olympische Hauptstadt — eine Stadt der Hügel zwischen Genfersee und Rebbergen, und die Heimat des Lausanne Open.",
      badges: [] },
    cards: [
      { icon: "city", title: "Die Stadt in Kürze", list: [
        "Hauptort des Kantons Waadt, rund 140 000 Einwohner — die viertgrösste Stadt der Schweiz.",
        "Sitz des <b>Internationalen Olympischen Komitees</b> seit 1915, daher der Name «&nbsp;Olympische Hauptstadt&nbsp;».",
        "Auf steilen Hügeln gebaut, zwischen See (373&nbsp;m) und Wald (rund 700&nbsp;m). Rechne mit Treppen.",
        "Über der Altstadt steht die <b>gotische Kathedrale</b>. Jede Nacht zwischen 22 und 2 Uhr ruft ein Türmer noch immer die Stunden vom Glockenturm — eine Tradition seit 1405.",
        "Gesprochen wird Französisch. Englisch ist weit verbreitet, vor allem bei Jüngeren.",
      ]},
      { icon: "metro", title: "Unterwegs", list: [
        "Die <b>Metro m2</b> ist die einzige U-Bahn der Schweiz — sie steigt von Ouchy am Seeufer bis ins Stadtzentrum.",
        "Frag an der Hotelrezeption nach der kostenlosen <b>Lausanne Transport Card</b> — Hotelgäste fahren mit Bus und Metro gratis.",
        "Taxis sind teuer. Uber ist in der Stadt verfügbar.",
        "Der Club liegt bei den <b>Plaines-du-Loup</b>, nördlich des Zentrums — Buslinien bedienen das Pontaise-Stadion.",
      ]},
    ],
  },
  swiss: { cards: [
    { icon: "swiss", title: "Die Schweiz praktisch", kv: [
      ["Währung", "Schweizer Franken (CHF)"], ["Karten", "Fast überall akzeptiert"],
      ["Strom", "230 V · Stecker Typ J"], ["Sprache", "Französisch"], ["Zeitzone", "CET / CEST"] ]},
    { icon: "bulb", title: "Kleine Dinge, die helfen", list: [
      "<b>Bargeld:</b> brauchst du kaum. Kontaktlos zahlen funktioniert überall. Euro werden manchmal akzeptiert, Rückgeld gibt es in CHF.",
      "<b>Stecker:</b> Schweizer Typ J. Ein europäischer Zweipol-Stecker passt ohne Adapter, ein Dreipol-Stecker <i>nicht</i>.",
      "<b>Wasser:</b> Leitungswasser ist überall trinkbar, auch an den Strassenbrunnen. Füll deine Flasche.",
      "<b>Trinkgeld:</b> Service ist inbegriffen. Trinkgeld wird nicht erwartet — Aufrunden ist eine nette Geste, mehr nicht.",
      "<b>Läden</b> schliessen gegen 18:30–19:00 Uhr und sonntags. Die Läden im Hauptbahnhof sind die Ausnahme.",
    ]},
    { icon: "phone", title: "Notrufnummern", kv: [
      ["Ambulanz", "144"], ["Polizei", "117"], ["Feuerwehr", "118"], ["Europäischer Notruf", "112"] ],
      note: "Bei medizinischen Fragen während des Turniers zuerst zum Turnierbüro — während der Spiele ist ein Physiotherapeut vor Ort." },
  ]},
  club: { cards: [
    { icon: "racket", title: "Lausanne-Sports Tennis",
      text: "Das Turnier wird vom <b>Lausanne-Sports Tennis</b> organisiert, dem historischen Tennisclub der Stadt, <b>1911</b> gegründet und seit 1954 neben dem Pontaise-Stadion.",
      kv: [["Adresse", "Route des Plaines-du-Loup 7<br>1018 Lausanne"], ["Plätze", "12 (10 draussen · 2 Halle)"]],
      link: { href: MAPS_CLUB, label: "In Maps öffnen ↗" } },
    { icon: "utensils", title: "Clubhaus & Restaurant",
      text: "Clubhaus und Restaurant stehen den Spielern die ganze Woche offen. Während des Turniers gibt es ein eigenes Spielermenü — siehe Reiter <b>Aufenthalt</b>." },
  ]},
  academy: { cards: [
    { icon: "trend", title: "Team Lausanne Academy",
      text: "Team Lausanne ist die Leistungsakademie am selben Standort. Sie begleitet Spieler von den ersten Schritten auf dem Platz bis auf die Profitour.",
      list: [
        "<b>Sport-études</b> — Schule und Tennis kombiniert, mit schulischer Betreuung vor Ort.",
        "<b>Pro U18</b> — Vollzeittraining rund um die ITF-Junioren-Tour, mit mehreren Turnierwochen im Ausland pro Jahr.",
        "<b>Elite</b> — individuelle Programme für Spieler auf der Profitour: Training, physische und mentale Vorbereitung, Physiotherapie, Reiselogistik.",
      ]},
  ]},
  open: {
    hero: { title: "Lausanne Open 2026",
      text: "Das einzige internationale Herrenturnier im Kanton Waadt. Profitennis, bei uns, an den Plaines-du-Loup.",
      badges: ["ITF M25", "23.–30. August 2026", "30 000 $", "Freier Eintritt"] },
    cards: [
      { icon: "trophy", title: "Sieger 2025", kv: [
        ["Einzel", "🇨🇭 Henry Bernet"], ["Doppel", "🇮🇪 Charles Barry<br>🇫🇷 Max Westphal"] ]},
      { icon: "calendar", title: "Rund um das Turnier", list: [
        "Der Eintritt ist die <b>ganze Woche frei</b>, ohne Ticket — lade ein, wen du willst.",
        "Schnupperkurse für Schulen, der Team-Lausanne-Tag am Samstag und VIP-Lunches begleiten das Tableau.",
        "Tableaus, Resultate und Livescores gibt es auf der ITF-Website.",
      ], link: { href: ITF_URL, label: "ITF-Turnierseite ↗" } },
    ],
  },
  visit: { cards: [
    { photo: "olympic", icon: "medal", title: "Das Olympische Museum",
      text: "Das Naheliegende — und wirklich gut. Am Seeufer in Ouchy, zehn Minuten vom Zentrum mit der m2. Park und Terrassencafé sind gratis, auch ohne Museumsbesuch." },
    { photo: "cathedral", icon: "church", title: "Kathedrale & Altstadt",
      text: "Die Kathedrale aus dem 13. Jahrhundert krönt die Altstadt — steig auf den Turm für die beste Sicht über See und Alpen. Darunter enge Gassen und die Place de la Palud mit ihrem Samstagsmarkt." },
    { photo: "hero", icon: "waves", title: "Ouchy & der See",
      text: "Die Uferpromenade ist Lausannes Luftholen. Schwimmen, Paddeln, oder ein <b>CGN-Schiff</b> nehmen — eine schöne Fahrt hinüber nach Évian in Frankreich (Ausweis mitnehmen)." },
    { photo: "lavaux", icon: "wine", title: "Die Rebberge von Lavaux",
      text: "Zwanzig Minuten östlich mit dem Zug: Rebterrassen, die vom Wasser aufsteigen — UNESCO-Welterbe. Steig in Cully oder Rivaz aus und wandere von Dorf zu Dorf. Der schönste Nachmittag hier." },
    { photo: "chillon", icon: "castle", title: "Schloss Chillon",
      text: "Eine Zugstunde entfernt, bei Montreux: eine mittelalterliche Burg auf einem Felsen im See. An einem spielfreien Tag lohnt sich die Fahrt." },
    { photo: "sauvabelin", icon: "tree", title: "Sauvabelin & Plateforme 10",
      text: "Über der Stadt der Sauvabelin-See mit seinem Holzturm — 302 Stufen, freie Sicht auf See und Alpen. Beim Bahnhof vereint <b>Plateforme 10</b> drei Kunstmuseen in einem modernen Quartier." },
    { photo: "evening.webp", icon: "moon", title: "Am Abend",
      text: "Das <b>Flon</b> — ein ehemaliges Lagerhausquartier, heute Bars, Restaurants und Kinos — ist Lausannes Ausgehviertel. Zehn Gehminuten vom Bahnhof." },
  ]},
},

/* ==================================================================== IT */
it: {
  city: {
    photo: "hero",
    hero: { title: "Benvenuti a Losanna",
      text: "La Capitale olimpica — una città di colline tra il Lago Lemano e i vigneti, e la casa del Lausanne Open.",
      badges: [] },
    cards: [
      { icon: "city", title: "La città in breve", list: [
        "Capoluogo del Canton Vaud, circa 140 000 abitanti — quarta città della Svizzera.",
        "Sede del <b>Comitato Olimpico Internazionale</b> dal 1915, da cui il nome «&nbsp;Capitale olimpica&nbsp;».",
        "Costruita su colline ripide tra il lago (373&nbsp;m) e il bosco (circa 700&nbsp;m). Preparati alle scale.",
        "La città vecchia è dominata dalla <b>cattedrale gotica</b>. Ogni notte, tra le 22 e le 2, una guardia grida ancora le ore dal campanile — tradizione viva dal 1405.",
        "Si parla francese. L'inglese è molto diffuso, soprattutto tra i giovani.",
      ]},
      { icon: "metro", title: "Spostarsi", list: [
        "La <b>metro m2</b> è l'unica metropolitana della Svizzera — sale da Ouchy, sul lago, fino al centro.",
        "Chiedi alla reception la <b>Lausanne Transport Card</b> gratuita — gli ospiti degli hotel viaggiano gratis su bus e metro.",
        "I taxi sono cari. Uber funziona in città.",
        "Il club è alle <b>Plaines-du-Loup</b>, a nord del centro — alcune linee di bus servono lo stadio della Pontaise.",
      ]},
    ],
  },
  swiss: { cards: [
    { icon: "swiss", title: "La Svizzera in pratica", kv: [
      ["Valuta", "Franco svizzero (CHF)"], ["Carte", "Accettate quasi ovunque"],
      ["Corrente", "230 V · presa tipo J"], ["Lingua", "Francese"], ["Fuso orario", "CET / CEST"] ]},
    { icon: "bulb", title: "Piccole cose utili", list: [
      "<b>Contanti:</b> non ti serviranno quasi mai. Il contactless funziona ovunque. Gli euro sono a volte accettati, ma il resto arriva in CHF.",
      "<b>Prese:</b> tipo J svizzero. Una spina europea a 2 poli entra senza adattatore; una a 3 poli <i>no</i>.",
      "<b>Acqua:</b> quella del rubinetto si beve ovunque, comprese le fontane di strada. Riempi la borraccia.",
      "<b>Mancia:</b> il servizio è incluso. Nessuna mancia è attesa — arrotondare è solo un gesto gentile.",
      "<b>I negozi</b> chiudono verso le 18:30–19:00 e la domenica. Quelli della stazione fanno eccezione.",
    ]},
    { icon: "phone", title: "Numeri di emergenza", kv: [
      ["Ambulanza", "144"], ["Polizia", "117"], ["Pompieri", "118"], ["Emergenza europea", "112"] ],
      note: "Per qualsiasi problema medico durante il torneo, passa prima dall'ufficio del torneo — durante le partite c'è un fisioterapista in sede." },
  ]},
  club: { cards: [
    { icon: "racket", title: "Lausanne-Sports Tennis",
      text: "Il torneo è organizzato dal <b>Lausanne-Sports Tennis</b>, lo storico club della città, fondato nel <b>1911</b> e installato accanto allo stadio della Pontaise dal 1954.",
      kv: [["Indirizzo", "Route des Plaines-du-Loup 7<br>1018 Lausanne"], ["Campi", "12 (10 all'aperto · 2 coperti)"]],
      link: { href: MAPS_CLUB, label: "Apri in Maps ↗" } },
    { icon: "utensils", title: "Club-house e ristorante",
      text: "La club-house e il suo ristorante sono aperti ai giocatori tutta la settimana. Durante il torneo viene servito un menu dedicato — vedi la scheda <b>Soggiorno</b>." },
  ]},
  academy: { cards: [
    { icon: "trend", title: "Team Lausanne Academy",
      text: "Team Lausanne è l'accademia di performance situata nello stesso sito. Accompagna i giocatori dai primi passi in campo fino al circuito professionistico.",
      list: [
        "<b>Sport-études</b> — scuola e tennis insieme, con supporto scolastico in sede.",
        "<b>Pro U18</b> — allenamento a tempo pieno costruito attorno al circuito ITF junior, con diverse settimane di tornei all'estero ogni anno.",
        "<b>Elite</b> — programmi individuali per giocatori del circuito professionistico: allenamento, preparazione fisica e mentale, fisioterapia, logistica.",
      ]},
  ]},
  open: {
    hero: { title: "Lausanne Open 2026",
      text: "L'unico torneo internazionale maschile del Canton Vaud. Il circuito professionistico, a casa nostra, alle Plaines-du-Loup.",
      badges: ["ITF M25", "23–30 agosto 2026", "30 000 $", "Ingresso libero"] },
    cards: [
      { icon: "trophy", title: "Vincitori 2025", kv: [
        ["Singolare", "🇨🇭 Henry Bernet"], ["Doppio", "🇮🇪 Charles Barry<br>🇫🇷 Max Westphal"] ]},
      { icon: "calendar", title: "Attorno al torneo", list: [
        "L'ingresso è <b>libero tutta la settimana</b>, senza biglietto — invita chi vuoi.",
        "Iniziazioni per le scuole, la giornata Team Lausanne il sabato e i pranzi VIP accompagnano il tabellone.",
        "Tabelloni, risultati e punteggi in diretta sono sul sito ITF.",
      ], link: { href: ITF_URL, label: "Pagina ITF del torneo ↗" } },
    ],
  },
  visit: { cards: [
    { photo: "olympic", icon: "medal", title: "Il Museo Olimpico",
      text: "La scelta ovvia, e davvero valida. Sul lungolago a Ouchy, dieci minuti dal centro con la m2. Il parco e il caffè con terrazza sono gratuiti anche senza visitare il museo." },
    { photo: "cathedral", icon: "church", title: "Cattedrale e città vecchia",
      text: "La cattedrale del XIII secolo domina la città vecchia — sali sulla torre per la vista più bella su lago e Alpi. Sotto, vicoli stretti e Place de la Palud con il mercato del sabato." },
    { photo: "hero", icon: "waves", title: "Ouchy e il lago",
      text: "La passeggiata sul lago è dove Losanna respira. Nuota, fai paddle, o prendi un <b>battello CGN</b> — una bella traversata fino a Évian, in Francia (porta un documento)." },
    { photo: "lavaux", icon: "wine", title: "I vigneti di Lavaux",
      text: "Venti minuti a est in treno: terrazze di vigne che salgono dall'acqua, patrimonio mondiale UNESCO. Scendi a Cully o Rivaz e cammina tra i villaggi. Il pomeriggio più bello da queste parti." },
    { photo: "chillon", icon: "castle", title: "Il castello di Chillon",
      text: "Un'ora di treno, vicino a Montreux: un castello medievale su una roccia nel lago. Vale il viaggio in un giorno senza partite." },
    { photo: "sauvabelin", icon: "tree", title: "Sauvabelin e Plateforme 10",
      text: "Sopra la città, il lago di Sauvabelin e la sua torre di legno — 302 gradini, vista completa su lago e Alpi. Vicino alla stazione, <b>Plateforme 10</b> riunisce tre musei d'arte in un quartiere moderno." },
    { photo: "evening.webp", icon: "moon", title: "La sera",
      text: "Il <b>Flon</b> — ex quartiere di magazzini diventato bar, ristoranti e cinema — è dove la città esce. Dieci minuti a piedi dalla stazione." },
  ]},
},

/* ==================================================================== ES */
es: {
  city: {
    photo: "hero",
    hero: { title: "Bienvenido a Lausana",
      text: "La Capital olímpica — una ciudad de colinas entre el lago Lemán y los viñedos, y la casa del Lausanne Open.",
      badges: [] },
    cards: [
      { icon: "city", title: "La ciudad en breve", list: [
        "Capital del cantón de Vaud, unos 140 000 habitantes — la cuarta ciudad de Suiza.",
        "Sede del <b>Comité Olímpico Internacional</b> desde 1915, de ahí el nombre de «&nbsp;Capital olímpica&nbsp;».",
        "Construida sobre colinas empinadas entre el lago (373&nbsp;m) y el bosque (unos 700&nbsp;m). Habrá escaleras.",
        "El casco antiguo está dominado por la <b>catedral gótica</b>. Cada noche, entre las 22:00 y las 02:00, un vigía sigue cantando las horas desde el campanario — tradición viva desde 1405.",
        "Se habla francés. El inglés está muy extendido, sobre todo entre los jóvenes.",
      ]},
      { icon: "metro", title: "Moverse", list: [
        "El <b>metro m2</b> es el único metro de Suiza — sube desde Ouchy, a orillas del lago, hasta el centro.",
        "Pide en recepción la <b>Lausanne Transport Card</b> gratuita — los clientes de hotel viajan gratis en bus y metro.",
        "Los taxis son caros. Uber funciona en la ciudad.",
        "El club está en <b>Plaines-du-Loup</b>, al norte del centro — varias líneas de bus llegan al estadio de la Pontaise.",
      ]},
    ],
  },
  swiss: { cards: [
    { icon: "swiss", title: "Suiza en la práctica", kv: [
      ["Moneda", "Franco suizo (CHF)"], ["Tarjetas", "Aceptadas casi en todas partes"],
      ["Corriente", "230 V · enchufe tipo J"], ["Idioma", "Francés"], ["Zona horaria", "CET / CEST"] ]},
    { icon: "bulb", title: "Cosas que ayudan", list: [
      "<b>Efectivo:</b> casi no lo necesitarás. El pago contactless funciona en todas partes. A veces aceptan euros, pero el cambio se da en CHF.",
      "<b>Enchufes:</b> tipo J suizo. Una clavija europea de 2 patillas entra sin adaptador; una de 3 patillas <i>no</i>.",
      "<b>Agua:</b> el agua del grifo se bebe en todas partes, incluidas las fuentes de la calle. Llena tu botella.",
      "<b>Propina:</b> el servicio está incluido. No se espera propina — redondear es solo un gesto amable.",
      "<b>Las tiendas</b> cierran hacia las 18:30–19:00 y los domingos. Las de la estación central son la excepción.",
    ]},
    { icon: "phone", title: "Números de emergencia", kv: [
      ["Ambulancia", "144"], ["Policía", "117"], ["Bomberos", "118"], ["Emergencia europea", "112"] ],
      note: "Para cualquier tema médico durante el torneo, pasa primero por la oficina del torneo — hay un fisioterapeuta en el recinto durante los partidos." },
  ]},
  club: { cards: [
    { icon: "racket", title: "Lausanne-Sports Tennis",
      text: "El torneo lo organiza el <b>Lausanne-Sports Tennis</b>, el club histórico de la ciudad, fundado en <b>1911</b> e instalado junto al estadio de la Pontaise desde 1954.",
      kv: [["Dirección", "Route des Plaines-du-Loup 7<br>1018 Lausanne"], ["Pistas", "12 (10 exteriores · 2 cubiertas)"]],
      link: { href: MAPS_CLUB, label: "Abrir en Maps ↗" } },
    { icon: "utensils", title: "Club-house y restaurante",
      text: "La club-house y su restaurante están abiertos a los jugadores toda la semana. Durante el torneo se sirve un menú para jugadores — mira la pestaña <b>Estancia</b>." },
  ]},
  academy: { cards: [
    { icon: "trend", title: "Team Lausanne Academy",
      text: "Team Lausanne es la academia de rendimiento situada en el mismo recinto. Acompaña a los jugadores desde los primeros pasos en pista hasta el circuito profesional.",
      list: [
        "<b>Sport-études</b> — colegio y tenis combinados, con seguimiento académico en el recinto.",
        "<b>Pro U18</b> — entrenamiento a tiempo completo en torno al circuito ITF junior, con varias semanas de torneos en el extranjero cada año.",
        "<b>Élite</b> — programas individuales para jugadores del circuito profesional: entrenamiento, preparación física y mental, fisioterapia, logística.",
      ]},
  ]},
  open: {
    hero: { title: "Lausanne Open 2026",
      text: "El único torneo internacional masculino del cantón de Vaud. El circuito profesional, en casa, en Plaines-du-Loup.",
      badges: ["ITF M25", "23–30 agosto 2026", "30 000 $", "Entrada libre"] },
    cards: [
      { icon: "trophy", title: "Campeones 2025", kv: [
        ["Individual", "🇨🇭 Henry Bernet"], ["Dobles", "🇮🇪 Charles Barry<br>🇫🇷 Max Westphal"] ]},
      { icon: "calendar", title: "Alrededor del torneo", list: [
        "La entrada es <b>libre toda la semana</b>, sin billete — invita a quien quieras.",
        "Iniciaciones para colegios, el día Team Lausanne el sábado y comidas VIP acompañan al cuadro.",
        "Cuadros, resultados y marcadores en directo están en la web de la ITF.",
      ], link: { href: ITF_URL, label: "Página ITF del torneo ↗" } },
    ],
  },
  visit: { cards: [
    { photo: "olympic", icon: "medal", title: "El Museo Olímpico",
      text: "La opción evidente, y realmente buena. A orillas del lago en Ouchy, diez minutos del centro con el m2. El parque y la cafetería con terraza son gratuitos aunque no entres al museo." },
    { photo: "cathedral", icon: "church", title: "Catedral y casco antiguo",
      text: "La catedral del siglo XIII corona el casco antiguo — sube a la torre para la mejor vista del lago y los Alpes. Debajo, callejuelas y la Place de la Palud con su mercado de los sábados." },
    { photo: "hero", icon: "waves", title: "Ouchy y el lago",
      text: "El paseo junto al lago es donde Lausana respira. Nada, haz paddle, o coge un <b>barco CGN</b> — una bonita travesía hasta Évian, en Francia (lleva documentación)." },
    { photo: "lavaux", icon: "wine", title: "Los viñedos de Lavaux",
      text: "Veinte minutos al este en tren: terrazas de viñedos que suben desde el agua, Patrimonio Mundial de la UNESCO. Bájate en Cully o Rivaz y camina entre los pueblos. La mejor tarde de por aquí." },
    { photo: "chillon", icon: "castle", title: "El castillo de Chillon",
      text: "A una hora en tren, cerca de Montreux: un castillo medieval sobre una roca en el lago. Merece el viaje en un día sin partido." },
    { photo: "sauvabelin", icon: "tree", title: "Sauvabelin y Plateforme 10",
      text: "Sobre la ciudad, el lago de Sauvabelin y su torre de madera — 302 escalones, vista completa del lago y los Alpes. Junto a la estación, <b>Plateforme 10</b> reúne tres museos de arte en un barrio moderno." },
    { photo: "evening.webp", icon: "moon", title: "Por la noche",
      text: "El <b>Flon</b> — antiguo barrio de almacenes convertido en bares, restaurantes y cines — es donde sale la ciudad. Diez minutos a pie desde la estación." },
  ]},
},

};
