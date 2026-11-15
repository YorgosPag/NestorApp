/**
 * ⚓ ADR-929 §6.21.4 — **πάχος πινελιάς από την κάλυψη του γκρι**: ίδιο σε κάθε φάση εξομάλυνσης.
 *
 * Οι εικόνες εδώ είναι **αναλυτικές**: κάθε pixel = η ακριβής κάλυψή του από μια λωρίδα πάχους `w` (μοντέλο μερικής
 * επιφάνειας, η εξομάλυνση «κουτιού» του Skia/Chrome). Η δυαδική μάσκα της ίδιας λωρίδας δίνει 1 ή 2 px ανάλογα με τη
 * φάση (μετρημένο στο ΤΕΣΤ2: 1,13 px ⇒ 1 στο Chrome, 2 στο Node)· η κάλυψη πρέπει να δίνει `w`.
 */

import { describe, expect, it } from '@jest/globals';
import { coverageWidth, inkLevels, type CoverageRaster } from '../coverage-width';

const SIZE = 64;
const PAPER = 255;

/** Κάλυψη του κελιού `[i, i + 1)` από το διάστημα `[lo, hi]`. */
const overlap = (i: number, lo: number, hi: number): number => Math.max(0, Math.min(i + 1, hi) - Math.max(i, lo));

/**
 * Οριζόντια λωρίδα πάχους `width` με κέντρο `centre` (y), σε όλο το πλάτος: σκοτεινότητα + μάσκα (κατώφλι ½). Μαζί ένα
 * γεμάτο τετράγωνο 6×6 στη γωνία (γράμμα, βέλος): κάθε πραγματικό σχέδιο έχει **και** πλήρως μελανωμένα pixel, από τα
 * οποία μετριέται η στάθμη του μελανιού.
 */
function horizontalStroke(centre: number, width: number, ink = 0): { gray: Uint8Array; ink: Uint8Array } {
  const gray = new Uint8Array(SIZE * SIZE).fill(PAPER);
  const mask = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const c = overlap(y, centre - width / 2, centre + width / 2);
    for (let x = 0; x < SIZE; x++) {
      gray[y * SIZE + x] = Math.round(PAPER - c * (PAPER - ink));
      mask[y * SIZE + x] = c >= 0.5 ? 1 : 0;
    }
  }
  for (let y = 56; y < 62; y++) for (let x = 56; x < 62; x++) { gray[y * SIZE + x] = ink; mask[y * SIZE + x] = 1; }
  return { gray, ink: mask };
}

function rasterOf(img: { gray: Uint8Array; ink: Uint8Array }): CoverageRaster {
  return { gray: img.gray, cols: SIZE, rows: SIZE, levels: inkLevels(img.gray, img.ink) };
}

/** Το πάχος της λωρίδας στη μάσκα (γραμμές με μελάνι στη στήλη 32): αυτό που έβλεπε ο παλιός εκτιμητής. */
function maskRows(img: { ink: Uint8Array }): number {
  let rows = 0;
  for (let y = 0; y < SIZE; y++) rows += img.ink[y * SIZE + 32];
  return rows;
}

const PHASES = [0, 0.25, 0.5, 0.75] as const;

