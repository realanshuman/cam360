/*
 * Cam360 — settings.js
 * ------------------------------------------------------------------
 * The shape of a Cam360 settings object, defined once.
 *
 * Three surfaces need it and none of them can import from each other:
 * engine.js runs in the page's MAIN world, bridge.js in the ISOLATED world
 * where chrome.storage lives, and popup.js in an extension page. Each used
 * to carry its own copy of DEFAULTS, which is three chances for them to
 * drift apart.
 *
 * Only two of them load this file. Chrome injects a content script file once
 * per document even when two content_scripts entries name it for different
 * worlds, so listing it under both silently leaves one world without it.
 * It loads in the ISOLATED world and in the popup; the MAIN world is handed
 * DEFAULTS by bridge.js over postMessage, in the same message that already
 * carries the extension's base URL.
 *
 * It also draws the line between the settings and the media. Uploaded
 * backgrounds, be right back cards and logos are held as data URLs, so a
 * single photo can be several megabytes of base64. Those live under their
 * own storage key: everything that changes while a slider is being dragged
 * has to stay small, because every write is broadcast to every frame of
 * every open tab and cloned again on its way into the MAIN world.
 *
 * Exposes window.Cam360Settings. No imports, no build step.
 */
(() => {
  "use strict";
  if (window.Cam360Settings) return;

  /* Storage keys. MEDIA_KEY is written only when an upload changes. */
  const KEY = "cam360";
  const MEDIA_KEY = "cam360_media";

  /* The data URL fields, and the only reason this split exists. */
  const MEDIA_KEYS = ["bgImage", "bgVideo", "brbImage", "logoImage"];

  const DEFAULTS = {
    enabled: true,
    mirror: false, flipV: false, rotate: 0,
    brightness: 100, contrast: 100, saturation: 100,
    blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100,
    lowLight: false, beautify: 0,
    bg: "off",          // off | blur | color | scene | video
    keyer: "ai",        // ai | chroma
    bgBlur: 14, bgColor: "#0b1020", bgImage: "", bgVideo: "", feather: 4,
    chromaColor: "#00c000", chromaThreshold: 42, chromaSmooth: 14,
    freeze: false, brb: false, brbText: "Be right back", brbImage: "",
    showName: false, nameText: "", showLogo: false, logoImage: "", showClock: false,
    /* Where each overlay sits in the frame: tl | tr | bl | br */
    namePos: "bl", clockPos: "br", logoPos: "tr",
    overlayVisible: false
  };

  /* A named background keeps its id in the same field as an uploaded data
     URL, so "is this an upload" is a prefix test rather than a second flag. */
  const isUpload = (v) => typeof v === "string" && v.slice(0, 5) === "data:";

  function normalize(value) {
    const s = { ...DEFAULTS, ...(value || {}) };
    if (s.bg === "image") s.bg = "scene";   // a value stored by an older build
    return s;
  }

  /* Split a full settings object into the part that is written on every
     change and the part that is written only when an upload changes. */
  function split(state) {
    const light = {}, media = {};
    for (const k of Object.keys(DEFAULTS)) {
      (MEDIA_KEYS.indexOf(k) === -1 ? light : media)[k] = state[k];
    }
    return { light, media };
  }

  /* Rebuild a full settings object from the two stored halves. Media held
     inside an older single-key object is honoured, so a user who upgrades
     mid session does not lose the background they had chosen. */
  function merge(light, media) {
    const out = { ...DEFAULTS, ...(light || {}) };
    const m = media || {};
    for (const k of MEDIA_KEYS) {
      if (m[k] !== undefined && m[k] !== "") out[k] = m[k];
    }
    return out;
  }

  /* True when a settings object written by an older build still carries its
     uploads inline, and so needs moving across to MEDIA_KEY once. */
  function hasInlineMedia(light) {
    return !!light && MEDIA_KEYS.some((k) => isUpload(light[k]));
  }

  window.Cam360Settings = {
    KEY, MEDIA_KEY, MEDIA_KEYS, DEFAULTS,
    normalize, split, merge, hasInlineMedia, isUpload
  };
})();
