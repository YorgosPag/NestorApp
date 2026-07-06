/**
 * ADR-362 §7 — Module-scoped store for the «Επεξεργασία Στυλ…» ribbon action.
 *
 * Hand-rolled external store (same pattern as DimTextOverrideStore + HoverStore).
 * Zero React, zero Zustand. Carries a single pending «focus this DIMSTYLE in the
 * Style Manager» request from the DIMENSION contextual tab to the (lazily-mounted)
 * `DimensionsTab`. The store holds the request until the panel mounts + consumes it,
 * so there is NO race between `showTab('dimensions')` and the tab's first render.
 *
 * The tab decides edit vs select from the registry (built-ins are read-only —
 * `updateCustomStyle` throws for them), so this store carries ONLY the styleId.
 *
 * Lifecycle:
 *   requestEditDimStyle(styleId)  → DimensionsTab focuses the style (edit if custom,
 *                                    selected-for-duplicate if built-in)
 *   clearDimStyleEditorRequest()  → request consumed (tab calls after focusing)
 */

import { createExternalStore } from '../../../stores/createExternalStore';

export interface DimStyleEditorRequest {
  /** DIMSTYLE id to focus in the Style Manager, or null = no pending request. */
  readonly styleId: string | null;
}

const NONE: DimStyleEditorRequest = { styleId: null };

// Field-compare equals so re-requesting the SAME id after a consume (NONE → id)
// still notifies, while a redundant set to the same pending id does not.
const store = createExternalStore<DimStyleEditorRequest>(NONE, {
  equals: (a, b) => a.styleId === b.styleId,
});

export function getDimStyleEditorRequest(): DimStyleEditorRequest {
  return store.get();
}

export function subscribeDimStyleEditor(listener: () => void): () => void {
  return store.subscribe(listener);
}

/**
 * Request the Style Manager to focus `styleId`. Called by the `useDimensionModify`
 * host AFTER it has resolved the dim from the level-scene SSoT — so the id always
 * denotes the real selected dimension's DIMSTYLE.
 */
export function requestEditDimStyle(styleId: string): void {
  store.set({ styleId });
}

/** Consume the pending request (DimensionsTab calls after focusing). Idempotent. */
export function clearDimStyleEditorRequest(): void {
  store.set(NONE);
}

/** Test helper — mirrors DimTextOverrideStore pattern. */
export function __resetDimStyleEditorStoreForTests(): void {
  store.reset(NONE);
}
