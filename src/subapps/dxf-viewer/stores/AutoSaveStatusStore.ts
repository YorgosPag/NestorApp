"use client";

/**
 * @module AutoSaveStatusStore
 * @description Reactive SSoT channel for the DXF SCENE auto-save status
 * (filename + save lifecycle), decoupled from the LevelsSystem context.
 *
 * WHY THIS EXISTS — ribbon re-render cascade (profiler 2026-06-28):
 * The scene auto-save status (`saveStatus` saving→success→idle + `lastSaveTime`)
 * used to reach the UI through getters on the LevelsSystem context value. Those
 * getters depended on the `sceneManager` object, which changes identity on every
 * save cycle, so the whole `LevelsHookReturn` memo recomputed on each edit →
 * ~40 ribbon-command bridges churned → `RibbonRoot` memo broke → the entire
 * ribbon + ~900 tooltips re-rendered (profiler: 69% of session time in render).
 *
 * THE FIX: the volatile save status lives in this zero-React singleton instead.
 * `useAutoSaveSceneManager` pushes snapshots here; `AutoSaveStatus` subscribes via
 * `useAutoSaveStatus()`. The status widget now re-renders on a save cycle WITHOUT
 * dragging the levels context (and therefore the ribbon) with it. Same doctrine as
 * `CompletionStyleStore` / `ModalPresenceStore` (ADR-040 micro-leaf subscriber).
 *
 * `get()` returns a stable reference between changes — a `useSyncExternalStore`
 * requirement (a fresh object every call would infinite-loop).
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from './createExternalStore';

export type AutoSaveLifecycle = 'idle' | 'saving' | 'success' | 'error';

export interface AutoSaveStatusSnapshot {
  readonly currentFileName: string | null;
  readonly lastSaveTime: Date | null;
  readonly saveStatus: AutoSaveLifecycle;
}

const INITIAL: AutoSaveStatusSnapshot = {
  currentFileName: null,
  lastSaveTime: null,
  saveStatus: 'idle',
};

function sameSnapshot(a: AutoSaveStatusSnapshot, b: AutoSaveStatusSnapshot): boolean {
  return (
    a.currentFileName === b.currentFileName &&
    a.lastSaveTime === b.lastSaveTime &&
    a.saveStatus === b.saveStatus
  );
}

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). Field-compare guard kept
// in the wrapper's `set()` (a fresh snapshot object arrives on every write, so no
// shared identity to compare) — byte-identical to the hand-rolled `sameSnapshot` bail-out.
const store = createExternalStore<AutoSaveStatusSnapshot>(INITIAL);

export const autoSaveStatusStore = {
  /** Current snapshot — stable reference between changes (useSyncExternalStore-safe). */
  get(): AutoSaveStatusSnapshot {
    return store.get();
  },

  /**
   * Replace the snapshot. No new reference and no notify when every field is
   * unchanged, so a writer effect that re-runs with identical values never
   * triggers a spurious subscriber re-render.
   */
  set(next: AutoSaveStatusSnapshot): void {
    if (sameSnapshot(store.get(), next)) return;
    store.set(next);
  },

  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
  },
};

/** Reactive scene auto-save status. Re-renders a subscriber only on a real change. */
export function useAutoSaveStatus(): AutoSaveStatusSnapshot {
  return useSyncExternalStore(
    autoSaveStatusStore.subscribe,
    autoSaveStatusStore.get,
    autoSaveStatusStore.get,
  );
}

// ─── Test-only hook (singleton state leaks across cases otherwise) ────────────
export function __resetAutoSaveStatusForTest(): void {
  store.reset(INITIAL);
}
