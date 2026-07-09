/**
 * ADR-561 — `getCircleGrips` SSoT tests (centre MOVE cross + 4 quadrants, NO rotation).
 */
import { getCircleGrips, circleQuadrantPoints, CIRCLE_MOVE_KIND } from '../circle-grips';
import { gripKindOf } from '../../../hooks/grip-kinds';

describe('getCircleGrips (ADR-561)', () => {
  const center = { x: 10, y: 20 };
  const radius = 5;

  it('emits exactly 5 grips: 1 centre MOVE + 4 quadrants', () => {
    const grips = getCircleGrips('C1', center, radius);
    expect(grips).toHaveLength(5);
  });

  it('centre grip is a whole-entity MOVE with the circle-move kind (→ 4-arrow glyph)', () => {
    const [centre] = getCircleGrips('C1', center, radius);
    expect(centre).toMatchObject({
      entityId: 'C1', gripIndex: 0, type: 'center', position: center,
      movesEntity: true,
    });
    expect(gripKindOf(centre, 'circle')).toBe(CIRCLE_MOVE_KIND);
  });

  it('emits NO rotation grip (circle is symmetric — parity ADR-519)', () => {
    const grips = getCircleGrips('C1', center, radius);
    expect(grips.some((g) => gripKindOf(g, 'circle') === 'circle-move')).toBe(true);
    // No kind other than the move exists, and no 'rotation'-shaped kind at all.
    expect(grips.filter((g) => gripKindOf(g, 'circle')).map((g) => gripKindOf(g, 'circle'))).toEqual(['circle-move']);
  });

  // The 4 radius-edit handles are typed 'vertex' (STRUCTURAL) so they are ALWAYS shown
  // on a selected circle (Giorgio 2026-07-09) — `isGripTypeVisible` never gates 'vertex',
  // so they survive the «Εμφάνιση Quadrants» toggle AND the multi-select transform-glyph
  // hide (wall-corner / circular-column parity, ADR-519). The 'vertex' type ALSO unlocks
  // the radius drag: `grip-to-vertex-refs.refsForCircle` maps type==='vertex' + gripIndex
  // 1-4 → 'circle-quadrant' (the previous 'quadrant' type made that resolver return []).
  it('radius handles are typed "vertex" (structural, radius edit), not entity-moving', () => {
    const quads = getCircleGrips('C1', center, radius).slice(1);
    expect(quads).toHaveLength(4);
    for (const q of quads) {
      expect(q.type).toBe('vertex');
      expect(q.movesEntity).toBe(false);
      expect(gripKindOf(q, 'circle')).toBeUndefined();
    }
  });

  it('quadrant positions are the E/N/W/S cardinal points', () => {
    expect(circleQuadrantPoints(center, radius)).toEqual([
      { x: 15, y: 20 }, { x: 10, y: 25 }, { x: 5, y: 20 }, { x: 10, y: 15 },
    ]);
  });
});
