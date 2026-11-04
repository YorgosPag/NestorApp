/**
 * ADR-929 Φ1 — οι νέοι αλγόριθμοι raster: εικόνες ολοκληρώματος, Sauvola / Wolf–Jolion, κανονικοποίηση φόντου,
 * αναδειγμάτιση, κλίση, μακριές διαδρομές, κηλίδες. Κάθε ένας ελέγχεται απέναντι σε **ακριβή** αλήθεια (ωμή δύναμη ή
 * γνωστή γεωμετρία), όχι απέναντι στον εαυτό του.
 */

import { describe, expect, it } from '@jest/globals';

import { homographyFromAffine } from '../../homography';
import { adaptiveInkMask, DEFAULT_SAUVOLA, DEFAULT_WOLF } from '../adaptive-threshold';
import { estimateBackground, normalizeBackground } from '../background-normalize';
import { componentStats, removeSmallComponents } from '../component-stats';
import { integralImages, windowStats } from '../integral-image';
import { histogramPercentile, rgbaToGray } from '../otsu-threshold';
import { blankPlanRaster, type PlanRaster } from '../plan-raster';
import { downscaleArea, warpHomography } from '../raster-warp';
import { longLines, longRuns } from '../run-length-filter';
import { estimateSkew } from '../skew-estimate';

function seeded(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

/** Μάσκα με ευθείες γωνίας `deg` (raster-px, +x → +y): οριζόντιες και κατακόρυφες μιας «κάτοψης». */
function rotatedGridMask(cols: number, rows: number, deg: number): Uint8Array {
  const mask = new Uint8Array(cols * rows);
  const t = (deg * Math.PI) / 180;
  const cx = cols / 2;
  const cy = rows / 2;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const u = dx * Math.cos(t) + dy * Math.sin(t);
      const v = -dx * Math.sin(t) + dy * Math.cos(t);
      const onH = Math.abs(((v % 60) + 60) % 60 - 30) < 1.5 && Math.abs(u) < cols * 0.35;
      const onV = Math.abs(((u % 80) + 80) % 80 - 40) < 1.5 && Math.abs(v) < rows * 0.35;
      mask[y * cols + x] = onH || onV ? 1 : 0;
    }
  }
  return mask;
}

describe('integral images', () => {
  it('μέσος και διακύμανση = ωμή δύναμη, και στα κομμένα παράθυρα της άκρης', () => {
    const cols = 17, rows = 11, rnd = seeded(5);
    const gray = Uint8Array.from({ length: cols * rows }, () => Math.floor(rnd() * 256));
    const ii = integralImages(gray, cols, rows);
    for (const [x0, y0, x1, y1] of [[0, 0, 17, 11], [3, 2, 9, 7], [-4, -4, 3, 3], [14, 8, 30, 30]]) {
      const vals: number[] = [];
      for (let y = Math.max(0, y0); y < Math.min(rows, y1); y++) for (let x = Math.max(0, x0); x < Math.min(cols, x1); x++) vals.push(gray[y * cols + x]);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
      const s = windowStats(ii, x0, y0, x1, y1);
      expect(s.count).toBe(vals.length);
      expect(s.mean).toBeCloseTo(mean, 9);
      expect(s.variance).toBeCloseTo(variance, 6);
    }
  });
});

