/**
 * Generate a heavily-simplified, flat-shaded "planar clay study" companion for
 * every optimized model, the way a sculptor blocks in a head with a few large
 * cut planes before any surface detail exists.
 *
 *   node scripts/make-planar.mjs [--budget 500]
 *
 * Reads every .glb in public/models/ (the already-optimized output of
 * optimize-models.mjs, never models-raw/) and writes a companion into
 * public/models/planar/ under the same filename. That subfolder — not a
 * filename suffix — is what keeps these out of manifest.json and so out of
 * the Unsorted auto-discovery list: optimize-models.mjs only reads the top
 * level of public/models/, exactly like models-raw/head-scan/ stays invisible
 * to it on the input side.
 *
 * Two moves make a mesh read as cut planes rather than a shrunk version of the
 * original: an aggressive triangle target, and flat (per-face) normals in
 * place of smooth ones. Smooth normals are what make a decimated mesh still
 * look "round" — flat normals are what make each remaining triangle read as
 * its own facet, which is the entire visual difference between "low-poly" and
 * "planar clay study".
 *
 * A third move turned out to be load-bearing, not optional: gltf-transform's
 * edge-collapse simplify() — the right tool in optimize-models.mjs, which
 * wants to preserve fidelity within a budget — applies its target ratio per
 * PRIMITIVE, independently. A merged scan with 26 separate muscle-bundle
 * primitives (head-female-muscle.glb) stayed at 35,714 triangles against a
 * budget of 500 no matter how far MAX_ERROR was raised, because raising the
 * error tolerance does nothing when the actual constraint is 26 small islands
 * each hitting a topology floor no error setting can move. Reduction here is
 * instead done with meshoptimizer's simplifySloppy — a voxel-style reducer
 * that ignores topology and disconnected islands entirely, built for exactly
 * "hit this triangle count, fidelity is not the point" rather than
 * edge-collapse's "stay faithful within this budget". The same
 * head-female-muscle.glb reaches 297 triangles with it.
 *
 * Every primitive is concatenated into one self-contained mesh by hand before
 * that single simplifySloppy call runs, rather than relying on gltf-transform's
 * own join() to do it: join() does combine primitives sharing one material,
 * but on an 8-part photogrammetry scan (head-scan-female.glb) it only
 * consolidated 8 primitives down to 5, not 1, for reasons not worth chasing
 * through its internals. That forced giving each surviving primitive a budget
 * share proportional to its own triangle count, which broke on exactly the
 * small, thin parts scans are full of — eyeballs, tongue: a small proportional
 * target on already-small, thin geometry does not degrade gracefully under a
 * voxel-style reducer, and came back some primitives as a handful of stray
 * triangles and others as nothing at all. Concatenating by hand and reducing
 * everything together in one pass means a thin part's fate is decided by the
 * whole mesh's shape, not a fragile per-part quota.
 *
 * Losing per-part material identity here is deliberate, not a side effect
 * swallowed for convenience: a planar study is a single blocked mass by
 * definition, so the per-part visibility switches the main viewer offers for
 * a merged scan do not apply to this companion.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  weld,
  dequantize,
  normals,
  prune,
  transformMesh,
  getGLPrimitiveCount,
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};

// Not a fraction of the source count, like optimize-models.mjs uses — a fixed
// absolute target, because the point is the same small number of dominant
// planes regardless of whether the source is a 38k skull or a 600k écorché.
const BUDGET = flag('budget', 500);
// simplifySloppy's error is a ceiling on how far it is ALLOWED to drift, not a
// target it aims for — generous on purpose so the triangle count, not the
// error bound, is what actually limits reduction.
const MAX_ERROR = flag('error', 1);

const IN_DIR = new URL('../public/models/', import.meta.url);
const OUT_DIR = new URL('../public/models/planar/', import.meta.url);

// Matte, monochrome, close to the studio clay colour but a touch darker and
// flatter — flat normals already carry the read; a glossy surface would put
// distracting specular highlights on facet edges instead of clean planes.
const PLANAR_GREY = [0.55, 0.55, 0.55, 1];

const countTriangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, prim) => sum + getGLPrimitiveCount(prim), 0);

const mb = (bytes) => `${(bytes / 1e6).toFixed(2)} MB`;

function stripToMatteGrey(doc) {
  for (const material of doc.getRoot().listMaterials()) {
    material.setBaseColorTexture(null);
    material.setNormalTexture(null);
    material.setMetallicRoughnessTexture(null);
    material.setEmissiveTexture(null);
    material.setOcclusionTexture(null);
    material.setBaseColorFactor(PLANAR_GREY);
    material.setMetallicFactor(0);
    material.setRoughnessFactor(0.95);
  }
}

/**
 * Turn a loaded document into a planar clay study, in place. Pure apart from
 * mutating `doc` — no filesystem access — so it can run against an in-memory
 * fixture in tests without touching public/models/.
 *
 * Returns the before/after triangle counts the CLI reports.
 */
