// ADR-357 Phase 13 — G14 Length/Angle Locking · ADR-513 — dual independent locks.
// Singleton zero-React SSoT. Pattern: TrackingPointStore / HoverStore.
//
// ADR-513: το **μήκος ΚΑΙ η γωνία κλειδώνουν ΑΝΕΞΑΡΤΗΤΑ** (όχι αμοιβαία αποκλειόμενα όπως πριν) —
// ο χρήστης του «Δαχτυλιδιού Εντολών» κλειδώνει ό,τι θέλει, χωρίς να χάνει το άλλο. Για συμβατότητα
// με τους υπάρχοντες readers (γραμμικό Dynamic Input Ctrl+L/Ctrl+A) εκθέτουμε ΚΑΙ τα derived
// `lockedField`/`lockedValue` (length-priority). Ctrl+L locks length· Ctrl+A locks angle.

import { createExternalStore } from '../../stores/createExternalStore';

export type LockedField = 'length' | 'angle';

export interface LockState {
  /** mm/scene-units μήκος (locked) ή null. */
  readonly length: number | null;
  /** μοίρες γωνία (locked) ή null. */
  readonly angle: number | null;
  /** Derived (legacy single-field readers): length-priority. */
  readonly lockedField: LockedField | null;
  readonly lockedValue: number | null;
}

// Πηγαία (ανεξάρτητα) πεδία· το public snapshot είναι το derived `LockState`.
let _length: number | null = null;
let _angle: number | null = null;

function derive(): LockState {
  const lockedField: LockedField | null = _length !== null ? 'length' : _angle !== null ? 'angle' : null;
  const lockedValue = _length !== null ? _length : _angle;
  return { length: _length, angle: _angle, lockedField, lockedValue };
}

// SSoT pub/sub primitive· κάθε `_notify` σπρώχνει φρέσκο derived snapshot
// (`equals: Object.is` → νέο object κάθε φορά, notify πάντα — όπως πριν).
const store = createExternalStore<LockState>(derive(), { equals: Object.is });

function _notify(): void {
  store.set(derive());
}

export const DynamicInputLockStore = {
  lockLength(value: number): void {
    _length = value;
    _notify();
  },

  lockAngle(value: number): void {
    _angle = value;
    _notify();
  },

  /** Ξεκλείδωμα ΜΟΝΟ του μήκους (το angle μένει). */
  unlockLength(): void {
    if (_length === null) return;
    _length = null;
    _notify();
  },

  /** Ξεκλείδωμα ΜΟΝΟ της γωνίας (το length μένει). */
  unlockAngle(): void {
    if (_angle === null) return;
    _angle = null;
    _notify();
  },

  /** Ξεκλείδωμα ΚΑΙ των δύο. */
  unlock(): void {
    if (_length === null && _angle === null) return;
    _length = null;
    _angle = null;
    _notify();
  },

  /** Toggle ανεξάρτητα ανά πεδίο (ΔΕΝ καθαρίζει το άλλο) — Ctrl+L / Ctrl+A. */
  toggle(field: LockedField, value: number): void {
    if (field === 'length') {
      _length = _length !== null ? null : value;
    } else {
      _angle = _angle !== null ? null : value;
    }
    _notify();
  },

  getLocked(): LockState {
    return store.get();
  },

  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
  },

  getSnapshot(): LockState {
    return store.get();
  },
};
