/**
 * ADR-459 Phase 7 v8.1 — collectFoundationFootings (candidate sourcing for the
 * auto-design reconciler). Locks the regression: ένα υπάρχον auto πέδιλο πρέπει να
 * φτάνει στο reconcile από το model SSoT (store) ΑΚΟΜΗ κι αν η live foundation scene
 * είναι stale/απούσα — αλλιώς rotation/move → νέο πέδιλο χωρίς διαγραφή του παλιού.
 */

import { collectFoundationFootings } from '../foundation-footing-candidates';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';

const ent = (id: string, type: string): Entity => ({ id, type } as unknown as Entity);
const scene = (entities: Entity[]): SceneModel =>
  ({ entities, layersById: {}, bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }, units: 'mm' } as unknown as SceneModel);

describe('collectFoundationFootings', () => {
  it('returns only the store footings when no foundation scene is loaded', () => {
    const store = [ent('l1', 'line'), ent('fnd_a', 'foundation'), ent('c1', 'column')];
    expect(collectFoundationFootings(store, null).map((e) => e.id)).toEqual(['fnd_a']);
  });

  it('keeps a store-only auto footing even when the live scene lacks it (the regression)', () => {
    // store έχει το auto πέδιλο (model SSoT)· η live scene είναι stale (μόνο DXF).
    const store = [ent('fnd_auto', 'foundation')];
    const liveScene = scene([ent('line1', 'line')]);
    expect(collectFoundationFootings(store, liveScene).map((e) => e.id)).toEqual(['fnd_auto']);
  });

  it('unions scene-only footings with store footings (dedup by id, store wins)', () => {
    const storeFooting = ent('fnd_shared', 'foundation');
    const store = [storeFooting];
    const liveScene = scene([ent('fnd_shared', 'foundation'), ent('fnd_scene_only', 'foundation')]);
    const result = collectFoundationFootings(store, liveScene);
    expect(result.map((e) => e.id).sort()).toEqual(['fnd_scene_only', 'fnd_shared']);
    // store wins for the shared id (object identity).
    expect(result.find((e) => e.id === 'fnd_shared')).toBe(storeFooting);
  });

  it('ignores non-footing entities from both sources', () => {
    const store = [ent('w1', 'wall')];
    const liveScene = scene([ent('l1', 'line'), ent('col1', 'column')]);
    expect(collectFoundationFootings(store, liveScene)).toEqual([]);
  });

  it('returns the same store list reference shape when scene adds nothing new', () => {
    const store = [ent('fnd_a', 'foundation')];
    const liveScene = scene([ent('fnd_a', 'foundation')]); // same id only
    expect(collectFoundationFootings(store, liveScene).map((e) => e.id)).toEqual(['fnd_a']);
  });
});
