'use client';

/**
 * ADR-375 Phase B.2 — Level ↔ BimRenderSettings store sync.
 *
 * Watches (currentLevelId, levels) from the LevelsSystem context and calls
 * `useBimRenderSettingsStore.loadForLevel()` whenever the active level changes
 * (e.g. user switches floor). Same-level snapshot echoes are intentionally
 * NOT propagated to the store — see the rationale below.
 *
 * ADR-375 v2.11 — Local-write quiet-window guard. When a user mutates V/G via
 * the ribbon panel, the store updates `objectStyles` immediately but the
 * Firestore write is debounced for 500 ms (typical user flow: rapid clicks).
 * Between the local set and the eventual Firestore confirmation, the `levels`
 * array reference can change for unrelated reasons (Firestore listener echo,
 * sibling field updates, super-admin tenant re-emit). A naïve sync would
 * call `loadForLevel(stale server data)` and wipe the local pending change.
 *
 * The guard: skip reloads while `Date.now() - store.lastLocalMutationAt`
 * is below `LOCAL_WRITE_QUIET_WINDOW_MS`. This timestamp is stamped by every
 * V/G setter in the store and reset to 0 whenever `loadForLevel` runs (level
 * switch or post-confirmation reload via this same hook on subsequent calls
 * after the quiet window expires).
 *
 * Trade-off: real-time updates from other concurrent sessions on the same
 * level land with up to LOCAL_WRITE_QUIET_WINDOW_MS delay during local
 * editing. For a CAD-style single-user workflow this is acceptable (Revit
 * does not support concurrent editing either).
 *
 * Mount once near the DXF viewer root (after LevelsContext is available).
 */

import { useEffect } from 'react';
import type { Level } from '../../systems/levels/config';
import { useBimRenderSettingsStore } from '../bim-render-settings-store';

/** Min idle ms after last local setter before snapshot syncs resume. */
const LOCAL_WRITE_QUIET_WINDOW_MS = 2000;

interface UseBimRenderSettingsSyncParams {
  currentLevelId: string | null;
  levels: Level[];
}

export function useBimRenderSettingsSync({
  currentLevelId,
  levels,
}: UseBimRenderSettingsSyncParams): void {
  useEffect(() => {
    if (!currentLevelId) return;
    const level = levels.find((l) => l.id === currentLevelId);
    const incoming = level?.bimRenderSettings ?? null;
    const store = useBimRenderSettingsStore.getState();

    // [ADR-375 v2.13 DIAG — remove after root-cause]
    const _sinceLocalMs = store.lastLocalMutationAt
      ? Date.now() - store.lastLocalMutationAt
      : null;
    const _quietWindowActive =
      _sinceLocalMs !== null && _sinceLocalMs < LOCAL_WRITE_QUIET_WINDOW_MS;
    const _isLevelSwitch = store.currentLevelId !== currentLevelId;
    // eslint-disable-next-line no-console
    console.warn('[ADR-375 DIAG] sync useEffect FIRED', {
      t: Date.now(),
      currentLevelId,
      storeLevelId: store.currentLevelId,
      isLevelSwitch: _isLevelSwitch,
      sinceLocalMs: _sinceLocalMs,
      quietWindowActive: _quietWindowActive,
      willReload: _isLevelSwitch || !_quietWindowActive,
      incomingWallProjColor: incoming?.objectStyles?.wall?.projectionColor,
      storeWallProjColor: store.objectStyles?.wall?.projectionColor,
      levelsCount: levels.length,
    });

    // Level switch always reloads — user explicitly navigated to a new floor.
    if (store.currentLevelId !== currentLevelId) {
      store.loadForLevel(currentLevelId, incoming);
      return;
    }

    // Same level: respect the local-write quiet window. Any setter (V/G,
    // drawingScale, viewRange, etc.) bumps `lastLocalMutationAt`; we ignore
    // server pushes within the window to protect pending debounce writes.
    if (Date.now() - store.lastLocalMutationAt < LOCAL_WRITE_QUIET_WINDOW_MS) {
      return;
    }

    store.loadForLevel(currentLevelId, incoming);
  }, [currentLevelId, levels]);
}
