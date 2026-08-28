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

  let settings = engine.normalize(null);
  let baseURL = "";
  let activeCanvas = null; // most recent output canvas, for snapshots

  function pushStatus(value) {
    window.postMessage({ __cam360: "status", value }, "*");
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    const d = e.data;
    if (d.__cam360 === "settings") {
      settings = engine.normalize(d.value);
      if (d.baseURL) baseURL = d.baseURL;
      // Warm the model as soon as an AI background is wanted.
      if (settings.enabled && settings.bg !== "off" && settings.keyer === "ai") {
        engine.initSegmenter(baseURL, pushStatus);
      }
    } else if (d.__cam360 === "base") {
      baseURL = d.baseURL || baseURL;
    } else if (d.__cam360 === "snapshot") {
      takeSnapshot();
    }
  });

  function takeSnapshot() {
    // Always answer, so the popup can tell the user when there is no camera
    // here instead of failing silently.
    try {
      const dataURL = activeCanvas ? activeCanvas.toDataURL("image/png") : null;
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
    activeCanvas = canvas;

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
      try { videoTrack.stop(); } catch (_) {}
      try { video.srcObject = null; } catch (_) {}
    };
    if (outVideo) {
      const nativeStop = outVideo.stop.bind(outVideo);
      outVideo.stop = () => { stopAll(); nativeStop(); };
      outVideo.addEventListener("ended", stopAll);
    }
    videoTrack.addEventListener("ended", () => renderer.stop());
    (audioTracks || []).forEach((t) => outStream.addTrack(t));

    renderer.start();
    return outStream;
  }

  async function patchedGetUserMedia(constraints) {
    const real = await nativeGUM(constraints);
    try {
      if (!constraints || !constraints.video) return real;
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
