// ===========================================================================
//  adresses.js — la table des adresses, et rien d'autre
// ---------------------------------------------------------------------------
// Trois programmes lisent cette liste :
//   · build.mjs     — pour savoir quel fichier écrire ;
//   · index.js      — pour relier les pages entre elles dans le navigateur ;
//   · rendu-statique.js — pour réécrire les liens #ancre en vrais chemins.
//
// Elle vit seule dans son fichier pour que le navigateur n'ait pas à
// télécharger tout le moteur de rendu statique — dont il ne se sert jamais —
// simplement pour connaître l'adresse de la page Kids Tennis.
//
// La clé est celle de contenu.js, la valeur l'adresse publique. On ne reprend
// pas la clé telle quelle : « club-academy » et « coaches » sont des noms de
// code, pas des adresses qu'on lit ou qu'on dicte au téléphone.
//
// ⚠️ Changer une adresse ici, c'est casser les liens déjà partagés. Si cela
// devient nécessaire, ajouter une redirection 301 dans netlify.toml, de
// l'ancienne vers la nouvelle.
// ===========================================================================

export const SLUGS = {
  academie: "",                       // la racine
  tournoi: "lausanne-open",
  "journee-team-lausanne": "journee-team-lausanne",
  stages: "stages",
  "sport-etudes": "sport-etudes",
  competition: "competition",
  performance: "performance",
  "pro-u18": "pro-u18",
  pro: "pro",
  kids: "kids-tennis",
  "club-academy": "club",
  adultes: "cours-adultes",
  gamezone: "gamezone",
  coaches: "nos-coachs",
};

// L'inverse, pour que le routeur retrouve la clé depuis l'adresse.
export const CLE_DE_SLUG = Object.fromEntries(
  Object.entries(SLUGS).filter(([, s]) => s).map(([c, s]) => [s, c]));

export const SITE = "https://teamlausanne.ch";
export const urlDe = (cle) => SITE + "/" + (SLUGS[cle] || "");
