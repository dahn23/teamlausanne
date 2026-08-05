// Embellit tous les <select> du site : le menu natif (dessiné par l'OS, moche)
// est remplacé par une liste stylée. Le <select> natif reste en place (caché),
// donc la valeur, l'événement `change` et la soumission des formulaires marchent
// exactement comme avant — aucune logique existante n'est à modifier.

const CHEVRON = '<svg class="ps-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

function enhance(select) {
  if (select.dataset.ps || select.multiple || select.size > 1) return;
  select.dataset.ps = "1";

  const wrap = document.createElement("div");
  wrap.className = "ps-wrap";
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);
  select.classList.add("ps-native");
  // On valide en JS dans nos formulaires ; on retire `required` du select caché
  // pour éviter l'erreur "invalid form control is not focusable".
  if (select.required) { select.required = false; select.dataset.psReq = "1"; }

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "ps-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const list = document.createElement("div");
  list.className = "ps-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;

  wrap.appendChild(trigger);
  wrap.appendChild(list);

  let activeIdx = -1;

  const curOpt = () => select.options[select.selectedIndex];
  function renderTrigger() {
    const o = curOpt();
    trigger.disabled = select.disabled;
    const val = o ? o.textContent.trim() : "";
    trigger.innerHTML = `<span class="ps-val${val ? "" : " ps-ph"}">${escapeHtml(val || "—")}</span>${CHEVRON}`;
  }
  function buildList() {
    list.innerHTML = "";
    [...select.options].forEach((o, i) => {
      const it = document.createElement("div");
      it.className = "ps-opt" + (i === select.selectedIndex ? " sel" : "") + (o.disabled ? " dis" : "");
      it.setAttribute("role", "option");
      it.textContent = o.textContent;
      it.dataset.i = i;
      if (!o.disabled) it.addEventListener("mousedown", (e) => { e.preventDefault(); pick(i); });
      list.appendChild(it);
    });
  }
  function positionList() {
    // Ouvre vers le haut s'il n'y a pas la place en bas (dans une modale scrollable)
    const r = trigger.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const wantUp = below < 240 && r.top > below;
    wrap.classList.toggle("ps-up", wantUp);
  }
  function open() {
    if (select.disabled) return;
    buildList();
    list.hidden = false;
    wrap.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    positionList();
    activeIdx = select.selectedIndex;
    highlight();
    const sel = list.querySelector(".ps-opt.sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
    document.addEventListener("pointerdown", onDoc, true);
  }
  function close() {
    list.hidden = true;
    wrap.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onDoc, true);
  }
  function pick(i) {
    if (i < 0 || i >= select.options.length || select.options[i].disabled) return;
    if (select.selectedIndex !== i) {
      select.selectedIndex = i;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    renderTrigger();
    close();
    trigger.focus();
  }
  function highlight() {
    [...list.children].forEach((c, i) => c.classList.toggle("active", i === activeIdx));
    const el = list.children[activeIdx];
    if (el) el.scrollIntoView({ block: "nearest" });
  }
  function move(dir) {
    const n = select.options.length;
    let i = activeIdx;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (!select.options[i].disabled) { activeIdx = i; break; }
    }
    highlight();
  }
  function onDoc(e) { if (!wrap.contains(e.target)) close(); }

  trigger.addEventListener("click", () => (list.hidden ? open() : close()));
  trigger.addEventListener("keydown", (e) => {
    if (list.hidden) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); open(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(activeIdx); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close();
  });

  // Re-synchronise si le code change la valeur ou (re)remplit les options
  select.addEventListener("change", renderTrigger);
  const mo = new MutationObserver(() => { renderTrigger(); if (!list.hidden) buildList(); });
  mo.observe(select, { childList: true, attributes: true, attributeFilter: ["disabled"] });

  // Quand le code fait `select.value = …` ou `.selectedIndex = …` (sans événement
  // `change`), on rafraîchit quand même l'affichage stylé.
  const proto = HTMLSelectElement.prototype;
  ["value", "selectedIndex"].forEach((prop) => {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set) return;
    Object.defineProperty(select, prop, {
      configurable: true,
      get() { return d.get.call(this); },
      set(v) { d.set.call(this, v); renderTrigger(); if (!list.hidden) buildList(); },
    });
  });

  renderTrigger();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function scan(root = document) {
  root.querySelectorAll("select:not([data-ps])").forEach(enhance);
}

// Embellit l'existant + tout <select> ajouté dynamiquement (tableaux, modales…)
function init() {
  scan();
  let t = null;
  const obs = new MutationObserver(() => {
    if (t) return;
    t = setTimeout(() => { t = null; scan(); }, 50);
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
