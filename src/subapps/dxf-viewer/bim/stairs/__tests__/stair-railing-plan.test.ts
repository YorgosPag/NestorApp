/**
 * ADR-407 Φ7 — stair→railing planner: create/update/delete diff + deterministic id + managed ref.
 */

import {
  managedStairRailingRef,
  planStairRailings,
  stairRailingId,
  type ManagedStairRailing,
} from '../stair-railing-plan';
import type { StairEntity } from '../../types/stair-types';
import type { RailingEntity } from '../../types/railing-types';

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

const managedFor = (side: 'inner' | 'outer'): ManagedStairRailing => ({
  railingId: stairRailingId('stair-1', side),
  stairId: 'stair-1',
  side,
});

describe('stairRailingId', () => {
  it('is deterministic per (stairId, side) and distinct across sides', () => {
    expect(stairRailingId('stair-1', 'outer')).toBe(stairRailingId('stair-1', 'outer'));
    expect(stairRailingId('stair-1', 'outer')).not.toBe(stairRailingId('stair-1', 'inner'));
  });
});

describe('managedStairRailingRef', () => {
  it('resolves a stair-hosted railing back to (stairId, side)', () => {
    const hosted = {
      id: 'r1',
      params: { pathSource: { kind: 'hosted', hostId: 'stair-1', hostType: 'stair', side: 'outer' } },
    } as unknown as RailingEntity;
    expect(managedStairRailingRef(hosted)).toEqual({ railingId: 'r1', stairId: 'stair-1', side: 'outer' });
  });

  it('ignores a user sketch railing', () => {
    const sketch = {
      id: 'r2',
      params: { pathSource: { kind: 'sketch', path: [] } },
    } as unknown as RailingEntity;
    expect(managedStairRailingRef(sketch)).toBeNull();
  });
});

describe('planStairRailings', () => {
  it('creates one railing per active handrail side of a fresh stair', () => {
    const plan = planStairRailings([stairFixture()], []);
    expect(plan.creates).toHaveLength(2);
    expect(plan.creates.map((c) => c.side).sort()).toEqual(['inner', 'outer']);
    expect(plan.updates).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
  });

  it('updates (not recreates) railings that already exist', () => {
    const plan = planStairRailings([stairFixture()], [managedFor('inner'), managedFor('outer')]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(2);
  });

  it('deletes managed railings whose stair is gone', () => {
    const plan = planStairRailings([], [managedFor('outer')]);
    expect(plan.deletes).toEqual([{ railingId: stairRailingId('stair-1', 'outer') }]);
  });

  it('deletes the side whose handrail was toggled off, keeps the other', () => {
    const plan = planStairRailings(
      [stairFixture({ handrails: { outer: false } })],
      [managedFor('inner'), managedFor('outer')],
    );
    expect(plan.updates.map((u) => u.side)).toEqual(['inner']);
    expect(plan.deletes).toEqual([{ railingId: stairRailingId('stair-1', 'outer') }]);
  });
});
