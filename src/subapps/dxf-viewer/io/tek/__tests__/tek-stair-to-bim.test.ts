/**
 * ADR-526 — tests για τον mapper `TekStairRecord` → `StairEntity`. Επαληθεύει
 * μονάδες (μέτρα→mm), Y-flip, διατήρηση ύψους ορόφου, και επιλογή variant.
 */

import { tekStairToEntity } from '../tek-stair-to-bim';
import type { TekStairRecord, TekPoint2D } from '../tek-import-types';

/** Σκάλα-δείγμα: 90° στροφή (winder), ΔΥψος 2.9m, ρίχτι 0.17059 → 17 βαθμίδες. */
function sampleRecord(overrides: Partial<TekStairRecord> = {}): TekStairRecord {
  const walkline: TekPoint2D[] = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 },
    { x: -49, y: 60 }, // outlier label anchor (~78m μακριά) — πρέπει να φιλτράρεται
  ];
  return {
    polylines: [walkline],
    startElevationM: 0,
    endElevationM: 2.9,
    steps: 16,
    landings: 0,
    stairWidthM: 0.8,
    treadGoingM: 0.27433959051075801,
    riserHeightM: 0.17058823529411801,
    waistThicknessM: 0.15,
    walklineLengthM: 4.38943344817213,
    minStepWidthM: 0.07,
    stepsNumbering: true,
    ...overrides,
  };
}

describe('tekStairToEntity', () => {
  it('παράγει stair entity με σωστό type/levelId', () => {
    const e = tekStairToEntity(sampleRecord(), 'level-1');
    expect(e.type).toBe('stair');
    expect(e.levelId).toBe('level-1');
    expect(e.id).toMatch(/.+/);
    expect(e.visible).toBe(true);
  });

  it('stepCount από το ρίχτι (round(2.9/0.17059) = 17), όχι από steps=16', () => {
    const e = tekStairToEntity(sampleRecord());
    expect(e.params.stepCount).toBe(17);
  });

  it('διατηρεί ΑΚΡΙΒΩΣ το ύψος ορόφου (totalRise === 2900mm)', () => {
    const e = tekStairToEntity(sampleRecord());
    expect(e.params.totalRise).toBeCloseTo(2900, 3);
    expect(e.params.rise).toBeCloseTo(2900 / 17, 3);
  });

  it('πάτημα/πλάτος σε mm (μέτρα × 1000)', () => {
    const e = tekStairToEntity(sampleRecord());
    expect(e.params.tread).toBeCloseTo(274.34, 1);
    expect(e.params.width).toBeCloseTo(800, 1);
  });

  it('Y-flip: το basePoint έχει αρνητικό Y στον καμβά (Τέκτων Y-up → καμβάς Y-down)', () => {
    // walkline ξεκινά στο (0,0) → base (0, -0) ≈ 0· δοκιμή με μη-μηδενικό Y.
    const e = tekStairToEntity(sampleRecord({
      polylines: [[{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 6 }]],
    }));
    expect(e.params.basePoint.x).toBeCloseTo(1000, 3);
    expect(e.params.basePoint.y).toBeCloseTo(-5000, 3);
  });

  it('ανιχνεύει winder στη στροφή 90° με winderCount ≈ 3', () => {
    const e = tekStairToEntity(sampleRecord());
    expect(e.params.variant.kind).toBe('winder');
    if (e.params.variant.kind === 'winder') {
      expect(Math.abs(e.params.variant.turnAngle)).toBeCloseTo(90, 0);
      expect(e.params.variant.winderCount).toBe(3);
    }
  });

  it('ευθεία walkline → straight variant', () => {
    const straight = sampleRecord({
      polylines: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]],
    });
    const e = tekStairToEntity(straight);
    expect(e.params.variant.kind).toBe('straight');
  });

  it('μεταφέρει το πάχος μηρού (slope_h) σε waistThickness mm', () => {
    const e = tekStairToEntity(sampleRecord());
    expect(e.params.waistThickness).toBeCloseTo(150, 3);
  });
});
