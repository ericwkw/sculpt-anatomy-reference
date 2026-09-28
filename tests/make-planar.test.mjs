/**
 * Unit tests for the planar-clay transform, run with Node's built-in test
 * runner rather than Playwright: this exercises geometry math on an in-memory
 * document, not the browser, so a real page is unneeded weight.
 *
 *   node --test tests/make-planar.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document, Primitive } from '@gltf-transform/core';
import { getGLPrimitiveCount } from '@gltf-transform/functions';
import { planarize } from '../scripts/make-planar.mjs';

/** A moderately dense UV sphere, standing in for an optimized anatomy model. */
function makeSphereDoc({ segments = 24, textured = false } = {}) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const point = (u, v) => {
    const t = u * Math.PI;
    const p = v * 2 * Math.PI;
    return [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
  };

  // Radius 2, not 1: a unit sphere's outward normal is numerically identical
  // to its position, and dedup() includes ACCESSOR among the property types it
  // merges — it would collapse POSITION and NORMAL into one shared accessor.
  // normals({overwrite:true}) then disposes "the normal accessor" believing it
  // is disposing only that semantic slot, taking the (shared) POSITION down
  // with it. Real anatomy meshes never hit this — position and normal are
  // never bit-identical — so scaling position here keeps the fixture honest
  // rather than papering over a coincidence specific to a sphere at the origin.
  const RADIUS = 2;
  const positions = [];
  const normals = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = point(i / segments, j / segments);
      const b = point((i + 1) / segments, j / segments);
      const c = point((i + 1) / segments, (j + 1) / segments);
      const d = point(i / segments, (j + 1) / segments);
      for (const p of [a, b, c, a, c, d]) {
        positions.push(p[0] * RADIUS, p[1] * RADIUS, p[2] * RADIUS);
        normals.push(...p);
      }
    }
  }

  const material = doc.createMaterial('m').setBaseColorFactor([0.9, 0.2, 0.2, 1]);
  if (textured) {
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    material.setBaseColorTexture(doc.createTexture('t').setImage(pixel).setMimeType('image/png'));
  }

  const prim = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer)
    )
    .setAttribute(
      'NORMAL',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(normals)).setBuffer(buffer)
    )
    .setMaterial(material);
  doc.createScene().addChild(doc.createNode('n').setMesh(doc.createMesh('s').addPrimitive(prim)));
  return doc;
}

const triCount = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((sum, p) => sum + getGLPrimitiveCount(p), 0);

const vertCount = (doc) =>
  doc
    .getRoot()
    .listMeshes()
    .flatMap((m) => m.listPrimitives())
    .reduce((sum, p) => sum + p.getAttribute('POSITION').getCount(), 0);

test('reduces a dense mesh down to roughly the requested plane budget', async () => {
  const doc = makeSphereDoc({ segments: 24 }); // 24*24*2 = 1,152 triangles
  const { before, after } = await planarize(doc, { budget: 60 });

  assert.equal(before, 1152);
  // meshoptimizer rarely lands exactly on target; a generous ceiling still
  // proves this is decimation, not merely dropping a bit of detail.
  assert.ok(after <= 120, `expected roughly 60 triangles, got ${after}`);
  assert.ok(after > 0, 'the mesh must not disappear entirely');
});

test('every triangle carries its own geometric face normal', async () => {
  // The visual point of a planar study is that neighbouring triangles do not
  // share normals — each reads as its own cut facet rather than blending into
  // an averaged, rounded surface. Checking the shared-index count after
  // unweld would be circular (unweld makes every corner's index unique by
  // construction), so this instead recomputes the true face normal from the
  // triangle's own vertex positions and checks the stored normal matches it,
  // for every corner of every triangle.
  const doc = makeSphereDoc({ segments: 24 });
  await planarize(doc, { budget: 200 });

  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const indices = prim.getIndices();
  const position = prim.getAttribute('POSITION');
  const normal = prim.getAttribute('NORMAL');
  // normals({overwrite:true}) unwelds internally so every corner can own its
  // triangle's face normal outright — the primitive ends up index-free, with
  // vertices i, i+1, i+2 forming triangle i/3 by construction. That absence of
  // an index buffer is what "flat" means here, not a defect to guard against.
  assert.equal(indices, null, 'flat shading fully unwelds — there should be no index buffer left');

  const vertexCount = position.getCount();
  const idx = Array.from({ length: vertexCount }, (_, i) => i);
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const cross = (u, v) => [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const norm = ([x, y, z]) => {
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  };

  let checked = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
    const pa = position.getElement(a, []);
    const pb = position.getElement(b, []);
    const pc = position.getElement(c, []);
    const expected = norm(cross(sub(pb, pa), sub(pc, pa)));

    for (const corner of [a, b, c]) {
      const stored = norm(normal.getElement(corner, []));
      const dot = stored[0] * expected[0] + stored[1] * expected[1] + stored[2] * expected[2];
      // Sign can legitimately flip with winding order; only orientation, not
      // direction, is what "flat and correct" requires here.
      assert.ok(Math.abs(dot) > 0.999, `corner normal does not match the triangle's own face`);
    }
    checked++;
  }
  assert.ok(checked > 0, 'the mesh must have triangles to check');
});

