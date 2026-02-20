'use client';

const DEBUG_SNAP_MANAGER = false; // 🔍 DISABLED - set to true only for debugging

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { ProSnapEngineV2 as SnapManager } from '../ProSnapEngineV2';
import { useSnapContext } from '../context/SnapContext';
import { ExtendedSnapType } from '../extended-types';
import type { SceneModel } from '../../types/scene';
import type { Entity } from '../extended-types';
import type { Point2D } from '../../rendering/types/Types';
import { dlog, dwarn } from '../../debug';

/**
 * 🏢 ENTERPRISE: Canvas wrapper interface for components that wrap HTMLCanvasElement
 * Some canvas components expose getCanvas() method to access the underlying element
 */
interface CanvasWrapper {
  getCanvas?: () => HTMLCanvasElement;
}

/**
 * 🏢 ENTERPRISE: Type guard for canvas wrapper detection
 */
function isCanvasWrapper(element: unknown): element is CanvasWrapper {
  return (
    element !== null &&
    typeof element === 'object' &&
    'getCanvas' in element &&
    typeof (element as CanvasWrapper).getCanvas === 'function'
  );
}

interface UseSnapManagerOptions {
  scene?: SceneModel | null;
  overlayEntities?: Entity[]; // 🔺 Include overlay entities for unified snapping
  onSnapPoint?: (point: Point2D | null) => void;
  gridStep?: number; // 🔲 GRID SNAP: Grid step in world units for grid snapping
  /** 🏢 Current zoom scale — REQUIRED for correct pixel→world tolerance conversion.
   *  Without this, snap tolerances default to world units (5px = 5 world units = massive!) */
  scale?: number;
}

