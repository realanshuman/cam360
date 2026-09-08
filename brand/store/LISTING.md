# Chrome Web Store listing for Cam360

Live listing: https://chromewebstore.google.com/detail/cam360/ddnijfcmkiogmndecegggdieokbhlhpe

Copy and paste from here into the developer dashboard. Every field is below.

## Item title

```
Cam360
```

## Summary (132 char limit, prefilled from the manifest)

```
Look better on every video call. Blur or swap your background, fix lighting, mirror and zoom. Works on Meet, Discord, Zoom & more.
```

## Detailed description

```
Look better on every video call, without buying a new camera.

Cam360 sits between your webcam and the website you are calling from. Open the popup, move a slider, and the change appears in your video instantly. No account, no sign up, and nothing to configure.

WHAT YOU CAN DO

- Blur your background, or replace it with a colour, a scene, or your own photo
- Fix bad lighting with brightness, contrast and a one click low light boost
- Mirror, flip, rotate and zoom your camera until the framing is right
- Smooth skin with a subtle beautify slider
- Freeze your frame or show a "be right back" card when you step away
- Add your name, a logo, or a live clock to your video
- Save a snapshot of exactly what others see

WHY PEOPLE INSTALL IT

- It works everywhere. Google Meet, Discord, Zoom in the browser, Whereby, Jitsi, and any other site that asks for your camera. One setup covers all of them.
- It is private. Your video is processed on your own computer and handed straight to the site. Cam360 makes no network requests, has no analytics, and never records or uploads anything. Even the AI background model is bundled inside the extension.
- It is instant. Change anything mid call from a small panel (press Alt C) and everyone sees it live.
- It is free and open source. You can read every line of code on GitHub.

HOW IT WORKS

When a site asks for your camera, Cam360 answers first, applies your settings to every frame on your device, and passes the finished video to the site. The site treats it like an ordinary camera, so nothing needs to support Cam360 for it to work.

Note: this extension works on websites in your browser. Desktop apps such as the Discord or Zoom desktop clients are outside what any browser extension can reach; use the web version of those apps.
```

## Category

Social & Communication (it improves video calls; this is where users look for call tools)

## Language

English

## Graphic assets (all in this folder)

| Asset | File | Size |
| --- | --- | --- |
| Store icon | store-icon-128.png | 128x128, mark at 96px inside transparent padding |
| Screenshot 1, the promise | screenshot-1.png | 1280x800 |
| Screenshot 2, backgrounds | screenshot-2.png | 1280x800 |
| Screenshot 3, live mid call | screenshot-3.png | 1280x800 |
| Screenshot 4, privacy | screenshot-4.png | 1280x800 |
| Small promo tile | promo-tile-440x280.png | 440x280 |
| Marquee promo tile | promo-marquee-1400x560.png | 1400x560 |

Upload the screenshots in that order; the first one is what most people see.

## Privacy practices tab, field by field

These are the fields behind the "Unable to publish" checklist. All of them live
on the item's Privacy practices tab except the last one.

1. Single purpose description:
   "Enhances the user's webcam video (background, lighting, framing) on websites that use the camera."

2. Host permission justification:
   "The extension enhances the camera on whichever website the user makes a call from (Google Meet, Discord, Zoom in the browser, and others), which cannot be known in advance. Its content script only activates when a site requests the camera, and it makes no network requests."

3. Remote code use: select "No, I am not using remote code". Everything,
   including the WebAssembly module and the AI model, ships inside the package.
   If a justification is still required:
   "No remote code. All scripts, the WebAssembly module, and the AI model are bundled inside the extension package. The extension makes no network requests."

4. storage justification:
   "Stores the user's settings (slider values, chosen background, overlay text) locally on their device."

5. unlimitedStorage justification:
   "Users can set their own image or video as a virtual background. These files are stored locally on the user's device and can exceed the default storage quota."

6. Data usage: answer No to all collection questions, then tick the
   certification checkbox at the bottom of the tab.

7. Contact email: Settings, then Account. Add an email, send the verification,
   click the link in the email, come back and Save draft.

- Privacy policy URL: https://fuckwebcam.xyz/privacy

## Additional fields

- Homepage URL: https://fuckwebcam.xyz
- Support URL: https://github.com/realanshuman/cam360/issues
- Mature content: No
- Ads: No

---

# Proposed revision (September 2026, from the SEO work)

Not yet applied to the live listing. Rationale and evidence are in
[`docs/seo-plan.md`](../../docs/seo-plan.md), section 5. Apply these by editing
the item in the developer dashboard.

Google's documented ranking sentence puts **item name** first: "Search ranking
and recommendations are ordered based on the item name, description relevancy,
popularity, and user experience." There is no keywords field, and at the
current install count every popularity signal is near zero, so the text fields
are the only lever. The title is also the `<title>` of the Google indexed store
page, so one edit improves store rank and Google rank together.

## Item title (75 char limit, but search cards truncate near 45)

```
Cam360: Virtual Background & Webcam Effects
```

43 characters. The current title is `Cam360` alone: six characters carrying no
searchable term in the highest weighted field, and "360" misdirects toward
panoramic cameras. "Virtual background" is the phrase Zoom and Meet teach
users in their own interfaces.

## Summary (132 char limit)

```
Virtual background, background blur and webcam effects for any video call. Runs fully on your device. Free and open source.
```

123 characters. Dropping the third party brand names removes the entire
trademark risk surface described below and reclaims 35 characters for category
terms.

## Description additions

Add a compatibility line in the form the Branding Guidelines prescribe:

```
Works with browser based video calls, including Google Meet(TM), Discord, Zoom and Whereby.
```

Add an accuracy disclosure, which is both a policy safeguard and good answer
engine content:

```
On Google Meet, the AI background is blocked by Meet's own security policy, so Cam360 falls back to green screen keying there. Every other effect works normally.
```

Keep the existing non affiliation sentence at the bottom.

## Trademark compliance notes

The governing document is the Chrome Web Store Branding Guidelines
(`developer.chrome.com/docs/webstore/branding`). It requires compatibility
claims to use "for", "for use with", or "compatible with", to carry the
trademark symbol, and to give attribution.

The current summary's "Works on Meet, Discord, Zoom" matches none of the three
prescribed phrasings, omits the symbol, gives no attribution, and bare "Meet"
is worse than "Google Meet" because it drops the disambiguator. This is not a
takedown risk. The concern is that the Impersonation policy's stated remedy is
that Google "reserves the right to reduce visibility" of items that potentially
violate IP protections, which is a silent ranking penalty rather than a notice.

Two hard limits: do not list more than five supported brands in the
description, and do not repeat any keyword more than five times. Keyword
stuffing has its own rejection code.

## Also worth doing

The Promotional Video field is empty. That asset gets reused across every other
channel, so it is the highest leverage missing item after the title.
