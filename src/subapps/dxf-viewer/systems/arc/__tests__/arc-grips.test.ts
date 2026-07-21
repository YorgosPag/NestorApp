/**
 * ADR-561 — `getArcGrips` SSoT tests.
 *
 * Both handles now sit ON the visible curve (Giorgio 2026-07-21):
 *   - centre   → plain whole-move grip, NO glyph (AutoCAD-style square)
 *   - 1/3 sweep→ the 4-arrow MOVE glyph (`arc-move`), ON the curve
 *   - 2/3 sweep→ the rotation handle (`arc-rotation`), ON the curve
 */
import { getArcGrips, arcRotationHandlePos, ARC_MOVE_KIND, ARC_ROTATION_KIND } from '../arc-grips';
import { gripKindOf } from '../../../hooks/grip-kinds';

describe('getArcGrips (ADR-561)', () => {
  const center = { x: 0, y: 0 };
  const radius = 10;

  it('emits exactly 5 grips: centre + start + end + mid(MOVE) + rotation', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    expect(grips).toHaveLength(5);
  });

  it('centre grip is a plain whole-entity MOVE with NO glyph kind (AutoCAD square)', () => {
    const [centre] = getArcGrips('A1', center, radius, 0, 90);
    expect(centre).toMatchObject({
      gripIndex: 0, type: 'center', position: center, movesEntity: true,
    });
    expect(gripKindOf(centre, 'arc')).toBeUndefined();
  });

  it('MOVE glyph lives ON the curve at 1/3 of the sweep (grip 3)', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    const move = grips[3];
    expect(gripKindOf(move, 'arc')).toBe(ARC_MOVE_KIND);
    expect(move.movesEntity).toBe(true);
    // 1/3 of a 0→90° sweep → 30° on the circumference
    const a = (Math.PI / 2) * (1 / 3);
    expect(move.position.x).toBeCloseTo(10 * Math.cos(a), 6);
    expect(move.position.y).toBeCloseTo(10 * Math.sin(a), 6);
    // strictly ON the curve (|move| == radius)
    expect(Math.hypot(move.position.x, move.position.y)).toBeCloseTo(radius, 6);
  });

  it('rotation handle carries arc-rotation kind and sits ON the curve at 2/3 of the sweep', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    const rot = grips.find((g) => gripKindOf(g, 'arc') === ARC_ROTATION_KIND)!;
    expect(rot).toBeDefined();
    expect(rot.type).toBe('vertex');
    expect(rot.movesEntity).toBe(false);

    const expected = arcRotationHandlePos(center, radius, 0, 90);
    expect(rot.position).toEqual(expected);
    // 2/3 of a 0→90° sweep → 60° on the circumference
    const a = (Math.PI / 2) * (2 / 3);
    expect(expected.x).toBeCloseTo(radius * Math.cos(a), 6);
    expect(expected.y).toBeCloseTo(radius * Math.sin(a), 6);
    // strictly ON the curve (|handle| == radius)
    expect(Math.hypot(expected.x, expected.y)).toBeCloseTo(radius, 6);
  });

  it('start/end endpoints sit on the circumference at the given angles', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    expect(grips[1].position.x).toBeCloseTo(10, 6); // start @ 0° → (r, 0)
    expect(grips[1].position.y).toBeCloseTo(0, 6);
    expect(grips[2].position.x).toBeCloseTo(0, 6);  // end @ 90° → (0, r)
    expect(grips[2].position.y).toBeCloseTo(10, 6);
  });

  it('only mid(MOVE) + rotation carry an arcGripKind; centre + start/end do not', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    expect(gripKindOf(grips[0], 'arc')).toBeUndefined();
    expect(gripKindOf(grips[1], 'arc')).toBeUndefined();
    expect(gripKindOf(grips[2], 'arc')).toBeUndefined();
    expect(gripKindOf(grips[3], 'arc')).toBe(ARC_MOVE_KIND);
    expect(gripKindOf(grips[4], 'arc')).toBe(ARC_ROTATION_KIND);
  });
});
