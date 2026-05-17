'use client';

import * as React from 'react';
import type { SceneModel } from '../types/scene';

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

/**
 * Auto fit-to-view on FileRecord transition — matches AutoCAD / BricsCAD
 * "Zoom Extents on file open". Triggers on:
 *   - first scene load (null → SceneModel) at session start, and
 *   - wizard re-import on the same level (`fileRecordId` flips to a new
 *     non-null value, e.g. after a floor wipe + re-upload).
 *
 * Keying on `fileRecordId` instead of `currentScene` ref equality avoids the
 * regression where a single-shot guard never reset on subsequent imports,
 * leaving the viewport pointed at the OLD entity bounds after a re-upload.
 * 200ms delay lets the canvas mount and register its EventBus listener
 * before firing.
 */
export function useAutoFitOnFileChange({
  currentScene,
  fileRecordId,
  handleAction,
}: UseAutoFitOnFileChangeParams): void {
  const prevFileRecordIdRef = React.useRef<string | null>(null);
  const sawAnySceneRef = React.useRef(false);

  React.useEffect(() => {
    const fileIdChanged =
      !!fileRecordId && fileRecordId !== prevFileRecordIdRef.current;
    const firstScene = currentScene !== null && !sawAnySceneRef.current;
    if (firstScene) sawAnySceneRef.current = true;
    if (fileIdChanged) prevFileRecordIdRef.current = fileRecordId;
    if (currentScene !== null && (firstScene || fileIdChanged)) {
      const timer = setTimeout(() => handleAction('fit-to-view'), 200);
      return () => clearTimeout(timer);
    }
  }, [currentScene, fileRecordId, handleAction]);
}
