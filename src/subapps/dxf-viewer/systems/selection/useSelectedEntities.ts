'use client';

/**
 * Leaf-subscriber hooks for {@link SelectedEntitiesStore} (ADR-532).
 *
 * ONLY leaf components that visually depend on the selection should call these
 * (ADR-040 dual-access invariant). Orchestrators must read imperatively via the
 * `SelectedEntitiesStore.getX()` getters at event time and let their leaves
 * subscribe — never subscribe in an orchestrator.
 *
 * Each hook returns a reference-stable (arrays) or value-stable (boolean/number)
 * snapshot, so `useSyncExternalStore` re-renders the leaf only when its own
 * slice actually changes — even though the store has a single notify channel.
 */

import { useCallback, useSyncExternalStore } from 'react';

import type { SelectableEntityType, SelectionEntry } from './types';
import {
  subscribeSelection,
  getStorePrimaryId,
  getStoreSelectionEntries,
  getStoreSelectedEntityIds,
  getStoreSelectionCount,
  getStoreIdsByType,
  isStoreSelected,
} from './SelectedEntitiesStore';

/** Reactive dxf-entity id list (reference-stable until the dxf selection changes). */
export function useSelectedEntityIds(): string[] {
  return useSyncExternalStore(
    subscribeSelection,
    getStoreSelectedEntityIds,
    getStoreSelectedEntityIds,
  );
}

/** Reactive primary selected id (value-stable string snapshot). */
export function usePrimarySelectedId(): string | null {
  return useSyncExternalStore(subscribeSelection, getStorePrimaryId, getStorePrimaryId);
}

/**
 * Reactive ΠΛΗΡΕΙΣ selection entries (`{ id, type }`, όχι μόνο ids) — reference-stable
 * μέχρι να αλλάξει η επιλογή. Το reactive αντίστοιχο του `useUniversalSelection().getAll()`
 * για leaves που ΔΕΙΧΝΟΥΝ την επιλογή (π.χ. multi-selection ribbon panels).
 */
export function useSelectionEntries(): readonly SelectionEntry[] {
  return useSyncExternalStore(
    subscribeSelection,
    getStoreSelectionEntries,
    getStoreSelectionEntries,
  );
}

/** Reactive total selection count (value-stable number snapshot). */
export function useSelectionCount(): number {
  return useSyncExternalStore(subscribeSelection, getStoreSelectionCount, getStoreSelectionCount);
}

/** Reactive boolean: is `id` currently selected (value-stable per id). */
export function useIsSelected(id: string): boolean {
  const getSnapshot = useCallback(() => isStoreSelected(id), [id]);
  return useSyncExternalStore(subscribeSelection, getSnapshot, getSnapshot);
}

/** Reactive id list for one selectable type (reference-stable per type). */
export function useSelectionByType(type: SelectableEntityType): string[] {
  const getSnapshot = useCallback(() => getStoreIdsByType(type), [type]);
  return useSyncExternalStore(subscribeSelection, getSnapshot, getSnapshot);
}
