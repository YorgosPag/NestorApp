'use client';
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { CanvasLayerStack } from './CanvasLayerStack';
import { useCanvasContext } from '../../contexts/CanvasContext';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLevels } from '../../systems/levels';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
import { useCursorSettings, useCursorActions } from '../../systems/cursor';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import { MOVEMENT_DETECTION } from '../../config/tolerance-config';
import { useGripStyles } from '../../settings-provider';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import { useZoom } from '../../systems/zoom';
import { dwarn, derr } from '../../debug';
// 🚀 PERF (2026-02-20): CanvasSection no longer subscribes to SnapContext.
// Snap result is read imperatively from ImmediateSnapStore to avoid re-renders.
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { usePdfBackgroundStore } from '../../pdf-background';
import { useEventBus } from '../../systems/events';
import { useUniversalSelection } from '../../systems/selection';
import { useCommandHistory, useCommandHistoryKeyboard } from '../../core/commands';
import {
  useCanvasSettings, useCanvasMouse, useViewportManager, useDxfSceneConversion,
  useCanvasContextMenu, useSmartDelete, useDrawingUIHandlers, useCanvasClickHandler,
  useFitToView, usePolygonCompletion, useCanvasKeyboardShortcuts,
  useCanvasEffects, useOverlayInteraction,
  type ArcPickableEntity, type LinePickableEntity,
  type DraggingGuideState,
} from '../../hooks/canvas';
import { useOverlayLayers } from '../../hooks/layers';
import { useSpecialTools } from '../../hooks/tools';
import { useRotationTool } from '../../hooks/tools/useRotationTool';
import { useRotationPreview } from '../../hooks/tools/useRotationPreview';
import { useUnifiedGripInteraction } from '../../hooks/grips/useUnifiedGripInteraction';
import { useEntityJoin } from '../../hooks/useEntityJoin';
// ADR-189: Construction Guide System
import { useGuideState } from '../../hooks/state/useGuideState';
// ADR-189 §3.7-3.16: Construction Snap Points
import { useConstructionPointState } from '../../hooks/state/useConstructionPointState';
import { pointToSegmentDistance } from '../../systems/guides/guide-types';
import type { GridAxis } from '../../systems/guides/guide-types';
import { MoveGuideCommand } from '../../systems/guides/guide-commands';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import type { Point2D } from '../../rendering/types/Types';
// ADR-189: Centralized prompt dialog for distance input (parallel guides, future tools)
import { PromptDialog, usePromptDialog } from '../../systems/prompt-dialog';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 PERF (2026-02-19): Imperative context menus — no parent re-render on open
import DrawingContextMenu, { type DrawingContextMenuHandle } from '../../ui/components/DrawingContextMenu';
import EntityContextMenu, { type EntityContextMenuHandle } from '../../ui/components/EntityContextMenu';
// ADR-189: Guide context menu
import GuideContextMenu, { type GuideContextMenuHandle } from '../../ui/components/GuideContextMenu';
import type { ToolType } from '../../ui/toolbar/types';
import { useTouchGestures } from '../../hooks/gestures/useTouchGestures';
import { useResponsiveLayout as useResponsiveLayoutForCanvas } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';

/**
 * Canvas orchestrator — wires 25+ hooks together and delegates rendering to CanvasLayerStack.
 * No business logic, no JSX beyond the single CanvasLayerStack call.
 *
 * ADR-183: Unified Grip System — useGripSystem + useDxfGripInteraction + useLayerCanvasMouseMove
 * replaced by single useUnifiedGripInteraction hook.
 */
