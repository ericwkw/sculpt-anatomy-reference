# Sculpt Anatomy Reference

A phone-friendly anatomy viewer for clay sculpting reference. Orbit a 3D model under a
raking studio light, switch between layers (skin, muscle, bone, where a model has them),
cycle Skin / Clay / Planes render modes, and snapshot angles you want to keep beside you
while you work. The registry covers skulls, écorché heads, a photogrammetry head scan,
and female figure casts.

Installs to the iPhone Home Screen as a PWA. Saved snapshots stay on the device.

The app ships with no 3D assets, so a fresh clone shows every layer as "not downloaded"
until you add models (see [Adding models](#adding-models)). A public shell-only demo is
deployed to GitHub Pages at <https://ericwkw.github.io/sculpt-anatomy-reference/> by
`.github/workflows/deploy-pages.yml` on every push to `master`. It contains no models.

## Running it

```bash
npm install
npm run dev -- --host
```

Open the printed Network URL on your iPhone (same WiFi). In Safari, tap Share →
Add to Home Screen to install it.

### Always-on studio server

A launchd agent serves the built site on port 4173 so the viewer is reachable from the
phone without a terminal open. It starts at login and restarts if it dies.

Reach it from the phone at **http://ew-macbookpro-m2.local:4173/** — the Bonjour name
follows the machine, so the URL keeps working on any network. An IP address does not,
which matters if you save it to the Home Screen. Vite rejects hostnames it was not told
about, so `vite.config.js` allows `.local`.

```sh
npm run build                                   # publish changes to the served copy
tail -f ~/Library/Logs/sculpt-ref.log           # what the server is doing
launchctl unload ~/Library/LaunchAgents/com.sculptref.studio.plist   # stop for good
```

It serves `dist/`, so **edits are not live** — run `npm run build` to publish them. Use
`npm run dev` on port 5173 while actually working.

It binds to every interface, so anyone on the same network can reach it. That is the
point at home; on a shared or public network, unload it.

The agent hardcodes absolute paths — the current Node binary (`~/.nvm/.../v23.9.0/bin/node`)
and this project directory. Upgrading Node or moving or renaming the project breaks it
until the plist is updated.

### When the phone can't reach the Mac (Tailscale)

Office and guest Wi-Fi often isolate clients, so the phone and Mac get addresses on the
same subnet but cannot talk to each other. Symptom: the Mac's ARP entry for the phone
stays `(incomplete)`, and both the `.local` name and the LAN IP time out on the phone
while the server answers fine from the Mac itself. A Personal Hotspot avoids it, but
Tailscale works on any network.

1. Install Tailscale on the Mac and the iPhone and sign in to the **same** account on
   both. iOS runs one VPN at a time, so switch off any other VPN profile first.
2. On the phone, open **`http://<tailscale-ip>:4173/`** in Safari. The address is the
   `100.x.y.z` shown for the Mac in the Tailscale app. It is stable per device, so it is
   safe to install to the Home Screen from.
3. The `<mac-name>.<tailnet>.ts.net` name only resolves with MagicDNS enabled in the
   Tailscale admin console (DNS page) and "Use Tailscale DNS settings" on in the iOS
   app. Use the exact name from the app, which may carry a `-1` suffix. If the name
   fails, use the IP.

`vite.config.js` already allows `.ts.net` hostnames. Tailscale addresses reach the
server by IP, which Vite always accepts. A work VPN active on the Mac can compete with
Tailscale for the default route; disconnect it if the phone still cannot connect.

## Adding models

The app ships with no 3D assets — model files are large and licensed separately.

1. Open `ATTRIBUTION.md` and download the models listed there from Sketchfab
   (free account required).
2. Save each as `.glb` in **`models-raw/`**, using the filename from the
   "Save as" column.
3. Run `npm run optimize`.
4. Add an entry in `src/models.js` with a `credit` block.
5. Run `npm run build` to publish it to the studio server.

Step 4 is what puts a model in a named slot with its attribution. Skipping it is
fine for a quick look — anything in `public/models/` that no registry entry claims
shows up under **Unsorted**, labelled from its filename. Unsorted models are left out
of the credits screen, so move anything you intend to keep into the registry.

A scan that arrives as several meshes — head, eyeballs, teeth, brows — is combined first
with `scripts/merge-parts.mjs`, which reads both OBJ and FBX, since otherwise each part
would appear as its own model. Keep the parts in a subfolder of `models-raw/`; the
optimizer only reads the top level.

The merge names every part’s material after its source file, and the viewer turns those
names into per-part visibility switches. An optional `parts.json` beside the parts
supplies material data for sources that carry none.

Both `.glb` and `.obj` are accepted. An OBJ is converted on the way through, picking up
its `.mtl` and texture files from the same folder — which covers scan-vendor downloads
and Apple Object Capture output without a Blender round trip.

Sketchfab offers a glTF download option for most models, which unzips to `.gltf` +
textures. That form is not read directly; import it into Blender and export as glTF
Binary, or take the OBJ if one is offered.

### Keeping models fast on phone

Anything much over 600k triangles risks stuttering on an iPhone. `npm run optimize`
handles this — it reads everything in `models-raw/`, decimates each model down
to the triangle budget, and writes the result to `public/models/`. Originals are never
touched, so you can re-run with a different budget any time.

```sh
npm run optimize                     # 600k triangles, 2K textures
npm run optimize -- --budget 150000
npm run optimize -- --max-texture 4096
npm run optimize -- --no-quantize    # if a model looks wrong after optimizing
```

Textures are capped at 2048px and re-encoded as JPEG. Scan vendors ship 8K maps, which
is more than a phone resolves and would make one model heavier than all the others put
together. A texture that is a single flat colour gets collapsed into a material factor
and disappears from the file, which is intended.

It prints a before/after table of triangle counts and file sizes. Models already under
budget are passed through and marked as such.

Geometric error is capped at 0.2% of each model's radius, so anatomical landmarks stay
where they belong. Quantization packs positions and normals into integers for a further
size cut; it needs `KHR_mesh_quantization`, which `model-viewer` supports.

## Lighting

`public/studio.hdr` is generated, not downloaded — `node scripts/make-studio-hdr.mjs`
rewrites it. It is a small equirectangular HDR holding one dominant raking key with
weak fill, because model-viewer's built-in environment lights evenly from every
direction and flattens muscle masses into a featureless blob. Edit the `LIGHTS` array
in that script to change the setup.

Most models render as matte clay: several arrive glossy or colour-coded and read as wet
plastic under a directional key, and clay matches the medium being sculpted. A
photogrammetry scan carries real skin though, so the topbar mode button switches between
Skin and Clay. It defaults to Skin for any model with a base colour texture and Clay for
everything else. The third mode, Planes, is covered under
[Planar clay studies](#planar-clay-studies).

Clay mode detaches the base colour texture rather than just tinting it — `baseColorFactor`
multiplies a texture instead of replacing it, so a textured model stays textured until
the texture itself is removed.

## Planar clay studies

```sh
npm run planar                    # 500-triangle budget for every model in public/models/
npm run planar -- --budget 800    # more planes, closer to the source shape
```

Writes a heavily-simplified, flat-shaded companion for every optimized model into
`public/models/planar/` — the way a sculptor blocks in a head with a few large cut
planes before any surface detail exists. Cycle the topbar mode button (Skin → Clay →
Planes) to switch a layer to its companion, when one has been generated; the button
skips Planes entirely for a layer that has none.

Two things make a mesh read as cut planes rather than a shrunk version of the original:
an aggressive triangle target, and flat (per-face) normals instead of smooth ones —
smooth normals are what make a decimated mesh still look "round". Reduction itself uses
meshoptimizer's `simplifySloppy`, a voxel-style reducer built for "hit this triangle
count, fidelity is not the point" — ordinary edge-collapse simplification (the right
tool in `npm run optimize`, which wants to stay faithful to a budget) applies its target
per PRIMITIVE independently, and stalled at 35,714 triangles against a budget of 500 on
a 26-part scan no matter how loose its error tolerance went.

Getting a merged multi-part scan through this pipeline surfaced the most serious bug in
the project: every part lives in its own Node, and a Node's transform is what places
that part correctly in the scene — reading a mesh's POSITION data directly, as the
reduction has to, is that part's own LOCAL space, unrelated to any other part's. Every
node's world matrix is baked into its mesh before parts are combined; skipping that step
dumps every part on top of the scene origin instead of assembling them into one figure.
`node transforms are baked in before parts are combined` in the unit tests exists to
catch a regression back to that.

The transform also has to run after dequantizing: `npm run optimize`'s output is
quantized to 16-bit integers, and each part typically carries its own independent
quantization range, so concatenating raw quantized integers across parts is invalid in
the same way skipping the node-transform bake is — both silently discard the one thing
that keeps separately-authored parts aligned into a single coherent object.

```sh
npm run test:unit    # unit tests for the reduction math itself
```

These run against in-memory fixtures with Node's built-in test runner rather than
Playwright, since the thing being checked — triangle counts, face-normal correctness,
node-transform baking — is geometry math, not anything that needs a real browser.

## Tests

```sh
npm test           # Playwright, headless
npm run test:ui    # Playwright's interactive runner
npm run test:unit  # Node's built-in runner, geometry math only
```

Playwright drives the real browser: actual mouse drags, actual touch events via CDP,
and hit-testing at real screen coordinates. That matters here — a synthetic
`element.click()` dispatches straight to the target and skips hit-testing, so it will
happily "pass" while an invisible overlay covers the whole viewer and blocks every
gesture. That bug shipped once; `nothing covers the viewer once a model has loaded`
exists to stop it coming back.

The suite serves a generated stand-in `.glb` for every model request, so it runs on a
fresh clone with an empty `public/models/`. Unavailable-layer behaviour is tested by
returning 404 for specific filenames.

Covered: pointer reaches the viewer, horizontal and vertical drag orbit, vertical drag
does not scroll the page, touch drag, pinch zoom, layer switching, snapshot round trip,
disabled layers for missing files, every model carrying a visible credit, cycling
Skin/Clay/Planes and the part-visibility bar staying correct across that cycle, and the
topbar and layer bar staying on screen and tappable at phone size.

Not covered: real iOS Safari. Chromium's touch emulation is close but not identical —
check gestures on the actual phone before trusting them.

## Layout

| Path | What it does |
|---|---|
| `src/models.js` | Model and layer registry — edit to add or rename models |
| `src/main.js` | Viewer wiring, layer switching, snapshot capture |
| `src/gallery-store.js` | IndexedDB storage for saved snapshots |
| `scripts/optimize-models.mjs` | Decimates raw downloads to a phone-friendly budget |
| `scripts/make-studio-hdr.mjs` | Generates the studio lighting environment |
| `scripts/merge-parts.mjs` | Combines multi-part OBJ/FBX scans into one `.glb` |
| `scripts/make-planar.mjs` | Generates the planar clay study companions |
| `.github/workflows/deploy-pages.yml` | Builds and publishes the shell-only demo to GitHub Pages |
| `tests/interaction.spec.mjs` | Playwright interaction and regression tests |
| `tests/make-planar.test.mjs` | Unit tests for the planar reduction math |
| `tests/helpers.mjs` | Model stubbing, real touch and pinch input via CDP |
| `models-raw/` | Your untouched downloads (gitignored) |
| `public/models/` | Optimized `.glb` files the app loads (gitignored) |
| `public/models/planar/` | Generated planar clay study companions (gitignored) |
| `ATTRIBUTION.md` | Model sources and licence credits — keep in sync |

## Licences

Models are CC-licensed. CC-BY requires the credit to stay visible wherever the work is
shown, so the app has a credits screen behind the ⓘ button, rendered straight from the
`credit` field on each layer in `src/models.js`. Adding a layer without one fails the
test suite.

`ATTRIBUTION.md` mirrors the same list for anyone reading the repo. Keep both with the
project if you share it.
