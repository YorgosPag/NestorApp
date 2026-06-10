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

describe('getFoundationGrips — pad', () => {
  it('emits exactly 3 grips: rotation / width / length (no central move)', () => {
    const grips = getFoundationGrips(padEntity());
    expect(grips).toHaveLength(3);
    expect(grips.map((g) => g.foundationGripKind)).toEqual([
      'foundation-rotation',
      'foundation-width',
      'foundation-length',
    ]);
    expect(grips.every((g) => g.movesEntity === false)).toBe(true);
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

  it('emits no grips for line-based kinds (strip/tie-beam = Slice 2)', () => {
    const strip = {
      id: 'fnd-2',
      type: 'foundation',
      kind: 'strip',
      params: { kind: 'strip' } as StripFootingParams,
    } as unknown as FoundationEntity;
    expect(getFoundationGrips(strip)).toEqual([]);
  });
});

describe('applyFoundationGripDrag — resize', () => {
  it('width resize is anchor-aware (center anchor → coef 0.5 → 2× delta)', () => {
    const p = applyFoundationGripDrag('foundation-width', {
      originalParams: pad(),
      delta: { x: 100, y: 0 },
    });
    // newWidth = 1500 + 100 / (0.5 * 1) = 1700
    expect(p.kind === 'pad' && p.width).toBe(1700);
  });

  it('length resize is anchor-aware (center anchor → coef 0.5 → 2× delta)', () => {
    const p = applyFoundationGripDrag('foundation-length', {
      originalParams: pad(),
      delta: { x: 0, y: 100 },
    });
    expect(p.kind === 'pad' && (p as PadFootingParams).length).toBe(2200);
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
