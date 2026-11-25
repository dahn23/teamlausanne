// ===========================================================================
//  pages-en/cercle.js — « Le Cercle du Président » en anglais
// ---------------------------------------------------------------------------
// Une TABLE DE FRAGMENTS, et non un fichier parallèle comme privacy.html :
// cette page porte 340 lignes de CSS qui ne lui survivraient pas en double —
// une retouche de mise en page devrait être faite deux fois, et la deuxième
// serait oubliée. Le texte, lui, tient en 150 entrées.
//
// ⚠ Chaque entrée est le fragment HTML EXACT, délimiteurs compris. Les
// fragments ont été extraits du fichier par programme, jamais recopiés à la
// main. Un fragment qui ne correspond plus ARRÊTE le build en le nommant
// (même garde que CHROME_EN).
//
// ⚠ LE NOM : « le Cercle » devient « the President's Club », en toutes
// lettres, partout — décision de Raphael le 25.11.2026. Pas « the Circle »,
// pas « the Club » tout court : « the Club » désigne déjà le TC
// Lausanne-Sports dans la barre de navigation, et deux choses ne peuvent pas
// porter le même nom sur la même page.
//
// NE SE TRADUISENT PAS : « TC Lausanne-Sports », « Team Lausanne Academy »,
// « Lausanne Open », « Business Spotlight » (c'est le nom du format, employé
// tel quel en français), « Kazem Huber », les adresses et les horaires.
// ===========================================================================

