/**
 * ADR-561 — `resolveRectRotationReference` tests (coaxial rotation reference cross).
 *
 * Rule (Giorgio 2026-07-05): when the rotation centre lands on one of a rectangle's 8
 * handles, the 0° reference = the side axis nearest the cursor + a cross of both side
 * axes; off the handles / non-rectangles → null (caller keeps current behaviour).
 */
import { resolveRectRotationReference } from '../rect-rotation-reference';
import type { Entity } from '../../../types/entities';

/** 40×20 axis-aligned rectangle as a closed polyline. Handles: corners + edge mids. */
const rect = (): Entity => ({
  type: 'polyline',
  vertices: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }],
  closed: true,
} as unknown as Entity);

describe('resolveRectRotationReference (ADR-561)', () => {
  it('pivot on a CORNER, cursor toward +X → 0° arm = +X side axis', () => {
    const ref = resolveRectRotationReference(rect(), { x: 40, y: 0 }, { x: 60, y: 0 });
    expect(ref).not.toBeNull();
    expect(ref!.refAnchor.x).toBeCloseTo(41, 6); // pivot + unit +X
    expect(ref!.refAnchor.y).toBeCloseTo(0, 6);
  });

  it('pivot on a corner, cursor toward +Y → 0° arm = +Y side axis (nearest)', () => {
    const ref = resolveRectRotationReference(rect(), { x: 40, y: 0 }, { x: 40, y: 30 });
    expect(ref).not.toBeNull();
    expect(ref!.refAnchor.x).toBeCloseTo(40, 6);
    expect(ref!.refAnchor.y).toBeCloseTo(1, 6); // pivot + unit +Y
  });

  it('emits a CROSS: axisRef horizontal, axisAlign vertical for an axis-aligned rect', () => {
    const ref = resolveRectRotationReference(rect(), { x: 0, y: 0 }, { x: 10, y: 0 })!;
    // axisRef along local +X (horizontal): constant y through the pivot.
    expect(ref.cross.axisRef.from.y).toBeCloseTo(0, 6);
    expect(ref.cross.axisRef.to.y).toBeCloseTo(0, 6);
    // axisAlign along local +Y (vertical): constant x through the pivot.
    expect(ref.cross.axisAlign.from.x).toBeCloseTo(0, 6);
    expect(ref.cross.axisAlign.to.x).toBeCloseTo(0, 6);
  });

  it('pivot on an EDGE MIDPOINT is also «on a handle»', () => {
    // Top edge midpoint of the 40×20 rect = (20, 20).
    expect(resolveRectRotationReference(rect(), { x: 20, y: 20 }, { x: 20, y: 40 })).not.toBeNull();
  });

  it('TILTED rect (rotated 90°) → the cross axes tilt with the shape', () => {
    const tilted = {
      type: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: -20, y: 40 }, { x: -20, y: 0 }],
      closed: true,
    } as unknown as Entity;
    const ref = resolveRectRotationReference(tilted, { x: 0, y: 0 }, { x: 0, y: 10 })!;
    expect(ref).not.toBeNull();
    // local +X now points along world +Y → axisRef is VERTICAL (constant x).
    expect(ref.cross.axisRef.from.x).toBeCloseTo(0, 6);
    expect(ref.cross.axisRef.to.x).toBeCloseTo(0, 6);
    // local +Y now points along world −X → axisAlign is HORIZONTAL (constant y).
    expect(ref.cross.axisAlign.from.y).toBeCloseTo(0, 6);
    expect(ref.cross.axisAlign.to.y).toBeCloseTo(0, 6);
  });

  it('pivot OFF the handles (box centre) → null (keep current behaviour)', () => {
    expect(resolveRectRotationReference(rect(), { x: 20, y: 10 }, { x: 30, y: 10 })).toBeNull();
  });

  it('NON-rectangle polyline (triangle) → null', () => {
    const tri = {
      type: 'polyline',
      vertices: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 20 }],
      closed: true,
    } as unknown as Entity;
    expect(resolveRectRotationReference(tri, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeNull();
  });

  it('no cursor yet → still resolves (defaults 0° to +X), cross present', () => {
    const ref = resolveRectRotationReference(rect(), { x: 0, y: 0 }, null);
    expect(ref).not.toBeNull();
    expect(ref!.refAnchor.x).toBeCloseTo(1, 6);
  });
});
