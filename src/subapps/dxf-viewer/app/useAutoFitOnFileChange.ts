'use client';

import * as React from 'react';
import type { SceneModel } from '../types/scene';
import { readPersistedViewport } from '../services/viewport-persistence';
import { EventBus } from '../systems/events';

interface UseAutoFitOnFileChangeParams {
  currentScene: SceneModel | null;
  /**
   * Reactive FileRecord id from the auto-save scene manager. Changes to a new
   * non-null value mean the active level was re-bound to a different DXF file
   * (e.g. wizard re-import after the floor wipe). That's the signal to refit.
   */
  fileRecordId: string | null;
  handleAction: (action: string, data?: string | number | Record<string, unknown>) => void;
}

const FIT_DELAY_MS = 200;

/**
 * ADR-400 — initial decision on first scene: restore the persisted viewport if
 * one exists (page refresh / shared link), otherwise fit to extents.
 */
function restoreOrFit(
  fileRecordId: string | null,
  handleAction: UseAutoFitOnFileChangeParams['handleAction'],
): void {
  const persisted = readPersistedViewport(fileRecordId);
  if (persisted.transform) {
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
  handleAction,
}: UseAutoFitOnFileChangeParams): void {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScheduledRef = React.useRef(false);
  const initialDoneRef = React.useRef(false);
  const prevFileRecordIdRef = React.useRef<string | null>(null);
  // Latest fileRecordId read at timer-fire time (not capture time) so the cold-
  // load id that arrives after the scene is the one used for the restore lookup.
  const fileRecordIdRef = React.useRef(fileRecordId);
  fileRecordIdRef.current = fileRecordId;

  React.useEffect(() => {
    if (currentScene === null) return;

    // One-time initial restore/fit — scheduled once, never cancelled by a later
    // fileRecordId change (see doc above). prevFileRecordIdRef is recorded when
    // the timer fires so the initial binding is not later mistaken for a reimport.
    if (!initialScheduledRef.current) {
      initialScheduledRef.current = true;
      timerRef.current = setTimeout(() => {
        restoreOrFit(fileRecordIdRef.current, handleAction);
        prevFileRecordIdRef.current = fileRecordIdRef.current;
        initialDoneRef.current = true;
      }, FIT_DELAY_MS);
      return;
    }

    // After the initial decision: a genuinely new file binding → fit to extents.
    if (initialDoneRef.current) {
      const fid = fileRecordIdRef.current;
      if (fid && fid !== prevFileRecordIdRef.current) {
        prevFileRecordIdRef.current = fid;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => handleAction('fit-to-view'), FIT_DELAY_MS);
      }
    }
  }, [currentScene, fileRecordId, handleAction]);

  // Clear any pending timer only on unmount — never on a mid-load re-run.
  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
}
