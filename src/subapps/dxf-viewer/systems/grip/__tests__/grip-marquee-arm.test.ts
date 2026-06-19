/**
 * @fileoverview Tests for ADR-501 Slice 2 — grip marquee arming.
 * Covers: point-in-box classification (window/crossing-direction agnostic for a
 * point), ≥1 grip → arm + consume, 0 grips → passthrough (no arm), Shift = add to
 * the armed set vs plain = replace, and ArmableGripsStore set/clear.
 */

import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import { GripArmedStore } from '../GripArmedStore';
import { ArmableGripsStore, type ArmableGrip } from '../ArmableGripsStore';
import { runGripMarqueeArm } from '../grip-marquee-arm';

const VIEWPORT: Viewport = { width: 1000, height: 800 };
const TRANSFORM: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

/** Screen position a grip world point maps to under the test transform. */
const screenOf = (world: Point2D): Point2D =>
  CoordinateTransforms.worldToScreen(world, TRANSFORM, VIEWPORT);

/** Box (start/end screen) that strictly encloses the given screen points. */
const boxAround = (points: Point2D[], pad = 5): { start: Point2D; end: Point2D } => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    start: { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad },
    end: { x: Math.max(...xs) + pad, y: Math.max(...ys) + pad },
  };
};

const grip = (entityId: string, gripIndex: number, position: Point2D): ArmableGrip =>
  ({ entityId, gripIndex, position });

const GRIPS: ArmableGrip[] = [
  grip('e1', 0, { x: 100, y: 100 }),
  grip('e1', 1, { x: 200, y: 100 }),
  grip('e2', 0, { x: 600, y: 500 }),
];

describe('runGripMarqueeArm — ADR-501 Slice 2', () => {
  beforeEach(() => GripArmedStore.clear());

  it('returns false (passthrough) when there are no armable grips', () => {
    const box = boxAround([screenOf({ x: 100, y: 100 })]);
    expect(runGripMarqueeArm(box.start, box.end, TRANSFORM, VIEWPORT, false, [])).toBe(false);
    expect(GripArmedStore.size).toBe(0);
  });

  it('arms the grips that fall inside the box and consumes (returns true)', () => {
    // Box around the two e1 grips only — e2 is far away.
    const box = boxAround([screenOf({ x: 100, y: 100 }), screenOf({ x: 200, y: 100 })]);
    const armed = runGripMarqueeArm(box.start, box.end, TRANSFORM, VIEWPORT, false, GRIPS);
    expect(armed).toBe(true);
    expect(GripArmedStore.size).toBe(2);
    expect(GripArmedStore.has('e1', 0)).toBe(true);
    expect(GripArmedStore.has('e1', 1)).toBe(true);
    expect(GripArmedStore.has('e2', 0)).toBe(false);
  });

  it('returns false (passthrough) when the box catches no grip — entity-marquee untouched', () => {
    // Empty corner of the canvas, no grip inside.
    const armed = runGripMarqueeArm({ x: 900, y: 50 }, { x: 950, y: 90 }, TRANSFORM, VIEWPORT, false, GRIPS);
    expect(armed).toBe(false);
    expect(GripArmedStore.size).toBe(0);
  });

  it('is direction-agnostic for a point — crossing drag (right→left) still arms', () => {
    const a = screenOf({ x: 100, y: 100 });
    const b = screenOf({ x: 200, y: 100 });
    // start to the RIGHT of end (crossing direction) — a point cannot be "crossed",
    // so containment is what matters and both e1 grips arm.
    const box = boxAround([a, b]);
    const armed = runGripMarqueeArm(box.end, box.start, TRANSFORM, VIEWPORT, false, GRIPS);
    expect(armed).toBe(true);
    expect(GripArmedStore.size).toBe(2);
  });

  it('plain marquee REPLACES the armed set', () => {
    GripArmedStore.setOnly({ entityId: 'old', gripIndex: 9 });
    const box = boxAround([screenOf({ x: 100, y: 100 })]);
    runGripMarqueeArm(box.start, box.end, TRANSFORM, VIEWPORT, false, GRIPS);
    expect(GripArmedStore.has('old', 9)).toBe(false);
    expect(GripArmedStore.has('e1', 0)).toBe(true);
  });

  it('Shift marquee ADDS to the existing armed set', () => {
    GripArmedStore.setOnly({ entityId: 'kept', gripIndex: 7 });
    const box = boxAround([screenOf({ x: 600, y: 500 })]); // e2 only
    const armed = runGripMarqueeArm(box.start, box.end, TRANSFORM, VIEWPORT, true, GRIPS);
    expect(armed).toBe(true);
    expect(GripArmedStore.has('kept', 7)).toBe(true);
    expect(GripArmedStore.has('e2', 0)).toBe(true);
  });
});

describe('ArmableGripsStore — ADR-501 Slice 2', () => {
  afterEach(() => ArmableGripsStore.clear());

  it('starts empty', () => {
    expect(ArmableGripsStore.getSnapshot()).toHaveLength(0);
  });

  it('publishes and reads back the armable grips', () => {
    ArmableGripsStore.set(GRIPS);
    expect(ArmableGripsStore.getSnapshot()).toHaveLength(3);
  });

  it('clear empties the published set', () => {
    ArmableGripsStore.set(GRIPS);
    ArmableGripsStore.clear();
    expect(ArmableGripsStore.getSnapshot()).toHaveLength(0);
  });
});
