/* Cam360 — popup.js : shares chrome.storage with the in-call overlay. */

/* ---------------- Dialog sizing ----------------
 * Two ways to a bigger dialog:
 *  - the grip in the corner resizes the toolbar popup live, within Chrome's
 *    hard 800x600 popup cap, and the chosen size is remembered
 *  - "Open as window" moves the same page into a real window the OS can
 *    resize to any size; the responsive layout takes it from there
 */
const IS_WINDOW = new URLSearchParams(location.search).has("window");
if (IS_WINDOW) document.body.classList.add("windowed");

const SIZE_MIN_W = 280, SIZE_MAX_W = 780, SIZE_MIN_H = 430, SIZE_MAX_H = 585;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function applySize(w, h) {
  document.documentElement.style.setProperty("--pop-w", w + "px");
  document.documentElement.style.setProperty("--pop-h", h + "px");
}

if (!IS_WINDOW) {
  chrome.storage.local.get("cam360_size", (res) => {
    const sz = res.cam360_size;
    if (sz && sz.w && sz.h) applySize(clamp(sz.w, SIZE_MIN_W, SIZE_MAX_W), clamp(sz.h, SIZE_MIN_H, SIZE_MAX_H));
  });

  // Corner resizes both axes; the right and bottom edges resize one each,
  // so the dialog can be dragged by its borders like a normal window.
  const handles = [
    ["grip", true, true],
    ["edgeR", true, false],
    ["edgeB", false, true]
  ];
  handles.forEach(([id, doW, doH]) => {
    const el = document.getElementById(id);
    let drag = null;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      drag = { x: e.screenX, y: e.screenY, w: document.body.offsetWidth, h: document.body.offsetHeight };
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      applySize(doW ? clamp(drag.w + (e.screenX - drag.x), SIZE_MIN_W, SIZE_MAX_W) : drag.w,
                doH ? clamp(drag.h + (e.screenY - drag.y), SIZE_MIN_H, SIZE_MAX_H) : drag.h);
    });
    el.addEventListener("pointerup", () => {
      if (!drag) return;
      drag = null;
      try {
        chrome.storage.local.set({ cam360_size: { w: document.body.offsetWidth, h: document.body.offsetHeight } });
      } catch (_) {}
    });
  });
} else {
  ["grip", "edgeR", "edgeB"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

document.getElementById("openWindow").addEventListener("click", () => {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup/popup.html?window=1"),
    type: "popup", width: 960, height: 680
  });
  window.close();
});

const KEY = "cam360";
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

const SLIDERS = [
  ["brightness", "Brightness", 0, 200, "%"],
  ["contrast", "Contrast", 0, 200, "%"],
  ["saturation", "Saturation", 0, 200, "%"],
  ["zoom", "Zoom", 100, 250, "%"],
  ["blur", "Blur", 0, 20, "px"],
  ["beautify", "Smooth (beautify)", 0, 100, ""],
  ["hue", "Hue rotate", 0, 360, "°"]
];
const BG_SLIDERS = { bgBlur: "px", feather: "px", chromaThreshold: "", chromaSmooth: "" };

const PRESETS = {
  none:   { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0, hue: 0 },
  warm:   { brightness: 106, contrast: 104, saturation: 118, blur: 0, grayscale: 0, sepia: 22, hue: 0 },
  cool:   { brightness: 102, contrast: 104, saturation: 108, blur: 0, grayscale: 0, sepia: 0, hue: 330 },
  bright: { brightness: 122, contrast: 108, saturation: 110, blur: 0, grayscale: 0, sepia: 0, hue: 0 },
  bw:     { brightness: 104, contrast: 112, saturation: 0, blur: 0, grayscale: 100, sepia: 0, hue: 0 },
  soft:   { brightness: 106, contrast: 96, saturation: 105, blur: 2, grayscale: 0, sepia: 6, hue: 0 }
};

let state = { ...DEFAULTS };
const get = () => new Promise((r) => chrome.storage.local.get(KEY, (res) => r({ ...DEFAULTS, ...(res[KEY] || {}) })));
function set(patch) { state = { ...state, ...patch }; chrome.storage.local.set({ [KEY]: state }); render(); }

