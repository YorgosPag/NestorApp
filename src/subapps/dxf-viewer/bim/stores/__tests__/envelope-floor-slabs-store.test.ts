/**
 * ADR-396 v2 Phase 5C — envelope-floor-slabs-store contract.
 *
 * Επιβεβαιώνει το non-React store SSoT που μοιράζονται ΟΛΟΙ οι envelope consumers
 * (2D `EnvelopeOverlay`, 3D scene builder, `use-bim3d-vg-resync`): snapshot
 * get/set, idempotent-on-identity set, subscribe/unsubscribe notify, reset.
 *
 * jest globals (ΟΧΙ vitest — ADR-396 P4 παγίδα).
 */

import {
  getEnvelopeFloorSlabs,
  setEnvelopeFloorSlabs,
  subscribeEnvelopeFloorSlabs,
  __resetEnvelopeFloorSlabsStore,
  type EnvelopeFloorSlabs,
} from '../envelope-floor-slabs-store';

beforeEach(() => {
  __resetEnvelopeFloorSlabsStore();
});

function snap(activeFloorId: string | null): EnvelopeFloorSlabs {
  return {
    floors: [{ id: 'f1', elevation: 0 }, { id: 'f2', elevation: 3 }],
    slabs: [],
    activeFloorId,
  };
}

describe('envelope-floor-slabs-store', () => {
  it('default snapshot = κενό (μηδέν regression → όλες οι τρύπες δωμάτια)', () => {
    const s = getEnvelopeFloorSlabs();
    expect(s.floors).toEqual([]);
    expect(s.slabs).toEqual([]);
    expect(s.activeFloorId).toBeNull();
  });

  it('set αντικαθιστά το snapshot + το επιστρέφει το get (stable ref)', () => {
    const next = snap('f1');
    setEnvelopeFloorSlabs(next);
    expect(getEnvelopeFloorSlabs()).toBe(next);
  });

  it('subscribe ειδοποιείται σε κάθε αλλαγή snapshot', () => {
    let calls = 0;
    const unsub = subscribeEnvelopeFloorSlabs(() => {
      calls += 1;
    });
    setEnvelopeFloorSlabs(snap('f1'));
    setEnvelopeFloorSlabs(snap('f2'));
    expect(calls).toBe(2);
    unsub();
  });

  it('set ίδιου ref (identity) = ΚΑΜΙΑ ειδοποίηση (idempotent)', () => {
    const same = snap('f1');
    let calls = 0;
    subscribeEnvelopeFloorSlabs(() => {
      calls += 1;
    });
    setEnvelopeFloorSlabs(same);
    setEnvelopeFloorSlabs(same); // ίδιο ref → no-op
    expect(calls).toBe(1);
  });

  it('μετά από unsubscribe ΔΕΝ ειδοποιείται', () => {
    let calls = 0;
    const unsub = subscribeEnvelopeFloorSlabs(() => {
      calls += 1;
    });
    unsub();
    setEnvelopeFloorSlabs(snap('f1'));
    expect(calls).toBe(0);
  });

  it('reset επαναφέρει σε κενό + καθαρίζει listeners', () => {
    let calls = 0;
    subscribeEnvelopeFloorSlabs(() => {
      calls += 1;
    });
    setEnvelopeFloorSlabs(snap('f1'));
    __resetEnvelopeFloorSlabsStore();
    expect(getEnvelopeFloorSlabs().activeFloorId).toBeNull();
    setEnvelopeFloorSlabs(snap('f2')); // ο παλιός listener καθαρίστηκε
    expect(calls).toBe(1);
  });
});