describe('adaptive threshold', () => {
  /**
   * Χαρτί με κλίση φωτισμού 255 → 120 και λεπτή γραμμή 70 μονάδες πιο σκούρα: η γραμμή στη φωτεινή άκρη (185) είναι
   * **φωτεινότερη** από το χαρτί της σκοτεινής (120), άρα κανένα ολικό κατώφλι δεν τα χωρίζει.
   * 📏 Μετρημένο όριο του Sauvola: με `k = 0,2` χρειάζεται κοντράστ ≳ `k · m` (≈ 47 σε λευκό χαρτί). Γραμμή μόλις 40
   *   πιο σκούρα από λευκό βγήκε στο 65% του μήκους της. Το ξεθωριασμένο μολύβι κάτω από αυτό το όριο είναι υπόθεση της
   *   ρύθμισης του `k` στο χρυσό σύνολο (ADR-929 §6.2), όχι αυτού του test.
   */
  function shadedLine(): { gray: Uint8Array; cols: number; rows: number; line: (x: number, y: number) => boolean } {
    const cols = 200, rows = 60;
    const line = (_x: number, y: number) => y >= 29 && y <= 30;
    const gray = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) gray[y * cols + x] = Math.round(255 - (135 * x) / cols) - (line(x, y) ? 70 : 0);
    return { gray, cols, rows, line };
  }

  function measure(options: typeof DEFAULT_SAUVOLA): { readonly recall: number; readonly falseRate: number } {
    const { gray, cols, rows, line } = shadedLine();
    const ink = adaptiveInkMask(gray, cols, rows, options);
    let hit = 0, lines = 0, falsePx = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (line(x, y)) { lines++; hit += ink[y * cols + x]; } else falsePx += ink[y * cols + x];
      }
    }
    return { recall: hit / lines, falseRate: falsePx / (cols * rows - lines) };
  }

  it('Sauvola: η γραμμή βγαίνει σε όλο το μήκος, το σκιασμένο χαρτί καθόλου', () => {
    const { recall, falseRate } = measure(DEFAULT_SAUVOLA);
    expect(recall).toBeGreaterThan(0.98);
    expect(falseRate).toBe(0);
  });

  /**
   * Μετρημένο: το Wolf–Jolion σε **ωμή** κλίση φωτισμού 255 → 120 δίνει λίγα ψευδή pixel (το ολικό ελάχιστο `M` το
   * τραβά προς τα κάτω στη σκοτεινή άκρη), ενώ το Sauvola μηδέν. Γι' αυτό ο αγωγός κάνει **πρώτα** flat-field και
   * χρησιμοποιεί Sauvola (ADR-929 §6.2). Το Wolf μένει διαθέσιμο για χαμηλό κοντράστ.
   */
  it('Wolf: η γραμμή βγαίνει, με ψευδή < 0,5% σε ωμή κλίση φωτισμού', () => {
    const { recall, falseRate } = measure(DEFAULT_WOLF);
    expect(recall).toBeGreaterThan(0.98);
    expect(falseRate).toBeLessThan(0.005);
  });

  it('επίπεδο χαρτί με θόρυβο ⇒ κανένα μελάνι (Sauvola)', () => {
    const rnd = seeded(9);
    const gray = Uint8Array.from({ length: 80 * 80 }, () => 230 + Math.floor(rnd() * 25));
    expect(adaptiveInkMask(gray, 80, 80, DEFAULT_SAUVOLA).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('background normalize', () => {
  it('κιτρινισμένο χαρτί με σκιά ⇒ ουδέτερο λευκό· το μελάνι μένει σκούρο', () => {
    const w = 256, h = 192;
    const src = blankPlanRaster(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const shade = 1 - 0.35 * (x / w);
        const ink = (x % 64 < 3) || (y % 48 < 3);
        const o = (y * w + x) * 4;
        const paper = [238, 226, 178];
        for (let c = 0; c < 3; c++) src.rgba[o + c] = (ink ? 30 : paper[c]) * shade;
      }
    }
    const out = normalizeBackground(src, { tilePx: 32, percentile: 0.9, invalidBelow: 0.6 });
    const at = (x: number, y: number) => [0, 1, 2].map((c) => out.rgba[(y * w + x) * 4 + c]);
    for (const [x, y] of [[20, 20], [200, 150], [140, 100]]) {
      const [r, g, b] = at(x, y);
      expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(245);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(6);
    }
    expect(Math.max(...at(1, 100))).toBeLessThan(80);
    expect(estimateBackground(src).gx).toBe(4);
  });

  it('γεμάτο πλακίδιο μελανιού (poché) ΔΕΝ λευκαίνει — γεμίζεται από τους γείτονες', () => {
    const w = 192, h = 192;
    const src = blankPlanRaster(w, h);
    for (let y = 64; y < 128; y++) for (let x = 64; x < 128; x++) for (let c = 0; c < 3; c++) src.rgba[(y * w + x) * 4 + c] = 25;
    const out = normalizeBackground(src, { tilePx: 64, percentile: 0.9, invalidBelow: 0.6 });
    expect(out.rgba[(96 * w + 96) * 4]).toBeLessThan(40);
  });
});

describe('raster warp', () => {
  it('μείωση ×4 = μέσος περιοχής· η απεικόνιση πηγή = 4 · έξοδος είναι ακριβής', () => {
    const src = blankPlanRaster(10, 6);
    for (let i = 0; i < 4; i++) src.rgba[i] = 0; // pixel (0,0) μαύρο, άλφα 0
    src.rgba[3] = 255;
    const out = downscaleArea(src, 4);
    expect([out.width, out.height]).toEqual([3, 2]);
    expect(out.rgba[0]).toBe(Math.round((255 * 15) / 16));
    // Τελευταία στήλη: 2 pixel πλάτος — μέσος μόνο όσων υπάρχουν.
    expect(out.rgba[(0 * 3 + 2) * 4]).toBe(255);
  });

  it('ταυτότητα ⇒ ίδια εικόνα· μετατόπιση κατά ακέραιο ⇒ ακριβής μετατόπιση, έξω λευκό', () => {
    const rnd = seeded(2);
    const src: PlanRaster = { rgba: Uint8ClampedArray.from({ length: 12 * 9 * 4 }, (_, i) => (i % 4 === 3 ? 255 : Math.floor(rnd() * 256))), width: 12, height: 9 };
    const same = warpHomography(src, homographyFromAffine({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), 12, 9);
    expect(Array.from(same.rgba)).toEqual(Array.from(src.rgba));
    const shifted = warpHomography(src, homographyFromAffine({ a: 1, b: 0, c: 0, d: 1, e: 3, f: 2 }), 12, 9);
    expect(shifted.rgba[(0 * 12 + 0) * 4]).toBe(src.rgba[(2 * 12 + 3) * 4]);
    expect(shifted.rgba[(8 * 12 + 11) * 4]).toBe(255);
  });
});

describe('skew estimate', () => {
  it.each([0, 0.7, -2.3, 4.9, -11.2])('ανακτά γωνία %p° με σφάλμα < 0,05°', (deg) => {
    const est = estimateSkew(rotatedGridMask(400, 300, deg), 400, 300);
    expect(Math.abs(est.angleDeg - deg)).toBeLessThan(0.05);
    expect(est.confidence).toBeGreaterThan(0.5);
  });

  it('θόρυβος χωρίς ευθείες ⇒ χαμηλή βεβαιότητα (ο καλών δεν ισιώνει τυφλά)', () => {
    const rnd = seeded(11);
    const mask = Uint8Array.from({ length: 300 * 300 }, () => (rnd() < 0.05 ? 1 : 0));
    expect(estimateSkew(mask, 300, 300).confidence).toBeLessThan(0.2);
  });

  it('κενή μάσκα ⇒ 0°, βεβαιότητα 0', () => {
    expect(estimateSkew(new Uint8Array(100), 10, 10)).toEqual({ angleDeg: 0, confidence: 0, sampleCount: 0 });
  });
});

describe('run-length filter + components', () => {
  it('κρατά μόνο διαδρομές ≥ L, στους δύο άξονες', () => {
    const cols = 20, rows = 10;
    const mask = new Uint8Array(cols * rows);
    for (let x = 2; x < 17; x++) mask[3 * cols + x] = 1; // 15 οριζόντια
    for (let x = 2; x < 6; x++) mask[6 * cols + x] = 1; // 4 οριζόντια
    for (let y = 0; y < 9; y++) mask[y * cols + 18] = 1; // 9 κατακόρυφα
    const h = longRuns(mask, cols, rows, 'horizontal', 10);
    expect(h.reduce((a, b) => a + b, 0)).toBe(15);
    const both = longLines(mask, cols, rows, 8);
    expect(both.reduce((a, b) => a + b, 0)).toBe(15 + 9);
  });

  it('removeSmallComponents σβήνει κουκκίδες, κρατά τη γραμμή· πλαίσια σωστά', () => {
    const cols = 12, rows = 8;
    const mask = new Uint8Array(cols * rows);
    mask[1 * cols + 1] = 1;
    for (let x = 3; x < 11; x++) mask[5 * cols + x] = 1;
    const out = removeSmallComponents(mask, cols, rows, 3);
    expect(out[1 * cols + 1]).toBe(0);
    expect(out.reduce((a, b) => a + b, 0)).toBe(8);
    const stats = componentStats(mask, cols, rows, 8);
    expect(stats.count).toBe(2);
    expect(stats.boxes[2]).toEqual({ minX: 3, minY: 5, maxX: 10, maxY: 5 });
  });
});

describe('histogramPercentile (το ΕΝΑ εκατοστημόριο: πλακίδια, λευκό σημείο, χρώμα χαρτιού)', () => {
  it('διάμεσος, άκρα, εύρος από `from`, μετατόπιση μέσα σε μεγαλύτερο buffer, άδειο ⇒ null', () => {
    const h = new Uint32Array(512);
    h[10] = 1; h[20] = 2; h[250] = 1;
    expect(histogramPercentile(h, 0.5)).toBe(20);
    expect(histogramPercentile(h, 1)).toBe(250);
    expect(histogramPercentile(h, 0.5, 200)).toBe(250);
    h[256 + 7] = 3;
    expect(histogramPercentile(h, 0.9, 0, 256)).toBe(7);
    expect(histogramPercentile(new Uint32Array(256), 0.5)).toBeNull();
    expect(rgbaToGray(new Uint8ClampedArray([255, 255, 255, 255]), 1)[0]).toBe(255);
  });
});
