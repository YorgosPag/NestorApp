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
}

const CLOSED: DimTextOverrideState = { isOpen: false, entityId: null };

// Field-compare equals αναπαράγει τα custom guards (open: ήδη-open-ίδιο-entity· close: ήδη-closed).
const store = createExternalStore<DimTextOverrideState>(CLOSED, {
  equals: (a, b) => a.isOpen === b.isOpen && a.entityId === b.entityId,
});

export function getDimTextOverrideState(): DimTextOverrideState {
  return store.get();
}

export function subscribeDimTextOverride(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Open the text-override dialog for the given dimension entity. */
export function openDimTextOverride(entityId: string): void {
  store.set({ isOpen: true, entityId });
}

/** Close the dialog. Idempotent. */
export function closeDimTextOverride(): void {
  store.set(CLOSED);
}

/** Test helper — mirrors DimensionCreateStore pattern. */
export function __resetDimTextOverrideStoreForTests(): void {
  store.reset(CLOSED);
}
