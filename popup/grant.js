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
  const t = (key, subs, fallback) => Cam360I18n.t(key, subs, fallback);
  const IS_FIREFOX = chrome.runtime.getURL("").indexOf("moz-extension:") === 0;

  /* A hint that names a settings page. The page name is a literal, shown as
     code, so it is set as text around a <code> rather than as markup. */
  function hintWithPage(key, fallback, page) {
    const marker = "\uE000";   // a private use character, never in a real message
    const [before, after] = t(key, [marker], fallback.replace("$1", marker)).split(marker);
    const code = document.createElement("code");
    code.textContent = page;
    hint.textContent = "";
    hint.append(before || "", code, after || "");
  }

  async function request() {
    state.className = "state";
    state.textContent = t("grantRequesting", null, "Requesting your camera…");
    hint.hidden = true;
    retry.hidden = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
      state.className = "state ok";
      state.textContent = t("grantOk", null, "Camera access granted. You can close this tab and open Cam360 again.");
      try { chrome.storage.local.set({ cam360_preview: true }); } catch (_) {}
      // Give the message a moment to be read, then close the tab if allowed.
      setTimeout(() => { try { window.close(); } catch (_) {} }, 2500);
    } catch (err) {
      state.className = "state err";
      if (err && err.name === "NotAllowedError") {
        state.textContent = t("grantDeclined", null, "Camera access was declined or is blocked.");
        if (IS_FIREFOX) {
          hintWithPage("grantBlockedFirefox", "If no prompt appeared, the camera may already be blocked for this extension. " +
            "Open $1, find Camera under Permissions, and remove the block on Cam360. Then try again.", "about:preferences#privacy");
        } else {
          hintWithPage("grantBlockedChrome", "If no prompt appeared, the camera may already be blocked for this extension. " +
            "Click the camera icon at the right end of the address bar, or open $1 and remove Cam360 from the blocked list. Then try again.",
            "chrome://settings/content/camera");
        }
        hint.hidden = false;
      } else if (err && (err.name === "NotFoundError" || err.name === "NotReadableError")) {
        state.textContent = t("grantNoCamera", null, "No usable camera was found, or another app is using it.");
        hint.textContent = t("grantNoCameraHint", null, "Close other apps that might be holding the camera, then try again.");
        hint.hidden = false;
      } else {
        const why = String(err && err.message ? err.message : err);
        state.textContent = t("grantFailed", [why], "Could not start the camera: " + why);
      }
      retry.hidden = false;
    }
  }

  /* Firefox's prompt forgets the answer unless its box is ticked, and then
     the popup would send the user back here on every preview. Say so. */
  if (IS_FIREFOX) {
    const how = document.querySelector('[data-i18n="grantBody2"]');
    if (how) how.textContent = t("grantBody2Firefox", null, how.textContent);
  }

  retry.addEventListener("click", request);
  request();
})();
