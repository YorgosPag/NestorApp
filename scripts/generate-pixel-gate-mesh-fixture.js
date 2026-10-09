#!/usr/bin/env node
/**
 * ADR-909 Γ1β — τα **σχήματα δοκιμής** της πύλης pixels (CHECK 3.101), παραγόμενα και ντετερμινιστικά.
 *
 * Η σελίδα της πύλης τρέχει χωρίς σύνδεση, και το Storage δίνει τα `.glb` μόνο σε συνδεδεμένο: χωρίς δικά της
 * αρχεία, έπιπλο / είδος υγιεινής / εισαγόμενο πλέγμα θα έβγαιναν ΠΑΝΤΑ κουτί-εφεδρεία και η πύλη θα έκρινε το
 * κουτί. Τα αρχεία γράφονται εδώ, με το χέρι, ως glTF 2.0 binary:
 *
 *  - δικό μας σχήμα ⇒ **καμία άδεια τρίτου** (πρακτική Khronos: αρχεία φτιαγμένα για δοκιμή, όχι μοντέλα βιτρίνας)·
 *  - ίδια bytes σε κάθε εκτέλεση ⇒ το `--check` αποδεικνύει ότι τα δεσμευμένα αρχεία είναι αυτά που γράφει ο κώδικας·
 *  - σχήμα **Γ**, όχι ορθογώνιο ⇒ η σιλουέτα **διαφέρει** από το κουτί-εφεδρεία: αν η πύλη δει κουτί, φαίνεται.
 *
 * Δύο αρχεία:
 *  - `pixel-gate-shape.glb`  — ένα αντικείμενο (έπιπλο / είδος υγιεινής: `assetId` ⇒ ολόκληρο το αρχείο).
 *  - `pixel-gate-bundle.glb` — δύο κόμβοι (εισαγόμενο πλέγμα: `<uploadId>#<nodeName>`):
 *      `PixelGateSolid`   ένα υλικό ⇒ δρόμος περιγράμματος + ακριβής ένωση στον worker·
 *      `PixelGateTwoTone` δύο υλικά + `extras.faceKeyByMaterialIndex` ⇒ poché ανά υλικό.
 *
 * Χρήση: `node scripts/generate-pixel-gate-mesh-fixture.js` (γράφει) · `… --check` (συγκρίνει, exit 1 αν διαφέρουν).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'test-fixtures', 'pixel-gate');

/** Κουτί [x0..x1]×[y0..y1]×[z0..z1] (m, Y-up) με 24 κορυφές: κάθε έδρα έχει τη δική της κάθετο. */
function box(x0, y0, z0, x1, y1, z1) {
  const faces = [
    { n: [0, 1, 0], v: [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]] },
    { n: [0, -1, 0], v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { n: [1, 0, 0], v: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
    { n: [-1, 0, 0], v: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]] },
    { n: [0, 0, 1], v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
    { n: [0, 0, -1], v: [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]] },
  ];
  const positions = [];
  const normals = [];
  const indices = [];
  faces.forEach((face, f) => {
    face.v.forEach((p) => { positions.push(...p); normals.push(...face.n); });
    const o = f * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  return { positions, normals, indices };
}

/** Ενώνει κουτιά σε ΕΝΑ primitive (οι δείκτες μετατοπίζονται). */
function merge(parts) {
  const out = { positions: [], normals: [], indices: [] };
  for (const part of parts) {
    const offset = out.positions.length / 3;
    out.positions.push(...part.positions);
    out.normals.push(...part.normals);
    out.indices.push(...part.indices.map((i) => i + offset));
  }
  return out;
}

/** Σχήμα Γ 1,6 × 1,6 m, ύψος 0,6 m. */
const L_SHAPE = merge([box(0, 0, 0, 1.6, 0.6, 0.8), box(0, 0, 0.8, 0.8, 0.6, 1.6)]);
/** Βάση 1,6 × 1,6 × 0,2 m και, πάνω της, κάθισμα σχήματος Γ ύψους 0,4 m — δύο υλικά. */
const TWO_TONE_BASE = box(0, 0, 0, 1.6, 0.2, 1.6);
const TWO_TONE_SEAT = merge([box(0.2, 0.2, 0.2, 1.4, 0.6, 0.8), box(0.2, 0.2, 0.8, 0.8, 0.6, 1.4)]);

const pad4 = (n) => (4 - (n % 4)) % 4;

/** Χτίζει ένα GLB από λίστα κόμβων `{ name, extras?, primitives: [{ geometry, material }] }`. */
function buildGlb(nodes) {
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  const materials = [];
  let byteLength = 0;

  const materialIndex = (name) => {
    const at = materials.findIndex((m) => m.name === name);
    if (at >= 0) return at;
    materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [0.6, 0.6, 0.6, 1], metallicFactor: 0, roughnessFactor: 1 } });
    return materials.length - 1;
  };

  const push = (typed, target, accessor) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target });
    chunks.push(bytes, Buffer.alloc(pad4(bytes.length)));
    byteLength += bytes.length + pad4(bytes.length);
    accessors.push({ bufferView: bufferViews.length - 1, ...accessor });
    return accessors.length - 1;
  };

  const bounds = (positions) => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let a = 0; a < 3; a += 1) {
        min[a] = Math.min(min[a], positions[i + a]);
        max[a] = Math.max(max[a], positions[i + a]);
      }
    }
    return { min, max };
  };

  const meshes = nodes.map((node) => ({
    name: node.name,
    primitives: node.primitives.map(({ geometry, material }) => {
      const count = geometry.positions.length / 3;
      const position = push(new Float32Array(geometry.positions), 34962, {
        componentType: 5126, count, type: 'VEC3', ...bounds(geometry.positions),
      });
      const normal = push(new Float32Array(geometry.normals), 34962, { componentType: 5126, count, type: 'VEC3' });
      const index = push(new Uint16Array(geometry.indices), 34963, {
        componentType: 5123, count: geometry.indices.length, type: 'SCALAR',
      });
      return { attributes: { POSITION: position, NORMAL: normal }, indices: index, material: materialIndex(material) };
    }),
  }));

  const json = {
    asset: { version: '2.0', generator: 'nestor pixel-gate fixture (ADR-909)' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes: nodes.map((node, i) => ({ name: node.name, mesh: i, ...(node.extras ? { extras: node.extras } : {}) })),
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength }],
  };

  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(pad4(jsonBytes.length), 0x20)]);
  const binChunk = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const chunkHeader = (length, type) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(length, 0);
    h.writeUInt32LE(type, 4);
    return h;
  };
  return Buffer.concat([header, chunkHeader(jsonChunk.length, 0x4e4f534a), jsonChunk, chunkHeader(binChunk.length, 0x004e4942), binChunk]);
}

