/**
 * ADR-436 Slice 1b — foundation pad grip tests.
 *
 * Verifies grip emission (rotation/width/length, declutter no-center), handle
 * world positions, and `applyFoundationGripDrag` transforms (anchor-aware
 * width/length resize, rotation about position, 6-click pivot, Alt-move,
 * zero-delta no-op, min clamp). Pure functions — μηδέν mocks. Mirror column.
 */

import { getFoundationGrips, applyFoundationGripDrag } from '../foundation-grips';
import {
  MIN_FOUNDATION_DIMENSION_MM,
  type FoundationEntity,
  type PadFootingParams,
  type StripFootingParams,
} from '../../types/foundation-types';

const pad = (over: Partial<PadFootingParams> = {}): PadFootingParams => ({
  kind: 'pad',
  topElevationMm: -1000,
  thicknessMm: 500,
  position: { x: 0, y: 0, z: 0 },
  width: 1500,
  length: 2000,
  rotation: 0,
  anchor: 'center',
  profile: 'flat',
  sceneUnits: 'mm',
  ...over,
});

const padEntity = (over: Partial<PadFootingParams> = {}): FoundationEntity =>
  ({ id: 'fnd-1', type: 'foundation', kind: 'pad', params: pad(over) } as unknown as FoundationEntity);

const strip = (over: Partial<StripFootingParams> = {}): StripFootingParams => ({
  kind: 'strip',
  topElevationMm: -1000,
  thicknessMm: 400,
  start: { x: 0, y: 0, z: 0 },
  end: { x: 2000, y: 0, z: 0 },
  width: 600,
  sceneUnits: 'mm',
  ...over,
});

const stripEntity = (over: Partial<StripFootingParams> = {}): FoundationEntity =>
  ({ id: 'fnd-2', type: 'foundation', kind: 'strip', params: strip(over) } as unknown as FoundationEntity);

describe('getFoundationGrips — pad', () => {
  it('emits exactly 7 grips: rotation / 2 edges / 4 corners (no central move)', () => {
    const grips = getFoundationGrips(padEntity());
    expect(grips).toHaveLength(7);
    expect(grips.map((g) => g.foundationGripKind)).toEqual([
      'foundation-rotation',
      'foundation-width',
      'foundation-length',
      'foundation-corner-ne',
      'foundation-corner-nw',
      'foundation-corner-sw',
      'foundation-corner-se',
    ]);
    expect(grips.every((g) => g.movesEntity === false)).toBe(true);
  });

  it('places the four corners at the footprint vertices (anchor=center, rotation=0)', () => {
    const grips = getFoundationGrips(padEntity());
    const at = (k: string) => grips.find((g) => g.foundationGripKind === k)!.position;
    expect(at('foundation-corner-ne')).toEqual({ x: 750, y: 1000 });
    expect(at('foundation-corner-nw')).toEqual({ x: -750, y: 1000 });
    expect(at('foundation-corner-sw')).toEqual({ x: -750, y: -1000 });
    expect(at('foundation-corner-se')).toEqual({ x: 750, y: -1000 });
  });

  it('places width handle at the far +X edge for anchor=center, rotation=0', () => {
    const grips = getFoundationGrips(padEntity());
    const width = grips.find((g) => g.foundationGripKind === 'foundation-width')!;
    expect(width.position.x).toBeCloseTo(750); // width/2
    expect(width.position.y).toBeCloseTo(0);
  });

  it('places length handle at the far +Y edge for anchor=center, rotation=0', () => {
    const grips = getFoundationGrips(padEntity());
    const length = grips.find((g) => g.foundationGripKind === 'foundation-length')!;
    expect(length.position.x).toBeCloseTo(0);
    expect(length.position.y).toBeCloseTo(1000); // length/2
  });

  it('places rotation handle above the north edge (length/2 + offset)', () => {
    const grips = getFoundationGrips(padEntity());
    const rot = grips.find((g) => g.foundationGripKind === 'foundation-rotation')!;
    expect(rot.position.y).toBeCloseTo(1200); // length/2 + 200 offset
  });

});

