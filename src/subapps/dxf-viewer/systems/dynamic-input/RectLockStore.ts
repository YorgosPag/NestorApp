// ADR-513 §rectangle — Dynamic-input locks για το εργαλείο «Ορθογώνιο».
// Singleton zero-React SSoT. Pattern: DynamicInputLockStore (mirror).
//
// Το ορθογώνιο θέλει ΤΡΙΑ ανεξάρτητα locks (Πλάτος / Ύψος / Γωνία), αντί για το polar
// length+angle της Γραμμής — γι' αυτό ξεχωριστό store (ΟΧΙ reuse του DynamicInputLockStore).
// Πλάτος/Ύψος σε **scene units** (μέσω lengthDisplayToSceneLock), Γωνία σε **μοίρες**.
// Απόφαση A (locked νικά): οι κλειδωμένες πλευρές μένουν σταθερές· το 2ο κλικ δίνει μόνο
// τις μη-κλειδωμένες πλευρές + φορά/τεταρτημόριο (βλ. applyRectLock στο rect-lock.ts).

import { createExternalStore } from '../../stores/createExternalStore';

export interface RectLockState {
  /** scene-units πλάτος (οριζόντια τοπική πλευρά, locked) ή null. */
  readonly width: number | null;
  /** scene-units ύψος (κάθετη τοπική πλευρά, locked) ή null. */
  readonly height: number | null;
  /** μοίρες γωνία κλίσης ως προς την οριζόντια (locked) ή null. */
  readonly angle: number | null;
}

// Πηγαία (ανεξάρτητα) πεδία· το public snapshot είναι φρέσκο object κάθε φορά.
let _width: number | null = null;
let _height: number | null = null;
let _angle: number | null = null;

function snapshot(): RectLockState {
  return { width: _width, height: _height, angle: _angle };
}

// equals: Object.is → νέο object κάθε φορά, notify πάντα (mirror DynamicInputLockStore).
const store = createExternalStore<RectLockState>(snapshot(), { equals: Object.is });

function _notify(): void {
  store.set(snapshot());
}

export const RectLockStore = {
  lockWidth(value: number): void {
    _width = value;
    _notify();
  },

  lockHeight(value: number): void {
    _height = value;
    _notify();
  },

  lockAngle(value: number): void {
    _angle = value;
    _notify();
  },

  unlockWidth(): void {
    if (_width === null) return;
    _width = null;
    _notify();
  },

  unlockHeight(): void {
    if (_height === null) return;
    _height = null;
    _notify();
  },

  unlockAngle(): void {
    if (_angle === null) return;
    _angle = null;
    _notify();
  },

  /** Ξεκλείδωμα ΟΛΩΝ — καλείται μετά την τοποθέτηση (rectangle δεν είναι continuous-segment). */
  unlockAll(): void {
    if (_width === null && _height === null && _angle === null) return;
    _width = null;
    _height = null;
    _angle = null;
    _notify();
  },

  getLocked(): RectLockState {
    return store.get();
  },

  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
  },

  getSnapshot(): RectLockState {
    return store.get();
  },
};
