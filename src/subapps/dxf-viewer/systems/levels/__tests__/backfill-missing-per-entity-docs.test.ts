/**
 * ADR-635 Φ C.18 — load-time backfill για per-entity entities χωρίς backing doc.
 *
 * Locks:
 *   - `detectMissingPerEntityDocIds`: batchGet ανά family· επιστρέφει ΜΟΝΟ τα ids χωρίς doc.
 *   - cheap skip: καμία per-entity οντότητα ⇒ empty set + batchGet ΔΕΝ καλείται (μηδέν round-trip).
 *   - `emitBackfillFirstSaves`: εκπέμπει `drawing:entity-created` ΜΟΝΟ για τα missing, με το
 *     δηλωμένο scope (απόδειξη no-stale-overwrite: entity ΜΕ doc δεν εκπέμπεται ποτέ).
 */

const batchGetMock = jest.fn();
jest.mock('@/services/firestore', () => ({
  firestoreQueryService: { batchGet: (...args: unknown[]) => batchGetMock(...args) },
}));

import type { SceneModel } from '../../../types/scene';
import type { AnySceneEntity } from '../../../types/entities';
import { EventBus } from '../../events/EventBus';
import {
  detectMissingPerEntityDocIds,
  emitBackfillFirstSaves,
} from '../backfill-missing-per-entity-docs';

/** Minimal fixture — οι type guards διαβάζουν μόνο `id` & `type`. */
const ent = (type: string, id: string): AnySceneEntity =>
  ({ id, type } as unknown as AnySceneEntity);

const scene = (entities: AnySceneEntity[]): SceneModel =>
  ({ entities, layersById: {}, bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }, units: 'mm' } as unknown as SceneModel);

beforeEach(() => batchGetMock.mockReset());

describe('detectMissingPerEntityDocIds', () => {
  it('returns only the hatch ids that have NO Firestore doc', async () => {
    // batchGet reports h1 exists; h2/h3 do not.
    batchGetMock.mockResolvedValue(new Map([['h1', { id: 'h1' }]]));
    const loaded = scene([ent('line', 'l1'), ent('hatch', 'h1'), ent('hatch', 'h2'), ent('hatch', 'h3')]);

    const missing = await detectMissingPerEntityDocIds(loaded);

    expect([...missing].sort()).toEqual(['h2', 'h3']);
    expect(batchGetMock).toHaveBeenCalledWith('FLOORPLAN_HATCHES', ['h1', 'h2', 'h3']);
  });

  it('no per-entity entities ⇒ empty set and batchGet is NOT called (cheap skip)', async () => {
    const loaded = scene([ent('line', 'l1'), ent('text', 't1')]);
    const missing = await detectMissingPerEntityDocIds(loaded);
    expect(missing.size).toBe(0);
    expect(batchGetMock).not.toHaveBeenCalled();
  });

  it('all hatches have docs ⇒ empty set (no backfill needed)', async () => {
    batchGetMock.mockResolvedValue(new Map([['h1', { id: 'h1' }], ['h2', { id: 'h2' }]]));
    const loaded = scene([ent('hatch', 'h1'), ent('hatch', 'h2')]);
    const missing = await detectMissingPerEntityDocIds(loaded);
    expect(missing.size).toBe(0);
  });
});

describe('emitBackfillFirstSaves', () => {
  function capture(fn: () => void): Array<{ id: string; tool: string; scope?: unknown }> {
    const events: Array<{ id: string; tool: string; scope?: unknown }> = [];
    const off = EventBus.on('drawing:entity-created', (p) =>
      events.push({ id: p.entity.id, tool: p.tool, scope: (p as { scope?: unknown }).scope }),
    );
    try { fn(); } finally { off(); }
    return events;
  }

  const scope = { levelId: 'lvl1', floorId: 'flr1', floorplanId: 'file1' };

  it('emits ONLY for missing ids, with the passed scope (no-stale-overwrite proof)', () => {
    const loaded = scene([ent('hatch', 'h_missing'), ent('hatch', 'h_hasdoc'), ent('line', 'l1')]);
    const events = capture(() =>
      emitBackfillFirstSaves(loaded, new Set(['h_missing']), scope),
    );
    // h_hasdoc HAS a doc → not in missing → never emitted (would overwrite authoritative doc).
    expect(events).toEqual([{ id: 'h_missing', tool: 'hatch', scope }]);
  });

  it('no-op when missing set is empty', () => {
    const loaded = scene([ent('hatch', 'h1')]);
    const events = capture(() => emitBackfillFirstSaves(loaded, new Set(), scope));
    expect(events).toEqual([]);
  });
});