describe('coverageWidth — ανεξάρτητο από τη φάση', () => {
  it.each([0.57, 1, 1.13, 2.36, 4.72])('λωρίδα %f px: ίδιο πάχος σε κάθε φάση (±0,02), ενώ η μάσκα αλλάζει', (width) => {
    const measured = PHASES.map((phase) => {
      const img = horizontalStroke(20 + phase, width);
      const thickness = Math.max(1, maskRows(img));
      return coverageWidth(rasterOf(img), { x: 4, y: 20 + phase }, { x: 60, y: 20 + phase }, thickness);
    });
    for (const w of measured) expect(w).toBeCloseTo(width, 1);
    expect(Math.max(...measured) - Math.min(...measured)).toBeLessThan(0.02);
  });

  it('η αστοχία του ΤΕΣΤ2: 1,13 px δίνει μάσκα 1 ή 2 px ανάλογα με τη φάση, η κάλυψη 1,13 και στις δύο', () => {
    const masks = PHASES.map((phase) => maskRows(horizontalStroke(20 + phase, 1.13)));
    expect(new Set(masks)).toEqual(new Set([1, 2]));
  });

  it('σκουρότερη αναφορά μελανιού (θόρυβος): όλα τα πάχη με τον ΙΔΙΟ συντελεστή — ο λόγος μένει', () => {
    const img = horizontalStroke(20.5, 1.13, 40);
    for (let y = 40; y < 46; y++) for (let x = 4; x < 60; x++) img.gray[y * SIZE + x] = Math.round(PAPER - (PAPER - 40) * overlap(y, 42.4, 44.4));
    for (let y = 40; y < 46; y++) for (let x = 4; x < 60; x++) img.ink[y * SIZE + x] = overlap(y, 42.4, 44.4) >= 0.5 ? 1 : 0;
    const exact = rasterOf(img);
    const darker: CoverageRaster = { ...exact, levels: { ...exact.levels, ink: 0 } };
    const ratio = (r: CoverageRaster): number =>
      coverageWidth(r, { x: 4, y: 20.5 }, { x: 60, y: 20.5 }, 2) / coverageWidth(r, { x: 4, y: 43.4 }, { x: 60, y: 43.4 }, 2);
    expect(ratio(darker)).toBeCloseTo(ratio(exact), 2);
    expect(ratio(exact)).toBeCloseTo(1.13 / 2, 1);
  });

  it('γκρι μελάνι (σάρωση): η αντίθεση από τις στάθμες, όχι το 255', () => {
    const img = horizontalStroke(30.4, 3, 60);
    expect(inkLevels(img.gray, img.ink).ink).toBe(60);
    expect(coverageWidth(rasterOf(img), { x: 4, y: 30.4 }, { x: 60, y: 30.4 }, maskRows(img))).toBeCloseTo(3, 1);
  });

  it('κάθετη διασταύρωση και γειτονικό γράμμα δεν μετακινούν τον διάμεσο', () => {
    const img = horizontalStroke(20.3, 1.13);
    for (let y = 0; y < SIZE; y++) for (const x of [30, 31]) { img.gray[y * SIZE + x] = 0; img.ink[y * SIZE + x] = 1; }
    for (let x = 40; x < 44; x++) { img.gray[22 * SIZE + x] = 0; img.ink[22 * SIZE + x] = 1; }
    expect(coverageWidth(rasterOf(img), { x: 4, y: 20.3 }, { x: 60, y: 20.3 }, 2)).toBeCloseTo(1.13, 1);
  });

  it('λοξή λωρίδα (διγραμμική δειγματοληψία): το ίδιο πάχος', () => {
    const gray = new Uint8Array(SIZE * SIZE).fill(PAPER);
    const ink = new Uint8Array(SIZE * SIZE);
    const n = { x: -Math.sin(Math.PI / 6), y: Math.cos(Math.PI / 6) };
    const SUB = 8;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        let hit = 0;
        for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) {
          const d = (x + (sx + 0.5) / SUB - 32) * n.x + (y + (sy + 0.5) / SUB - 32) * n.y;
          if (Math.abs(d) <= 1.25) hit++;
        }
        const c = hit / (SUB * SUB);
        gray[y * SIZE + x] = Math.round(PAPER * (1 - c));
        ink[y * SIZE + x] = c >= 0.5 ? 1 : 0;
      }
    }
    const u = { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) };
    const w = coverageWidth(rasterOf({ gray, ink }), { x: 32 - 20 * u.x, y: 32 - 20 * u.y }, { x: 32 + 20 * u.x, y: 32 + 20 * u.y }, 3);
    expect(w).toBeCloseTo(2.5, 1);
  });

  it('εκφυλισμένο τμήμα ⇒ 0· άδεια μάσκα ⇒ μελάνι 0 (μαύρο), αντίθεση φραγμένη', () => {
    const img = horizontalStroke(20, 1);
    expect(coverageWidth(rasterOf(img), { x: 5, y: 20 }, { x: 5, y: 20 }, 1)).toBe(0);
    const blank = new Uint8Array(SIZE * SIZE).fill(PAPER);
    expect(inkLevels(blank, new Uint8Array(SIZE * SIZE))).toEqual({ paper: PAPER, ink: 0 });
    expect(inkLevels(blank, new Uint8Array(SIZE * SIZE).fill(1))).toEqual({ paper: PAPER, ink: PAPER - 32 });
  });
});
