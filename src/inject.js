/*
 * Cam360 — inject.js  (runs in the page's MAIN world at document_start)
 * ---------------------------------------------------------------------
 * Overrides navigator.mediaDevices.getUserMedia so every camera stream a
 * site requests is routed through the shared processing engine
 * (src/engine.js, loaded just before this file) and handed back as a new
 * MediaStream. Audio passes through untouched, and any failure falls back
 * to the raw camera so a call is never broken.
 *
 * Settings + the extension base URL arrive from bridge.js via postMessage.
 */
(() => {
  "use strict";
  if (window.__CAM360_INSTALLED__) return;
  window.__CAM360_INSTALLED__ = true;

  const engine = window.Cam360Engine;
  if (!engine) { console.warn("[Cam360] engine not loaded, camera left untouched"); return; }

  let settings = engine.normalize(null);   /* refilled once bridge.js reports in */
  let baseURL = "";
  /* Output canvases that are still being drawn to. A page can hold more than
     one camera at a time, and a snapshot should come from one that is live,
     not from whichever was created last and may since have stopped. */
  const liveCanvases = new Set();
  const snapshotSource = () => {
    let last = null;
    liveCanvases.forEach((c) => { last = c; });
    return last;
  };

  function pushStatus(value) {
    window.postMessage({ __cam360: "status", value }, "*");
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    const d = e.data;
    if (d.__cam360 === "settings") {
      engine.setDefaults(d.defaults);
      settings = engine.normalize(d.value);
      if (d.baseURL) baseURL = d.baseURL;
      // Warm the model as soon as an AI background is wanted.
      if (settings.enabled && settings.bg !== "off" && settings.keyer === "ai") {
        engine.initSegmenter(baseURL, pushStatus);
      }
    } else if (d.__cam360 === "base") {
      engine.setDefaults(d.defaults);
      baseURL = d.baseURL || baseURL;
    } else if (d.__cam360 === "snapshot") {
      takeSnapshot();
    }
  });

  function takeSnapshot() {
    // Always answer, so the popup can tell the user when there is no camera
    // here instead of failing silently.
    try {
      const src = snapshotSource();
      const dataURL = src ? src.toDataURL("image/png") : null;
      window.postMessage({ __cam360: "snapshotData", dataURL }, "*");
    } catch (err) {
      console.warn("[Cam360] snapshot failed", err);
      window.postMessage({ __cam360: "snapshotData", dataURL: null }, "*");
    }
  }

  const md = navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return;
  const nativeGUM = md.getUserMedia.bind(md);

  function processTrack(videoTrack, audioTracks) {
    const ts = videoTrack.getSettings() || {};
    const fps = ts.frameRate || 30;

    const video = document.createElement("video");
    video.muted = true; video.autoplay = true; video.playsInline = true;
    video.srcObject = new MediaStream([videoTrack]);

    const canvas = document.createElement("canvas");
    canvas.width = ts.width || 640; canvas.height = ts.height || 480;
    liveCanvases.add(canvas);

    const renderer = engine.createRenderer({
      video, canvas, fps,
      width: ts.width || 640, height: ts.height || 480,
      getSettings: () => settings,
      getBaseURL: () => baseURL,
      onStatus: pushStatus
    });

    const outStream = canvas.captureStream(fps);
    const outVideo = outStream.getVideoTracks()[0];
    const stopAll = () => {
      renderer.stop();
      liveCanvases.delete(canvas);
      try { videoTrack.stop(); } catch (_) {}
      try { video.srcObject = null; } catch (_) {}
    };
    if (outVideo) {
      const nativeStop = outVideo.stop.bind(outVideo);
      outVideo.stop = () => { stopAll(); nativeStop(); };
      outVideo.addEventListener("ended", stopAll);

      /* A canvas track answers almost nothing a conferencing site asks of a
         camera: no device id, no facing mode, no zoom or torch range, and
         applyConstraints on it is a no-op. Sites that probe before they
         render can read that as "no usable camera". Forward the questions to
         the real track this one is standing in for, and let the canvas keep
         only the answers that are genuinely about the output: its size and
         frame rate. applyConstraints reaching the real track also means a
         site asking for a different resolution still gets one, because the
         renderer follows the source size every frame. */
      try {
        const canvasSettings = outVideo.getSettings.bind(outVideo);
        outVideo.getSettings = () => {
          try { return { ...videoTrack.getSettings(), ...canvasSettings() }; }
          catch (_) { return canvasSettings(); }
        };
        if (typeof videoTrack.getCapabilities === "function") {
          outVideo.getCapabilities = () => videoTrack.getCapabilities();
        }
        if (typeof videoTrack.getConstraints === "function") {
          outVideo.getConstraints = () => videoTrack.getConstraints();
        }
        if (typeof videoTrack.applyConstraints === "function") {
          outVideo.applyConstraints = (c) => videoTrack.applyConstraints(c);
        }
      } catch (_) {}
    }
    videoTrack.addEventListener("ended", () => { renderer.stop(); liveCanvases.delete(canvas); });
    (audioTracks || []).forEach((t) => outStream.addTrack(t));

    renderer.start();
    return outStream;
  }

  async function patchedGetUserMedia(constraints) {
    const real = await nativeGUM(constraints);
    try {
      if (!constraints || !constraints.video) return real;
      /* No shape yet means bridge.js has not reported in. Rendering with a
         half known settings object would be worse than not rendering. */
      if (!engine.ready()) return real;
      const videoTrack = real.getVideoTracks()[0];
      if (!videoTrack) return real;
      return processTrack(videoTrack, real.getAudioTracks());
    } catch (err) {
      console.warn("[Cam360] processing failed, using raw camera:", err);
      return real;
    }
  }

  try { md.getUserMedia = patchedGetUserMedia; }
  catch (_) {
    try { Object.defineProperty(md, "getUserMedia", { configurable: true, writable: true, value: patchedGetUserMedia }); }
    catch (e) { console.warn("[Cam360] could not install getUserMedia hook", e); }
  }
  const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  if (legacy) navigator.getUserMedia = (c, ok, err) => patchedGetUserMedia(c).then(ok, err);
})();
