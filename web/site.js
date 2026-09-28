/* Cam360 site: the call to action helpers every page shares.

   First, "send to my computer", for anyone reading on a phone or tablet.
   Those cannot install a Chrome extension, so the button hands the link to the
   share sheet, or copies it, and without script it opens a prefilled email. */
(function () {
  var links = [].slice.call(document.querySelectorAll("[data-send]"));
  if (!links.length) return;

  var url = "https://fuckwebcam.xyz/";
  var share = { title: "Cam360", text: "Add Cam360 to Chrome on your computer:", url: url };
  var toast, hide = 0;

  function say(message) {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-on");
    clearTimeout(hide);
    hide = setTimeout(function () { toast.classList.remove("is-on"); }, 3200);
  }

  function copy(fallback) {
    if (!navigator.clipboard || !window.isSecureContext) { location.href = fallback; return; }
    navigator.clipboard.writeText(url).then(
      function () { say("Link copied. Open it on your computer."); },
      function () { location.href = fallback; }
    );
  }

  links.forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (navigator.share && (!navigator.canShare || navigator.canShare(share))) {
        navigator.share(share).catch(function (err) {
          /* Closing the sheet is a choice, not a failure. */
          if (!err || err.name !== "AbortError") copy(a.href);
        });
      } else {
        copy(a.href);
      }
    });
  });
})();

/* The nav's own button steps aside while a big one is on screen, so the two
   never sit on top of each other asking for the same thing. */
(function () {
  var nav = document.querySelector(".nav");
  var big = [].slice.call(document.querySelectorAll(".cta"));
  if (!nav || !big.length || !("IntersectionObserver" in window)) return;
  var showing = new Set();
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) showing.add(e.target); else showing.delete(e.target);
    });
    nav.classList.toggle("is-quiet", showing.size > 0);
  });
  big.forEach(function (el) { io.observe(el); });
})();
