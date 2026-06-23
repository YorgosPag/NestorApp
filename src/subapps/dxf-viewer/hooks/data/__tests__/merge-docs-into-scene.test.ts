/**
 * Generic snapshot→scene diff-merge SSoT (ADR-390/ADR-397) — behavior lock.
 * Covers add / update / selective-skip (dirty, grace) / drop-disappeared / tombstone
 * / baseline-seed / no-op-when-unchanged. Mirror των πρώην inline column/hatch loops.
 */
import {
  mergeDocsIntoScene,
  type DocsMergeLevelManager,
  type DocsMergeRefs,
} from '../merge-docs-into-scene';
import type { AnySceneEntity, SceneModel } from '../../../types/entities';

// Minimal "foo" entity/doc model — comparable = `value`.
interface FooDoc { id: string; value: number }
interface FooEntity { id: string; type: 'foo'; value: number }

const isFoo = (e: AnySceneEntity): e is FooEntity => (e as { type?: string }).type === 'foo';
const docToFoo = (d: FooDoc): FooEntity => ({ id: d.id, type: 'foo', value: d.value });

const config = {
  isEntity: isFoo,
  docToEntity: docToFoo,
  entityComparable: (e: FooEntity) => e.value,
  docComparable: (d: FooDoc) => d.value,
};

const ent = (id: string, type: string, value = 0): AnySceneEntity =>
  ({ id, type, value } as unknown as AnySceneEntity);

function makeLM(entities: AnySceneEntity[]): {
  lm: DocsMergeLevelManager;
  writes: Array<{ scene: SceneModel; origin?: string }>;
  current: () => AnySceneEntity[];
} {
  let scene: SceneModel = { entities, layersById: {}, bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }, units: 'mm' } as unknown as SceneModel;
  const writes: Array<{ scene: SceneModel; origin?: string }> = [];
  return {
    lm: {
      getLevelScene: () => scene,
      setLevelScene: (_id, next, origin) => { scene = next; writes.push({ scene: next, origin }); },
    },
    writes,
    current: () => scene.entities,
  };
}

const refs = (over: Partial<DocsMergeRefs<number>> = {}): DocsMergeRefs<number> => ({
  dirty: new Set(), deleted: new Set(), pending: new Set(),
  isWithinGrace: () => false, lastSavedBaseline: new Map(),
  ...over,
});