/** Τα αρχεία της πύλης: όνομα → bytes. Εξάγεται ώστε ένα test να μπορεί να ελέγξει τη φρεσκάδα. */
function buildPixelGateMeshFixtures() {
  return {
    'pixel-gate-shape.glb': buildGlb([
      { name: 'PixelGateShape', primitives: [{ geometry: L_SHAPE, material: 'PixelGateSteel' }] },
    ]),
    'pixel-gate-bundle.glb': buildGlb([
      { name: 'PixelGateSolid', primitives: [{ geometry: L_SHAPE, material: 'PixelGateSteel' }] },
      {
        name: 'PixelGateTwoTone',
        extras: { faceKeyByMaterialIndex: ['slot:PixelGateBase', 'slot:PixelGateSeat'] },
        primitives: [
          { geometry: TWO_TONE_BASE, material: 'PixelGateBase' },
          { geometry: TWO_TONE_SEAT, material: 'PixelGateSeat' },
        ],
      },
    ]),
  };
}

function main() {
  const check = process.argv.includes('--check');
  const fixtures = buildPixelGateMeshFixtures();
  let stale = false;
  if (!check) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, bytes] of Object.entries(fixtures)) {
    const file = path.join(OUT_DIR, name);
    if (check) {
      const fresh = fs.existsSync(file) && fs.readFileSync(file).equals(bytes);
      if (!fresh) stale = true;
      console.log(`${fresh ? 'ok   ' : 'STALE'} ${name} (${bytes.length} bytes)`);
    } else {
      fs.writeFileSync(file, bytes);
      console.log(`wrote ${name} (${bytes.length} bytes)`);
    }
  }
  if (stale) {
    console.error('pixel-gate mesh fixtures are stale — run: node scripts/generate-pixel-gate-mesh-fixture.js');
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { buildPixelGateMeshFixtures };
