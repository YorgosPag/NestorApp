/**
 * ADR-561 — `getArcGrips` SSoT tests (centre MOVE + start/end/mid + rotation handle).
 */
import { getArcGrips, arcRotationHandlePos, ARC_MOVE_KIND, ARC_ROTATION_KIND } from '../arc-grips';
import { gripKindOf } from '../../../hooks/grip-kinds';

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
      gripIndex: 0, type: 'center', position: center, movesEntity: true,
    });
    expect(gripKindOf(centre, 'arc')).toBe(ARC_MOVE_KIND);
  });

  it('rotation handle carries arc-rotation kind and sits midway (−radius/2 below centre)', () => {
    const grips = getArcGrips('A1', center, radius, 0, 90);
    const rot = grips.find((g) => gripKindOf(g, 'arc') === ARC_ROTATION_KIND)!;
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
    expect(gripKindOf(grips[1], 'arc')).toBeUndefined();
    expect(gripKindOf(grips[2], 'arc')).toBeUndefined();
    expect(gripKindOf(grips[3], 'arc')).toBeUndefined();
  });
});
