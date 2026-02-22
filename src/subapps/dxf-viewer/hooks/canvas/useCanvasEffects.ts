/**
 * 🏢 ENTERPRISE: useCanvasEffects Hook — Extraction #11
 *
 * @description Canvas side effects and drawing system initialization.
 * - Global ruler settings state + subscription
 * - Preview canvas cleanup on tool change
 * - Grip validation on tool/selection change
 * - Drawing handlers initialization (useDrawingHandlers)
 * - Drawing handlers ref sync
 * - Auto-start drawing on tool change
 * - hasUnifiedDrawingPoints bridge ref
 * - DXF auto-fit on scene load
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~118 lines
 */

'use client';

import React, { useRef, useEffect, useState, type RefObject, type MutableRefObject } from 'react';
import { globalRulerStore } from '../../settings-provider';
import { isDrawingTool, isMeasurementTool, isInDrawingMode } from '../../systems/tools/ToolStateManager';
import { useDrawingHandlers } from '../../hooks/drawing/useDrawingHandlers';
import { serviceRegistry } from '../../services';
import type { RulerSettings } from '../../systems/rulers-grid/config';
import type { OverlayEditorMode } from '../../overlays/types';
import type { SceneModel } from '../../types/scene';
import type { Entity } from '../../types/entities';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../rendering/types/Types';
import type { DrawingTool } from '../../hooks/drawing/useUnifiedDrawing';
import type { ToolType } from '../../ui/toolbar/types';
import type { SelectedGrip } from './useCanvasMouse';

// ============================================================================
// TYPES
// ============================================================================

/** Minimal interface for universal selection — only what this hook needs */
interface SelectionChecker {
  isSelected: (id: string) => boolean;
}

/** Minimal interface for DxfCanvasRef — only what auto-fit needs */
interface DxfCanvasRefLike {
  getCanvas?: () => HTMLCanvasElement | null;
}

/** Minimal interface for zoom system — only what auto-fit needs */
interface ZoomSystemForAutoFit {
  zoomToFit: (
    bounds: { min: Point2D; max: Point2D },
    viewport: { width: number; height: number },
    alignToOrigin?: boolean,
  ) => { transform: { scale: number; offsetX: number; offsetY: number } } | null;
}

export interface UseCanvasEffectsParams {
  /** Current active tool */
  activeTool: string;
  /** Current overlay editor mode */
  overlayMode: OverlayEditorMode;
  /** Current scene data for entity creation */
  currentScene: SceneModel | null;
  /** Callback when scene changes (entity created) */
  handleSceneChange?: (scene: SceneModel) => void;
  /** Callback when tool changes */
  onToolChange?: (tool: ToolType) => void;
  /** Ref to preview canvas for cleanup */
  previewCanvasRef: RefObject<PreviewCanvasHandle | null>;
  /** Currently selected grips for validation */
  selectedGrips: SelectedGrip[];
  /** Setter for selected grips */
  setSelectedGrips: (grips: SelectedGrip[]) => void;
  /** Setter for drag preview position */
  setDragPreviewPosition: (pos: Point2D | null) => void;
  /** Universal selection system (for grip validation) */
  universalSelection: SelectionChecker;
  /** DXF scene for auto-fit */
  dxfScene: DxfScene | null;
  /** DXF canvas ref for auto-fit viewport measurement */
  dxfCanvasRef: RefObject<DxfCanvasRefLike | null> | undefined;
  /** Overlay canvas ref for auto-fit viewport fallback */
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  /** Zoom system for auto-fit */
  zoomSystem: ZoomSystemForAutoFit;
  /** Current level ID — used to reset auto-fit when switching levels */
  currentLevelId: string | null;
  /** B36 (ADR-189): Called when measurement completes — for "Create Guides" prompt */
  onMeasurementComplete?: (points: ReadonlyArray<{ x: number; y: number }>, tool: ToolType) => void;
}

/** Return type of useDrawingHandlers */
type DrawingHandlersReturn = ReturnType<typeof useDrawingHandlers>;

