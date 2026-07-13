/**
 * ADR-642 §6.8 — ComplexLinetypeSnapEngine tests.
 *
 * Verifies the one-class-per-category engine snaps to the RENDERED railway pattern:
 *   - endpoint engine snaps to a sleeper end, midpoint to a rail mid, intersection to a
 *     rail×sleeper crossing — each candidate carries its own COMPLEX_* type;
 *   - a plain (non-complex) line yields NO candidates from any of the three engines;
 *   - excludeEntityId suppresses the entity (don't snap a moving line to itself).
 */

import { ComplexLinetypeSnapEngine } from '../ComplexLinetypeSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import { SNAP_ENGINE_PRIORITIES } from '../../../config/tolerance-config';
import { registerUserLinetype } from '../../../stores/LinetypeRegistry';
import { COMPOUND_PRESETS } from '../../../config/linetype-compound-presets';
import { layersToComplex } from '../../../config/line-pattern-segments';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel } from '../../../rendering/types/Types';

const LT_NAME = 'TEST_RAILWAY_ENGINE';

beforeAll(() => {
  const railway = COMPOUND_PRESETS.find((p) => p.id === 'railway')!;
  registerUserLinetype(LT_NAME, [], 'railway', layersToComplex(LT_NAME, railway.build()));
});

function railLine(id = 'rail_1'): EntityModel {
  return {
    id,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10000, y: 0 },
    linetypeName: LT_NAME,
    visible: true,
  } as unknown as EntityModel;
}

function plainLine(id = 'plain_1'): EntityModel {
  return {
    id,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 10000, y: 0 },
    linetypeName: 'Continuous',
    visible: true,
  } as unknown as EntityModel;
}

function makeContext(): SnapEngineContext {
  return { entities: [], worldRadiusAt: () => 20, worldRadiusForType: () => 20, maxCandidates: 10 };
}

function makeEngine(type: ExtendedSnapType, cat: 'endpoint' | 'midpoint' | 'intersection', prio: number) {
  return new ComplexLinetypeSnapEngine(type, cat, prio);
}

describe('ComplexLinetypeSnapEngine — railway pattern snaps', () => {
  it('endpoint engine snaps to a sleeper end (650, ±1300)', () => {
    const engine = makeEngine(ExtendedSnapType.COMPLEX_ENDPOINT, 'endpoint', SNAP_ENGINE_PRIORITIES.COMPLEX_ENDPOINT);
    engine.initialize([railLine()]);
    const { candidates } = engine.findSnapCandidates({ x: 650, y: 1300 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.type).toBe(ExtendedSnapType.COMPLEX_ENDPOINT);
    expect(candidates[0]!.point.x).toBeCloseTo(650, 3);
    expect(candidates[0]!.point.y).toBeCloseTo(1300, 3);
    engine.dispose();
  });

  it('midpoint engine snaps to a rail midpoint (5000, ±753.5)', () => {
    const engine = makeEngine(ExtendedSnapType.COMPLEX_MIDPOINT, 'midpoint', SNAP_ENGINE_PRIORITIES.COMPLEX_MIDPOINT);
    engine.initialize([railLine()]);
    const { candidates } = engine.findSnapCandidates({ x: 5000, y: 753.5 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.type).toBe(ExtendedSnapType.COMPLEX_MIDPOINT);
    expect(candidates[0]!.point.y).toBeCloseTo(753.5, 3);
    engine.dispose();
  });

  it('intersection engine snaps to a rail×sleeper crossing (650, ±753.5)', () => {
    const engine = makeEngine(ExtendedSnapType.COMPLEX_INTERSECTION, 'intersection', SNAP_ENGINE_PRIORITIES.COMPLEX_INTERSECTION);
    engine.initialize([railLine()]);
    const { candidates } = engine.findSnapCandidates({ x: 650, y: 753.5 }, makeContext());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.type).toBe(ExtendedSnapType.COMPLEX_INTERSECTION);
    expect(candidates[0]!.point.x).toBeCloseTo(650, 3);
    expect(candidates[0]!.point.y).toBeCloseTo(753.5, 3);
    engine.dispose();
  });

  it('yields NO candidates for a plain (non-complex) line', () => {
    const engine = makeEngine(ExtendedSnapType.COMPLEX_ENDPOINT, 'endpoint', 0);
    engine.initialize([plainLine()]);
    expect(engine.findSnapCandidates({ x: 650, y: 1300 }, makeContext()).candidates).toHaveLength(0);
    engine.dispose();
  });

  it('excludeEntityId suppresses the entity', () => {
    const engine = makeEngine(ExtendedSnapType.COMPLEX_ENDPOINT, 'endpoint', 0);
    engine.initialize([railLine('rail_x')]);
    const ctx: SnapEngineContext = { ...makeContext(), excludeEntityId: 'rail_x' };
    expect(engine.findSnapCandidates({ x: 650, y: 1300 }, ctx).candidates).toHaveLength(0);
    engine.dispose();
  });
});
