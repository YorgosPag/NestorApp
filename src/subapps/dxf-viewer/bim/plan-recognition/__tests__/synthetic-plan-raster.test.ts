/**
 * ADR-929 Δ13.1 — τα συνθετικά δείγματα: ντετερμινιστικά, και με αλήθεια που ορίζεται από το ίδιο SSoT
 * `rasterPixelToScene` που θα χρησιμοποιήσει η παραγωγή.
 */

import { describe, it, expect } from '@jest/globals';
import { inkMask } from '@/lib/spatial-tour/space-detect/wall-mask';
import type { Point2D } from '../../../rendering/types/Types';
import {
  rasterPixelToScene,
  sceneToRasterPixel,
} from '../../../floorplan-background/geometry/raster-scene-mapping';
import {
  SAMPLE_HOUSE_WALLS,
  renderSyntheticPlan,
  type SyntheticPlan,
  type SyntheticPlanSpec,
} from '../testing/synthetic-plan-raster';

const BASE: SyntheticPlanSpec = {
  walls: SAMPLE_HOUSE_WALLS,
  pxPerMm: 0.05, // 50 px/m ⇒ τοίχος 25 cm ≈ 12,5 px
  marginMm: 500,
  wallStyle: 'filled',
  strokePx: 2,
  rotationDeg: 0,
  degradation: null,
};

function rgbAtScene(plan: SyntheticPlan, scene: Point2D): readonly number[] {
  const px = sceneToRasterPixel(scene, plan.placement);
  if (!px) throw new Error('degenerate placement');
  const x = Math.floor(px.x);
  const y = Math.floor(px.y);
  const i = (y * plan.image.width + x) * 4;
  return [plan.image.rgba[i], plan.image.rgba[i + 1], plan.image.rgba[i + 2]];
}

const isDark = (rgb: readonly number[]) => rgb.every((c) => c < 100);
const isLight = (rgb: readonly number[]) => rgb.every((c) => c > 150);

