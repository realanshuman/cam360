/*
 * Cam360 — grant.js
 * Runs in a normal extension tab, where Chrome CAN show the camera permission
 * prompt (it cannot inside the toolbar popup). On success the camera is
 * released immediately; the permission then sticks for the whole extension,
 * so the popup preview works from now on.
 */
(() => {
  "use strict";
  const state = document.getElementById("state");
  const hint = document.getElementById("hint");
  const retry = document.getElementById("retry");

  async function request() {
    state.className = "state";
    state.textContent = "Requesting your camera…";
    hint.hidden = true;
    retry.hidden = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
      state.className = "state ok";
      state.textContent = "Camera access granted. You can close this tab and open the Cam360 popup again.";
      try { chrome.storage.local.set({ cam360_preview: true }); } catch (_) {}
      // Give the message a moment to be read, then close the tab if allowed.
      setTimeout(() => { try { window.close(); } catch (_) {} }, 2500);
    } catch (err) {
      state.className = "state err";
      if (err && err.name === "NotAllowedError") {
        state.textContent = "Camera access was declined or is blocked.";
        hint.innerHTML = "If no prompt appeared, the camera may already be blocked for this extension. " +
          "Click the camera icon at the right end of the address bar, or open " +
          "<code>chrome://settings/content/camera</code> and remove Cam360 from the blocked list, then try again.";
        hint.hidden = false;
      } else if (err && (err.name === "NotFoundError" || err.name === "NotReadableError")) {
        state.textContent = "No usable camera was found, or it is in use by another app.";
        hint.textContent = "Close other apps that might be holding the camera, then try again.";
        hint.hidden = false;
      } else {
        state.textContent = "Could not start the camera: " + (err && err.message ? err.message : err);
      }
      retry.hidden = false;
    }
  }

  retry.addEventListener("click", request);
  request();
})();
