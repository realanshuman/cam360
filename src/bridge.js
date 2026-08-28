/*
 * Cam360 — bridge.js  (runs in the ISOLATED world at document_start)
 * ------------------------------------------------------------------
 * The only script with chrome.storage access. It forwards settings + the
 * extension base URL to inject.js (MAIN world), relays runtime status back,
 * and builds the draggable in-call control panel.
 */
(() => {
  "use strict";
  if (window.__CAM360_BRIDGE__) return;
  window.__CAM360_BRIDGE__ = true;

  const DEFAULTS = {
    enabled: true, mirror: false, flipV: false, rotate: 0,
    brightness: 100, contrast: 100, saturation: 100,
    blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100,
    lowLight: false, beautify: 0,
    bg: "off", keyer: "ai", bgBlur: 14, bgColor: "#0b1020", bgImage: "", bgVideo: "", feather: 4,
    chromaColor: "#00c000", chromaThreshold: 42, chromaSmooth: 14,
    freeze: false, brb: false, brbText: "Be right back", brbImage: "",
    showName: false, nameText: "", showLogo: false, logoImage: "", showClock: false,
    overlayVisible: false
  };
  const KEY = "cam360";
  const BASE = chrome.runtime.getURL("");

  let current = { ...DEFAULTS };
  let status = { segState: "idle", message: "" };

  function post(value) {
    window.postMessage({ __cam360: "settings", value, baseURL: BASE }, "*");
  }

  // Tell the engine its base URL as early as possible (before settings land).
  window.postMessage({ __cam360: "base", baseURL: BASE }, "*");

  // Receive runtime status + snapshot data from the engine.
  let snapCallbacks = [];
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.__cam360 === "status") {
      status = e.data.value || status;
      try { chrome.storage.local.set({ cam360_status: status }); } catch (_) {}
      syncOverlay();
    } else if (e.data.__cam360 === "snapshotData") {
      const ok = !!e.data.dataURL;
      if (ok) {
        const a = document.createElement("a");
        a.href = e.data.dataURL;
        a.download = "cam360-" + Date.now() + ".png";
        document.body.appendChild(a); a.click(); a.remove();
      }
      const cbs = snapCallbacks; snapCallbacks = [];
      cbs.forEach((cb) => { try { cb({ ok }); } catch (_) {} });
    }
  });
  function requestSnapshot(cb) {
    if (cb) snapCallbacks.push(cb);
    window.postMessage({ __cam360: "snapshot" }, "*");
  }

  function load() {
    chrome.storage.local.get(KEY, (res) => {
      current = { ...DEFAULTS, ...(res[KEY] || {}) };
      post(current);
      if (document.body) renderOverlay();
      else document.addEventListener("DOMContentLoaded", renderOverlay, { once: true });
    });
  }
  function save(patch) {
    current = { ...current, ...patch };
    chrome.storage.local.set({ [KEY]: current });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[KEY]) return;
    current = { ...DEFAULTS, ...(changes[KEY].newValue || {}) };
    post(current);
    syncOverlay();
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.__cam360 === "toggleOverlay") save({ overlayVisible: !current.overlayVisible });
    else if (msg.__cam360 === "snapshot") {
      // The message reaches every frame in the tab. A frame with no camera
      // delays its "no" so a frame that has one can answer first.
      requestSnapshot((res) => {
        if (res.ok) sendResponse(res);
        else setTimeout(() => { try { sendResponse(res); } catch (_) {} }, 600);
      });
      return true; // keep sendResponse alive for the async reply
    }
  });

  /* ---------------------- In-page control panel ---------------------- */
  let root = null;
  const els = {};
  const SLIDERS = [
    ["brightness", "Brightness", 0, 200, "%"],
    ["contrast", "Contrast", 0, 200, "%"],
    ["saturation", "Saturation", 0, 200, "%"],
    ["zoom", "Zoom", 100, 250, "%"],
    ["blur", "Blur", 0, 20, "px"],
    ["beautify", "Smooth", 0, 100, ""]
  ];
  const BG_MODES = [["off", "Off"], ["blur", "Blur"], ["color", "Color"], ["scene", "Scene"], ["video", "Video"]];

  // Notion-style light palette (matches the popup).
  const C = {
    bg: "#ffffff", text: "#37352f", sec: "rgba(55,53,47,0.75)", muted: "rgba(55,53,47,0.5)",
    border: "rgba(55,53,47,0.16)", hair: "rgba(55,53,47,0.09)", hover: "rgba(55,53,47,0.06)",
    sunken: "#f7f6f3", accent: "#2383e2", accentSoft: "rgba(35,131,226,0.13)"
  };

  function toggleBtn(text, onClick) {
    const b = document.createElement("button");
    b.textContent = text;
    b.style.cssText = `flex:1;padding:6px 4px;border:1px solid ${C.border};border-radius:7px;background:transparent;color:${C.sec};cursor:pointer;font-size:12px;font-family:inherit;transition:background .12s`;
    b.onclick = onClick;
    return b;
  }
  function sliderRow(key, label, min, max, unit, parent) {
    const wrap = document.createElement("div");
    const top = document.createElement("div");
    top.style.cssText = "display:flex;justify-content:space-between;margin-bottom:4px";
    const l = document.createElement("span"); l.textContent = label; l.style.cssText = `font-size:12.5px;color:${C.sec}`;
    const v = document.createElement("span"); v.style.cssText = `font-size:11px;color:${C.muted};font-variant-numeric:tabular-nums`;
    top.append(l, v);
    const input = document.createElement("input");
    input.type = "range"; input.min = min; input.max = max;
    input.style.cssText = `width:100%;accent-color:${C.accent};cursor:pointer;height:4px`;
    input.oninput = () => save({ [key]: Number(input.value) });
    wrap.append(top, input);
    parent.appendChild(wrap);
    els[key] = { input, label: v, unit, wrap };
  }

  function renderOverlay() {
    if (root || !document.body) { syncOverlay(); return; }
    root = document.createElement("div");
    root.id = "cam360-overlay";
    root.style.cssText = [
      "position:fixed", "top:24px", "right:24px", "z-index:2147483647", "width:258px",
      "font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif",
      `color:${C.text}`, `background:${C.bg}`, `border:1px solid ${C.border}`, "border-radius:12px",
      "box-shadow:0 10px 34px rgba(15,15,15,0.18),0 0 0 0.5px rgba(15,15,15,0.04)",
      "user-select:none", "font-size:13px", "overflow:hidden", "-webkit-font-smoothing:antialiased"
    ].join(";");

    const header = document.createElement("div");
    header.style.cssText = `display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:move;border-bottom:1px solid ${C.hair}`;
    header.innerHTML = `<svg viewBox="0 0 48 48" style="width:16px;height:16px;border-radius:5px;display:block;flex:0 0 auto"><rect width="48" height="48" rx="11" fill="#2383E2"/><circle cx="24" cy="24" r="11" fill="none" stroke="#fff" stroke-width="3.25" stroke-linecap="round" stroke-dasharray="57 12.1" transform="rotate(-14 24 24)"/><circle cx="24" cy="24" r="4.25" fill="#fff"/></svg><span style="font-weight:600;flex:1;font-size:14px">Cam360</span>`;
    els.power = document.createElement("button");
    els.power.onclick = () => save({ enabled: !current.enabled });
    const close = document.createElement("button");
    close.textContent = "✕"; close.title = "Hide (Alt+Shift+C to reopen)";
    close.style.cssText = `border:none;background:transparent;color:${C.muted};font-size:13px;cursor:pointer;padding:2px 4px;border-radius:5px`;
    close.onclick = () => save({ overlayVisible: false });
    header.append(els.power, close);
    root.appendChild(header);

    const body = document.createElement("div");
    body.style.cssText = "padding:12px;display:flex;flex-direction:column;gap:10px;max-height:72vh;overflow-y:auto";

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px";
    els.mirror = toggleBtn("⇋ Mirror", () => save({ mirror: !current.mirror }));
    els.flipV = toggleBtn("⇅ Flip", () => save({ flipV: !current.flipV }));
    els.rotate = toggleBtn("⟳ 0°", () => save({ rotate: (current.rotate + 90) % 360 }));
    row.append(els.mirror, els.flipV, els.rotate);
    body.appendChild(row);

    SLIDERS.forEach(([k, l, mn, mx, u]) => sliderRow(k, l, mn, mx, u, body));

    els.lowLight = toggleBtn("☀ Low-light boost", () => save({ lowLight: !current.lowLight }));
    body.appendChild(els.lowLight);

    // Background section
    const bgTitle = document.createElement("div");
    bgTitle.textContent = "BACKGROUND";
    bgTitle.style.cssText = `font-size:10px;letter-spacing:.06em;font-weight:600;color:${C.muted};text-transform:uppercase;margin-top:4px`;
    body.appendChild(bgTitle);

    const bgRow = document.createElement("div");
    bgRow.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
    els.bgBtns = {};
    BG_MODES.forEach(([mode, label]) => {
      const b = toggleBtn(label, () => save({ bg: mode }));
      b.style.flex = "1 1 30%";
      els.bgBtns[mode] = b; bgRow.appendChild(b);
    });
    body.appendChild(bgRow);

    // Keyer: AI segmentation vs green screen (chroma)
    const keyRow = document.createElement("div");
    keyRow.style.cssText = "display:flex;gap:6px";
    els.keyAi = toggleBtn("AI", () => save({ keyer: "ai" }));
    els.keyChroma = toggleBtn("Green screen", () => save({ keyer: "chroma" }));
    keyRow.append(els.keyAi, els.keyChroma);
    els.keyRow = keyRow;
    body.appendChild(keyRow);

    sliderRow("bgBlur", "BG blur", 2, 30, "px", body);
    sliderRow("feather", "Edge feather", 0, 12, "px", body);
    sliderRow("chromaThreshold", "Key strength", 5, 90, "", body);
    sliderRow("chromaSmooth", "Key softness", 1, 60, "", body);

    // Presence: freeze / be-right-back / snapshot
    const presTitle = document.createElement("div");
    presTitle.textContent = "PRESENCE";
    presTitle.style.cssText = `font-size:10px;letter-spacing:.06em;font-weight:600;color:${C.muted};text-transform:uppercase;margin-top:4px`;
    body.appendChild(presTitle);
    const presRow = document.createElement("div");
    presRow.style.cssText = "display:flex;gap:6px";
    els.freeze = toggleBtn("❚❚ Freeze", () => save({ freeze: !current.freeze }));
    els.brb = toggleBtn("☕ BRB", () => save({ brb: !current.brb }));
    const snap = toggleBtn("📷 Snap", () => requestSnapshot());
    presRow.append(els.freeze, els.brb, snap);
    body.appendChild(presRow);

    // Overlays: name / clock quick toggles (full editing in the popup)
    const ovRow = document.createElement("div");
    ovRow.style.cssText = "display:flex;gap:6px";
    els.showName = toggleBtn("🏷 Name", () => save({ showName: !current.showName }));
    els.showClock = toggleBtn("🕐 Clock", () => save({ showClock: !current.showClock }));
    els.showLogo = toggleBtn("★ Logo", () => save({ showLogo: !current.showLogo }));
    ovRow.append(els.showName, els.showClock, els.showLogo);
    body.appendChild(ovRow);

    els.status = document.createElement("div");
    els.status.style.cssText = `font-size:11px;line-height:1.45;color:${C.muted};min-height:0`;
    body.appendChild(els.status);

    const reset = document.createElement("button");
    reset.textContent = "Reset all";
    reset.style.cssText = `margin-top:4px;padding:7px;border:1px solid ${C.border};border-radius:7px;cursor:pointer;background:transparent;color:${C.sec};font-size:12.5px;font-family:inherit`;
    reset.onclick = () => save({
      mirror: false, flipV: false, rotate: 0, brightness: 100, contrast: 100, saturation: 100,
      blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100, lowLight: false, beautify: 0,
      bg: "off", keyer: "ai", bgBlur: 14, feather: 4, chromaThreshold: 42, chromaSmooth: 14,
      freeze: false, brb: false, showName: false, showClock: false, showLogo: false
    });
    body.appendChild(reset);

    root.appendChild(body);
    document.body.appendChild(root);
    makeDraggable(root, header);
    syncOverlay();
  }

  function setActive(btn, on) {
    if (!btn) return;
    btn.style.background = on ? C.accentSoft : "transparent";
    btn.style.borderColor = on ? "transparent" : C.border;
    btn.style.color = on ? C.accent : C.sec;
    btn.style.fontWeight = on ? "500" : "400";
  }

  function syncOverlay() {
    if (!root) return;
    root.style.display = current.overlayVisible ? "block" : "none";
    els.power.textContent = current.enabled ? "On" : "Off";
    els.power.style.cssText = "border:none;border-radius:6px;padding:3px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;" +
      (current.enabled ? `background:${C.accent};color:#fff` : `background:${C.sunken};color:${C.muted}`);
    setActive(els.mirror, current.mirror);
    setActive(els.flipV, current.flipV);
    els.rotate.textContent = "⟳ " + current.rotate + "°";
    setActive(els.rotate, current.rotate !== 0);
    setActive(els.lowLight, current.lowLight);
    ["brightness", "contrast", "saturation", "zoom", "blur", "beautify", "bgBlur", "feather", "chromaThreshold", "chromaSmooth"].forEach((k) => {
      const el = els[k]; if (!el) return;
      el.input.value = current[k]; el.label.textContent = current[k] + el.unit;
    });
    Object.entries(els.bgBtns || {}).forEach(([mode, b]) => setActive(b, current.bg === mode));
    const bgActive = current.bg && current.bg !== "off";
    const chroma = current.keyer === "chroma";
    if (els.keyRow) els.keyRow.style.display = bgActive ? "flex" : "none";
    setActive(els.keyAi, !chroma); setActive(els.keyChroma, chroma);
    if (els.bgBlur) els.bgBlur.wrap.style.display = current.bg === "blur" ? "" : "none";
    if (els.feather) els.feather.wrap.style.display = bgActive && !chroma ? "" : "none";
    if (els.chromaThreshold) els.chromaThreshold.wrap.style.display = bgActive && chroma ? "" : "none";
    if (els.chromaSmooth) els.chromaSmooth.wrap.style.display = bgActive && chroma ? "" : "none";
    setActive(els.freeze, current.freeze);
    setActive(els.brb, current.brb);
    setActive(els.showName, current.showName);
    setActive(els.showClock, current.showClock);
    setActive(els.showLogo, current.showLogo);
    if (els.status) {
      if (bgActive && !chroma && status.message) {
        els.status.textContent = (status.segState === "error" ? "⚠ " : status.segState === "loading" ? "⏳ " : "✓ ") + status.message;
        els.status.style.color = status.segState === "error" ? "#e03e3e" : C.muted;
      } else els.status.textContent = "";
    }
  }

  function makeDraggable(node, handle) {
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      dragging = true;
      const r = node.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      node.style.right = "auto"; e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      node.style.left = Math.max(0, ox + e.clientX - sx) + "px";
      node.style.top = Math.max(0, oy + e.clientY - sy) + "px";
    });
    window.addEventListener("mouseup", () => { dragging = false; });
  }

  load();
})();
