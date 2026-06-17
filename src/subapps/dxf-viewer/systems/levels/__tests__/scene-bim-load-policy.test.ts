/**
 * ADR-390 Phase 4 — active-floor SSoT load policy unit tests.
 *
 * Locks the invariant: on load, the `.scene.json` snapshot's (derived-cache) BIM
 * entities are DROPPED (the per-entity Firestore docs are SSoT), pure-DXF entities
 * are KEPT, and any BIM already merged in-memory is PRESERVED (anti-clobber).
 * Regression guard for the "column renders `attached`/sloped & beam snaps back
 * half-width on reload despite clean per-entity docs" divergence.
 */

import {
  reconcileLoadedSceneBim,
  isBimOrStairEntity,
  stripForeignFloorBim,
  replaceFootingsFromModel,
} from '../scene-bim-load-policy';
import type { SceneModel } from '../../../types/scene';
import type { Entity } from '../../../types/entities';

// Minimal entity stubs — the policy only reads `type` + `id`.
const ent = (id: string, type: string): Entity => ({ id, type } as unknown as Entity);
const entF = (id: string, type: string, floorId?: string): Entity =>
  ({ id, type, ...(floorId ? { floorId } : {}) } as unknown as Entity);

const scene = (entities: Entity[]): SceneModel =>
  ({ entities, layersById: {}, bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }, units: 'mm' } as unknown as SceneModel);

describe('isBimOrStairEntity', () => {
  it('flags BIM parametric entities', () => {
    for (const t of ['wall', 'column', 'beam', 'slab', 'foundation', 'opening', 'roof']) {
      expect(isBimOrStairEntity(ent('x', t))).toBe(true);
    }
  });

  it('flags stairs (not covered by isBimEntity but per-entity persisted)', () => {
    expect(isBimOrStairEntity(ent('s', 'stair'))).toBe(true);
  });

  it('does NOT flag pure-DXF entities', () => {
    for (const t of ['line', 'polyline', 'arc', 'text', 'circle']) {
      expect(isBimOrStairEntity(ent('d', t))).toBe(false);
    }
  });
});

describe('reconcileLoadedSceneBim', () => {
  it('drops the snapshot BIM and keeps pure-DXF entities (no in-memory scene yet)', () => {
    const loaded = scene([ent('l1', 'line'), ent('c1', 'column'), ent('b1', 'beam'), ent('t1', 'text')]);
    const result = reconcileLoadedSceneBim(loaded, null);
    expect(result.entities.map((e) => e.id).sort()).toEqual(['l1', 't1']);
  });

  it('preserves BIM already merged in-memory (anti-clobber) while dropping snapshot BIM', () => {
    // snapshot has a STALE column (b/c attached) + DXF; in-memory already has the
    // DB-sourced column + beam from a subscription that raced ahead of the load.
    const loaded = scene([ent('l1', 'line'), ent('col_stale', 'column')]);
    const existing = scene([ent('col_stale', 'column'), ent('beam_db', 'beam')]);
    const result = reconcileLoadedSceneBim(loaded, existing);
    // DXF kept, snapshot column dropped, in-memory column + beam preserved.
    expect(result.entities.map((e) => e.id).sort()).toEqual(['beam_db', 'col_stale', 'l1']);
    // The preserved column is the in-memory one (object identity), not the snapshot's.
    expect(result.entities.find((e) => e.id === 'col_stale')).toBe(
      existing.entities.find((e) => e.id === 'col_stale'),
    );
  });

  it('keeps non-entity scene fields (spread) and is idempotent on a DXF-only scene', () => {
    const loaded = scene([ent('l1', 'line')]);
    const once = reconcileLoadedSceneBim(loaded, null);
    const twice = reconcileLoadedSceneBim(once, null);
    expect(once.units).toBe('mm');
    expect(once.layersById).toBe(loaded.layersById);
    expect(twice.entities.map((e) => e.id)).toEqual(['l1']);
  });

  it('dedup: a preserved BIM id colliding with a loaded DXF id yields the DXF entity only', () => {
    const loaded = scene([ent('dup', 'line')]);
    const existing = scene([ent('dup', 'column')]);
    const result = reconcileLoadedSceneBim(loaded, existing);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].type).toBe('line');
  });
});