export const CERCLE_EN = [
  // --- en-tête du document ---
  [">Le Cercle du Président — tennis et networking à Lausanne | Team Lausanne<",
   ">The President's Club — tennis and networking in Lausanne | Team Lausanne<"],
  ['content="Un cercle privé de dirigeants et d\'entrepreneurs : le vendredi matin, deux heures de tennis avec nos pros en halle couverte, un Business Spotlight et un apéritif dînatoire."',
   'content="A private club for business leaders and entrepreneurs: Friday mornings, two hours of tennis with our pros in the indoor hall, a Business Spotlight and a standing lunch."'],
  ['content="Le Cercle du Président — Les bonnes rencontres changent le jeu"',
   'content="The President\'s Club — the right people change the game"'],
  ['content="Tennis avec nos pros, Business Spotlight et apéritif dînatoire, chaque vendredi matin en halle couverte à Lausanne. Sur invitation."',
   'content="Tennis with our pros, a Business Spotlight and a standing lunch, every Friday morning in the indoor hall in Lausanne. By invitation."'],

  // --- données structurées ---
  ['"name": "Le Cercle du Président"', '"name": "The President\'s Club"'],
  ['"serviceType": "Club de tennis et de networking pour dirigeants"',
   '"serviceType": "Tennis and networking club for business leaders"'],
  ['"description": "Cercle privé de dirigeants et d\'entrepreneurs : chaque vendredi matin, deux heures de tennis encadrées par les coachs et joueurs professionnels de Team Lausanne Academy, en halle couverte, un Business Spotlight de 10 minutes et un apéritif dînatoire."',
   '"description": "A private club for business leaders and entrepreneurs: every Friday morning, two hours of tennis led by the coaches and professional players of Team Lausanne Academy, in the indoor hall, a 10-minute Business Spotlight and a standing lunch."'],
  ['"description": "Saison de lancement janvier – juillet 2027 : 20 vendredis, 10 crédits."',
   '"description": "Launch season January – July 2027: 20 Fridays, 10 credits."'],

  // --- barre du haut ---
  [">Demander une invitation<", ">Request an invitation<"],

  // --- héros ---
  [">Le TC Lausanne-Sports et Team Lausanne Academy présentent<",
   ">TC Lausanne-Sports and Team Lausanne Academy present<"],
  // Le mot en vert est le second : « Club » porte mieux la mise en avant que
  // « President's », qui n'est qu'un déterminant.
  ["<h1>Le Cercle<br />du <em>Président</em></h1>", "<h1>The President's<br /><em>Club</em></h1>"],
  [">Les bonnes rencontres changent le jeu.<", ">The right people change the game.<"],
  ["> Un cercle privé pour jouer, échanger et créer des opportunités avec les décideurs de la région.<",
   "> A private club to play, talk and open doors with the people who decide in this region.<"],
  [">Demander mon invitation <", ">Request my invitation <"],
  [">Découvrir le programme<", ">See the programme<"],
  [">Le vendredi<", ">Fridays<"],
  [">de 10h00 à 12h30<", ">10.00am to 12.30pm<"],
  [">Halle couverte<", ">Indoor hall<"],
  [">toute l'année<", ">all year round<"],
  [">Avec nos pros<", ">With our pros<"],
  [">coachs et joueurs TLA<", ">TLA coaches and players<"],
  [">Dès janvier 2027<", ">From January 2027<"],
  [">places limitées<", ">limited places<"],

  // --- manifeste ---
  [">Le meilleur réseau <", ">The best network <"],
  [">ne se construit pas assis<", ">is not built sitting down<"],
  ["> autour d'une table de réunion. Il se construit sur un court, raquette en main.<",
   "> at a meeting table. It is built on a court, racket in hand.<"],
  [">Le Cercle du Président réunit chaque vendredi matin une sélection d'entrepreneurs, de dirigeants et de décideurs de la région lausannoise. Deux heures de tennis encadrées par nos coachs et nos joueurs professionnels, puis la table : c'est là que les conversations s'ouvrent et que les projets naissent.<",
   ">Every Friday morning, the President's Club brings together a selected group of entrepreneurs, directors and decision-makers from the Lausanne region. Two hours of tennis led by our coaches and professional players, then the table: that is where conversations open up and projects begin.<"],
  [">Aucun badge, aucun pitch forcé. Juste le plaisir du jeu, des gens qui comptent et un cadre à la hauteur.<",
   ">No name badges, no forced pitching. Just the pleasure of playing, people who matter, and a setting to match.<"],
  [">Jouer. Échanger. Ensemble.<", ">Play. Talk. Together.<"],

  // --- quatre piliers ---
  [">Le programme<", ">The programme<"],
  [">Quatre raisons<", ">Four reasons<"],
  [">de bloquer vos vendredis<", ">to keep your Fridays free<"],
  [">Le tennis comme point de départ, les rencontres comme point d'arrivée.<",
   ">Tennis as the starting point, the people as the destination.<"],
  [">Le tennis avec ceux qui font la différence<", ">Tennis with the people who make the difference<"],
  [">Deux heures sur le court, encadrées par les coachs et joueurs professionnels de Team Lausanne Academy. Débutant ou joueur confirmé, chacun joue à son niveau.<",
   ">Two hours on court, led by the coaches and professional players of Team Lausanne Academy. Beginner or seasoned player, everyone plays at their own level.<"],
  [">Des rencontres qui comptent<", ">People worth meeting<"],
  [">Un cercle sélectionné d'entrepreneurs, de dirigeants et de décideurs de la région — et un lien direct avec le président et les acteurs clés du TC Lausanne-Sports.<",
   ">A selected group of entrepreneurs, directors and decision-makers from the region — and a direct line to the president and the key people of TC Lausanne-Sports.<"],
  [">Votre entreprise sous les projecteurs<", ">Your business in the spotlight<"],
  [">Un Business Spotlight de 10 minutes pour présenter votre activité, votre vision et vos opportunités à un public qui décide.<",
   ">A 10-minute Business Spotlight to present your work, your vision and your opportunities to an audience that decides.<"],
  [">L'après-match qui crée les opportunités<", ">The after-match where opportunities appear<"],
  [">Chaque vendredi se prolonge autour d'un apéritif dînatoire. Le meilleur moment pour transformer une partie en relation.<",
   ">Every Friday carries on over a standing lunch. The best moment for turning a match into a relationship.<"],

  // --- le rituel du vendredi ---
  [">Le rituel du vendredi<", ">The Friday ritual<"],
  [">Deux heures trente qui valent une semaine de rendez-vous<",
   ">Two and a half hours worth a week of meetings<"],
  [">Un format précis, pensé pour des agendas chargés : vous arrivez, vous jouez, vous rencontrez — et vous êtes de retour au bureau pour le début de l'après-midi.<",
   ">A tight format, built for full diaries: you arrive, you play, you meet people — and you are back at your desk by early afternoon.<"],
  [">Accueil &amp; Business Spotlight<", ">Welcome &amp; Business Spotlight<"],
  [">Café, présentation de la matinée, puis dix minutes avec l'entreprise mise à l'honneur du jour.<",
   ">Coffee, an outline of the morning, then ten minutes with the business of the day.<"],
  [">Sur le court, avec nos pros<", ">On court, with our pros<"],
  [">Exercices, points et matchs en groupes de niveau, animés par nos coachs et joueurs professionnels. Une thématique différente chaque vendredi.<",
   ">Drills, points and matches in groups by level, led by our coaches and professional players. A different theme every Friday.<"],
  [">Apéritif dînatoire<", ">Standing lunch<"],
  [">On pose les raquettes, on prolonge les échanges. Libre à chacun de poursuivre autour d'un déjeuner.<",
   ">Rackets down, conversations continue. Anyone who wishes can carry on over lunch.<"],

  // --- le cadre ---
  [">Le cadre<", ">The setting<"],
  [">Une halle couverte, été comme hiver<", ">An indoor hall, summer and winter<"],
  [">Le Cercle se retrouve dans notre halle de tennis couverte, aux Plaines-du-Loup. Lumière, confort, surface de qualité : un cadre à la hauteur de vos invités.<",
   ">The President's Club meets in our indoor tennis hall at the Plaines-du-Loup. Light, comfort and a quality surface: a setting worthy of your guests.<"],
  [">Aucun vendredi annulé pour cause de météo<", ">No Friday ever cancelled for weather<"],
  [">Vestiaires et douches sur place<", ">Changing rooms and showers on site<"],
  [">À dix minutes du centre de Lausanne, parking à proximité<",
   ">Ten minutes from the centre of Lausanne, parking nearby<"],

  // --- le mot du président ---
  [">Le mot du président<", ">A word from the president<"],
  [">« Un club de tennis, c'est d'abord un lieu de rencontre. Avec le Cercle, nous réunissons le vendredi matin celles et ceux qui font l'économie de la région — autour d'un filet plutôt que d'une table de réunion. On joue, on échange, on prolonge autour de l'apéritif. Et <",
   ">“A tennis club is first of all a meeting place. With the President's Club, on Friday mornings we bring together the people who drive this region's economy — around a net rather than a meeting table. We play, we talk, we carry on over lunch. And <"],
  [">il se noue souvent plus de choses en une matinée qu'en trois rendez-vous.<",
   ">more is often settled in one morning than in three meetings.<"],
  [">\r\n        Vice-président, Team&nbsp;Lausanne&nbsp;Academy\r\n      <",
   ">\r\n        Vice-president, Team&nbsp;Lausanne&nbsp;Academy\r\n      <"],
  ["Président, TC&nbsp;Lausanne-Sports", "President, TC&nbsp;Lausanne-Sports"],

  // --- l'adhésion ---
  [">L'adhésion<", ">Membership<"],
  [">Tout ce que comprend votre saison<", ">Everything your season includes<"],
  [">Une adhésion simple, sans engagement caché : vos crédits, vos vendredis, vos invités.<",
   ">Simple membership, no hidden commitment: your credits, your Fridays, your guests.<"],
  [">10 crédits à vivre ou à partager<", ">10 credits to use or to share<"],
  [">Venez seul ou invitez clients, partenaires et prospects : un crédit = une place un vendredi.<",
   ">Come alone or bring clients, partners and prospects: one credit = one place on one Friday.<"],
  [">2 heures de tennis encadrées<", ">2 hours of coached tennis<"],
  [">Par les coachs et joueurs professionnels de Team Lausanne Academy.<",
   ">With the coaches and professional players of Team Lausanne Academy.<"],
  [">Le Business Spotlight<", ">The Business Spotlight<"],
  [">L'occasion de présenter votre entreprise au Cercle, 10 minutes, un vendredi de la saison.<",
   ">Your chance to present your business to the President's Club, 10 minutes, one Friday in the season.<"],
  [">L'apéritif dînatoire<", ">The standing lunch<"],
  [">Inclus à chaque séance, à 12h00.<", ">Included at every session, at 12.00pm.<"],
  [">Un accès privilégié au club<", ">Privileged access to the club<"],
  [">Des opportunités exclusives autour du TC Lausanne-Sports, de Team Lausanne Academy et du Lausanne Open.<",
   ">Exclusive opportunities around TC Lausanne-Sports, Team Lausanne Academy and the Lausanne Open.<"],
  [">Le repas de soutien annuel<", ">The annual supporters' dinner<"],
  [">Vous y êtes invité, accompagné de la personne de votre choix.<",
   ">You are invited, with a guest of your choice.<"],
  [">Le fil WhatsApp du Cercle<", ">The President's Club WhatsApp thread<"],
  [">La thématique de la semaine, les infos et les moments forts.<",
   ">The theme of the week, the practical details and the highlights.<"],
  [">Un engagement qui a du sens<", ">A commitment that means something<"],
  [">Une part de votre adhésion soutient les jeunes joueuses et joueurs de l'académie.<",
   ">Part of your membership supports the academy's young players.<"],
  [">Saison de lancement · janvier – juillet 2027<", ">Launch season · January – July 2027<"],
  [">CHF / saison<", ">CHF / season<"],
  [">Soit 80.– la matinée de tennis, apéritif compris.<",
   ">That is CHF 80 per tennis morning, lunch included.<"],
  [">Crédits<", ">Credits<"],
  [">Vendredis au programme<", ">Fridays in the season<"],
  [">Horaire<", ">Time<"],
  [">10h00 – 12h30<", ">10.00am – 12.30pm<"],
  [">Lieu<", ">Venue<"],
  [">Places limitées pour garder un cercle à taille humaine.<",
   ">Places are limited, to keep the group a human size.<"],

  // --- l'écosystème ---
  [">Plus qu'un réseau, <", ">More than a network, <"],
  [">un véritable écosystème.<", ">a genuine ecosystem.<"],
  [">Le Cercle du Président<", ">The President's Club<"],
  [">Un accès privilégié<", ">Privileged access<"],
  [">Au cœur du tennis lausannois<", ">At the heart of tennis in Lausanne<"],
  [">Rejoindre le Cercle, c'est entrer dans la maison : un club historique, une académie qui forme jusqu'au circuit professionnel et le tournoi international de tennis masculin de Lausanne.<",
   ">Joining the President's Club means coming inside: a historic club, an academy that develops players all the way to the professional tour, and Lausanne's international men's tennis tournament.<"],
  [">Le club et ses 12 courts aux Plaines-du-Loup, dont 6 couverts en hiver. Un lien direct avec son président et ses acteurs clés.<",
   ">The club and its 12 courts at the Plaines-du-Loup, 6 of them covered in winter. A direct line to its president and its key people.<"],
  [">Du Kids Tennis au programme Pro, en passant par le sport-études : les coachs qui animent vos vendredis forment la relève.<",
   ">From Kids Tennis to the Pro programme, by way of sport studies: the coaches who run your Fridays are developing the next generation.<"],
  [">Le tournoi international ITF M25 que nous organisons chaque été : un rendez-vous privilégié pour les membres du Cercle et leurs invités.<",
   ">The international ITF M25 tournament we host every summer: a privileged occasion for members of the President's Club and their guests.<"],

  // --- la saison de lancement ---
  [">La saison de lancement<", ">The launch season<"],
  [">20 vendredis, de janvier à juillet 2027<", ">20 Fridays, from January to July 2027<"],
  [">Premier vendredi le 15 janvier 2027. Hors vacances scolaires vaudoises et jours fériés. Vous choisissez vos dates : vos 10 crédits se réservent directement dans l'application Team Lausanne.<",
   ">First Friday on 15 January 2027. Excluding Vaud school holidays and public holidays. You choose your dates: your 10 credits are booked directly in the Team Lausanne app.<"],
  [">Janvier 2027<", ">January 2027<"],
  [">Février<", ">February<"],
  [">Mars<", ">March<"],
  [">Avril<", ">April<"],
  [">Mai<", ">May<"],
  [">Juin<", ">June<"],
  [">Juillet<", ">July<"],
  ["> Le premier vendredi de la saison. Chaque case est une matinée, de 10h00 à 12h30.<",
   "> The first Friday of the season. Each square is one morning, 10.00am to 12.30pm.<"],

  // --- questions fréquentes ---
  [">Questions fréquentes<", ">Frequently asked questions<"],
  [">Bon à savoir<", ">Worth knowing<"],
  [">Faut-il être un bon joueur ?<", ">Do I need to be a good player?<"],
  [">Non. Les groupes sont formés par niveau et nos coachs adaptent chaque séance : débutants, joueurs qui reprennent et joueurs confirmés y trouvent tous leur compte.<",
   ">No. Groups are formed by level and our coaches adapt every session: beginners, players coming back to the game and seasoned players all get what they need.<"],
  [">Comment fonctionnent les crédits ?<", ">How do the credits work?<"],
  [">Vos 10 crédits couvrent la saison de lancement : un crédit correspond à une place un vendredi. Vous les utilisez quand vous voulez, seul ou à plusieurs : venir avec un client compte simplement deux crédits ce jour-là.<",
   ">Your 10 credits cover the launch season: one credit is one place on one Friday. You use them whenever you like, alone or with others: bringing a client simply counts as two credits that day.<"],
  [">Qu'est-ce que le Business Spotlight ?<", ">What is the Business Spotlight?<"],
  [">Dix minutes en début de séance pour présenter votre entreprise, votre vision ou une opportunité au Cercle. Les dates sont réparties entre les membres au fil de la saison.<",
   ">Ten minutes at the start of a session to present your business, your vision or an opportunity to the President's Club. Dates are shared out between members across the season.<"],
  [">Faut-il être membre du TC Lausanne-Sports ?<", ">Do I need to be a member of TC Lausanne-Sports?<"],
  [">Non, le Cercle est ouvert aux personnes extérieures au club. L'adhésion au Cercle suffit pour participer aux vendredis.<",
   ">No, the President's Club is open to people from outside the club. Membership of the President's Club is enough to take part on Fridays.<"],
  [">Que dois-je apporter ?<", ">What should I bring?<"],
  [">Une tenue de sport et des chaussures de tennis pour surface intérieure. Raquettes et balles peuvent être fournies sur demande.<",
   ">Sportswear and tennis shoes for indoor surfaces. Rackets and balls can be provided on request.<"],
  [">Comment rejoindre le Cercle ?<", ">How do I join the President's Club?<"],
  [">Remplissez la demande d'invitation ci-dessous ou appelez le secrétariat au 021 646 13 50. Nous vous recontactons pour faire connaissance et vous proposer une première matinée.<",
   ">Fill in the invitation request below or call the office on 021 646 13 50. We will get back to you to get acquainted and offer you a first morning.<"],

  // --- le formulaire ---
  [">Rejoindre le Cercle<", ">Join the President's Club<"],
  [">Demandez votre invitation<", ">Request your invitation<"],
  [">Laissez-nous vos coordonnées : nous vous recontactons pour faire connaissance et vous réserver une place pour un prochain vendredi.<",
   ">Leave us your details: we will get back to you to get acquainted and hold a place for you on a coming Friday.<"],
  [">Vous préférez nous appeler ?<", ">Would you rather call us?<"],
  [">Le secrétariat de Team Lausanne vous répond.<", ">The Team Lausanne office will answer.<"],
  [">Ma demande d'invitation<", ">My invitation request<"],
  [">Réponse personnelle sous 48 heures.<", ">A personal reply within 48 hours.<"],
  [">Prénom et nom<", ">First name and surname<"],
  [">Entreprise<", ">Company<"],
  [">Fonction<", ">Role<"],
  [">Téléphone<", ">Telephone<"],
  [">E-mail<", ">Email<"],
  [">Mon niveau de tennis\r\n            <", ">My tennis level\r\n            <"],
  [">Choisir…<", ">Choose…<"],
  [">Je débute ou je reprends<", ">I am starting out, or coming back<"],
  [">Je joue de temps en temps<", ">I play now and then<"],
  [">Je joue régulièrement<", ">I play regularly<"],
  [">Joueur classé ou confirmé<", ">Ranked or seasoned player<"],
  ["> J'aimerais présenter mon entreprise lors d'un Business Spotlight<",
   "> I would like to present my business at a Business Spotlight<"],
  [">Un mot pour nous (facultatif)<", ">A word for us (optional)<"],
  [">Envoyer ma demande <", ">Send my request <"],
  [">Vos coordonnées servent uniquement à vous recontacter au sujet du Cercle du Président. <",
   ">Your details are used only to get back to you about the President's Club. <"],
  // ⚠ Le lien ET le libellé : la politique anglaise vit à /en/privacy.
  ['<a href="/confidentialite">Confidentialité</a>', '<a href="/en/privacy">Privacy</a>'],
  [">Merci, c'est bien reçu.<", ">Thank you — received.<"],
  [">Nous revenons vers vous très vite. Pour toute question, le secrétariat vous répond au <",
   ">We will come back to you very soon. For any question, the office can be reached on <"],

  // --- pied de page ---
  [">Route des Plaines-du-Loup 7, 1018 Lausanne · <", ">Route des Plaines-du-Loup 7, 1018 Lausanne · <"],

  // --- textes de remplacement des images (lus par les lecteurs d'écran) ---
  ['aria-label="Joueur au service, sur un court de Team Lausanne"',
   'aria-label="A player serving, on a Team Lausanne court"'],
  ['aria-label="Joueur en coup droit sur un court couvert"',
   'aria-label="A player hitting a forehand on an indoor court"'],
  ['alt="Un coach de Team Lausanne corrige le geste d\'une joueuse"',
   'alt="A Team Lausanne coach correcting a player\'s stroke"'],
  ['alt="Coach de Team Lausanne au bord du court"', 'alt="A Team Lausanne coach at the side of the court"'],
  ['alt="Prise de notes pendant une présentation"', 'alt="Taking notes during a presentation"'],
  ['alt="Tables de l\'espace hospitalité au bord des courts"',
   'alt="Tables in the hospitality area beside the courts"'],
  ['alt="Kazem Huber, président du TC Lausanne-Sports"',
   'alt="Kazem Huber, president of TC Lausanne-Sports"'],
  ['alt="Chaussure de tennis sur terre battue"', 'alt="A tennis shoe on clay"'],
  ['alt="Joueur professionnel de Team Lausanne Academy en glissade sur terre battue"',
   'alt="A Team Lausanne Academy professional sliding on clay"'],
  ['alt="Les vainqueurs du Lausanne Open 2026 avec leurs trophées"',
   'alt="The winners of the 2026 Lausanne Open with their trophies"'],
];
