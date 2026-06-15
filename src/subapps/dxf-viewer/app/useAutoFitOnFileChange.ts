'use client';

import * as React from 'react';
import type { SceneModel } from '../types/scene';
import { readPersistedViewport } from '../services/viewport-persistence';
import { EventBus } from '../systems/events';
// 🏢 ADR-418: degenerate-view guard threshold
import { MIN_VISIBLE_CONTENT_PX } from '../config/transform-config';

interface UseAutoFitOnFileChangeParams {
  currentScene: SceneModel | null;
  /**
   * Reactive FileRecord id from the auto-save scene manager. Changes to a new
   * non-null value mean the active level was re-bound to a different DXF file
   * (e.g. wizard re-import after the floor wipe). That's the signal to refit.
   */
  fileRecordId: string | null;
  /**
   * ADR-399 — the active level id. A `fileRecordId` change that coincides with a
   * level change is NAVIGATION (the user switched floors), NOT a re-import: it must
   * NOT refit, so the viewport stays stable across floors (Revit/AutoCAD). Only a
   * file change under the SAME level (a genuine re-import) fits to extents.
   */
  currentLevelId: string | null;
  handleAction: (action: string, data?: string | number | Record<string, unknown>) => void;
}

const FIT_DELAY_MS = 200;

/**
 * 🏢 ADR-418: a persisted transform is degenerate when the WHOLE drawing would
 * project to a diagonal under MIN_VISIBLE_CONTENT_PX — an invisible "dot" (the
 * legacy 1px·unit `100%` pathology that used to stick across reloads). Viewport-
 * independent: a content diagonal under the threshold is unusable wherever it sits.
 */
function isDegenerateRestore(
  scene: SceneModel | null,
  scale: number,
): boolean {
  const bounds = scene?.bounds;
  if (!bounds || !Number.isFinite(scale) || scale <= 0) return false;
  const bw = bounds.max.x - bounds.min.x;
  const bh = bounds.max.y - bounds.min.y;
  const diagonalPx = Math.hypot(bw, bh) * scale;
  return Number.isFinite(diagonalPx) && diagonalPx > 0 && diagonalPx < MIN_VISIBLE_CONTENT_PX;
}

/**
 * ADR-400 — initial decision on first scene: restore the persisted viewport if
 * one exists (page refresh / shared link), otherwise fit to extents.
 *
 * 🏢 ADR-418: a restored viewport whose content collapses to a dot is rejected
 * in favour of a fit (recovers stale `?s=1` URLs from the old pixel-% zoom).
 */
function restoreOrFit(
  fileRecordId: string | null,
  scene: SceneModel | null,
  handleAction: UseAutoFitOnFileChangeParams['handleAction'],
): void {
  const persisted = readPersistedViewport(fileRecordId);
  if (persisted.transform && !isDegenerateRestore(scene, persisted.transform.scale)) {
    EventBus.emit('canvas-restore-viewport', { transform: persisted.transform });
  } else {
    handleAction('fit-to-view');
  }
}

/**
 * Auto fit-to-view on FileRecord transition — matches AutoCAD / BricsCAD
 * "Zoom Extents on file open". Behaviour:
 *   - **First scene of the session** → ADR-400 restore-or-fit. This decision is
 *     scheduled ONCE and is immune to cancellation: the `fileRecordId` arrives
 *     a tick after the scene during cold load, which used to re-run the effect,
 *     run its cleanup, and cancel the pending restore — so a fit always won and
 *     the restored viewport was lost on every refresh. The timer now lives in a
 *     ref and is only cleared on unmount, so the fileRecordId arriving mid-load
 *     never kills the restore.
 *   - **Genuine re-import after the initial decision** (wizard re-upload → a new
 *     non-null `fileRecordId`) → always fit to extents (the old persisted
 *     transform belongs to a different file).
 */
export function useAutoFitOnFileChange({
  currentScene,
  fileRecordId,
  currentLevelId,
  handleAction,
}: UseAutoFitOnFileChangeParams): void {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScheduledRef = React.useRef(false);
  const initialDoneRef = React.useRef(false);
  const prevFileRecordIdRef = React.useRef<string | null>(null);
  const prevLevelIdRef = React.useRef<string | null>(null);
  // Latest fileRecordId read at timer-fire time (not capture time) so the cold-
  // load id that arrives after the scene is the one used for the restore lookup.
  const fileRecordIdRef = React.useRef(fileRecordId);
  fileRecordIdRef.current = fileRecordId;
  const currentLevelIdRef = React.useRef(currentLevelId);
  currentLevelIdRef.current = currentLevelId;
  // ADR-418: latest scene read at timer-fire time for the degenerate-restore check.
  const currentSceneRef = React.useRef(currentScene);
  currentSceneRef.current = currentScene;

  React.useEffect(() => {
    if (currentScene === null) return;

    // One-time initial restore/fit — scheduled once, never cancelled by a later
    // fileRecordId change (see doc above). prevFileRecordIdRef is recorded when
    // the timer fires so the initial binding is not later mistaken for a reimport.
    if (!initialScheduledRef.current) {
      initialScheduledRef.current = true;
      timerRef.current = setTimeout(() => {
        restoreOrFit(fileRecordIdRef.current, currentSceneRef.current, handleAction);
        prevFileRecordIdRef.current = fileRecordIdRef.current;
        prevLevelIdRef.current = currentLevelIdRef.current;
        initialDoneRef.current = true;
      }, FIT_DELAY_MS);
      return;
    }

    // After the initial decision: a file binding change. ADR-399 — distinguish a
    // genuine RE-IMPORT (new file under the SAME level → fit to extents) from
    // NAVIGATION (the level changed → keep the viewport stable across floors, no
    // fit). The latter is why the floor with a κάτοψη used to jump while empty
    // floors stayed put.
    if (initialDoneRef.current) {
      const fid = fileRecordIdRef.current;
      const lvl = currentLevelIdRef.current;
      const fileChanged = !!fid && fid !== prevFileRecordIdRef.current;
      const levelChanged = lvl !== prevLevelIdRef.current;
      if (fileChanged) {
        prevFileRecordIdRef.current = fid;
        if (!levelChanged) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => handleAction('fit-to-view'), FIT_DELAY_MS);
        }
      }
      prevLevelIdRef.current = lvl;
    }
  }, [currentScene, fileRecordId, currentLevelId, handleAction]);

  // Clear any pending timer only on unmount — never on a mid-load re-run.
  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
}
