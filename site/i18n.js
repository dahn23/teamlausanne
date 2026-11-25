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

// Le libellé, avec repli sur le français plutôt que sur une chaîne vide : un
// mot français sur une page anglaise se voit et se corrige ; un trou, non.
export const t = (lang, cle) => (UI[lang] && UI[lang][cle]) || UI.fr[cle] || "";

// Les clés manquantes d'une langue. build.mjs s'en sert pour échouer fort.
export function clesManquantes(lang) {
  const ref = Object.keys(UI.fr);
  return ref.filter((k) => !(k in (UI[lang] || {})));
}
