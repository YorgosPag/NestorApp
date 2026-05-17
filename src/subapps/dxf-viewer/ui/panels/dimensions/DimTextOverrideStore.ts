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

export interface DimTextOverrideState {
  readonly isOpen: boolean;
  readonly entityId: string | null;
}

const CLOSED: DimTextOverrideState = { isOpen: false, entityId: null };

let current: DimTextOverrideState = CLOSED;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function getDimTextOverrideState(): DimTextOverrideState {
  return current;
}

export function subscribeDimTextOverride(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Open the text-override dialog for the given dimension entity. */
export function openDimTextOverride(entityId: string): void {
  if (current.isOpen && current.entityId === entityId) return;
  current = { isOpen: true, entityId };
  notify();
}

/** Close the dialog. Idempotent. */
export function closeDimTextOverride(): void {
  if (!current.isOpen) return;
  current = CLOSED;
  notify();
}

/** Test helper — mirrors DimensionCreateStore pattern. */
export function __resetDimTextOverrideStoreForTests(): void {
  current = CLOSED;
  listeners.clear();
}
