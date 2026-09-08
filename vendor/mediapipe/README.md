# Bundled MediaPipe files

These are Google's MediaPipe Tasks Vision runtime and the selfie segmentation
model, vendored here unchanged.

```
vision_bundle.mjs          MediaPipe Tasks Vision JavaScript bundle
selfie_segmenter.tflite    the segmentation model
wasm/                      the WebAssembly runtime, SIMD and non SIMD builds
```

They are bundled rather than fetched from a CDN at runtime for two reasons.
Cam360 makes no network requests at all, which is the privacy claim the product
is built on, and a Manifest V3 extension cannot load remote code in any case.

Licensed under the Apache License 2.0. The full text is in `LICENSE` beside this
file, retained because the Apache License requires a copy to travel with any
redistribution, and these files ship inside the packaged extension.

Upstream: https://github.com/google-ai-edge/mediapipe
