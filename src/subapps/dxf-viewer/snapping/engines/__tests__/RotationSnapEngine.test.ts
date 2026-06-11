/**
 * ADR-397 — RotationSnapEngine + RotationSnapStore tests.
 *
 * Verifies:
 *   - Empty store → no candidates (zero cost outside a rotation).
 *   - Pivot engine surfaces the rotation centre within radius; suppressed outside.
 *   - Grip engine surfaces the rotating entity's grips within radius; caps at 8.
 *   - snappableKeys() reflects the armed grips; clear() empties everything.
 *   - Candidate types/priorities match the registry wiring.
 */

import { RotationPivotSnapEngine, RotationGripSnapEngine } from '../RotationSnapEngine';
import { getGlobalRotationSnapStore } from '../../../bim/grips/rotation-snap-store';
import { ExtendedSnapType } from '../../extended-types';
import { SNAP_ENGINE_PRIORITIES } from '../../../config/tolerance-config';
import { gripKey } from '../../../rendering/grips/grip-temperature';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';

function makeContext(radius = 50): SnapEngineContext {
  return { entities: [], worldRadiusAt: () => radius, worldRadiusForType: () => radius, maxCandidates: 16 };
}

const store = getGlobalRotationSnapStore();

afterEach(() => store.clear());

describe('RotationSnapStore', () => {
  it('is inactive and empty by default', () => {
    expect(store.isActive()).toBe(false);
    expect(store.getPivot()).toBeNull();
    expect(store.getGrips()).toHaveLength(0);
    expect(store.snappableKeys().size).toBe(0);
  });

  it('setTargets arms pivot + grips and snappableKeys', () => {
    store.setTargets({ x: 10, y: 20 }, [
      { entityId: 'wall-1', gripIndex: 0, point: { x: 0, y: 0 } },
      { entityId: 'wall-1', gripIndex: 1, point: { x: 100, y: 0 } },
    ]);
    expect(store.isActive()).toBe(true);
    expect(store.getPivot()).toEqual({ x: 10, y: 20 });
    expect(store.getGrips()).toHaveLength(2);
    expect(store.snappableKeys().has(gripKey('wall-1', 0))).toBe(true);
    expect(store.snappableKeys().has(gripKey('wall-1', 1))).toBe(true);
  });

  it('clear empties everything (idempotent)', () => {
    store.setTargets({ x: 1, y: 1 }, [{ entityId: 'e', gripIndex: 0, point: { x: 0, y: 0 } }]);
    store.clear();
    expect(store.isActive()).toBe(false);
    expect(store.snappableKeys().size).toBe(0);
    expect(() => store.clear()).not.toThrow();
  });
});

describe('RotationPivotSnapEngine', () => {
  const engine = new RotationPivotSnapEngine();

  it('no candidates when no pivot armed', () => {
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('surfaces the pivot within radius with correct type + priority', () => {
    store.setTargets({ x: 0, y: 0 }, []);
    const { candidates } = engine.findSnapCandidates({ x: 5, y: 0 }, makeContext(50));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.type).toBe(ExtendedSnapType.ROTATION_PIVOT);
    expect(candidates[0]!.priority).toBe(SNAP_ENGINE_PRIORITIES.ROTATION_PIVOT);
  });

  it('no candidate when cursor outside radius', () => {
    store.setTargets({ x: 0, y: 0 }, []);
    expect(engine.findSnapCandidates({ x: 1000, y: 0 }, makeContext(50)).candidates).toHaveLength(0);
  });
});

describe('RotationGripSnapEngine', () => {
  const engine = new RotationGripSnapEngine();

  it('no candidates when no grips armed', () => {
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('surfaces only grips within radius', () => {
    store.setTargets(null, [
      { entityId: 'e', gripIndex: 0, point: { x: 0, y: 0 } },   // near
      { entityId: 'e', gripIndex: 1, point: { x: 1000, y: 0 } }, // far
    ]);
    const { candidates } = engine.findSnapCandidates({ x: 3, y: 0 }, makeContext(50));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.type).toBe(ExtendedSnapType.ROTATION_GRIP);
    expect(candidates[0]!.priority).toBe(SNAP_ENGINE_PRIORITIES.ROTATION_GRIP);
  });

  it('caps at 8 candidates', () => {
    const grips = Array.from({ length: 20 }, (_, i) => ({ entityId: 'e', gripIndex: i, point: { x: 0, y: 0 } }));
    store.setTargets(null, grips);
    const { candidates } = engine.findSnapCandidates({ x: 0, y: 0 }, makeContext(50));
    expect(candidates).toHaveLength(8);
  });
});