describe('getFoundationGrips — line (strip / tie-beam, axis-box 7-grip wall parity)', () => {
  it('emits 7 wall-parity grips: width edge / length edge / 4 corners / rotation', () => {
    const grips = getFoundationGrips(stripEntity());
    expect(grips).toHaveLength(7);
    expect(grips.map((g) => g.foundationGripKind)).toEqual([
      'foundation-line-width',
      'foundation-line-length',
      'foundation-corner-start-pos',
      'foundation-corner-start-neg',
      'foundation-corner-end-pos',
      'foundation-corner-end-neg',
      'foundation-rotation',
    ]);
    expect(grips.every((g) => g.movesEntity === false)).toBe(true);
  });

  it('places the 4 corners at the band footprint vertices (axis +X, width 600)', () => {
    const grips = getFoundationGrips(stripEntity());
    const at = (k: string) => grips.find((g) => g.foundationGripKind === k)!.position;
    // axis (0,0)→(2000,0), +perp = +Y, halfWidth = width/2 = 300.
    expect(at('foundation-corner-start-pos')).toEqual({ x: 0, y: 300 });
    expect(at('foundation-corner-start-neg')).toEqual({ x: 0, y: -300 });
    expect(at('foundation-corner-end-pos')).toEqual({ x: 2000, y: 300 });
    expect(at('foundation-corner-end-neg')).toEqual({ x: 2000, y: -300 });
  });

  it('places width edge at axis midpoint offset by width/2 along perpendicular', () => {
    const grips = getFoundationGrips(stripEntity());
    const w = grips.find((g) => g.foundationGripKind === 'foundation-line-width')!;
    // axis along +X → CCW perp = +Y; midpoint (1000,0) + 300 → (1000, 300).
    expect(w.position.x).toBeCloseTo(1000);
    expect(w.position.y).toBeCloseTo(300);
  });

  it('places length edge at the END short edge midpoint along the axis', () => {
    const grips = getFoundationGrips(stripEntity());
    const l = grips.find((g) => g.foundationGripKind === 'foundation-line-length')!;
    expect(l.position).toEqual({ x: 2000, y: 0 });
  });

  it('emits no grips on a degenerate (zero-length) axis', () => {
    const grips = getFoundationGrips(stripEntity({ end: { x: 0, y: 0, z: 0 } }));
    expect(grips).toEqual([]);
  });
});

