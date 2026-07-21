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

- **Popup** (toolbar icon) — presets, toggles, and sliders.
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
| Digital zoom | 100–250% |
| Presets | Warm · Cool · Bright · B&W · Soft focus |

## Install (developer / unpacked)

1. Open `chrome://extensions` in Chrome (or any Chromium browser: Edge, Brave, Arc).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
4. Pin the Cam360 icon from the puzzle-piece menu.

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
src/inject.js          MAIN world  — overrides getUserMedia, canvas processing engine
src/bridge.js          ISOLATED    — chrome.storage <-> page bridge, draggable overlay
src/background.js       service worker — keyboard-shortcut relay
popup/                 toolbar popup UI (html/css/js)
icons/                 generated PNG icons
test/test.html         standalone verification page
```

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
- Effects are applied via canvas filters, not ML — so there's no true background
  replacement/segmentation here (that would need a body-segmentation model such as
  MediaPipe Selfie Segmentation, which can be added to the canvas pipeline later).

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
