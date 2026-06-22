/**
 * ADR-401 Phase E2 — slab slope-plane SSoT tests.
 *
 * Καλύπτει: flat fast-path (μη-tilted → 0), pivot center/N/S/E/W, φορά
 * `direction`, % → mm, και top/underside (σταθερό πάχος = παράλληλα επίπεδα).
 */

import {
  slabSlopeOffsetZmm,
  slabTopZmmAt,
  slabUndersideZmmAt,
  withSlabSlope,
} from '../slab-slope';
import type { SlabParams, SlabSlope } from '../../types/slab-types';

/** 10000×10000 mm τετράγωνο outline με γωνία στο (0,0). AABB center = (5000,5000). */
const SQUARE = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10000, y: 0 },
    { x: 10000, y: 10000 },
    { x: 0, y: 10000 },
  ],
};

function slab(over: Partial<SlabParams> = {}): SlabParams {
  return {
    kind: 'roof',
    outline: SQUARE,
    levelElevation: 3000,
    thickness: 200,
    geometryType: 'box',
    ...over,
  } as SlabParams;
}

describe('slabSlopeOffsetZmm', () => {
  it('μη-tilted → 0 (flat fast-path)', () => {
    expect(slabSlopeOffsetZmm(slab(), { x: 0, y: 0 })).toBe(0);
    expect(slabSlopeOffsetZmm(slab(), { x: 10000, y: 5000 })).toBe(0);
  });

  it('tilted χωρίς slope (defensive) → 0', () => {
    expect(slabSlopeOffsetZmm(slab({ geometryType: 'tilted' }), { x: 0, y: 0 })).toBe(0);
  });

  it('pivot center, direction +X (East): offset = (x−5000)·angle%', () => {
    const p = slab({ geometryType: 'tilted', slope: { direction: 0, angle: 10, pivotEdge: 'center' } });
    // 10% → 0.1 mm/mm. στο x=10000: (10000−5000)·0.1 = +500· στο x=0: −500· στο κέντρο: 0.
    expect(slabSlopeOffsetZmm(p, { x: 10000, y: 5000 })).toBeCloseTo(500, 6);
    expect(slabSlopeOffsetZmm(p, { x: 0, y: 5000 })).toBeCloseTo(-500, 6);
    expect(slabSlopeOffsetZmm(p, { x: 5000, y: 5000 })).toBeCloseTo(0, 6);
    // y δεν επηρεάζει όταν direction=+X
    expect(slabSlopeOffsetZmm(p, { x: 10000, y: 0 })).toBeCloseTo(500, 6);
  });

  it('pivot W (min X edge) μένει στο 0· ανηφόρα +X', () => {
    const p = slab({ geometryType: 'tilted', slope: { direction: 0, angle: 5, pivotEdge: 'W' } });
    // pivot x=0 → στο x=0 offset 0· στο x=10000: 10000·0.05 = +500.
    expect(slabSlopeOffsetZmm(p, { x: 0, y: 5000 })).toBeCloseTo(0, 6);
    expect(slabSlopeOffsetZmm(p, { x: 10000, y: 5000 })).toBeCloseTo(500, 6);
  });

  it('direction +Y (North=90°), pivot S → offset κατά y', () => {
    const p = slab({ geometryType: 'tilted', slope: { direction: 90, angle: 10, pivotEdge: 'S' } });
    // pivot y=0 (min Y)· στο y=10000: 10000·0.1 = +1000· x αδιάφορο.
    expect(slabSlopeOffsetZmm(p, { x: 3000, y: 10000 })).toBeCloseTo(1000, 6);
    expect(slabSlopeOffsetZmm(p, { x: 3000, y: 0 })).toBeCloseTo(0, 6);
  });
});

describe('slabTopZmmAt / slabUndersideZmmAt', () => {
  it('flat: top=levelElevation+heightOffset, underside=top−thickness', () => {
    const p = slab({ levelElevation: 3000, heightOffsetFromLevel: 100, thickness: 200 });
    expect(slabTopZmmAt(p, { x: 0, y: 0 })).toBe(3100);
    expect(slabUndersideZmmAt(p, { x: 0, y: 0 })).toBe(2900);
  });

  it('tilted: underside = top − thickness σε κάθε σημείο (παράλληλα επίπεδα)', () => {
    const p = slab({
      levelElevation: 3000,
      thickness: 200,
      geometryType: 'tilted',
      slope: { direction: 0, angle: 10, pivotEdge: 'center' },
    });
    // x=10000 → top 3000+500=3500, underside 3300· x=0 → top 2500, underside 2300.
    expect(slabTopZmmAt(p, { x: 10000, y: 5000 })).toBeCloseTo(3500, 6);
    expect(slabUndersideZmmAt(p, { x: 10000, y: 5000 })).toBeCloseTo(3300, 6);
    expect(slabUndersideZmmAt(p, { x: 0, y: 5000 })).toBeCloseTo(2300, 6);
    // σταθερό πάχος → top − underside === thickness παντού
    const pt = { x: 7000, y: 2000 };
    expect(slabTopZmmAt(p, pt) - slabUndersideZmmAt(p, pt)).toBeCloseTo(200, 6);
  });
});

// ─── ADR-404 Phase 5c — withSlabSlope invariant (geometryType↔slope SSoT) ─────
describe('withSlabSlope (geometryType↔slope invariant SSoT)', () => {
  const SLOPE: SlabSlope = { direction: 90, angle: 2, pivotEdge: 'S' };

  it('slope set → geometryType="tilted" + slope', () => {
    const next = withSlabSlope(slab(), SLOPE);
    expect(next.geometryType).toBe('tilted');
    expect(next.slope).toEqual(SLOPE);
  });

  it('null → geometryType="box" + DROP slope key (όχι undefined value)', () => {
    const tilted = slab({ geometryType: 'tilted', slope: SLOPE });
    const next = withSlabSlope(tilted, null);
    expect(next.geometryType).toBe('box');
    expect(next.slope).toBeUndefined();
    expect('slope' in next).toBe(false); // πλήρης αφαίρεση (Zod .strict + serialization καθαρά)
  });

  it('διατηρεί τα υπόλοιπα πεδία αμετάβλητα (immutable update)', () => {
    const base = slab({ levelElevation: 4200, thickness: 250, kind: 'roof' });
    const next = withSlabSlope(base, SLOPE);
    expect(next.levelElevation).toBe(4200);
    expect(next.thickness).toBe(250);
    expect(next.kind).toBe('roof');
    expect(base.geometryType).toBe('box'); // δεν mutate-άρει το input
  });

  it('λειτουργεί σε partial overrides shape (drawing-mode {geometryType?, slope?})', () => {
    const offBox = withSlabSlope({ geometryType: 'tilted', slope: SLOPE }, null);
    expect(offBox).toEqual({ geometryType: 'box' });
    const onTilted = withSlabSlope({}, SLOPE);
    expect(onTilted).toEqual({ geometryType: 'tilted', slope: SLOPE });
  });
});
