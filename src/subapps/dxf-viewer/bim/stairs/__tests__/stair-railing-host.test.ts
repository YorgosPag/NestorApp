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
      // 6 treads climbing the flight (top z stepped): centroids at y=50 → project onto the
      // outer railing line (y=100) at their plan x, seated at the tread top z.
      treadsBelowCut: Array.from({ length: 6 }, (_, i) => {
        const x = (i * 2800) / 6;
        const z = (i * 2000) / 6;
        return [
          { x, y: 0, z }, { x: x + 200, y: 0, z }, { x: x + 200, y: 100, z }, { x, y: 100, z },
        ];
      }),
      treadsAboveCut: [],
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

  it('bakes one tread anchor per tread, seated on the railing line at the tread-top z (Φ7c)', () => {
    const host = buildStairRailingHost(stairFixture(), 'outer');
    expect(host!.perTreadAnchors).toHaveLength(6); // one per tread
    // Anchors are seated ON the outer railing line (y = 100), NOT the tread centroid (y = 50).
    expect(host!.perTreadAnchors!.every((a) => Math.abs((a.y ?? 0) - 100) < 1e-6)).toBe(true);
    // z is the STEPPED tread top, ascending bottom → top.
    const zs = host!.perTreadAnchors!.map((a) => a.z ?? 0);
    expect(zs[0]).toBeCloseTo(0);
    expect(zs[5]).toBeCloseTo((5 * 2000) / 6);
    expect(zs.every((z, i) => i === 0 || z > zs[i - 1])).toBe(true);
  });

  it('omits tread anchors when the stair carries no tread geometry (defensive)', () => {
    const s = stairFixture();
    (s as unknown as { geometry: { treadsBelowCut: unknown[]; treadsAboveCut: unknown[] } }).geometry.treadsBelowCut = [];
    (s as unknown as { geometry: { treadsBelowCut: unknown[]; treadsAboveCut: unknown[] } }).geometry.treadsAboveCut = [];
    expect(buildStairRailingHost(s, 'outer')!.perTreadAnchors).toBeUndefined();
  });

  it('returns null for a side without a rail polyline', () => {
    expect(buildStairRailingHost(stairFixture({ innerPoly: false }), 'inner')).toBeNull();
  });
});
