// ===========================================================================
//  pages-en/manifeste.js — les pages AUTONOMES et leur version anglaise
// ---------------------------------------------------------------------------
// Les quatorze pages de programme sont fabriquées depuis des DONNÉES
// (contenu.js / contenu-en.js) : traduire, c'est y écrire du texte. Deux
// pages ne marchent pas comme ça — le Cercle du Président et la politique de
// confidentialité sont écrites directement en HTML, avec leur propre mise en
// page. Pour celles-là, la version anglaise est un FICHIER PARALLÈLE.
//
// Pourquoi pas une table de fragments, comme CHROME_EN pour le gabarit :
//   · ce sont de longs textes en prose, coupés par des retours à la ligne et
//     de l'indentation — des fragments exacts y deviennent illisibles et
//     cassants ;
//   · une politique de confidentialité doit pouvoir se RELIRE comme une
//     page, pas comme une liste de bouts de phrases. C'est un texte
//     juridique, quelqu'un le vérifiera un jour ligne à ligne.
//
// LE RISQUE DE CETTE FORME, et comment on le tient :
// deux fichiers divergent. On corrige le français, on oublie l'anglais, et
// le site sert pendant des mois une politique qui ne dit plus la même chose
// dans les deux langues. D'où `empreinte` : build.mjs calcule celle du
// fichier FRANÇAIS et S'ARRÊTE si elle a changé.
//
// QUAND LE BUILD S'ARRÊTE ICI, la marche à suivre est :
//   1. relire ce qui a changé côté français ;
//   2. reporter le changement dans pages-en/<fichier> ;
//   3. recalculer l'empreinte et la coller ci-dessous :
//        node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(f.readFileSync('site/<fichier>','utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,16))"
//
// ⚠⚠ L'EMPREINTE SE CALCULE SUR LE TEXTE EN LF, jamais sur les octets bruts.
// Git réécrit les fins de ligne au checkout : CRLF sous Windows, LF sur les
// serveurs de Netlify. Une empreinte prise sur les octets vaut donc pour UNE
// machine et arrête le build sur l'autre — c'est arrivé, et ça n'avait rien à
// voir avec la traduction.
// Ne JAMAIS se contenter de mettre l'empreinte à jour : ce serait éteindre
// l'alarme sans éteindre le feu.
// ===========================================================================

// Deux formes, et le choix se fait sur une seule question : la page
// porte-t-elle beaucoup de MISE EN PAGE à elle ?
//   · `en` — un fichier parallèle. Pour un texte qui doit se relire comme
//     une page (la politique de confidentialité).
//   · `table` — une table de fragments appliquée au fichier français. Pour
//     une page qui porte 340 lignes de CSS qu'on ne veut pas voir vivre en
//     double, où la deuxième copie serait oubliée à la première retouche.
import { CERCLE_EN } from "./cercle.js";

export const PAGES_AUTONOMES = [
  {
    fr: "cercle-du-president.html",
    table: CERCLE_EN,
    slug: "presidents-club",
    empreinte: "66ac25d55368e3be",
    sitemap: true,
  },
  {
    fr: "confidentialite.html",          // la source française, à la racine de site/
    en: "privacy.html",                  // sa traduction, dans pages-en/
    slug: "privacy",                     // servie à /en/privacy
    empreinte: "5941a6d68945ea9f",
    // Une politique de confidentialité se lit, elle ne s'explore pas : elle
    // n'a pas sa place dans le plan du site, pas plus que la version
    // française (qui n'y figure pas non plus par priorité, mais y est).
    sitemap: true,
  },
];
