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
});