export const CanvasSection: React.FC<DXFViewerLayoutProps & { overlayMode: OverlayEditorMode, currentStatus: Status, currentKind: OverlayKind }> = (props) => {
  const {
    activeTool,
    showGrid,
    showLayers,
    overlayMode = 'select',
    setOverlayMode,
    currentStatus = 'for-sale',
    currentKind = 'unit',
    ...restProps
  } = props;

  // === Canvas context (ADR-043: CanvasProvider must wrap this component) ===
  const canvasContext = useCanvasContext();

  if (process.env.NODE_ENV === 'development' && !canvasContext) {
    dwarn('CanvasSection', 'CanvasProvider not found — zoom buttons will not work.');
  }

  const dxfCanvasRef = canvasContext?.dxfRef;
  if (!dxfCanvasRef) {
    derr('CanvasSection', 'CanvasContext.dxfRef is null — zoom buttons will not work.');
  }

  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<PreviewCanvasHandle>(null);

  // === Transform state ===
  const defaultTransform = useMemo(() => ({ scale: 1, offsetX: 0, offsetY: 0 }), []);
  const transform = canvasContext?.transform || defaultTransform;
  const contextSetTransform = canvasContext?.setTransform || (() => {
    derr('CanvasSection', 'setTransform called but CanvasContext not available');
  });

  // === Viewport management ===
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    enabled: pdfEnabled,
    opacity: pdfOpacity,
    transform: pdfTransform,
    renderedImageUrl: pdfImageUrl,
    setViewport: setPdfViewport,
  } = usePdfBackgroundStore();

  const { viewport, viewportRef, viewportReady, setTransform, transformRef } = useViewportManager({
    containerRef, transform,
    setTransform: contextSetTransform,
    onViewportChange: setPdfViewport,
  });

  // Canvas element accessor for coordinate transforms
  const getCanvasElement = useCallback((): HTMLElement | null => {
    const dxfCanvas = dxfCanvasRef?.current?.getCanvas?.();
    if (dxfCanvas instanceof HTMLElement) return dxfCanvas;
    if (overlayCanvasRef.current instanceof HTMLElement) return overlayCanvasRef.current;
    if (containerRef.current instanceof HTMLElement) return containerRef.current;
    return null;
  }, []);

  const zoomSystem = useZoom({
    initialTransform: transform,
    onTransformChange: setTransform,
    viewport,
  });

  // === Canvas visibility ===
  const showDxfCanvas = props.dxfCanvasVisible ?? true;
  const showLayerCanvasDebug = props.layerCanvasVisible ?? true;

  if (!showDxfCanvas) {
    derr('CanvasSection', 'DxfCanvas is HIDDEN — zoom buttons will NOT work.');
  }

  // === Core stores + state ===
  const overlayStore = useOverlayStore();
  const universalSelection = useUniversalSelection();
  const { execute: executeCommand } = useCommandHistory();
  const { warning: notifyWarning, success: notifySuccess } = useNotifications();
  const { t } = useTranslation('dxf-viewer');
  useCommandHistoryKeyboard();

  // Stable refs to avoid stale closures in mouse event callbacks
  const overlayStoreRef = useRef(overlayStore);
  const universalSelectionRef = useRef(universalSelection);
  overlayStoreRef.current = overlayStore;
  universalSelectionRef.current = universalSelection;

  const levelManager = useLevels();
  const currentOverlays = levelManager.currentLevelId
    ? overlayStore.getByLevel(levelManager.currentLevelId)
    : [];

  // === Entity interaction state ===
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  // Prevents handleCanvasClick from deselecting what mouseDown just selected
  const entitySelectedOnMouseDownRef = useRef(false);
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);
  const eventBus = useEventBus();

  // === Settings ===
  const { state: { grid: gridContextSettings, rulers: rulerContextSettings } } = useRulersGridContext();
  const { settings: cursorSettings } = useCursorSettings();
  const {
    crosshairSettings, cursorCanvasSettings, snapSettings,
    rulerSettings, gridSettings, selectionSettings, gridMajorInterval,
  } = useCanvasSettings({
    cursorSettings,
    gridContextSettings: gridContextSettings ?? null,
    rulerContextSettings: rulerContextSettings ?? null,
    showGrid,
  });
  const gripSettings = useGripStyles();

  // === ADR-189: Construction Guide state ===
  const guideState = useGuideState();
  const cpState = useConstructionPointState();
  const { prompt: showPromptDialog } = usePromptDialog();

  // === DXF scene (must be before unified grip system) ===
  const { dxfScene } = useDxfSceneConversion({ currentScene: props.currentScene ?? null });

  // === ADR-183: Unified Grip System ===
  const unified = useUnifiedGripInteraction({
    selectedEntityIds,
    dxfScene,
    transform,
    currentOverlays,
    universalSelection,
    overlayStore,
    overlayStoreRef,
    activeTool,
    gripSettings,
    executeCommand,
    movementDetectionThreshold: MOVEMENT_DETECTION.MIN_MOVEMENT,
  });

  // === Polygon drawing ===
  const {
    draftPolygon, setDraftPolygon, draftPolygonRef,
    isSavingPolygon, setIsSavingPolygon,
    finishDrawingWithPolygonRef, finishDrawing,
  } = usePolygonCompletion({
    levelManager, overlayStore, eventBus,
    currentStatus, currentKind, activeTool, overlayMode,
  });

  const { circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement } = useSpecialTools({ activeTool, levelManager });
  // 🚀 PERF (2026-02-20): Removed currentSnapResult from SnapContext subscription.
  // CanvasSection is heavy (~dozens of hooks); re-rendering on every snap update (30×/sec)
  // caused "heavy cursor movement". Now uses ImmediateSnapStore (zero-cost imperative read).

  // === Cursor + touch gestures (ADR-176) ===
  const { updatePosition, setActive } = useCursorActions();

  const { layoutMode: canvasLayoutMode } = useResponsiveLayoutForCanvas();
  useTouchGestures({
    targetRef: containerRef,
    enabled: canvasLayoutMode !== 'desktop',
    activeTool,
    transform,
    setTransform: contextSetTransform,
  });

  // ADR-189 B5: Guide drag & drop state (declared before useCanvasMouse which needs it)
  const [draggingGuide, setDraggingGuide] = useState<DraggingGuideState | null>(null);

  // ADR-189 B5: Guide drag completion callback — creates MoveGuideCommand for undo/redo
  // Defined before useCanvasMouse because it's passed as a prop
  const handleGuideDragComplete = useCallback((
    guideId: string,
    axis: GridAxis,
    oldOffset: number,
    newOffset: number,
    oldStart?: Point2D,
    oldEnd?: Point2D,
    newStart?: Point2D,
    newEnd?: Point2D,
  ) => {
    const store = getGlobalGuideStore();
    const cmd = new MoveGuideCommand(
      store, guideId, axis,
      oldOffset, newOffset,
      oldStart, oldEnd,
      newStart, newEnd,
    );
    // The guide was already moved live during drag (direct store mutation).
    // Revert to original, then execute through command history for proper undo/redo.
    if (axis === 'XZ' && oldStart && oldEnd) {
      store.moveDiagonalGuideById(guideId, oldStart, oldEnd);
    } else {
      store.moveGuideById(guideId, oldOffset);
    }
    executeCommand(cmd);
  }, [executeCommand]);

  // === Mouse event handling (STRIPPED — grip logic now in unified hook) ===
  const {
    mouseCss, mouseWorld,
    updateMouseCss, updateMouseWorld,
    handleContainerMouseMove,
    handleContainerMouseEnter, handleContainerMouseLeave,
  } = useCanvasMouse({
    transform, viewport, activeTool,
    updatePosition, setActive, containerRef,
    // ADR-183: Pass unified grip state so container drag preview still works
    hoveredVertexInfo: unified.overlayProjection.hoveredVertexInfo,
    hoveredEdgeInfo: unified.overlayProjection.hoveredEdgeInfo,
    selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips,
    draggingVertices: unified.draggingVertices,
    setDraggingVertices: () => {}, // no-op — unified handles this
    draggingEdgeMidpoint: unified.draggingEdgeMidpoint,
    setDraggingEdgeMidpoint: () => {}, // no-op
    draggingOverlayBody: unified.draggingOverlayBody,
    setDraggingOverlayBody: () => {}, // no-op
    dragPreviewPosition: unified.overlayProjection.dragPreviewPosition,
    setDragPreviewPosition: unified.setDragPreviewPosition,
    gripHoverThrottleRef: unified.gripHoverThrottleRef,
    justFinishedDragRef: unified.justFinishedDragRef,
    markDragFinished: unified.markDragFinished,
    universalSelectionRef, overlayStoreRef,
    executeCommand,
    movementDetectionThreshold: MOVEMENT_DETECTION.MIN_MOVEMENT,
    // ADR-189 B5: Guide drag & drop
    draggingGuide,
    setDraggingGuide,
    onGuideDragComplete: handleGuideDragComplete,
  });

  // ADR-189: Parallel guide workflow — highlighted reference + prompt dialog
  const [parallelRefGuideId, setParallelRefGuideId] = useState<string | null>(null);

  // ADR-189 §3.3: Diagonal guide 3-click workflow state
  const [diagonalStep, setDiagonalStep] = useState<0 | 1 | 2>(0);
  const [diagonalStartPoint, setDiagonalStartPoint] = useState<Point2D | null>(null);
  const [diagonalDirectionPoint, setDiagonalDirectionPoint] = useState<Point2D | null>(null);

  // ADR-189: Reset parallel reference when switching away from guide-parallel tool
  useEffect(() => {
    if (activeTool !== 'guide-parallel') {
      setParallelRefGuideId(null);
    }
  }, [activeTool]);

  // ADR-189 §3.3: Reset diagonal state when switching away from guide-xz tool
  useEffect(() => {
    if (activeTool !== 'guide-xz') {
      setDiagonalStep(0);
      setDiagonalStartPoint(null);
      setDiagonalDirectionPoint(null);
    }
  }, [activeTool]);

  // ADR-189: Step 1 — user clicks near a guide → highlight it as reference
  const handleParallelRefSelected = useCallback((refGuideId: string) => {
    setParallelRefGuideId(refGuideId);
  }, []);

  // ADR-189: Step 2 — user clicks on desired side → determines direction, opens dialog
  const handleParallelSideChosen = useCallback((refGuideId: string, sign: 1 | -1) => {
    showPromptDialog({
      title: t('promptDialog.parallelDistance'),
      label: t('promptDialog.enterDistance'),
      placeholder: t('promptDialog.distancePlaceholder'),
      inputType: 'number',
      unit: 'mm',
      validate: (val) => {
        const n = parseFloat(val);
        if (n === 0) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const distance = parseFloat(result);
        if (!isNaN(distance) && Math.abs(distance) > 0.001) {
          // Apply sign from step 2 to the entered distance
          guideState.addParallelGuide(refGuideId, Math.abs(distance) * sign);
        }
      }
      // Reset highlight regardless of confirm/cancel
      setParallelRefGuideId(null);
    });
  }, [showPromptDialog, t, guideState]);

  // ADR-189 §3.3: Diagonal guide 3-click callbacks
  const handleDiagonalStartSet = useCallback((point: Point2D) => {
    setDiagonalStartPoint(point);
    setDiagonalStep(1);
  }, []);

  const handleDiagonalDirectionSet = useCallback((point: Point2D) => {
    setDiagonalDirectionPoint(point);
    setDiagonalStep(2);
  }, []);

  const handleDiagonalComplete = useCallback(() => {
    setDiagonalStep(0);
    setDiagonalStartPoint(null);
    setDiagonalDirectionPoint(null);
  }, []);

  // ADR-189 §3.7: Segments tool — 2-click + dialog workflow state
  const [segmentsStep, setSegmentsStep] = useState<0 | 1>(0);
  const [segmentsStartPoint, setSegmentsStartPoint] = useState<Point2D | null>(null);

  // ADR-189 §3.8: Distance tool — 2-click + dialog workflow state
  const [distanceStep, setDistanceStep] = useState<0 | 1>(0);
  const [distanceStartPoint, setDistanceStartPoint] = useState<Point2D | null>(null);

  // ADR-189: Reset segments/distance state when switching away
  useEffect(() => {
    if (activeTool !== 'guide-segments') {
      setSegmentsStep(0);
      setSegmentsStartPoint(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== 'guide-distance') {
      setDistanceStep(0);
      setDistanceStartPoint(null);
    }
  }, [activeTool]);

  // ADR-189 §3.7: Segments callbacks
  const handleSegmentsStartSet = useCallback((point: Point2D) => {
    setSegmentsStartPoint(point);
    setSegmentsStep(1);
  }, []);

  const handleSegmentsComplete = useCallback((start: Point2D, end: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.segmentCount'),
      label: t('promptDialog.enterSegmentCount'),
      placeholder: t('promptDialog.segmentCountPlaceholder'),
      inputType: 'number',
      validate: (val) => {
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 2) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const count = parseInt(result, 10);
        if (!isNaN(count) && count >= 2) {
          cpState.addSegmentPoints(start, end, count);
        }
      }
      setSegmentsStep(0);
      setSegmentsStartPoint(null);
    });
  }, [showPromptDialog, t, cpState]);

  // ADR-189 §3.8: Distance callbacks
  const handleDistanceStartSet = useCallback((point: Point2D) => {
    setDistanceStartPoint(point);
    setDistanceStep(1);
  }, []);

  const handleDistanceComplete = useCallback((start: Point2D, end: Point2D) => {
    showPromptDialog({
      title: t('promptDialog.pointDistance'),
      label: t('promptDialog.enterPointDistance'),
      placeholder: t('promptDialog.pointDistancePlaceholder'),
      inputType: 'number',
      unit: 'mm',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n) || n <= 0) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const distance = parseFloat(result);
        if (!isNaN(distance) && distance > 0) {
          cpState.addDistancePoints(start, end, distance);
        }
      }
      setDistanceStep(0);
      setDistanceStartPoint(null);
    });
  }, [showPromptDialog, t, cpState]);

  // ADR-189 §3.12: Arc-Line intersection — 2-step state (step 0: pick line, step 1: pick arc)
  const [arcLineStep, setArcLineStep] = useState<0 | 1>(0);
  const [arcLineLine, setArcLineLine] = useState<LinePickableEntity | null>(null);

  // ADR-189 §3.11: Circle-Circle intersection — 2-step state (step 0: pick first, step 1: pick second)
  const [circleIntersectStep, setCircleIntersectStep] = useState<0 | 1>(0);
  const [circleIntersectFirst, setCircleIntersectFirst] = useState<ArcPickableEntity | null>(null);

  // ADR-189: Reset arc/circle tool state when switching away
  useEffect(() => {
    if (activeTool !== 'guide-arc-line-intersect') {
      setArcLineStep(0);
      setArcLineLine(null);
    }
    if (activeTool !== 'guide-circle-intersect') {
      setCircleIntersectStep(0);
      setCircleIntersectFirst(null);
    }
  }, [activeTool]);

  // ADR-189 §3.9: Arc segments picked → prompt for segment count
  const handleArcSegmentsPicked = useCallback((entity: ArcPickableEntity) => {
    showPromptDialog({
      title: t('promptDialog.arcSegmentCount'),
      label: t('promptDialog.enterArcSegmentCount'),
      placeholder: t('promptDialog.segmentCountPlaceholder'),
      inputType: 'number',
      validate: (val) => {
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 2) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const count = parseInt(result, 10);
        if (!isNaN(count) && count >= 2) {
          cpState.addArcSegmentPoints(
            entity.center, entity.radius,
            entity.startAngle, entity.endAngle,
            count, entity.isFullCircle,
          );
        }
      }
    });
  }, [showPromptDialog, t, cpState]);

  // ADR-189 §3.10: Arc distance picked → prompt for distance
  const handleArcDistancePicked = useCallback((entity: ArcPickableEntity) => {
    showPromptDialog({
      title: t('promptDialog.arcPointDistance'),
      label: t('promptDialog.enterArcPointDistance'),
      placeholder: t('promptDialog.pointDistancePlaceholder'),
      inputType: 'number',
      unit: 'mm',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n) || n <= 0) return t('promptDialog.invalidNumber');
        return null;
      },
    }).then((result) => {
      if (result !== null) {
        const distance = parseFloat(result);
        if (!isNaN(distance) && distance > 0) {
          cpState.addArcDistancePoints(
            entity.center, entity.radius,
            entity.startAngle, entity.endAngle,
            distance, entity.isFullCircle,
          );
        }
      }
    });
  }, [showPromptDialog, t, cpState]);

  // ADR-189 §3.12: Arc-Line intersection — step 0 → store line, advance to step 1
  const handleArcLineLinePicked = useCallback((entity: LinePickableEntity) => {
    setArcLineLine(entity);
    setArcLineStep(1);
  }, []);

  // ADR-189 §3.12: Arc-Line intersection — step 1 → compute + create points
  const handleArcLineArcPicked = useCallback((entity: ArcPickableEntity) => {
    if (!arcLineLine) return;
    const prevCount = cpState.pointCount;
    cpState.addLineArcIntersectionPoints(
      arcLineLine.start, arcLineLine.end,
      entity.center, entity.radius,
      entity.startAngle, entity.endAngle,
      entity.isFullCircle,
    );
    // Notify user if no intersections found (pointCount didn't change)
    // Use setTimeout to let the store update propagate
    setTimeout(() => {
      if (cpState.getStore().count === prevCount) {
        notifyWarning(t('promptDialog.noIntersectionFound'));
      }
    }, 0);
    // Reset state
    setArcLineStep(0);
    setArcLineLine(null);
  }, [arcLineLine, cpState, notifyWarning, t]);

  // ADR-189 §3.11: Circle-Circle intersection — step 0 → store first arc, advance to step 1
  const handleCircleIntersectFirstPicked = useCallback((entity: ArcPickableEntity) => {
    setCircleIntersectFirst(entity);
    setCircleIntersectStep(1);
  }, []);

  // ADR-189 §3.11: Circle-Circle intersection — step 1 → compute + create points
  const handleCircleIntersectSecondPicked = useCallback((entity: ArcPickableEntity) => {
    if (!circleIntersectFirst) return;
    const prevCount = cpState.pointCount;
    cpState.addCircleCircleIntersectionPoints(
      circleIntersectFirst.center, circleIntersectFirst.radius,
      circleIntersectFirst.startAngle, circleIntersectFirst.endAngle, circleIntersectFirst.isFullCircle,
      entity.center, entity.radius,
      entity.startAngle, entity.endAngle, entity.isFullCircle,
    );
    // Notify user if no intersections found
    setTimeout(() => {
      if (cpState.getStore().count === prevCount) {
        notifyWarning(t('promptDialog.noCircleIntersectionFound'));
      }
    }, 0);
    // Reset state
    setCircleIntersectStep(0);
    setCircleIntersectFirst(null);
  }, [circleIntersectFirst, cpState, notifyWarning, t]);

  // ADR-189: Guide context menu handlers
  const handleGuideContextDelete = useCallback((guideId: string) => {
    guideState.removeGuide(guideId);
  }, [guideState]);

  const handleGuideContextToggleLock = useCallback((guideId: string) => {
    const store = guideState.getStore();
    const guide = store.getGuideById(guideId);
    if (guide) {
      store.setGuideLocked(guideId, !guide.locked);
    }
  }, [guideState]);

  const handleGuideContextEditLabel = useCallback((guideId: string, currentLabel: string | null) => {
    showPromptDialog({
      title: t('promptDialog.editLabel'),
      label: t('promptDialog.enterLabel'),
      placeholder: currentLabel ?? '',
      defaultValue: currentLabel ?? '',
      inputType: 'text',
    }).then((result) => {
      if (result !== null) {
        const store = guideState.getStore();
        store.setGuideLabel(guideId, result || null);
      }
    });
  }, [showPromptDialog, t, guideState]);

  // ADR-189: Find nearest guide to cursor (for hover highlight in delete/parallel modes + snap highlight)
  const highlightedGuideId = useMemo<string | null>(() => {
    if (!mouseWorld || !guideState.guides.length) return null;

    // 1. Guide tool modes: highlight nearest guide for delete/perpendicular/parallel/move
    const needsToolHighlight =
      activeTool === 'guide-delete' ||
      activeTool === 'guide-perpendicular' ||
      activeTool === 'guide-move' ||
      (activeTool === 'guide-parallel' && !parallelRefGuideId);

    if (needsToolHighlight) {
      const hitToleranceWorld = 30 / transform.scale;
      let nearestId: string | null = null;
      let nearestDist = hitToleranceWorld;
      for (const guide of guideState.guides) {
        if (!guide.visible) continue;
        let dist: number;
        if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
          dist = pointToSegmentDistance(mouseWorld, guide.startPoint, guide.endPoint);
        } else {
          dist = guide.axis === 'X'
            ? Math.abs(mouseWorld.x - guide.offset)
            : Math.abs(mouseWorld.y - guide.offset);
        }
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = guide.id;
        }
      }
      return nearestId;
    }

    // 2. Parallel ref selected → highlight the reference guide
    if (parallelRefGuideId) return parallelRefGuideId;

    // 3. Snap-based highlight: when snap engine locks onto a guide, highlight it
    const snap = getImmediateSnap();
    if (snap?.found && snap.mode === 'guide' && snap.entityId) {
      return snap.entityId;
    }

    return null;
  }, [mouseWorld, guideState.guides, activeTool, parallelRefGuideId, transform.scale]);

  // ADR-189 §4.13: Panel highlight — hover over guide row in GuidePanel → highlight on canvas
  const [panelHighlightGuideId, setPanelHighlightGuideId] = useState<string | null>(null);
  useEffect(() => {
    return eventBus.on('grid:guide-panel-highlight', ({ guideId }) => {
      setPanelHighlightGuideId(guideId);
    });
  }, [eventBus]);

  // Merge: panel highlight takes precedence when no tool-based highlight
  const effectiveHighlightedGuideId = highlightedGuideId ?? panelHighlightGuideId;

  // ADR-189: Ghost guide preview (follows cursor when guide tool is active)
  const ghostGuide = useMemo(() => {
    if (!mouseWorld) return null;
    if (activeTool === 'guide-x') return { axis: 'X' as const, offset: mouseWorld.x };
    if (activeTool === 'guide-z') return { axis: 'Y' as const, offset: mouseWorld.y };
    // Step 2 preview: ghost follows cursor along reference guide's axis (X/Y only — XZ handled by ghostDiagonalGuide)
    if (activeTool === 'guide-parallel' && parallelRefGuideId) {
      const refGuide = guideState.guides.find(g => g.id === parallelRefGuideId);
      if (refGuide && refGuide.axis !== 'XZ') {
        return { axis: refGuide.axis, offset: refGuide.axis === 'X' ? mouseWorld.x : mouseWorld.y };
      }
    }
    return null;
  }, [activeTool, mouseWorld, parallelRefGuideId, guideState.guides]);

  // ADR-189 §3.3: Ghost diagonal guide preview (3-click workflow + XZ parallel)
  const ghostDiagonalGuide = useMemo(() => {
    if (!mouseWorld) return null;

    // XZ parallel preview: shifted diagonal following cursor perpendicular distance
    if (activeTool === 'guide-parallel' && parallelRefGuideId) {
      const refGuide = guideState.guides.find(g => g.id === parallelRefGuideId);
      if (refGuide?.axis === 'XZ' && refGuide.startPoint && refGuide.endPoint) {
        const dx = refGuide.endPoint.x - refGuide.startPoint.x;
        const dy = refGuide.endPoint.y - refGuide.startPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const nx = -dy / len;
          const ny = dx / len;
          const perpDist = (mouseWorld.x - refGuide.startPoint.x) * nx + (mouseWorld.y - refGuide.startPoint.y) * ny;
          return {
            start: { x: refGuide.startPoint.x + nx * perpDist, y: refGuide.startPoint.y + ny * perpDist },
            end: { x: refGuide.endPoint.x + nx * perpDist, y: refGuide.endPoint.y + ny * perpDist },
          };
        }
      }
    }

    if (activeTool !== 'guide-xz') return null;

    if (diagonalStep === 1 && diagonalStartPoint) {
      // Step 1: Free direction — line from start to cursor
      return { start: diagonalStartPoint, end: mouseWorld };
    }

    if (diagonalStep === 2 && diagonalStartPoint && diagonalDirectionPoint) {
      // Step 2: Constrained — project cursor onto direction line
      const dx = diagonalDirectionPoint.x - diagonalStartPoint.x;
      const dy = diagonalDirectionPoint.y - diagonalStartPoint.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return null;
      const t = ((mouseWorld.x - diagonalStartPoint.x) * dx + (mouseWorld.y - diagonalStartPoint.y) * dy) / lenSq;
      return {
        start: diagonalStartPoint,
        end: { x: diagonalStartPoint.x + t * dx, y: diagonalStartPoint.y + t * dy },
      };
    }

    return null;
  }, [activeTool, mouseWorld, diagonalStep, diagonalStartPoint, diagonalDirectionPoint, parallelRefGuideId, guideState.guides]);

  // ADR-189 §3.16: Highlight nearest construction point for delete-point hover
  const highlightedPointId = useMemo<string | null>(() => {
    if (!mouseWorld || activeTool !== 'guide-delete-point') return null;
    const hitToleranceWorld = 30 / transform.scale;
    const nearest = cpState.findNearest(mouseWorld, hitToleranceWorld);
    return nearest?.id ?? null;
  }, [mouseWorld, activeTool, cpState, transform.scale]);

  // ADR-189 §3.7/3.8: Ghost line preview during segments/distance step 1 (start→cursor)
  const ghostSegmentLine = useMemo(() => {
    if (!mouseWorld) return null;
    if (activeTool === 'guide-segments' && segmentsStep === 1 && segmentsStartPoint) {
      return { start: segmentsStartPoint, end: mouseWorld };
    }
    if (activeTool === 'guide-distance' && distanceStep === 1 && distanceStartPoint) {
      return { start: distanceStartPoint, end: mouseWorld };
    }
    return null;
  }, [activeTool, mouseWorld, segmentsStep, segmentsStartPoint, distanceStep, distanceStartPoint]);

  // ADR-183: Wrapper container handlers — unified hook handles grip mouseDown/mouseUp
  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      const consumed = unified.handleMouseDown(
        mouseWorld ?? { x: 0, y: 0 },
        e.shiftKey,
      );
      if (consumed) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    // Fall through to useCanvasMouse for non-grip behavior (not needed — grip handling is complete)
  }, [unified, mouseWorld]);

  const handleContainerMouseUp = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    // 🏢 ENTERPRISE (2026-02-19): Apply snap to container mouseUp for overlay grip alignment
    // 🚀 PERF (2026-02-20): Read from imperative store — no SnapContext re-render needed
    let worldPos = mouseWorld ?? { x: 0, y: 0 };
    const snapResult = getImmediateSnap();
    if (snapResult?.found && snapResult.point) {
      worldPos = snapResult.point;
    }
    const consumed = await unified.handleMouseUp(worldPos);
    if (consumed) return;
    // No fallback needed — unified handles all grip commits
  }, [unified, mouseWorld]);

  // === Layer visibility: always show when drawing/editing ===
  const showLayerCanvas = showLayerCanvasDebug || overlayMode === 'draw' || overlayMode === 'edit';

  // === Overlay → ColorLayer conversion ===
  const {
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrips, selectedGrip,
    draggingVertex, draggingVertices, draggingEdgeMidpoint,
    dragPreviewPosition, draggingOverlayBody,
  } = unified.overlayProjection;

  const { colorLayers, colorLayersWithDraft, isNearFirstPoint } = useOverlayLayers({
    overlays: currentOverlays,
    isSelected: universalSelection.isSelected,
    hoveredVertexInfo, hoveredEdgeInfo,
    selectedGrips, draggingVertex, draggingVertices,
    draggingEdgeMidpoint, dragPreviewPosition,
    draftPolygon, mouseWorld,
    transformScale: transform.scale,
    currentStatus, hoveredOverlayId, overlayMode,
  });

  const { fitToOverlay } = useFitToView({
    dxfScene, colorLayers, zoomSystem, setTransform, containerRef, currentOverlays,
  });

  const { globalRulerSettings, drawingHandlers, drawingHandlersRef, hasUnifiedDrawingPointsRef } = useCanvasEffects({
    activeTool, overlayMode,
    currentScene: props.currentScene ?? null,
    handleSceneChange: props.handleSceneChange,
    onToolChange: props.onToolChange,
    previewCanvasRef,
    selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips,
    setDragPreviewPosition: unified.setDragPreviewPosition,
    universalSelection, dxfScene, dxfCanvasRef, overlayCanvasRef, zoomSystem,
    currentLevelId: levelManager.currentLevelId,
  });

  // 🏢 PERF (2026-02-19): Imperative refs for context menus — open() doesn't re-render canvas
  const drawingMenuRef = useRef<DrawingContextMenuHandle>(null);
  const entityMenuRef = useRef<EntityContextMenuHandle>(null);
  const guideMenuRef = useRef<GuideContextMenuHandle>(null);

  // ADR-188: Entity Rotation Tool (must be before useCanvasContextMenu + useCanvasClickHandler)
  const rotationTool = useRotationTool({
    activeTool,
    selectedEntityIds,
    levelManager,
    executeCommand,
    previewCanvasRef,
    onToolChange: props.onToolChange as ((tool: string) => void) | undefined,
    currentOverlays,
    overlayUpdate: overlayStore.update,
  });

  // ADR-188: Right-click during awaiting-angle → PromptDialog for typed angle input
  const handleRotationAnglePrompt = useCallback(async () => {
    const result = await showPromptDialog({
      title: t('promptDialog.rotationAngle'),
      label: t('promptDialog.enterAngle'),
      placeholder: t('promptDialog.anglePlaceholder'),
      inputType: 'number',
      unit: '°',
      validate: (val) => {
        const n = parseFloat(val);
        if (isNaN(n)) return t('promptDialog.invalidNumber');
        return null;
      },
    });
    if (result !== null) {
      const angle = parseFloat(result);
      if (!isNaN(angle) && Math.abs(angle) > 0.001) {
        rotationTool.handleAngleInput(angle);
      }
    }
  }, [showPromptDialog, t, rotationTool]);

  const { handleDrawingContextMenu } = useCanvasContextMenu({
    containerRef, activeTool, overlayMode, hasUnifiedDrawingPointsRef, draftPolygonRef,
    selectedEntityIds, drawingMenuRef, entityMenuRef,
    rotationPhase: rotationTool.phase,
    onRotationAnglePrompt: handleRotationAnglePrompt,
    // ADR-189: Guide context menu support
    guideMenuRef,
    guides: guideState.guides,
    transformRef,
  });

  const { handleDrawingFinish, handleDrawingClose, handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc } = useDrawingUIHandlers({
    overlayMode, draftPolygonRef, finishDrawingWithPolygonRef, drawingHandlersRef, setDraftPolygon,
  });

  const { handleOverlayClick, handleMultiOverlayClick } = useOverlayInteraction({
    activeTool, overlayMode, currentOverlays, universalSelection, overlayStore,
    hoveredEdgeInfo, transformScale: transform.scale,
    fitToOverlay,
    setDraggingOverlayBody: unified.setDraggingOverlayBody,
    setDragPreviewPosition: unified.setDragPreviewPosition,
  });

  const { handleCanvasClick } = useCanvasClickHandler({
    viewportReady, viewport, transform,
    activeTool, overlayMode,
    circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement,
    dxfGripInteraction: unified.dxfProjection,
    // ADR-188: Rotation tool click routing — isCollectingInput is true ONLY during
    // base-point and angle phases (not during awaiting-entity, where clicks should
    // fall through to entity selection instead of being consumed by rotation)
    rotationIsActive: rotationTool.isCollectingInput,
    handleRotationClick: rotationTool.handleRotationClick,
    levelManager,
    draftPolygon, setDraftPolygon, isSavingPolygon, setIsSavingPolygon,
    isNearFirstPoint, finishDrawingWithPolygonRef,
    drawingHandlersRef, entitySelectedOnMouseDownRef,
    universalSelection,
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrip,
    selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips,
    justFinishedDragRef: unified.justFinishedDragRef,
    draggingOverlayBody: unified.draggingOverlayBody,
    setSelectedEntityIds,
    currentOverlays, handleOverlayClick,
    // ADR-189: Guide click handlers (3-step parallel: ref → side → dialog)
    guideAddGuide: guideState.addGuide,
    guideRemoveGuide: guideState.removeGuide,
    guides: guideState.guides,
    parallelRefGuideId,
    onParallelRefSelected: handleParallelRefSelected,
    onParallelSideChosen: handleParallelSideChosen,
    // ADR-189 §3.3: Diagonal guide 3-click workflow
    guideAddDiagonalGuide: guideState.addDiagonalGuide,
    diagonalStep,
    diagonalStartPoint,
    diagonalDirectionPoint,
    onDiagonalStartSet: handleDiagonalStartSet,
    onDiagonalDirectionSet: handleDiagonalDirectionSet,
    onDiagonalComplete: handleDiagonalComplete,
    // ADR-189 §3.7-3.16: Construction snap point tools
    cpAddPoint: cpState.addPoint,
    cpDeletePoint: cpState.deletePoint,
    cpFindNearest: cpState.findNearest,
    segmentsStep,
    segmentsStartPoint,
    onSegmentsStartSet: handleSegmentsStartSet,
    onSegmentsComplete: handleSegmentsComplete,
    distanceStep,
    distanceStartPoint,
    onDistanceStartSet: handleDistanceStartSet,
    onDistanceComplete: handleDistanceComplete,
    // ADR-189 §3.9/3.10/3.11/3.12: Arc guide entity picking
    onArcSegmentsPicked: handleArcSegmentsPicked,
    onArcDistancePicked: handleArcDistancePicked,
    arcLineStep,
    onArcLineLinePicked: handleArcLineLinePicked,
    onArcLineArcPicked: handleArcLineArcPicked,
    circleIntersectStep,
    onCircleIntersectFirstPicked: handleCircleIntersectFirstPicked,
    onCircleIntersectSecondPicked: handleCircleIntersectSecondPicked,
  });

  const { handleSmartDelete } = useSmartDelete({
    selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips,
    executeCommand,
    overlayStoreRef, universalSelectionRef, levelManager,
    setSelectedEntityIds, eventBus,
  });

  // ADR-186: Entity Join System
  const entityJoinHook = useEntityJoin({
    levelManager,
    executeCommand,
    setSelectedEntityIds,
    onWarning: notifyWarning,
    onSuccess: notifySuccess,
  });

  // ADR-161: Memoized join state (avoid recalculating on every render)
  const entityJoinState = useMemo(() => {
    const canJoin = entityJoinHook.canJoin(selectedEntityIds);
    const preview = canJoin ? entityJoinHook.getJoinPreview(selectedEntityIds) : null;
    return {
      canJoin,
      joinResultLabel: preview?.resultType !== 'not-joinable' ? preview?.resultType : undefined,
    };
  }, [entityJoinHook, selectedEntityIds]);

  // ADR-188: Rotation ghost preview (rubber band + ghost entities)
  // 🏢 FIX (2026-02-20): getViewportElement returns the DxfCanvas element so that
  // worldToScreen uses the SAME dimensions as the click handler (getPointerSnapshotFromElement).
  // This eliminates viewport mismatch between the click path and preview rendering.
  useRotationPreview({
    phase: rotationTool.phase,
    basePoint: rotationTool.basePoint,
    referencePoint: rotationTool.referencePoint,
    currentAngle: rotationTool.currentAngle,
    selectedEntityIds,
    levelManager,
    transform,
    getCanvas: () => previewCanvasRef.current?.getCanvas() ?? null,
    getViewportElement: () => {
      const canvas = dxfCanvasRef?.current?.getCanvas?.();
      return canvas instanceof HTMLElement ? canvas : null;
    },
    cursorWorld: mouseWorld,
  });

  // ADR-188: Route mouse moves to rotation tool when active
  useEffect(() => {
    if (rotationTool.isActive && mouseWorld) {
      rotationTool.handleRotationMouseMove(mouseWorld);
    }
  }, [mouseWorld, rotationTool.isActive, rotationTool.handleRotationMouseMove]);

  // 🏢 FIX (2026-02-19): Callback to exit overlay draw mode on Escape
  // Resets overlayMode from 'draw' → 'select' so drawing doesn't persist
  const handleExitDrawMode = useCallback(() => {
    if (overlayMode === 'draw' && setOverlayMode) {
      setOverlayMode('select');
    }
  }, [overlayMode, setOverlayMode]);

  useCanvasKeyboardShortcuts({
    handleSmartDelete,
    dxfGripInteraction: unified.dxfProjection,
    setDraftPolygon, draftPolygon,
    selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips,
    activeTool, handleDrawingFinish, handleFlipArc, finishDrawing,
    // ADR-161: Entity Join via J key
    selectedEntityIds,
    handleEntityJoin: () => entityJoinHook.joinEntities(selectedEntityIds),
    canEntityJoin: entityJoinState.canJoin,
    onExitDrawMode: handleExitDrawMode,
    // ADR-188: Rotation tool Escape handling
    handleRotationEscape: rotationTool.handleRotationEscape,
    rotationIsActive: rotationTool.isCollectingInput,
  });

  // === Render ===
  return (
    <>
      <CanvasLayerStack
        transform={transform}
        viewport={viewport}
        activeTool={activeTool}
        overlayMode={overlayMode}
        showLayers={showLayers}
        showDxfCanvas={showDxfCanvas}
        showLayerCanvas={showLayerCanvas}
        containerRef={containerRef}
        dxfCanvasRef={dxfCanvasRef}
        overlayCanvasRef={overlayCanvasRef}
        previewCanvasRef={previewCanvasRef}
        drawingHandlersRef={drawingHandlersRef}
        entitySelectedOnMouseDownRef={entitySelectedOnMouseDownRef}
        dxfScene={dxfScene}
        colorLayers={colorLayers}
        colorLayersWithDraft={colorLayersWithDraft}
        settings={{
          crosshair: crosshairSettings,
          cursor: cursorCanvasSettings,
          snap: snapSettings,
          ruler: rulerSettings,
          grid: gridSettings,
          gridMajorInterval,
          selection: selectionSettings,
          grip: gripSettings,
          globalRuler: globalRulerSettings,
        }}
        gripState={unified.gripStateForStack}
        entityState={{
          selectedEntityIds, setSelectedEntityIds,
          hoveredEntityId, setHoveredEntityId,
          hoveredOverlayId, setHoveredOverlayId,
        }}
        zoomSystem={zoomSystem}
        dxfGripInteraction={unified.dxfProjection}
        universalSelection={universalSelection}
        /* 🚀 PERF (2026-02-20): currentSnapResult removed — CanvasLayerStack reads from SnapContext directly */
        setTransform={setTransform}
        mouseCss={mouseCss}
        updateMouseCss={updateMouseCss}
        updateMouseWorld={updateMouseWorld}
        containerHandlers={{
          onMouseMove: handleContainerMouseMove,
          onMouseDown: handleContainerMouseDown,
          onMouseUp: handleContainerMouseUp,
          onMouseEnter: handleContainerMouseEnter,
          onMouseLeave: handleContainerMouseLeave,
        }}
        handleOverlayClick={handleOverlayClick}
        handleMultiOverlayClick={handleMultiOverlayClick}
        handleCanvasClick={handleCanvasClick}
        handleUnifiedMouseMove={unified.handleMouseMove}
        handleDrawingContextMenu={handleDrawingContextMenu}
        drawingState={{
          drawingHandlers,
          draftPolygon,
          handleDrawingFinish, handleDrawingClose,
          handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc,
        }}
        entityJoin={{
          canJoin: entityJoinState.canJoin,
          joinResultLabel: entityJoinState.joinResultLabel,
          onJoin: () => entityJoinHook.joinEntities(selectedEntityIds),
          onDelete: () => handleSmartDelete(),
        }}
        pdf={{
          imageUrl: pdfImageUrl,
          transform: pdfTransform,
          enabled: pdfEnabled,
          opacity: pdfOpacity,
        }}
        onMouseMove={props.onMouseMove}
        entityPickingActive={angleEntityMeasurement.isActive || rotationTool.phase === 'awaiting-entity'}
        // ADR-189: Construction guides
        guides={guideState.guides}
        guidesVisible={guideState.guidesVisible}
        ghostGuide={ghostGuide}
        ghostDiagonalGuide={ghostDiagonalGuide}
        ghostSegmentLine={ghostSegmentLine}
        highlightedGuideId={effectiveHighlightedGuideId}
        constructionPoints={cpState.points}
        highlightedPointId={highlightedPointId}
      />

      {/* 🏢 PERF (2026-02-19): Context menus rendered OUTSIDE CanvasLayerStack.
          Opening the menu triggers re-render ONLY in the menu component itself,
          not the entire canvas stack (~94ms saved per right-click). */}
      <DrawingContextMenu
        ref={drawingMenuRef}
        activeTool={(overlayMode === 'draw' ? 'polygon' : activeTool) as ToolType}
        pointCount={
          overlayMode === 'draw'
            ? draftPolygon.length
            : (drawingHandlers?.drawingState?.tempPoints?.length ?? 0)
        }
        onFinish={handleDrawingFinish}
        onClose={handleDrawingClose}
        onUndoLastPoint={handleDrawingUndoLastPoint}
        onCancel={handleDrawingCancel}
        onFlipArc={handleFlipArc}
      />
      <EntityContextMenu
        ref={entityMenuRef}
        selectedCount={selectedEntityIds.length}
        canJoin={entityJoinState.canJoin}
        joinResultLabel={entityJoinState.joinResultLabel}
        onJoin={() => entityJoinHook.joinEntities(selectedEntityIds)}
        onDelete={() => handleSmartDelete()}
        onCancel={() => entityMenuRef.current?.close()}
      />
      <GuideContextMenu
        ref={guideMenuRef}
        onDelete={handleGuideContextDelete}
        onToggleLock={handleGuideContextToggleLock}
        onEditLabel={handleGuideContextEditLabel}
        onToggleVisibility={guideState.toggleVisibility}
        guidesVisible={guideState.guidesVisible}
        onCancel={() => guideMenuRef.current?.close()}
      />

      {/* ADR-189: Centralized prompt dialog (parallel guide distance, future tools) */}
      <PromptDialog />
    </>
  );
};
