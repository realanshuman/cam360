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
    bg: "off", bgBlur: 14, bgColor: "#0b1020", bgImage: "", feather: 4,
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

  // Receive runtime status from the engine.
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.__cam360 !== "status") return;
    status = e.data.value || status;
    try { chrome.storage.local.set({ cam360_status: status }); } catch (_) {}
    syncOverlay();
  });

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

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.__cam360 === "toggleOverlay") save({ overlayVisible: !current.overlayVisible });
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
  const BG_MODES = [["off", "Off"], ["blur", "Blur"], ["color", "Color"], ["image", "Scene"]];

  function btnStyle(bg) {
    return "border:none;border-radius:6px;padding:3px 9px;font-weight:700;font-size:11px;cursor:pointer;color:#fff;background:" + bg;
  }
  function toggleBtn(text, onClick) {
    const b = document.createElement("button");
    b.textContent = text;
    b.style.cssText = "flex:1;padding:7px 4px;border:1px solid rgba(167,139,250,0.3);border-radius:8px;background:rgba(255,255,255,0.05);color:#e9d5ff;cursor:pointer;font-size:12px";
    b.onclick = onClick;
    return b;
  }
  function sliderRow(key, label, min, max, unit, parent) {
    const wrap = document.createElement("div");
    const top = document.createElement("div");
    top.style.cssText = "display:flex;justify-content:space-between;margin-bottom:3px";
    const l = document.createElement("span"); l.textContent = label; l.style.opacity = ".85";
    const v = document.createElement("span"); v.style.cssText = "color:#c4b5fd;font-variant-numeric:tabular-nums";
    top.append(l, v);
    const input = document.createElement("input");
    input.type = "range"; input.min = min; input.max = max;
    input.style.cssText = "width:100%;accent-color:#a78bfa;cursor:pointer";
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
      "position:fixed", "top:24px", "right:24px", "z-index:2147483647", "width:256px",
      "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif", "color:#f5f3ff",
      "background:rgba(24,18,43,0.94)", "backdrop-filter:blur(8px)",
      "border:1px solid rgba(167,139,250,0.35)", "border-radius:14px",
      "box-shadow:0 12px 40px rgba(0,0,0,0.5)", "user-select:none", "font-size:13px", "overflow:hidden"
    ].join(";");

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:move;background:linear-gradient(90deg,#7c3aed,#4f46e5)";
    header.innerHTML = '<span style="font-weight:700;letter-spacing:.3px;flex:1">◉ Cam360</span>';
    els.power = document.createElement("button");
    els.power.style.cssText = btnStyle("#22c55e");
    els.power.onclick = () => save({ enabled: !current.enabled });
    const close = document.createElement("button");
    close.textContent = "✕"; close.title = "Hide (Alt+Shift+C to reopen)";
    close.style.cssText = btnStyle("rgba(255,255,255,0.15)");
    close.onclick = () => save({ overlayVisible: false });
    header.append(els.power, close);
    root.appendChild(header);

    const body = document.createElement("div");
    body.style.cssText = "padding:12px;display:flex;flex-direction:column;gap:10px;max-height:70vh;overflow-y:auto";

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
    bgTitle.style.cssText = "font-size:10px;letter-spacing:.6px;color:#9d8fc7;margin-top:2px";
    body.appendChild(bgTitle);

    const bgRow = document.createElement("div");
    bgRow.style.cssText = "display:flex;gap:6px";
    els.bgBtns = {};
    BG_MODES.forEach(([mode, label]) => {
      const b = toggleBtn(label, () => save({ bg: mode }));
      els.bgBtns[mode] = b; bgRow.appendChild(b);
    });
    body.appendChild(bgRow);

    sliderRow("bgBlur", "BG blur", 2, 30, "px", body);
    sliderRow("feather", "Edge feather", 0, 12, "px", body);

    els.status = document.createElement("div");
    els.status.style.cssText = "font-size:11px;line-height:1.4;color:#c4b5fd;min-height:0";
    body.appendChild(els.status);

    const reset = document.createElement("button");
    reset.textContent = "Reset all";
    reset.style.cssText = "margin-top:2px;padding:7px;border:none;border-radius:8px;cursor:pointer;background:rgba(167,139,250,0.18);color:#ddd6fe;font-weight:600";
    reset.onclick = () => save({
      mirror: false, flipV: false, rotate: 0, brightness: 100, contrast: 100, saturation: 100,
      blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100, lowLight: false, beautify: 0,
      bg: "off", bgBlur: 14, feather: 4
    });
    body.appendChild(reset);

    root.appendChild(body);
    document.body.appendChild(root);
    makeDraggable(root, header);
    syncOverlay();
  }

  function setActive(btn, on) {
    if (!btn) return;
    btn.style.background = on ? "linear-gradient(90deg,#7c3aed,#6366f1)" : "rgba(255,255,255,0.05)";
    btn.style.borderColor = on ? "#a78bfa" : "rgba(167,139,250,0.3)";
  }

  function syncOverlay() {
    if (!root) return;
    root.style.display = current.overlayVisible ? "block" : "none";
    els.power.textContent = current.enabled ? "ON" : "OFF";
    els.power.style.background = current.enabled ? "#22c55e" : "#6b7280";
    setActive(els.mirror, current.mirror);
    setActive(els.flipV, current.flipV);
    els.rotate.textContent = "⟳ " + current.rotate + "°";
    setActive(els.rotate, current.rotate !== 0);
    setActive(els.lowLight, current.lowLight);
    ["brightness", "contrast", "saturation", "zoom", "blur", "beautify", "bgBlur", "feather"].forEach((k) => {
      const el = els[k]; if (!el) return;
      el.input.value = current[k]; el.label.textContent = current[k] + el.unit;
    });
    Object.entries(els.bgBtns || {}).forEach(([mode, b]) => setActive(b, current.bg === mode));
    const bgActive = current.bg && current.bg !== "off";
    if (els.bgBlur) els.bgBlur.wrap.style.display = current.bg === "blur" ? "" : "none";
    if (els.feather) els.feather.wrap.style.display = bgActive ? "" : "none";
    if (els.status) {
      if (bgActive && status.message) {
        els.status.textContent = (status.segState === "error" ? "⚠ " : status.segState === "loading" ? "⏳ " : "✓ ") + status.message;
        els.status.style.color = status.segState === "error" ? "#fca5a5" : "#c4b5fd";
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
