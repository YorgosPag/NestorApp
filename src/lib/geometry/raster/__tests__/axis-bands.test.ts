/**
 * Ζώνες αξόνων και λοξές ζώνες (ADR-929 Φ2): κέντρο/πάχος υπο-pixel, διάσπαση σε άνοιγμα, όχι «συνέχεια» από κοντή
 * κάθετη διαδρομή, παρειά γεμίσματος μόνο όπου βλέπει χαρτί, λοξή διεύθυνση μέσω της ίδιας μηχανής.
 */

import { describe, expect, it } from '@jest/globals';
import { axisBands, bandEdgeExposure, DEFAULT_AXIS_BANDS, eraseBands, strokeExtent } from '../axis-bands';
import { bandsAtAngle, dominantObliqueDirection } from '../oblique-bands';
import { rasterizeSegment } from '../raster-segment';

const W = 200;
const H = 160;
const blank = () => new Uint8Array(W * H);
const fill = (m: Uint8Array, x0: number, y0: number, x1: number, y1: number) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = 1;
};
const O = { ...DEFAULT_AXIS_BANDS, minLength: 8 };

describe('axisBands', () => {
  it('οριζόντια ζώνη 3 px: κέντρο, πάχος, άκρα, πλήρωση', () => {
    const m = blank();
    fill(m, 20, 40, 180, 43);
    const [b] = axisBands(m, W, H, 'horizontal', O);
    expect(b).toMatchObject({ center: 41.5, thickness: 3, start: 20, end: 180, fill: 1, lines: 3 });
  });

  it('η κοντή διαδρομή ενός κάθετου τοίχου κάτω από τον οριζόντιο ΔΕΝ τον συνεχίζει', () => {
    const m = blank();
    fill(m, 20, 20, 180, 35); // οριζόντιος τοίχος 15 px
    fill(m, 20, 35, 35, 150); // κάθετος από κάτω (διαδρομές 15 px)
    const long = axisBands(m, W, H, 'horizontal', O).filter((b) => b.end - b.start >= b.thickness);
    expect(long).toHaveLength(1);
    expect(long[0].thickness).toBeCloseTo(15, 6);
  });

  it('άνοιγμα σε όλες τις γραμμές ⇒ δύο ζώνες · σπάσιμο θορύβου σε μία γραμμή ⇒ μία', () => {
    const m = blank();
    fill(m, 20, 40, 80, 43);
    fill(m, 110, 40, 180, 43);
    expect(axisBands(m, W, H, 'horizontal', O)).toHaveLength(2);
    const n = blank();
    fill(n, 20, 40, 180, 43);
    n[41 * W + 100] = 0;
    expect(axisBands(n, W, H, 'horizontal', O)).toHaveLength(1);
  });

  it('παρειά γεμίσματος: μόνο όπου απέξω είναι χαρτί (Τ τη διακόπτει)', () => {
    const m = blank();
    fill(m, 20, 20, 180, 35);
    fill(m, 95, 35, 105, 150); // κάθετος τοίχος σε Τ από κάτω
    const [wall] = axisBands(m, W, H, 'horizontal', O).filter((b) => b.thickness > 10);
    expect(bandEdgeExposure(m, W, H, wall, -1, 8, 2)).toEqual([{ start: 20, end: 180 }]);
    const below = bandEdgeExposure(m, W, H, wall, 1, 8, 2);
    expect(below).toHaveLength(2);
    expect(below[0].end).toBeLessThanOrEqual(96);
    expect(below[1].start).toBeGreaterThanOrEqual(104);
  });

  it('eraseBands σβήνει το αποτύπωμα (με περιθώριο)', () => {
    const m = blank();
    fill(m, 20, 40, 180, 43);
    eraseBands(m, W, H, axisBands(m, W, H, 'horizontal', O), 1);
    expect(m.every((v) => v === 0)).toBe(true);
  });
});

describe('strokeExtent — άκρα πινελιάς από το συνεχές μελάνι (ADR-929 §6.3 #6)', () => {
  it('πινελιά 2 γραμμών με μερική γραμμή: ο διάμεσος (= μέσος όρος) είναι λειψός, η έκταση όχι', () => {
    const m = blank();
    fill(m, 20, 40, 180, 41); // η συμπαγής γραμμή
    fill(m, 32, 41, 180, 42); // η μερική: σπασμένη κοντά στο άκρο, όπως μετά το ίσιωμα
    const [b] = axisBands(m, W, H, 'horizontal', O);
    expect(b.start).toBe(26);
    expect(strokeExtent(m, W, H, b)).toEqual({ start: 20, end: 180 });
  });

  it('κουκκίδα θορύβου ΧΩΡΙΣ συνέχεια με το άκρο δεν το μετακινεί · ποτέ δεν μικραίνει', () => {
    const m = blank();
    fill(m, 20, 40, 180, 42);
    m[40 * W + 16] = 1;
    const [b] = axisBands(m, W, H, 'horizontal', O);
    expect(strokeExtent(m, W, H, b)).toEqual({ start: b.start, end: b.end });
  });

  it('ζώνη από υπόλοιπο μελάνι: πάνω στο πλήρες συνεχίζει ως extendPx πέρα από την περιβάλλουσα', () => {
    const full = blank();
    fill(full, 20, 40, 180, 42);
    const rest = Uint8Array.from(full);
    for (let y = 40; y < 42; y++) for (let x = 20; x < 30; x++) rest[y * W + x] = 0;
    const [b] = axisBands(rest, W, H, 'horizontal', O);
    expect(b.start).toBe(30);
    expect(strokeExtent(full, W, H, b).start).toBe(30);
    expect(strokeExtent(full, W, H, b, 4).start).toBe(26);
    expect(strokeExtent(full, W, H, b, 12).start).toBe(20);
  });
});

describe('λοξές ζώνες', () => {
  it('γραμμή 30°: η διεύθυνση βρίσκεται και η ίδια μηχανή δίνει πάχος ~πινελιάς', () => {
    const m = blank();
    const t = (30 * Math.PI) / 180;
    rasterizeSegment(m, W, H, { x: 30, y: 30 }, { x: 30 + 140 * Math.cos(t), y: 30 + 140 * Math.sin(t) }, 1, 1);
    const dir = dominantObliqueDirection(m, W, H, 5);
    expect(Math.abs(dir.angleDeg - 30)).toBeLessThan(0.5);
    const rb = bandsAtAngle(m, W, H, dir.angleDeg, O);
    const lines = rb.bands.filter((b) => b.end - b.start >= b.thickness);
    expect(lines).toHaveLength(1);
    expect(lines[0].end - lines[0].start).toBeGreaterThan(120);
    expect(lines[0].thickness).toBeLessThan(4);
  });
});
