/**
 * Decimate downloaded anatomy models down to a triangle budget the phone can handle.
 *
 * Reads every .glb from models-raw/ and writes an optimized copy to
 * public/models/. Originals are never modified — re-run with a different budget
 * any time.
 *
 *   node scripts/optimize-models.mjs [--budget 600000] [--no-quantize]
 *
 * The explicit weld() below is load-bearing. simplify() does weld internally, but
 * with overwrite:false, which skips any primitive that already carries indices —
 * and ZBrush and scan exports are typically indexed with duplicated vertices along
 * every triangle boundary. The simplifier then reads those duplicates as surface
 * borders it must preserve. Measured on an indexed sphere with duplicated verts:
 * simplify alone took 80,000 tris to 79,799; weld() first took it to 20,000.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  weld,
  simplify,
  quantize,
  prune,
  dedup,
  getGLPrimitiveCount,
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};

// 300k smoothed muscle fibre striations into mush on the dense écorché heads —
// visible at working distance, which is the distance that matters. At 600k the
// fibre direction survives and matches the original by eye.
const BUDGET = flag('budget', 600_000);
const QUANTIZE = !args.includes('--no-quantize');
const RAW_DIR = new URL('../models-raw/', import.meta.url);
const OUT_DIR = new URL('../public/models/', import.meta.url);

// Bounded at 0.2% of mesh radius. Past roughly this, anatomical landmarks start
// to soften and the model stops being trustworthy as sculpting reference.
const MAX_ERROR = 0.002;

const countTriangles = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, prim) => sum + getGLPrimitiveCount(prim), 0);

/**
 * Average face normals into each shared vertex, in place.
 *
 * The built-in normals() transform unwelds first so it can write flat per-face
 * normals, which both undoes the weld the simplifier depends on and makes an
 * organic surface look faceted. This keeps the welded topology.
 */
function computeSmoothNormals(doc) {
  for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    const position = prim.getAttribute('POSITION');
    const indices = prim.getIndices();
    if (!position || !indices) continue;

    const pos = position.getArray();
    const idx = indices.getArray();
    const out = new Float32Array(position.getCount() * 3);

    for (let i = 0; i < idx.length; i += 3) {
      const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
      const ux = pos[b] - pos[a];
      const uy = pos[b + 1] - pos[a + 1];
      const uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a];
      const vy = pos[c + 1] - pos[a + 1];
      const vz = pos[c + 2] - pos[a + 2];
      // Left unnormalized so larger triangles weight the result proportionally.
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      for (const v of [a, b, c]) {
        out[v] += nx;
        out[v + 1] += ny;
        out[v + 2] += nz;
      }
    }

    for (let i = 0; i < out.length; i += 3) {
      const len = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
      out[i] /= len;
      out[i + 1] /= len;
      out[i + 2] /= len;
    }

    prim.setAttribute(
      'NORMAL',
      doc.createAccessor().setType('VEC3').setArray(out).setBuffer(doc.getRoot().listBuffers()[0])
    );
  }
}

const countVertices = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, prim) => sum + prim.getAttribute('POSITION').getCount(), 0);

const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;

async function main() {
  await MeshoptSimplifier.ready;

  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
    console.log(`Created ${path.relative(process.cwd(), RAW_DIR.pathname)}`);
    console.log('Put your downloaded .glb files there, then run this again.');
    return;
  }

  const files = fs.readdirSync(RAW_DIR).filter((n) => n.toLowerCase().endsWith('.glb'));
  if (!files.length) {
    console.log(`No .glb files in ${path.relative(process.cwd(), RAW_DIR.pathname)}`);
    console.log('See ATTRIBUTION.md for what to download and what to name each file.');
    return;
  }

  // Museum archives often ship Draco-compressed meshes; without the decoder
  // registered, reading one fails with an opaque "DT_FLOAT32" error.
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const rows = [];

  for (const name of files) {
    const inPath = new URL(name, RAW_DIR);
    const outPath = new URL(name, OUT_DIR);
    const doc = await io.read(inPath.pathname);

    // Drop any inherited mesh compression so the output is written plain — the
    // quantize step below is this pipeline's size strategy, and leaving Draco in
    // place would demand an encoder to re-compress geometry we just rewrote.
    for (const extension of doc.getRoot().listExtensionsUsed()) {
      if (extension.extensionName === 'KHR_draco_mesh_compression') extension.dispose();
    }

    const before = countTriangles(doc);
    const beforeBytes = fs.statSync(inPath).size;

    await doc.transform(weld(), dedup());

    // weld() matches on every attribute, so a mesh carrying per-face normals —
    // which photogrammetry output usually does — welds nothing: each triangle
    // keeps its own three vertices and the simplifier finds no shared edges to
    // collapse. A closed mesh should have roughly half as many vertices as
    // triangles; anything near 3x is still unwelded. Dropping normals lets the
    // weld match on position alone, then they are recomputed as smooth.
    let rewelded = false;
    if (countVertices(doc) > countTriangles(doc) * 1.5) {
      for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
        prim.setAttribute('NORMAL', null);
      }
      await doc.transform(weld());
      rewelded = true;
    }

    if (before > BUDGET) {
      await doc.transform(
        simplify({ simplifier: MeshoptSimplifier, ratio: BUDGET / before, error: MAX_ERROR })
      );
    }

    // Normals were dropped to let the weld match on position; rebuild them now
    // that the mesh is at its final triangle count.
    if (rewelded) computeSmoothNormals(doc);

    const steps = [prune()];
    // Packs positions and normals into integers. Roughly halves geometry bytes and
    // needs KHR_mesh_quantization, which model-viewer supports.
    if (QUANTIZE) steps.push(quantize({ quantizePosition: 16, quantizeNormal: 12 }));

    await doc.transform(...steps);

    await io.write(outPath.pathname, doc);
    const after = countTriangles(doc);
    const afterBytes = fs.statSync(outPath).size;

    rows.push({ name, before, after, beforeBytes, afterBytes, skipped: before <= BUDGET });
  }

  const pad = (s, n) => String(s).padEnd(n);
  const padStart = (s, n) => String(s).padStart(n);
  const width = Math.max(...rows.map((r) => r.name.length), 8);

  console.log(`\nBudget ${BUDGET.toLocaleString()} tris${QUANTIZE ? ', quantized' : ''}\n`);
  console.log(`${pad('file', width)}  ${padStart('tris in', 10)}  ${padStart('tris out', 10)}  ${padStart('size in', 9)}  ${padStart('size out', 9)}`);
  for (const r of rows) {
    console.log(
      `${pad(r.name, width)}  ${padStart(r.before.toLocaleString(), 10)}  ${padStart(r.after.toLocaleString(), 10)}  ${padStart(mb(r.beforeBytes), 9)}  ${padStart(mb(r.afterBytes), 9)}${r.skipped ? '  (already under budget)' : ''}`
    );
  }

  const totalAfter = rows.reduce((n, r) => n + r.afterBytes, 0);
  console.log(`\nWrote ${rows.length} file(s) to public/models/ — ${mb(totalAfter)} total.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