/**
 * Concatenate every primitive's POSITION + indices into one flat, self-
 * contained pair of arrays — position offsets are irrelevant here (a shared
 * material makes them visually equivalent either way) but index values are
 * rebased by a running vertex-count offset so they keep pointing at the right
 * vertices once every primitive's data lives in one combined buffer.
 */
function concatenateGeometry(prims) {
  let vertexTotal = 0;
  let indexTotal = 0;
  for (const prim of prims) {
    vertexTotal += prim.getAttribute('POSITION').getCount();
    indexTotal += prim.getIndices().getCount();
  }

  const positions = new Float32Array(vertexTotal * 3);
  const indices = new Uint32Array(indexTotal);
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const prim of prims) {
    const pos = prim.getAttribute('POSITION').getArray();
    positions.set(pos, vertexOffset * 3);

    const idx = prim.getIndices().getArray();
    for (let i = 0; i < idx.length; i++) indices[indexOffset + i] = idx[i] + vertexOffset;

    vertexOffset += prim.getAttribute('POSITION').getCount();
    indexOffset += idx.length;
  }

  return { positions, indices };
}

export async function planarize(doc, { budget = BUDGET, error = MAX_ERROR } = {}) {
  await MeshoptSimplifier.ready;

  const before = countTriangles(doc);

  // Every source file here is optimize-models.mjs output, which quantizes
  // positions to 16-bit integers by default. Reading POSITION.getArray()
  // directly, as everything below does, returns those RAW quantized integers,
  // not real coordinates — invisible on a single-primitive model, where every
  // vertex shares one quantization range and shapes stay self-consistent even
  // in raw int space, but silently wrong the moment more than one primitive is
  // concatenated: KHR_mesh_quantization normalizes each accessor
  // independently, so two primitives' raw integers are not on the same scale
  // even though both clamp to the same ±32767 range. head-scan-female.glb (8
  // parts) came out with a bounding box of roughly ±31,000 — exactly that
  // symptom — while single-primitive models looked fine purely by accident.
  await doc.transform(dequantize());

  // A far more serious version of the same "raw buffer isn't what it looks
  // like" mistake: a model with more than one node — any merged multi-part
  // scan, produced by scripts/merge-parts.mjs — gives each part its own Node,
  // and a Node's position/rotation/scale place that part correctly in the
  // SCENE. POSITION data on the mesh itself is in that node's own LOCAL
  // space, unrelated to any other part's local space. Reading it directly, as
  // everything below does, silently discards exactly the information that
  // keeps many separate primitives lined up into one coherent object instead
  // of each sitting independently at the scene origin. This is what broke
  // head-female-muscle.glb (26 muscle-bundle nodes) the moment dequantize()
  // was added above to fix head-scan-female.glb (8 part nodes) — the same bug
  // in both, previously masked because reading raw quantized integers without
  // dequantizing happened to keep every primitive in roughly the same numeric
  // range by coincidence, not because the geometry was actually correct. Must
  // run after dequantize(): a world matrix means nothing applied to raw
  // quantized integers.
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (mesh) transformMesh(mesh, node.getWorldMatrix());
  }

  // Guarantees every primitive has an index buffer — a raw OBJ/scan import can
  // arrive fully unindexed — so the concatenation below always has indices to
  // rebase, without needing a separate "what if there are none" branch.
  await doc.transform(weld());

  // TRIANGLES only: female-chera-bone.glb, among the source models, carries a
  // 4-vertex LINES primitive (likely a leftover gizmo or axis helper). Any
  // non-triangle draw mode concatenated into the triangle index buffer breaks
  // the multiple-of-3 invariant simplifySloppy requires, and a stray line has
  // no place in a planar study of solid form regardless.
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const usable = prims.filter(
    (p) => p.getMode() === Primitive.Mode.TRIANGLES && p.getAttribute('POSITION') && p.getIndices()
  );

  if (usable.length) {
    // A planar study is a single blocked mass, not a set of independently
    // toggleable parts, so every primitive is concatenated into one
    // self-contained mesh and reduced in a single simplifySloppy call against
    // the full budget. join() was tried first and looked right — it does
    // combine primitives sharing one material — but on an 8-part scan it only
    // consolidated down to 5, not 1, for reasons that were not worth chasing
    // through its internals further. That forced a fallback to giving each
    // surviving primitive a budget share proportional to its own triangle
    // count, which broke on exactly the small, thin parts (eyeballs, tongue)
    // that scans are full of: simplifySloppy is a voxel-style reducer, and a
    // small proportional target on already-small, thin geometry does not
    // reliably degrade gracefully — it can come back as a handful of stray
    // triangles or nothing at all, both of which happened. Concatenating by
    // hand and reducing everything together in one pass means a thin part's
    // fate is decided by the whole mesh's shape, not a fragile per-part quota.
    const { positions, indices } = concatenateGeometry(usable);
    // simplifySloppy asserts target_index_count <= indices.length — a budget
    // already at or above what is there is "leave it alone", the same as the
    // ratio<1 guard optimize-models.mjs uses for its own simplifier.
    const targetIndexCount = Math.min(indices.length, budget * 3);
    const reduced =
      targetIndexCount < indices.length
        ? MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, targetIndexCount, error)[0]
        : indices;

    const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
    const [canonical] = doc.getRoot().listMaterials();
    const newPrim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(reduced).setBuffer(buffer));
    if (canonical) newPrim.setMaterial(canonical);

    const scene = doc.getRoot().listScenes()[0] ?? doc.createScene();
    scene.addChild(doc.createNode('planar').setMesh(doc.createMesh('planar').addPrimitive(newPrim)));

    for (const prim of prims) prim.dispose();
    for (const mesh of doc.getRoot().listMeshes()) {
      if (mesh.listPrimitives().length === 0) mesh.dispose();
    }
  }

  // normals({overwrite:true}) unwelds first so it can write one flat normal
  // per triangle corner — the opposite of what optimize-models.mjs wants, and
  // exactly what this pass wants. See that script's header for the same
  // transform used to prove the point in the other direction. It also drops
  // whatever vertices simplifySloppy left unreferenced, since unweld rebuilds
  // the vertex buffer strictly from the surviving (much shorter) index list.
  await doc.transform(normals({ overwrite: true }));

  stripToMatteGrey(doc);
  await doc.transform(prune());

  return { before, after: countTriangles(doc) };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(IN_DIR).filter((n) => n.toLowerCase().endsWith('.glb'));
  if (!files.length) {
    console.log('No .glb files in public/models/ — run npm run optimize first.');
    return;
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const rows = [];

  for (const name of files) {
    const inPath = new URL(name, IN_DIR);
    const outPath = new URL(name, OUT_DIR);
    const doc = await io.read(inPath.pathname);

    const beforeBytes = fs.statSync(inPath).size;
    const { before, after } = await planarize(doc);

    await io.write(outPath.pathname, doc);
    const afterBytes = fs.statSync(outPath).size;

    rows.push({ name, before, after, beforeBytes, afterBytes });
  }

  const pad = (s, n) => String(s).padEnd(n);
  const padStart = (s, n) => String(s).padStart(n);
  const width = Math.max(...rows.map((r) => r.name.length), 8);

  console.log(`\nPlanar budget ${BUDGET.toLocaleString()} tris, error ${MAX_ERROR}\n`);
  console.log(`${pad('file', width)}  ${padStart('tris in', 10)}  ${padStart('tris out', 10)}  ${padStart('size in', 9)}  ${padStart('size out', 9)}`);
  for (const r of rows) {
    console.log(
      `${pad(r.name, width)}  ${padStart(r.before.toLocaleString(), 10)}  ${padStart(r.after.toLocaleString(), 10)}  ${padStart(mb(r.beforeBytes), 9)}  ${padStart(mb(r.afterBytes), 9)}`
    );
  }

  const totalAfter = rows.reduce((n, r) => n + r.afterBytes, 0);
  console.log(`\nWrote ${rows.length} file(s) to public/models/planar/ — ${mb(totalAfter)} total.`);
}

// Guard so importing planarize() for tests does not also run the CLI.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
