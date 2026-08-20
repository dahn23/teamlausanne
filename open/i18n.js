// =====================================================================
//  Libellés d'interface du Player Hub — 5 langues.
//  Le CONTENU des pages « Welcome » est dans content.js ; ici on ne
//  trouve que les mots de l'interface (boutons, titres, messages).
//  Ce qui vient du backend (messages officiels, notes hôtel/resto) reste
//  dans la langue saisie par l'organisation : on ne traduit pas à la volée.
// =====================================================================

export const LANGS = [
  { id: "en", label: "English",  flag: "gb" },
  { id: "fr", label: "Français", flag: "fr" },
  { id: "de", label: "Deutsch",  flag: "de" },
  { id: "it", label: "Italiano", flag: "it" },
  { id: "es", label: "Español",  flag: "es" },
];

// Drapeaux dessinés en SVG (pas d'emoji : Windows n'affiche pas les
// drapeaux emoji, et le rendu change d'un téléphone à l'autre).
export const FLAGS = {
  gb: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#012169"/>
        <path d="M0 0l60 40M60 0L0 40" stroke="#fff" stroke-width="8"/>
        <path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" stroke-width="4"/>
        <path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="13"/>
        <path d="M30 0v40M0 20h60" stroke="#C8102E" stroke-width="8"/></svg>`,
  fr: `<svg viewBox="0 0 60 40"><rect width="20" height="40" fill="#002395"/>
        <rect x="20" width="20" height="40" fill="#fff"/>
        <rect x="40" width="20" height="40" fill="#ED2939"/></svg>`,
  de: `<svg viewBox="0 0 60 40"><rect width="60" height="13.34" fill="#000"/>
        <rect y="13.34" width="60" height="13.33" fill="#DD0000"/>
        <rect y="26.67" width="60" height="13.33" fill="#FFCE00"/></svg>`,
  it: `<svg viewBox="0 0 60 40"><rect width="20" height="40" fill="#008C45"/>
        <rect x="20" width="20" height="40" fill="#fff"/>
        <rect x="40" width="20" height="40" fill="#CD212A"/></svg>`,
  es: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#AA151B"/>
        <rect y="10" width="60" height="20" fill="#F1BF00"/></svg>`,
};

