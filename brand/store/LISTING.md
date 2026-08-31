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
- It is instant. Change anything mid call from a small panel (press Alt Shift C) and everyone sees it live.
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

- Privacy policy URL: https://cam360.vercel.app/privacy

## Additional fields

- Homepage URL: https://cam360.vercel.app
- Support URL: https://github.com/realanshuman/cam360/issues
- Mature content: No
- Ads: No
