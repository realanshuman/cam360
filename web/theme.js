/* Cam360 theme switch: light, dark, or follow the system.
   Shared by every page. The no flash snippet that applies the saved choice
   before first paint stays inline in each page's <head>; this only wires the
   control and keeps the theme dependent bits in sync. */
(function () {
  var root = document.documentElement;
  var buttons = [].slice.call(document.querySelectorAll("[data-theme-set]"));
  if (!buttons.length) return;

  var shot = document.getElementById("heroShot");   /* home page only */
  var meta = document.querySelector('meta[name="theme-color"]');
  var mq = window.matchMedia("(prefers-color-scheme: dark)");

  function current() {
    try { return localStorage.getItem("cam360-theme") || "system"; } catch (e) { return "system"; }
  }
  function isDark() {
    var c = current();
    return c === "dark" || (c === "system" && mq.matches);
  }
  function paint() {
    var choice = current();
    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.themeSet === choice));
    });
    var dark = isDark();
    /* The <picture> covers the system case; override it when a choice is set. */
    if (shot) shot.src = dark ? "/assets/popup-dark.png" : "/assets/popup-light.png";
    if (meta) meta.setAttribute("content", dark ? "#14120e" : "#fffdf8");
  }
  function apply(choice) {
    try { localStorage.setItem("cam360-theme", choice); } catch (e) {}
    if (choice === "system") delete root.dataset.theme;
    else root.dataset.theme = choice;
    paint();
  }
  buttons.forEach(function (b) {
    b.addEventListener("click", function () { apply(b.dataset.themeSet); });
  });
  if (mq.addEventListener) mq.addEventListener("change", paint);
  paint();
})();
