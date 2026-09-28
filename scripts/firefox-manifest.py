"""Print the Firefox version of manifest.json.

Firefox runs the same code as Chrome. Only the manifest differs:

- background: Firefox runs a Manifest V3 background as an event page listed
  under `scripts`, not as a service worker. background.js only relays a
  keyboard shortcut, so it works unchanged either way.
- browser_specific_settings.gecko: the add-on ID that addons.mozilla.org
  signs, the lowest Firefox it runs on, and the data collection declaration
  AMO asks of every new add-on: Cam360 collects nothing.

  The floor is 140, the current extended support release. Firefox could run
  the core from 128, the first that runs content scripts in the page's MAIN
  world (which is how Cam360 reaches getUserMedia), but the data collection
  declaration needs 140 and opening the shortcuts page needs 137.

Usage: python3 scripts/firefox-manifest.py manifest.json > out/manifest.json
"""
import json
import sys

manifest = json.load(open(sys.argv[1], encoding="utf-8"))
manifest["background"] = {"scripts": [manifest["background"]["service_worker"]]}
manifest["browser_specific_settings"] = {
    "gecko": {
        "id": "cam360@realanshuman.com",
        "strict_min_version": "140.0",
        "data_collection_permissions": {"required": ["none"]},
    }
}
print(json.dumps(manifest, indent=2, ensure_ascii=False))
