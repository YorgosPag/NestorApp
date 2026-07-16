/**
 * SPIKE — native PDF tiling patterns via the jsPDF already installed in this repo.
 * Standalone, no build step:  node spike-tiling.mjs
 *
 * Proves (or disproves):
 *  1. define a tiling pattern in advancedAPI(), fill from COMPAT (mm, Y-down)
 *  2. non-axis-aligned polygon + even-odd fill
 *  3. rotated pattern (angle != 0)
 *  4. pattern anchored to a specific world origin
 *  5. two shapes reusing ONE pattern definition (dedup)
 *  6. a pattern cell that embeds a raster image (addImage inside the cell)
 */
import { jsPDF } from './node_modules/jspdf/dist/jspdf.node.js';
import { writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

// ── the app's own doc shape: pdf-assembler.ts:90 ──────────────────────────────
//   new jsPDF({ orientation: paper.orientation, unit: 'mm', format })
// compress:false only so the spike can read the raw content stream.
const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });

const TilingPattern = pdf.TilingPattern ?? jsPDF.API.TilingPattern;
const Matrix = pdf.Matrix ?? pdf.internal.Matrix;

const K = pdf.internal.scaleFactor;          // 72/25.4 for mm
const H_MM = pdf.internal.pageSize.getHeight();   // 210 for A4 landscape
const W_MM = pdf.internal.pageSize.getWidth();    // 297

console.log(`doc: ${W_MM}x${H_MM} mm, scaleFactor=${K}`);

// ── matrix helpers ────────────────────────────────────────────────────────────
// jsPDF row-vector convention: A.multiply(B) === B·A  (apply B first, then A).
// fillWithPattern does: final = flip.multiply(patternData.matrix) === patternData.matrix · flip
// with flip F = Matrix(1,0,0,-1,0,getPageHeight())  [NOTE: mm-valued, see report].
const F = () => new Matrix(1, 0, 0, -1, 0, H_MM);

// mm(Y-down, origin top-left)  ->  PDF default user space (points, Y-up, origin bottom-left)
const T = () => new Matrix(K, 0, 0, -K, 0, H_MM * K);

/**
 * Compute patternData.matrix so that a cell authored in mm/Y-down cell-local (u,v)
 * lands with its origin at page-mm (ax,ay) rotated by `deg` (visual clockwise).
 * We want the PDF /Matrix to end up = A_mm · T  (M_final).
 * jsPDF will compute  patternData.matrix · F, so we pre-multiply by F⁻¹ === F.
 */
function patternMatrixFor(ax, ay, deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  // A_mm: (u,v) -> page-mm, Y-down space
  const A = new Matrix(c, s, -s, c, ax, ay);
  const M_final = T().multiply(A);   // === A · T  (apply A first, then T)
  return F().multiply(M_final);      // === M_final · F ; jsPDF re-applies F -> M_final
}

// ── 1. pattern definition: horizontal stripes, cell authored in mm ────────────
const CELL = 6;            // mm
const stripes = new TilingPattern([0, 0, CELL, CELL], CELL, CELL, null, null);
pdf.advancedAPI(() => {
  pdf.beginTilingPattern(stripes);
  // pattern space == mm here (our M_final carries the K scale).
  pdf.setFillColor(220, 40, 40);
  pdf.rect(0, 0, CELL, CELL / 2, 'F');
  pdf.setFillColor(250, 220, 220);
  pdf.rect(0, CELL / 2, CELL, CELL / 2, 'F');
  pdf.endTilingPattern('stripes', stripes);
});

