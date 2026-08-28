/*
 * Cam360 — engine.js
 * ------------------------------------------------------------------
 * The frame processing pipeline, shared by every surface that renders
 * the camera:
 *
 *   - inject.js  runs it in the page's MAIN world and hands the result
 *                back to the site as a MediaStream
 *   - the popup  runs it on its own camera to show a live self preview
 *
 * Both use this one file on purpose. A preview drawn by a second, similar
 * implementation would drift from the real output and stop being a preview.
 *
 * Exposes window.Cam360Engine. No imports, no build step, so it loads the
 * same way as a classic script in a content script and in an extension page.
 */
(() => {
  "use strict";
  if (window.Cam360Engine) return;

  const DEFAULTS = {
    enabled: true,
    mirror: false, flipV: false, rotate: 0,
    brightness: 100, contrast: 100, saturation: 100,
    blur: 0, grayscale: 0, sepia: 0, hue: 0, zoom: 100,
    lowLight: false, beautify: 0,
    bg: "off",          // off | blur | color | scene | video
    keyer: "ai",        // ai | chroma
    bgBlur: 14, bgColor: "#0b1020", bgImage: "", bgVideo: "", feather: 4,
    chromaColor: "#00c000", chromaThreshold: 42, chromaSmooth: 14,
    freeze: false, brb: false, brbText: "Be right back", brbImage: "",
    showName: false, nameText: "", showLogo: false, logoImage: "", showClock: false
  };

  function normalize(value) {
    const s = { ...DEFAULTS, ...(value || {}) };
    if (s.bg === "image") s.bg = "scene";   // migrate a value stored by an older build
    return s;
  }

  /* ----------------------- MediaPipe segmenter -----------------------
   * One segmenter per JS context, shared by every renderer in it. The
   * timestamp it is fed must increase monotonically, so that counter is
   * shared too rather than kept per renderer.
   */
  let segmenter = null, segLoading = false, lastTs = 0;

  async function initSegmenter(baseURL, onStatus) {
    if (segmenter || segLoading || !baseURL) return segmenter;
    segLoading = true;
    onStatus && onStatus({ segState: "loading", message: "Loading AI background engine…" });
    try {
      const vision = await import(baseURL + "vendor/mediapipe/vision_bundle.mjs");
      const fileset = await vision.FilesetResolver.forVisionTasks(baseURL + "vendor/mediapipe/wasm");
      const make = (delegate) => vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: baseURL + "vendor/mediapipe/selfie_segmenter.tflite", delegate },
        runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false
      });
      try { segmenter = await make("GPU"); } catch (_) { segmenter = await make("CPU"); }
      onStatus && onStatus({ segState: "ready", message: "AI background ready" });
    } catch (err) {
      console.warn("[Cam360] segmenter init failed:", err);
      onStatus && onStatus({
        segState: "error",
        message: "AI background blocked by this site's security policy. Tip: switch keyer to Green screen, it works here."
      });
    } finally { segLoading = false; }
    return segmenter;
  }

  /* --------------------------- Helpers ------------------------------- */
  function buildFilter(s) {
    const bright = s.brightness * (s.lowLight ? 1.18 : 1);
    const contrast = s.contrast * (s.lowLight ? 0.94 : 1);
    const sat = s.saturation * (s.lowLight ? 1.1 : 1);
    return [
      `brightness(${bright}%)`, `contrast(${contrast}%)`, `saturate(${sat}%)`,
      `grayscale(${s.grayscale}%)`, `sepia(${s.sepia}%)`, `hue-rotate(${s.hue}deg)`,
      s.blur > 0 ? `blur(${s.blur}px)` : ""
    ].filter(Boolean).join(" ");
  }

  const hexToRgb = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 200, 0];
  };

  const imgCache = new Map();
  function getImage(src) {
    if (!src) return null;
    let e = imgCache.get(src);
    if (!e) { e = { img: new Image(), ready: false }; e.img.onload = () => (e.ready = true); e.img.src = src; imgCache.set(src, e); }
    return e.ready ? e.img : null;
  }

  let bgVideoEl = null, bgVideoSrc = "";
  function getBgVideo(src) {
    if (!src) return null;
    if (bgVideoSrc !== src) {
      if (bgVideoEl) { try { bgVideoEl.pause(); } catch (_) {} }
      bgVideoEl = document.createElement("video");
      bgVideoEl.muted = true; bgVideoEl.loop = true; bgVideoEl.autoplay = true; bgVideoEl.playsInline = true;
      bgVideoEl.src = src; bgVideoEl.play().catch(() => {});
      bgVideoSrc = src;
    }
    return bgVideoEl && bgVideoEl.readyState >= 2 ? bgVideoEl : null;
  }

  function gradientStops(id) {
    return {
      "grad-purple": ["#4f46e5", "#7c3aed", "#db2777"],
      "grad-sunset": ["#f59e0b", "#ef4444", "#7c3aed"],
      "grad-ocean":  ["#0ea5e9", "#2563eb", "#0f172a"],
      "grad-forest": ["#065f46", "#10b981", "#a7f3d0"],
      "grad-mono":   ["#1f2937", "#374151", "#111827"]
    }[id];
  }

  function coverDraw(g, media, mw, mh, w, h) {
    const scale = Math.max(w / mw, h / mh);
    const dw = mw * scale, dh = mh * scale;
    g.drawImage(media, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function drawBackgroundContent(g, s, w, h, fgCanvas) {
    if (s.bg === "color") { g.fillStyle = s.bgColor; g.fillRect(0, 0, w, h); return; }
    if (s.bg === "scene") {
      const stops = gradientStops(s.bgImage);
      if (stops) {
        const lin = g.createLinearGradient(0, 0, w, h);
        stops.forEach((c, i) => lin.addColorStop(i / (stops.length - 1), c));
        g.fillStyle = lin; g.fillRect(0, 0, w, h); return;
      }
      const img = getImage(s.bgImage);
      if (img) { coverDraw(g, img, img.width, img.height, w, h); return; }
      g.fillStyle = "#111827"; g.fillRect(0, 0, w, h); return;
    }
    if (s.bg === "video") {
      const t = performance.now() / 1000;
      if (s.bgVideo === "anim-aurora") {
        const lin = g.createLinearGradient(0, 0, w, h);
        const hue = (t * 20) % 360;
        lin.addColorStop(0, `hsl(${hue},70%,45%)`);
        lin.addColorStop(0.5, `hsl(${(hue + 60) % 360},75%,40%)`);
        lin.addColorStop(1, `hsl(${(hue + 140) % 360},70%,25%)`);
        g.fillStyle = lin; g.fillRect(0, 0, w, h); return;
      }
      if (s.bgVideo === "anim-waves") {
        g.fillStyle = "#0b1020"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 5; i++) {
          g.beginPath();
          const hue = (200 + i * 24 + t * 30) % 360;
          g.strokeStyle = `hsla(${hue},80%,60%,0.5)`; g.lineWidth = 6;
          for (let x = 0; x <= w; x += 8) {
            const y = h / 2 + Math.sin(x / 60 + t * 1.5 + i) * (30 + i * 10) + (i - 2) * 40;
            x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
          }
          g.stroke();
        }
        return;
      }
      const vid = getBgVideo(s.bgVideo);
      if (vid) { coverDraw(g, vid, vid.videoWidth, vid.videoHeight, w, h); return; }
      g.fillStyle = "#111827"; g.fillRect(0, 0, w, h); return;
    }
    // "blur": a blurred copy of the foreground
    g.save(); g.filter = `blur(${s.bgBlur}px)`;
    try { g.drawImage(fgCanvas, 0, 0, w, h); } catch (_) {}
    g.restore();
  }

  /* --------------------------- Renderer ------------------------------ */
  /**
   * createRenderer({ video, canvas, getSettings, getBaseURL, onStatus, fps })
   * Draws `video` onto `canvas` with the current settings applied, until stop().
   */
  function createRenderer(opts) {
    const video = opts.video;
    const canvas = opts.canvas;
    const getSettings = opts.getSettings;
    const getBaseURL = opts.getBaseURL || (() => "");
    const onStatus = opts.onStatus;
    const fps = opts.fps || 30;

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    const fg = document.createElement("canvas"), fgCtx = fg.getContext("2d");
    const bgLayer = document.createElement("canvas"), bgCtx = bgLayer.getContext("2d");
    const cut = document.createElement("canvas"), cutCtx = cut.getContext("2d", { willReadFrequently: true });
    const maskCanvas = document.createElement("canvas"), maskCtx = maskCanvas.getContext("2d");
    const segInput = document.createElement("canvas"), segCtx = segInput.getContext("2d");

    let running = false, maskData = null;

    // Read the size from the element each frame, so a track that changes
    // resolution mid call is followed rather than stretched.
    function sourceSize() {
      return { w: video.videoWidth || opts.width || 640, h: video.videoHeight || opts.height || 480 };
    }

    function segStore(mask) {
      const mw = mask.width, mh = mask.height;
      if (maskCanvas.width !== mw || maskCanvas.height !== mh) {
        maskCanvas.width = mw; maskCanvas.height = mh; maskData = maskCtx.createImageData(mw, mh);
      }
      const arr = mask.getAsFloat32Array(), px = maskData.data;
      for (let i = 0, j = 0; i < arr.length; i++, j += 4) { px[j] = 255; px[j + 1] = 255; px[j + 2] = 255; px[j + 3] = arr[i] * 255; }
      maskCtx.putImageData(maskData, 0, 0);
    }

    function runSegmentation(w, h) {
      if (!segmenter) return;
      const scale = Math.min(1, 320 / Math.max(w, h));
      const sw = Math.max(2, Math.round(w * scale)), sh = Math.max(2, Math.round(h * scale));
      if (segInput.width !== sw || segInput.height !== sh) { segInput.width = sw; segInput.height = sh; }
      segCtx.drawImage(fg, 0, 0, sw, sh);
      let t = performance.now(); if (t <= lastTs) t = lastTs + 1; lastTs = t;
      try {
        segmenter.segmentForVideo(segInput, t, (r) => {
          const m = r.confidenceMasks && r.confidenceMasks[0];
          if (m) { try { segStore(m); } catch (_) {} }
        });
      } catch (_) {}
    }

    function chromaCut(w, h, s) {
      if (cut.width !== w || cut.height !== h) { cut.width = w; cut.height = h; }
      cutCtx.drawImage(fg, 0, 0);
      const id = cutCtx.getImageData(0, 0, w, h), px = id.data;
      const [kr, kg, kb] = hexToRgb(s.chromaColor);
      const inner = s.chromaThreshold * 4.41;
      const outer = inner + Math.max(1, s.chromaSmooth) * 4.41;
      const inner2 = inner * inner, outer2 = outer * outer, span = outer - inner;
      for (let i = 0; i < px.length; i += 4) {
        const dr = px[i] - kr, dg = px[i + 1] - kg, db = px[i + 2] - kb;
        const d2 = dr * dr + dg * dg + db * db;      // squared distance, no sqrt
        if (d2 < inner2) px[i + 3] = 0;              // fully keyed
        else if (d2 < outer2) {                       // edge band only: sqrt here
          px[i + 3] = ((Math.sqrt(d2) - inner) / span) * 255;
          if (px[i + 1] > px[i] && px[i + 1] > px[i + 2]) px[i + 1] = (px[i] + px[i + 2]) >> 1;
        }
      }
      cutCtx.putImageData(id, 0, 0);
    }

    function drawOverlays(s, w, h) {
      if (s.showLogo && s.logoImage) {
        const logo = getImage(s.logoImage);
        if (logo) {
          const lw = Math.min(w * 0.18, 140), lh = lw * (logo.height / logo.width);
          ctx.globalAlpha = 0.92; ctx.drawImage(logo, w - lw - 16, 16, lw, lh); ctx.globalAlpha = 1;
        }
      }
      if (s.showName && s.nameText) {
        const fsz = Math.max(14, Math.round(h * 0.045));
        ctx.font = `600 ${fsz}px system-ui,Segoe UI,Roboto,sans-serif`;
        const tw = ctx.measureText(s.nameText).width;
        const padX = fsz * 0.6, barH = fsz * 1.7, y = h - barH - 16;
        ctx.fillStyle = "rgba(20,16,40,0.72)";
        ctx.fillRect(16, y, tw + padX * 2, barH);
        ctx.fillStyle = "#a78bfa"; ctx.fillRect(16, y, 5, barH);
        ctx.fillStyle = "#fff"; ctx.textBaseline = "middle";
        ctx.fillText(s.nameText, 16 + padX, y + barH / 2);
      }
      if (s.showClock) {
        const txt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const fsz = Math.max(13, Math.round(h * 0.04));
        ctx.font = `600 ${fsz}px system-ui,Segoe UI,Roboto,sans-serif`;
        const tw = ctx.measureText(txt).width, padX = fsz * 0.5;
        ctx.fillStyle = "rgba(20,16,40,0.6)";
        ctx.fillRect(w - tw - padX * 2 - 16, h - fsz * 1.6 - 16, tw + padX * 2, fsz * 1.6);
        ctx.fillStyle = "#e9d5ff"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
        ctx.fillText(txt, w - tw - padX - 16, h - fsz * 0.8 - 16);
      }
    }

    function drawBrb(s, w, h) {
      if (s.brbImage) {
        const img = getImage(s.brbImage);
        if (img) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); coverDraw(ctx, img, img.width, img.height, w, h); return; }
      }
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#4f46e5"); grad.addColorStop(1, "#7c3aed");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.round(h * 0.09)}px system-ui,Segoe UI,Roboto,sans-serif`;
      ctx.fillText(s.brbText || "Be right back", w / 2, h / 2);
      ctx.textAlign = "left";
    }

    function drawFrame() {
      if (!running) return;
      const s = normalize(getSettings());
      const { w: srcW, h: srcH } = sourceSize();

      // Master switch off means an immediate raw passthrough, evaluated every
      // frame so toggling it lands on a stream that is already running.
      if (!s.enabled) {
        if (canvas.width !== srcW || canvas.height !== srcH) { canvas.width = srcW; canvas.height = srcH; }
        try { ctx.drawImage(video, 0, 0, srcW, srcH); } catch (_) {}
        return schedule();
      }

      if (s.bg !== "off" && s.keyer === "ai" && !segmenter) initSegmenter(getBaseURL(), onStatus);

      const rot = ((s.rotate % 360) + 360) % 360, swap = rot === 90 || rot === 270;
      const outW = swap ? srcH : srcW, outH = swap ? srcW : srcH;
      if (canvas.width !== outW || canvas.height !== outH) { canvas.width = outW; canvas.height = outH; }

      if (s.brb) { drawBrb(s, outW, outH); drawOverlays(s, outW, outH); return schedule(); }
      if (s.freeze) return schedule(); // hold the last frame

      if (fg.width !== outW || fg.height !== outH) { fg.width = outW; fg.height = outH; }
      fgCtx.save();
      fgCtx.filter = buildFilter(s);
      fgCtx.translate(fg.width / 2, fg.height / 2);
      if (rot) fgCtx.rotate((rot * Math.PI) / 180);
      fgCtx.scale(s.mirror ? -1 : 1, s.flipV ? -1 : 1);
      const z = Math.max(100, s.zoom) / 100;
      const cw = srcW / z, ch = srcH / z, cx = (srcW - cw) / 2, cy = (srcH - ch) / 2;
      try { fgCtx.drawImage(video, cx, cy, cw, ch, -srcW / 2, -srcH / 2, srcW, srcH); } catch (_) {}
      fgCtx.restore();

      if (s.beautify > 0) {
        fgCtx.save();
        fgCtx.globalAlpha = Math.min(0.7, s.beautify / 130);
        fgCtx.filter = `blur(${1 + s.beautify / 30}px)`;
        try { fgCtx.drawImage(fg, 0, 0); } catch (_) {}
        fgCtx.restore();
      }

      const wantBg = s.bg !== "off";
      let composited = false;
      if (wantBg && s.keyer === "chroma") {
        if (bgLayer.width !== outW || bgLayer.height !== outH) { bgLayer.width = outW; bgLayer.height = outH; }
        bgCtx.clearRect(0, 0, outW, outH);
        drawBackgroundContent(bgCtx, s, outW, outH, fg);
        chromaCut(outW, outH, s);
        ctx.drawImage(bgLayer, 0, 0); ctx.drawImage(cut, 0, 0);
        composited = true;
      } else if (wantBg && s.keyer === "ai" && segmenter) {
        runSegmentation(outW, outH);
        if (maskCanvas.width > 0) {
          if (bgLayer.width !== outW || bgLayer.height !== outH) { bgLayer.width = outW; bgLayer.height = outH; }
          bgCtx.clearRect(0, 0, outW, outH);
          drawBackgroundContent(bgCtx, s, outW, outH, fg);
          if (cut.width !== outW || cut.height !== outH) { cut.width = outW; cut.height = outH; }
          cutCtx.clearRect(0, 0, outW, outH);
          cutCtx.drawImage(fg, 0, 0);
          cutCtx.globalCompositeOperation = "destination-in";
          cutCtx.filter = s.feather > 0 ? `blur(${s.feather}px)` : "none";
          cutCtx.drawImage(maskCanvas, 0, 0, outW, outH);
          cutCtx.filter = "none"; cutCtx.globalCompositeOperation = "source-over";
          ctx.drawImage(bgLayer, 0, 0); ctx.drawImage(cut, 0, 0);
          composited = true;
        }
      }
      if (!composited) ctx.drawImage(fg, 0, 0);

      drawOverlays(s, outW, outH);
      schedule();
    }

    function schedule() {
      if (!running) return;
      if (typeof video.requestVideoFrameCallback === "function") video.requestVideoFrameCallback(drawFrame);
      else setTimeout(() => requestAnimationFrame(drawFrame), 1000 / fps);
    }

    return {
      start() {
        if (running) return;
        running = true;
        const kick = () => { video.play().catch(() => {}); schedule(); };
        if (video.readyState >= 2) kick();
        else video.addEventListener("loadeddata", kick, { once: true });
        setTimeout(() => { if (running) kick(); }, 400);
      },
      stop() { running = false; },
      isRunning() { return running; }
    };
  }

  window.Cam360Engine = { DEFAULTS, normalize, createRenderer, initSegmenter };
})();
