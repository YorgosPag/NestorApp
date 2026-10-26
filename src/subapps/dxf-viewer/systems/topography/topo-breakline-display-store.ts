/**
 * ADR-920 Β4.8 Β3.4 — BreaklineDisplayStore: HOW the committed breaklines are displayed.
 *
 * The breakline sibling of `contour-display-store` / `terrain-3d-store` (Civil 3D's Surface ↔
 * Surface-Style split): the breaklines themselves live in the survey DEFINITION (`TopoPointStore`) and
 * keep cutting the surface whether or not they are drawn — this store only owns the presentation.
 *
 *   - `visible` — the «eye». ONE category for both views: the 2D `TopoBreaklineOverlay` returns
 *     nothing and the 3D `TopoBreaklineLayer` gates through `TopoSceneLayer.isLayerShown()`. Persisted
 *     with the floor's topo document (Revit VG / Civil 3D style travel with the drawing). Default `true`:
 *     a document saved before this field existed shows exactly what it showed before.
 *   - `focusedId` — «αυτήν κοιτάω τώρα» (the list row the engineer clicked). Ephemeral: never persisted,
 *     never in the save signature, cleared on every hydrate. A focused id that no longer exists simply
 *     matches nothing — no reconciliation needed.
 *
 * Pattern: `createExternalStore` vanilla store (ADR-040) — zero React state; the 2D leaf / panel / ribbon
 * subscribe via `useSyncExternalStore` (LOW-freq), the 3D layer imperatively.
 */

import { createExternalStore } from '../../stores/createExternalStore';

export interface BreaklineDisplayState {
  readonly visible: boolean;
  readonly focusedId: string | null;
}

/** The persisted half of {@link BreaklineDisplayState}. */
export interface BreaklineDisplayPrefs {
  readonly visible: boolean;
}

/** Absent in a legacy document ⇒ shown, as before the eye existed. */
export const DEFAULT_BREAKLINE_DISPLAY_PREFS: BreaklineDisplayPrefs = { visible: true };

const store = createExternalStore<BreaklineDisplayState>({
  visible: DEFAULT_BREAKLINE_DISPLAY_PREFS.visible,
  focusedId: null,
});

/** Full snapshot (stable while unchanged — safe as a `useSyncExternalStore` getSnapshot). */
export function getBreaklineDisplayState(): BreaklineDisplayState {
  return store.get();
}

/** Show / hide the committed breaklines in 2D and 3D. No-op if unchanged. */
export function setBreaklinesVisible(visible: boolean): void {
  const current = store.get();
  if (current.visible === visible) return;
  store.set({ ...current, visible });
}

/** Mark one breakline as the one under review (`null` = none). No-op if unchanged. */
export function setFocusedBreakline(focusedId: string | null): void {
  const current = store.get();
  if (current.focusedId === focusedId) return;
  store.set({ ...current, focusedId });
}

/** The persistence payload (visibility only — focus is ephemeral). */
export function getBreaklineDisplayPrefs(): BreaklineDisplayPrefs {
  return { visible: store.get().visible };
}

/** Hydrate from a document: restores the eye and drops any focus from the previous floor. */
export function restoreBreaklineDisplay(prefs: BreaklineDisplayPrefs): void {
  const current = store.get();
  if (current.visible === prefs.visible && current.focusedId === null) return;
  store.set({ visible: prefs.visible, focusedId: null });
}

/** Subscribe to display changes; returns unsubscribe. */
export function subscribeBreaklineDisplay(listener: () => void): () => void {
  return store.subscribe(listener);
}