// ── 2. pattern whose cell embeds a raster image ───────────────────────────────
// tiny 4x4 checker PNG, base64 (generated below via zlib so no external asset).
function makeCheckerPng(n = 8) {
  const px = [];
  for (let y = 0; y < n; y++) {
    const row = [0]; // filter byte
    for (let x = 0; x < n; x++) {
      const on = (x + y) % 2 === 0;
      row.push(on ? 30 : 240, on ? 90 : 240, on ? 200 : 240);
    }
    px.push(Buffer.from(row));
  }
  const raw = zlib.deflateSync(Buffer.concat(px));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', raw), chunk('IEND', Buffer.alloc(0)),
  ]);
  return 'data:image/png;base64,' + png.toString('base64');
}
let CRC_T = null;
function crc32(buf) {
  if (!CRC_T) {
    CRC_T = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_T[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}
const CHECKER = makeCheckerPng(8);

const IMG_CELL = 8; // mm
const photo = new TilingPattern([0, 0, IMG_CELL, IMG_CELL], IMG_CELL, IMG_CELL, null, null);
pdf.advancedAPI(() => {
  pdf.beginTilingPattern(photo);
  // addImage inside the cell works as-is: jsPDF emits its own "1 0 0 -1 0 0 cm"
  // so the bitmap comes out upright inside the BBox. No manual flip needed.
  pdf.addImage(CHECKER, 'PNG', 0, 0, IMG_CELL, IMG_CELL, undefined, 'NONE');
  pdf.endTilingPattern('photo', photo);
});

// ── path helper: build a polygon with ZERO paint op, then pattern-fill ────────
/** pts: [[x,y],...] page-mm. COMPAT mode requires style === null to suppress the op. */
function polygon(pts) {
  const [x0, y0] = pts[0];
  const segs = pts.slice(1).map(([x, y], i) => [x - pts[i][0], y - pts[i][1]]);
  pdf.lines(segs, x0, y0, [1, 1], null, true); // style=null => no paint operator
}

// ── SHAPE A: slanted parallelogram, stripes anchored at world (20,20), 0° ─────
polygon([[20, 30], [90, 20], [110, 80], [40, 90]]);
pdf.fillEvenOdd({
  key: 'stripes',
  matrix: patternMatrixFor(20, 20, 0),
  boundingBox: [0, 0, CELL, CELL], xStep: CELL, yStep: CELL,
});

// ── SHAPE B: same pattern def reused, ROTATED 30°, anchored at (140,20) ───────
polygon([[140, 30], [210, 20], [230, 80], [160, 90]]);
pdf.fillEvenOdd({
  key: 'stripes',
  matrix: patternMatrixFor(140, 20, 30),
  boundingBox: [0, 0, CELL, CELL], xStep: CELL, yStep: CELL,
});

// ── SHAPE C: dedup proof — NO matrix => original pattern id reused, no clone ──
polygon([[20, 110], [80, 105], [90, 160], [30, 170]]);
pdf.fillEvenOdd({ key: 'stripes' });
polygon([[100, 110], [160, 105], [170, 160], [110, 170]]);
pdf.fillEvenOdd({ key: 'stripes' });

// ── SHAPE D: image-cell pattern, anchored (190,110), rotated 15° ─────────────
polygon([[190, 110], [260, 105], [270, 160], [200, 170]]);
pdf.fillEvenOdd({
  key: 'photo',
  matrix: patternMatrixFor(190, 110, 15),
  boundingBox: [0, 0, IMG_CELL, IMG_CELL], xStep: IMG_CELL, yStep: IMG_CELL,
});

// ── output + raw-stream forensics ────────────────────────────────────────────
const buf = Buffer.from(pdf.output('arraybuffer'));
writeFileSync('C:\\Nestor_Pagonis\\spike-out.pdf', buf);
console.log(`wrote spike-out.pdf (${buf.length} bytes)`);

const raw = buf.toString('latin1');
const grep = (re, label) => {
  const m = raw.match(re) || [];
  console.log(`  ${label}: ${m.length} hit(s)${m.length ? ' -> ' + JSON.stringify(m.slice(0, 8)) : ''}`);
  return m;
};
console.log('\n--- operator forensics ---');
grep(/\/Pattern cs/g, '"/Pattern cs"');
grep(/\/P\d+(?:\$\$\d+\$\$)? scn/g, '"scn"');
grep(/\/PatternType 1/g, '/PatternType 1');
grep(/\/Matrix \[[^\]]*\]/g, '/Matrix');
grep(/f\*/g, 'f* (even-odd)');
grep(/\/Pattern *\n? *<</g, 'Pattern resource dict');
grep(/\/XObject/g, '/XObject (image in cell resources)');

// pattern object inventory (dedup evidence)
const ids = [...raw.matchAll(/\/(P\d+)\s+\d+ 0 R/g)].map((m) => m[1]);
console.log('\npattern ids referenced in resource dicts:', [...new Set(ids)]);

// dump the page content stream
const pageStreams = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((m) => m[1]);
const pageCS = pageStreams.find((s) => s.includes('/Pattern cs'));
console.log('\n--- page content stream (pattern parts) ---');
console.log(
  (pageCS || '(NOT FOUND)')
    .split('\n')
    .filter((l) => /Pattern|scn|f\*|re|m$|l$|c$|h$|q|Q|cm/.test(l))
    .slice(0, 60)
    .join('\n'),
);

const cellCS = pageStreams.filter((s) => s !== pageCS && /re|Do/.test(s));
console.log('\n--- pattern cell streams ---');
cellCS.forEach((s, i) => console.log(`[cell ${i}] ${JSON.stringify(s.slice(0, 200))}`));
