/**
 * Tests for beam-column-reframe-cascade (ADR-492).
 *
 * Command-time cascade: όταν μετακινείται κολώνα, τα δοκάρια που την πλαισιώνουν
 * ξανα-κόβονται στην παρειά μέσα στο move command (μηδέν reactive emit). Mock
 * sceneManager (getEntities + updateEntities), mm scene.
 */

import { cascadeBeamReframeForColumns } from '../beam-column-reframe-cascade';
import type { SceneEntity } from '../../../core/commands/interfaces';
import type { BeamEntity } from '../../types/beam-types';
import type { ColumnEntity } from '../../types/column-types';

function beam(startX: number, endX: number): BeamEntity {
  return {
    id: 'beam_1', type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', startPoint: { x: startX, y: 0, z: 0 }, endPoint: { x: endX, y: 0, z: 0 },
      width: 250, depth: 500, topElevation: 3000, zOffset: 0, sceneUnits: 'mm',
    },
  } as unknown as BeamEntity;
}

function column(id: string, cx: number, h = 200): ColumnEntity {
  return {
    id, type: 'column', kind: 'rectangular',
    params: { kind: 'rectangular', position: { x: cx, y: 0, z: 0 }, sceneUnits: 'mm' },
    geometry: {
      footprint: {
        vertices: [
          { x: cx - h, y: -h, z: 0 }, { x: cx + h, y: -h, z: 0 },
          { x: cx + h, y: h, z: 0 }, { x: cx - h, y: h, z: 0 },
        ],
      },
    },
  } as unknown as ColumnEntity;
}

function mockSceneManager(entities: SceneEntity[]) {
  const updated = new Map<string, Partial<SceneEntity>>();
  return {
    getEntities: () => entities,
    updateEntities: (patches: ReadonlyMap<string, Partial<SceneEntity>>) => {
      for (const [id, p] of patches) updated.set(id, p);
    },
    updated,
  };
}

describe('cascadeBeamReframeForColumns', () => {
  it('re-frames a beam when its supporting column moved (stub → face)', () => {
    // Δοκάρι 200..3800· η δεξιά κολώνα μετακινήθηκε στο 3000 (παρειά 2800).
    const entities = [beam(200, 3800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    const reframed = cascadeBeamReframeForColumns(['c2'], sm);
    expect(reframed).toHaveLength(1);
    expect(reframed[0].params.endPoint).toEqual({ x: 2800, y: 0, z: 0 });
    expect(sm.updated.has('beam_1')).toBe(true);
  });

  it('no-op when no moved id is a column', () => {
    const entities = [beam(200, 3800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    expect(cascadeBeamReframeForColumns(['beam_1'], sm)).toEqual([]);
    expect(sm.updated.size).toBe(0);
  });

  it('no-op when beams are already framed (idempotent → no churn)', () => {
    const entities = [beam(200, 2800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    expect(cascadeBeamReframeForColumns(['c2'], sm)).toEqual([]);
    expect(sm.updated.size).toBe(0);
  });

  it('no-op when sceneManager does not expose getEntities', () => {
    const sm = { updateEntities: () => {} };
    expect(cascadeBeamReframeForColumns(['c2'], sm)).toEqual([]);
  });
});
