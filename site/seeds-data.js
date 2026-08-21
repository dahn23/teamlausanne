// =====================================================================
//  Les 8 têtes de série — mêmes données que welcome.lausanneopen.ch.
//  « best » = meilleur classement en carrière ; quand il égale « atp »,
//  la carte affiche « au meilleur de sa carrière » plutôt que le chiffre.
// =====================================================================
export const SEEDS = [
  { n: 1, nom: "Andrey Chepelev", pays: "Neutre", drapeau: "neutre", atp: 353, best: 339, photo: "chepelev.png",
    bio: "Né le 2 août 1998. Il arrive avec le meilleur classement du tableau." },
  { n: 2, nom: "Gabriele Piraino", pays: "Italie", drapeau: "it", atp: 404, best: 321, photo: "piraino.jpg",
    bio: "22 ans, formé sur le circuit junior italien." },
  { n: 3, nom: "Johan Nikles", pays: "Suisse", drapeau: "ch", atp: 412, best: 256, photo: "nikles.png",
    bio: "Genevois né le 23 mars 1997, l’un des visages familiers du tennis romand." },
  { n: 4, nom: "Henry Bernet", pays: "Suisse", drapeau: "ch", atp: 436, best: 397, photo: "bernet.webp",
    bio: "Tenant du titre et ancien numéro 1 mondial junior : il a gagné l’Open d’Australie junior le jour de ses 18 ans." },
  { n: 5, nom: "Lorenzo Carboni", pays: "Italie", drapeau: "it", atp: 481, best: 415, photo: "carboni.jpg",
    bio: "Jeune joueur italien en progression sur le circuit ITF." },
  { n: 6, nom: "Luca Staeheli", pays: "Suisse", drapeau: "ch", atp: 521, best: 521, photo: "staeheli.jpg",
    bio: "Il arrive lancé : vainqueur de l’ITF M25 de Muttenz le 16 août." },
  { n: 7, nom: "Dimitris Sakellaridis", pays: "Grèce", drapeau: "gr", atp: 556, best: 556, photo: "sakellaridis.png",
    bio: "Ancien numéro 1 mondial junior, finaliste du double au Lausanne Open 2025." },
  { n: 8, nom: "Alexander Weis", pays: "Italie", drapeau: "it", atp: 594, best: 285, photo: "weis.jpg",
    bio: "Né à Bolzano, la même région que Sinner et Seppi. Professionnel depuis 2015, le plus expérimenté des huit." },
];

/* Drapeaux dessinés plutôt qu’en emoji : sous Windows, les drapeaux emoji
   ne s’affichent pas du tout. */
export const DRAPEAUX = {
  ch: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#D52B1E"/>
       <rect x="25" y="9" width="10" height="22" fill="#fff"/><rect x="14" y="15" width="32" height="10" fill="#fff"/></svg>`,
  it: `<svg viewBox="0 0 60 40"><rect width="20" height="40" fill="#008C45"/>
       <rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#CD212A"/></svg>`,
  gr: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#0D5EAF"/>
       <rect y="4.44" width="60" height="4.44" fill="#fff"/><rect y="13.33" width="60" height="4.44" fill="#fff"/>
       <rect y="22.22" width="60" height="4.44" fill="#fff"/><rect y="31.11" width="60" height="4.44" fill="#fff"/>
       <rect width="22.2" height="22.2" fill="#0D5EAF"/>
       <rect x="8.9" width="4.4" height="22.2" fill="#fff"/><rect y="8.9" width="22.2" height="4.4" fill="#fff"/></svg>`,
  neutre: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#c8cede"/>
       <path d="M8 20h44" stroke="#6b7490" stroke-width="3" stroke-linecap="round"/></svg>`,
};