test('every material becomes uniform matte grey with no texture', async () => {
  const doc = makeSphereDoc({ segments: 24, textured: true });
  await planarize(doc, { budget: 200 });

  for (const material of doc.getRoot().listMaterials()) {
    assert.equal(material.getBaseColorTexture(), null, 'texture must be stripped, not just tinted');
    const [r, g, b] = material.getBaseColorFactor();
    assert.ok(Math.abs(r - g) < 1e-6 && Math.abs(g - b) < 1e-6, 'colour must be neutral grey');
    assert.equal(material.getMetallicFactor(), 0);
  }
});

test('a multi-part scan reduces to the budget as a whole, not per part', async () => {
  // The actual bug this pipeline was built around: gltf-transform's ordinary
  // edge-collapse simplify() applies its target ratio to each PRIMITIVE
  // independently. A real scan with 26 separate muscle-bundle primitives came
  // out at 35,714 triangles against a budget of 500, unmoved by raising the
  // error tolerance from 0.35 to 5.0, because the actual constraint was many
  // small topologically separate islands, not the error bound. Reproduced
  // here with a handful of separate, differently-materialled spheres standing
  // in for those muscle bundles.
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const PARTS = 6;
  const SEGMENTS = 16; // 16*16*2 = 512 triangles per part, 3,072 total

  const point = (u, v) => {
    const t = u * Math.PI;
    const p = v * 2 * Math.PI;
    return [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
  };

  for (let part = 0; part < PARTS; part++) {
    const positions = [];
    const normalArr = [];
    for (let i = 0; i < SEGMENTS; i++) {
      for (let j = 0; j < SEGMENTS; j++) {
        const a = point(i / SEGMENTS, j / SEGMENTS);
        const b = point((i + 1) / SEGMENTS, j / SEGMENTS);
        const c = point((i + 1) / SEGMENTS, (j + 1) / SEGMENTS);
        const d = point(i / SEGMENTS, (j + 1) / SEGMENTS);
        for (const p of [a, b, c, a, c, d]) {
          // Offset and scale each "bundle" so it is a genuinely separate
          // island, and so no two parts' positions collide with each other's
          // normals the way the single-sphere fixture's did (see above).
          positions.push(p[0] * 2 + part * 5, p[1] * 2, p[2] * 2);
          normalArr.push(...p);
        }
      }
    }
    const material = doc.createMaterial(`part-${part}`).setBaseColorFactor([0.9, 0.2, 0.2, 1]);
    const prim = doc
      .createPrimitive()
      .setAttribute(
        'POSITION',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer)
      )
      .setAttribute(
        'NORMAL',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(normalArr)).setBuffer(buffer)
      )
      .setMaterial(material);
    scene.addChild(doc.createNode(`part-${part}`).setMesh(doc.createMesh(`part-${part}`).addPrimitive(prim)));
  }

  const { before, after } = await planarize(doc, { budget: 500 });

  assert.equal(before, PARTS * 512);
  // A generous ceiling: the point is proving the whole document was reduced
  // together, not that it lands on exactly 500 — 35,714 is what "still
  // effectively unreduced" looked like on the real scan, so this only has to
  // rule that out.
  assert.ok(after <= 1500, `expected the merged document to approach the 500 budget, got ${after}`);

  // The triangle-count check above is not on its own a reliable witness for
  // this fix: at this fixture's small scale, plain edge-collapse simplify()
  // ALSO reaches a similar count per isolated part, for unrelated reasons —
  // it only fails to do so on genuinely complex, thin production geometry,
  // which is expensive to fake cheaply in a unit test. What actually changed
  // is that every part now shares one material and gets joined into far fewer
  // primitives before reduction runs; asserting that directly is what would
  // catch a regression back to the old per-primitive path, where each of the
  // 6 parts would still be its own separate, separately-materialled primitive.
  const primCount = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).length;
  assert.ok(primCount < PARTS, `expected parts to be joined, found ${primCount} primitives for ${PARTS} parts`);
});

