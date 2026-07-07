/**
 * ADR-557 — isDiscreteSnapTarget: the shared «discrete point vs construction line» filter.
 *
 * A grip-drag OSNAP that lands on a CONSTRUCTION line (extension / perpendicular / parallel / …) —
 * present along every edge, everywhere — must NOT count as an OSNAP hit that suppresses the discrete
 * AutoAlign cyan traces. A moving MTEXT kept crossing neighbour line EXTENSION rays, so its neighbour
 * cyan was permanently drowned while a single-line TEXT (fewer such hits) showed them (Giorgio
 * browser-verify 2026-07-07). `resolveGripDragSnap` now filters through this SAME predicate the
 * corner-projection already used — one SSoT, so a weak construction snap never wins over a discrete one.
 */
import { isDiscreteSnapTarget } from '../corner-projection-snap';
import type { ProSnapResult } from '../../../snapping/extended-types';

const withMode = (mode: string) => ({ activeMode: mode } as unknown as ProSnapResult);

describe('ADR-557 — isDiscreteSnapTarget', () => {
  it('REJECTS construction-line snap modes (they exist everywhere)', () => {
    for (const mode of ['extension', 'perpendicular', 'parallel', 'nearest', 'near', 'tangent', 'ortho']) {
      expect(isDiscreteSnapTarget(withMode(mode))).toBe(false);
    }
  });

  it('ACCEPTS discrete characteristic-point snap modes', () => {
    for (const mode of ['endpoint', 'midpoint', 'center', 'intersection', 'node', 'quadrant', 'insertion']) {
      expect(isDiscreteSnapTarget(withMode(mode))).toBe(true);
    }
  });

  it('treats a missing/undefined mode as discrete (not a construction line → does not silently drop)', () => {
    expect(isDiscreteSnapTarget({} as unknown as ProSnapResult)).toBe(true);
  });
});
