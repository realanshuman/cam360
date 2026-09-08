/* Cam360 motion layer. No dependencies. Pair with motion.css.
   Load at the end of <body>, or in <head> with defer. */
(function () {
  /* Tells the inline head failsafe that this script arrived. Must stay first. */
  window.__cam360Motion = true;
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* motion.css scopes every hidden state to html.js: no script, nothing hidden. */
  root.classList.add("js");

  /* ---- Sticky nav: one class toggle once the page has scrolled 8px.
     rAF-throttled so a fast scroll does not thrash the class list. */
  var nav = document.querySelector(".nav");
  if (nav) {
    var pending = false;
    var onScroll = function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        nav.classList.toggle("is-scrolled", window.scrollY > 8);
        pending = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); /* set the right state on load and on back/forward restore */
  }

  /* ---- Reveal on scroll for [data-reveal] elements. */
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if (!items.length) return;

  /* Drop the attribute so the reveal rules stop matching and card hover etc. take over. */
  function settle(el) {
    el.classList.remove("is-in");
    el.removeAttribute("data-reveal");
    el.style.removeProperty("--reveal-delay");
  }

  /* Reduced motion, or no IntersectionObserver: show everything, no animation. */
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(settle);
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    var perParent = new Map(); /* stagger counter, keyed by parent node */
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target, i = perParent.get(el.parentNode) || 0; /* siblings arriving together */
      perParent.set(el.parentNode, i + 1);
      var delay = Math.min(i, 5) * 70;              /* 0, 70 ... 350ms, then flat */
      el.style.setProperty("--reveal-delay", delay + "ms");
      el.classList.add("is-in");
      io.unobserve(el);
      setTimeout(function () { settle(el); }, delay + 700); /* 600ms transition + slack */
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });

  items.forEach(function (el) { io.observe(el); });
})();
