import { MODELS, listCredits } from "./models.js";
import { saveSnapshot, getAllSnapshots, deleteSnapshot } from "./gallery-store.js";

// Every path in the model registry, and everywhere in this file, is written
// root-relative ("/models/x.glb") because that is what the studio server and
// local dev both serve from — the site root. A GitHub Pages deploy is a
// project site served from a subpath (/<repo-name>/), which Vite's own asset
// pipeline handles for anything it recognises as a reference (index.html's
// script/link tags, bundled imports) but cannot for a runtime string built at
// fetch- or assignment-time. import.meta.env.BASE_URL is '/' locally and
// '/<repo-name>/' on Pages (set via `vite build --base`), so every actual
// network request or viewer.src assignment resolves through this first.
// Registry values and application state stay canonical/unprefixed throughout
// — only the point of use resolves them — so a comparison like
// `viewer.src !== targetSrc` stays correct as long as both sides go through it.
const resolve = (path) => import.meta.env.BASE_URL + path.replace(/^\//, "");

const viewer = document.getElementById("viewer");
// Set here rather than as a static index.html attribute, for the same reason
// every path above goes through resolve(): a hardcoded "/studio.hdr" would
// resolve against the domain root on a Pages subpath deploy, not the site.
viewer.setAttribute("environment-image", resolve("/studio.hdr"));
const noModel = document.getElementById("no-model");
const modelSelect = document.getElementById("model-select");
const layerBar = document.getElementById("layer-bar");
const partBar = document.getElementById("part-bar");
const snapBtn = document.getElementById("snap-btn");
const galleryBtn = document.getElementById("gallery-btn");
const galleryDialog = document.getElementById("gallery-dialog");
const galleryClose = document.getElementById("gallery-close");
const galleryGrid = document.getElementById("gallery-grid");
const renderModeBtn = document.getElementById("render-mode-btn");
const creditsBtn = document.getElementById("credits-btn");
const creditsDialog = document.getElementById("credits-dialog");
const creditsClose = document.getElementById("credits-close");
const creditsBody = document.getElementById("credits-body");

// The curated registry, plus anything found in public/models/ that is not in it.
const models = [...MODELS];

let currentModel = models[0];
let currentLayer = currentModel?.layers[0];

/**
 * Surface .glb files sitting in public/models/ that no registry entry claims, so
 * a file can be dropped in and looked at without editing code first. They are
 * deliberately kept out of MODELS and so out of the credits screen — anything
 * worth keeping gets a registry entry with its attribution.
 */
async function discoverUnsorted() {
  const files = await fetch(resolve("/models/manifest.json"))
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);

  const claimed = new Set(MODELS.flatMap((m) => m.layers.map((l) => l.src.split("/").pop())));
  const extra = files.filter((f) => !claimed.has(f));
  if (!extra.length) return;

  models.push({
    id: "unsorted",
    label: "Unsorted — dropped in",
    layers: extra.map((file) => ({
      key: file,
      label: file
        .replace(/\.glb$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/^./, (c) => c.toUpperCase()),
      src: `/models/${file}`,
      credit: null,
    })),
  });
}

// Vite's dev server answers unknown paths with the index page rather than a
// 404, so a 200 alone does not mean the file is there — shared by the
// missing-layer check below and the planar-companion check further down.
async function fileExists(url) {
  return fetch(url, { method: "HEAD" })
    .then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"))
    .catch(() => false);
}

// Layers whose .glb has not been downloaded yet are shown disabled rather than
// silently failing to load. See ATTRIBUTION.md for what each file should be.
const available = new Map();

async function checkAvailability(model) {
  await Promise.all(
    model.layers
      .filter((l) => !available.has(l.src))
      .map(async (l) => {
        available.set(l.src, await fileExists(resolve(l.src)));
      })
  );
}

function renderModelSelect() {
  modelSelect.innerHTML = models.map(
    (m) => `<option value="${m.id}">${m.label}</option>`
  ).join("");
  modelSelect.value = currentModel.id;
}

function renderLayerBar() {
  layerBar.innerHTML = currentModel.layers
    .map((l) => {
      const missing = available.get(l.src) === false;
      const classes = [l.key === currentLayer.key ? "active" : "", missing ? "missing" : ""]
        .filter(Boolean)
        .join(" ");
      const title = missing ? ` title="Not downloaded yet — see ATTRIBUTION.md"` : "";
      return `<button data-key="${l.key}" class="${classes}"${missing ? " disabled" : ""}${title}>${l.label}</button>`;
    })
    .join("");
}

