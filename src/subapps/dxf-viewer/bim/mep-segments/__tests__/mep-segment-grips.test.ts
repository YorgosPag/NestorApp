/**
 * ADR-408 Φ8/Φ15 — getMepSegmentGrips.
 *
 * Pins the grip set for the two segment shapes:
 *  - horizontal/sloped run → full parametric grips (start/end/midpoint/…)
 *  - VERTICAL riser → a SINGLE whole-entity move grip (Revit point-object in plan),
 *    so a plan drag translates the stack instead of pulling one endpoint off-axis
 *    and destroying the riser.
 */

import { getMepSegmentGrips } from '../mep-segment-grips';
import { deriveCenterlineElevationMm } from '../../types/mep-segment-types';
import type { MepSegmentEntity } from '../../types/mep-segment-types';

function segment(
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
): MepSegmentEntity {
  return {
    id: 's1',
    type: 'mep-segment',
    kind: 'pipe',
    params: {
      domain: 'pipe',
      sectionKind: 'round',
      startPoint: start,
      endPoint: end,
      diameter: 100,
      centerlineElevationMm: deriveCenterlineElevationMm(start.z, end.z),
    },
  } as unknown as MepSegmentEntity;
}

describe('getMepSegmentGrips — vertical riser (ADR-408 Φ15)', () => {
  it('a vertical riser exposes a SINGLE whole-entity move grip', () => {
    const riser = segment({ x: 100, y: 200, z: 0 }, { x: 100, y: 200, z: 3000 });
    const grips = getMepSegmentGrips(riser);

    expect(grips).toHaveLength(1);
    expect(grips[0].mepSegmentGripKind).toBe('mep-segment-midpoint');
    expect(grips[0].movesEntity).toBe(true);
    expect(grips[0].position).toEqual({ x: 100, y: 200 });
  });

  // ADR-363 Φ1G.5 Slice 2 — central move grip removed from horizontal segments
  it('a horizontal run has start/end/section/rotation but NO midpoint grip', () => {
    const run = segment({ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 });
    const grips = getMepSegmentGrips(run);

    // start(0) + end(1) + section(3) + rotation(4) = 4 grips; midpoint removed
    expect(grips).toHaveLength(4);
    const kinds = grips.map((g) => g.mepSegmentGripKind);
    expect(kinds).toContain('mep-segment-start');
    expect(kinds).toContain('mep-segment-end');
    expect(kinds).not.toContain('mep-segment-midpoint');
    expect(kinds).toContain('mep-segment-section');
    expect(kinds).toContain('mep-segment-rotation');
  });
});
