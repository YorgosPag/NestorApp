'use client';

/**
 * RibbonFieldStore — per-`commandKey` field-state SSoT for ribbon VALUE widgets
 * (ADR-547 Stage 4 Option B — full retained-mode / Revit-grade binding).
 *
 * PROBLEM (profile 12:34): with the volatile `RibbonFieldContext`, editing ONE
 * field (e.g. wall thickness) re-rendered EVERY value widget in the active
 * contextual panel (they all consume the same context object). That is the React
 * equivalent of a non-retained UI: the whole panel reconciles per change.
 *
 * SOLUTION: a zero-React store holding the current field READER functions, with
 * per-key, reference-stable slices. A widget subscribes (via
 * {@link useRibbonComboboxState} / {@link useRibbonToggleState} / …) to ITS key
 * only, so a change to another key is a no-op for it — `INotifyPropertyChanged`
 * / signal semantics, mirroring `useSceneSelectors` (ADR-547 Stage 2/3) and the
 * canvas micro-leaf doctrine (ADR-040).
 *
 * The readers are pushed in by `RibbonCommandProvider` on every commit
 * ({@link setRibbonFieldReaders}); the per-key signature cache gates re-renders so
 * an over-notify costs only a cheap getSnapshot compare, never a re-render.
 */

import type { RibbonComboboxState, RibbonToggleState } from './ribbon-command-types';

/** The pull-style readers produced by `useRibbonCommands` (bridge-backed). */
export interface RibbonFieldReaders {
  getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  getToggleState: (commandKey: string) => RibbonToggleState;
  getBadgeState: (badgeKey: string) => boolean;
  getPanelVisibility: (visibilityKey: string) => boolean;
}

const NULL_READERS: RibbonFieldReaders = {
  getComboboxState: () => null,
  getToggleState: () => false,
  getBadgeState: () => false,
  getPanelVisibility: () => true,
};

let readers: RibbonFieldReaders = NULL_READERS;
const listeners = new Set<() => void>();

// Per-key signature cache → keeps a STABLE reference for a combobox slice while
// its observable signature (value + disabled + option values) is unchanged. This
// is what lets `useSyncExternalStore` bail a widget whose value did not move.
const comboCache = new Map<string, { sig: string; slice: RibbonComboboxState | null }>();

function comboSignature(s: RibbonComboboxState | null): string {
  if (!s) return '∅';
  const opts = s.options.map((o) => o.value).join(',');
  return `${s.value ?? '∅'}|${s.disabled ? 1 : 0}|${opts}`;
}

/**
 * Swap the active readers (called by the provider every commit) and notify
 * subscribers. Subscribers re-pull their per-key snapshot; the signature cache
 * decides which actually changed → only those re-render.
 */
export function setRibbonFieldReaders(next: RibbonFieldReaders): void {
  readers = next;
  for (const l of listeners) l();
}

/** Reset to the inert default (test teardown / provider unmount). */
export function resetRibbonFieldReaders(): void {
  readers = NULL_READERS;
  comboCache.clear();
  for (const l of listeners) l();
}

export function subscribeRibbonField(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Reference-stable combobox slice for `commandKey`. Returns the SAME object
 * across calls while the value/options/disabled signature is unchanged, so a
 * `useSyncExternalStore` subscriber bails when its own value did not move.
 */
export function getRibbonComboboxSlice(commandKey: string): RibbonComboboxState | null {
  const cur = readers.getComboboxState(commandKey);
  const sig = comboSignature(cur);
  const cached = comboCache.get(commandKey);
  if (cached && cached.sig === sig) return cached.slice;
  comboCache.set(commandKey, { sig, slice: cur });
  return cur;
}

// Toggle / badge / panel-visibility snapshots are primitives (boolean | null),
// so `Object.is` already gives reference stability — no cache needed.
export function getRibbonToggleSlice(commandKey: string): RibbonToggleState {
  return readers.getToggleState(commandKey);
}
export function getRibbonBadgeSlice(badgeKey: string): boolean {
  return readers.getBadgeState(badgeKey);
}
export function getRibbonPanelVisibilitySlice(visibilityKey: string): boolean {
  return readers.getPanelVisibility(visibilityKey);
}
