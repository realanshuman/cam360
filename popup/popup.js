/* Cam360 — popup.js : reads/writes the same chrome.storage the overlay uses. */
const KEY = "cam360";
const DEFAULTS = {
  enabled: true, mirror: false, flipV: false, rotate: 0,
  brightness: 100, contrast: 100, saturation: 100,
  blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100,
  overlayVisible: false
};

const SLIDERS = [
  ["brightness", "Brightness", 0, 200, "%"],
  ["contrast", "Contrast", 0, 200, "%"],
  ["saturation", "Saturation", 0, 200, "%"],
  ["zoom", "Zoom", 100, 250, "%"],
  ["blur", "Blur", 0, 20, "px"],
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

function get() {
  return new Promise((r) => chrome.storage.local.get(KEY, (res) => r({ ...DEFAULTS, ...(res[KEY] || {}) })));
}
function set(patch) {
  state = { ...state, ...patch };
  chrome.storage.local.set({ [KEY]: state });
  render();
}

/* Build sliders once */
const sliderHost = document.getElementById("sliders");
const sliderEls = {};
SLIDERS.forEach(([key, name, min, max, unit]) => {
  const wrap = document.createElement("div");
  wrap.className = "slider";
  wrap.innerHTML =
    `<div class="top"><span class="name">${name}</span><span class="val"></span></div>` +
    `<input type="range" min="${min}" max="${max}">`;
  const input = wrap.querySelector("input");
  const val = wrap.querySelector(".val");
  input.addEventListener("input", () => set({ [key]: Number(input.value) }));
  sliderHost.appendChild(wrap);
  sliderEls[key] = { input, val, unit };
});

/* Wire static controls */
document.getElementById("power").addEventListener("click", () => set({ enabled: !state.enabled }));
document.getElementById("rotate").addEventListener("click", () => set({ rotate: (state.rotate + 90) % 360 }));
document.querySelectorAll("[data-toggle]").forEach((btn) => {
  const k = btn.dataset.toggle;
  btn.addEventListener("click", () => set({ [k]: !state[k] }));
});
document.querySelectorAll("[data-preset]").forEach((btn) => {
  btn.addEventListener("click", () => set({ ...PRESETS[btn.dataset.preset] }));
});
document.getElementById("reset").addEventListener("click", () => set({
  mirror: false, flipV: false, rotate: 0, brightness: 100, contrast: 100,
  saturation: 100, blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100
}));
document.getElementById("panel").addEventListener("click", () => {
  // The bridge reacts to this storage change and shows/hides the overlay.
  set({ overlayVisible: !state.overlayVisible });
});

function matchPreset() {
  for (const [name, p] of Object.entries(PRESETS)) {
    if (Object.entries(p).every(([k, v]) => state[k] === v)) return name;
  }
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
    const el = sliderEls[key];
    el.input.value = state[key];
    el.val.textContent = state[key] + unit;
  });

  document.getElementById("panel").textContent =
    state.overlayVisible ? "Hide in-call panel" : "Show in-call panel";
}

(async () => { state = await get(); render(); })();
