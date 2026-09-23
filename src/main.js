import { MODELS, listCredits } from "./models.js";
import { saveSnapshot, getAllSnapshots, deleteSnapshot } from "./gallery-store.js";

const viewer = document.getElementById("viewer");
const noModel = document.getElementById("no-model");
const modelSelect = document.getElementById("model-select");
const layerBar = document.getElementById("layer-bar");
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
  const files = await fetch("/models/manifest.json")
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

// Layers whose .glb has not been downloaded yet are shown disabled rather than
// silently failing to load. See ATTRIBUTION.md for what each file should be.
const available = new Map();

async function checkAvailability(model) {
  await Promise.all(
    model.layers
      .filter((l) => !available.has(l.src))
      .map(async (l) => {
        // Vite's dev server answers unknown paths with the index page rather than
        // a 404, so a 200 alone does not mean the .glb is there.
        const ok = await fetch(l.src, { method: "HEAD" })
          .then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html"))
          .catch(() => false);
        available.set(l.src, ok);
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

function setLayer(layer) {
  currentLayer = layer;
  if (available.get(layer.src) === false) {
    viewer.removeAttribute("src");
    showMissing(layer);
  } else {
    noModel.hidden = true;
    viewer.src = layer.src;
  }
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
    };
  });
}

const hasTexture = () => authored.some((m) => m.baseColorTexture);

function applyRenderMode() {
  const materials = viewer.model?.materials ?? [];
  materials.forEach((material, i) => {
    const pbr = material.pbrMetallicRoughness;
    const original = authored[i];
    if (renderMode === "clay") {
      pbr.setBaseColorFactor(CLAY);
      pbr.setMetallicFactor(0);
      pbr.setRoughnessFactor(0.9);
      // baseColorFactor multiplies the texture rather than replacing it, so a
      // textured model stays textured until the texture itself is detached.
      if (original?.baseColorTexture) pbr.baseColorTexture.setTexture(null);
    } else if (original) {
      pbr.setBaseColorFactor(original.baseColorFactor);
      pbr.setMetallicFactor(original.metallicFactor);
      pbr.setRoughnessFactor(original.roughnessFactor);
      if (original.baseColorTexture) pbr.baseColorTexture.setTexture(original.baseColorTexture);
    }
  });
  renderModeBtn.textContent = renderMode === "clay" ? "Clay" : "Skin";
  renderModeBtn.disabled = !hasTexture() && renderMode === "clay";
}

renderModeBtn.addEventListener("click", () => {
  renderMode = renderMode === "clay" ? "material" : "clay";
  applyRenderMode();
});

viewer.addEventListener("load", () => {
  noModel.hidden = true;
  captureAuthored();
  // A scan's own skin is the reason to load it; an untextured anatomy model has
  // nothing to show but clay.
  renderMode = hasTexture() ? "material" : "clay";
  applyRenderMode();
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
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
