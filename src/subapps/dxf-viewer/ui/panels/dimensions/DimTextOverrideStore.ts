/**
 * ADR-362 Phase G1 — Module-scoped store for the dimension text-override dialog.
 *
 * Hand-rolled external store (same pattern as DimensionCreateStore + HoverStore).
 * Zero React, zero Zustand. Controlled by the ribbon action dispatch.
 *
 * Lifecycle:
 *   openDimTextOverride(entityId)  → dialog appears, pre-populated from entity
 *   closeDimTextOverride()         → dialog disappears
 */

import { createExternalStore } from '../../../stores/createExternalStore';

export interface DimTextOverrideState {
  readonly isOpen: boolean;
  readonly entityId: string | null;
  /** Current `userText` of the target dim, read from the level-scene SSoT at open time. */
  readonly initialUserText: string | undefined;
}

const CLOSED: DimTextOverrideState = { isOpen: false, entityId: null, initialUserText: undefined };

// Field-compare equals αναπαράγει τα custom guards (open: ήδη-open-ίδιο-entity· close: ήδη-closed).
const store = createExternalStore<DimTextOverrideState>(CLOSED, {
  equals: (a, b) =>
    a.isOpen === b.isOpen && a.entityId === b.entityId && a.initialUserText === b.initialUserText,
});

export function getDimTextOverrideState(): DimTextOverrideState {
  return store.get();
}

export function subscribeDimTextOverride(listener: () => void): () => void {
  return store.subscribe(listener);
}

/**
 * Open the text-override dialog for the given dimension entity, pre-filled with its
 * current `userText`. Called by the `useDimensionModify` host AFTER it has read the dim
 * from the level-scene SSoT — so `isOpen && entityId` always denotes a real dimension.
 */
export function openDimTextOverride(entityId: string, initialUserText?: string): void {
  store.set({ isOpen: true, entityId, initialUserText });
}

/** Close the dialog. Idempotent. */
export function closeDimTextOverride(): void {
  store.set(CLOSED);
}

/** Test helper — mirrors DimensionCreateStore pattern. */
export function __resetDimTextOverrideStoreForTests(): void {
  store.reset(CLOSED);
}
