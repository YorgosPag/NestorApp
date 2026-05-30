/**
 * ADR-401 Phase B — wallSection profile-at-cut tests.
 *
 * Επιβεβαιώνει ότι η εγκάρσια τομή αποτιμά το `WallTopProfile` στο σημείο της
 * τομής (single-point top): σκαλωτή κορυφή → διαφορετικό `yMax` ανά θέση cut.
 */

import { wallSection, type WallPlan } from '../section-intersect';
import { resolveWallTopProfile } from '../../../bim/geometry/wall-top-profile';
import { makeResolveHost, type Pt2 } from '../../../bim/geometry/wall-host-plan-builder';

const START: Pt2 = { x: 0, y: 0 };
const END: Pt2 = { x: 10, y: 0 };

function steppedWallPlan(): WallPlan {
  // δοκάρι underside 2500mm καλύπτει t∈[0.4,0.6]· ceiling baseline 2850mm.
  const resolveHost = makeResolveHost(START, END, [
    { hostId: 'beam1', hostType: 'beam', footprint: [
      { x: 4, y: -1 }, { x: 6, y: -1 }, { x: 6, y: 1 }, { x: 4, y: 1 },
    ], undersideZmm: 2500 },
  ]);
  const topProfile = resolveWallTopProfile(
    { baseBinding: 'storey-floor', topBinding: 'attached', baseOffset: 0, topOffset: 0, height: 2850, attachTopToIds: ['beam1'] },
    { floorElevationMm: 0, nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150, resolveHost },
  );
  return {
    id: 'w1', sx: 0, sy: 0, ex: 10, ey: 0,
    thicknessM: 0.2, baseY: 0, topY: topProfile.maxTopZmm * 0.001, topProfile,
  };
}

describe('wallSection — ADR-401 profile-at-cut', () => {
  const w = steppedWallPlan();

  it('cut μέσα στο δοκάρι (x=5) → yMax = 2.5m', () => {
    const rect = wallSection(w, 'x', 5);
    expect(rect).not.toBeNull();
    expect(rect?.yMin).toBeCloseTo(0, 6);
    expect(rect?.yMax).toBeCloseTo(2.5, 6);
  });

  it('cut εκτός δοκαριού (x=2) → yMax = 2.85m (storey-ceiling)', () => {
    expect(wallSection(w, 'x', 2)?.yMax).toBeCloseTo(2.85, 6);
  });

  it('cut στην άλλη άκρη (x=8) → yMax = 2.85m', () => {
    expect(wallSection(w, 'x', 8)?.yMax).toBeCloseTo(2.85, 6);
  });

  it('flat (μη-attached) wall → yMax = topY παντού', () => {
    const flat: WallPlan = { id: 'f', sx: 0, sy: 0, ex: 10, ey: 0, thicknessM: 0.2, baseY: 0, topY: 2.85 };
    expect(wallSection(flat, 'x', 5)?.yMax).toBeCloseTo(2.85, 6);
  });

  it('cut εκτός τοίχου → null', () => {
    expect(wallSection(w, 'x', 50)).toBeNull();
  });
});