test('node transforms are baked in before parts are combined', async () => {
  // The most serious bug this pipeline hit: a merged multi-part scan gives
  // each part its own Node, and a Node's translation/rotation/scale is what
  // places that part correctly in the scene — POSITION data on the mesh
  // itself is in the node's own LOCAL space, unrelated to any other part's.
  // Concatenating raw local-space buffers collapses every part onto the
  // scene origin, discarding whatever kept them apart. Two identical spheres
  // are placed 10 units apart purely via node translation (their own vertex
  // data is centred on the local origin either way) — an output with both
  // baked in must span roughly that gap; one that ignored the transforms
  // collapses back to a single sphere's own small radius.
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const SEGMENTS = 10;

  const point = (u, v) => {
    const t = u * Math.PI;
    const p = v * 2 * Math.PI;
    return [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
  };

  for (const offsetX of [-5, 5]) {
    const positions = [];
    const normalArr = [];
    for (let i = 0; i < SEGMENTS; i++) {
      for (let j = 0; j < SEGMENTS; j++) {
        const a = point(i / SEGMENTS, j / SEGMENTS);
        const b = point((i + 1) / SEGMENTS, j / SEGMENTS);
        const c = point((i + 1) / SEGMENTS, (j + 1) / SEGMENTS);
        const d = point(i / SEGMENTS, (j + 1) / SEGMENTS);
        for (const p of [a, b, c, a, c, d]) {
          positions.push(...p); // deliberately centred on the local origin
          normalArr.push(...p);
        }
      }
    }
    const material = doc.createMaterial(`m${offsetX}`).setBaseColorFactor([0.8, 0.3, 0.3, 1]);
    const prim = doc
      .createPrimitive()
      .setAttribute(
        'POSITION',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer)
      )
      .setAttribute(
        'NORMAL',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(normalArr)).setBuffer(buffer)
      )
      .setMaterial(material);
    const mesh = doc.createMesh(`mesh${offsetX}`).addPrimitive(prim);
    // The node's own transform places this part in the scene — not its
    // vertex data, which stays centred on the local origin either way.
    const node = doc.createNode(`node${offsetX}`).setMesh(mesh).setTranslation([offsetX, 0, 0]);
    scene.addChild(node);
  }

  await planarize(doc, { budget: 200 });

  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const position = prim.getAttribute('POSITION');
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < position.getCount(); i++) {
    const x = position.getElement(i, [])[0];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }

  // Each sphere has radius 1, centred at x=-5 and x=5, so a correct bake spans
  // roughly x=-6 to x=6. Losing the transforms collapses both onto the origin,
  // spanning only about x=-1 to x=1 — the two are not close to ambiguous.
  const span = maxX - minX;
  assert.ok(span > 8, `expected the two translated parts to span >8 on X, got ${span.toFixed(2)}`);
});

test('a non-triangle primitive mixed in does not crash the reducer', async () => {
  // Found in the wild in female-chera-bone.glb: a 4-vertex LINES primitive,
  // presumably a leftover gizmo or axis helper. Concatenating its index buffer
  // into what simplifySloppy expects as pure triangles broke the
  // multiple-of-3 invariant it asserts on. A stray line also has no business
  // in a study of solid planar form, so the fix is to drop it, not adapt to it.
  const doc = makeSphereDoc({ segments: 12 });
  const buffer = doc.getRoot().listBuffers()[0];
  const linePositions = new Float32Array([0, 0, 0, 1, 0, 0]);
  const lineIndices = new Uint32Array([0, 1]); // length 2 — not a multiple of 3
  const lineMaterial = doc.createMaterial('gizmo');
  const linePrim = doc
    .createPrimitive()
    .setMode(Primitive.Mode.LINES)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(linePositions).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(lineIndices).setBuffer(buffer))
    .setMaterial(lineMaterial);
  doc.getRoot().listScenes()[0].addChild(doc.createNode('gizmo').setMesh(doc.createMesh('gizmo').addPrimitive(linePrim)));

  const { after } = await planarize(doc, { budget: 60 });
  assert.ok(after > 0, 'the real triangle geometry must still come through');

  for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    assert.equal(prim.getMode(), Primitive.Mode.TRIANGLES, 'the LINES primitive must not survive into the output');
  }
});

test('a budget already above the triangle count leaves the mesh alone', async () => {
  const doc = makeSphereDoc({ segments: 6 }); // 6*6*2 = 72 triangles
  const { before, after } = await planarize(doc, { budget: 100_000 });

  assert.equal(before, 72);
  assert.equal(after, before, 'simplify should be skipped, not run backwards');
});

test('vertices are per-face after planarizing a welded mesh', async () => {
  // A closed, welded mesh has roughly half as many vertices as triangles.
  // Flat shading requires every triangle to own its three corners outright, so
  // that ratio should invert.
  const doc = makeSphereDoc({ segments: 24 });
  await planarize(doc, { budget: 200 });

  const tris = triCount(doc);
  const verts = vertCount(doc);
  assert.ok(verts >= tris * 2.5, `expected ~3 verts/triangle (flat), got ${verts} verts for ${tris} tris`);
});
