/**
 * ADR-884 Φ2στ-γ Γ3 — πυρήνας raster: ακριβής ευκλείδειος distance transform, μορφολογία δίσκου, Otsu, flood fill
 * (4 έναντι 8), ετικέτες, Moore, παχιά γραμμή.
 */

import { DT_FAR, squaredDistanceTransform } from '../distance-transform';
import { floodFillMask, labelComponents } from '../flood-fill';
import { dilate, erode, open } from '../morphology';
import { traceComponentContours, traceOuterContour } from '../moore-contour';
import { grayHistogram, otsuThreshold, rgbaToGray } from '../otsu-threshold';
import { rasterizeSegment } from '../raster-segment';

function grid(cols: number, rows: number, filled: (c: number, r: number) => boolean): Uint8Array {
  const g = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g[r * cols + c] = filled(c, r) ? 1 : 0;
  return g;
}

/** Ψευδοτυχαίο ντετερμινιστικό (LCG) — ίδιο πλέγμα σε κάθε εκτέλεση. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

describe('distance transform (Felzenszwalb)', () => {
  it('ΑΚΡΙΒΗΣ ευκλείδεια — ταυτίζεται με ωμή δύναμη σε τυχαίο πλέγμα', () => {
    const cols = 23, rows = 17, rnd = seeded(7);
    const mask = grid(cols, rows, () => rnd() < 0.06);
    const d2 = squaredDistanceTransform(mask, cols, rows);
    for (let i = 0; i < mask.length; i++) {
      let best = Infinity;
      for (let j = 0; j < mask.length; j++) {
        if (mask[j] !== 1) continue;
        best = Math.min(best, ((i % cols) - (j % cols)) ** 2 + (Math.floor(i / cols) - Math.floor(j / cols)) ** 2);
      }
      expect(d2[i]).toBe(best);
    }
  });

  it('χωρίς πηγή ⇒ «μακριά» παντού (όχι NaN)', () => {
    const d2 = squaredDistanceTransform(new Uint8Array(12), 4, 3);
    for (const v of d2) expect(v).toBeGreaterThanOrEqual(DT_FAR);
  });
});

describe('μορφολογία με δίσκο', () => {
  it('διαστολή ενός pixel κατά 3 = ΔΙΣΚΟΣ (όχι τετράγωνο/ρόμβος)', () => {
    const cols = 11, rows = 11;
    const out = dilate(grid(cols, rows, (c, r) => c === 5 && r === 5), cols, rows, 3);
    expect(out[5 * cols + 8]).toBe(1);   // (3, 0)
    expect(out[7 * cols + 7]).toBe(1);   // (2, 2): √8 ≤ 3
    expect(out[8 * cols + 8]).toBe(0);   // (3, 3): √18 > 3 — τετράγωνο θα το γέμιζε
  });

  it('διαστολή των τοίχων κατά r κλείνει άνοιγμα < 2r ΑΚΟΜΗ ΚΑΙ σε τοίχο 1 pixel — όχι μεγαλύτερο', () => {
    const cols = 40, rows = 12;
    // Τοίχος-γραμμή στη γραμμή 5 με κενό 6 στήλων (c 10–15) και κενό 12 στήλων (c 24–35).
    const wall = grid(cols, rows, (c, r) => r === 5 && !(c >= 10 && c <= 15) && !(c >= 24 && c <= 35));
    const grown = dilate(wall, cols, rows, 4);
    for (let c = 10; c <= 15; c++) expect(grown[5 * cols + c]).toBe(1);
    expect(grown[5 * cols + 30]).toBe(0);
  });

  it('άνοιγμα σβήνει γραμμή 1 px, κρατά τοίχο 6 px · διάβρωση δεν «τρώει» από το κάδρο', () => {
    const cols = 30, rows = 30;
    const ink = grid(cols, rows, (c, r) => r === 3 || (r >= 12 && r <= 17));
    const opened = open(ink, cols, rows, 1.5);
    expect(opened[3 * cols + 15]).toBe(0);
    expect(opened[14 * cols + 15]).toBe(1);
    expect(opened[14 * cols + 0]).toBe(1); // στην άκρη της εικόνας ο τοίχος μένει
    expect(erode(grid(4, 4, () => true), 4, 4, 2).every((v) => v === 1)).toBe(true);
  });
});

describe('Otsu + γκρι', () => {
  it('δύο κλάσεις ⇒ κατώφλι ανάμεσά τους · μονόχρωμη ⇒ -1', () => {
    const histogram = new Array<number>(256).fill(0);
    histogram[40] = 300; histogram[230] = 5000;
    const t = otsuThreshold(histogram);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(230);
    const flat = new Array<number>(256).fill(0); flat[255] = 100;
    expect(otsuThreshold(flat)).toBe(-1);
  });

  it('διάφανο pixel = ΛΕΥΚΟ (χαρτί), όχι μαύρος τοίχος', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]);
    expect(Array.from(rgbaToGray(rgba, 2))).toEqual([255, 0]);
    expect(grayHistogram(new Uint8Array([0, 0, 255]))[0]).toBe(2);
  });
});

describe('flood fill · ετικέτες · Moore · παχιά γραμμή', () => {
  // Διαγώνιος τοίχος πάχους 1 pixel χωρίζει πάνω-αριστερά από κάτω-δεξιά.
  const cols = 8, rows = 8;
  const free = grid(cols, rows, (c, r) => c !== r);

  it('4-γειτονιά ΔΕΝ περνά διαγώνια ραφή· 8-γειτονιά περνά', () => {
    expect(floodFillMask(free, cols, rows, 1, 0, { connectivity: 4 })[1 * cols + 0]).toBe(0);
    expect(floodFillMask(free, cols, rows, 1, 0, { connectivity: 8 })[1 * cols + 0]).toBe(1);
    expect(labelComponents(free, cols, rows, 4).count).toBe(2);
    expect(labelComponents(free, cols, rows, 8).count).toBe(1);
  });

  it('Moore: ορθογώνιο 5×3 ⇒ 12 κελιά ορίου · δύο συνιστώσες ⇒ δύο βρόχοι', () => {
    const rect = grid(10, 10, (c, r) => c >= 2 && c <= 6 && r >= 4 && r <= 6);
    expect(traceOuterContour(rect, 10, 10)).toHaveLength(12);
    const two = grid(10, 10, (c, r) => (c <= 2 && r <= 2) || (c >= 6 && r >= 6));
    expect(traceComponentContours(two, 10, 10)).toHaveLength(2);
  });

  it('λοξή παχιά γραμμή είναι ΣΤΕΓΑΝΗ στην 4-γειτονιά', () => {
    const n = 40;
    const g = grid(n, n, () => true);
    rasterizeSegment(g, n, n, { x: 0, y: 3 }, { x: n, y: 31 }, 0.2, 0);
    const fill = floodFillMask(g, n, n, 0, n - 1, { connectivity: 4 });
    expect(fill[0 * n + n - 1]).toBe(0);
  });
});