function showMissing(layer) {
  const file = layer.src.split("/").pop();
  noModel.innerHTML = `<div><strong>${layer.label}</strong> is not downloaded yet.<br />Save it as <code>${file}</code> in <code>models-raw/</code>, then run <code>npm run optimize</code>.<br />See ATTRIBUTION.md for the download link.</div>`;
  noModel.hidden = false;
}

// Where the planar companion for a layer would live, if make-planar.mjs has
// been run for it. A subfolder rather than a filename suffix, matching how
// models-raw/head-scan/ stays invisible to the optimizer's own directory scan.
const planarPathFor = (src) => src.replace("/models/", "/models/planar/");

// The planar companion for whichever layer is on screen right now, or null if
// none was generated yet, or the check has not resolved yet. The button just
// stays disabled until it has — see the note in the 'load' handler below on
// why this check happens after the model itself finishes loading rather than
// alongside it.
let planarSrcForCurrentLayer = null;

// True only while a mode-cycle click is swapping the viewer's src to or from
// the planar companion. The 'load' event fires for that swap exactly as it
// does for a genuine layer change, and the two need different handling: a
// fresh layer resets to its own default look, but a mode swap must preserve
// the mode the user just chose rather than stomping it back to that default.
let modeSwitchInProgress = false;

function setLayer(layer) {
  currentLayer = layer;
  planarSrcForCurrentLayer = null;
  if (available.get(layer.src) === false) {
    viewer.removeAttribute("src");
    showMissing(layer);
    renderLayerBar();
    return;
  }
  noModel.hidden = true;
  viewer.src = resolve(layer.src);
  renderLayerBar();
}

async function setModel(id) {
  currentModel = models.find((m) => m.id === id) ?? models[0];
  await checkAvailability(currentModel);
  const firstAvailable =
    currentModel.layers.find((l) => available.get(l.src) !== false) ?? currentModel.layers[0];
  setLayer(firstAvailable);
}

// Clay matches the medium being sculpted and keeps attention on form, which is
// what most of these models are for — several arrive glossy or colour-coded and
// read as wet plastic under a directional key. But a photogrammetry scan carries
// real skin, and that is worth seeing, so the render mode is switchable.
const CLAY = [0.66, 0.62, 0.58, 1];

// 'material' (the model's own texture), 'clay', or 'planar' (a swap to the
// make-planar.mjs companion geometry, when one exists for this layer).
let renderMode = "clay";
let authored = [];

function captureAuthored() {
  authored = (viewer.model?.materials ?? []).map((material) => {
    const pbr = material.pbrMetallicRoughness;
    return {
      baseColorFactor: [...pbr.baseColorFactor],
      metallicFactor: pbr.metallicFactor,
      roughnessFactor: pbr.roughnessFactor,
      baseColorTexture: pbr.baseColorTexture?.texture ?? null,
      alphaMode: material.alphaMode,
      name: material.name,
    };
  });
}

const hasTexture = () => authored.some((m) => m.baseColorTexture);

// Whether the LAYER — not whatever happens to be on screen right now — has a
// texture. Set only when a genuine layer load happens, below. availableModes()
// must not call hasTexture() directly for this: the planar companion is
// deliberately textureless, so while it is on screen hasTexture() reports
// false and would silently drop "Skin" from the cycle — the exact bug that
// made cycling past Planes land back on Clay instead of wrapping to Skin.
let currentLayerHasTexture = false;

/**
 * Per-part visibility, for merged scans.
 *
 * A scan arrives as separate meshes — head, eyeballs, teeth, brows — merged into
 * one file so the model picker stays sensible. model-viewer exposes materials
 * but not nodes, so a part is hidden by turning its material transparent; the
 * merge step names each part's material after its source file to make that
 * possible. A model whose materials are all unnamed simply gets no switches.
 */
const hidden = new Set();

// Eight separate switches overflow a phone's width, pushing the two worth using
// most — brows and lashes are 248k of the head scan's 302k triangles — off the
// right edge. The eye parts are never wanted individually, so they share one.
const PART_GROUPS = {
  "Realtime Eyeball Left": "Eyes",
  "Realtime Eyeball Right": "Eyes",
  "Eye Wet": "Eyes",
};