describe('renderSyntheticPlan', () => {
  it('μέγεθος εικόνας = κάτοψη + περιθώριο, στην ανάλυση που ζητήθηκε', () => {
    const plan = renderSyntheticPlan(BASE);
    // 6 m + 2·(0,125 + 0,5) m = 7,25 m × 50 px/m
    expect(plan.image.width).toBe(Math.ceil(7250 * 0.05));
    expect(plan.image.rgba.length).toBe(plan.image.width * plan.image.height * 4);
  });

  it('η αλήθεια είναι το SSoT: κέντρο τοίχου σκούρο, κέντρο δωματίου ανοιχτό', () => {
    const plan = renderSyntheticPlan(BASE);
    expect(isDark(rgbAtScene(plan, { x: 3000, y: 0 }))).toBe(true);
    expect(isDark(rgbAtScene(plan, { x: 3500, y: 2000 }))).toBe(true);
    expect(isLight(rgbAtScene(plan, { x: 1700, y: 2000 }))).toBe(true);
  });

  it('η γωνία της εικόνας πέφτει στη γωνία κάτοψη − περιθώριο (pixel → mm, ακρίβεια pixel)', () => {
    const plan = renderSyntheticPlan(BASE);
    const corner = rasterPixelToScene({ x: 0, y: plan.image.height }, plan.placement);
    expect(Math.abs(corner.x - -625)).toBeLessThan(1 / BASE.pxPerMm);
    expect(Math.abs(corner.y - -625)).toBeLessThan(1 / BASE.pxPerMm);
  });

  it('στραβή σάρωση (7°): η αλήθεια ακολουθεί την περιστροφή', () => {
    const plan = renderSyntheticPlan({ ...BASE, rotationDeg: 7 });
    expect(isDark(rgbAtScene(plan, { x: 6000, y: 2000 }))).toBe(true);
    expect(isLight(rgbAtScene(plan, { x: 4700, y: 2000 }))).toBe(true);
  });

  it('τοίχος με περίγραμμα: δύο γραμμές, άδειο ανάμεσα (το πάχος που θα μετρήσει η Φ2)', () => {
    const plan = renderSyntheticPlan({ ...BASE, wallStyle: 'outlined', pxPerMm: 0.1 });
    expect(isLight(rgbAtScene(plan, { x: 3000, y: 0 }))).toBe(true); // μέσα στον τοίχο
    expect(isDark(rgbAtScene(plan, { x: 3000, y: 125 }))).toBe(true); // εσωτερική παρειά
    expect(isDark(rgbAtScene(plan, { x: 3000, y: -125 }))).toBe(true); // εξωτερική παρειά
  });

  it('ένωση τοίχων: η εξωτερική γωνία είναι γεμάτη (καμία εγκοπή t/2 × t/2)', () => {
    const plan = renderSyntheticPlan(BASE);
    expect(isDark(rgbAtScene(plan, { x: 6100, y: -100 }))).toBe(true);
    expect(isDark(rgbAtScene(plan, { x: -100, y: 4100 }))).toBe(true);
  });

  it('περίγραμμα = όριο της ένωσης: καμία γραμμή μέσα από διασταυρούμενο τοίχο', () => {
    const plan = renderSyntheticPlan({ ...BASE, wallStyle: 'outlined', pxPerMm: 0.1 });
    expect(isLight(rgbAtScene(plan, { x: 3450, y: 40 }))).toBe(true); // ο εσωτερικός ΔΕΝ χαράζει τον εξωτερικό
    expect(isDark(rgbAtScene(plan, { x: 3450, y: 2000 }))).toBe(true); // παρειά του εσωτερικού
    expect(isLight(rgbAtScene(plan, { x: 6000, y: 40 }))).toBe(true); // ούτε στη γωνία
  });

  it('ντετερμινιστικό: ίδιος σπόρος ⇒ ίδια bytes· άλλος σπόρος ⇒ άλλα', () => {
    const degraded = { ...BASE, degradation: { seed: 7, noiseAmplitude: 30, yellowing: 0.6 } };
    const a = renderSyntheticPlan(degraded).image.rgba;
    const b = renderSyntheticPlan(degraded).image.rgba;
    const c = renderSyntheticPlan({ ...degraded, degradation: { ...degraded.degradation, seed: 8 } }).image.rgba;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    expect(Buffer.from(a).equals(Buffer.from(c))).toBe(false);
  });

  it('κιτρίνισμα: το χαρτί χάνει μπλε (Δ14 β: παλιά σάρωση)', () => {
    const plan = renderSyntheticPlan({ ...BASE, degradation: { seed: 1, noiseAmplitude: 0, yellowing: 1 } });
    const [r, , b] = rgbAtScene(plan, { x: 1700, y: 2000 });
    expect(r - b).toBeGreaterThan(40);
  });
});

describe('συμβατότητα με τα υπάρχοντα εργαλεία raster (ADR-884, ADR-929 §3)', () => {
  /** Το pixel της εικόνας κάτω από ένα σημείο της κάτοψης, ως δείκτης της μάσκας. */
  function maskIndex(plan: SyntheticPlan, scene: Point2D): number {
    const px = sceneToRasterPixel(scene, plan.placement);
    if (!px) throw new Error('degenerate placement');
    return Math.floor(px.y) * plan.image.width + Math.floor(px.x);
  }

  it('το δείγμα τρέφει ΑΥΤΟΥΣΙΟ το `inkMask` (Otsu): ο τοίχος είναι μελάνι, το δωμάτιο όχι — ακόμη και κιτρινισμένο', () => {
    const plan = renderSyntheticPlan({ ...BASE, degradation: { seed: 11, noiseAmplitude: 25, yellowing: 0.8 } });
    const ink = inkMask(plan.image);
    expect(ink[maskIndex(plan, { x: 3000, y: 0 })]).toBe(1);
    expect(ink[maskIndex(plan, { x: 1700, y: 2000 })]).toBe(0);
  });
});
