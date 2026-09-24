/**
 * Combine several OBJ parts into one .glb.
 *
 *   node scripts/merge-obj.mjs models-raw/head-scan-female.glb models-raw/head-scan/*.obj
 *
 * Scan vendors ship a head as separate meshes — head, eyeballs, teeth, lashes —
 * each with its own .mtl and textures. Loading them as separate models would put
 * a disembodied eyeball in the model picker, so they are merged into one file
 * before the optimizer sees it.
 *
 * Keep the parts in a subfolder of models-raw/. The optimizer only reads the top
 * level, so the parts stay out of its way and the merged .glb lands beside them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition } from '@gltf-transform/functions';
import obj2gltf from 'obj2gltf';

const [outPath, ...inputs] = process.argv.slice(2);

if (!outPath || !inputs.length) {
  console.error('usage: node scripts/merge-obj.mjs <out.glb> <part.obj> [part.obj ...]');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const merged = new Document();
const scene = merged.createScene('merged');

for (const input of inputs) {
  const glb = await obj2gltf(input, { binary: true });
  const part = await io.readBinary(new Uint8Array(glb));

  // mergeDocuments copies the source in wholesale, including its own scene. The
  // nodes have to be re-parented onto one scene or only the first part renders.
  const map = mergeDocuments(merged, part);
  for (const sourceScene of part.getRoot().listScenes()) {
    for (const node of sourceScene.listChildren()) {
      const copy = map.get(node);
      if (copy) scene.addChild(copy);
    }
  }

  console.log(`  + ${path.basename(input)}`);
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
