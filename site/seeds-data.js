// =====================================================================
//  Les 8 têtes de série — mêmes données que welcome.lausanneopen.ch.
//  « best » = meilleur classement en carrière ; quand il égale « atp »,
//  la carte affiche « au meilleur de sa carrière » plutôt que le chiffre.
// =====================================================================
export const SEEDS = [
  { n: 1, nom: "Andrey Chepelev", pays: "Neutre", drapeau: "neutre", atp: 353, best: 339, photo: "chepelev.png",
    bio: "Né le 2 août 1998. Il arrive avec le meilleur classement du tableau." },
  { n: 2, nom: "Johan Nikles", pays: "Suisse", drapeau: "ch", atp: 412, best: 256, photo: "nikles.png",
    bio: "Genevois né le 23 mars 1997, l’un des visages familiers du tennis romand." },
  { n: 3, nom: "Henry Bernet", pays: "Suisse", drapeau: "ch", atp: 436, best: 397, photo: "bernet.webp",
    bio: "Tenant du titre et ancien numéro 1 mondial junior : il a gagné l’Open d’Australie junior le jour de ses 18 ans." },
  { n: 4, nom: "Lorenzo Carboni", pays: "Italie", drapeau: "it", atp: 481, best: 415, photo: "carboni.jpg",
    bio: "Jeune joueur italien en progression sur le circuit ITF." },
  { n: 5, nom: "Dimitris Sakellaridis", pays: "Grèce", drapeau: "gr", atp: 556, best: 556, photo: "sakellaridis.png",
    bio: "Né le 30 avril 2006. Il connaît déjà les lieux : finaliste du double au Lausanne Open 2025." },
  { n: 6, nom: "Alexander Weis", pays: "Italie", drapeau: "it", atp: 594, best: 285, photo: "weis.jpg",
    bio: "Né à Bolzano, la même région que Sinner et Seppi. Professionnel depuis 2015, le plus expérimenté des huit." },
  { n: 7, nom: "Nino Ehrenschneider", pays: "Allemagne", drapeau: "de", atp: 599, best: 517, photo: "ehrenschneider.webp",
    bio: "25 ans. Meilleur classement en carrière : 517ᵉ mondial." },
  { n: 8, nom: "Oleksandr Ovcharenko", pays: "Ukraine", drapeau: "ua", atp: 613, best: 296, photo: "ovcharenko.jpg",
    bio: "24 ans. Il a atteint la 296ᵉ place mondiale, c’est l’un des meilleurs classements en carrière du tableau." },
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
  de: `<svg viewBox="0 0 60 40"><rect width="60" height="13.34" fill="#000"/>
       <rect y="13.34" width="60" height="13.33" fill="#DD0000"/>
       <rect y="26.67" width="60" height="13.33" fill="#FFCE00"/></svg>`,
  ua: `<svg viewBox="0 0 60 40"><rect width="60" height="20" fill="#0057B7"/>
       <rect y="20" width="60" height="20" fill="#FFDD00"/></svg>`,
  neutre: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#c8cede"/>
       <path d="M8 20h44" stroke="#6b7490" stroke-width="3" stroke-linecap="round"/></svg>`,
};
