// ===========================================================================
//  contenu-en.js — the English content of the site, as DATA
// ---------------------------------------------------------------------------
// The mirror of contenu.js. Same shape, same keys, English text. The same two
// readers use it: index.js builds the English pages from it, and the chatbot
// reads it as its knowledge base when a visitor writes in English.
//
// THE SAME THREE RULES AS contenu.js apply, for the same reason — the bot
// reads this file as data and stops at anything that looks like code:
//   1. No cross-references, no function calls, no computation. The two text
//      markers are allowed and resolved by index.js:
//        · "@coachs"            → the coach list in contenu.js
//        · { type: "mention" }  → the mention_image block in contenu.js
//   2. No exotic trailing comma, no /* */ inside a value. Line comments
//      starting with // are fine.
//   3. NO CONCATENATION. A long sentence goes on one line, never
//      "start " + "end" — that is a computation, and the bot's reader stops.
//
// ---------------------------------------------------------------------------
//  TRANSLATION IS PROGRESSIVE, AND THAT IS BY DESIGN
// ---------------------------------------------------------------------------
// A page absent from this file simply has no English version: build.mjs does
// not generate one, the sitemap does not list one, no hreflang points at one,
// and the FR | EN switch hides itself on that page. Nobody ever lands on a
// half-English page — they stay on the French one, which is complete.
//
// So a page is added here only once it is translated in full. Never a title
// without its body.
//
// ---------------------------------------------------------------------------
//  TERMINOLOGY — decided by Raphael on 25.11.2026, not open to drift
// ---------------------------------------------------------------------------
// TRANSLATED:
// · "Sport-Études" → "Sport Studies". Two words, no hyphen. Capitalised when
//   it names the programme ("the Sport Studies programme", "Sport Studies &
//   Pro U18"), lower case inside a list of categories — which is exactly what
//   contenu.js does with "sport-études" in French.
//   ⚠ The URL stays /en/sport-studies: it already matched, and an address
//   that has been shared does not change on a wording decision.
//
// NOT TRANSLATED, and this is deliberate:
// · "maturité" — the Swiss school-leaving certificate. Glossed on first use,
//   never replaced by "A-levels" or "high school diploma": those are
//   different awards, and a parent comparing schools would be misled.
// · "interclub" — the Swiss league format, written as Swiss Tennis writes it.
// · "Lausanne Open", "GameZone", "Kids Tennis", "Plaines-du-Loup" — names.
// ===========================================================================

