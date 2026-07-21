/*
 * Cam360 — inject.js  (runs in the page's MAIN world at document_start)
 * ---------------------------------------------------------------------
 * Overrides navigator.mediaDevices.getUserMedia so that any camera stream
 * a website requests is first routed through a <canvas> where we apply the
 * user's live adjustments (mirror / flip / rotate / lighting / blur / zoom),
 * then handed back as a fresh MediaStream. Audio tracks pass through untouched.
 *
 * Settings arrive from bridge.js (ISOLATED world) via window.postMessage,
 * because MAIN-world scripts cannot touch chrome.storage directly.
 */
(() => {
  "use strict";
  if (window.__CAM360_INSTALLED__) return;
  window.__CAM360_INSTALLED__ = true;

  const DEFAULTS = {
    enabled: true,
    mirror: false,
    flipV: false,
    rotate: 0,          // 0 | 90 | 180 | 270
    brightness: 100,    // %
    contrast: 100,      // %
    saturation: 100,    // %
    blur: 0,            // px
    grayscale: 0,       // %
    sepia: 0,           // %
    hue: 0,             // deg
    zoom: 100           // % (>= 100 crops in)
  };

  let settings = { ...DEFAULTS };

  // Receive settings from the isolated-world bridge.
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.__cam360 !== "settings") return;
    settings = { ...DEFAULTS, ...e.data.value };
  });

  const md = navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return;

  const nativeGUM = md.getUserMedia.bind(md);

  function buildFilter(s) {
    return [
      `brightness(${s.brightness}%)`,
      `contrast(${s.contrast}%)`,
      `saturate(${s.saturation}%)`,
      `grayscale(${s.grayscale}%)`,
      `sepia(${s.sepia}%)`,
      `hue-rotate(${s.hue}deg)`,
      s.blur > 0 ? `blur(${s.blur}px)` : ""
    ].filter(Boolean).join(" ");
  }

  function processTrack(videoTrack, audioTracks) {
    const ts = videoTrack.getSettings() || {};
    const srcW = ts.width || 640;
    const srcH = ts.height || 480;
    const fps = ts.frameRate || 30;

    const video = document.createElement("video");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([videoTrack]);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

    let running = true;

    function drawFrame() {
      if (!running) return;
      const s = settings;
      const rot = ((s.rotate % 360) + 360) % 360;
      const swap = rot === 90 || rot === 270;

      const outW = swap ? srcH : srcW;
      const outH = swap ? srcW : srcH;
      if (canvas.width !== outW) canvas.width = outW;
      if (canvas.height !== outH) canvas.height = outH;

      ctx.save();
      ctx.filter = buildFilter(s);

      // Move origin to centre for rotation / flipping.
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (rot) ctx.rotate((rot * Math.PI) / 180);
      const sx = s.mirror ? -1 : 1;
      const sy = s.flipV ? -1 : 1;
      ctx.scale(sx, sy);

      // Digital zoom: crop a centred region of the source.
      const z = Math.max(100, s.zoom) / 100;
      const cropW = srcW / z;
      const cropH = srcH / z;
      const cropX = (srcW - cropW) / 2;
      const cropY = (srcH - cropH) / 2;

      try {
        ctx.drawImage(
          video,
          cropX, cropY, cropW, cropH,
          -srcW / 2, -srcH / 2, srcW, srcH
        );
      } catch (_) { /* frame not ready yet */ }
      ctx.restore();

      schedule();
    }

    function schedule() {
      if (!running) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        video.requestVideoFrameCallback(drawFrame);
      } else {
        setTimeout(() => requestAnimationFrame(drawFrame), 1000 / fps);
      }
    }

    const outStream = canvas.captureStream(fps);
    const outVideo = outStream.getVideoTracks()[0];

    // Keep the pipeline alive & tidy it up when the consumer is done.
    const stopAll = () => {
      running = false;
      try { videoTrack.stop(); } catch (_) {}
      try { video.srcObject = null; } catch (_) {}
    };
    if (outVideo) {
      const nativeStop = outVideo.stop.bind(outVideo);
      outVideo.stop = () => { stopAll(); nativeStop(); };
      outVideo.addEventListener("ended", stopAll);
    }
    videoTrack.addEventListener("ended", () => { running = false; });

    (audioTracks || []).forEach((t) => outStream.addTrack(t));

    const kick = () => { video.play().catch(() => {}); schedule(); };
    if (video.readyState >= 2) kick();
    else video.addEventListener("loadeddata", kick, { once: true });
    // Safety net in case loadeddata never fires.
    setTimeout(kick, 400);

    return outStream;
  }

  async function patchedGetUserMedia(constraints) {
    const real = await nativeGUM(constraints);
    try {
      if (!settings.enabled) return real;
      if (!constraints || !constraints.video) return real;
      const videoTrack = real.getVideoTracks()[0];
      if (!videoTrack) return real;
      return processTrack(videoTrack, real.getAudioTracks());
    } catch (err) {
      // Never break the host site — fall back to the untouched stream.
      console.warn("[Cam360] processing failed, using raw camera:", err);
      return real;
    }
  }

  try {
    md.getUserMedia = patchedGetUserMedia;
  } catch (_) {
    // Some pages freeze mediaDevices; redefine on the property if possible.
    try {
      Object.defineProperty(md, "getUserMedia", {
        configurable: true, writable: true, value: patchedGetUserMedia
      });
    } catch (e) { console.warn("[Cam360] could not install getUserMedia hook", e); }
  }

  // Legacy API some old apps still use.
  const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  if (legacy) {
    const wrapped = function (constraints, onSuccess, onError) {
      patchedGetUserMedia(constraints).then(onSuccess, onError);
    };
    navigator.getUserMedia = wrapped;
  }
})();
