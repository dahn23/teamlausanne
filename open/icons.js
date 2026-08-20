// =====================================================================
//  Jeu d'icônes du Player Hub — SVG au trait, 24×24, stroke = currentColor.
//  Même esprit que les icônes du site teamlausanne (traits arrondis, 1.8).
//  Aucun emoji dans l'interface : les emoji changent de dessin selon le
//  téléphone, ces icônes sont identiques partout.
// =====================================================================

const P = {
  /* --- ville & voyage --- */
  city:     `<path d="M3 21h18"/><path d="M4.5 21V8.5l5-3v15.5"/><path d="M9.5 12.5h4.5a2 2 0 0 1 2 2V21"/><path d="M16 21V11l4 2.2V21"/>`,
  church:   `<path d="M12 2v4.5"/><path d="M10 4.2h4"/><path d="M3 21h18"/><path d="M7 21V10.5l5-3.5 5 3.5V21"/><path d="M10.5 21v-4.5h3V21"/>`,
  metro:    `<rect x="5" y="3" width="14" height="13" rx="3.5"/><path d="M5 10h14"/><circle cx="8.7" cy="13" r="1"/><circle cx="15.3" cy="13" r="1"/><path d="M8.5 16l-2 4.5M15.5 16l2 4.5"/>`,
  swiss:    `<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 7.5v9M7.5 12h9"/>`,
  bulb:     `<path d="M9.2 18h5.6"/><path d="M10.2 21h3.6"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.6V18h5.6v-2.6c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z"/>`,
  phone:    `<path d="M15.6 21A12.6 12.6 0 0 1 3 8.4 2.4 2.4 0 0 1 5.4 6h2.1l1.5 3.6-1.8 1.5a10 10 0 0 0 5.7 5.7l1.5-1.8 3.6 1.5v2.1A2.4 2.4 0 0 1 15.6 21z"/>`,
  medal:    `<path d="M9.2 9.6 6 3h4l2.4 4.6M14.8 9.6 18 3h-4"/><circle cx="12" cy="15.5" r="5.5"/><path d="M12 13.4l.8 1.7 1.8.2-1.4 1.3.4 1.8-1.6-.9-1.6.9.4-1.8-1.4-1.3 1.8-.2z"/>`,
  waves:    `<path d="M2.5 8c1.6-2 4.7-2 6.3 0s4.7 2 6.3 0 4.7-2 6.3 0"/><path d="M2.5 13c1.6-2 4.7-2 6.3 0s4.7 2 6.3 0 4.7-2 6.3 0"/><path d="M2.5 18c1.6-2 4.7-2 6.3 0s4.7 2 6.3 0 4.7-2 6.3 0"/>`,
  wine:     `<path d="M8 3h8v3.6a4 4 0 0 1-8 0z"/><path d="M12 10.6V18"/><path d="M8.8 21h6.4"/>`,
  castle:   `<path d="M3 21h18"/><path d="M4 21V8.6l2-1V5h2.6v2.6L12 5l3.4 2.6V5H18v2.6l2 1V21"/><path d="M10 21v-4.2a2 2 0 0 1 4 0V21"/>`,
  tree:     `<path d="M12 3 6.6 12h3.1L6 17.6h12L14.3 12h3.1z"/><path d="M12 17.6V21"/><path d="M9.5 21h5"/>`,
  moon:     `<path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8z"/>`,

  /* --- tournoi --- */
  megaphone: `<path d="M4 10v4h3l6.5 4.2V5.8L7 10z"/><path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.4a7.6 7.6 0 0 1 0 11.2"/>`,
  clipboard: `<path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><rect x="9" y="2.2" width="6" height="4" rx="1.2"/><path d="M8.6 11.5h6.8M8.6 15.5h4.4"/>`,
  racket:    `<ellipse cx="10.4" cy="8.6" rx="5.6" ry="6.6"/><path d="M4.9 8.6h11M10.4 2v13.2"/><path d="M14.1 13.7 19.4 21"/>`,
  ball:      `<circle cx="12" cy="12" r="9"/><path d="M5.2 6.1C7.5 8.1 8.8 10.9 8.8 14c0 1.6-.3 3-.9 4.3"/><path d="M18.8 6.1C16.5 8.1 15.2 10.9 15.2 14c0 1.6.3 3 .9 4.3"/>`,
  trophy:    `<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5V7a3 3 0 0 0 3 3M16 5.5h3V7a3 3 0 0 1-3 3"/><path d="M10 13.5V16h4v-2.5M8 20.5h8M12 16v4.5"/>`,
  calendar:  `<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>`,
  trend:     `<path d="M3 17.5 9.5 11l4 4L21 7.5"/><path d="M15 7.5h6v6"/>`,
  users:     `<circle cx="9" cy="8" r="3.2"/><path d="M2.8 20v-1.2A5 5 0 0 1 7.8 14h2.4a5 5 0 0 1 5 4.8V20"/><path d="M16 5.4a3.2 3.2 0 0 1 0 5.2"/><path d="M17.6 14.3A5 5 0 0 1 21.2 19v1"/>`,

  /* --- logistique --- */
  suitcase: `<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.2A2 2 0 0 1 11 3.2h2a2 2 0 0 1 2 2V7"/><path d="M3 12.5h18"/>`,
  bed:      `<path d="M3 20.5V7"/><path d="M3 12h13.5a4.5 4.5 0 0 1 4.5 4.5v4"/><path d="M3 16.5h18"/><circle cx="7.4" cy="9.4" r="1.8"/>`,
  bus:      `<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M3 10h18"/><circle cx="7" cy="18.4" r="1.6"/><circle cx="17" cy="18.4" r="1.6"/><path d="M6.5 13.2h.01M17.5 13.2h.01"/>`,
  utensils: `<path d="M6 2.5v6a2.2 2.2 0 0 0 4.4 0v-6"/><path d="M8.2 10.7V21.5"/><path d="M17.4 2.5C15.7 4 14.9 5.9 14.9 8.1c0 1.7.8 2.6 2.5 2.8V21.5"/>`,
  mappin:   `<path d="M12 21.2s6.8-5.6 6.8-10.9a6.8 6.8 0 1 0-13.6 0C5.2 15.6 12 21.2 12 21.2z"/><circle cx="12" cy="10.1" r="2.6"/>`,
  file:     `<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5"/>`,

  /* --- backend --- */
  lock:  `<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>`,
  chat:  `<path d="M21 11.6a8 8 0 0 1-11.7 7.1L4 20.5l1.8-5.2A8 8 0 1 1 21 11.6z"/>`,
  gear:  `<circle cx="12" cy="12" r="3.2"/><path d="M12 2.4v2.8M12 18.8v2.8M4.2 4.2l2 2M17.8 17.8l2 2M2.4 12h2.8M18.8 12h2.8M4.2 19.8l2-2M17.8 6.2l2-2"/>`,
  pencil: `<path d="M4 20h4.2L19.6 8.6a2.4 2.4 0 0 0-3.4-3.4L4.8 16.6z"/><path d="M15.2 6.2l3.4 3.4"/>`,
  trash:  `<path d="M4 6.5h16"/><path d="M9.5 6.5V4.8A1.6 1.6 0 0 1 11.1 3.2h1.8a1.6 1.6 0 0 1 1.6 1.6V6.5"/><path d="M6.5 6.5 7.4 20a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-13.5"/><path d="M10.4 10.5v7M13.6 10.5v7"/>`,
  pin:    `<path d="M9.5 3h5l-.7 5.4 3.2 3.2H7l3.2-3.2z"/><path d="M12 11.6V21"/>`,
  alert:  `<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 9.5v4.2M12 16.8h.01"/>`,
  eyeoff: `<path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.8 2.8"/><path d="M6.6 6.8C4.5 8.2 2.9 10.1 2 12c1.8 3.8 5.5 6.4 10 6.4 1.7 0 3.3-.4 4.7-1"/><path d="M9.9 5.8A10 10 0 0 1 12 5.6c4.5 0 8.2 2.6 10 6.4-.8 1.8-2.1 3.3-3.7 4.4"/>`,
};

/** SVG brut, dimensionné par le CSS parent. */
export const svg = (name, cls = "") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

/** Pastille ronde utilisée dans les titres de carte. */
export const ico = (name) => `<span class="ico">${svg(name)}</span>`;

/** Grande icône des écrans vides. */
export const big = (name) => svg(name, "big");