async function sendToTab(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id != null) chrome.tabs.sendMessage(tab.id, msg, () => void chrome.runtime.lastError);
}
function readFile(file, cb) { const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(file); }

/* Build main sliders */
const sliderHost = document.getElementById("sliders");
const sliderEls = {};
SLIDERS.forEach(([key, name, min, max, unit]) => {
  const wrap = document.createElement("div");
  wrap.className = "slider";
  wrap.innerHTML = `<div class="top"><span class="name">${name}</span><span class="val"></span></div><input type="range" min="${min}" max="${max}">`;
  const input = wrap.querySelector("input");
  input.addEventListener("input", () => set({ [key]: Number(input.value) }));
  sliderHost.appendChild(wrap);
  sliderEls[key] = { input, val: wrap.querySelector(".val"), unit };
});
document.querySelectorAll("input[data-slider]").forEach((input) => {
  const key = input.dataset.slider;
  input.addEventListener("input", () => set({ [key]: Number(input.value) }));
  sliderEls[key] = { input, val: input.parentElement.querySelector(".val"), unit: BG_SLIDERS[key] || "" };
});

/* Toggles & buttons */
document.getElementById("power").addEventListener("click", () => set({ enabled: !state.enabled }));
document.getElementById("rotate").addEventListener("click", () => set({ rotate: (state.rotate + 90) % 360 }));
document.querySelectorAll("[data-toggle]").forEach((btn) => {
  const k = btn.dataset.toggle;
  btn.addEventListener("click", () => set({ [k]: !state[k] }));
});
document.querySelectorAll("[data-preset]").forEach((btn) =>
  btn.addEventListener("click", () => set({ ...PRESETS[btn.dataset.preset] })));
document.querySelectorAll("[data-bg]").forEach((btn) =>
  btn.addEventListener("click", () => set({ bg: btn.dataset.bg })));
document.querySelectorAll("[data-keyer]").forEach((btn) =>
  btn.addEventListener("click", () => set({ keyer: btn.dataset.keyer })));

document.getElementById("bgColor").addEventListener("input", (e) => set({ bgColor: e.target.value }));
document.getElementById("chromaColor").addEventListener("input", (e) => set({ chromaColor: e.target.value }));

document.querySelectorAll("[data-scene]").forEach((btn) => {
  if (btn.dataset.scene === "custom") return;
  btn.addEventListener("click", () => set({ bgImage: btn.dataset.scene }));
});
document.getElementById("customScene").addEventListener("click", () => document.getElementById("bgUpload").click());
document.getElementById("bgUpload").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0]; if (f) readFile(f, (d) => set({ bgImage: d }));
});
document.querySelectorAll("[data-vscene]").forEach((btn) => {
  if (btn.dataset.vscene === "customv") return;
  btn.addEventListener("click", () => set({ bgVideo: btn.dataset.vscene }));
});
document.getElementById("customVScene").addEventListener("click", () => document.getElementById("bgvUpload").click());
document.getElementById("bgvUpload").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0]; if (f) readFile(f, (d) => set({ bgVideo: d }));
});

document.getElementById("brbText").addEventListener("input", (e) => set({ brbText: e.target.value }));
document.getElementById("brbUploadBtn").addEventListener("click", () => document.getElementById("brbUpload").click());
document.getElementById("brbUpload").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0]; if (f) readFile(f, (d) => set({ brbImage: d }));
});
document.getElementById("nameText").addEventListener("input", (e) => set({ nameText: e.target.value }));
document.getElementById("logoUploadBtn").addEventListener("click", () => document.getElementById("logoUpload").click());
document.getElementById("logoUpload").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0]; if (f) readFile(f, (d) => set({ logoImage: d, showLogo: true }));
});
const snapBtn = document.getElementById("snapshot");
function snapFlash(text, ok) {
  const original = "Save PNG";
  snapBtn.textContent = text;
  snapBtn.style.color = ok ? "var(--accent)" : "var(--danger)";
  setTimeout(() => { snapBtn.textContent = original; snapBtn.style.color = ""; }, 1800);
}
snapBtn.addEventListener("click", async () => {
  // Preview running: save its canvas directly. Same engine, same pixels.
  if (pv.renderer && pv.renderer.isRunning() && !pv.canvas.hidden && pv.canvas.width) {
    try {
      const a = document.createElement("a");
      a.href = pv.canvas.toDataURL("image/png");
      a.download = "cam360-" + Date.now() + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      snapFlash("Saved", true);
    } catch (err) { snapFlash("Failed", false); }
    return;
  }
  // Otherwise ask the active tab, and say so when nothing is filming there.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) { snapFlash("No camera", false); return; }
  let done = false;
  const timer = setTimeout(() => { if (!done) { done = true; snapFlash("No camera", false); } }, 1500);
  chrome.tabs.sendMessage(tab.id, { __cam360: "snapshot" }, (res) => {
    void chrome.runtime.lastError;
    if (done) return;
    done = true; clearTimeout(timer);
    if (res && res.ok) snapFlash("Saved", true);
    else snapFlash("No camera", false);
  });
});

