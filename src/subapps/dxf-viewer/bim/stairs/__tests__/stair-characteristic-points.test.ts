/**
 * ADR-597 §stair — `getStairCharacteristicPoints` tests.
 *
 * Επιβεβαιώνει ότι μια σκάλα εκθέτει ΩΣ snap points:
 *   - ΟΛΕΣ τις θέσεις των grips («ίδια με τα grips», Giorgio 2026-07-11)
 *   - τις γωνίες + τα μέσα ΚΑΘΕ σκαλοπατιού (below ∪ above cut)
 * και ότι όλα τα σημεία είναι πεπερασμένα (finite) 2D world coords.
 */

import {
  buildDefaultStairParams,
  buildStairEntity,
} from '../../../hooks/drawing/stair-completion';
import { getStairGrips } from '../stair-grips';
import { getStairCharacteristicPoints } from '../stair-characteristic-points';
import { getBimCharacteristicPointsOfCategory } from '../../utils/bim-characteristic-points';
import { projectVerticesTo2D, polygon2DAreaCentroid } from '../../geometry/shared/polygon-utils';
import type { StairEntity, StairParams } from '../../../bim/types/stair-types';

const basePoint = { x: 0, y: 0 };

function makeStraight(): StairEntity {
  return buildStairEntity(buildDefaultStairParams(basePoint, 0), '0');
}

function makeLShape(): StairEntity {
  const base = buildDefaultStairParams(basePoint, 0);
  const params: StairParams = {
    ...base,
    variant: {
      kind: 'l-shape',
      cornerStyle: 'landing',
      turnDirection: 'right',
      landingDepth: 'auto',
      flightSplit: [6, 6],
    },
  };
  return buildStairEntity(params, '0');
}

const isFinitePt = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y);
const key = (p: { x: number; y: number }) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;

describe('getStairCharacteristicPoints (ADR-597 §stair)', () => {
  it('περιλαμβάνει ΟΛΕΣ τις θέσεις των grips στα corners', () => {
    const stair = makeStraight();
    const { corners } = getStairCharacteristicPoints(stair);
    const cornerKeys = new Set(corners.map(key));
    for (const grip of getStairGrips(stair)) {
      expect(cornerKeys.has(key(grip.position))).toBe(true);
    }
  });

  it('προσθέτει γωνίες κάθε σκαλοπατιού πέρα από τα grips', () => {
    const stair = makeStraight();
    const gripCount = getStairGrips(stair).length;
    const { corners } = getStairCharacteristicPoints(stair);
    // Τα σκαλοπάτια συνεισφέρουν επιπλέον γωνίες → strictly περισσότερα από μόνο τα grips.
    expect(corners.length).toBeGreaterThan(gripCount);
  });

  it('εκθέτει midpoints ανά ακμή σκαλοπατιού (μη κενό)', () => {
    const { midpoints } = getStairCharacteristicPoints(makeStraight());
    expect(midpoints.length).toBeGreaterThan(0);
  });

  it('όλα τα σημεία είναι πεπερασμένα (finite) 2D coords', () => {
    for (const stair of [makeStraight(), makeLShape()]) {
      const { corners, midpoints } = getStairCharacteristicPoints(stair);
      expect(corners.every(isFinitePt)).toBe(true);
      expect(midpoints.every(isFinitePt)).toBe(true);
    }
  });

  it('δουλεύει και για non-straight (l-shape) — μη κενά corners', () => {
    const { corners } = getStairCharacteristicPoints(makeLShape());
    expect(corners.length).toBeGreaterThan(0);
  });

  it('περιλαμβάνει τα vertices των πλατύσκαλων (landings) — η ΓΩΝΙΑΚΗ περιοχή L/U', () => {
    const stair = makeLShape();
    const landings = stair.geometry.landings ?? [];
    expect(landings.length).toBeGreaterThan(0); // η l-shape landing έχει γωνιακό πλατύσκαλο
    const cornerKeys = new Set(getStairCharacteristicPoints(stair).corners.map(key));
    for (const landing of landings) {
      for (const v of projectVerticesTo2D(landing)) {
        expect(cornerKeys.has(key(v))).toBe(true);
      }
    }
  });

  it('εκθέτει area-centroid ανά σκαλοπάτι/πλατύσκαλο (finite, μη κενό)', () => {
    for (const stair of [makeStraight(), makeLShape()]) {
      const { centers } = getStairCharacteristicPoints(stair);
      expect(centers.length).toBeGreaterThan(0);
      expect(centers.every(isFinitePt)).toBe(true);
    }
  });

  it('περιλαμβάνει το ΚΕΝΤΡΟ του γωνιακού πλατύσκαλου στα centers', () => {
    const stair = makeLShape();
    const landings = stair.geometry.landings ?? [];
    expect(landings.length).toBeGreaterThan(0);
    const centerKeys = new Set(getStairCharacteristicPoints(stair).centers.map(key));
    for (const landing of landings) {
      expect(centerKeys.has(key(polygon2DAreaCentroid(projectVerticesTo2D(landing))))).toBe(true);
    }
  });

  it('end-to-end: getBimCharacteristicPointsOfCategory(stair, "center") → πολλά centers', () => {
    const centers = getBimCharacteristicPointsOfCategory(makeLShape(), 'center');
    expect(centers.length).toBeGreaterThan(1);
  });
});
