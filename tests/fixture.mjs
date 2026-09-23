import { Document, NodeIO } from '@gltf-transform/core';

/**
 * A minimal valid .glb served in place of the real anatomy models, so the suite
 * runs on a fresh clone where public/models/ is empty (those files are licensed
 * downloads and gitignored).
 */
// 1x1 white PNG — enough to make a model count as textured.
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

export async function makeFixtureGlb({ textured = false } = {}) {
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

  const material = doc.createMaterial('m').setBaseColorFactor([0.8, 0.5, 0.4, 1]);

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
    .setMaterial(material);

  if (textured) {
    const texture = doc.createTexture('skin').setImage(PIXEL_PNG).setMimeType('image/png');
    material.setBaseColorTexture(texture);
    // A base colour texture is only sampled if the primitive carries UVs.
    const uv = new Float32Array((positions.length / 3) * 2);
    prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buffer));
  }
  doc.createScene().addChild(doc.createNode('n').setMesh(doc.createMesh('s').addPrimitive(prim)));

  return Buffer.from(await new NodeIO().writeBinary(doc));
}
