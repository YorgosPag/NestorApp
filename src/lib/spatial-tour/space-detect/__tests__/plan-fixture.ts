/**
 * Τεχνητές κατόψεις για τις άγκυρες της ανίχνευσης χώρων (ADR-884 Φ2στ-γ Γ3): λευκό χαρτί, μαύροι τοίχοι σε ΜΕΤΡΑ.
 */

import type { PixelPoint } from '@/lib/geometry/scale-calibration';

import type { PlanRaster } from '../space-detect-types';

/** 2 cm ανά pixel — τάξη μεγέθους της πραγματικής κάτοψης (0,0156). */
export const FIXTURE_MPP = 0.02;

export interface PlanFixture {
  readonly raster: PlanRaster;
  /** Γεμίζει ορθογώνιο (μέτρα) με το χρώμα: 0 = μαύρο μελάνι, 255 = χαρτί. */
  fill(x0: number, y0: number, x1: number, y1: number, gray?: number): void;
  /** Μέτρα ⇒ pixel. */
  px(xM: number, yM: number): PixelPoint;
}

export function planFixture(widthM: number, heightM: number): PlanFixture {
  const width = Math.round(widthM / FIXTURE_MPP), height = Math.round(heightM / FIXTURE_MPP);
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  const fill = (x0: number, y0: number, x1: number, y1: number, gray = 0): void => {
    for (let r = Math.round(y0 / FIXTURE_MPP); r < Math.round(y1 / FIXTURE_MPP); r++) {
      for (let c = Math.round(x0 / FIXTURE_MPP); c < Math.round(x1 / FIXTURE_MPP); c++) {
        const o = (r * width + c) * 4;
        rgba[o] = gray; rgba[o + 1] = gray; rgba[o + 2] = gray;
      }
    }
  };
  return { raster: { rgba, width, height }, fill, px: (x, y) => ({ x: x / FIXTURE_MPP, y: y / FIXTURE_MPP }) };
}

/**
 * Διαμέρισμα 9 × 7 m: εξωτερικοί τοίχοι 20 cm (εσωτερικό 0,7–8,3 × 0,7–6,3), μεσότοιχος 20 cm στο x = 4,4–4,6 με
 * άνοιγμα στο y = 2,0 → 2,0 + `openingM`. Αριστερό δωμάτιο: 3,7 × 5,6 = **20,72 m²** (ως την παρειά).
 */
export function twoRoomPlan(openingM: number): PlanFixture {
  const plan = planFixture(9, 7);
  plan.fill(0.5, 0.5, 8.5, 0.7);
  plan.fill(0.5, 6.3, 8.5, 6.5);
  plan.fill(0.5, 0.5, 0.7, 6.5);
  plan.fill(8.3, 0.5, 8.5, 6.5);
  plan.fill(4.4, 0.7, 4.6, 2.0);
  plan.fill(4.4, 2.0 + openingM, 4.6, 6.3);
  return plan;
}

export const LEFT_ROOM_AREA_M2 = 3.7 * 5.6;
