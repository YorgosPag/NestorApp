/**
 * Tests for beam-column-reframe-cascade (ADR-492).
 *
 * Command-time cascade: όταν μετασχηματίζεται κολώνα Ή το ίδιο το δοκάρι (rotate/move/
 * scale/mirror), τα δοκάρια ξανα-κόβονται στην παρειά μέσα στο command (μηδέν reactive
 * emit). Φ2: το beam-transform πιάνεται πλέον ΚΑΙ αυτό. Mock sceneManager (getEntities +
 * updateEntities), mm scene.
 */

import {
  cascadeBeamReframe,
  reframeBeamsAndEmit,
  emitRestoredEntities,
  reframeBeamsAndEmitAfterRestore,
} from '../beam-column-reframe-cascade';
import { EventBus } from '../../../systems/events/EventBus';
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

describe('cascadeBeamReframe', () => {
  it('re-frames a beam when its supporting column moved (stub → face)', () => {
    // Δοκάρι 200..3800· η δεξιά κολώνα μετακινήθηκε στο 3000 (παρειά 2800).
    const entities = [beam(200, 3800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    const reframed = cascadeBeamReframe(['c2'], sm);
    expect(reframed).toHaveLength(1);
    expect(reframed[0].params.endPoint).toEqual({ x: 2800, y: 0, z: 0 });
    expect(sm.updated.has('beam_1')).toBe(true);
  });

  it('Φ2 — re-frames the beam itself when the BEAM is the moved id (rotate/move of the beam)', () => {
    // Το ίδιο το δοκάρι μετασχηματίστηκε (id δοκαριού στα moved). Παλιά Φ1 → no-op· τώρα
    // ξανα-κόβεται στις παρειές (δεξί άκρο 3800 → 2800 στην παρειά της c2).
    const entities = [beam(200, 3800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    const reframed = cascadeBeamReframe(['beam_1'], sm);
    expect(reframed).toHaveLength(1);
    expect(reframed[0].params.endPoint).toEqual({ x: 2800, y: 0, z: 0 });
    expect(sm.updated.has('beam_1')).toBe(true);
  });

  it('no-op when the moved id is neither a column nor a beam', () => {
    const entities = [beam(200, 3800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    expect(cascadeBeamReframe(['some-wall'], sm)).toEqual([]);
    expect(sm.updated.size).toBe(0);
  });

  it('no-op when beams are already framed (idempotent → no churn)', () => {
    const entities = [beam(200, 2800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    expect(cascadeBeamReframe(['c2'], sm)).toEqual([]);
    expect(sm.updated.size).toBe(0);
  });

  it('no-op when sceneManager does not expose getEntities', () => {
    const sm = { updateEntities: () => {} };
    expect(cascadeBeamReframe(['c2'], sm)).toEqual([]);
  });
});

describe('reframeBeamsAndEmit — transform → reframe → ONE bim:entities-moved (dedup by id)', () => {
  function capture(fn: () => void): SceneEntity[] | null {
    let moved: SceneEntity[] | null = null;
    const unsub = EventBus.on('bim:entities-moved', ({ movedEntities }) => {
      moved = movedEntities as unknown as SceneEntity[];
    });
    fn();
    unsub();
    return moved;
  }

  it('dedups a transformed beam that was also reframed (rides once, with reframed geometry)', () => {
    // Ο caller περνά το pre-reframe (rotated) δοκάρι 200..3800· ο cascade το ξανα-κόβει
    // στο 2800. Το payload πρέπει να έχει το δοκάρι ΜΙΑ φορά με την τελική γεωμετρία.
    const entities = [beam(200, 3800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    const transformedBeam = beam(200, 3800) as unknown as SceneEntity;
    const moved = capture(() => reframeBeamsAndEmit([transformedBeam], ['beam_1'], sm));
    expect(moved).not.toBeNull();
    expect(moved).toHaveLength(1);
    expect((moved![0] as unknown as BeamEntity).params.endPoint).toEqual({ x: 2800, y: 0, z: 0 });
  });

  it('column move: transformed column + reframed beam both ride (no overlap)', () => {
    const entities = [beam(200, 3800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    const movedColumn = { ...column('c2', 3000), id: 'c2' } as unknown as SceneEntity;
    const moved = capture(() => reframeBeamsAndEmit([movedColumn], ['c2'], sm));
    expect(moved).not.toBeNull();
    const ids = moved!.map((e) => e.id).sort();
    expect(ids).toEqual(['beam_1', 'c2']);
  });

  it('no emit when nothing transformed and nothing reframed', () => {
    const entities = [beam(200, 2800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    const spy = jest.spyOn(EventBus, 'emit');
    reframeBeamsAndEmit([], ['c2'], sm); // already framed → reframed empty, transformed empty
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('undo race-guarded pair — emitRestoredEntities + reframeBeamsAndEmitAfterRestore', () => {
  function captureAll(fn: () => void): SceneEntity[][] {
    const payloads: SceneEntity[][] = [];
    const unsub = EventBus.on('bim:entities-moved', ({ movedEntities }) => {
      payloads.push(movedEntities as unknown as SceneEntity[]);
    });
    fn();
    unsub();
    return payloads;
  }

  it('emitRestoredEntities emits the restored snapshots (restore-first)', () => {
    const restored = [beam(0, 1000) as unknown as SceneEntity];
    const payloads = captureAll(() => emitRestoredEntities(restored));
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toHaveLength(1);
  });

  it('emitRestoredEntities is a no-op for an empty restore set', () => {
    const spy = jest.spyOn(EventBus, 'emit');
    emitRestoredEntities([]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('reframeBeamsAndEmitAfterRestore emits ONLY the reframed beams (separate emit)', () => {
    // Restored scene has a stub beam 200..3800 against column at 3000 (face 2800).
    const entities = [beam(200, 3800), column('c1', 0), column('c2', 3000)] as unknown as SceneEntity[];
    const sm = mockSceneManager(entities);
    const payloads = captureAll(() => reframeBeamsAndEmitAfterRestore(['c2'], sm));
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toHaveLength(1);
    expect((payloads[0][0] as unknown as BeamEntity).params.endPoint).toEqual({ x: 2800, y: 0, z: 0 });
  });
});
