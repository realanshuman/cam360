# Cam360 — Virtual Camera Studio (Chrome Extension)

Cam360 plugs into your webcam **inside Chrome** and lets you enhance it live on any
website that uses the camera — Google Meet, Discord (web), Zoom (web), Whereby,
Jitsi, and so on. Flip / mirror, rotate, adjust lighting (brightness, contrast,
saturation, hue), soften with blur, and digitally zoom — all in real time, with
your changes appearing directly in the call.

No account, no server, no data leaves your machine. Everything runs locally in the
browser.

---

## What it does

When a website asks for your camera (`getUserMedia`), Cam360 intercepts the request,
routes your real camera through an off-screen `<canvas>` where your adjustments are
applied frame-by-frame, and hands the *processed* stream back to the site. Audio
passes through untouched. If anything goes wrong, it silently falls back to your
raw camera so it never breaks a call.

Two ways to control it:

- **Popup** (toolbar icon) — presets, toggles, and sliders, plus a **live self
  preview**: click "Preview my camera" at the top of the popup and you see your
  processed feed exactly as a call would receive it, updating live as you move
  any slider. The preview runs the same engine as the real pipeline, so it
  cannot drift from what sites actually get.
  The popup itself is resizable: drag the grip in its bottom corner to any size
  up to Chrome's 800x600 popup limit (remembered for next time), or click the
  arrow in the header to open the same controls as a real window you can resize
  freely. The layout adapts as it grows: side by side panes past 560px, and the
  controls flow into two then three columns in a wide window.
