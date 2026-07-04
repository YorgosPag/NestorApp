/**
 * ADR-561 — `getArcGrips` SSoT tests (centre MOVE + start/end/mid + rotation handle).
 */
import { getArcGrips, arcRotationHandlePos, applyArcRotationDrag, ARC_MOVE_KIND, ARC_ROTATION_KIND } from '../arc-grips';
import { rotateEntity } from '../../../utils/rotation-math';
import type { Entity } from '../../../types/entities';

describe('getArcGrips (ADR-561)', () => {
  const center = { x: 0, y: 0 };
  const radius = 10;

  it('emits exactly 5 grips: centre MOVE + start + end + mid + rotation', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    expect(grips).toHaveLength(5);
  });

  it('centre grip is a whole-entity MOVE with the arc-move kind', () => {
    const [centre] = getArcGrips('A1', center, radius, 0, 90);
    expect(centre).toMatchObject({
      gripIndex: 0, type: 'center', position: center, movesEntity: true, arcGripKind: ARC_MOVE_KIND,
    });
  });

  it('rotation handle carries arc-rotation kind and sits midway (−radius/2 below centre)', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    const rot = grips.find((g) => g.arcGripKind === ARC_ROTATION_KIND)!;
    expect(rot).toBeDefined();
    expect(rot.type).toBe('vertex');
    expect(rot.movesEntity).toBe(false);
    expect(rot.position).toEqual({ x: 0, y: -radius / 2 });
    expect(arcRotationHandlePos(center, radius)).toEqual({ x: 0, y: -radius / 2 });
  });

  it('start/end endpoints sit on the circumference at the given angles', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    expect(grips[1].position.x).toBeCloseTo(10, 6); // start @ 0° → (r, 0)
    expect(grips[1].position.y).toBeCloseTo(0, 6);
    expect(grips[2].position.x).toBeCloseTo(0, 6);  // end @ 90° → (0, r)
    expect(grips[2].position.y).toBeCloseTo(10, 6);
  });

  it('start/end/mid grips carry NO arcGripKind (standard reshape / whole-move)', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    expect(grips[1].arcGripKind).toBeUndefined();
    expect(grips[2].arcGripKind).toBeUndefined();
    expect(grips[3].arcGripKind).toBeUndefined();
  });
});

describe('applyArcRotationDrag (ADR-561 — live rotation ghost)', () => {
  it('rotates 90° CCW about the arc centre: centre fixed, both angles offset by the sweep', () => {
    // anchor @ 0° (east), cursor @ 90° (north) → swept = +90° CCW.
    const rotated = applyArcRotationDrag({
      center: { x: 0, y: 0 }, startAngleDeg: 0, endAngleDeg: 90,
      anchor: { x: 10, y: 0 }, currentPos: { x: 0, y: 10 },
    });
    expect(rotated).not.toBeNull();
    expect(rotated!.center).toEqual({ x: 0, y: 0 });
    expect(rotated!.startAngle).toBeCloseTo(90, 6);
    expect(rotated!.endAngle).toBeCloseTo(180, 6);
  });

  it('orbits the centre about an EXTERNAL pivot (AutoCAD ROTATE «specify centre»)', () => {
    const rotated = applyArcRotationDrag({
      center: { x: 10, y: 0 }, startAngleDeg: 0, endAngleDeg: 90,
      anchor: { x: 1, y: 0 }, currentPos: { x: 0, y: 1 }, pivot: { x: 0, y: 0 },
    });
    expect(rotated).not.toBeNull();
    expect(rotated!.center.x).toBeCloseTo(0, 6);   // (10,0) rotated +90° about origin → (0,10)
    expect(rotated!.center.y).toBeCloseTo(10, 6);
  });

  it('returns null for a degenerate / zero sweep (cursor on the pivot)', () => {
    expect(applyArcRotationDrag({
      center: { x: 0, y: 0 }, startAngleDeg: 0, endAngleDeg: 90,
      anchor: { x: 10, y: 0 }, currentPos: { x: 0, y: 0 }, pivot: { x: 0, y: 0 },
    })).toBeNull();
  });

  it('is byte-identical to the commit SSoT (rotateEntity arc case) for the same sweep', () => {
    const arc = { type: 'arc', center: { x: 5, y: 5 }, radius: 10, startAngle: 30, endAngle: 120 };
    const pivot = { x: 0, y: 0 };
    const anchor = { x: 10, y: 0 };   // 0°
    const currentPos = { x: 0, y: 10 }; // 90° → swept = +90°
    const viaPreview = applyArcRotationDrag({
      center: arc.center, startAngleDeg: arc.startAngle, endAngleDeg: arc.endAngle, anchor, currentPos, pivot,
    });
    const viaCommit = rotateEntity(arc as unknown as Entity, pivot, 90) as {
      center: { x: number; y: number }; startAngle: number; endAngle: number;
    };
    expect(viaPreview!.center.x).toBeCloseTo(viaCommit.center.x, 6);
    expect(viaPreview!.center.y).toBeCloseTo(viaCommit.center.y, 6);
    expect(viaPreview!.startAngle).toBeCloseTo(viaCommit.startAngle, 6);
    expect(viaPreview!.endAngle).toBeCloseTo(viaCommit.endAngle, 6);
  });
});
