/**
 * Combine the separate meshes of a scan into one .glb.
 *
 *   node scripts/merge-parts.mjs models-raw/head-scan-female.glb models-raw/head-scan/*.obj models-raw/head-scan/*.fbx
 *
 * Scan vendors ship a head as separate meshes — head, eyeballs, teeth, tongue,
 * brows, lashes — each with its own material and textures. Loading them as
 * separate models would put a disembodied eyeball in the model picker, so they
 * are merged into one file before the optimizer sees it.
 *
 * Every part's materials are renamed after its source file. They all arrive
 * called "defaultMat", and the viewer needs distinguishable names to offer the
 * per-part visibility switches.
 *
 * Keep the parts in a subfolder of models-raw/. The optimizer only reads the top
 * level, so the parts stay out of its way and the merged .glb lands beside them.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition } from '@gltf-transform/functions';
import obj2gltf from 'obj2gltf';

const FBX2GLTF = new URL('../node_modules/fbx2gltf/bin/Darwin/FBX2glTF', import.meta.url).pathname;

const [outPath, ...inputs] = process.argv.slice(2);

if (!outPath || !inputs.length) {
  console.error('usage: node scripts/merge-parts.mjs <out.glb> <part.obj|part.fbx> ...');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function readPart(input) {
  if (/\.obj$/i.test(input)) {
    return io.readBinary(new Uint8Array(await obj2gltf(input, { binary: true })));
  }
  // FBX2glTF only writes to disk, and appends .glb to the output path it is given.
  const stem = path.join(os.tmpdir(), `fbx-${Date.now()}-${path.basename(input, '.fbx')}`);
  execFileSync(FBX2GLTF, ['-i', input, '-o', stem, '--binary'], { stdio: 'pipe' });
  const glb = fs.readFileSync(`${stem}.glb`);
  fs.unlinkSync(`${stem}.glb`);
  return io.readBinary(new Uint8Array(glb));
}

/**
 * Optional parts.json beside the parts, keyed by part name:
 *
 *   { "Brows": { "baseColor": [0.09, 0.065, 0.05, 1] },
 *     "Teeth": { "baseColorTexture": "Teeth_diffuse.jpg" } }
 *
 * Needed because not every part carries usable material data. Brows.obj and
 * Lashes.obj declare no material at all, so their .mtl is ignored and they
 * import as flat grey, and FBX parts reference textures by paths that do not
 * survive the export.
 */
const partsDir = path.dirname(inputs[0]);
const overridesPath = path.join(partsDir, 'parts.json');
const overrides = fs.existsSync(overridesPath)
  ? JSON.parse(fs.readFileSync(overridesPath, 'utf8'))
  : {};

const merged = new Document();
const scene = merged.createScene('merged');

for (const input of inputs) {
  const partName = path.basename(input).replace(/\.(obj|fbx)$/i, '');
  const part = await readPart(input);

  for (const material of part.getRoot().listMaterials()) material.setName(partName);
  for (const mesh of part.getRoot().listMeshes()) mesh.setName(partName);

  const override = overrides[partName];
  if (override) {
    for (const material of part.getRoot().listMaterials()) {
      if (override.baseColor) material.setBaseColorFactor(override.baseColor);
      if (override.roughness !== undefined) material.setRoughnessFactor(override.roughness);
      if (override.baseColorTexture) {
        const file = path.join(partsDir, override.baseColorTexture);
        const texture = part
          .createTexture(partName)
          .setImage(fs.readFileSync(file))
          .setMimeType(override.baseColorTexture.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
        material.setBaseColorTexture(texture);
      }
    }
  }

  // mergeDocuments copies the source in wholesale, including its own scene. The
  // nodes have to be re-parented onto one scene or only the first part renders.
  const map = mergeDocuments(merged, part);
  for (const sourceScene of part.getRoot().listScenes()) {
    for (const node of sourceScene.listChildren()) {
      const copy = map.get(node);
      if (copy) scene.addChild(copy);
    }
  }

  console.log(`  + ${partName}`);
}

// Every copied scene is now empty and would otherwise be written out.
for (const extra of merged.getRoot().listScenes()) {
  if (extra !== scene) extra.dispose();
}
merged.getRoot().setDefaultScene(scene);

// Each part arrived with its own buffer, and a GLB may only contain one.
await merged.transform(unpartition());

await io.write(outPath, merged);
console.log(`\nWrote ${outPath} — ${(fs.statSync(outPath).size / 1e6).toFixed(1)} MB`);
