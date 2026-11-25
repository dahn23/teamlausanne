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
//  TERMS THAT ARE DELIBERATELY NOT TRANSLATED
// ---------------------------------------------------------------------------
// · "Sport-Études" — a Swiss school-and-sport pathway with no English
//   equivalent. Kept in French and explained on first use. Inventing
//   "sport-study school" would describe something that does not exist here.
// · "maturité" — the Swiss school-leaving certificate. Glossed, not replaced
//   by "A-levels" or "high school diploma", which are different awards.
// · "Lausanne Open", "GameZone", "Kids Tennis", "Plaines-du-Loup" — names.
// · "interclub" — the Swiss league format, kept as Swiss Tennis uses it.
// ===========================================================================

export const CONTENU_EN = {

worlds: {

  academie: {
    tag: "Academy", retour: "to the Academy",
    h1: "Tennis school in Lausanne",
    metaTitle: "Tennis in Lausanne: school, sport-études, club | Team Lausanne",
    metaDescription: "Tennis in Lausanne: lessons from age 4, competition, sport-études and pro. 12 courts at the Plaines-du-Loup, 6 of them covered in winter.",
    logo: "assets/logo-academie.webp", heroLogo: "assets/logo-academie-blanc.png",
    slogan: "Play. Progress. Together.",
    desc: "The training centre of Lausanne-Sports Tennis. A complete pathway, from a first rally to high performance, built for every age from 4 upwards.",
    hero: "assets/photos/competition-2026-g1.jpg", heroPos: "center 40%",
    heroVideo: "assets/video/accueil-hero.mp4",
    cta: [{ label: "Our camps", type: "stages" }, { label: "Our GameZone tournaments", type: "gamezone" }, { label: "Our Sport-Études programme", type: "sport-etudes" }],
    sections: [
      { type: "rich", anchor: "philosophie", title: "Our philosophy", body: [
        "Team Lausanne offers complete tennis coaching, suited to every age and every standard of play, within a genuine development pyramid.",
        "Our aim: to bring every young player to a level that would at least let them join an American university programme (NCAA) if they wish, once they hold their Swiss maturité or French baccalauréat.",
      ]},
      { type: "pyramid", title: "How we develop players",
        sub: "At each stage, training and tournament volume rises step by step. That is how a young player tests their own motivation for tennis — our main selection criterion.",
        levels: [
          { name: "Pro · NCAA (USA) · Coach training", meta: "from 18", href: "#pro" },
          { name: "Sport-Études & Pro U18", meta: "limited places", href: "#sport-etudes" },
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
      // ⚠ The coach carousel is deliberately ABSENT here for now. It reads
      // "@coachs", which resolves to the coach list in contenu.js — their
      // summaries, quotes and backgrounds are still in French. Showing it
      // would put six French paragraphs in the middle of an English page.
      // It comes back the day the coach list is translated.
      { type: "carousel", anchor: "programmes", eyebrow: "Tennis for everyone", title: "A programme for every level",
        sub: "From a first rally to high performance, a clear path to improve and enjoy it.",
        items: [
          { name: "Kids Tennis", photo: "assets/photos/kidstennis-2026.jpg", href: "#kids" },
          { name: "Club", photo: "assets/photos/club-2026.jpg", href: "#club-academy" },
          { name: "Competition", photo: "assets/photos/competition-2026-card.jpg", href: "#competition" },
          { name: "Performance", photo: "assets/photos/performance-2026.jpg", href: "#performance" },
          { name: "Sport-Études", photo: "assets/photos/sport-etudes-2026.jpg", href: "#sport-etudes" },
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
          ["Is there a sport-études tennis programme in Lausanne?", "Yes. Team Lausanne's Sport-Études takes 14 to 19-year-olds: two hours of tennis, one hour of physical preparation and four hours of supervised schoolwork a day, through to the Swiss federal maturité or the French baccalauréat. The Pro U18 and Pro programmes extend the path to the professional tour — a complete pathway, and a rare one in Switzerland."],
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
          { label: "Sport-Études (PDF)", href: "assets/calendriers/calendrier-2026-27-sport-etudes.pdf" },
        ] },
    ],
  },

},

// Pages not yet translated are simply absent — see the header. They stay
// French-only until their English version is complete.
details: {

},

};