document.getElementById("reset").addEventListener("click", () => set({
  mirror: false, flipV: false, rotate: 0, brightness: 100, contrast: 100, saturation: 100,
  blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100, lowLight: false, beautify: 0,
  bg: "off", keyer: "ai", bgBlur: 14, feather: 4, chromaThreshold: 42, chromaSmooth: 14,
  freeze: false, brb: false, showName: false, showLogo: false, showClock: false
}));
document.getElementById("panel").addEventListener("click", () => set({ overlayVisible: !state.overlayVisible }));

function matchPreset() {
  for (const [name, p] of Object.entries(PRESETS))
    if (Object.entries(p).every(([k, v]) => state[k] === v)) return name;
  return null;
}
const show = (id, on) => document.getElementById(id).classList.toggle("hidden", !on);

function render() {
  document.getElementById("power").classList.toggle("active", state.enabled);

  document.querySelectorAll("[data-toggle]").forEach((b) => b.classList.toggle("active", !!state[b.dataset.toggle]));
  const rot = document.getElementById("rotate");
  rot.textContent = "⟳ " + state.rotate + "°"; rot.classList.toggle("active", state.rotate !== 0);

  const preset = matchPreset();
  document.querySelectorAll("[data-preset]").forEach((b) => b.classList.toggle("active", b.dataset.preset === preset));

  SLIDERS.forEach(([k, , , , u]) => { const e = sliderEls[k]; e.input.value = state[k]; e.val.textContent = state[k] + u; });
  Object.keys(BG_SLIDERS).forEach((k) => { const e = sliderEls[k]; e.input.value = state[k]; e.val.textContent = state[k] + BG_SLIDERS[k]; });

  document.querySelectorAll("[data-bg]").forEach((b) => b.classList.toggle("active", b.dataset.bg === state.bg));
  document.querySelectorAll("[data-keyer]").forEach((b) => b.classList.toggle("active", b.dataset.keyer === state.keyer));
  document.getElementById("bgColor").value = state.bgColor;
  document.getElementById("chromaColor").value = state.chromaColor;
  document.querySelectorAll("[data-scene]").forEach((b) => b.classList.toggle("active",
    b.dataset.scene === state.bgImage || (b.dataset.scene === "custom" && state.bgImage && !/^grad-/.test(state.bgImage))));
  document.querySelectorAll("[data-vscene]").forEach((b) => b.classList.toggle("active",
    b.dataset.vscene === state.bgVideo || (b.dataset.vscene === "customv" && state.bgVideo && !/^anim-/.test(state.bgVideo))));

  const bgOn = state.bg !== "off", chroma = state.keyer === "chroma";
  show("keyerWrap", bgOn);
  show("bgBlurWrap", state.bg === "blur");
  show("bgColorWrap", state.bg === "color");
  show("bgSceneWrap", state.bg === "scene");
  show("bgVideoWrap", state.bg === "video");
  show("featherWrap", bgOn && !chroma);
  show("chromaWrap", bgOn && chroma);
  document.getElementById("keyerNote").textContent = chroma
    ? "Works on every site (incl. Google Meet). Best with a solid-colour backdrop behind you."
    : "Highest quality, no green screen needed. Blocked on a few strict sites like Google Meet.";

  show("brbWrap", state.brb);
  document.getElementById("brbText").value = state.brbText;
  document.getElementById("nameText").value = state.nameText;

  document.getElementById("panel").textContent = state.overlayVisible ? "Hide in-call panel" : "Show in-call panel";
  renderStatus();
}

