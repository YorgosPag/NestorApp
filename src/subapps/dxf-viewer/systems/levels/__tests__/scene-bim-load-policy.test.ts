/**
 * ADR-390 Phase 4 — active-floor SSoT load policy unit tests.
 *
 * Locks the invariant: on load, the `.scene.json` snapshot's (derived-cache) BIM
 * entities are DROPPED (the per-entity Firestore docs are SSoT), pure-DXF entities
 * are KEPT, and any BIM already merged in-memory is PRESERVED (anti-clobber).
 * Regression guard for the "column renders `attached`/sloped & beam snaps back
 * half-width on reload despite clean per-entity docs" divergence.
 */

import { reconcileLoadedSceneBim, isBimOrStairEntity } from '../scene-bim-load-policy';
import type { SceneModel } from '../../../types/scene';
import type { Entity } from '../../../types/entities';

// Minimal entity stubs — the policy only reads `type` + `id`.
const ent = (id: string, type: string): Entity => ({ id, type } as unknown as Entity);

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