export const CONTENU_EN = {

// ---- The coaching team ----------------------------------------------------
// One list, read both by the "Our coaches" page (details.coaches) and by the
// carousel on the home page — exactly as in contenu.js. The keys that are NOT
// text (slug, portrait, portraitPos) are copied unchanged: they point at the
// same photos and the same anchors as the French version.
// ⚠ Swiss Tennis rankings (N3, R1, R6…) and French rankings (2/6) are left as
// they are. They are not translatable scales: converting them would invent a
// standard that no federation uses.
coachs:
[
  { slug: "mariano-palena", role: "Head coach", nom: "Mariano Palena",
    resume: "An international coach, he guides professional players in their technical, mental and personal development.",
    tags: ["Sport Studies & Pro", "Competition", "Performance"],
    bio: [
      "Argentinian by birth, Mariano Palena has been coaching since he was 18. Passionate about tennis and about passing it on, he guides young players in their sporting, mental and personal development.",
    ],
    citation: "My role is to help young players love the process and become independent. Before we are tennis players, we are people. Values always come first.",
    classement: ["Estimated level N4/R1 in Switzerland."],
    formations: [
      "Argentinian Tennis Association certification, levels 1 and 2.",
      "ITF level III.",
      "Further training in biomechanics, physical preparation and sport psychology.",
      "Coach B: training in progress.",
    ],
    parcours: [
      "Experience with juniors of all ages, including on the ITF Junior circuit.",
      "Has coached professional players ranked as high as the ATP top 350.",
      "Has worked with players who reached the WTA top 100, at WTA tournaments and in Grand Slams.",
      "Coaching experience in Argentina, Italy, Spain and Saudi Arabia.",
      "Head coach of the Sport Studies & Pro groups for more than two years.",
    ]},

  { slug: "mark-gattiker", role: "Senior Coach", nom: "Mark Gattiker",
    resume: "Trained in Argentina and a former professional, he leads the Sport Studies and Pro groups with high standards, precision and an eye for detail.",
    tags: ["Sport Studies & Pro"],
    bio: [
      "Born in Switzerland and trained in Argentina, Mark Gattiker grew up in a tennis family: his father, Alejandro Gattiker, was a professional player, a coach on tour, and then captain of Argentina's Davis Cup team.",
      "As a player he trained at the Argentinian Federation's national centre before competing on the Futures and Satellites circuits, then joined the University of South Florida in NCAA Division I. After twelve years in finance, he returned to coaching in 2020 and has not left the court since.",
      "Intense, detailed, analytical: those are the three words he uses to sum up his coaching. A session should be physical and clear, and the player should know what they worked on and why.",
    ],
    citation: "Everyone has more to give on court, they just don't always know it. When a player realises what they are capable of, that is very rewarding for me.",
    classement: ["Best ranking: N3 in Switzerland.", "ATP points in doubles."],
    formations: [
      "PTR international diploma: adults, children and competition.",
      "Coach C in Switzerland.",
      "Coach B: training to come.",
      "Bachelor in Business Management, University of South Florida.",
    ],
    parcours: [
      "Trained at the national centre of the Argentinian Tennis Federation.",
      "Professional career on the Futures and Satellites circuits.",
      "Full scholarship to the University of South Florida, in Tampa, in NCAA Division I.",
      "Four years with the competition juniors of TC Stade Lausanne, whose teams were crowned Swiss U15 champions and U12 runners-up.",
      "A year coaching in the United States, at the ElSawy Tennis Academy in Tampa and at TennisPort in New York.",
      "Leads the academy's Sport Studies and Pro groups.",
    ]},

  { slug: "yann-perez", role: "Coach", nom: "Yann Perez",
    resume: "A performance coach, he combines competitive experience with an approach that is demanding, intense and respectful.",
    tags: ["Sport Studies & Pro"],
    bio: [
      "Yann Perez joined the academy five years ago. Alongside his work as a coach, he completed university studies while continuing to compete.",
      "Discipline, intensity and respect are at the heart of his approach on court.",
    ],
    classement: ["Current ranking: R1 (290).", "Best ranking: R1 (189)."],
    formations: [
      "J+S coach.",
      "Teaching certificate for advanced players.",
      "Youth Sport coach.",
      "Swiss Tennis Physis Coach.",
    ],
    parcours: [
      "Twice champion of the Canton of Vaud.",
      "Junior interclub finalist.",
      "Hitting partner for ATP players.",
      "Training blocks in Spain.",
    ]},

  { slug: "vladimir-stojkovic", role: "Coach", nom: "Vladimir Stojkovic",
    resume: "An international coach trained in Serbia, he brings tour experience to the Club, Competition and Performance groups.",
    tags: ["Club", "Competition", "Performance"],
    bio: [
      "Born in Serbia, Vladimir Stojkovic has been coaching since 2012, first in his own country and then in Switzerland. As a junior he played for the Serbian national team and ranked among the country's top three in every age group, before competing in Futures tournaments.",
      "He has led several academies, then founded his own, VERSUS TEAM, which he ran for six years. A GPTCA level B international coach, he has guided players on to the ATP, WTA and ITF circuits.",
      "He joined Team Lausanne Academy in September 2026, where he leads the Club, Competition and Performance groups.",
    ],
    classement: [
      "Best ranking: no. 3 in the Serbian senior rankings (2011).",
      "Has competed in Futures circuit tournaments.",
    ],
    formations: [
      "GPTCA international coach, level B (2020).",
      "GPTCA international coach, level C (2016).",
      "Faculty of Management and Law, MB University, Belgrade.",
    ],
    parcours: [
      "Serbian national junior team: no. 1 in the country at under-14, no. 2 at under-16, no. 3 at under-18.",
      "More than 80 junior tournaments won; Orange Bowl 2007 in Miami, Winter Cups and European Summer Cups with Serbia.",
      "Coaching in Serbia and Switzerland since 2012, notably near Basel and in several Serbian academies.",
      "Founder and head coach of his own academy, from 2020 to 2026.",
      "Has worked with ranked players on the ATP, WTA and ITF circuits, including a junior ranked no. 20 in the world.",
      "Speaks Serbian, English, German and French.",
    ]},

  { slug: "loris-gander", role: "Coach", nom: "Loris Gander",
    resume: "An active competitive player and a coach, he shares his tournament experience with patience, enthusiasm and passion.",
    tags: ["Kids Tennis", "Club", "Competition", "Camps"],
    bio: [
      "Loris Gander is 19 and has played tennis since he was three. He trains daily in Team Lausanne Academy's Pro pathway, aiming to become a professional player, while passing on his passion as a coach within the academy.",
      "Patient and passionate, Loris likes sharing his energy and his love of tennis with the young players he coaches.",
    ],
    classement: ["Current and best ranking: N4 (148)."],
    formations: ["Jeunesse+Sport training in progress."],
    parcours: [
      "Has played several ITF junior tournaments abroad.",
      "Experience of a few ITF senior tournaments.",
      "Coach at Team Lausanne Academy for a year.",
      "Occasional support at tournaments.",
    ]},

  { slug: "seline-rivarolli", role: "Coach", nom: "Séline Rivarolli",
    resume: "A coach for the youngest players, she builds positive, motivating sessions full of energy, enjoyment and a love of the game.",
    tags: ["Kids Tennis", "Club", "Camps"],
    bio: [
      "Séline Rivarolli is 19 and has played tennis since she was four. An injury stopped her from continuing in competition, but her passion stayed intact and she passes it on today to the youngest players.",
      "Séline shares her passion the way it was shared with her: with motivation, energy and a smile.",
    ],
    classement: ["Current ranking: R6.", "Best ranking: R3."],
    formations: [
      "Assistant tennis instructor diploma.",
      "J+S training planned for August 2026.",
    ],
    parcours: [
      "Has played several Vaud cantonal championships.",
      "Took part in the Swiss championships.",
      "Experience of coaching in an academy.",
    ]},

  { slug: "celyan-lorival", role: "Coach", nom: "Célyan Lorival",
    portrait: "assets/photos/coaches/celyan-lorival.jpg", portraitPos: "center 24%",
    resume: "A sport studies player and a coach for two years, he passes on with patience what he is still learning on court himself.",
    tags: ["Kids Tennis", "Club", "Competition", "Camps"],
    bio: [
      "Célyan Lorival has been in sport studies at Lausanne-Sports for five years, with the bac in his sights. He has been teaching for around two years, from Kids Tennis to Competition, in lessons and on camps.",
      "A one-handed backhand, and an admitted weakness for the atmosphere of the interclub. Patient and motivated, he enjoys passing it on as much as playing.",
    ],
    classement: ["Current and best ranking: R2."],
    formations: [
      "Jeunesse+Sport, continuing training 1.",
      "Jeunesse+Sport, continuing training 2.",
      "Official Swiss Tennis.",
    ],
    parcours: [
      "Five years of sport studies at Lausanne-Sports.",
      "Teaching for two years: Kids Tennis, Club, Competition and camps.",
    ]},

  { slug: "augustin-tarouat", role: "Coach", nom: "Augustin Tarouat",
    portrait: "assets/photos/coaches/augustin-tarouat.jpg", portraitPos: "center 20%",
    resume: "Trained in a sport studies programme in Lyon, he likes taking technique and tactics apart to help every player improve at their own pace.",
    tags: ["Kids Tennis", "Club", "Competition"],
    bio: [
      "Originally from Lyon, Augustin Tarouat followed a sport studies path in tennis and football, which gave him a sporting culture and a taste for competition early on. As a player he reached the 2/6 ranking and took part in many regional and national gatherings in France, before stopping competition earlier than planned.",
      "Passionate about technique and tactics, he likes analysing the game and understanding how progress happens, so as to guide each player according to their level and their goals.",
    ],
    citation: "Passing on my passion for tennis, sharing what I have learned, and helping everyone develop their potential — while enjoying our time on court.",
    classement: ["Best ranking: 2/6 (France)."],
    parcours: [
      "Sport studies path in tennis and football, in Lyon.",
      "Regional and national gatherings in France as a young player.",
      "Leads Kids Tennis, Club and Competition.",
    ]},

  { slug: "talia-picci", role: "Junior coach", nom: "Talia Picci",
    resume: "An active R1 competitor, she runs lively, relaxed and motivating sessions for young players, built on effort and enjoyment.",
    tags: ["Kids Tennis", "Club", "Camps"],
    bio: [
      "Talia Picci is 18 and aiming for a professional career. Ranked R1, she plays tournaments almost every weekend and is gradually stepping on to the international circuit.",
      "Her coaching rests on effort and enjoyment. When players put in real work, she likes to reward them with games, in a relaxed and motivating atmosphere.",
    ],
    classement: ["Current ranking: R1 (117).", "Best ranking: R1 (99)."],
    formations: ["Recreational Tennis certification, level 1."],
    parcours: [
      "Active competitor on the national circuit.",
      "First steps on international tournaments.",
      "Works in Kids Tennis, in the Club groups and on camps.",
    ]},

  { slug: "andreas-egger", role: "Physical coach", nom: "Andreas Egger",
    portrait: "assets/photos/coaches/andreas-egger.jpg", portraitPos: "center 10%",
    resume: "A strength and conditioning coach, he works with the players all season and pushes them to go beyond themselves day after day.",
    tags: ["Sport Studies & Pro"],
    bio: [
      "Andreas holds a Bachelor in Movement and Sport Sciences from the University of Lausanne, followed by two years of a Master's in sport and then a Personal Trainer qualification.",
      "Norwegian by origin and passionate about sport since childhood, he played and taught football before competing in biathlon at national elite level, first as a junior and then as a senior. He still competes today at amateur level.",
      "At Team Lausanne Academy, Andreas guides our players through their physical preparation all season long and passes on his passion. His aim: to help them go beyond themselves day after day and give them the best possible chance of reaching their goals.",
    ],
    formations: [
      "Bachelor in Movement and Sport Sciences, University of Lausanne.",
      "Two years of a Master's in sport.",
      "Personal Trainer qualification.",
    ],
    parcours: [
      "Norwegian by origin, passionate about sport since childhood.",
      "Played and taught football.",
      "Biathlon at national elite level, as a junior and then as a senior.",
      "Still competes at amateur level.",
      "Runs the physical preparation of the academy's players all season long.",
    ]},
],

// ---- Image rights ---------------------------------------------------------
// ⚠ A LEGAL NOTICE, not marketing copy. It appears at the foot of the four
// pathways without a signed contract — Kids Tennis, Club, Competition,
// Performance. Translated to say exactly what the French says, no more and no
// less: it describes a right to object, and it does not replace the explicit
// consent of a legal guardian collected at registration.
// ⚠ "LPD" is the Swiss Federal Act on Data Protection. The abbreviation is
// kept and glossed: an English reader looking it up must find the Swiss law,
// not the GDPR, which is a different text.
mention_image:
{
  type: "mention", title: "Image rights",
  body: "During lessons, camps, tournaments and events, Team Lausanne Academy takes photographs and videos that may be used for its communications: website, social media, newsletter and printed material. These images are neither sold nor passed to third parties for commercial purposes, and minors are never identified beyond their first name. The legal guardian may object to this use at any time, without giving a reason and without any consequence for participation, and may ask for an already published image to be taken down by writing to info@teamlausanne.ch: we act on such requests as quickly as possible. Data is processed in accordance with the Swiss Federal Act on Data Protection (LPD).",
},

worlds: {

  academie: {
    tag: "Academy", retour: "to the Academy",
    h1: "Tennis school in Lausanne",
    metaTitle: "Tennis in Lausanne: school, sport studies, club | Team Lausanne",
    metaDescription: "Tennis in Lausanne: lessons from age 4, competition, sport studies and pro. 12 courts at the Plaines-du-Loup, 6 of them covered in winter.",
    logo: "assets/logo-academie.webp", heroLogo: "assets/logo-academie-blanc.png",
    slogan: "Play. Progress. Together.",
    desc: "The training centre of Lausanne-Sports Tennis. A complete pathway, from a first rally to high performance, built for every age from 4 upwards.",
    hero: "assets/photos/competition-2026-g1.jpg", heroPos: "center 40%",
    heroVideo: "assets/video/accueil-hero.mp4",
    cta: [{ label: "Our camps", type: "stages" }, { label: "Our GameZone tournaments", type: "gamezone" }, { label: "Our Sport Studies programme", type: "sport-etudes" }],
    sections: [
      { type: "rich", anchor: "philosophie", title: "Our philosophy", body: [
        "Team Lausanne offers complete tennis coaching, suited to every age and every standard of play, within a genuine development pyramid.",
        "Our aim: to bring every young player to a level that would at least let them join an American university programme (NCAA) if they wish, once they hold their Swiss maturité or French baccalauréat.",
      ]},
      { type: "pyramid", title: "How we develop players",
        sub: "At each stage, training and tournament volume rises step by step. That is how a young player tests their own motivation for tennis — our main selection criterion.",
        levels: [
          { name: "Pro · NCAA (USA) · Coach training", meta: "from 18", href: "#pro" },
          { name: "Sport Studies & Pro U18", meta: "limited places", href: "#sport-etudes" },
          { name: "Performance", meta: "approx. 12–15 · 8 places", href: "#performance" },
          { name: "Competition", meta: "approx. 10–13 · 16 places", href: "#competition" },
          { name: "Kids Tennis", meta: "4–10 · open to all", href: "#kids" },
        ],
        club: { title: "Club pathway", href: "#club-academy", body: [
          "Alongside the selective pyramid, the Club pathway is for those who want to develop their tennis at their own pace, once or several times a week.",
          "With the option of playing the occasional competition — including the interclub league, for club members.",
        ]},
        note: "Age is only a guide: progression adapts to each player, give or take a year or two. Those who do not join a selective pathway carry on in the Club pathway." },
      { type: "filmsec", variant: "hero", anchor: "film", eyebrow: "The club's film",
        title: "From a first rally to real ambition",
        lead: "The training centre of Lausanne-Sports Tennis, in pictures.",
        poster: "assets/photos/accueil-film-2026.jpg",
        video: "16cjRpRNQZ0",
        link: { label: "Explore our programmes", cta: true, scroll: "programmes" } },
      { type: "coachs", piste: true, anchor: "coachs", eyebrow: "The people who coach",
        title: "Our coaches",
        lead: "From Kids Tennis to Pro, the same team and the same standards. Click a card to read a coach's background.",
        lien: { label: "Meet the whole team", href: "#coaches" },
        items: "@coachs" },
      { type: "carousel", anchor: "programmes", eyebrow: "Tennis for everyone", title: "A programme for every level",
        sub: "From a first rally to high performance, a clear path to improve and enjoy it.",
        items: [
          { name: "Kids Tennis", photo: "assets/photos/kidstennis-2026.jpg", href: "#kids" },
          { name: "Club", photo: "assets/photos/club-2026.jpg", href: "#club-academy" },
          { name: "Competition", photo: "assets/photos/competition-2026-card.jpg", href: "#competition" },
          { name: "Performance", photo: "assets/photos/performance-2026.jpg", href: "#performance" },
          { name: "Sport Studies", photo: "assets/photos/sport-etudes-2026.jpg", href: "#sport-etudes" },
          { name: "Pro U18", photo: "assets/photos/pro-u18-2026.jpg", href: "#pro-u18" },
          { name: "Pro", photo: "assets/photos/pro-2026.jpg", href: "#pro" },
          { name: "Game Zone", photo: "assets/photos/gamezone-2026.jpg", href: "#gamezone" },
          { name: "Camps", photo: "assets/photos/stages-2026.jpg", href: "#stages" },
          { name: "Adults and private lessons", photo: "assets/photos/adultes-2026.jpg", href: "#adultes" },
        ] },
      { type: "features", anchor: "installations", title: "12 courts, all year round", items: [
        ["12 courts in summer", "At TC Lausanne-Sports, route des Plaines-du-Loup 7: 10 outdoor courts and 2 indoor courts, from mid-April to mid-October."],
        ["6 covered courts in winter", "From mid-October to mid-April, 6 courts are covered — the 2 indoor courts and 4 under an air dome. Lessons run right through the winter."],
        ["A real club", "Team Lausanne is the training centre of TC Lausanne-Sports: members book their courts and play in the interclub league."],
        ["The Lausanne Open", "Every summer we host the Lausanne Open on our own courts, an international ITF M25 tournament with free entry."],
      ], link: { label: "Become a club member ↗", href: "https://www.lstennis.ch" } },
      { type: "faq", anchor: "faq", eyebrow: "Frequently asked questions",
        title: "Tennis in Lausanne, in brief", items: [
          ["Where can I play tennis in Lausanne?", "At TC Lausanne-Sports, route des Plaines-du-Loup 7, 1018 Lausanne: 12 courts in summer, 6 of them covered in winter. Team Lausanne coaches there, from four-year-olds to professional players."],
          ["Can you play tennis in Lausanne in winter?", "Yes. From mid-October to mid-April, 6 courts are covered — 2 indoor courts and 4 under an air dome: lessons, training and member bookings all carry on through the winter."],
          ["How young can a child start tennis?", "From age 4, in Kids Tennis: a playful, structured setting for learning the basics. A trial lesson can be arranged on request."],
          ["Is there a sport studies tennis programme in Lausanne?", "Yes. Team Lausanne's Sport Studies programme takes 14 to 19-year-olds: two hours of tennis, one hour of physical preparation and four hours of supervised schoolwork a day, through to the Swiss federal maturité or the French baccalauréat. The Pro U18 and Pro programmes extend the path to the professional tour — a complete pathway, and a rare one in Switzerland."],
          ["How do I join the club and book a court?", "Members of TC Lausanne-Sports book their courts and can play in the interclub league. Membership is arranged with the club, at lstennis.ch."],
          ["What is the Lausanne Open?", "Lausanne's international ITF M25 tournament, with 30,000 USD in prize money, hosted every summer by Team Lausanne on its own courts. A week of men's professional tennis at the Plaines-du-Loup, and entry is free."],
        ]},
      { type: "actus", anchor: "actus", eyebrow: "The club journal",
        title: "Latest news",
        lead: "Life at the academy, week by week: the camps, the tournaments, how our players are doing, and the people who make the club." },
      { type: "calendrier", anchor: "calendrier", eyebrow: "Calendar",
        title: "The season calendar",
        lead: "School holidays, public holidays, academy closures and camps: the dates that matter, all in one place.",
        pdfs: [
          { label: "Tennis school (PDF)", href: "assets/calendriers/calendrier-2026-27-ecole-de-tennis.pdf" },
          { label: "Sport Studies (PDF)", href: "assets/calendriers/calendrier-2026-27-sport-etudes.pdf" },
        ] },
    ],
  },

  tournoi: {
    tag: "Lausanne Open", retour: "to the Lausanne Open",
    metaTitle: "Lausanne Open — ITF M25 tennis tournament in Lausanne",
    metaDescription: "International ITF M25 tournament with 30,000 USD in prize money, the meeting point for men's professional tennis in Lausanne. Free entry. 3rd edition, 21–29 August 2027.",
    logo: "assets/logo-open-2027.webp", heroLogo: "assets/logo-open-2027-blanc.webp",
    slogan: "Feel it. Dream it. Together.",
    desc: "3rd edition, 21 to 29 August 2027. Lausanne's international men's tennis tournament: the professional tour, here, at the Plaines-du-Loup.",
    hero: "assets/photos/open-2026-6.jpg", heroPos: "center 30%",
    cta: [],
    sections: [
      { type: "stats", anchor: "tournoi", variant: "board", items: [
        { v: "21–29 August", l: "3rd edition, in 2027", ico: "date",  scroll: "infos", compte: false },
        { v: "30,000 USD",   l: "prize money",          ico: "coupe" },
        { v: "Free",         l: "free entry",           ico: "billet",   scroll: "infos" },
        { v: "ITF M25",      l: "category",             ico: "ecusson",  href: "@itf_url" },
      ] },
      { type: "split", anchor: "presentation", title: "The great meeting point of men's tennis in Vaud",
        video: "S1kulGoQPNM", poster: "assets/video/lausanne-open-2026-film.jpg", body: [
        "Each year the Lausanne Open brings together several dozen players of every nationality, most of them ATP-ranked, on the courts of the Pontaise.",
        "Entry is entirely free, all week long.",
      ], link: { label: "ITF site & results ↗", href: "@itf_url" } },
      { type: "carousel", eyebrow: "Lausanne Open", title: "A week of events",
        sub: "Free entry all week, activities for everyone and hospitality.",
        items: [
          { name: "Taster sessions for schools", photo: "assets/photos/open-ecoles-2026.jpg" },
          { name: "Team Lausanne Day", photo: "assets/photos/journee-famille-2026.jpg" },
          { name: "VIP · Tennis & Lunch", photo: "assets/photos/open-lunch-2026.jpg" },
        ]},
      { type: "seeds", anchor: "tetes-de-serie", title: "The 8 seeds of the 2026 edition",
        sub: "The defending champion, a former junior world number one, and seven other players ranked among the world's top 650. ATP ranking at the time of the draw." },
      { type: "palmares", anchor: "palmares", title: "Roll of honour",
        sub: "The winners of the Lausanne Open, edition after edition.",
        editions: [
          { an: "2026", simple: { f: "@flag_ch", n: "Henry Bernet" },
            double: [{ f: "@flag_ch", n: "Johan Niklès" }, { f: "@flag_ch", n: "Adrien Burdet" }] },
          { an: "2025", simple: { f: "@flag_ch", n: "Henry Bernet" },
            double: [{ f: "@flag_ie", n: "Charles Barry" }, { f: "@flag_fr", n: "Max Westphal" }] },
        ] },
      { type: "gallery", anchor: "photos", items: [
        "assets/photos/open-2026-1.jpg",
        "assets/photos/open-2026-2.jpg",
        "assets/photos/open-2026-3.jpg",
        "assets/photos/open-2026-4.jpg",
        "assets/photos/open-2026-5.jpg",
        "assets/photos/open-2026-7.jpg",
      ]},
      { type: "features", anchor: "infos", title: "Practical information", items: [
        ["Dates", "3rd edition: Saturday 21 to Sunday 29 August 2027."],
        ["Free entry", "Free access all week, no ticket needed."],
        ["Venue", "TC Lausanne-Sports, Plaines-du-Loup, 1018 Lausanne."],
        ["A question?", "Write to us — we answer quickly."],
      ], link: { label: "Get in touch", scroll: "contact-lo" } },
      { type: "sponsors", anchor: "partenaires", title: "Partners of the 2026 tournament",
        sub: "The Lausanne Open would not exist without them." },
    ],
  },

},

details:
{
  "journee-team-lausanne": {
    world: "tournoi", title: "Team Lausanne Day", subtitle: "Saturday, alongside the Lausanne Open — open to everyone",
    metaTitle: "Team Lausanne Day at the Lausanne Open — tennis for all the family",
    metaDescription: "Team Lausanne Day, alongside the Lausanne Open: play with our best players, measure your serve on the radar, taster sessions for children. Free access.",
    hero: "assets/photos/open-kids.jpg",
    sections: [
      { type: "rich", title: "A day of celebration around tennis", body: [
        "Alongside the Lausanne Open, Team Lausanne Day puts tennis within everyone's reach, young and old, in a relaxed atmosphere.",
        "Come and play, try, learn and cheer — access is free.",
      ]},
      { type: "features", title: "What's on", items: [
        ["From 11am", "Play with our best players."],
        ["Radar", "Measure the speed of your serve."],
        ["For the little ones", "Taster sessions for children."],
        ["Around 3pm", "We finish with the doubles final."],
      ]},
      { type: "gallery", items: ["assets/photos/open-kids.jpg", "assets/photos/open-serve.jpg"] },
    ],
  },
  stages: {
    world: "academie", title: "Our camps",
    metaTitle: "Tennis camps in Lausanne during the school holidays | Team Lausanne",
    metaDescription: "Tennis camps during the school holidays in Lausanne, for ages 4 to 18 and for adults: from playful discovery to an intensive week.",
    subtitle: "During the school holidays, tennis camps for ages 4 to 18 and for adults: from playful discovery to an intensive week, run by our coaches at the Plaines-du-Loup.",
    hero: "assets/photos/stages-2026.jpg",
    cta: { label: "Choose my camp", scroll: "stagesec" },
    sections: [
      { type: "keywords", label: "What makes our camps", items: [
        "School holidays", "Ten weeks a year", "Tennis and activities",
        "From age 4 to adults", "Small groups", "At the Plaines-du-Loup",
      ]},
      { type: "formules", eyebrow: "The options",
        title: "A week to suit everyone",
        intro: "From mini-tennis to competitive training, choose by age and by what you feel like. <b>−20% from the 2nd week</b> or for a 2nd member of the family.",
        libelles: { "4-9": "Ages 4 to 9", "9-18": "Ages 9 to 18", adultes: "Adults" },
        items: [
          { name: "Kids Tennis", groupe: "4-9", age: "ages 4 to 9", rythme: "Discover & have fun",
            horaire: "9.00am – 12.00pm",
            lines: ["1h30 of tennis + 1h30 of activities", "Lunch not included"], price: "250 CHF" },
          { name: "Half-day recreational", groupe: "9-18", age: "ages 9 to 18", rythme: "Improve & enjoy it",
            horaire: "9.00am – 12.00pm or 2.00pm – 5.00pm",
            lines: ["1h30 of tennis + 1h30 of activities", "Lunch not included"], price: "290 CHF" },
          { name: "Full-day recreational", groupe: "9-18", age: "ages 9 to 18", rythme: "Improve & enjoy it",
            horaire: "9.00am – 5.00pm",
            lines: ["3h of tennis + 3h30 of activities", "Lunch included"], price: "450 CHF" },
          { name: "Train like a pro", groupe: "9-18", age: "ages 10 to 19 · from R7", rythme: "High performance",
            horaire: "9.00am – 5.00pm",
            lines: ["4h of tennis + 1h30 physical + 1h of activities", "Lunch included", "Optional private lesson +240 CHF (3h)"],
            price: "790 CHF", pro: true },
          { name: "Adult camp", groupe: "adultes", age: "18 and over", rythme: "Adult training",
            horaire: "6.15pm – 7.45pm",
            lines: ["1h30 of tennis a day", "Certain summer weeks only"], price: "240 CHF" },
        ]},
      { type: "stageform", eyebrow: "Upcoming dates", title: "Book your place",
        lead: "Choose your week: the form opens in one click, and the office confirms your booking." },
    ],
  },
  "sport-etudes": {
    world: "academie", title: "Sport Studies",
    metaTitle: "Sport studies tennis in Lausanne (ages 14-19) | Team Lausanne",
    metaDescription: "Sport studies tennis in Lausanne, ages 14 to 19: 2h of tennis, 1h of physical work and 4h of supervised schoolwork a day, through to the maturité or the bac. Lunch included.",
    subtitle: "Combining school and daily training, from 14 to 19: two hours of tennis, one hour of physical preparation and four hours of supervised schoolwork a day, with individual support from the first day to the diploma.",
    hero: "assets/photos/sport-etudes-2026.jpg", heroPos: "30% 40%",
    heroVideo: "assets/video/sport-etudes-hero.mp4",
    cta: { label: "Request the brochure", scroll: "brochure" },
    sections: [
      { type: "keywords", label: "What makes Sport Studies", items: [
        "Supervised schoolwork", "Daily training", "Individual support",
        "Lunch included", "Partner schools", "Towards the maturité",
      ]},
      { type: "split", photos: [
          "assets/photos/sport-etudes-2026-g1.jpg", "assets/photos/sport-etudes-2026-g2.jpg",
        ],
        eyebrow: "The benchmark programme", title: "Study and train, without choosing", body: [
          "Sport studies lets 14 to 19-year-olds combine school and intensive training, in the right setting and with individual support.",
          "The programme runs over 35 weeks following the Vaud school calendar and combines tennis, physical preparation and supervised schoolwork.",
        ], link: { label: "Request the brochure", scroll: "brochure", cta: true } },
      { type: "stats", items: [["35", "weeks / year"], ["2h", "tennis / day"], ["1h", "physical / day"], ["4h", "study / day"]] },
      { type: "filmsec", eyebrow: "In pictures", title: "Aim high, prepare for what comes next",
        lead: "The Sport Studies programme on film.",
        poster: "assets/photos/sport-etudes-video.jpg",
        video: "ZBRb8MNP0nI" },
      { type: "perks", eyebrow: "Complete support",
        title: "Everything is arranged around the player",
        lead: "School, body and mind: nothing is left aside during the three to five years of the journey.", items: [
          ["Lunch", "Included and eaten on site, between training and lessons."],
          ["Partner schools", "Distance learning with Institut DOMI, EPSU and CNED."],
          ["Head of studies", "A dedicated contact: organisation, study methods, keeping track of deadlines."],
          ["Academic support", "Tutors from EPFL and UNIL, as needed."],
          ["The diploma", "Swiss federal maturité or the French baccalauréat."],
          ["Medical and physio", "Medical follow-up, physiotherapy and regular testing."],
          ["Mental preparation", "Mental coaching built into the week."],
          ["And afterwards", "A Swiss university, an American institution (NCAA) or the professional tour."],
        ]},
      { type: "features", title: "Membership and stringing: what is included", items: [
        ["Summer membership covered", "The club's summer membership is paid by the academy: nothing for you to settle."],
        ["Stringing at your cost", "With our friends at Aubert Sport, at the preferential rate of CHF 20 per racket."],
      ]},
      { type: "students", eyebrow: "Meet them",
        title: "Our athletes",
        lead: "Behind the programme there are, above all, players. Tap a card to find out more.", items: [
          { nom: "Talia Dupasquier Picci", age: "18", classement: "R1 (117)",
            photo: "assets/photos/eleve-talia-picci.jpg",
            mytennis: "19757017",
            mot: "Eighteen and already a professional player: making a living from her tennis is the plan. A tournament almost every weekend, and her first international events. She teaches on camps and in Kids Tennis. What drives her: taking everything she can get, and climbing past her R1.",
            tags: ["Best ranking: R1 (99)", "Certified recreational coach, level 1"] },
          { nom: "Célyan Lorival", age: "18", classement: "R2",
            photo: "assets/photos/eleve-celyan-lorival.jpg",
            mytennis: "19764390",
            mot: "Five years of sport studies at Lausanne-Sports, with the bac in his sights. A one-handed backhand, and an admitted weakness for the atmosphere of the interclub. He has been teaching for two years, in lessons and on camps: patient, and as motivated by passing it on as by playing.",
            tags: ["J+S continuing 1", "J+S continuing 2", "Official Swiss Tennis"] },
          { nom: "Nadia Dévaud", age: "15", classement: "R5",
            photo: "assets/photos/eleve-nadia-devaud.jpg",
            mytennis: "19822148",
            mot: "Fifteen, ranked R5, and one year of sport studies at Lausanne-Sports. An attacking game, built on her forehand. Her goal: to reach professional level." },
          { nom: "Hektor Vitone", age: "13", classement: "R4",
            photo: "assets/photos/eleve-hektor-vitone.jpg",
            mytennis: "19874388",
            mot: "Thirteen, ranked R4, and a first year at Lausanne-Sports. More of a baseline player. His dream: to make a living from his tennis and reach the world's top 100." },
          { nom: "Isabella Stadelmann", age: "14", classement: "R4",
            photo: "assets/photos/eleve-isabella-stadelmann.jpg",
            mytennis: "19803666",
            mot: "Fourteen, ranked R4, and a second year of sport studies at Lausanne-Sports. An aggressive game, always moving forward. Ambitious and a perfectionist, always after the best of herself." },
          { nom: "Yuma Olgiati", age: "17", classement: "R4",
            photo: "assets/photos/eleve-yuma-olgiati.jpg",
            mytennis: "19800610",
            mot: "In sport studies at Lausanne-Sports, ranked R4. His profile is coming shortly." },
          { nom: "Ylan Allenspach", age: "16", classement: "R5",
            photo: "assets/photos/eleve-ylan-allenspach.jpg",
            mytennis: "19796976",
            mot: "Sixteen, ranked R5, and a first year at Lausanne-Sports. An attacking player, he likes to take charge of the point and relies on his forehand to make the difference. Training and tournaments take up much of his week, with the urge to test himself against stronger and stronger players. His goal is clear: to reach R3 by Christmas, and keep pushing his limits." },
          { nom: "Max Marten", age: "16", classement: "R2",
            photo: "assets/photos/eleve-max-marten.jpg",
            mytennis: "19781973",
            mot: "Sixteen, ranked R2. He pushes himself every day in training to chase down his goal, and likes testing his limits. Above all he loves playing in a team: together is how you go furthest. Motivated, hard-working, always ready to improve." },
        ]},
      { type: "telecharger", anchor: "calendrier", eyebrow: "Worth keeping to hand",
        title: "The 2026-2027 calendar",
        lead: "The 35 weeks of Sport Studies on one page: the start of the season, the holidays, the academy's closures and the camp weeks.",
        points: [
          "Training restarts on Monday 31 August 2026",
          "Season ends Friday 2 July 2027, summer camps from the 5th",
          "School holidays and public holidays of the Canton of Vaud",
        ],
        href: "assets/calendriers/calendrier-2026-27-sport-etudes.pdf",
        apercu: "assets/calendriers/calendrier-2026-27-sport-etudes-apercu.jpg",
        bouton: "Download the calendar" },
      { type: "brochure", anchor: "brochure",
        eyebrow: "2026 brochure", title: "The programme in detail, in your inbox",
        lead: "How a week unfolds, the partner schools, the support and the admission conditions — eleven pages to tell you everything before you write to us.",
        doc: "assets/brochures/sport-etudes-2026-fr.pdf",
        bouton: "Request the brochure",
        mention: "Your address is used only to send you the brochure and to get back to you. No mailing list." },
      { type: "faq", eyebrow: "Frequently asked questions",
        title: "Everything worth knowing before applying", items: [
          ["Who is the programme for?", "Players aged 14 to 19 who want to train every day without giving up their schooling."],
          ["How do lessons work?", "By distance learning, with Institut DOMI, EPSU or CNED, on our premises and under the guidance of a head of studies. Four hours a day, supervised."],
          ["Which diploma do you prepare for?", "The Swiss federal maturité or the French baccalauréat, depending on each student's path."],
          ["What does a day look like?", "Two hours of tennis, one hour of physical preparation and four hours of study, with lunch eaten on site."],
          ["And after Sport Studies?", "University in Switzerland, an American institution (NCAA) or the professional tour. The programme builds the independence and time management that serve in all three."],
          ["How do I apply?", "Ask for the brochure or write to us: we arrange a conversation, then an assessment on court."],
        ]},
    ],
  },
  competition: {
    world: "academie", title: "Competition",
    metaTitle: "Junior competition tennis in Lausanne (ages 10-13) | Team Lausanne",
    metaDescription: "Competition pathway for ages 10-13 in Lausanne: structured training, matches and tournaments for young players ready to step up. Sixteen places.",
    subtitle: "Structured training and matches, for young players ready to step up: building consistency, confidence and a competitive edge, along a clear path of progression.",
    hero: "assets/photos/competition-2026.jpg",
    cta: { label: "Request information", scroll: "enroll-sec" },
    sections: [
      { type: "keywords", label: "What makes the Competition pathway", items: [
        "Selective pathway", "Small groups by level", "Junior tournaments",
        "GameZone", "Competitive spirit", "Towards Performance",
      ]},
      { type: "split", photos: [
          "assets/photos/competition-2026-s2.jpg", "assets/photos/competition-2026-s1.jpg",
          "assets/photos/competition-2026-s3.jpg", "assets/photos/competition-2026-s4.jpg",
        ],
        eyebrow: "A step to take", title: "Entering competition", body: [
          "The Competition pathway takes young players of roughly 10 to 13 who want to measure themselves against others and improve within a structured setting.",
          "16 places per selection. Age is only a guide: those who do not join the pathway carry on in the Club pathway.",
        ], link: { label: "Join the pathway", scroll: "enroll-sec", cta: true } },
      { type: "perks", eyebrow: "What sets the pathway apart",
        title: "A setting built for competition",
        lead: "For those ready to train more regularly and to play the matches that make you better.", items: [
          ["Roughly 10 to 13", "A selective pathway, sixteen places per selection."],
          ["Groups by level", "Regular, supervised training in very small groups of similar standard."],
          ["Tournaments and GameZone", "Competition throughout the season, prepared with the coaches."],
          ["Three gatherings", "Afternoons reserved for the pathway, on top of the week: tennis, physical, mental and team spirit."],
          ["A stepping stone", "The natural next step is the Performance pathway."],
        ]},
      { type: "rdv", eyebrow: "On top of the week",
        title: "The season's gatherings",
        lead: "Three afternoons reserved for the players in the pathway. Each one opens with time together, then continues in workshops with our coaches. Players from the Academy come to share their experience.",
        ateliers: [["Tennis", "balle", "fluo"], ["Physical preparation", "haltere", "blue"], ["Mental", "cerveau", "ocean"], ["Team spirit", "equipe", "prussian"]],
        items: [
          { jour: "Wednesday", date: "7 October", an: "2026", heures: "4.00pm – 6.30pm" },
          { jour: "Saturday", date: "20 February", an: "2027" },
          { jour: "Saturday", date: "17 April", an: "2027" },
        ],
        note: "Attendance by registration. Times and practical details are sent out before each gathering.",
        link: { label: "Register for a gathering", contact: "Competition gathering" } },
      { type: "slots", eyebrow: "A typical week",
        title: "Training and price",
        lead: "Two sessions a week: two hours of tennis and one hour of physical preparation.", items: [
          { titre: "Session 1", heures: ["1h of tennis"] },
          { titre: "Session 2", heures: ["1h of tennis", "1h of physical"] },
        ],
        prix: { label: "Full season · 35 weeks", montant: "CHF 1'990.–",
                detail: "2h of tennis and 1h of physical per week",
                cta: { label: "Join the pathway", scroll: "enroll-sec" } },
        note: "The pathway then opens on to Performance." },
      { type: "faq", eyebrow: "Frequently asked questions",
        title: "Everything worth knowing before starting", items: [
          ["Who is the pathway for?", "Players of roughly 10 to 13 who already have solid foundations and want to train more regularly in order to enter competition."],
          ["Is it suitable for beginners?", "No. You start with Kids Tennis or the Club pathway. Competition assumes the basics are already in place."],
          ["How is the selection made?", "On age, standard, background and motivation. The pathway has sixteen places, and age is only a guide, give or take a year or two."],
          ["What do you work on?", "Technical consistency, reading the game tactically, movement and attitude in matches — what makes the difference once the score is running."],
          ["Which competitions?", "Junior tournaments and GameZone events, throughout the season, with the coaches to prepare and to debrief."],
          ["And then?", "The Performance pathway takes over for those who confirm."],
        ]},
      { type: "telecharger", anchor: "calendrier", eyebrow: "Worth keeping to hand",
        title: "The 2026-2027 calendar",
        lead: "The whole tennis school season on one page: the start of the season, the holidays, the academy's closures and the camp weeks.",
        points: [
          "Training restarts on Monday 31 August 2026",
          "Season ends Friday 2 July 2027",
          "School holidays and public holidays of the Canton of Vaud",
        ],
        href: "assets/calendriers/calendrier-2026-27-ecole-de-tennis.pdf",
        apercu: "assets/calendriers/calendrier-2026-27-ecole-de-tennis-apercu.jpg",
        bouton: "Download the calendar" },
      { type: "enroll", title: "Request a place", filiere: "competition", ranking: true,
        lead: "Interested in the Competition pathway? Fill in this form and the office will get back to you." },
    ],
  },
  performance: {
    world: "academie", title: "Performance",
    metaTitle: "Junior performance tennis in Lausanne (ages 12-15) | Team Lausanne",
    metaDescription: "Performance pathway for ages 12-15 in Lausanne: a heavier training load and physical preparation built in, the link towards sport studies. Eight places.",
    subtitle: "The pathway that bridges Competition and Sport Studies: a heavier training load, physical preparation built in and the demands of match play, for young players ready to move up a gear.",
    hero: "assets/photos/performance-2026.jpg",
    cta: { label: "Request information", scroll: "enroll-sec" },
    sections: [
      { type: "keywords", label: "What makes the Performance pathway", items: [
        "Heavier training", "Physical preparation", "The demands of match play",
        "Individual support", "Selective pathway", "Towards Sport Studies",
      ]},
      { type: "split", photos: [
          "assets/photos/performance-2026-s1.jpg", "assets/photos/performance-2026-s2.jpg",
          "assets/photos/performance-2026-s3.jpg",
        ],
        eyebrow: "A stage that counts", title: "Aiming for the highest level", body: [
          "The Performance pathway is for young players of roughly 12 to 15 ready to invest more. It overlaps with Competition: age is no barrier, it is a progression that adapts within a year or two.",
          "8 places per selection. The others carry on in Club or Competition.",
        ], link: { label: "Join the pathway", scroll: "enroll-sec", cta: true } },
      { type: "perks", eyebrow: "Why players improve here",
        title: "A more demanding setting, to break through",
        lead: "Everything is built for those ready to train more and to hold that standard across a season.", items: [
          ["Roughly 12 to 15", "A selective pathway, eight places per selection."],
          ["More volume", "A heavier training load, with physical preparation built into the week."],
          ["Close support", "Hands-on coaching and an individual plan."],
          ["Six gatherings", "Afternoons reserved for the pathway, on top of the week: tennis, physical, mental and team spirit."],
          ["What comes next", "Access to Sport Studies, then on to the Pro U18 route."],
        ]},
      { type: "rdv", eyebrow: "On top of the week",
        title: "The season's gatherings",
        lead: "Six afternoons reserved for the players in the pathway. Each one opens with a welcome, then continues in workshops with our coaches, alongside players from the Academy.",
        ateliers: [["Tennis", "balle", "fluo"], ["Physical preparation", "haltere", "blue"], ["Mental", "cerveau", "ocean"], ["Team spirit", "equipe", "prussian"]],
        items: [
          { jour: "Wednesday", date: "7 October", an: "2026", heures: "4.00pm – 6.30pm" },
          { jour: "Saturday", date: "16 January", an: "2027" },
          { jour: "Saturday", date: "20 February", an: "2027" },
          { jour: "Saturday", date: "20 March", an: "2027" },
          { jour: "Saturday", date: "17 April", an: "2027" },
          { jour: "Saturday", date: "15 May", an: "2027" },
        ],
        note: "Attendance by registration. Times and practical details are sent out before each gathering.",
        link: { label: "Register for a gathering", contact: "Performance gathering" } },
      { type: "slots", eyebrow: "A typical week",
        title: "Training and price",
        lead: "Four sessions a week: five hours of tennis and one hour of physical preparation.", items: [
          { titre: "Session 1", heures: ["2h of tennis"] },
          { titre: "Session 2", heures: ["1h of tennis"] },
          { titre: "Session 3", heures: ["1h of tennis", "1h of physical"] },
          { titre: "Session 4", heures: ["1h of tennis"] },
        ],
        prix: { label: "Full season · 35 weeks", montant: "CHF 4'490.–",
                detail: "5h of tennis and 1h of physical per week",
                cta: { label: "Join the pathway", scroll: "enroll-sec" } },
        note: "The pathway then opens on to Sport Studies." },
      { type: "faq", eyebrow: "Frequently asked questions",
        title: "Everything worth knowing before committing", items: [
          ["What is the difference from Competition?", "Competition builds the habits of match play. Performance goes further: more training volume, physical preparation built in, individual support and a clear link towards Sport Studies."],
          ["Who is the pathway for?", "Players of roughly 12 to 15, already competing regularly, ready to invest more across a whole season."],
          ["How is the selection made?", "Eight places, awarded on standard, background and commitment. Age is only a guide: the pathway overlaps with Competition, give or take a year or two."],
          ["What do you work on?", "Technique, reading the game tactically, movement and physical preparation, with the demands of match play running through it all."],
          ["And if the selection does not go through?", "You carry on in Competition or in Club. Nothing is fixed: progress happens at its own pace, and the door stays open the following season."],
          ["And then?", "Sport Studies takes over, then the Pro U18 route for those who confirm."],
        ]},
      { type: "telecharger", anchor: "calendrier", eyebrow: "Worth keeping to hand",
        title: "The 2026-2027 calendar",
        lead: "The whole tennis school season on one page: the start of the season, the holidays, the academy's closures and the camp weeks.",
        points: [
          "Training restarts on Monday 31 August 2026",
          "Season ends Friday 2 July 2027",
          "School holidays and public holidays of the Canton of Vaud",
        ],
        href: "assets/calendriers/calendrier-2026-27-ecole-de-tennis.pdf",
        apercu: "assets/calendriers/calendrier-2026-27-ecole-de-tennis-apercu.jpg",
        bouton: "Download the calendar" },
      { type: "enroll", title: "Request a place", filiere: "performance", ranking: true,
        lead: "Interested in the Performance pathway? Fill in this form and the office will get back to you." },
    ],
  },
  "pro-u18": {
    world: "academie", title: "Pro U18",
    metaTitle: "Pro U18 tennis programme in Lausanne | Team Lausanne",
    metaDescription: "Once compulsory school is behind you, tennis becomes the job: two sessions a day, physical work every morning and the ITF junior circuit in your sights.",
    subtitle: "Once compulsory schooling is over, training becomes the job: two tennis sessions a day, physical work every morning and the ITF junior circuit in your sights, for those who want to see how far this can go.",
    hero: "assets/photos/pro-u18-2026.jpg", heroPos: "55% 12%",
    cta: { label: "Request the information pack", scroll: "brochure" },
    sections: [
      { type: "keywords", label: "What makes Pro U18", items: [
        "Full-time training", "ITF junior circuit", "Two sessions a day",
        "Physio partnership", "Mental preparation", "World ranking",
      ]},
      { type: "split", photos: [
          "assets/photos/pro-u18-2026-s1.jpg", "assets/photos/pro-u18-2026-s2.jpg",
          "assets/photos/pro-u18-2026-s3.jpg",
        ],
        eyebrow: "Tennis as the job", title: "Train full time, aim at the world", body: [
          "With compulsory schooling behind you, the days open up: two tennis sessions, an hour of physical preparation every morning, and the rest of the time to recover and look after yourself.",
          "The junior world ranking is built in tournaments. The programme is designed around the ITF calendar, planned across the whole year.",
        ], link: { label: "Request the information pack", scroll: "brochure", cta: true } },
      { type: "stats", items: [
        ["46", "weeks of training"],
        ["5", "local matches"],
        ["2", "tennis sessions / day"],
        ["5h", "of play a day"],
      ]},
      { type: "slots", eyebrow: "A typical week",
        title: "A professional player's day",
        lead: "Physical work opens the morning, tennis fills the rest of the day.", items: [
          { titre: "9.00am – 10.00am", heures: ["Physical preparation"], note: "Mon → Fri" },
          { titre: "10.15am – 12.15pm", heures: ["Tennis, morning session"], note: "Mon → Fri" },
          { titre: "1.15pm – 3.15pm", heures: ["Tennis, afternoon session"], note: "Mon, Tue, Thu, Fri" },
        ],
        note: "The tournament calendar sits on top of the typical week: during trips, training continues on site." },
      { type: "perks", eyebrow: "What is included",
        title: "Everything is arranged around the player",
        lead: "Body, mind and logistics: nothing should take attention away from the game.", items: [
          ["Physio partnership", "A partnership with a physiotherapist: appointments obtained quickly and treatment assured."],
          ["Mental preparation", "A session with the mental coach every two weeks, built into the programme."],
          ["Regular feedback", "Ongoing feedback and a regular review of progress, goals and planning."],
          ["Lunch", "Included and eaten on site, between the two sessions."],
          ["Stringing and kit", "Strings, rackets and a full clothing kit provided."],
        ],
        note: "Tournaments are not included in the programme: flights, accommodation, meals and entry fees remain the player's responsibility." },
      { type: "faq", eyebrow: "Frequently asked questions",
        title: "Everything worth knowing before committing", items: [
          ["Who is Pro U18 for?", "Players who have finished compulsory schooling, are already settled in competition, and are ready to make tennis their main occupation and to travel to play."],
          ["Do you have to give up studying?", "No. The programme accommodates distance learning or an adapted apprenticeship — the timetable frees up late afternoons and evenings. We discuss it case by case."],
          ["How many tournaments a year?", "There is no fixed number. The calendar is built with the player and their coaches, according to standard, form and goals of the moment — no two seasons are alike. Trips are organised case by case: depending on the tournament and the players entered, you travel alone or with others, with or without an academy coach."],
          ["How is progress measured?", "By the junior world ranking, and by regular reviews with the coaches covering the game, the body and the planning."],
          ["Who pays for the travel?", "Travel costs — flights, accommodation, meals and tournament entries — remain the player's responsibility. The rest of the support is included in the programme."],
          ["And after Pro U18?", "The Pro pathway takes over for those moving on to the professional tour, with an entirely tailored programme."],
        ]},
      { type: "brochure", anchor: "brochure", sujet: "Pro U18",
        eyebrow: "Pro U18 pack", title: "The programme in detail, then we talk",
        lead: "How a week unfolds, the tournament calendar, the support and the admission conditions: we send you the full pack, then come back to you to talk it through.",
        bouton: "Request the information pack",
        mention: "Your address is used only to send you the pack and to get back to you. No mailing list." },
    ],
  },
  pro: {
    world: "academie", title: "Pro",
    metaTitle: "Professional tennis programme in Lausanne | Team Lausanne",
    metaDescription: "Tailored support for players on the professional tour, from 18 upwards: calendar, ranking goals, coaching and physical preparation, in Lausanne.",
    subtitle: "At this level there is no standard offer: every player has their own calendar, their own ranking goals and their own support. We build the programme around you — game, body, mind, logistics and funding.",
    hero: "assets/photos/pro-2026.jpg", heroPos: "center 42%",
    cta: { label: "Request the information pack", scroll: "brochure" },
    sections: [
      { type: "keywords", label: "What makes the Pro pathway", items: [
        "Tailored programme", "ATP / WTA tour", "Complete support",
        "Funding solutions", "Up to 15 tournament weeks", "Accommodation in Lausanne",
      ]},
      { type: "split", photos: [
          "assets/photos/pro-2026-g1.jpg", "assets/photos/open-serve.jpg",
          { src: "assets/photos/pro-2026-court.jpg", pos: "center 42%" },
        ],
        eyebrow: "Tailored, not a package", title: "A programme built around you", body: [
          "At professional level, no two players ever have the same calendar. The support adapts to tournaments, travel, injuries and ranking targets — not the other way round.",
          "Lead coach, physical and mental preparation, physiotherapy, travel logistics: we assemble what you need, and nothing more.",
        ], link: { label: "Request the information pack", scroll: "brochure", cta: true } },
      { type: "stats", items: [
        ["15", "tournament weeks / year"],
        ["46", "weeks of training"],
        ["360°", "of support"],
        ["1", "programme per player"],
      ]},
      { type: "perks", eyebrow: "What we adapt",
        title: "Four levers, set to your situation",
        lead: "The programme is built in conversation, then adjusted through the season.", items: [
          ["The calendar", "Built around your tournaments and your travel, long absences included."],
          ["The support", "Lead coach, physical, mental and physiotherapy — according to what you need at the time."],
          ["The goals", "ATP or WTA points, climbing the ranking, preparing a season or a return from injury."],
          ["The rhythm", "Sessions adjusted to your load, your recovery and the demands of the tour."],
        ]},
      { type: "features", title: "Membership and stringing: what is included", items: [
        ["Summer membership covered", "The club's summer membership is paid by the academy."],
        ["Stringing covered", "Strings are paid for by the academy — a benefit specific to the Pro pathway."],
        ["Winter subscription at your cost", "It is not included in the programme and is settled directly with the club."],
      ]},
      { type: "split", photos: ["assets/webflow/sport-studies.jpg"],
        eyebrow: "The question nobody dares ask", title: "A 360° solution, funding included", body: [
          "Professional tennis is expensive, and that is often what ends careers before the level of play does. We prefer to talk about it at the first meeting.",
          "Several levers exist within the academy to lighten the bill — and they combine.",
        ] },
      { type: "perks", eyebrow: "Funding solutions",
        title: "Five ways to lighten the bill",
        lead: "None is automatic: they are built with you, according to your profile and your availability.", items: [
          ["Interclub", "Funding through playing interclub in the club's colours."],
          ["Paid coaching", "Teaching within the academy, at a rhythm compatible with training."],
          ["GameZone days", "Running junior tournament days, paid."],
          ["Coaching qualifications", "Recognised coaching courses covered, useful for life after the tour."],
          ["Accommodation", "Housing solutions in Lausanne, close to the courts."],
        ]},
      { type: "faq", eyebrow: "Frequently asked questions",
        title: "What to know before we talk", items: [
          ["Who is the Pro pathway for?", "Players already competing in international tournaments and building their season around results and ranking."],
          ["Is there a fixed price?", "No, and that is deliberate: the programme depends on the number of weeks on site, the support chosen and the calendar. The price is set in conversation, once the programme is defined."],
          ["Who pays for the travel?", "Travel costs — flights, accommodation, meals and entries — remain the player's responsibility, as everywhere on the tour. The rest is open to discussion."],
          ["Can you come for part of a season only?", "Yes. Some come for a block of preparation, others for the year. The programme adjusts to the length of stay."],
          ["And if I get injured?", "Physio and medical follow-up is part of the support, and the programme is adjusted during the comeback rather than suspended."],
          ["How do we start?", "With a conversation. We talk about the game, the calendar, the goals and the budget — then we build the programme."],
        ]},
      { type: "brochure", anchor: "brochure", sujet: "Pro",
        eyebrow: "Pro pack", title: "Let's talk about your season",
        lead: "Support, calendar, logistics and funding solutions: we send you the pack, then take the time to talk it through and build the programme with you.",
        bouton: "Request the information pack",
        mention: "Your address is used only to send you the pack and to get back to you. No mailing list." },
    ],
  },
  kids: {
    world: "academie", title: "Kids Tennis", subtitle: "Tennis from age 4, in a playful, structured and supportive setting: our lessons lay solid foundations and give children a taste for the game from the very first sessions.",
    metaTitle: "Children's tennis lessons in Lausanne from age 4 | Team Lausanne",
    metaDescription: "Tennis lessons for children aged 4 to 10 in Lausanne, at the Plaines-du-Loup: a playful, structured and supportive setting for learning the basics. Trial lesson available.",
    hero: "assets/photos/kidstennis-2026.jpg",
    cta: { label: "Request a trial lesson", scroll: "enroll-sec" },
    sections: [
      { type: "keywords", label: "What makes Kids Tennis", items: [
        "Learning through play", "Coaching suited to the age", "Building confidence",
        "A supportive setting", "Structured progression", "Small groups",
      ]},
      { type: "split", photos: [
          "assets/photos/kids-ambiance.jpg", "assets/photos/kids-2026-1.jpg",
          "assets/photos/kids-open.jpg", "assets/photos/kids-2026-2.jpg",
        ],
        eyebrow: "A first step that counts", title: "Learning the game properly", body: [
          "Kids Tennis introduces children aged 4 to 9 to tennis in a playful, gradual way, right through the school year.",
          "The game above all: coordination, movement skills and enjoyment, with equipment suited to each age and coaching close at hand.",
        ], link: { label: "Enrol my child", scroll: "enroll-sec", cta: true } },
      { type: "perks", eyebrow: "Why parents choose us",
        title: "The right setting to start and to improve",
        lead: "Everything is designed so your child learns, enjoys it and improves at their own pace.", items: [
          ["Four children per coach", "A very small group: attention, immediate feedback and real progress."],
          ["All season", "One 45-minute session a week, from 31 August 2026 to 2 July 2027."],
          ["Free T-shirt", "The Team Lausanne Academy T-shirt is given to every child."],
          ["Racket on loan", "No equipment? We lend the racket — just come and play."],
        ]},
      { type: "slots", eyebrow: "Finding the right time",
        title: "Times and price",
        lead: "Choose the slot that fits your child's week.", items: [
          { titre: "Wednesday", heures: ["1.30pm – 2.15pm", "2.15pm – 3.00pm"] },
          { titre: "Tuesday or Thursday", heures: ["4.30pm – 5.15pm"] },
          { titre: "Tailored", heures: ["Late afternoon"], note: "Extra lessons are possible: write to us." },
        ],
        prix: { label: "Full season", montant: "CHF 490.–", detail: "45 minutes a week, equipment and T-shirt included",
                cta: { label: "Enrol my child", scroll: "enroll-sec" } } },
      { type: "faq", eyebrow: "Frequently asked questions",
        title: "Everything worth knowing before starting", items: [
          ["Does my child need to have played before?", "No. The programme suits children discovering tennis just as well as those who have already started."],
          ["What age can they start?", "From around 4, with sessions suited to the age and the level. At this stage the focus is on coordination, movement and the enjoyment of playing."],
          ["How are the groups formed?", "By age, level, experience and availability, so that every child learns in the right environment."],
          ["What equipment do they need?", "Comfortable sportswear and tennis shoes. A racket can be lent, especially for beginners."],
          ["How will my child improve?", "Through coaching suited to their age, coordination work, the technical basics and regular feedback from the coaching team."],
        ]},
      { type: "telecharger", anchor: "calendrier", eyebrow: "Worth keeping to hand",
        title: "The 2026-2027 calendar",
        lead: "The whole tennis school season on one page: the start of the season, the holidays, the academy's closures and the camp weeks.",
        points: [
          "Training restarts on Monday 31 August 2026",
          "Season ends Friday 2 July 2027",
          "School holidays and public holidays of the Canton of Vaud",
        ],
        href: "assets/calendriers/calendrier-2026-27-ecole-de-tennis.pdf",
        apercu: "assets/calendriers/calendrier-2026-27-ecole-de-tennis-apercu.jpg",
        bouton: "Download the calendar" },
      { type: "enroll", title: "Request a place", filiere: "kidstennis", ranking: false,
        lead: "Would you like to enrol your child in Kids Tennis? Fill in this form and the office will get back to you." },
    ],
  },
  "club-academy": {
    world: "academie", title: "Club",
    metaTitle: "Recreational tennis lessons in Lausanne, all levels | Team Lausanne",
    metaDescription: "Tennis lessons in Lausanne, once or twice a week and for all levels: improve at your own pace, all year round, with interclub for club members.",
    subtitle: "Supervised training, once or twice a week, for all levels: improve at your own pace, keep moving and enjoy your time on court, all year round.",
    hero: "assets/photos/club-2026.jpg",
    cta: { label: "Request information", scroll: "enroll-sec" },
    sections: [
      { type: "keywords", label: "What makes the Club offer", items: [
        "Club atmosphere", "Professional coaching", "Steady progress",
        "Learning by playing", "Small groups", "Over the long run",
      ]},
      { type: "split", photos: [
          "assets/photos/club-2026-2.jpg", "assets/photos/club-2026-1.jpg",
          "assets/photos/club-2026-3.jpg",
        ],
        eyebrow: "A place to play and improve", title: "Play and improve, without pressure", body: [
          "The Club offer is for those who want to play one or several hours a week all year round — beginners and more advanced players alike.",
          "Regular training to improve at your own pace, with the option of adding as many weekly sessions as you like.",
        ], link: { label: "Join the Club", scroll: "enroll-sec", cta: true } },
      { type: "perks", eyebrow: "Why join the Club",
        title: "The right balance between coaching and freedom",
        lead: "Everything is set up so each person finds their rhythm, whatever their starting level.", items: [
          ["Four players per coach", "Coaching close at hand, with immediate feedback on court."],
          ["All season", "One hour a week, from 31 August 2026 to 2 July 2027."],
          ["As many sessions as you want", "A second, a third weekly session: the rhythm is yours to choose."],
          ["Free T-shirt", "The Team Lausanne T-shirt is given to every player."],
        ]},
      { type: "slots", eyebrow: "Finding the right time",
        title: "Times and prices",
        lead: "The price depends on the day chosen; the Team Lausanne T-shirt is included in every case.", items: [
          { titre: "Monday", heures: ["5.15pm – 7.15pm"], prix: "770.–" },
          { titre: "Tuesday", heures: ["5.15pm – 7.15pm"], prix: "815.–" },
          { titre: "Wednesday", heures: ["1.15pm – 7.15pm"], prix: "815.–" },
          { titre: "Thursday", heures: ["5.15pm – 7.15pm"], prix: "790.–" },
          { titre: "Friday", heures: ["5.15pm – 7.15pm"], prix: "770.–" },
        ],
        prix: { label: "Full season", montant: "from CHF 770.–",
                cta: { label: "Join the Club", scroll: "enroll-sec" } } },
      { type: "faq", eyebrow: "Frequently asked questions",
        title: "Everything worth knowing before starting", items: [
          ["Do I need to know how to play already?", "A little experience helps, but everyone is placed in the right group according to level, age and background."],
          ["How are the groups formed?", "By age, level, timetable and individual needs, so that everyone trains in the right environment."],
          ["How often do you train?", "One hour a week in the slot you choose, plus as many extra sessions as you want."],
          ["What about competition?", "A few competitions through the season, if you fancy it and with no obligation. Club members can also play interclub, subject to availability."],
          ["What is included?", "Supervised group training, progress tracking through the season, and the Team Lausanne T-shirt."],
        ]},
      { type: "telecharger", anchor: "calendrier", eyebrow: "Worth keeping to hand",
        title: "The 2026-2027 calendar",
        lead: "The whole tennis school season on one page: the start of the season, the holidays, the academy's closures and the camp weeks.",
        points: [
          "Training restarts on Monday 31 August 2026",
          "Season ends Friday 2 July 2027",
          "School holidays and public holidays of the Canton of Vaud",
        ],
        href: "assets/calendriers/calendrier-2026-27-ecole-de-tennis.pdf",
        apercu: "assets/calendriers/calendrier-2026-27-ecole-de-tennis-apercu.jpg",
        bouton: "Download the calendar" },
      { type: "enroll", title: "Request a place", filiere: "club", ranking: false,
        lead: "Would you like to join the Club offer? Fill in this form and the office will get back to you." },
    ],
  },
  adultes: {
    world: "academie", title: "Adult and private lessons", subtitle: "2026-2027 season — private, semi-private and group lessons, all levels",
    metaTitle: "Adult and private tennis lessons in Lausanne | Team Lausanne",
    metaDescription: "Tennis lessons for adults in Lausanne: private, semi-private and group lessons, all levels, in French or English, at TC Lausanne-Sports.",
    hero: "assets/photos/adultes-2026.jpg", heroPos: "center 45%",
    sections: [
      { type: "rich", title: "Adult and private lessons, all season", body: [
        "Team Lausanne Cours Adultes is the association that now runs all adult and private lessons for TC Lausanne-Sports and Team Lausanne.",
        "Private, semi-private and group lessons for adults, all levels, from beginner to ranked player, in French or in English.",
      ]},
      { type: "features", title: "In practice", items: [
        ["Venue", "TC Lausanne-Sports, Route des Plaines-du-Loup 7, 1018 Lausanne."],
        ["Season", "From 26 October 2026 to 2 July 2027."],
        ["Rhythm", "One-hour lessons, a fixed weekly slot reserved for the whole season (29 to 31 weeks depending on the day chosen)."],
        ["Frequency", "Once, twice or three times a week, with the option of 2-hour consecutive slots."],
        ["Language", "Lessons given in French or in English."],
      ]},
      { type: "features", title: "Our formats", items: [
        ["Private lesson", "1 person: tailored progress with the coach."],
        ["Semi-private lesson", "2 people: a hitting partner, and the coach's attention."],
        ["Group lesson — 3 people", "A small group of similar standard."],
        ["Group lesson — 4 people", "The most sociable format, rallies and points played."],
        ["Flexible format", "Join any group lesson (3 or 4 people) according to your level and your availability."],
      ]},
      { type: "features", title: "Conditions", items: [
        ["Commitment", "Registration for the whole season, with a reserved slot."],
        ["Absences", "Lessons are not refunded, except for long-term injury or illness with a medical certificate: a refund is possible after 4 weeks of continuous absence."],
        ["Catch-up", "No lesson — private, semi-private or group — can be made up."],
        ["Payment", "In 1 or 3 instalments."],
        ["Places", "Limited, allocated in order of registration, confirmed on receipt of payment or of the first instalment."],
      ]},
      { type: "enroll", filiere: "adultes", adultes: true, title: "I'm interested",
        lead: "No commitment: tell us which format interests you and when you are free, and the head of adult and private lessons will come back to you with a slot, a coach and the prices." },
    ],
  },
  gamezone: {
    world: "academie", title: "Game Zone",
    metaTitle: "Game Zone — junior tennis tournaments in Lausanne",
    metaDescription: "Junior tennis tournaments almost every weekend in Lausanne: a single day, two matches guaranteed, a medal for every win.",
    subtitle: "Junior tournaments almost every weekend, on a single day and with two matches guaranteed. A medal for every win, a cup from the fifth, and the big cup at the tenth — a way into competition without the pressure.",
    hero: "assets/photos/gamezone-2026.jpg", heroPos: "55% 45%",
    heroLogo: "assets/logo-gamezone-blanc.png",
    sections: [
      { type: "rich", title: "How it works", body: [
        "Almost every weekend, Game Zone runs junior tournaments over a single day, with two matches guaranteed per player.",
        "The ideal format for getting into competition and building experience — and for going after the big cup on the 10th win! A small cup is already awarded at 5 wins, and a medal for every win.",
      ], link: { label: "See the upcoming tournaments ↗", href: "@gamezone_url" } },
      { type: "gzphotos" },
      { type: "gzwinners", title: "Our winners this season" },
    ],
  },
  coaches: {
    world: "academie", title: "Our coaches",
    metaTitle: "Tennis coaches in Lausanne — the team | Team Lausanne",
    subtitle: "Our team brings together experience spanning Kids Tennis, Club, Competition, Performance, Sport Studies and Pro. Every coach builds a setting where players improve with clarity, consistency and confidence.",
    hero: "assets/photos/coaches-hero.webp", heroPos: "center 35%",
    cta: { label: "Get in touch", contact: "Our coaches" },
    sections: [
      { type: "keywords", label: "What makes our coaching", items: [
        "From Kids Tennis to Pro", "Qualified coaches", "Individual follow-up",
        "A close-knit team", "International experience", "Progress above all",
      ]},
      { type: "coachs", eyebrow: "Our coaching team",
        title: "A team built around progress",
        lead: "Our coaches work together, so that the coaching stays consistent at every level — from the first balls through to Sport Studies and Pro.",
        items: "@coachs" },
    ],
  },
},

};
