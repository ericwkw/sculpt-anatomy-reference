/**
 * Generate the studio lighting environment: public/studio.hdr
 *
 *   node scripts/make-studio-hdr.mjs
 *
 * model-viewer's built-in environment lights evenly from all directions, which
 * erases the shadow terminator — muscle masses flatten into a white blob. Form
 * reads through a dominant raking key with weak fill, the way a sculptor lights
 * a maquette, so this writes a small equirectangular HDR holding exactly that.
 *
 * It is a light source, not a backdrop, so 256x128 is plenty. HDR rather than
 * PNG because values above 1.0 are what make the key read as a key.
 */
import fs from 'node:fs';

const WIDTH = 256;
const HEIGHT = 128;

const norm = ([x, y, z]) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};

// Intensity falls off as dot(direction, lightDir) ^ focus — higher focus is a
// tighter source and a harder shadow edge.
const LIGHTS = [
  { dir: norm([-0.55, 0.75, 0.6]), colour: [1, 0.97, 0.92], intensity: 14, focus: 9 },
  { dir: norm([0.85, 0.1, 0.35]), colour: [0.82, 0.86, 1], intensity: 3.4, focus: 5 },
  { dir: norm([0.1, -0.2, -1]), colour: [1, 0.95, 0.9], intensity: 3.2, focus: 16 },
];

// Keeps shadow cores from going fully black; a touch of sky/ground separation
// helps read which way a surface turns.
const AMBIENT_SKY = [0.055, 0.06, 0.075];
const AMBIENT_GROUND = [0.03, 0.028, 0.025];

function radianceAt(dx, dy, dz) {
  const t = (dy + 1) / 2;
  const rgb = [0, 1, 2].map((i) => AMBIENT_GROUND[i] + (AMBIENT_SKY[i] - AMBIENT_GROUND[i]) * t);
  for (const light of LIGHTS) {
    const d = dx * light.dir[0] + dy * light.dir[1] + dz * light.dir[2];
    if (d <= 0) continue;
    const falloff = Math.pow(d, light.focus) * light.intensity;
    for (let i = 0; i < 3; i++) rgb[i] += light.colour[i] * falloff;
  }
  return rgb;
}

/** Radiance RGBE: a shared exponent byte keeps the whole image in 4 bytes/pixel. */
function encodeRgbe(r, g, b) {
  const peak = Math.max(r, g, b);
  if (peak < 1e-32) return [0, 0, 0, 0];
  let exponent = Math.ceil(Math.log2(peak));
  const scale = 256 / Math.pow(2, exponent);
  return [
    Math.min(255, Math.floor(r * scale)),
    Math.min(255, Math.floor(g * scale)),
    Math.min(255, Math.floor(b * scale)),
    exponent + 128,
  ];
}

const header = Buffer.from(
  `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${HEIGHT} +X ${WIDTH}\n`,
  'ascii'
);
const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);

let offset = 0;
for (let y = 0; y < HEIGHT; y++) {
  const theta = ((y + 0.5) / HEIGHT) * Math.PI;
  for (let x = 0; x < WIDTH; x++) {
    const phi = ((x + 0.5) / WIDTH) * 2 * Math.PI - Math.PI;
    const dy = Math.cos(theta);
    const dx = Math.sin(theta) * Math.sin(phi);
    const dz = Math.sin(theta) * Math.cos(phi);
    const [r, g, b] = radianceAt(dx, dy, dz);
    const rgbe = encodeRgbe(r, g, b);
    for (let i = 0; i < 4; i++) pixels[offset++] = rgbe[i];
  }
}

const out = new URL('../public/studio.hdr', import.meta.url);
fs.writeFileSync(out, Buffer.concat([header, pixels]));
console.log(`Wrote public/studio.hdr — ${WIDTH}x${HEIGHT}, ${(header.length + pixels.length) / 1024 | 0} KB`);