- **In-call panel** — a draggable overlay you pop up *during* a call with
  `Alt`+`Shift`+`C` (or the popup's "Show in-call panel" button), so you can adjust
  lighting on the fly without leaving the meeting.

Both stay in sync because they share the same stored settings.

## Features

| Control | Range |
| --- | --- |
| Enable / disable | on / off (falls back to raw camera when off) |
| Mirror (horizontal flip) | toggle |
| Flip (vertical) | toggle |
| Rotate | 0° / 90° / 180° / 270° |
| Brightness / Contrast / Saturation | 0–200% |
| Hue rotate | 0–360° |
| Blur (soft focus) | 0–20px |
| Beautify (skin smoothing) | 0–100 |
| Low-light boost | toggle (lifts exposure in dim rooms) |
| Digital zoom | 100–250% |
| Presets | Warm · Cool · Bright · B&W · Soft focus |
| **Background — Blur** | 2–30px blur |
| **Background — Colour** | any solid colour |
| **Background — Scene** | 5 built-in gradient scenes + upload your own image |
| **Background — Video** | animated built-ins (aurora, waves) + upload your own video loop |
| **Cut-out method (keyer)** | AI segmentation **or** green-screen (chroma key) |
| Edge feather | 0–12px (softens the AI cut-out edge) |
| Green-screen key colour / strength / softness | pick colour, tune threshold & edge |
| **Freeze frame** | hold your last frame instantly |
| **Be right back card** | show a custom image or text card without cutting video |
| **Snapshot** | save the processed feed to a PNG |
| **Overlays** | name lower-third, logo watermark, live clock |

### AI background (MediaPipe)

Background blur/replacement uses Google's **MediaPipe Selfie Segmentation** model,
bundled **locally** in `vendor/mediapipe/` — no network calls, nothing loaded from a
CDN at runtime. When you pick a background mode the engine loads the WebAssembly
model once, then per frame it separates you from your background and composites you
over a blurred feed, a solid colour, a gradient scene, or your own uploaded image.
It runs on the GPU when available and falls back to CPU.

The engine only loads while a background mode is active, so there's no cost when
you're just using the lighting/flip controls.

### Two ways to remove your background (keyer)

Once you choose a background (blur / colour / scene / video) you pick **how** you're
separated from it:

- **AI** — MediaPipe segmentation. Best quality, no green screen needed. Blocked on
  a few strict-CSP sites (Google Meet).
- **Green screen (chroma key)** — pure JavaScript colour keying that runs **on every
  site, including Google Meet**. Sit in front of a solid-colour backdrop, pick the
  key colour (defaults to green), and tune *key strength* / *key softness*. This is
  the reliable path where the AI model can't load.

### Background content

- **Blur** — a blurred version of your real background.
- **Colour** — any solid colour.
- **Scene** — 5 gradient scenes, or upload your own image.
- **Video** — built-in animated backdrops (aurora, waves) drawn in real time, or
  upload your own looping video.

### Presence & overlays

- **Freeze** holds your last frame; **Be right back** shows a custom image or text
  card — both without dropping your video track, so the call keeps you "on".
- **Snapshot** saves the exact processed frame others see to a PNG.
- **Overlays** burn a name lower-third, a logo watermark (top-right), and/or a live
  clock into the outgoing feed. Name and logo text/images are set in the popup;
  quick on/off toggles live in the in-call panel too.

## Install

**From the Chrome Web Store (recommended):** [Add Cam360 to Chrome](https://chromewebstore.google.com/detail/cam360/ddnijfcmkiogmndecegggdieokbhlhpe).

**From source (developer / unpacked):**

1. Open `chrome://extensions` in Chrome (or any Chromium browser: Edge, Brave, Arc).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. Pin the Cam360 plugin icon from the puzzle-piece menu.

Then open a camera site (e.g. https://meet.google.com), start your video, and open
the Cam360 popup to adjust. Changes on an *already-running* camera apply instantly;
if a site grabbed the camera before the extension loaded, just toggle your camera
off/on in that site once.

## Quick local test

Open `test/test.html` in Chrome to confirm the pipeline without joining a real call:
it requests your camera and shows the processed output. For `file://` pages you must
enable **"Allow access to file URLs"** on the Cam360 card in `chrome://extensions`.

## How it's built

```
manifest.json          MV3 manifest (content scripts in MAIN + ISOLATED worlds)
src/engine.js          the shared frame pipeline (effects, keyers, overlays)
src/inject.js          MAIN world  — getUserMedia override wired to the engine
src/bridge.js          ISOLATED    — chrome.storage <-> page bridge, draggable overlay
src/background.js       service worker — keyboard-shortcut relay
popup/                 toolbar popup UI, runs the engine for the live preview
vendor/mediapipe/      bundled MediaPipe vision WASM + selfie segmentation model
icons/                 generated PNG icons
test/test.html         standalone verification page
```

The processing pipeline lives in one file, `src/engine.js`, used by both the
page pipeline and the popup preview. That is deliberate: a preview drawn by a
second implementation would drift from the real output and stop being a
preview.

The MAIN-world script does the camera override (it needs to run in the page's own
JS context to patch `navigator.mediaDevices.getUserMedia`), but MAIN-world scripts
can't read `chrome.storage`. So the ISOLATED-world `bridge.js` owns storage and
forwards settings across via `window.postMessage`. Both content scripts run at
`document_start` so the hook is installed before any site can call the camera.

## Scope & limits (please read)

- **Websites only.** A Chrome extension lives inside Chrome, so Cam360 enhances the
  camera on **web pages**. It works on Google Meet, Discord-in-browser, Zoom web
  client, etc.
- **Native desktop apps are out of reach for a browser extension.** The Discord
  *desktop app*, the Zoom *desktop app*, OBS, Teams desktop, FaceTime, etc. do not
  run inside Chrome, so no extension (this one or any other) can inject video into
  them. Reaching those requires a **system-level virtual camera** — a native driver
  that registers a fake webcam the OS sees everywhere. The proven open path is
  [OBS Studio](https://obsproject.com/) + its built-in Virtual Camera (with OBS
  filters for the same lighting/flip effects), or building a native virtual-camera
  module (macOS: CoreMediaIO / a Core Media I/O extension; Windows: a DirectShow /
  Media Foundation virtual camera; Linux: `v4l2loopback`). That's a separate native
  project, not a browser extension. See "Going system-wide" below.
- **Background effects need to load a WebAssembly model into the page.** On most
  sites this just works. A few sites with a very strict Content-Security-Policy
  (Google Meet is the notable one) block extensions from loading WASM into their
  page — there, the background feature disables itself and shows a short notice,
  while **every other effect (flip, lighting, zoom, blur, beautify) keeps working**.
  Meet also has its own built-in background blur you can use alongside Cam360's
  lighting tweaks. On Discord-in-browser, Whereby, Jitsi, most custom video apps,
  and the local test page, Cam360's own background effects run fine.

### Going system-wide (roadmap)

If you later want Cam360 to work in native apps too, the architecture would be:

1. A native helper app that registers an OS virtual camera device.
2. The same canvas/effects pipeline running in that helper (or piped from a local
   web view).
3. Optional: this extension continues to cover in-browser calls.

OBS Virtual Camera already gives you 90% of this today for free; Cam360 focuses on
making the *in-browser* experience one-click.

## Privacy

All processing is local. No network requests, no telemetry, no external libraries.
Settings are stored only in `chrome.storage.local` on your machine.

## Brand and landing page

The brand identity lives in [`brand/`](brand/): `BRAND.md` covers positioning,
logo usage, colour, type, and voice, alongside the mark as SVG. The extension
icons are generated from that same mark, so the product and the site match.

The marketing site is a single static page in [`web/`](web/). It has no build
step, no framework, and no external requests. Every product image on it is a real
screenshot rendered from the code in this repository rather than a mockup. The
only script is a handful of inline lines that close the mobile menu.

It is built for phones as much as desktop: safe area insets for the iPhone notch
and home indicator, 44px minimum touch targets, hover effects gated behind
`@media (hover: hover)` so a tap never leaves a stuck hover state, fluid type via
`clamp()`, and a disclosure menu in place of the desktop nav below 900px. Checked
for horizontal overflow and target sizes from 320px through 1440px, including
landscape.

```
web/index.html        the page
web/styles.css        design tokens and layout
web/assets/           product screenshots and the social image
brand/                brand guide and logo source
```

### Deploying to Vercel

`vercel.json` at the repository root points Vercel at `web/` as the output
directory, so a static deploy works with no configuration in the dashboard.

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production
```

You can also import the repository at vercel.com and accept the defaults. If you
prefer to configure it by hand instead, set Framework Preset to Other, leave the
build command empty, and set the Root Directory to `web`.

`.vercelignore` keeps the extension source and the bundled model out of the
upload, so only the 600KB site is deployed.

After pointing a custom domain at the deployment, update the absolute URLs in
`web/index.html` (`og:image`, `twitter:image`, and the canonical link) and the
`Sitemap:` line in `web/robots.txt`, since social crawlers need absolute URLs.
