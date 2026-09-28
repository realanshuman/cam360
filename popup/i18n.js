/*
 * Cam360 — i18n.js
 * ------------------------------------------------------------------
 * Fills the extension's own pages (the popup and the camera grant tab)
 * from _locales. The markup keeps its English text as the fallback, so a
 * missing message shows English rather than a blank.
 *
 * An element names its message with data-i18n for its text, or with
 * data-i18n-title, data-i18n-aria-label and data-i18n-placeholder for those
 * attributes. Scripts call Cam360I18n.t(key, substitutions, fallback).
 *
 * Loaded before the page's own script, so the text is right on first paint.
 */
(() => {
  "use strict";

  function t(key, subs, fallback) {
    let m = "";
    try { m = subs == null ? chrome.i18n.getMessage(key) : chrome.i18n.getMessage(key, subs); } catch (_) {}
    return m || fallback || "";
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const m = t(el.getAttribute("data-i18n"));
      if (m) el.textContent = m;
    });
    ["title", "aria-label", "placeholder"].forEach((attr) => {
      scope.querySelectorAll("[data-i18n-" + attr + "]").forEach((el) => {
        const m = t(el.getAttribute("data-i18n-" + attr));
        if (m) el.setAttribute(attr, m);
      });
    });
  }

  /* The language the page is actually in, which is the extension's chosen
     locale, not necessarily the browser's: a browser in Italian gets the
     English fallback, and screen readers should be told it is English. */
  document.documentElement.lang = t("lang") || "en";
  apply();

  window.Cam360I18n = { t, apply };
})();