function renderStatus() {
  const el = document.getElementById("status");
  if (state.bg === "off" || state.keyer === "chroma") { el.textContent = ""; el.classList.remove("err"); return; }
  chrome.storage.local.get("cam360_status", (res) => {
    const s = res.cam360_status || { segState: "idle", message: "" };
    const icon = s.segState === "error" ? "⚠ " : s.segState === "loading" ? "⏳ " : s.segState === "ready" ? "✓ " : "";
    el.textContent = s.message ? icon + s.message : "AI engine starts when a camera is active.";
    el.classList.toggle("err", s.segState === "error");
  });
}

chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.cam360_status) renderStatus(); });
/* ---------------- Live self preview ----------------
 * Runs the SAME engine (src/engine.js) the content script uses on the page,
 * on the popup's own camera, so what you see here is exactly the feed a call
 * would receive with the current settings.
 */
const pv = {
  wrap: document.getElementById("previewWrap"),
  video: document.getElementById("previewVideo"),
  canvas: document.getElementById("previewCanvas"),
  start: document.getElementById("previewStart"),
  stop: document.getElementById("previewStop"),
  msg: document.getElementById("previewMsg"),
  stream: null, renderer: null
};

function previewMessage(text) { pv.msg.textContent = text || ""; pv.msg.hidden = !text; }

function openGrantTab() {
  // Chrome cannot render the camera permission prompt inside a toolbar popup;
  // it silently denies instead. A normal extension tab can show it, and the
  // grant sticks for the whole extension afterwards.
  chrome.tabs.create({ url: chrome.runtime.getURL("popup/grant.html") });
  window.close();
}

async function cameraPermissionState() {
  try {
    const st = await navigator.permissions.query({ name: "camera" });
    return st.state; // granted | prompt | denied
  } catch (_) { return "unknown"; }
}

async function startPreview() {
  pv.start.hidden = true;
  previewMessage("Starting camera...");

  // Permission not granted yet: the popup cannot show the prompt, so ask from
  // a tab instead of letting the request silently fail here.
  const perm = await cameraPermissionState();
  if (perm === "prompt" || perm === "denied") {
    try { chrome.storage.local.set({ cam360_preview: false }); } catch (_) {}
    openGrantTab();
    return;
  }

  try {
    pv.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    pv.video.srcObject = pv.stream;
    await pv.video.play().catch(() => {});
    pv.canvas.hidden = false;
    pv.stop.hidden = false;
    previewMessage("");
    pv.renderer = Cam360Engine.createRenderer({
      video: pv.video,
      canvas: pv.canvas,
      getSettings: () => state,
      getBaseURL: () => chrome.runtime.getURL(""),
      onStatus: (st) => { if (st.segState === "loading") previewMessage(st.message); else previewMessage(""); }
    });
    pv.renderer.start();
    try { chrome.storage.local.set({ cam360_preview: true }); } catch (_) {}
  } catch (err) {
    pv.start.hidden = false;
    pv.canvas.hidden = true;
    pv.stop.hidden = true;
    if (err && err.name === "NotAllowedError") { openGrantTab(); return; }
    previewMessage("Could not start the camera: " + (err && err.message ? err.message : err));
  }
}

function stopPreview(remember) {
  if (pv.renderer) { pv.renderer.stop(); pv.renderer = null; }
  if (pv.stream) { pv.stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} }); pv.stream = null; }
  pv.video.srcObject = null;
  pv.canvas.hidden = true;
  pv.stop.hidden = true;
  pv.start.hidden = false;
  previewMessage("");
  if (remember) { try { chrome.storage.local.set({ cam360_preview: false }); } catch (_) {} }
}

pv.start.addEventListener("click", startPreview);
pv.stop.addEventListener("click", () => stopPreview(true));
// The popup unloads when it closes, which releases the camera; this makes it explicit.
window.addEventListener("unload", () => stopPreview(false));

// Reopen the preview automatically if it was on last time and permission is
// already granted; never bounce the user into the grant tab on open.
chrome.storage.local.get("cam360_preview", async (res) => {
  if (!res.cam360_preview) return;
  if ((await cameraPermissionState()) === "granted") startPreview();
});

(async () => { state = await get(); render(); })();
