/* Cam360 theme switch: light, dark, or follow the system.
   Shared by every page. The no flash snippet that applies the saved choice
   before first paint stays inline in each page's <head>; this only wires the
   control and keeps the browser's theme colour in step. */
(function () {
  var root = document.documentElement;
  var buttons = [].slice.call(document.querySelectorAll("[data-theme-set]"));
  if (!buttons.length) return;

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
    if (meta) meta.setAttribute("content", dark ? "#161617" : "#f2f2f1");
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