const T = {
  /* ---------------------------------------------------------- ONGLETS */
  "tab.welcome":   ["Welcome", "Bienvenue", "Willkommen", "Benvenuti", "Bienvenida"],
  "tab.info":      ["Info", "Infos", "Infos", "Info", "Info"],
  "tab.logistics": ["Stay", "Séjour", "Aufenthalt", "Soggiorno", "Estancia"],
  "tab.oop":       ["Order of play", "Programme", "Spielplan", "Programma", "Programa"],
  "tab.practice":  ["Practice", "Practice", "Training", "Practice", "Práctica"],
  "tab.sparring":  ["Sparring", "Sparring", "Sparring", "Sparring", "Sparring"],
  "tab.roommate":  ["Roommate", "Colocation", "Zimmer", "Camera", "Compañero"],

  /* ------------------------------------------------ SOUS-ONGLETS WELCOME */
  "sub.city":    ["Lausanne", "Lausanne", "Lausanne", "Losanna", "Lausana"],
  "sub.swiss":   ["Good to know", "À savoir", "Gut zu wissen", "Da sapere", "Conviene saber"],
  "sub.club":    ["The club", "Le club", "Der Club", "Il club", "El club"],
  "sub.academy": ["Academy", "Académie", "Akademie", "Accademia", "Academia"],
  "sub.open":    ["The Open", "Le tournoi", "Das Turnier", "Il torneo", "El torneo"],
  "sub.visit":   ["What to see", "À voir", "Sehenswertes", "Da vedere", "Qué ver"],

  /* ------------------------------------------------------ INFOS OFFICIELLES */
  "info.title": ["Official information", "Informations officielles", "Offizielle Informationen",
                 "Informazioni ufficiali", "Información oficial"],
  "info.lead":  ["Announcements from the tournament desk: weather, delays, schedule changes. This page refreshes on its own.",
                 "Annonces du bureau du tournoi : météo, retards, changements d'horaire. Cette page se rafraîchit toute seule.",
                 "Mitteilungen des Turnierbüros: Wetter, Verspätungen, Programmänderungen. Diese Seite aktualisiert sich selbst.",
                 "Comunicazioni dell'ufficio del torneo: meteo, ritardi, cambi di programma. Questa pagina si aggiorna da sola.",
                 "Comunicados de la oficina del torneo: tiempo, retrasos, cambios de horario. Esta página se actualiza sola."],
  "info.empty": ["No announcement yet. Everything is running as scheduled.",
                 "Aucune annonce pour l'instant. Tout se déroule comme prévu.",
                 "Noch keine Mitteilung. Alles läuft wie geplant.",
                 "Nessun avviso per ora. Tutto procede come previsto.",
                 "Ningún aviso por ahora. Todo va según lo previsto."],
  "info.pinned":    ["Pinned", "Épinglé", "Angeheftet", "In evidenza", "Fijado"],
  "info.urgent":    ["Urgent", "Urgent", "Dringend", "Urgente", "Urgente"],
  "info.important": ["Important", "Important", "Wichtig", "Importante", "Importante"],

  /* ------------------------------------------------------------- SÉJOUR */
  "log.title":   ["Hotel, shuttle & food", "Hôtel, navette & repas", "Hotel, Shuttle & Essen",
                  "Hotel, navetta e pasti", "Hotel, lanzadera y comidas"],
  "log.hotel":   ["Hotel", "Hôtel", "Hotel", "Hotel", "Hotel"],
  "log.shuttle": ["Shuttle", "Navette", "Shuttle", "Navetta", "Lanzadera"],
  "log.resto":   ["Restaurant", "Restaurant", "Restaurant", "Ristorante", "Restaurante"],
  "log.address": ["Address", "Adresse", "Adresse", "Indirizzo", "Dirección"],
  "log.phone":   ["Phone", "Téléphone", "Telefon", "Telefono", "Teléfono"],
  "log.maps":    ["Open in Maps", "Ouvrir dans Maps", "In Maps öffnen", "Apri in Maps", "Abrir en Maps"],
  "log.everyday":["Every day", "Tous les jours", "Täglich", "Tutti i giorni", "Todos los días"],
  "log.noshuttle":["The shuttle timetable is not published yet. Ask at the tournament office.",
                   "Les horaires de navette ne sont pas encore publiés. Renseigne-toi au bureau du tournoi.",
                   "Der Shuttle-Fahrplan ist noch nicht veröffentlicht. Frag im Turnierbüro nach.",
                   "Gli orari della navetta non sono ancora pubblicati. Chiedi all'ufficio del torneo.",
                   "Los horarios de la lanzadera aún no están publicados. Pregunta en la oficina del torneo."],
  "log.nomenu":  ["Menu not published yet", "Menu pas encore publié", "Menü noch nicht veröffentlicht",
                  "Menu non ancora pubblicato", "Menú aún no publicado"],

  /* ---------------------------------------------------------- PROGRAMME */
  "oop.title": ["Order of play", "Programme du jour", "Spielplan", "Programma di gioco", "Orden de juego"],
  "oop.lead":  ["Always check the official board at the tournament office before your match — the order of play can change.",
                "Vérifie toujours le tableau officiel au bureau du tournoi avant ton match : le programme peut changer.",
                "Prüfe vor deinem Match immer die offizielle Anschlagtafel im Turnierbüro — der Spielplan kann sich ändern.",
                "Controlla sempre il tabellone ufficiale all'ufficio del torneo prima della partita: il programma può cambiare.",
                "Consulta siempre el tablón oficial en la oficina del torneo antes de tu partido: el orden puede cambiar."],
  "oop.empty": ["The order of play is not published yet. It is usually posted the evening before play.",
                "Le programme n'est pas encore publié. Il paraît en général la veille au soir.",
                "Der Spielplan ist noch nicht veröffentlicht. Er erscheint meist am Vorabend.",
                "Il programma non è ancora pubblicato. Di solito esce la sera prima.",
                "El orden de juego aún no está publicado. Suele salir la víspera por la noche."],
  "oop.open":  ["Open the order of play", "Ouvrir le programme", "Spielplan öffnen",
                "Apri il programma", "Abrir el orden de juego"],
  "oop.full":  ["Open full size", "Voir en grand", "In voller Grösse öffnen", "Apri a schermo intero", "Ver a tamaño completo"],
  "oop.updated":["Updated", "Mis à jour", "Aktualisiert", "Aggiornato", "Actualizado"],
  "oop.failed": ["Could not load the file.", "Impossible de charger le fichier.", "Datei konnte nicht geladen werden.",
                 "Impossibile caricare il file.", "No se pudo cargar el archivo."],

  /* ----------------------------------------------------------- PRACTICE */
  "prac.title": ["Practice courts", "Courts d'entraînement", "Trainingsplätze", "Campi di allenamento", "Pistas de entrenamiento"],
  "prac.balls": ["Balls", "Balles", "Bälle", "Palline", "Pelotas"],
  "prac.empty": ["No practice schedule is open right now. The next day usually opens the evening before.",
                 "Aucun planning ouvert pour le moment. Le jour suivant s'ouvre en général la veille au soir.",
                 "Zurzeit ist kein Plan offen. Der nächste Tag öffnet meist am Vorabend.",
                 "Nessun planning aperto al momento. Il giorno successivo apre di solito la sera prima.",
                 "No hay planning abierto ahora. El día siguiente suele abrirse la víspera."],
  "prac.foot":  ["Your own bookings are highlighted — tap one to cancel it. Please free a slot you no longer need.",
                 "Tes réservations sont surlignées — touche-les pour annuler. Libère un créneau dont tu n'as plus besoin.",
                 "Deine Buchungen sind hervorgehoben — antippen zum Stornieren. Bitte gib nicht mehr benötigte Slots frei.",
                 "Le tue prenotazioni sono evidenziate — tocca per annullare. Libera uno slot che non ti serve più.",
                 "Tus reservas están resaltadas — tócalas para anular. Libera una franja que ya no necesites."],
  "prac.slots": ["Slots of {n} minutes.", "Créneaux de {n} minutes.", "Slots von {n} Minuten.",
                 "Slot da {n} minuti.", "Franjas de {n} minutos."],
  "prac.book":  ["Book", "Réserver", "Buchen", "Prenota", "Reservar"],
  "prac.name":  ["Your name", "Ton nom", "Dein Name", "Il tuo nome", "Tu nombre"],
  "prac.tap":   ["tap to cancel", "toucher pour annuler", "antippen zum Stornieren",
                 "tocca per annullare", "toca para anular"],
  "prac.enterName": ["Please enter your name.", "Indique ton nom.", "Bitte gib deinen Namen ein.",
                     "Inserisci il tuo nome.", "Introduce tu nombre."],
  "prac.confirm":   ["Cancel this practice slot?", "Annuler ce créneau ?", "Diesen Slot stornieren?",
                     "Annullare questo slot?", "¿Anular esta franja?"],

  /* ------------------------------------------------------ SPARRING / ROOM */
  "spar.title": ["Looking for a sparring partner", "Je cherche un sparring", "Trainingspartner gesucht",
                 "Cerco un compagno di allenamento", "Busco compañero de entrenamiento"],
  "spar.lead":  ["Post what you are looking for — level, time, court. Other players in the draw read this page.",
                 "Écris ce que tu cherches : niveau, horaire, court. Les autres joueurs du tableau lisent cette page.",
                 "Schreib, was du suchst: Niveau, Zeit, Platz. Die anderen Spieler im Tableau lesen diese Seite.",
                 "Scrivi cosa cerchi: livello, orario, campo. Gli altri giocatori del tabellone leggono questa pagina.",
                 "Escribe lo que buscas: nivel, hora, pista. Los demás jugadores del cuadro leen esta página."],
  "spar.ph":    ["e.g. Looking to hit tomorrow 10:00–11:30, ATP 600-900 level, I have a court booked.",
                 "ex. Cherche à taper demain 10h00–11h30, niveau ATP 600-900, j'ai un court réservé.",
                 "z.B. Suche Training morgen 10:00–11:30, ATP 600-900, Platz ist gebucht.",
                 "es. Cerco di giocare domani 10:00–11:30, livello ATP 600-900, ho un campo prenotato.",
                 "p.ej. Busco peloteo mañana 10:00–11:30, nivel ATP 600-900, tengo pista reservada."],
  "room.title": ["Looking for a roommate", "Je cherche un colocataire", "Zimmerpartner gesucht",
                 "Cerco un compagno di stanza", "Busco compañero de habitación"],
  "room.lead":  ["Share a room, split the cost. Post your dates and how to reach you.",
                 "Partager une chambre, partager le prix. Indique tes dates et comment te joindre.",
                 "Zimmer teilen, Kosten teilen. Gib deine Daten an und wie man dich erreicht.",
                 "Dividere la stanza, dividere il costo. Indica le date e come contattarti.",
                 "Compartir habitación, compartir el coste. Indica tus fechas y cómo contactarte."],
  "room.ph":    ["e.g. Looking to share a twin room at the official hotel from Sun to Wed. WhatsApp +33 ...",
                 "ex. Cherche à partager une chambre twin à l'hôtel officiel de dim. à mer. WhatsApp +33 ...",
                 "z.B. Suche Doppelzimmer im offiziellen Hotel von So bis Mi. WhatsApp +33 ...",
                 "es. Cerco di condividere una camera doppia all'hotel ufficiale da dom a mer. WhatsApp +33 ...",
                 "p.ej. Busco compartir habitación doble en el hotel oficial de dom a mié. WhatsApp +33 ..."],
  "board.post":   ["Post", "Publier", "Senden", "Pubblica", "Publicar"],
  "board.msg":    ["Your message", "Ton message", "Deine Nachricht", "Il tuo messaggio", "Tu mensaje"],
  "board.empty":  ["No message yet. Be the first to post.", "Aucun message. Sois le premier.",
                   "Noch keine Nachricht. Sei der Erste.", "Nessun messaggio. Scrivi per primo.",
                   "Ningún mensaje. Sé el primero."],
  "board.del":    ["Delete my message", "Supprimer mon message", "Meine Nachricht löschen",
                   "Elimina il mio messaggio", "Borrar mi mensaje"],
  "board.confirm":["Delete your message?", "Supprimer ton message ?", "Deine Nachricht löschen?",
                   "Eliminare il tuo messaggio?", "¿Borrar tu mensaje?"],
  "board.anon":   ["Anonymous", "Anonyme", "Anonym", "Anonimo", "Anónimo"],
  "board.write":  ["Please write a message.", "Écris un message.", "Bitte schreib eine Nachricht.",
                   "Scrivi un messaggio.", "Escribe un mensaje."],

  /* ------------------------------------------------------------ DIVERS */
  "c.cancel":  ["Cancel", "Annuler", "Abbrechen", "Annulla", "Cancelar"],
  "c.justNow": ["just now", "à l'instant", "gerade eben", "proprio ora", "ahora mismo"],
  "c.minAgo":  ["{n} min ago", "il y a {n} min", "vor {n} Min.", "{n} min fa", "hace {n} min"],
  "c.hAgo":    ["{n} h ago", "il y a {n} h", "vor {n} Std.", "{n} h fa", "hace {n} h"],
  "c.photos":  ["Photos: Wikimedia Commons — see each file page for author and licence.",
                "Photos : Wikimedia Commons — auteur et licence sur la page de chaque fichier.",
                "Fotos: Wikimedia Commons — Autor und Lizenz auf der jeweiligen Dateiseite.",
                "Foto: Wikimedia Commons — autore e licenza sulla pagina di ogni file.",
                "Fotos: Wikimedia Commons — autor y licencia en la página de cada archivo."],
  "c.office":  ["Tournament office", "Bureau du tournoi", "Turnierbüro", "Ufficio del torneo", "Oficina del torneo"],
};

const ORDER = LANGS.map((l) => l.id);
let cur = "en";

export function setLang(id) { cur = ORDER.includes(id) ? id : "en"; }
export function getLang() { return cur; }

/** t("prac.slots", {n: 30}) */
export function t(key, vars) {
  const row = T[key];
  let s = row ? (row[ORDER.indexOf(cur)] || row[0]) : key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

/** Langue de départ : choix mémorisé, sinon langue du téléphone, sinon anglais. */
export function detectLang() {
  const saved = localStorage.getItem("lo_lang");
  if (saved && ORDER.includes(saved)) return saved;
  const nav = (navigator.languages || [navigator.language || "en"]).map((l) => l.slice(0, 2).toLowerCase());
  return nav.find((l) => ORDER.includes(l)) || "en";
}
