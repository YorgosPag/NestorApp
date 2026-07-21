/**
 * ADR-561 — `getArcGrips` SSoT tests.
 *
 * Handles now sit ON the visible curve at the arc midpoint (Giorgio 2026-07-21):
 *   - centre  → plain whole-move grip, NO glyph (AutoCAD-style square)
 *   - midpoint→ the 4-arrow MOVE glyph (`arc-move`)
 *   - rotation→ just OUTSIDE the midpoint (`arc-rotation`), on/beside the curve
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

  it('MOVE glyph lives on the curve at the arc midpoint (grip 3)', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    const move = grips[3];
    expect(gripKindOf(move, 'arc')).toBe(ARC_MOVE_KIND);
    expect(move.movesEntity).toBe(true);
    // midpoint of a 0→90° arc @ r=10 → 45° on the circumference
    expect(move.position.x).toBeCloseTo(10 * Math.cos(Math.PI / 4), 6);
    expect(move.position.y).toBeCloseTo(10 * Math.sin(Math.PI / 4), 6);
  });

  it('rotation handle carries arc-rotation kind and sits just OUTSIDE the arc midpoint', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    const rot = grips.find((g) => gripKindOf(g, 'arc') === ARC_ROTATION_KIND)!;
    expect(rot).toBeDefined();
    expect(rot.type).toBe('vertex');
    expect(rot.movesEntity).toBe(false);

    const expected = arcRotationHandlePos(center, radius, 0, 90);
    expect(rot.position).toEqual(expected);
    // radially outside the midpoint (factor 1.18) along the 45° mid-sweep angle
    expect(expected.x).toBeCloseTo(radius * 1.18 * Math.cos(Math.PI / 4), 6);
    expect(expected.y).toBeCloseTo(radius * 1.18 * Math.sin(Math.PI / 4), 6);
    // ...and strictly beyond the curve (|handle| > radius)
    expect(Math.hypot(expected.x, expected.y)).toBeGreaterThan(radius);
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
