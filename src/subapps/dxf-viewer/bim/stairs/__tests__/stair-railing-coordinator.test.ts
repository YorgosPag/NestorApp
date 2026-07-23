/**
 * ADR-407 Φ7 — stair→railing coordinator: create-on-stair, orphan delete, paint-preserving
 * update, perf gate, idempotency. Runs the cascade over an in-memory scene manager.
 */

import { cascadeStairRailings } from '../stair-railing-coordinator';
import { stairRailingId } from '../stair-railing-plan';
import type { StairEntity } from '../../types/stair-types';
import { DEFAULT_RAILING_TYPE } from '../../types/railing-types';

interface AnyEntity {
  id: string;
  type: string;
  [k: string]: unknown;
}

function makeSceneManager(initial: AnyEntity[]) {
  const map = new Map<string, AnyEntity>(initial.map((e) => [e.id, e]));
  return {
    getEntity: (id: string) => map.get(id),
    getEntities: () => [...map.values()],
    addEntity: (e: AnyEntity) => { map.set(e.id, e); },
    updateEntities: (patches: Map<string, Partial<AnyEntity>>) => {
      for (const [id, p] of patches) map.set(id, { ...map.get(id)!, ...p });
    },
    removeEntity: (id: string) => { map.delete(id); },
  };
}

function stairFixture(patch: { handrails?: Partial<StairEntity['params']['handrails']> } = {}): StairEntity {
  return {
    id: 'stair-1',
    type: 'stair',
    kind: 'straight',
    layerId: '0',
    params: {
      width: 1200,
      totalRise: 2000,
      totalRun: 2800,
      stepCount: 12,
      handrails: { inner: true, outer: true, height: 900, ...patch.handrails },
    },
    geometry: {
      handrails: {
        inner: [{ x: 0, y: 0, z: 0 }, { x: 2800, y: 0, z: 2000 }],
        outer: [{ x: 0, y: 100, z: 0 }, { x: 2800, y: 100, z: 2000 }],
      },
    },
  } as unknown as StairEntity;
}

describe('cascadeStairRailings', () => {
  it('auto-creates one hosted railing per active handrail side of a new stair', () => {
    const sm = makeSceneManager([stairFixture() as unknown as AnyEntity]);
    const res = cascadeStairRailings(sm, { changedIds: ['stair-1'] });
    expect(res.created).toHaveLength(2);
    const railings = sm.getEntities().filter((e) => e.type === 'railing');
    expect(railings).toHaveLength(2);
    const r0 = railings[0] as unknown as { params: { pathSource: { kind: string; hostType: string } }; geometry: { rails: unknown[] } };
    expect(r0.params.pathSource.kind).toBe('hosted');
    expect(r0.params.pathSource.hostType).toBe('stair');
    expect(r0.geometry.rails.length).toBeGreaterThan(0); // real solid, not empty
  });

  it('skips entirely when the changed ids touch no stair (perf gate)', () => {
    const sm = makeSceneManager([stairFixture() as unknown as AnyEntity]);
    const res = cascadeStairRailings(sm, { changedIds: ['some-column'] });
    expect(res.created).toHaveLength(0);
  });

  it('deletes an orphan railing whose stair no longer exists', () => {
    const orphan: AnyEntity = {
      id: stairRailingId('stair-ghost', 'outer'),
      type: 'railing',
      kind: 'railing',
      layerId: '0',
      params: {
        type: DEFAULT_RAILING_TYPE,
        pathSource: { kind: 'hosted', hostId: 'stair-ghost', hostType: 'stair', side: 'outer' },
        totalHeightMm: 1000,
        baseElevationMm: 0,
        sceneUnits: 'mm',
      },
      geometry: {},
      visible: true,
    };
    const sm = makeSceneManager([orphan]);
    const res = cascadeStairRailings(sm);
    expect(res.deleted).toEqual([orphan.id]);
    expect(sm.getEntities()).toHaveLength(0);
  });

  it('refreshes an existing railing path while preserving its paint', () => {
    const stair = stairFixture({ handrails: { inner: false } }); // outer only
    const existing: AnyEntity = {
      id: stairRailingId('stair-1', 'outer'),
      type: 'railing',
      kind: 'railing',
      layerId: '0',
      params: {
        type: DEFAULT_RAILING_TYPE,
        pathSource: {
          kind: 'hosted', hostId: 'stair-1', hostType: 'stair', side: 'outer',
          resolvedPath: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }], // stale
        },
        totalHeightMm: 1000,
        baseElevationMm: 0,
        sceneUnits: 'mm',
        appearance: { colorHex: '#ff0000' },
      },
      geometry: {},
      visible: true,
    };
    const sm = makeSceneManager([stair as unknown as AnyEntity, existing]);
    const res = cascadeStairRailings(sm, { changedIds: ['stair-1'] });
    expect(res.updated).toEqual([existing.id]);
    const updated = sm.getEntity(existing.id) as unknown as {
      params: { appearance: unknown; pathSource: { resolvedPath: { x: number }[] } };
    };
    expect(updated.params.appearance).toEqual({ colorHex: '#ff0000' }); // paint survives
    expect(updated.params.pathSource.resolvedPath[1].x).toBeCloseTo(2800); // path refreshed to the stair
  });

  it('is idempotent — a second run over an unchanged stair does nothing', () => {
    const stair = stairFixture({ handrails: { inner: false } });
    const sm = makeSceneManager([stair as unknown as AnyEntity]);
    cascadeStairRailings(sm, { changedIds: ['stair-1'] }); // creates outer
    const res2 = cascadeStairRailings(sm, { changedIds: ['stair-1'] });
    expect(res2.created).toHaveLength(0);
    expect(res2.updated).toHaveLength(0);
  });
});