describe('applyFoundationGripDrag — line transforms (Slice 2)', () => {
  it('foundation-start translates only the start endpoint', () => {
    const p = applyFoundationGripDrag('foundation-start', {
      originalParams: strip(),
      delta: { x: 100, y: 50 },
    });
    expect(p.kind !== 'pad' && p.start).toEqual({ x: 100, y: 50, z: 0 });
    expect(p.kind !== 'pad' && p.end).toEqual({ x: 2000, y: 0, z: 0 });
  });

  it('foundation-end translates only the end endpoint', () => {
    const p = applyFoundationGripDrag('foundation-end', {
      originalParams: strip(),
      delta: { x: -100, y: 0 },
    });
    expect(p.kind !== 'pad' && p.end).toEqual({ x: 1900, y: 0, z: 0 });
    expect(p.kind !== 'pad' && p.start).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('foundation-line-width resizes the band opposite-face-fixed (shared axis-box engine)', () => {
    const p = applyFoundationGripDrag('foundation-line-width', {
      originalParams: strip(),
      delta: { x: 0, y: 100 }, // perpendicular to +X axis
    });
    // ADR-436 (2026-06-11) — wall parity: +perp face moves +100, −perp face holds →
    // width 600→700 (was symmetric ×2). The axis shifts +50 perpendicular.
    expect(p.kind !== 'pad' && p.width).toBeCloseTo(700);
    expect(p.kind !== 'pad' && p.start.y).toBeCloseTo(50);
  });

  it('foundation-line-length resizes length along the axis (END edge, start fixed)', () => {
    const p = applyFoundationGripDrag('foundation-line-length', {
      originalParams: strip(),
      delta: { x: 400, y: 0 },
    });
    expect(p.kind !== 'pad' && p.start).toEqual({ x: 0, y: 0, z: 0 }); // start held
    expect(p.kind !== 'pad' && p.end.x).toBeCloseTo(2400); // end +400
  });

  it('foundation-rotation spins the line band about its midpoint', () => {
    // anchor at the +perp handle (1000,300); 90° CCW about midpoint (1000,0).
    const anchor = { x: 1000, y: 300 };
    const currentPos = { x: 700, y: 0 };
    const p = applyFoundationGripDrag('foundation-rotation', {
      originalParams: strip(),
      delta: { x: currentPos.x - anchor.x, y: currentPos.y - anchor.y },
      currentPos,
    });
    // 90° CCW about (1000,0): start (0,0)→(1000,-1000), end (2000,0)→(1000,1000).
    expect(p.kind !== 'pad' && p.start.x).toBeCloseTo(1000);
    expect(p.kind !== 'pad' && p.start.y).toBeCloseTo(-1000);
    expect(p.kind !== 'pad' && p.end.y).toBeCloseTo(1000);
  });

  it('foundation-line-width ignores parallel-to-axis drag', () => {
    const p = applyFoundationGripDrag('foundation-line-width', {
      originalParams: strip(),
      delta: { x: 500, y: 0 }, // parallel to axis → projects to 0
    });
    expect(p.kind !== 'pad' && p.width).toBe(600);
  });

  it('foundation-line-width clamps to MIN_FOUNDATION_DIMENSION_MM', () => {
    const p = applyFoundationGripDrag('foundation-line-width', {
      originalParams: strip(),
      delta: { x: 0, y: -100000 },
    });
    expect(p.kind !== 'pad' && p.width).toBe(MIN_FOUNDATION_DIMENSION_MM);
  });

  it('foundation-center (Alt-move) translates both endpoints', () => {
    const p = applyFoundationGripDrag('foundation-center', {
      originalParams: strip(),
      delta: { x: 10, y: 20 },
    });
    expect(p.kind !== 'pad' && p.start).toEqual({ x: 10, y: 20, z: 0 });
    expect(p.kind !== 'pad' && p.end).toEqual({ x: 2010, y: 20, z: 0 });
  });
});

describe('applyFoundationGripDrag — edge resize (opposite edge fixed)', () => {
  it('width edge follows the cursor 1:1, opposite edge fixed (center anchor)', () => {
    const p = applyFoundationGripDrag('foundation-width', {
      originalParams: pad(),
      delta: { x: 100, y: 0 },
    });
    // Opposite (−X) edge holds at −750: width +100 → 1600, centroid shifts +50.
    expect(p.kind === 'pad' && p.width).toBe(1600);
    expect(p.kind === 'pad' && p.position.x).toBeCloseTo(50);
  });

  it('length edge follows the cursor 1:1, opposite edge fixed (center anchor)', () => {
    const p = applyFoundationGripDrag('foundation-length', {
      originalParams: pad(),
      delta: { x: 0, y: 100 },
    });
    expect(p.kind === 'pad' && (p as PadFootingParams).length).toBe(2100);
    expect(p.kind === 'pad' && p.position.y).toBeCloseTo(50);
  });

  it('clamps width to MIN_FOUNDATION_DIMENSION_MM on a large negative drag', () => {
    const p = applyFoundationGripDrag('foundation-width', {
      originalParams: pad(),
      delta: { x: -100000, y: 0 },
    });
    expect(p.kind === 'pad' && p.width).toBe(MIN_FOUNDATION_DIMENSION_MM);
  });

  it('width resize does not touch length (independent axes)', () => {
    const p = applyFoundationGripDrag('foundation-width', {
      originalParams: pad(),
      delta: { x: 100, y: 0 },
    });
    expect(p.kind === 'pad' && (p as PadFootingParams).length).toBe(2000);
  });
});

describe('applyFoundationGripDrag — corner resize (opposite corner fixed)', () => {
  it('corner-ne resizes both dims and shifts the centroid, keeping SW fixed', () => {
    const p = applyFoundationGripDrag('foundation-corner-ne', {
      originalParams: pad(),
      delta: { x: 100, y: 200 },
    });
    expect(p.kind === 'pad' && p.width).toBeCloseTo(1600); // 1500 + 100
    expect(p.kind === 'pad' && (p as PadFootingParams).length).toBeCloseTo(2200); // 2000 + 200
    // SW corner before = (−750, −1000); after, centroid (50,100) − (800,1100) = (−750,−1000).
    expect(p.kind === 'pad' && p.position.x).toBeCloseTo(50);
    expect(p.kind === 'pad' && p.position.y).toBeCloseTo(100);
  });

  it('corner-sw grows toward −X/−Y and keeps NE fixed', () => {
    const p = applyFoundationGripDrag('foundation-corner-sw', {
      originalParams: pad(),
      delta: { x: -100, y: -200 },
    });
    expect(p.kind === 'pad' && p.width).toBeCloseTo(1600);
    expect(p.kind === 'pad' && (p as PadFootingParams).length).toBeCloseTo(2200);
    expect(p.kind === 'pad' && p.position.x).toBeCloseTo(-50);
    expect(p.kind === 'pad' && p.position.y).toBeCloseTo(-100);
  });

  it('clamps a corner drag to the minimum dimension', () => {
    const p = applyFoundationGripDrag('foundation-corner-ne', {
      originalParams: pad(),
      delta: { x: -100000, y: -100000 },
    });
    expect(p.kind === 'pad' && p.width).toBe(MIN_FOUNDATION_DIMENSION_MM);
    expect(p.kind === 'pad' && (p as PadFootingParams).length).toBe(MIN_FOUNDATION_DIMENSION_MM);
  });
});

describe('applyFoundationGripDrag — rotation', () => {
  it('rotation about position changes only rotation, not position', () => {
    const p = applyFoundationGripDrag('foundation-rotation', {
      originalParams: pad(),
      delta: { x: 50, y: 0 },
    });
    expect(p.kind === 'pad' && p.position.x).toBe(0);
    expect(p.kind === 'pad' && p.position.y).toBe(0);
    expect(p.kind === 'pad' && p.rotation).not.toBe(0);
  });

  it('6-click pivot rotation orbits position around the pivot (position changes)', () => {
    const p = applyFoundationGripDrag('foundation-rotation', {
      originalParams: pad({ position: { x: 1000, y: 0, z: 0 } }),
      delta: { x: 0, y: 1000 },
      currentPos: { x: 1000, y: 1000 },
      pivot: { x: 0, y: 0 },
    });
    // anchor = currentPos - delta = (1000, 0) at 0°; currentPos (1000,1000) at
    // 45° → swept 45° CCW about origin → position (1000,0) orbits to (707, 707).
    expect(p.kind === 'pad' && p.position.x).toBeCloseTo(707.107, 2);
    expect(p.kind === 'pad' && p.position.y).toBeCloseTo(707.107, 2);
    expect(p.kind === 'pad' && p.rotation).toBeCloseTo(45, 3);
  });
});

describe('applyFoundationGripDrag — move & no-op', () => {
  it('foundation-center (Alt-move) translates the pad position', () => {
    const p = applyFoundationGripDrag('foundation-center', {
      originalParams: pad(),
      delta: { x: 300, y: -200 },
    });
    expect(p.kind === 'pad' && p.position.x).toBe(300);
    expect(p.kind === 'pad' && p.position.y).toBe(-200);
  });

  it('zero delta returns the original params referentially (no-op short-circuit)', () => {
    const original = pad();
    const p = applyFoundationGripDrag('foundation-width', {
      originalParams: original,
      delta: { x: 0, y: 0 },
    });
    expect(p).toBe(original);
  });

  it('width/length resize is a no-op for non-pad kinds (strip)', () => {
    const strip = { kind: 'strip' } as unknown as StripFootingParams;
    const p = applyFoundationGripDrag('foundation-width', {
      originalParams: strip,
      delta: { x: 100, y: 0 },
    });
    expect(p).toBe(strip);
  });
});
