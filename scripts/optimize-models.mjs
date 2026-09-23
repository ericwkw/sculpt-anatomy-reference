/**
 * Decimate downloaded anatomy models down to a triangle budget the phone can handle.
 *
 * Reads every .glb from models-raw/ and writes an optimized copy to
 * public/models/. Originals are never modified — re-run with a different budget
 * any time.
 *
 *   node scripts/optimize-models.mjs [--budget 300000] [--no-quantize]
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
import { weld, simplify, quantize, prune, dedup, getGLPrimitiveCount } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};

const BUDGET = flag('budget', 300_000);
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

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const rows = [];

  for (const name of files) {
    const inPath = new URL(name, RAW_DIR);
    const outPath = new URL(name, OUT_DIR);
    const doc = await io.read(inPath.pathname);

    const before = countTriangles(doc);
    const beforeBytes = fs.statSync(inPath).size;

    // Ratio is vertices kept, not triangles, but tracks closely enough after welding.
    const ratio = Math.min(1, BUDGET / before);

    const steps = [weld(), dedup()];
    if (ratio < 1) {
      steps.push(simplify({ simplifier: MeshoptSimplifier, ratio, error: MAX_ERROR }));
    }
    steps.push(prune());
    // Packs positions and normals into integers. Roughly halves geometry bytes and
    // needs KHR_mesh_quantization, which model-viewer supports.
    if (QUANTIZE) steps.push(quantize({ quantizeNormal: 12 }));

    await doc.transform(...steps);

    await io.write(outPath.pathname, doc);
    const after = countTriangles(doc);
    const afterBytes = fs.statSync(outPath).size;

    rows.push({ name, before, after, beforeBytes, afterBytes, skipped: ratio >= 1 });
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