const groupOf = (name) => PART_GROUPS[name] ?? name;

const partGroups = () => [...new Set(authored.map((m) => m.name).filter(Boolean).map(groupOf))];

function applyPartVisibility() {
  (viewer.model?.materials ?? []).forEach((material, i) => {
    const name = authored[i]?.name;
    if (!name) return;
    const pbr = material.pbrMetallicRoughness;
    const colour = [...pbr.baseColorFactor];
    if (hidden.has(groupOf(name))) {
      material.setAlphaMode("BLEND");
      colour[3] = 0;
    } else {
      material.setAlphaMode(authored[i].alphaMode);
      colour[3] = authored[i].baseColorFactor[3];
    }
    pbr.setBaseColorFactor(colour);
  });
}

function renderPartBar() {
  const groups = partGroups();
  // One part is the whole model — nothing to switch.
  if (groups.length < 2) {
    partBar.innerHTML = "";
    partBar.hidden = true;
    return;
  }
  partBar.hidden = false;
  partBar.innerHTML = groups
    .map(
      (name) =>
        `<button data-part="${name}" class="${hidden.has(name) ? "" : "on"}">${name}</button>`
    )
    .join("");
}

partBar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-part]");
  if (!btn) return;
  const name = btn.dataset.part;
  if (hidden.has(name)) hidden.delete(name);
  else hidden.add(name);
  applyPartVisibility();
  renderPartBar();
});

// Applies clay/material colouring to whatever geometry is currently loaded.
// Meaningless for the planar companion — it has no texture and is already
// baked grey by make-planar.mjs — but harmless to run anyway, which keeps the
// caller from needing a special case for that mode.
function applyMaterialStyle() {
  const materials = viewer.model?.materials ?? [];
  materials.forEach((material, i) => {
    const pbr = material.pbrMetallicRoughness;
    const original = authored[i];
    if (renderMode === "material" && original?.baseColorTexture) {
      pbr.setBaseColorFactor(original.baseColorFactor);
      pbr.setMetallicFactor(original.metallicFactor);
      pbr.setRoughnessFactor(original.roughnessFactor);
      pbr.baseColorTexture.setTexture(original.baseColorTexture);
    } else {
      pbr.setBaseColorFactor(CLAY);
      pbr.setMetallicFactor(0);
      pbr.setRoughnessFactor(0.9);
      // baseColorFactor multiplies the texture rather than replacing it, so a
      // textured model stays textured until the texture itself is detached.
      if (original?.baseColorTexture) pbr.baseColorTexture.setTexture(null);
    }
  });
  // Both branches rewrite baseColorFactor, which carries the alpha that hides
  // a part, so visibility has to be reasserted afterwards.
  applyPartVisibility();
}

const MODE_LABELS = { material: "Skin", clay: "Clay", planar: "Planes" };

// Which of the three modes make sense for whatever is currently loaded: skin
// only if there is a texture to show, planes only if make-planar.mjs has been
// run for this layer. Clay is always available as the fallback.
function availableModes() {
  const modes = [];
  if (currentLayerHasTexture) modes.push("material");
  modes.push("clay");
  if (planarSrcForCurrentLayer) modes.push("planar");
  return modes;
}

function updateRenderModeButton() {
  renderModeBtn.textContent = MODE_LABELS[renderMode];
  renderModeBtn.disabled = availableModes().length < 2;
}

// Planar is a different geometry file, not a material tweak, so entering or
// leaving it means changing viewer.src — everything else is a same-geometry
// recolour handled by applyMaterialStyle().
function applyMode() {
  const targetSrc = resolve(renderMode === "planar" ? planarSrcForCurrentLayer : currentLayer.src);
  if (viewer.src !== targetSrc) {
    modeSwitchInProgress = true;
    viewer.src = targetSrc;
  } else {
    applyMaterialStyle();
  }
  updateRenderModeButton();
}

renderModeBtn.addEventListener("click", () => {
  const modes = availableModes();
  const next = modes[(modes.indexOf(renderMode) + 1) % modes.length];
  renderMode = next;
  applyMode();
});