export interface UseCanvasEffectsReturn {
  /** Global ruler settings (reactive state) */
  globalRulerSettings: RulerSettings;
  /** Drawing handlers from useDrawingHandlers */
  drawingHandlers: DrawingHandlersReturn;
  /** Stable ref to drawing handlers (avoids stale closures) */
  drawingHandlersRef: MutableRefObject<DrawingHandlersReturn | null>;
  /** Bridge ref: returns true if unified drawing has temp points */
  hasUnifiedDrawingPointsRef: MutableRefObject<() => boolean>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCanvasEffects({
  activeTool,
  overlayMode,
  currentScene,
  handleSceneChange,
  onToolChange,
  previewCanvasRef,
  selectedGrips,
  setSelectedGrips,
  setDragPreviewPosition,
  universalSelection,
  dxfScene,
  dxfCanvasRef,
  overlayCanvasRef,
  zoomSystem,
  currentLevelId,
  onMeasurementComplete,
}: UseCanvasEffectsParams): UseCanvasEffectsReturn {

  // === Global Ruler Settings (reactive state via external store) ===
  const [globalRulerSettings, setGlobalRulerSettings] = useState(globalRulerStore.settings);

  useEffect(() => {
    const unsubscribe = globalRulerStore.subscribe((newSettings) => {
      setGlobalRulerSettings(newSettings);
    });
    return unsubscribe;
  }, []);

  // === Preview canvas cleanup on tool switch ===
  // FIX: Green grip ball stayed visible after switching to Select tool
  useEffect(() => {
    if (!isInDrawingMode(activeTool, overlayMode)) {
      previewCanvasRef.current?.clear();
    }
  }, [activeTool, overlayMode]);

  // === Grip validation on tool/selection change ===
  // ADR-031: Clear grips that are no longer valid
  useEffect(() => {
    if (selectedGrips.length > 0) {
      const validGrips = selectedGrips.filter(grip =>
        universalSelection.isSelected(grip.overlayId)
      );

      if (activeTool !== 'select' && activeTool !== 'layering') {
        setSelectedGrips([]);
        setDragPreviewPosition(null);
      } else if (validGrips.length !== selectedGrips.length) {
        setSelectedGrips(validGrips);
        if (validGrips.length === 0) {
          setDragPreviewPosition(null);
        }
      }
    }
  }, [universalSelection, activeTool, selectedGrips]);

  // === Drawing handlers initialization ===
  const drawingHandlers = useDrawingHandlers(
    activeTool as Parameters<typeof useDrawingHandlers>[0],
    (entity: Entity) => {
      if (handleSceneChange && currentScene) {
        const updatedScene = {
          ...currentScene,
          entities: [...(currentScene.entities || []), entity]
        };
        handleSceneChange(updatedScene);
      }
    },
    (tool) => {
      if (onToolChange) {
        onToolChange(tool);
      }
    },
    currentScene ?? undefined,
    previewCanvasRef as React.RefObject<PreviewCanvasHandle>,
    onMeasurementComplete,
  );

  // === Drawing handlers ref sync (avoids infinite loops) ===
  const drawingHandlersRef = useRef<DrawingHandlersReturn | null>(drawingHandlers);
  useEffect(() => {
    drawingHandlersRef.current = drawingHandlers;
  }, [drawingHandlers]);

  // === Auto-start drawing when tool changes ===
  // Entity-picking angle tools are handled by useAngleEntityMeasurement (not the drawing pipeline)
  const ENTITY_PICKING_TOOLS: ReadonlySet<string> = new Set([
    'measure-angle-constraint', 'measure-angle-line-arc', 'measure-angle-two-arcs',
  ]);
  useEffect(() => {
    // Skip auto-start for entity-picking tools — they use their own state machine
    if (ENTITY_PICKING_TOOLS.has(activeTool)) return;

    const isDrawing = isDrawingTool(activeTool);
    const isMeasurement = isMeasurementTool(activeTool);

    if ((isDrawing || isMeasurement) && drawingHandlersRef.current?.startDrawing) {
      drawingHandlersRef.current.startDrawing(activeTool as DrawingTool);
    }
  }, [activeTool]);

  // === Bridge ref for context menu (does drawing have temp points?) ===
  const hasUnifiedDrawingPointsRef = useRef(() =>
    (drawingHandlersRef.current?.drawingState?.tempPoints?.length ?? 0) > 0
  );
  hasUnifiedDrawingPointsRef.current = () =>
    (drawingHandlersRef.current?.drawingState?.tempPoints?.length ?? 0) > 0;

  // === DXF auto-fit on scene/level load (NOT on entity creation) ===
  // Track which level has already been auto-fitted to prevent re-fitting
  // when the user draws new entities (which also mutates currentScene).
  const lastFittedLevelRef = useRef<string | null>(null);

  useEffect(() => {
    // Only auto-fit when switching to a new level (or initial load)
    if (currentLevelId && currentLevelId !== lastFittedLevelRef.current &&
        dxfScene && dxfScene.entities.length > 0 && dxfScene.bounds) {
      lastFittedLevelRef.current = currentLevelId;

      const canvas = dxfCanvasRef?.current?.getCanvas?.() ?? overlayCanvasRef.current;
      if (canvas && canvas instanceof HTMLCanvasElement) {
        const canvasBounds = serviceRegistry.get('canvas-bounds');
        const rect = canvasBounds.getBounds(canvas);
        const viewport = { width: rect.width, height: rect.height };
        zoomSystem.zoomToFit(dxfScene.bounds, viewport, false);
      } else {
        const container = document.querySelector('.relative.w-full.h-full.overflow-hidden');
        if (container) {
          const rect = container.getBoundingClientRect();
          zoomSystem.zoomToFit(dxfScene.bounds, { width: rect.width, height: rect.height }, false);
        }
      }
    }

    // Reset when level is cleared (no scene)
    if (!currentLevelId) {
      lastFittedLevelRef.current = null;
    }
  }, [currentScene, currentLevelId]);

  return {
    globalRulerSettings,
    drawingHandlers,
    drawingHandlersRef,
    hasUnifiedDrawingPointsRef,
  };
}
