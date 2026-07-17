/**
 * ADR-652 M6 — «Επιλογή σημείου βάσης» pick session (AutoCAD «Specify base point»).
 *
 * Γεφυρώνει τον καμβά ({@link handlePickBasePointClick}) με τον διάλογο «Δημιουργία Block»
 * ({@link CreateBlockDialogHost}): ο χρήστης πατά «Επιλογή σημείου βάσης» στον διάλογο (`arm`),
 * ο διάλογος κρύβεται προσωρινά, ΕΝΑ κλικ στον καμβά (ήδη snapped) γράφει το world σημείο εδώ,
 * και ο host το υιοθετεί ως `baseOverride` του {@link buildBlockDefFromSelection}.
 *
 * Zero React state (createExternalStore, ADR-040) — ΙΔΙΟ idiom με το `geo-ref-pick-store` (M10):
 * `arm → capture (one-shot) → read`. Δεν υπάρχει activeTool· το armed flag ΕΙΝΑΙ το mode, οπότε ο
 * click handler γκειτάρει στο {@link isPickBasePointArmed} αντί σε εργαλείο.
 *
 * @see ../../hooks/canvas/canvas-click-pick-base-point.ts — ο click handler (γράφει το σημείο)
 * @see ../../ui/panels/block-library/CreateBlockDialogHost.tsx — ο consumer (arm + adopt)
 * @see ../geo-referencing/geo-ref-pick-store.ts — το αδελφικό pattern (M10)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../stores/createExternalStore';
import type { Point2D } from '../../rendering/types/Types';

export interface PickBasePointState {
  /** `true` όσο ο διάλογος περιμένει το επόμενο κλικ ως σημείο βάσης. */
  readonly armed: boolean;
  /** Το τελευταίο world σημείο που πιάστηκε (canonical mm)· `null` πριν το capture. */
  readonly point: Point2D | null;
}

const INITIAL: PickBasePointState = { armed: false, point: null };

const store = createExternalStore<PickBasePointState>(INITIAL);

export function getPickBasePointState(): PickBasePointState {
  return store.get();
}

/** Event-time read για τον click handler (χωρίς stale snapshot). */
export function isPickBasePointArmed(): boolean {
  return store.get().armed;
}

export function subscribePickBasePoint(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Arm: το επόμενο (snapped) κλικ στον καμβά γράφεται ως σημείο βάσης. */
export function armPickBasePoint(): void {
  store.set({ armed: true, point: null });
}

/** Ακύρωση capture ΧΩΡΙΣ να πειραχτεί ήδη επιλεγμένο σημείο (Esc). */
export function disarmPickBasePoint(): void {
  if (!store.get().armed) return;
  store.set({ ...store.get(), armed: false });
}

/** One-shot capture (κάνει disarm). No-op όταν δεν είναι armed. Καλείται από τον click handler. */
export function capturePickBasePoint(world: Point2D): void {
  if (!store.get().armed) return;
  store.set({ armed: false, point: world });
}

/** Reset ολόκληρης της session (ο host υιοθετεί το σημείο → πίσω σε idle). */
export function clearPickBasePoint(): void {
  store.set(INITIAL);
}

const getServerSnapshot = (): PickBasePointState => INITIAL;

/** Reactive read — ο host υιοθετεί το capture + κρύβει/επαναφέρει τον διάλογο με βάση αυτό. */
export function usePickBasePointState(): PickBasePointState {
  return useSyncExternalStore(store.subscribe, store.get, getServerSnapshot);
}

/** Test-only reset. */
export function __resetPickBasePointForTests(): void {
  store.reset(INITIAL);
}