viewer.addEventListener("load", () => {
  noModel.hidden = true;
  captureAuthored();
  if (modeSwitchInProgress) {
    // The user just chose this mode; a fresh default would undo that choice,
    // and their part-visibility choices should survive a mode switch too. The
    // button bar itself still needs rebuilding, though: switching into planar
    // mode merges everything into one blocked mass with no separately-hideable
    // parts at all, so which buttons even exist can change with the src even
    // though which of them are hidden does not.
    modeSwitchInProgress = false;
    applyMaterialStyle();
    renderPartBar();
  } else {
    // A genuine layer/model change. A scan's own skin is the reason to load
    // it; an untextured anatomy model has nothing to show but clay. Planes is
    // opt-in and never the default, the same way part visibility resets below
    // rather than carrying over from whatever was open before. hidden must be
    // cleared before rebuilding the bar, or its buttons render against the
    // previous layer's hidden state for one frame.
    currentLayerHasTexture = hasTexture();
    renderMode = currentLayerHasTexture ? "material" : "clay";
    applyMaterialStyle();
    hidden.clear();
    renderPartBar();

    // Checking for a planar companion here, once the model itself has
    // finished, rather than in setLayer before the model even starts: firing
    // it alongside the other per-layer availability HEAD requests measurably
    // slowed the actual model fetch down on Vite's dev server — a multi-MB
    // model that loads in ~5s in isolation took over a minute with four HEAD
    // requests racing it for the same origin's limited connections. The
    // planar button simply stays disabled for the moment this check takes.
    const layerAtLoadTime = currentLayer;
    fileExists(resolve(planarPathFor(layerAtLoadTime.src))).then((ok) => {
      if (currentLayer !== layerAtLoadTime) return; // layer changed meanwhile
      planarSrcForCurrentLayer = ok ? planarPathFor(layerAtLoadTime.src) : null;
      updateRenderModeButton();
    });
  }
  updateRenderModeButton();
  applyPartVisibility();
});
viewer.addEventListener("error", () => showMissing(currentLayer));

modelSelect.addEventListener("change", (e) => setModel(e.target.value));

layerBar.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-key]");
  if (!btn) return;
  const layer = currentModel.layers.find((l) => l.key === btn.dataset.key);
  if (layer) setLayer(layer);
});

snapBtn.addEventListener("click", async () => {
  const dataUrl = viewer.toDataURL("image/jpeg", 0.85);
  await saveSnapshot({
    dataUrl,
    modelLabel: currentModel.label,
    layerLabel: currentLayer.label,
    createdAt: Date.now(),
  });
  snapBtn.textContent = "✅";
  setTimeout(() => (snapBtn.textContent = "📷"), 600);
});

galleryBtn.addEventListener("click", async () => {
  await renderGallery();
  galleryDialog.showModal();
});
galleryClose.addEventListener("click", () => galleryDialog.close());

async function renderGallery() {
  const items = await getAllSnapshots();
  if (!items.length) {
    galleryGrid.innerHTML = `<p class="empty">No saved references yet. Tap 📷 while viewing a model.</p>`;
    return;
  }
  galleryGrid.innerHTML = items
    .slice()
    .reverse()
    .map(
      (it) => `
      <figure class="gallery-item" data-id="${it.id}">
        <img src="${it.dataUrl}" alt="${it.modelLabel} ${it.layerLabel}" />
        <figcaption>${it.modelLabel} · ${it.layerLabel}</figcaption>
        <button class="delete-btn" data-id="${it.id}">✕</button>
      </figure>`
    )
    .join("");
}

galleryGrid.addEventListener("click", async (e) => {
  const del = e.target.closest(".delete-btn");
  if (!del) return;
  await deleteSnapshot(Number(del.dataset.id));
  await renderGallery();
});

function renderCredits() {
  creditsBody.innerHTML = `
    <p class="credits-intro">
      Anatomy models by the artists below, used under Creative Commons licences.
      This credit must stay visible if you share this app.
    </p>
    <ul class="credits-list">
      ${listCredits()
        .map(
          (c) => `
        <li>
          <a href="${c.url}" target="_blank" rel="noopener">${c.title}</a>
          <span class="credits-meta">${c.author} · ${c.licence}</span>
        </li>`
        )
        .join("")}
    </ul>`;
}

creditsBtn.addEventListener("click", () => {
  renderCredits();
  creditsDialog.showModal();
});
creditsClose.addEventListener("click", () => creditsDialog.close());

await discoverUnsorted();
renderModelSelect();
setModel(currentModel.id);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(resolve("/sw.js")).catch(() => {});
  });
}
