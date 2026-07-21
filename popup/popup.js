/* Cam360 — popup.js : shares chrome.storage with the in-call overlay. */
const KEY = "cam360";
const DEFAULTS = {
  enabled: true, mirror: false, flipV: false, rotate: 0,
  brightness: 100, contrast: 100, saturation: 100,
  blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100,
  lowLight: false, beautify: 0,
  bg: "off", bgBlur: 14, bgColor: "#0b1020", bgImage: "", feather: 4,
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
function set(patch) {
  state = { ...state, ...patch };
  chrome.storage.local.set({ [KEY]: state });
  render();
}

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

/* Background sliders (bgBlur, feather) live in the HTML */
document.querySelectorAll("input[data-slider]").forEach((input) => {
  const key = input.dataset.slider;
  input.addEventListener("input", () => set({ [key]: Number(input.value) }));
  sliderEls[key] = { input, val: input.parentElement.querySelector(".val"), unit: "px" };
});

/* Static controls */
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
document.getElementById("bgColor").addEventListener("input", (e) => set({ bgColor: e.target.value }));

document.querySelectorAll("[data-scene]").forEach((btn) => {
  if (btn.dataset.scene === "custom") return;
  btn.addEventListener("click", () => set({ bgImage: btn.dataset.scene }));
});
document.getElementById("customScene").addEventListener("click", () => document.getElementById("bgUpload").click());
document.getElementById("bgUpload").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => set({ bgImage: reader.result });
  reader.readAsDataURL(file);
});

document.getElementById("reset").addEventListener("click", () => set({
  mirror: false, flipV: false, rotate: 0, brightness: 100, contrast: 100, saturation: 100,
  blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100, lowLight: false, beautify: 0,
  bg: "off", bgBlur: 14, feather: 4
}));
document.getElementById("panel").addEventListener("click", () => set({ overlayVisible: !state.overlayVisible }));

function matchPreset() {
  for (const [name, p] of Object.entries(PRESETS))
    if (Object.entries(p).every(([k, v]) => state[k] === v)) return name;
  return null;
}

function render() {
  const power = document.getElementById("power");
  power.textContent = state.enabled ? "ON" : "OFF";
  power.classList.toggle("off", !state.enabled);

  document.querySelectorAll("[data-toggle]").forEach((btn) =>
    btn.classList.toggle("active", !!state[btn.dataset.toggle]));

  const rot = document.getElementById("rotate");
  rot.textContent = "⟳ " + state.rotate + "°";
  rot.classList.toggle("active", state.rotate !== 0);

  const preset = matchPreset();
  document.querySelectorAll("[data-preset]").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.preset === preset));

  SLIDERS.forEach(([key, , , , unit]) => {
    const el = sliderEls[key]; el.input.value = state[key]; el.val.textContent = state[key] + unit;
  });
  ["bgBlur", "feather"].forEach((key) => {
    const el = sliderEls[key]; el.input.value = state[key]; el.val.textContent = state[key] + "px";
  });

  document.querySelectorAll("[data-bg]").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.bg === state.bg));
  document.getElementById("bgColor").value = state.bgColor;
  document.querySelectorAll("[data-scene]").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.scene === state.bgImage ||
      (btn.dataset.scene === "custom" && state.bgImage && !/^grad-/.test(state.bgImage))));

  document.getElementById("bgBlurWrap").classList.toggle("hidden", state.bg !== "blur");
  document.getElementById("bgColorWrap").classList.toggle("hidden", state.bg !== "color");
  document.getElementById("bgSceneWrap").classList.toggle("hidden", state.bg !== "image");
  document.getElementById("featherWrap").classList.toggle("hidden", state.bg === "off");

  document.getElementById("panel").textContent = state.overlayVisible ? "Hide in-call panel" : "Show in-call panel";

  renderStatus();
}

function renderStatus() {
  const el = document.getElementById("status");
  if (state.bg === "off") { el.textContent = ""; return; }
  chrome.storage.local.get("cam360_status", (res) => {
    const s = res.cam360_status || { segState: "idle", message: "" };
    const icon = s.segState === "error" ? "⚠ " : s.segState === "loading" ? "⏳ " : s.segState === "ready" ? "✓ " : "";
    el.textContent = s.message ? icon + s.message : "Background engine starts when a camera is active.";
    el.classList.toggle("err", s.segState === "error");
  });
}

chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.cam360_status) renderStatus(); });

(async () => { state = await get(); render(); })();