describe('reconcileLoadedSceneBim — empty loaded scene (FIX Α load-time preservation)', () => {
  // The exact call `useLevelSceneLoader.setEmptyScenePreservingBim()` now makes on
  // every "empty scene" branch (no-file / dup / cross-floor / scene-not-found /
  // catch): a bare empty scene reconciled against the live in-memory scene. Locks
  // the anti-vanish invariant — a late "scene not found" must NOT wipe columns that
  // a per-entity subscription already merged in-memory.
  const emptyScene = (): SceneModel => scene([]);

  it('preserves in-memory BIM when the loaded scene is empty (orphaned/missing file)', () => {
    const existing = scene([ent('col_db', 'column'), ent('fnd_db', 'foundation')]);
    const result = reconcileLoadedSceneBim(emptyScene(), existing);
    expect(result.entities.map((e) => e.id).sort()).toEqual(['col_db', 'fnd_db']);
  });

  it('preserves stairs (per-entity persisted) on an empty load', () => {
    const existing = scene([ent('s1', 'stair')]);
    expect(reconcileLoadedSceneBim(emptyScene(), existing).entities.map((e) => e.id)).toEqual(['s1']);
  });

  it('yields an empty scene when there is no in-memory BIM (true first load)', () => {
    expect(reconcileLoadedSceneBim(emptyScene(), null).entities).toHaveLength(0);
    expect(reconcileLoadedSceneBim(emptyScene(), scene([ent('l1', 'line')])).entities).toHaveLength(0);
  });
});

describe('stripForeignFloorBim', () => {
  it('drops BIM whose floorId differs from the saved floor (cross-level leak)', () => {
    // πέδιλο του ορόφου «F» που διέρρευσε στη σκηνή του Ισογείου ('floorGround').
    const s = scene([
      ent('line1', 'line'),
      entF('col_own', 'column', 'floorGround'),
      entF('fnd_foreign', 'foundation', 'floorF'),
    ]);
    const result = stripForeignFloorBim(s, 'floorGround');
    expect(result.entities.map((e) => e.id).sort()).toEqual(['col_own', 'line1']);
  });

  it('keeps own-floor BIM, BIM without floorId, and pure-DXF', () => {
    const s = scene([
      ent('line1', 'line'),
      entF('col_own', 'column', 'floorGround'),
      ent('beam_nofloor', 'beam'),
    ]);
    const result = stripForeignFloorBim(s, 'floorGround');
    expect(result.entities).toHaveLength(3);
    expect(result).toBe(s); // no foreign → same reference (idempotent no-op)
  });

  it('is a safe no-op when the saved floor is unknown', () => {
    const s = scene([entF('fnd_foreign', 'foundation', 'floorF')]);
    expect(stripForeignFloorBim(s, undefined)).toBe(s);
    expect(stripForeignFloorBim(s, null)).toBe(s);
  });

  it('does NOT strip a foreign-floor pure-DXF entity (only BIM is floor-scoped)', () => {
    const s = scene([entF('line_x', 'line', 'floorF')]);
    expect(stripForeignFloorBim(s, 'floorGround').entities).toHaveLength(1);
  });
});

describe('replaceFootingsFromModel', () => {
  it('replaces stale scene footings with the authoritative model footings', () => {
    // snapshot έχει ένα stale πέδιλο· το model SSoT έχει δύο (auto-designed).
    const s = scene([ent('line1', 'line'), ent('fnd_stale', 'foundation')]);
    const modelFootings = [ent('fnd_a', 'foundation'), ent('fnd_b', 'foundation')];
    const result = replaceFootingsFromModel(s, modelFootings);
    expect(result.entities.map((e) => e.id).sort()).toEqual(['fnd_a', 'fnd_b', 'line1']);
  });

  it('keeps non-foundation entities (pure-DXF + other BIM) untouched', () => {
    const s = scene([ent('l1', 'line'), ent('c1', 'column'), ent('w1', 'wall')]);
    const result = replaceFootingsFromModel(s, [ent('fnd_a', 'foundation')]);
    expect(result.entities.map((e) => e.id).sort()).toEqual(['c1', 'fnd_a', 'l1', 'w1']);
  });

  it('drops scene footings when the model has none (auto-design removed them)', () => {
    const s = scene([ent('l1', 'line'), ent('fnd_stale', 'foundation')]);
    const result = replaceFootingsFromModel(s, []);
    expect(result.entities.map((e) => e.id)).toEqual(['l1']);
  });

  it('dedup-by-id: a model footing colliding with a non-foundation id is dropped', () => {
    const s = scene([ent('dup', 'column')]);
    const result = replaceFootingsFromModel(s, [ent('dup', 'foundation')]);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].type).toBe('column');
  });

  it('is a same-reference no-op when no scene footings and no model footings', () => {
    const s = scene([ent('l1', 'line'), ent('c1', 'column')]);
    expect(replaceFootingsFromModel(s, [])).toBe(s);
  });

  it('keeps non-entity scene fields (spread) when injecting', () => {
    const s = scene([ent('l1', 'line')]);
    const result = replaceFootingsFromModel(s, [ent('fnd_a', 'foundation')]);
    expect(result.units).toBe('mm');
    expect(result.layersById).toBe(s.layersById);
  });
});
