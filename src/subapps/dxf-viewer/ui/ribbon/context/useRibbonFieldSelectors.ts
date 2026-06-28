'use client';

/**
 * RIBBON FIELD SELECTOR HOOKS — per-`commandKey` leaf subscriptions over the
 * {@link RibbonFieldStore} SSoT (ADR-547 Stage 4 Option B).
 *
 * The reactive counterpart to the store's pull-slices: a value widget subscribes
 * to ITS key only, so editing another field is a no-op for it (INotifyProperty-
 * Changed / signal semantics). Mirrors `useSceneSelectors` (ADR-547 Stage 2/3)
 * and the canvas micro-leaf doctrine (ADR-040): re-render only when MY slice moves.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { RibbonComboboxState, RibbonToggleState } from './ribbon-command-types';
import {
  subscribeRibbonField,
  getRibbonComboboxSlice,
  getRibbonToggleSlice,
  getRibbonBadgeSlice,
  getRibbonPanelVisibilitySlice,
} from './RibbonFieldStore';

/** Subscribe to one combobox field. Re-renders only when THIS key's value/options move. */
export function useRibbonComboboxState(commandKey: string): RibbonComboboxState | null {
  const getSnapshot = useCallback(() => getRibbonComboboxSlice(commandKey), [commandKey]);
  return useSyncExternalStore(subscribeRibbonField, getSnapshot, getSnapshot);
}

/** Subscribe to one toggle field. Boolean snapshot → value-stable. */
export function useRibbonToggleState(commandKey: string): RibbonToggleState {
  const getSnapshot = useCallback(() => getRibbonToggleSlice(commandKey), [commandKey]);
  return useSyncExternalStore(subscribeRibbonField, getSnapshot, getSnapshot);
}

/** Subscribe to one tab/validation badge. */
export function useRibbonBadgeState(badgeKey: string): boolean {
  const getSnapshot = useCallback(() => getRibbonBadgeSlice(badgeKey), [badgeKey]);
  return useSyncExternalStore(subscribeRibbonField, getSnapshot, getSnapshot);
}

/** Subscribe to one panel's visibility predicate. */
export function useRibbonPanelVisibility(visibilityKey: string): boolean {
  const getSnapshot = useCallback(() => getRibbonPanelVisibilitySlice(visibilityKey), [visibilityKey]);
  return useSyncExternalStore(subscribeRibbonField, getSnapshot, getSnapshot);
}