describe('mergeDocsIntoScene', () => {
  it('adds a doc missing from the scene', () => {
    const { lm, current } = makeLM([ent('keep', 'line')]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>([{ id: 'f1', value: 1 }], 'L', lm, config, refs());
    expect(current().map((e) => e.id).sort()).toEqual(['f1', 'keep']);
  });

  it('updates an existing entity when comparable differs', () => {
    const { lm, current } = makeLM([ent('f1', 'foo', 1)]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>([{ id: 'f1', value: 9 }], 'L', lm, config, refs());
    expect((current().find((e) => e.id === 'f1') as unknown as FooEntity).value).toBe(9);
  });

  it('does NOT write when nothing changed (same comparable)', () => {
    const { lm, writes } = makeLM([ent('f1', 'foo', 5)]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>([{ id: 'f1', value: 5 }], 'L', lm, config, refs());
    expect(writes).toHaveLength(0);
  });

  it('writes με origin remote-echo όταν mutated', () => {
    const { lm, writes } = makeLM([]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>([{ id: 'f1', value: 1 }], 'L', lm, config, refs());
    expect(writes[0].origin).toBe('remote-echo');
  });

  it('keeps locally-dirty entity (does NOT overwrite from doc)', () => {
    const { lm, current } = makeLM([ent('f1', 'foo', 1)]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [{ id: 'f1', value: 9 }], 'L', lm, config, refs({ dirty: new Set(['f1']) }),
    );
    expect((current().find((e) => e.id === 'f1') as unknown as FooEntity).value).toBe(1);
  });

  it('keeps entity within write-grace window (suppresses stale snapshot)', () => {
    const { lm, current } = makeLM([ent('f1', 'foo', 1)]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [{ id: 'f1', value: 9 }], 'L', lm, config, refs({ isWithinGrace: () => true }),
    );
    expect((current().find((e) => e.id === 'f1') as unknown as FooEntity).value).toBe(1);
  });

  it('skips a tombstoned (deleted) doc — does NOT re-add', () => {
    const { lm, current } = makeLM([ent('keep', 'line')]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [{ id: 'f1', value: 1 }], 'L', lm, config, refs({ deleted: new Set(['f1']) }),
    );
    expect(current().map((e) => e.id)).toEqual(['keep']);
  });

  it('drops a scene entity whose doc disappeared (not dirty/pending)', () => {
    const { lm, current } = makeLM([ent('f1', 'foo', 1), ent('keep', 'line')]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>([], 'L', lm, config, refs());
    expect(current().map((e) => e.id)).toEqual(['keep']);
  });

  it('preserves a disappeared-doc entity when dirty OR pending (anti-vanish)', () => {
    const { lm, current } = makeLM([ent('f1', 'foo', 1)]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>([], 'L', lm, config, refs({ pending: new Set(['f1']) }));
    expect(current().map((e) => e.id)).toEqual(['f1']);
  });

  it('ADR-397 — seeds the baseline for every doc once', () => {
    const baseline = new Map<string, number>();
    const { lm } = makeLM([]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [{ id: 'f1', value: 7 }], 'L', lm, config, refs({ lastSavedBaseline: baseline }),
    );
    expect(baseline.get('f1')).toBe(7);
  });

  it('no-op when scene is absent', () => {
    const lm: DocsMergeLevelManager = { getLevelScene: () => null, setLevelScene: () => { throw new Error('should not write'); } };
    expect(() => mergeDocsIntoScene<FooDoc, FooEntity, number>([{ id: 'f1', value: 1 }], 'L', lm, config, refs())).not.toThrow();
  });

  // --- optional callbacks (Tier 2/3/4 extensions) ---

  it('docToEntity → null SKIPS the add (host-missing, ADR-440)', () => {
    const { lm, current, writes } = makeLM([ent('keep', 'line')]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [{ id: 'f1', value: 1 }], 'L', lm,
      { ...config, docToEntity: () => null }, refs(),
    );
    expect(current().map((e) => e.id)).toEqual(['keep']);
    expect(writes).toHaveLength(0);
  });

  it('docToEntity → null on replace KEEPS the existing entity', () => {
    const { lm, current } = makeLM([ent('f1', 'foo', 1)]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [{ id: 'f1', value: 9 }], 'L', lm,
      { ...config, docToEntity: (d, existing) => (existing ? null : docToFoo(d)) }, refs(),
    );
    expect((current().find((e) => e.id === 'f1') as unknown as FooEntity).value).toBe(1);
  });

  it('docToEntity receives the existing entity on replace (MEP projection)', () => {
    const { lm, current } = makeLM([ent('f1', 'foo', 1)]);
    const seen: Array<number | null> = [];
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [{ id: 'f1', value: 9 }], 'L', lm,
      {
        ...config,
        docToEntity: (d, existing) => {
          seen.push(existing ? existing.value : null);
          // project: keep doc.value but tag prior — assert generic passes existing through.
          return docToFoo(d);
        },
      },
      refs(),
    );
    expect(seen).toContain(1);
    expect((current().find((e) => e.id === 'f1') as unknown as FooEntity).value).toBe(9);
  });

  it('differs override decides replace (and gets a build-once candidate getter)', () => {
    const { lm, current, writes } = makeLM([ent('f1', 'foo', 1)]);
    let builds = 0;
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [{ id: 'f1', value: 9 }], 'L', lm,
      {
        ...config,
        docToEntity: (d) => { builds += 1; return docToFoo(d); },
        // Force "no change" even though value differs → must NOT replace.
        differs: () => false,
      },
      refs(),
    );
    expect(writes).toHaveLength(0);
    expect((current().find((e) => e.id === 'f1') as unknown as FooEntity).value).toBe(1);
    expect(builds).toBe(0); // differs returned false → candidate never built
  });

  it('differs getCandidate() builds at most once', () => {
    const { lm } = makeLM([ent('f1', 'foo', 1)]);
    let builds = 0;
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [{ id: 'f1', value: 9 }], 'L', lm,
      {
        ...config,
        docToEntity: (d) => { builds += 1; return docToFoo(d); },
        differs: (_e, _d, getCandidate) => { getCandidate(); getCandidate(); return true; },
      },
      refs(),
    );
    expect(builds).toBe(1); // memoised across getCandidate() + final push
  });

  it('seedExtraBaseline runs per doc (Tier-2 dual baseline)', () => {
    const extra = new Map<string, string>();
    const { lm } = makeLM([]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [{ id: 'f1', value: 7 }, { id: 'f2', value: 8 }], 'L', lm,
      { ...config, seedExtraBaseline: (d) => { if (!extra.has(d.id)) extra.set(d.id, `link:${d.id}`); } },
      refs(),
    );
    expect(extra.get('f1')).toBe('link:f1');
    expect(extra.get('f2')).toBe('link:f2');
  });

  it('shouldDropOrphan override keeps un-persisted entities (MepSegment)', () => {
    const baseline = new Map<string, number>(); // f1 NOT persisted
    const { lm, current } = makeLM([ent('f1', 'foo', 1)]);
    mergeDocsIntoScene<FooDoc, FooEntity, number>(
      [], 'L', lm,
      {
        ...config,
        shouldDropOrphan: (id, r) => !r.dirty.has(id) && !r.pending.has(id) && r.lastSavedBaseline.has(id),
      },
      refs({ lastSavedBaseline: baseline }),
    );
    expect(current().map((e) => e.id)).toEqual(['f1']); // kept (never persisted)
  });

  it('prepareContext builds once and feeds docToEntity', () => {
    const { lm, current } = makeLM([ent('keep', 'line')]);
    let prepCalls = 0;
    mergeDocsIntoScene<FooDoc, FooEntity, number, { bonus: number }>(
      [{ id: 'f1', value: 1 }, { id: 'f2', value: 2 }], 'L', lm,
      {
        ...config,
        prepareContext: () => { prepCalls += 1; return { bonus: 100 }; },
        docToEntity: (d, _e, ctx) => ({ id: d.id, type: 'foo', value: d.value + ctx.bonus }),
      },
      refs(),
    );
    expect(prepCalls).toBe(1);
    expect((current().find((e) => e.id === 'f1') as unknown as FooEntity).value).toBe(101);
  });
});
