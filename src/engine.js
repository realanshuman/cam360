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

  /* The settings shape is defined once, in settings.js.
     In the popup that file is loaded alongside this one and can be read
     directly. In a page's MAIN world it cannot be: Chrome injects a content
     script file once per document, so settings.js goes to the ISOLATED world
     where chrome.storage is, and bridge.js hands the shape across with
     setDefaults() before any camera is opened. */
  let DEFAULTS = window.Cam360Settings ? window.Cam360Settings.DEFAULTS : null;

  function setDefaults(d) { if (d && !DEFAULTS) DEFAULTS = d; }

  function normalize(value) {
    const s = { ...(DEFAULTS || {}), ...(value || {}) };
    if (s.bg === "image") s.bg = "scene";   // a value stored by an older build
    return s;
  }

  /* True once the engine knows the full shape and can safely render. */
  function ready() { return !!DEFAULTS; }

  /* ----------------------- MediaPipe segmenter -----------------------
   * One segmenter per JS context, shared by every renderer in it. The
   * timestamp it is fed must increase monotonically, so that counter is
   * shared too rather than kept per renderer.
   */
  let segmenter = null, segLoading = false, lastTs = 0, lastSegAt = 0;
  const SEG_INTERVAL_MS = 66;   /* about 15 mask updates a second */

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
    /* No willReadFrequently here on purpose: the downscale is a GPU draw and
       only the small result is read back, so forcing this canvas onto the CPU
       would pull the full size frame across the boundary and undo the saving. */
    const keyIn = document.createElement("canvas"), keyInCtx = keyIn.getContext("2d");
    const keyMask = document.createElement("canvas"), keyMaskCtx = keyMask.getContext("2d");
    const soft = document.createElement("canvas"), softCtx = soft.getContext("2d");

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

    /* The model is the most expensive thing in the frame and the mask it
       returns barely changes between neighbouring frames, so run it at a
       fraction of the frame rate and keep using the last mask in between.
       At 30fps that is one run in two; the edge is blurred by the feather
       either way, so the saving does not show. */
    function runSegmentation(w, h) {
      if (!segmenter) return;
      const now = performance.now();
      if (now - lastSegAt < SEG_INTERVAL_MS) return;
      lastSegAt = now;
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

    /* Green screen key.
     *
     * The mask is built at KEY_MAX on the long side rather than at frame
     * size. getImageData and putImageData move the pixels between the GPU
     * and JS, so a 1280x720 pass is several megabytes each way, every
     * frame, on the one keyer that sites like Google Meet leave available.
     * A mask is a soft edge and not detail, so it scales back up cleanly,
     * and the blur that smooths the upscale is the same kind of feather the
     * AI path already relies on.
     *
     * The per pixel green correction the full size pass used to apply is
     * gone with it. It only ever touched pixels inside the soft band, which
     * are part transparent and get blended with the background anyway, and
     * the feather now averages that fringe out instead.
     */
    /* Half the frame, between 320 and 640 on the long side. Half is where
       the downscale stops averaging the key colour into the subject's edge:
       below that a green fringe appears, because every edge mask pixel is a
       blend of green and subject and gets drawn at partial alpha over the
       background. 640 is where a measured count of green fringe pixels on a
       test key reaches zero, the same as the old full resolution pass. */
    const KEY_MIN_SIDE = 320, KEY_MAX_SIDE = 640;
    /* Squared rather than linear ramp, so a mask pixel that is still half
       key colour resolves toward cut rather than toward kept. */
    const KEY_GAMMA = 2;
    function chromaMask(w, h, s) {
      const long = Math.max(w, h);
      const target = Math.min(KEY_MAX_SIDE, Math.max(KEY_MIN_SIDE, Math.round(long / 2)));
      const scale = Math.min(1, target / long);
      const kw = Math.max(2, Math.round(w * scale)), kh = Math.max(2, Math.round(h * scale));
      if (keyIn.width !== kw || keyIn.height !== kh) { keyIn.width = kw; keyIn.height = kh; }
      keyInCtx.drawImage(fg, 0, 0, kw, kh);
      const id = keyInCtx.getImageData(0, 0, kw, kh), px = id.data;
      const [kr, kg, kb] = hexToRgb(s.chromaColor);
      const inner = s.chromaThreshold * 4.41;
      const outer = inner + Math.max(1, s.chromaSmooth) * 4.41;
      const inner2 = inner * inner, outer2 = outer * outer, span = outer - inner;
      for (let i = 0; i < px.length; i += 4) {
        const dr = px[i] - kr, dg = px[i + 1] - kg, db = px[i + 2] - kb;
        const d2 = dr * dr + dg * dg + db * db;      // squared distance, no sqrt
        let a;
        if (d2 < inner2) a = 0;                      // key colour: cut out
        else if (d2 < outer2) { const t = (Math.sqrt(d2) - inner) / span; a = t * t * 255; }
        else a = 255;                                // keep
        px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = a;
      }
      if (keyMask.width !== kw || keyMask.height !== kh) { keyMask.width = kw; keyMask.height = kh; }
      keyMaskCtx.putImageData(id, 0, 0);
      return keyMask;
    }

    /* Soften a mask while it is still small.
     *
     * Both masks are built at about 320px and then stretched over the frame,
     * so a blur applied here costs a sixteenth of the same blur applied
     * after the stretch, and lands on the same edge. `feather` is given in
     * output pixels, so it is scaled down to mask pixels on the way in. */
    function softenMask(mask, outW, featherPx) {
      const r = (featherPx * mask.width) / outW;
      if (r < 0.3) return mask;
      if (soft.width !== mask.width || soft.height !== mask.height) { soft.width = mask.width; soft.height = mask.height; }
      softCtx.clearRect(0, 0, soft.width, soft.height);
      softCtx.filter = `blur(${r}px)`;
      softCtx.drawImage(mask, 0, 0);
      softCtx.filter = "none";
      return soft;
    }

    /* Cut `fg` to `mask`, stretched up to the frame, over `bgLayer`. */
    function compose(mask, w, h) {
      if (cut.width !== w || cut.height !== h) { cut.width = w; cut.height = h; }
      cutCtx.clearRect(0, 0, w, h);
      cutCtx.drawImage(fg, 0, 0);
      cutCtx.globalCompositeOperation = "destination-in";
      cutCtx.drawImage(mask, 0, 0, w, h);   // bilinear on the way up
      cutCtx.globalCompositeOperation = "source-over";
      ctx.drawImage(bgLayer, 0, 0);
      ctx.drawImage(cut, 0, 0);
    }

    /* ---------------------------- Overlays ----------------------------
     * These are drawn into the outgoing video, so they are the only part of
     * Cam360 the other people on the call ever see. One plate style, the
     * brand blue as the single accent, and each one sits in whichever corner
     * the user picked rather than in a fixed one.
     */
    const OV_MARGIN = 0.03;                        /* of the short side */
    const OV_PLATE = "rgba(12, 15, 20, 0.74)";
    const OV_ACCENT = "#2383e2";
    const OV_FONT = "system-ui,Segoe UI,Roboto,sans-serif";

    /* Top left, top right, bottom left, bottom right. */
    function ovPlace(pos, w, h, bw, bh) {
      const m = Math.round(Math.min(w, h) * OV_MARGIN);
      return {
        x: (pos === "tr" || pos === "br") ? w - bw - m : m,
        y: (pos === "bl" || pos === "br") ? h - bh - m : m
      };
    }

    function ovPath(g, x, y, w, h, r) {
      g.beginPath();
      if (typeof g.roundRect === "function") g.roundRect(x, y, w, h, r);
      else g.rect(x, y, w, h);
    }

    function drawOverlays(s, w, h) {
      ctx.save();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      /* Logo first, so a tag sharing its corner reads on top of it. */
      if (s.showLogo && s.logoImage) {
        const logo = getImage(s.logoImage);
        if (logo && logo.width) {
          const lw = Math.min(w * 0.16, 132), lh = lw * (logo.height / logo.width);
          const { x, y } = ovPlace(s.logoPos, w, h, lw, lh);
          ctx.globalAlpha = 0.94;
          ctx.drawImage(logo, x, y, lw, lh);
          ctx.globalAlpha = 1;
        }
      }

      if (s.showName && s.nameText) {
        const fsz = Math.max(14, Math.round(h * 0.042));
        ctx.font = `600 ${fsz}px ${OV_FONT}`;
        const tw = ctx.measureText(s.nameText).width;
        const bar = Math.max(3, Math.round(fsz * 0.17));
        const padX = Math.round(fsz * 0.62);
        const bw = Math.round(tw + bar + padX * 2), bh = Math.round(fsz * 1.85);
        const { x, y } = ovPlace(s.namePos, w, h, bw, bh);
        const r = Math.round(bh * 0.3);
        ovPath(ctx, x, y, bw, bh, r);
        ctx.fillStyle = OV_PLATE; ctx.fill();
        /* The accent runs down the leading edge, clipped so it keeps the
           plate's rounded corners instead of squaring them off. */
        ctx.save(); ctx.clip();
        ctx.fillStyle = OV_ACCENT; ctx.fillRect(x, y, bar, bh);
        ctx.restore();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(s.nameText, x + bar + padX, y + bh / 2 + 1);
      }

      if (s.showClock) {
        const txt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const fsz = Math.max(13, Math.round(h * 0.036));
        ctx.font = `600 ${fsz}px ${OV_FONT}`;
        const tw = ctx.measureText(txt).width;
        const dot = Math.round(fsz * 0.32), gap = Math.round(fsz * 0.44);
        const padX = Math.round(fsz * 0.7);
        const bw = Math.round(tw + dot + gap + padX * 2), bh = Math.round(fsz * 1.8);
        const { x, y } = ovPlace(s.clockPos, w, h, bw, bh);
        ovPath(ctx, x, y, bw, bh, bh / 2);     /* a pill, not a card */
        ctx.fillStyle = OV_PLATE; ctx.fill();
        ctx.beginPath();
        ctx.arc(x + padX + dot / 2, y + bh / 2, dot / 2, 0, Math.PI * 2);
        ctx.fillStyle = OV_ACCENT; ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(txt, x + padX + dot + gap, y + bh / 2 + 1);
      }

      ctx.restore();
    }

    function drawBrb(s, w, h) {
      if (s.brbImage) {
        const img = getImage(s.brbImage);
        if (img) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); coverDraw(ctx, img, img.width, img.height, w, h); return; }
      }
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#2b90ef"); grad.addColorStop(1, "#1560ad");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      ctx.save();
      /* A soft vignette, so the card has a centre rather than being a slab. */
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.7);
      vig.addColorStop(0, "rgba(255,255,255,0.10)");
      vig.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.round(h * 0.085)}px ${OV_FONT}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(s.brbText || "Be right back", w / 2, h / 2);
      ctx.restore();
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
        /* chromaSmooth already widens the key's own soft band, so the extra
           feather here only has to hide the step from the upscale. */
        compose(softenMask(chromaMask(outW, outH, s), outW, 3), outW, outH);
        composited = true;
      } else if (wantBg && s.keyer === "ai" && segmenter) {
        runSegmentation(outW, outH);
        if (maskCanvas.width > 0) {
          if (bgLayer.width !== outW || bgLayer.height !== outH) { bgLayer.width = outW; bgLayer.height = outH; }
          bgCtx.clearRect(0, 0, outW, outH);
          drawBackgroundContent(bgCtx, s, outW, outH, fg);
          compose(softenMask(maskCanvas, outW, s.feather), outW, outH);
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

  window.Cam360Engine = {
    normalize, createRenderer, initSegmenter, setDefaults, ready,
    get DEFAULTS() { return DEFAULTS; }
  };
})();
