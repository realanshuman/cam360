/*
 * Cam360 — inject.js  (runs in the page's MAIN world at document_start)
 * ---------------------------------------------------------------------
 * Overrides navigator.mediaDevices.getUserMedia. Every camera stream a site
 * requests is routed through a <canvas> pipeline that applies the user's live
 * adjustments (mirror / flip / rotate / lighting / blur / zoom) and, when
 * enabled, a MediaPipe-powered background effect (blur / colour / image).
 *
 * Settings + the extension's base URL arrive from bridge.js (ISOLATED world)
 * via window.postMessage — MAIN-world scripts cannot read chrome.* directly.
 */
(() => {
  "use strict";
  if (window.__CAM360_INSTALLED__) return;
  window.__CAM360_INSTALLED__ = true;

  const DEFAULTS = {
    enabled: true,
    mirror: false, flipV: false, rotate: 0,
    brightness: 100, contrast: 100, saturation: 100,
    blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100,
    lowLight: false, beautify: 0,
    bg: "off",          // off | blur | color | image
    bgBlur: 14,         // px
    bgColor: "#0b1020",
    bgImage: "",        // dataURL or gradient preset id (grad-*)
    feather: 4          // mask edge softening (px)
  };

  let settings = { ...DEFAULTS };
  let baseURL = "";

  // Runtime status we surface to the UI (not persisted as settings).
  const status = { segState: "idle", message: "" }; // idle|loading|ready|error
  function pushStatus(patch) {
    Object.assign(status, patch);
    window.postMessage({ __cam360: "status", value: { ...status } }, "*");
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data) return;
    if (e.data.__cam360 === "settings") {
      settings = { ...DEFAULTS, ...e.data.value };
      if (e.data.baseURL) baseURL = e.data.baseURL;
      maybeInitSegmenter();
    } else if (e.data.__cam360 === "base") {
      baseURL = e.data.baseURL || baseURL;
    }
  });

  const md = navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return;
  const nativeGUM = md.getUserMedia.bind(md);

  /* ----------------------- MediaPipe segmenter ----------------------- */
  let segmenter = null;
  let segLoading = false;
  const needsSeg = () => settings.bg && settings.bg !== "off";

  async function maybeInitSegmenter() {
    if (segmenter || segLoading || !needsSeg() || !baseURL) return;
    segLoading = true;
    pushStatus({ segState: "loading", message: "Loading background engine…" });
    try {
      const vision = await import(baseURL + "vendor/mediapipe/vision_bundle.mjs");
      const fileset = await vision.FilesetResolver.forVisionTasks(baseURL + "vendor/mediapipe/wasm");
      const make = (delegate) => vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: baseURL + "vendor/mediapipe/selfie_segmenter.tflite",
          delegate
        },
        runningMode: "VIDEO",
        outputConfidenceMasks: true,
        outputCategoryMask: false
      });
      try { segmenter = await make("GPU"); }
      catch (_) { segmenter = await make("CPU"); }
      pushStatus({ segState: "ready", message: "Background engine ready" });
    } catch (err) {
      console.warn("[Cam360] segmenter init failed:", err);
      pushStatus({
        segState: "error",
        message: "Background effects unavailable on this site (blocked by its security policy). All other effects still work."
      });
    } finally {
      segLoading = false;
    }
  }

  /* --------------------------- Filters ------------------------------- */
  function buildFilter(s) {
    const bright = s.brightness * (s.lowLight ? 1.18 : 1);
    const contrast = s.contrast * (s.lowLight ? 0.94 : 1);
    const sat = s.saturation * (s.lowLight ? 1.1 : 1);
    return [
      `brightness(${bright}%)`,
      `contrast(${contrast}%)`,
      `saturate(${sat}%)`,
      `grayscale(${s.grayscale}%)`,
      `sepia(${s.sepia}%)`,
      `hue-rotate(${s.hue}deg)`,
      s.blur > 0 ? `blur(${s.blur}px)` : ""
    ].filter(Boolean).join(" ");
  }

  // Cache for gradient / image background layers, keyed by descriptor.
  const bgCache = { key: "", canvas: null, img: null, imgSrc: "" };

  function makeGradient(id, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d");
    const stops = {
      "grad-purple": ["#4f46e5", "#7c3aed", "#db2777"],
      "grad-sunset": ["#f59e0b", "#ef4444", "#7c3aed"],
      "grad-ocean":  ["#0ea5e9", "#2563eb", "#0f172a"],
      "grad-forest": ["#065f46", "#10b981", "#a7f3d0"],
      "grad-mono":   ["#1f2937", "#374151", "#111827"]
    }[id] || ["#1f2937", "#111827"];
    const lin = g.createLinearGradient(0, 0, w, h);
    stops.forEach((c2, i) => lin.addColorStop(i / (stops.length - 1), c2));
    g.fillStyle = lin; g.fillRect(0, 0, w, h);
    return c;
  }

  function getBackgroundLayer(s, w, h, sourceCanvas) {
    if (s.bg === "color") {
      const key = "color:" + s.bgColor + w + h;
      if (bgCache.key !== key) {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d"); g.fillStyle = s.bgColor; g.fillRect(0, 0, w, h);
        bgCache.key = key; bgCache.canvas = c;
      }
      return bgCache.canvas;
    }
    if (s.bg === "image") {
      const isGrad = /^grad-/.test(s.bgImage);
      if (isGrad) {
        const key = "grad:" + s.bgImage + w + h;
        if (bgCache.key !== key) { bgCache.canvas = makeGradient(s.bgImage, w, h); bgCache.key = key; }
        return bgCache.canvas;
      }
      // Custom image (dataURL): load once, then cover-fit into a sized canvas.
      if (bgCache.imgSrc !== s.bgImage) {
        const im = new Image();
        im.onload = () => { bgCache.img = im; bgCache.key = ""; };
        im.src = s.bgImage;
        bgCache.imgSrc = s.bgImage;
      }
      const key = "img:" + s.bgImage + w + h;
      if (bgCache.img && bgCache.key !== key) {
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d");
        const im = bgCache.img;
        const scale = Math.max(w / im.width, h / im.height);
        const dw = im.width * scale, dh = im.height * scale;
        g.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
        bgCache.key = key; bgCache.canvas = c;
      }
      if (bgCache.canvas) return bgCache.canvas;
    }
    // Fallback (also used for "blur"): a blurred copy of the frame.
    return null;
  }

  /* --------------------------- Pipeline ------------------------------ */
  function processTrack(videoTrack, audioTracks) {
    const ts = videoTrack.getSettings() || {};
    const srcW = ts.width || 640, srcH = ts.height || 480;
    const fps = ts.frameRate || 30;

    const video = document.createElement("video");
    video.muted = true; video.autoplay = true; video.playsInline = true;
    video.srcObject = new MediaStream([videoTrack]);

    const canvas = document.createElement("canvas");        // final output
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

    // Scratch canvases reused across frames.
    const fg = document.createElement("canvas");            // processed foreground
    const fgCtx = fg.getContext("2d");
    const bgLayer = document.createElement("canvas");       // background layer
    const bgCtx = bgLayer.getContext("2d");
    const cut = document.createElement("canvas");           // masked foreground
    const cutCtx = cut.getContext("2d");
    const maskCanvas = document.createElement("canvas");    // person alpha mask
    const maskCtx = maskCanvas.getContext("2d");
    const segInput = document.createElement("canvas");      // downscaled seg input
    const segCtx = segInput.getContext("2d");

    let running = true;
    let lastTs = 0;
    let maskData = null; // ImageData for the current mask

    function segStore(mask) {
      const mw = mask.width, mh = mask.height;
      if (maskCanvas.width !== mw || maskCanvas.height !== mh) {
        maskCanvas.width = mw; maskCanvas.height = mh;
        maskData = maskCtx.createImageData(mw, mh);
      }
      const arr = mask.getAsFloat32Array();
      const px = maskData.data;
      for (let i = 0, j = 0; i < arr.length; i++, j += 4) {
        const a = arr[i] * 255;
        px[j] = 255; px[j + 1] = 255; px[j + 2] = 255; px[j + 3] = a;
      }
      maskCtx.putImageData(maskData, 0, 0);
    }

    function runSegmentation(w, h) {
      if (!segmenter) return;
      const scale = Math.min(1, 320 / Math.max(w, h));
      const sw = Math.max(2, Math.round(w * scale));
      const sh = Math.max(2, Math.round(h * scale));
      if (segInput.width !== sw || segInput.height !== sh) { segInput.width = sw; segInput.height = sh; }
      segCtx.drawImage(fg, 0, 0, sw, sh);
      let t = performance.now();
      if (t <= lastTs) t = lastTs + 1;
      lastTs = t;
      try {
        segmenter.segmentForVideo(segInput, t, (result) => {
          const m = result.confidenceMasks && result.confidenceMasks[0];
          if (m) { try { segStore(m); } catch (_) {} }
        });
      } catch (_) { /* transient */ }
    }

    function drawFrame() {
      if (!running) return;
      const s = settings;
      const rot = ((s.rotate % 360) + 360) % 360;
      const swap = rot === 90 || rot === 270;
      const outW = swap ? srcH : srcW, outH = swap ? srcW : srcH;

      if (fg.width !== outW) { fg.width = outW; fg.height = outH; }

      // --- foreground: oriented + colour-graded frame ---
      fgCtx.save();
      fgCtx.filter = buildFilter(s);
      fgCtx.translate(fg.width / 2, fg.height / 2);
      if (rot) fgCtx.rotate((rot * Math.PI) / 180);
      fgCtx.scale(s.mirror ? -1 : 1, s.flipV ? -1 : 1);
      const z = Math.max(100, s.zoom) / 100;
      const cw = srcW / z, ch = srcH / z, cx = (srcW - cw) / 2, cy = (srcH - ch) / 2;
      try { fgCtx.drawImage(video, cx, cy, cw, ch, -srcW / 2, -srcH / 2, srcW, srcH); } catch (_) {}
      fgCtx.restore();

      // Optional beautify: alpha-blend a blurred copy over the frame to
      // soften skin/blemishes while keeping most detail.
      if (s.beautify > 0) {
        fgCtx.save();
        fgCtx.globalAlpha = Math.min(0.7, s.beautify / 130);
        fgCtx.filter = `blur(${1 + s.beautify / 30}px)`;
        try { fgCtx.drawImage(fg, 0, 0); } catch (_) {}
        fgCtx.restore();
      }

      if (canvas.width !== outW) { canvas.width = outW; canvas.height = outH; }

      const bgOn = needsSeg() && segmenter && maskCanvas.width > 0;
      if (bgOn) {
        runSegmentation(outW, outH);

        // background layer
        if (bgLayer.width !== outW) { bgLayer.width = outW; bgLayer.height = outH; }
        const preset = getBackgroundLayer(s, outW, outH, fg);
        if (s.bg === "blur" || !preset) {
          bgCtx.save();
          bgCtx.filter = `blur(${s.bgBlur}px)`;
          try { bgCtx.drawImage(fg, 0, 0); } catch (_) {}
          bgCtx.restore();
        } else {
          bgCtx.clearRect(0, 0, outW, outH);
          bgCtx.drawImage(preset, 0, 0, outW, outH);
        }

        // masked foreground (person only), feathered edges
        if (cut.width !== outW) { cut.width = outW; cut.height = outH; }
        cutCtx.clearRect(0, 0, outW, outH);
        cutCtx.drawImage(fg, 0, 0);
        cutCtx.globalCompositeOperation = "destination-in";
        cutCtx.filter = s.feather > 0 ? `blur(${s.feather}px)` : "none";
        cutCtx.drawImage(maskCanvas, 0, 0, outW, outH);
        cutCtx.filter = "none";
        cutCtx.globalCompositeOperation = "source-over";

        ctx.drawImage(bgLayer, 0, 0);
        ctx.drawImage(cut, 0, 0);
      } else {
        if (needsSeg() && segmenter) runSegmentation(outW, outH); // warm up mask
        ctx.drawImage(fg, 0, 0);
      }

      schedule();
    }

    function schedule() {
      if (!running) return;
      if (typeof video.requestVideoFrameCallback === "function") video.requestVideoFrameCallback(drawFrame);
      else setTimeout(() => requestAnimationFrame(drawFrame), 1000 / fps);
    }

    const outStream = canvas.captureStream(fps);
    const outVideo = outStream.getVideoTracks()[0];
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
    setTimeout(kick, 400);

    maybeInitSegmenter();
    return outStream;
  }

  async function patchedGetUserMedia(constraints) {
    const real = await nativeGUM(constraints);
    try {
      if (!settings.enabled || !constraints || !constraints.video) return real;
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
    try {
      Object.defineProperty(md, "getUserMedia", { configurable: true, writable: true, value: patchedGetUserMedia });
    } catch (e) { console.warn("[Cam360] could not install getUserMedia hook", e); }
  }

  const legacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  if (legacy) {
    navigator.getUserMedia = function (constraints, onSuccess, onError) {
      patchedGetUserMedia(constraints).then(onSuccess, onError);
    };
  }
})();
