/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * As of 2026-05-11 this hook NO LONGER instantiates a SnapEngine. The engine
 * is a module-level singleton (`getGlobalSnapEngine`) and scene-initialize
 * lives in `useGlobalSnapSceneSync` (invoked once from CanvasSection).
 * Hooks here only own per-canvas viewport sync and the stable findSnapPoint
 * callback. See ADR-040 §"Snap Engine SSoT" for the full rationale.
 */
'use client';

const DEBUG_SNAP_MANAGER = false; // 🔍 DISABLED - set to true only for debugging

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useSnapContext } from '../context/SnapContext';
import { getGlobalSnapEngine } from '../global-snap-engine';
import { ExtendedSnapType } from '../extended-types';
import type { SceneModel } from '../../types/scene';
import type { Entity } from '../extended-types';
import type { Point2D } from '../../rendering/types/Types';
import { dlog } from '../../debug';

interface UseSnapManagerOptions {
  /** @deprecated Scene-initialize is owned by useGlobalSnapSceneSync. Field kept for API compat. */
  scene?: SceneModel | null;
  /** @deprecated Scene-initialize is owned by useGlobalSnapSceneSync. Field kept for API compat. */
  overlayEntities?: Entity[];
  /** @deprecated Not invoked by this hook — engine emits via SnapContext. Field kept for API compat. */
  onSnapPoint?: (point: Point2D | null) => void;
  gridStep?: number;
  /** Current zoom scale — REQUIRED for correct pixel→world tolerance conversion. */
  scale?: number;
}

/**
 * Singleton-aware hook. NO instantiation, NO scene-initialize, NO dispose.
 * Per-canvas concerns only: viewport sync (scale → engine) and settings sync.
 * Scene initialize is owned by `useGlobalSnapSceneSync` (called from CanvasSection).
 */
export const useSnapManager = (
  _canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseSnapManagerOptions = {}
) => {
  const { snapEnabled, enabledModes } = useSnapContext();
  const { gridStep, scale } = options;
  const snapManager = getGlobalSnapEngine();

  // Per-hook scale tracking. Different canvas surfaces can theoretically run at
  // different zooms, so we keep this per-hook even with the shared engine — the
  // last writer's scale wins for findSnapPoint, which matches prior behaviour.
  const scaleRef = useRef(scale ?? 1);
  const lastSyncedScaleRef = useRef(0);

  useEffect(() => {
    if (scale !== undefined && scale > 0) {
      scaleRef.current = scale;
      if (scale !== lastSyncedScaleRef.current) {
        lastSyncedScaleRef.current = scale;
        const s = scale;
        snapManager.setViewport({
          scale: s,
          worldPerPixelAt: () => 1 / s,
          worldToScreen: (p: Point2D) => ({ x: p.x * s, y: p.y * s }),
        });
      }
    }
  }, [scale, snapManager]);

  const enabledTypes = useMemo(() => new Set<ExtendedSnapType>(enabledModes), [enabledModes]);

  useEffect(() => {
    snapManager.setEnabled(snapEnabled);
    snapManager.updateSettings({ enabledTypes });
  }, [snapEnabled, enabledTypes, snapManager]);

  useEffect(() => {
    if (gridStep !== undefined && gridStep > 0) {
      snapManager.updateSettings({ gridStep });
    }
  }, [gridStep, snapManager]);

  const findSnapPoint = useCallback((worldX: number, worldY: number) => {
    if (DEBUG_SNAP_MANAGER) {
      dlog('Snap', '[useSnapManager.findSnapPoint] Called with:', { worldX, worldY });
    }
    const currentScale = scaleRef.current;
    if (currentScale > 0 && currentScale !== lastSyncedScaleRef.current) {
      lastSyncedScaleRef.current = currentScale;
      snapManager.setViewport({
        scale: currentScale,
        worldPerPixelAt: () => 1 / currentScale,
        worldToScreen: (p: Point2D) => ({ x: p.x * currentScale, y: p.y * currentScale }),
      });
    }
    return snapManager.findSnapPoint({ x: worldX, y: worldY });
  }, [snapManager]);

  return {
    snapManager,
    findSnapPoint,
  };
};
