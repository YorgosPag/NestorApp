/**
 * ADR-441 Slice COL/WALL — resolve-axis-bindings tests.
 *
 * Host-on-snap: coordinate πάνω σε άξονα → GuideBinding. Καλύπτει: X/Y match, tolerance,
 * πλησιέστερος άξονας, αγνόηση μη-ορατών, ελεύθερο coordinate (κανένα binding).
 */

import { resolveAxisBindings, axisHostTolScene, AXIS_HOST_TOL_MM } from '../resolve-axis-bindings';
import type { AxisGuideReader } from '../../foundations/foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';

const guide = (id: string, axis: Guide['axis'], offset: number, visible = true): Guide =>
  ({ id, axis, offset, visible } as Guide);

const reader = (guides: readonly Guide[]): AxisGuideReader => ({
  getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis),
});

describe('resolveAxisBindings', () => {
  const r = reader([guide('xA', 'X', 100), guide('xB', 'X', 900), guide('yA', 'Y', 50)]);

  it('δένει coordinate που πέφτει σε άξονα (center-x/center-y)', () => {
    const bindings = resolveAxisBindings(
      [{ axis: 'X', value: 100, slot: 'center-x' }, { axis: 'Y', value: 50, slot: 'center-y' }],
      r,
      AXIS_HOST_TOL_MM,
    );
    expect(bindings).toEqual([
      { guideId: 'xA', slot: 'center-x' },
      { guideId: 'yA', slot: 'center-y' },
    ]);
  });

  it('αγνοεί coordinate μακριά από κάθε άξονα (ελεύθερο)', () => {
    const bindings = resolveAxisBindings([{ axis: 'X', value: 500, slot: 'center-x' }], r, AXIS_HOST_TOL_MM);
    expect(bindings).toEqual([]);
  });

  it('εντός tolerance δένει, εκτός όχι', () => {
    expect(resolveAxisBindings([{ axis: 'X', value: 100.5, slot: 'center-x' }], r, 1)).toHaveLength(1);
    expect(resolveAxisBindings([{ axis: 'X', value: 102, slot: 'center-x' }], r, 1)).toHaveLength(0);
  });

  it('διαλέγει τον πλησιέστερο άξονα', () => {
    const close = reader([guide('x1', 'X', 100), guide('x2', 'X', 101)]);
    const [b] = resolveAxisBindings([{ axis: 'X', value: 100.9, slot: 'center-x' }], close, 5);
    expect(b.guideId).toBe('x2');
  });

  it('αγνοεί μη-ορατούς άξονες', () => {
    const hidden = reader([guide('xH', 'X', 100, false)]);
    expect(resolveAxisBindings([{ axis: 'X', value: 100, slot: 'center-x' }], hidden, 1)).toHaveLength(0);
  });
});

describe('axisHostTolScene', () => {
  it('scale-aware: mm → 1, m → 0.001', () => {
    expect(axisHostTolScene('mm')).toBeCloseTo(1, 9);
    expect(axisHostTolScene('m')).toBeCloseTo(0.001, 9);
  });
});
