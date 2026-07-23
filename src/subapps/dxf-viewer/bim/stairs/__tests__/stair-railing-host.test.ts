/**
 * ADR-407 Φ7 — stair→railing host resolver: side detection, units-safe path, per-tread anchors.
 */

import {
  buildStairRailingHost,
  stairRailingSides,
} from '../stair-railing-host';
import type { StairEntity } from '../../types/stair-types';

function stairFixture(patch: {
  handrails?: Partial<StairEntity['params']['handrails']>;
  innerPoly?: boolean;
  outerPoly?: boolean;
} = {}): StairEntity {
  return {
    id: 'stair-1',
    type: 'stair',
    kind: 'straight',
    layerId: '0',
    params: {
      // width ≥ 100 → inferSceneUnitsFromWidth = 'mm' → z passes through unchanged.
      width: 1200,
      totalRise: 2000,
      totalRun: 2800,
      stepCount: 12,
      handrails: { inner: true, outer: true, height: 900, ...patch.handrails },
    },
    geometry: {
      handrails: {
        inner: patch.innerPoly === false ? undefined : [{ x: 0, y: 0, z: 0 }, { x: 2800, y: 0, z: 2000 }],
        outer: patch.outerPoly === false ? undefined : [{ x: 0, y: 100, z: 0 }, { x: 2800, y: 100, z: 2000 }],
      },
    },
  } as unknown as StairEntity;
}

describe('stairRailingSides', () => {
  it('returns both sides when both handrails are active with geometry', () => {
    expect(stairRailingSides(stairFixture())).toEqual(['inner', 'outer']);
  });

  it('drops a side whose handrail toggle is off', () => {
    expect(stairRailingSides(stairFixture({ handrails: { inner: false } }))).toEqual(['outer']);
  });

  it('drops a side whose rail polyline is missing', () => {
    expect(stairRailingSides(stairFixture({ outerPoly: false }))).toEqual(['inner']);
  });
});

describe('buildStairRailingHost', () => {
  it('carries the stair rail polyline as the resolved path (mm z, hosted link)', () => {
    const host = buildStairRailingHost(stairFixture(), 'outer');
    expect(host).not.toBeNull();
    expect(host!.hostId).toBe('stair-1');
    expect(host!.hostType).toBe('stair');
    expect(host!.resolvedPath).toHaveLength(2);
    expect(host!.resolvedPath[1].z).toBeCloseTo(2000); // scene 'mm' → mm pass-through
  });

  it('reports the flight slope ratio (rise / run)', () => {
    const host = buildStairRailingHost(stairFixture(), 'outer');
    expect(host!.slopeRatio).toBeCloseTo(2000 / 2800);
  });

  it('bakes the scalar tread count (positions derived live from resolvedPath, ADR-407 Φ7b)', () => {
    const host = buildStairRailingHost(stairFixture(), 'outer');
    expect(host!.treadCount).toBe(12); // stepCount
    // No baked anchor POSITIONS — the engine re-derives them from resolvedPath (self-healing SSoT).
    expect(host!.perTreadAnchors).toBeUndefined();
  });

  it('returns null for a side without a rail polyline', () => {
    expect(buildStairRailingHost(stairFixture({ innerPoly: false }), 'inner')).toBeNull();
  });
});
