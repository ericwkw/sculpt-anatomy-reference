import { Document, NodeIO } from '@gltf-transform/core';

/**
 * A minimal valid .glb served in place of the real anatomy models, so the suite
 * runs on a fresh clone where public/models/ is empty (those files are licensed
 * downloads and gitignored).
 */
export async function makeFixtureGlb() {
  const SEG = 12;
  const tri = [];
  const point = (u, v) => {
    const t = u * Math.PI;
    const p = v * 2 * Math.PI;
    return [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
  };
  for (let i = 0; i < SEG; i++) {
    for (let j = 0; j < SEG; j++) {
      const a = point(i / SEG, j / SEG);
      const b = point((i + 1) / SEG, j / SEG);
      const c = point((i + 1) / SEG, (j + 1) / SEG);
      const d = point(i / SEG, (j + 1) / SEG);
      tri.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const positions = new Float32Array(tri);

  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer)
    )
    .setAttribute(
      'NORMAL',
      doc.createAccessor().setType('VEC3').setArray(positions.slice()).setBuffer(buffer)
    )
    .setMaterial(doc.createMaterial('m').setBaseColorFactor([0.8, 0.5, 0.4, 1]));
  doc.createScene().addChild(doc.createNode('n').setMesh(doc.createMesh('s').addPrimitive(prim)));

  return Buffer.from(await new NodeIO().writeBinary(doc));
}