export const useSnapManager = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseSnapManagerOptions = {}
) => {
  const { snapEnabled, enabledModes } = useSnapContext();
  const snapManagerRef = useRef<SnapManager | null>(null);
  const { scene, overlayEntities, onSnapPoint, gridStep, scale } = options;

  // 🏢 ENTERPRISE (2026-02-20): Ref-based viewport synchronization.
  // The current zoom scale is stored in a ref so that findSnapPoint() always
  // reads the latest value WITHOUT causing re-renders or callback instability.
  const scaleRef = useRef(scale ?? 1);
  // 🚀 PERF (2026-02-20): Track last synced scale to avoid redundant setViewport calls.
  // setViewport creates objects + propagates through the full chain — only do it on CHANGE.
  const lastSyncedScaleRef = useRef(0);

  // Update scaleRef whenever the external scale changes
  useEffect(() => {
    if (scale !== undefined && scale > 0) {
      scaleRef.current = scale;

      // 🏢 Synchronize snap engine viewport on zoom change
      if (snapManagerRef.current && scale !== lastSyncedScaleRef.current) {
        lastSyncedScaleRef.current = scale;
        const s = scale;
        snapManagerRef.current.setViewport({
          scale: s,
          worldPerPixelAt: () => 1 / s,
          worldToScreen: (p: Point2D) => ({
            x: p.x * s,
            y: p.y * s,
          }),
        });
      }
    }
  }, [scale]);

  // Initialize SnapManager
  useEffect(() => {
    if (DEBUG_SNAP_MANAGER) dlog('Snap', '[useSnapManager] Initialize effect, canvasRef.current:', !!canvasRef.current);
    if (!canvasRef.current) return;

    snapManagerRef.current = new SnapManager();
    if (DEBUG_SNAP_MANAGER) dlog('Snap', '[useSnapManager] SnapManager created:', snapManagerRef.current);

    return () => {
      if (snapManagerRef.current) {
        snapManagerRef.current.dispose();
        snapManagerRef.current = null;
        if (DEBUG_SNAP_MANAGER) dlog('Snap', '[useSnapManager] SnapManager disposed');
      }
    };
  }, [canvasRef]);

  // Create stable enabledTypes Set για τον engine
  const enabledTypes = useMemo(() => {
    return new Set<ExtendedSnapType>(enabledModes);
  }, [enabledModes]);

  // Update snap modes when snap settings change
  useEffect(() => {
    if (!snapManagerRef.current) return;

    // 🏢 FIX (2026-02-21): Always sync enabled/settings, even with 0 entities.
    // Guide, Grid, ConstructionPoint engines don't depend on scene entities.
    snapManagerRef.current.setEnabled(snapEnabled);
    snapManagerRef.current.updateSettings({ enabledTypes });
  }, [snapEnabled, enabledTypes]);

  // 🔲 GRID SNAP: Update gridStep when it changes
  useEffect(() => {
    if (snapManagerRef.current && gridStep !== undefined && gridStep > 0) {
      snapManagerRef.current.updateSettings({ gridStep });
    }
  }, [gridStep]);

  // Update scene when it changes (including overlay entities)
  useEffect(() => {
    if (DEBUG_SNAP_MANAGER) {
      dlog('Snap', '[useSnapManager] Scene effect triggered:', {
        hasSnapManager: !!snapManagerRef.current,
        hasScene: !!scene,
        sceneEntities: scene?.entities?.length ?? 0,
        overlayEntities: overlayEntities?.length ?? 0
      });
    }

    if (snapManagerRef.current) {
      const dxfEntities = scene?.entities || [];
      const overlayEnts = overlayEntities || [];

      // 🔺 UNIFIED: Combine DXF and overlay entities for unified snapping
      const allEntities = [...dxfEntities, ...overlayEnts];

      if (DEBUG_SNAP_MANAGER) {
        dlog('Snap', '[useSnapManager] Combined entities:', allEntities.length);
      }

      // 🏢 FIX (2026-02-21): Always set viewport even with 0 entities.
      // Guide/Grid/ConstructionPoint engines need viewport for pixel→world conversion.

      // 🏢 FIX (2026-02-20): Set viewport from scaleRef (always current zoom).
      // 🚀 PERF (2026-02-20): Only sync if scale changed since last sync.
      const currentScale = scaleRef.current;
      if (currentScale !== lastSyncedScaleRef.current) {
        lastSyncedScaleRef.current = currentScale;
        snapManagerRef.current.setViewport({
          scale: currentScale,
          worldPerPixelAt: () => 1 / currentScale,
          worldToScreen: (p: Point2D) => ({
            x: p.x * currentScale,
            y: p.y * currentScale,
          }),
        });
      }

      if (DEBUG_SNAP_MANAGER) {
        dlog('Snap', '[useSnapManager] Calling initialize with', allEntities.length, 'entities');
      }

      snapManagerRef.current.initialize(allEntities);

      if (DEBUG_SNAP_MANAGER) {
        dlog('Snap', '[useSnapManager] initialize() completed');
      }

      if (allEntities.length > 0 && DEBUG_SNAP_MANAGER) {
        // Debug: Log entity types to understand what we're working with
        const entityTypes = allEntities.reduce((types, entity) => {
          types[entity.type] = (types[entity.type] || 0) + 1;
          return types;
        }, {} as Record<string, number>);

        dlog('Snap', '[useSnapManager] Entity types:', entityTypes);
      }
    }
  }, [scene, overlayEntities]);

  // 🏢 ENTERPRISE: Stable findSnapPoint callback.
  // Reads zoom scale from scaleRef (always current) — no extra parameters needed.
  // The callback reference stays stable across renders (no deps on scale).
  const findSnapPoint = useCallback((worldX: number, worldY: number) => {
    if (DEBUG_SNAP_MANAGER) {
      dlog('Snap', '[useSnapManager.findSnapPoint] Called with:', { worldX, worldY });
    }

    if (!snapManagerRef.current) return null;

    // 🚀 PERF (2026-02-20): Only sync viewport when scale actually changed.
    // During normal mouse movement scale is constant — skip the full setViewport chain.
    // On zoom change, the useEffect already syncs; this catches the brief render-to-effect gap.
    const currentScale = scaleRef.current;
    if (currentScale > 0 && currentScale !== lastSyncedScaleRef.current) {
      lastSyncedScaleRef.current = currentScale;
      snapManagerRef.current.setViewport({
        scale: currentScale,
        worldPerPixelAt: () => 1 / currentScale,
        worldToScreen: (p: Point2D) => ({
          x: p.x * currentScale,
          y: p.y * currentScale,
        }),
      });
    }

    const result = snapManagerRef.current.findSnapPoint({ x: worldX, y: worldY });
    if (DEBUG_SNAP_MANAGER) {
      dlog('Snap', '[useSnapManager.findSnapPoint] Result:', result);
    }
    return result;
  }, []);

  return {
    snapManager: snapManagerRef.current,
    findSnapPoint,
  };
};
