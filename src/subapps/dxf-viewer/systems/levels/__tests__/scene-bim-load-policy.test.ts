/**
 * ADR-390 Phase 4 — active-floor SSoT load policy unit tests.
 *
 * Locks the invariant: on load, the `.scene.json` snapshot's (derived-cache) BIM
 * entities are DROPPED (the per-entity Firestore docs are SSoT), pure-DXF entities
 * are KEPT, and any BIM already merged in-memory is PRESERVED (anti-clobber).
 * Regression guard for the "column renders `attached`/sloped & beam snaps back
 * half-width on reload despite clean per-entity docs" divergence.
 */

// ADR-578 — deterministic re-mint + silent logger so the integrity-guard tests are hermetic.
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('../../entity-creation/utils', () => {
  let n = 0;
  return { generateEntityId: () => `fresh_${++n}` };
});

import {
  reconcileLoadedSceneBim,
  reconcileLoadedSceneBimPreserving,
  isPerEntityPersistedEntity,
  stripForeignFloorBim,
  replaceFootingsFromModel,
  stripAllFoundations,
  ensureUniqueEntityIds,
} from '../scene-bim-load-policy';
import type { SceneModel } from '../../../types/scene';
import type { Entity } from '../../../types/entities';

// Minimal entity stubs — the policy only reads `type` + `id`.
const ent = (id: string, type: string): Entity => ({ id, type } as unknown as Entity);
const entF = (id: string, type: string, floorId?: string): Entity =>
  ({ id, type, ...(floorId ? { floorId } : {}) } as unknown as Entity);

const scene = (entities: Entity[]): SceneModel =>
  ({ entities, layersById: {}, bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }, units: 'mm' } as unknown as SceneModel);

