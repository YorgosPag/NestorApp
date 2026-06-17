/**
 * ADR-459 Φ7 — foundation-level-store tombstone behavior.
 *
 * Locks the regression: μετά από rotation/move ο writer διαγράφει το παλιό auto
 * πέδιλο (removeEntity) ΑΛΛΑ ένα stale realtime echo (που ακόμη το περιέχει)
 * ΔΕΝ πρέπει να το «αναστήσει» ως ghost στο `publishFoundationLevel`.
 */

import { useFoundationLevelStore } from '../foundation-level-store';
import type { Entity } from '../../types/entities';
import type { FoundationLevelTarget } from '../../systems/levels/building-foundation-level';

const ent = (id: string, type = 'foundation'): Entity => ({ id, type } as unknown as Entity);
const TARGET = { levelId: 'lvl_f', floorId: 'flr_f', sceneFileId: null, floorElevationMm: 0 } as FoundationLevelTarget;

beforeEach(() => useFoundationLevelStore.getState().clear());

describe('foundation-level-store — publish + tombstone', () => {
  it('publishes base non-footings + model footings', () => {
    const store = useFoundationLevelStore.getState();
    store.publishFoundationLevel(TARGET, [ent('w1', 'wall')], [ent('fnd_a')], 0);
    expect(useFoundationLevelStore.getState().entities.map((e) => e.id).sort()).toEqual(['fnd_a', 'w1']);
  });

  it('preserves an optimistic create (in store, not yet in model) as pending', () => {
    const s = useFoundationLevelStore.getState();
    s.upsertEntity(ent('fnd_new')); // optimistic create από τον writer
    s.publishFoundationLevel(TARGET, [], [], 0); // model echo δεν το έχει ακόμη
    expect(useFoundationLevelStore.getState().entities.map((e) => e.id)).toEqual(['fnd_new']);
  });

  it('does NOT resurrect a removed footing when a stale echo still contains it', () => {
    const s = useFoundationLevelStore.getState();
    s.publishFoundationLevel(TARGET, [], [ent('fnd_old'), ent('fnd_new')], 0);
    // writer διαγράφει το old (Firestore delete fired, δεν έχει διαδοθεί ακόμη).
    s.removeEntity('fnd_old');
    // stale echo: το model ΑΚΟΜΗ περιέχει το fnd_old.
    s.publishFoundationLevel(TARGET, [], [ent('fnd_old'), ent('fnd_new')], 0);
    expect(useFoundationLevelStore.getState().entities.map((e) => e.id)).toEqual(['fnd_new']);
  });

  it('clears the tombstone once the delete propagates (id absent from model)', () => {
    const s = useFoundationLevelStore.getState();
    s.removeEntity('fnd_old');
    // fresh echo χωρίς το old → tombstone καθαρίζεται.
    s.publishFoundationLevel(TARGET, [], [ent('fnd_new')], 0);
    expect(useFoundationLevelStore.getState().pendingRemovedIds.has('fnd_old')).toBe(false);
    expect(useFoundationLevelStore.getState().entities.map((e) => e.id)).toEqual(['fnd_new']);
  });

  it('upsert (re-create) lifts the tombstone so the footing can come back', () => {
    const s = useFoundationLevelStore.getState();
    s.removeEntity('fnd_x');
    expect(useFoundationLevelStore.getState().pendingRemovedIds.has('fnd_x')).toBe(true);
    s.upsertEntity(ent('fnd_x'));
    expect(useFoundationLevelStore.getState().pendingRemovedIds.has('fnd_x')).toBe(false);
    s.publishFoundationLevel(TARGET, [], [ent('fnd_x')], 0);
    expect(useFoundationLevelStore.getState().entities.map((e) => e.id)).toEqual(['fnd_x']);
  });

  it('setFoundationLevel / clear reset tombstones', () => {
    const s = useFoundationLevelStore.getState();
    s.removeEntity('fnd_z');
    s.setFoundationLevel(TARGET, [], 0);
    expect(useFoundationLevelStore.getState().pendingRemovedIds.size).toBe(0);
  });
});
