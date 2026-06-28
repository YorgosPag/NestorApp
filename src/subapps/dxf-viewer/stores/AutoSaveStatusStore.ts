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

let current: AutoSaveStatusSnapshot = INITIAL;

type Listener = () => void;
const listeners = new Set<Listener>();

function sameSnapshot(a: AutoSaveStatusSnapshot, b: AutoSaveStatusSnapshot): boolean {
  return (
    a.currentFileName === b.currentFileName &&
    a.lastSaveTime === b.lastSaveTime &&
    a.saveStatus === b.saveStatus
  );
}

export const autoSaveStatusStore = {
  /** Current snapshot — stable reference between changes (useSyncExternalStore-safe). */
  get(): AutoSaveStatusSnapshot {
    return current;
  },

  /**
   * Replace the snapshot. No new reference and no notify when every field is
   * unchanged, so a writer effect that re-runs with identical values never
   * triggers a spurious subscriber re-render.
   */
  set(next: AutoSaveStatusSnapshot): void {
    if (sameSnapshot(current, next)) return;
    current = next;
    listeners.forEach((cb) => cb());
  },

  subscribe(cb: Listener): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
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
  current = INITIAL;
  listeners.clear();
}
