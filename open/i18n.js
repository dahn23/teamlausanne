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
  // Union Jack (Royaume-Uni), dessiné uniquement en surfaces pleines.
  // Volontairement AUCUN trait (stroke) : la feuille de style applique
  // vector-effect:non-scaling-stroke à toutes les icônes, ce qui rendrait
  // les traits gigantesques à cette taille — le drapeau finissait en simple
  // croix rouge sur blanc, c'est-à-dire le drapeau anglais.
  gb: `<svg viewBox="0 0 60 40">
        <rect width="60" height="40" fill="#012169"/>
        <polygon points="0,0 8,0 60,34.7 60,40 52,40 0,5.3" fill="#fff"/>
        <polygon points="60,0 60,5.3 8,40 0,40 0,34.7 52,0" fill="#fff"/>
        <polygon points="0,0 3.4,0 60,37.7 60,40 56.6,40 0,2.3" fill="#C8102E"/>
        <polygon points="60,0 60,2.3 3.4,40 0,40 0,37.7 56.6,0" fill="#C8102E"/>
        <polygon points="24,0 36,0 36,40 24,40" fill="#fff"/>
        <polygon points="0,14 60,14 60,26 0,26" fill="#fff"/>
        <polygon points="26.4,0 33.6,0 33.6,40 26.4,40" fill="#C8102E"/>
        <polygon points="0,16.4 60,16.4 60,23.6 0,23.6" fill="#C8102E"/>
      </svg>`,
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
  "log.title":   ["Hotel, transport & food", "Hôtel, transport & repas", "Hotel, Transport & Essen",
                  "Hotel, trasporti e pasti", "Hotel, transporte y comidas"],
  "log.hotel":   ["Hotel", "Hôtel", "Hotel", "Hotel", "Hotel"],
  "log.shuttle": ["Transport", "Transport", "Transport", "Trasporti", "Transporte"],
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

  /* ===================================================================
     TEXTES PAR DÉFAUT — traduits ici, et donc traduits pour de vrai.
     Le backend peut les remplacer ponctuellement ; ce qu'il écrit
     s'affiche alors tel quel, dans la langue où c'est saisi.
     =================================================================== */
  "def.hotelNote": [
    "Breakfast is served from 6:30 to 10:00. Reception is open 24/7.",
    "Le petit-déjeuner est servi de 6h30 à 10h00. La réception est ouverte 24h/24.",
    "Frühstück von 6:30 bis 10:00 Uhr. Die Rezeption ist rund um die Uhr besetzt.",
    "La colazione è servita dalle 6:30 alle 10:00. La reception è aperta 24 ore su 24.",
    "El desayuno se sirve de 6:30 a 10:00. La recepción está abierta 24 h."],
  /* Y aller en bus — ces textes contiennent des <b>, ils sont inseres
     tels quels dans app.js, sans echappement. */
  "bus.title": ["Getting there by bus", "Y aller en bus", "Mit dem Bus hin",
                "Arrivare in autobus", "Cómo llegar en autobús"],
  "bus.toHotel": [
    "From <b>Lausanne Gare</b>, take bus <b>20</b> towards <b>Lausanne, Blécherette</b>. Get off <b>4 stops</b> later at <b>Lausanne, St-Roch</b> — the hotel is a few minutes’ walk from there.",
    "Depuis <b>Lausanne Gare</b>, prends le bus <b>20</b> direction <b>Lausanne, Blécherette</b>. Descends <b>4 arrêts</b> plus loin à <b>Lausanne, St-Roch</b> — l’hôtel est à quelques minutes à pied.",
    "Ab <b>Lausanne Gare</b> den Bus <b>20</b> Richtung <b>Lausanne, Blécherette</b> nehmen. Nach <b>4 Haltestellen</b> bei <b>Lausanne, St-Roch</b> aussteigen — von dort sind es ein paar Gehminuten zum Hotel.",
    "Da <b>Lausanne Gare</b>, prendi il bus <b>20</b> in direzione <b>Lausanne, Blécherette</b>. Scendi <b>4 fermate</b> dopo a <b>Lausanne, St-Roch</b> — l’hotel è a pochi minuti a piedi.",
    "Desde <b>Lausanne Gare</b>, toma el bus <b>20</b> dirección <b>Lausanne, Blécherette</b>. Bájate <b>4 paradas</b> después en <b>Lausanne, St-Roch</b> — el hotel está a pocos minutos a pie."],
  "bus.toClub": [
    "The same bus 20 continues <b>4 stops</b> further to <b>Lausanne, Stade Olympique</b> — that is the stop for the tennis club.",
    "Le même bus 20 continue <b>4 arrêts</b> plus loin jusqu’à <b>Lausanne, Stade Olympique</b> — c’est l’arrêt du club de tennis.",
    "Derselbe Bus 20 fährt <b>4 Haltestellen</b> weiter bis <b>Lausanne, Stade Olympique</b> — das ist die Haltestelle des Tennisclubs.",
    "Lo stesso bus 20 prosegue <b>4 fermate</b> fino a <b>Lausanne, Stade Olympique</b> — è la fermata del circolo di tennis.",
    "El mismo bus 20 continúa <b>4 paradas</b> hasta <b>Lausanne, Stade Olympique</b> — es la parada del club de tenis."],
  "bus.back": [
    "Coming back, take bus <b>20</b> towards <b>Lausanne, Gare</b>.",
    "Au retour, prends le bus <b>20</b> direction <b>Lausanne, Gare</b>.",
    "Zurück mit dem Bus <b>20</b> Richtung <b>Lausanne, Gare</b>.",
    "Al ritorno, prendi il bus <b>20</b> in direzione <b>Lausanne, Gare</b>.",
    "A la vuelta, toma el bus <b>20</b> dirección <b>Lausanne, Gare</b>."],
  "bus.card": [
    "Ask at the hotel reception for your free <b>Lausanne Transport Card</b>: it covers buses and the metro for the whole of your stay. Without it, you have to buy a ticket.",
    "Demande à la réception de l’hôtel ta <b>Lausanne Transport Card</b> gratuite : elle couvre les bus et le métro pendant tout le séjour. Sans elle, il faut acheter un billet.",
    "Frag an der Hotelrezeption nach deiner kostenlosen <b>Lausanne Transport Card</b>: Sie gilt während des ganzen Aufenthalts für Busse und Metro. Ohne sie musst du ein Ticket lösen.",
    "Chiedi alla reception dell’hotel la tua <b>Lausanne Transport Card</b> gratuita: copre bus e metro per tutta la durata del soggiorno. Senza, bisogna comprare il biglietto.",
    "Pide en la recepción del hotel tu <b>Lausanne Transport Card</b> gratuita: cubre autobuses y metro durante toda la estancia. Sin ella, hay que comprar billete."],
  "bus.walk": ["On foot from St-Roch to the hotel", "À pied de St-Roch à l’hôtel",
               "Zu Fuss von St-Roch zum Hotel", "A piedi da St-Roch all’hotel",
               "A pie de St-Roch al hotel"],

  "def.restoNote": [
    "Players menu — 15 CHF per dish, drinks not included. There is no badge: just tell the staff you are with the tournament, as a player or an accompanying person.",
    "Menu joueurs — 15 CHF le plat, boissons non comprises. Il n'y a pas de badge : signale simplement que tu fais partie du tournoi, joueur ou accompagnant.",
    "Spielermenü — 15 CHF pro Gericht, Getränke nicht inbegriffen. Es gibt keinen Ausweis: sag einfach, dass du zum Turnier gehörst, als Spieler oder Begleitperson.",
    "Menu giocatori — 15 CHF a piatto, bevande escluse. Non c'è nessun badge: basta dire che fai parte del torneo, come giocatore o accompagnatore.",
    "Menú jugadores — 15 CHF por plato, bebidas no incluidas. No hay acreditación: basta con decir que formas parte del torneo, como jugador o acompañante."],
  "def.balls": [
    "Practice balls are available at the tournament office. Please leave an ID card as a deposit; you get it back when you return the balls.",
    "Des balles d'entraînement sont disponibles au bureau du tournoi. Laisse une pièce d'identité en garantie ; tu la récupères en rendant les balles.",
    "Trainingsbälle gibt es im Turnierbüro. Hinterlege einen Ausweis als Pfand; du bekommst ihn zurück, wenn du die Bälle abgibst.",
    "Le palline da allenamento si ritirano all'ufficio del torneo. Lascia un documento come cauzione; lo riavrai restituendo le palline.",
    "Las pelotas de entrenamiento están en la oficina del torneo. Deja un documento de identidad como fianza; lo recuperas al devolver las pelotas."],
  "def.practiceIntro": [
    "Book a 30-minute practice slot. Enter the name you want to appear on the schedule.",
    "Réserve un créneau d'entraînement de 30 minutes. Indique le nom qui doit apparaître sur le planning.",
    "Buche einen 30-minütigen Trainingsslot. Gib den Namen an, der im Plan erscheinen soll.",
    "Prenota uno slot di allenamento di 30 minuti. Indica il nome che deve apparire sul planning.",
    "Reserva una franja de entrenamiento de 30 minutos. Indica el nombre que debe aparecer en el planning."],

  /* Plats du menu : traduction des libellés servis par défaut. */
  "dish.Pasta bolognese":        ["Pasta bolognese", "Pâtes bolognaise", "Pasta Bolognese", "Pasta alla bolognese", "Pasta boloñesa"],
  "dish.With a side salad":      ["With a side salad", "Avec une salade", "Mit Salat", "Con insalata", "Con ensalada"],
  "dish.Breaded escalope":       ["Breaded escalope", "Escalope panée", "Paniertes Schnitzel", "Cotoletta impanata", "Escalope empanado"],
  "dish.French fries and salad": ["French fries and salad", "Frites et salade", "Pommes frites und Salat", "Patatine fritte e insalata", "Patatas fritas y ensalada"],

  /* ------------------------------------------------- SOIREE DES JOUEURS */
  "pae.title": ["Players’ night — Paella", "Soirée des joueurs — paella",
                "Spielerabend — Paella", "Serata dei giocatori — paella",
                "Noche de los jugadores — paella"],
  "pae.lead": [
    "Tuesday evening, from 18:00 at the Restaurant du Tennis. Sign up so we know how many to cook for.",
    "Mardi soir, dès 18h00 au Restaurant du Tennis. Inscris-toi pour qu’on sache combien de couverts prévoir.",
    "Dienstagabend ab 18:00 Uhr im Restaurant du Tennis. Melde dich an, damit wir wissen, für wie viele wir kochen.",
    "Martedì sera, dalle 18:00 al Restaurant du Tennis. Iscriviti così sappiamo per quanti cucinare.",
    "El martes por la noche, a partir de las 18:00 en el Restaurant du Tennis. Apúntate para que sepamos cuántos somos."],
  "pae.guests": ["Coming with someone?", "Tu viens accompagné ?", "Kommst du in Begleitung?",
                 "Vieni accompagnato?", "¿Vienes acompañado?"],
  "pae.alone":  ["Just me", "Juste moi", "Nur ich", "Solo io", "Solo yo"],
  "pae.join":   ["Sign me up", "Je m’inscris", "Anmelden", "Mi iscrivo", "Me apunto"],
  "pae.leave":  ["Cancel my registration", "Annuler mon inscription", "Anmeldung stornieren",
                 "Annulla la mia iscrizione", "Anular mi inscripción"],
  "pae.confirm":["Cancel your registration?", "Annuler ton inscription ?", "Anmeldung stornieren?",
                 "Annullare la tua iscrizione?", "¿Anular tu inscripción?"],
  "pae.who":    ["Already signed up", "Déjà inscrits", "Bereits angemeldet",
                 "Già iscritti", "Ya apuntados"],
  "pae.count":  ["{n} at the table so far", "{n} couverts pour l’instant", "Bisher {n} Personen",
                 "{n} a tavola per ora", "{n} en la mesa por ahora"],
  "pae.empty":  ["Nobody yet — be the first.", "Personne encore — sois le premier.",
                 "Noch niemand — sei der Erste.", "Ancora nessuno — sii il primo.",
                 "Nadie aún — sé el primero."],
  "pae.done":   ["You’re on the list. See you Tuesday!", "Tu es sur la liste. À mardi !",
                 "Du stehst auf der Liste. Bis Dienstag!", "Sei in lista. A martedì!",
                 "Estás en la lista. ¡Hasta el martes!"],

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

/** Traduit un libellé venu du backend s'il figure au dictionnaire (ex. les
 *  plats du menu), sinon le rend tel quel — jamais de texte qui disparaît. */
export function tr(prefix, text) {
  const key = `${prefix}.${String(text || "").trim()}`;
  return T[key] ? t(key) : text;
}

/** Langue de départ : choix mémorisé, sinon langue du téléphone, sinon anglais. */
export function detectLang() {
  const saved = localStorage.getItem("lo_lang");
  if (saved && ORDER.includes(saved)) return saved;
  const nav = (navigator.languages || [navigator.language || "en"]).map((l) => l.slice(0, 2).toLowerCase());
  return nav.find((l) => ORDER.includes(l)) || "en";
}
