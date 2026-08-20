// Embellit tous les <input type="date"> : le calendrier natif (dessiné par l'OS)
// est remplacé par un calendrier stylé. L'input natif reste en place (caché) →
// valeur (yyyy-mm-dd), événement `change`, soumission : inchangés.

const CAL = '<svg class="pd-ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>';
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DOWS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const pad = (n) => String(n).padStart(2, "0");
const parse = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ""); return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null; };

function enhance(input) {
  if (input.dataset.pd) return;
  input.dataset.pd = "1";

  const wrap = document.createElement("div");
  wrap.className = "pd-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  input.classList.add("pd-native");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "pd-trigger";
  const pop = document.createElement("div");
  pop.className = "pd-pop";
  pop.hidden = true;
  wrap.appendChild(trigger);
  wrap.appendChild(pop);

  let viewY, viewM;
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  const nativeSet = (v) => desc.set.call(input, v);

  function fmt(v) { const p = parse(v); return p ? `${pad(p.d)}.${pad(p.mo)}.${p.y}` : ""; }
  function renderTrigger() {
    const v = fmt(input.value);
    trigger.disabled = input.disabled;
    trigger.innerHTML = `<span class="pd-val${v ? "" : " pd-ph"}">${v || "jj.mm.aaaa"}</span>${CAL}`;
  }
  function setVal(v) {
    nativeSet(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    renderTrigger();
    close();
  }
  function buildCal() {
    const first = new Date(viewY, viewM - 1, 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysInM = new Date(viewY, viewM, 0).getDate();
    const sel = parse(input.value);
    const t = new Date();
    let cells = "";
    for (let i = 0; i < startDow; i++) cells += `<span class="pd-day pd-empty"></span>`;
    for (let d = 1; d <= daysInM; d++) {
      const val = `${viewY}-${pad(viewM)}-${pad(d)}`;
      const isSel = sel && sel.y === viewY && sel.mo === viewM && sel.d === d;
      const isToday = t.getFullYear() === viewY && t.getMonth() + 1 === viewM && t.getDate() === d;
      const dis = (input.min && val < input.min) || (input.max && val > input.max);
      cells += `<button type="button" class="pd-day${isSel ? " sel" : ""}${isToday ? " today" : ""}${dis ? " dis" : ""}" data-d="${d}"${dis ? " disabled" : ""}>${d}</button>`;
    }
    pop.innerHTML = `
      <div class="pd-head">
        <button type="button" class="pd-nav" data-nav="-1" aria-label="Mois précédent">‹</button>
        <span class="pd-mtitle">${MONTHS[viewM - 1]} ${viewY}</span>
        <button type="button" class="pd-nav" data-nav="1" aria-label="Mois suivant">›</button>
      </div>
      <div class="pd-dows">${DOWS.map((x) => `<span>${x}</span>`).join("")}</div>
      <div class="pd-grid">${cells}</div>
      <div class="pd-foot">
        <button type="button" class="pd-today">Aujourd'hui</button>
        <button type="button" class="pd-clear">Effacer</button>
      </div>`;
    pop.querySelectorAll(".pd-nav").forEach((b) => b.addEventListener("click", () => shift(+b.dataset.nav)));
    pop.querySelectorAll(".pd-day:not(.pd-empty):not(.dis)").forEach((b) => b.addEventListener("click", () => setVal(`${viewY}-${pad(viewM)}-${pad(+b.dataset.d)}`)));
    pop.querySelector(".pd-today").addEventListener("click", () => { const n = new Date(); setVal(`${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`); });
    pop.querySelector(".pd-clear").addEventListener("click", () => setVal(""));
  }
  function shift(delta) { viewM += delta; if (viewM < 1) { viewM = 12; viewY--; } if (viewM > 12) { viewM = 1; viewY++; } buildCal(); }
  function open() {
    if (input.disabled) return;
    const cur = parse(input.value) || { y: new Date().getFullYear(), mo: new Date().getMonth() + 1 };
    viewY = cur.y; viewM = cur.mo;
    buildCal();
    pop.hidden = false; wrap.classList.add("open");
    document.addEventListener("pointerdown", onDoc, true);
  }
  function close() { pop.hidden = true; wrap.classList.remove("open"); document.removeEventListener("pointerdown", onDoc, true); }
  function onDoc(e) { if (!wrap.contains(e.target)) close(); }

  trigger.addEventListener("click", () => (pop.hidden ? open() : close()));
  input.addEventListener("change", renderTrigger);
  const form = input.closest("form");
  if (form) form.addEventListener("reset", () => setTimeout(renderTrigger, 0));
  // `input.value = …` programmatique → rafraîchit l'affichage
  Object.defineProperty(input, "value", {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) { desc.set.call(this, v); renderTrigger(); },
  });
  const mo = new MutationObserver(renderTrigger);
  mo.observe(input, { attributes: true, attributeFilter: ["disabled", "min", "max"] });

  renderTrigger();
}

function scan(root = document) { root.querySelectorAll('input[type="date"]:not([data-pd])').forEach(enhance); }
function init() {
  scan();
  let t = null;
  new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = null; scan(); }, 50); })
    .observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
