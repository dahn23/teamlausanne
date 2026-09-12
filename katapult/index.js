/* Katapult — site public (katapultapp.com). Animations légères + formulaire Netlify. */
(function () {
  document.getElementById("year").textContent = new Date().getFullYear();

  // Apparition au défilement
  var els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add("in"); });
  }

  // Barre de navigation : fond plein après le hero
  var nav = document.getElementById("nav");
  var onScroll = function () { nav.classList.toggle("solid", window.scrollY > 40); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Défilement doux vers les ancres
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var t = document.querySelector(a.getAttribute("href"));
    if (!t) return;
    e.preventDefault();
    var y = t.getBoundingClientRect().top + window.pageYOffset - 72;
    window.scrollTo({ top: y, behavior: "smooth" });
  });

  // Formulaire de contact (Netlify Forms) sans quitter la page
  var f = document.getElementById("cform");
  if (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = document.getElementById("csend"), m = document.getElementById("cmsg");
      b.disabled = true; m.className = "fmsg"; m.textContent = "Sending…";
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(new FormData(f)).toString()
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        f.reset();
        m.className = "fmsg ok";
        m.textContent = "Thank you, your message is on its way. We will get back to you personally.";
      }).catch(function () {
        m.className = "fmsg ko";
        m.textContent = "Sending failed. Please write to dan@katapultapp.com directly.";
      }).finally(function () { b.disabled = false; });
    });
  }
})();