describe('isPerEntityPersistedEntity', () => {
  it('flags BIM parametric entities', () => {
    for (const t of ['wall', 'column', 'beam', 'slab', 'foundation', 'opening', 'roof']) {
      expect(isPerEntityPersistedEntity(ent('x', t))).toBe(true);
    }
  });

  it('flags stairs (not covered by isBimEntity but per-entity persisted)', () => {
    expect(isPerEntityPersistedEntity(ent('s', 'stair'))).toBe(true);
  });

  it('flags hatch (ADR-507 — pure-DXF primitive with own floorplan_hatches SSoT)', () => {
    expect(isPerEntityPersistedEntity(ent('h', 'hatch'))).toBe(true);
  });

  it('does NOT flag pure-DXF entities without own persistence', () => {
    for (const t of ['line', 'polyline', 'arc', 'text', 'circle']) {
      expect(isPerEntityPersistedEntity(ent('d', t))).toBe(false);
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

  it('ADR-507 — drops snapshot hatch (floorplan_hatches = SSoT), keeps pure-DXF', () => {
    // Το hatch στο snapshot είναι παράγωγο cache· πετιέται ώστε να ξαναγεμίσει ΜΟΝΟ
    // από το floorplan_hatches subscription → διαγραφή της collection = ΟΧΙ φάντασμα.
    const loaded = scene([ent('l1', 'line'), ent('h_stale', 'hatch')]);
    const result = reconcileLoadedSceneBim(loaded, null);
    expect(result.entities.map((e) => e.id)).toEqual(['l1']);
  });

  it('ADR-507 — preserves in-memory hatch (subscription raced ahead of load)', () => {
    const loaded = scene([ent('l1', 'line'), ent('h_stale', 'hatch')]);
    const existing = scene([ent('h_db', 'hatch')]);
    const result = reconcileLoadedSceneBim(loaded, existing);
    // snapshot hatch dropped, DXF kept, in-memory (DB-sourced) hatch preserved.
    expect(result.entities.map((e) => e.id).sort()).toEqual(['h_db', 'l1']);
  });
});

describe('reconcileLoadedSceneBimPreserving (ADR-635 Φ C.18 — keep no-doc per-entity)', () => {
  it('keeps loaded per-entity entities whose id ∈ keepIds; drops the rest', () => {
    // h_missing has no Firestore doc (server-wizard import) → kept; h_hasdoc has one → dropped.
    const loaded = scene([ent('l1', 'line'), ent('h_missing', 'hatch'), ent('h_hasdoc', 'hatch')]);
    const result = reconcileLoadedSceneBimPreserving(loaded, null, new Set(['h_missing']));
    expect(result.entities.map((e) => e.id).sort()).toEqual(['h_missing', 'l1']);
  });

  it('empty keepIds ⇒ identical to reconcileLoadedSceneBim (delegation)', () => {
    const loaded = scene([ent('l1', 'line'), ent('c1', 'column'), ent('h1', 'hatch')]);
    const preserving = reconcileLoadedSceneBimPreserving(loaded, null, new Set());
    const base = reconcileLoadedSceneBim(loaded, null);
    expect(preserving.entities.map((e) => e.id)).toEqual(base.entities.map((e) => e.id));
  });

  it('unions kept blob hatches with preserved in-memory BIM (dedup-by-id)', () => {
    const loaded = scene([ent('l1', 'line'), ent('h_missing', 'hatch'), ent('col_stale', 'column')]);
    const existing = scene([ent('col_db', 'column'), ent('h_missing', 'hatch')]);
    // keep h_missing from blob; snapshot column dropped; in-memory col_db preserved;
    // the in-memory h_missing must NOT double (kept blob copy wins by id).
    const result = reconcileLoadedSceneBimPreserving(loaded, existing, new Set(['h_missing']));
    expect(result.entities.map((e) => e.id).sort()).toEqual(['col_db', 'h_missing', 'l1']);
    // the kept h_missing is the BLOB copy, not the in-memory one.
    expect(result.entities.find((e) => e.id === 'h_missing')).toBe(
      loaded.entities.find((e) => e.id === 'h_missing'),
    );
  });

  it('DXF id wins over a kept per-entity id collision (no duplicate id emitted)', () => {
    const loaded = scene([ent('dup', 'line'), ent('dup', 'hatch')]);
    const result = reconcileLoadedSceneBimPreserving(loaded, null, new Set(['dup']));
    // The kept hatch collides in id with the DXF line → filtered; only the DXF wins.
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

describe('stripAllFoundations (ADR-484 Slice 5 — foundations μόνο στον foundation level)', () => {
  it('αφαιρεί ΟΛΑ τα foundation entities, κρατά τα υπόλοιπα', () => {
    const s = scene([ent('w1', 'wall'), ent('f1', 'foundation'), ent('f2', 'foundation'), ent('c1', 'column')]);
    const result = stripAllFoundations(s);
    expect(result.entities.map((e) => e.id)).toEqual(['w1', 'c1']);
  });

  it('same-reference no-op όταν δεν υπάρχει πέδιλο', () => {
    const s = scene([ent('w1', 'wall'), ent('c1', 'column')]);
    expect(stripAllFoundations(s)).toBe(s);
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

describe('ensureUniqueEntityIds (ADR-578 — Revit «Audit»-on-open id integrity guard)', () => {
  it('same-reference no-op when all ids are unique (equality-guard friendly)', () => {
    const s = scene([ent('l1', 'line'), ent('l2', 'line'), ent('c1', 'column')]);
    expect(ensureUniqueEntityIds(s)).toBe(s);
  });

  it('heals a duplicate id: keeps the FIRST occurrence, re-mints the later one', () => {
    // Ο ακριβής bug: `entity_8` ×2 στο ίδιο scene.entities.
    const s = scene([ent('entity_1', 'line'), ent('entity_8', 'line'), ent('entity_8', 'line')]);
    const result = ensureUniqueEntityIds(s);
    const ids = result.entities.map((e) => e.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3); // όλα μοναδικά πλέον
    expect(ids[0]).toBe('entity_1');
    expect(ids[1]).toBe('entity_8'); // πρώτη εμφάνιση σταθερή (αναφορές παραμένουν έγκυρες)
    expect(ids[2]).not.toBe('entity_8'); // το διπλότυπο ξανα-mint-αρίστηκε
  });

  it('heals multiple distinct collisions independently', () => {
    const s = scene([ent('a', 'line'), ent('a', 'line'), ent('b', 'line'), ent('b', 'line')]);
    const ids = ensureUniqueEntityIds(s).entities.map((e) => e.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids.filter((id) => id === 'a')).toHaveLength(1);
    expect(ids.filter((id) => id === 'b')).toHaveLength(1);
  });

  it('is idempotent: a healed scene passes through unchanged (same reference)', () => {
    const s = scene([ent('x', 'line'), ent('x', 'line')]);
    const once = ensureUniqueEntityIds(s);
    expect(ensureUniqueEntityIds(once)).toBe(once); // δεύτερο pass = clean = no-op
  });

  it('preserves the non-id entity payload when re-minting', () => {
    const s = scene([ent('dup', 'line'), { id: 'dup', type: 'circle', radius: 5 } as unknown as Entity]);
    const healed = ensureUniqueEntityIds(s).entities[1] as unknown as { type: string; radius: number };
    expect(healed.type).toBe('circle');
    expect(healed.radius).toBe(5);
  });

  it('keeps non-entity scene fields (spread) when healing', () => {
    const s = scene([ent('d', 'line'), ent('d', 'line')]);
    const result = ensureUniqueEntityIds(s);
    expect(result.units).toBe('mm');
    expect(result.layersById).toBe(s.layersById);
  });
});
