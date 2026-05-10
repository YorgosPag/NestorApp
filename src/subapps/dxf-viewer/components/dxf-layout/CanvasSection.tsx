/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * RULE: MUST NOT call useSyncExternalStore — push subscriptions to canvas-layer-stack-leaves.tsx.
 * After any architectural change → update the ADR changelog (same commit).
 */
'use client';
import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { CanvasLayerStack } from './CanvasLayerStack';
import { perfStart, perfEnd, PERF_LINE_PROFILE } from '../../debug/perf-line-profile';
import { useCanvasContext } from '../../contexts/CanvasContext';
import { subscribeToImmediateWorldPosition } from '../../systems/cursor/ImmediatePositionStore';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLiveOverlaysForLevel } from '../../hooks/useLiveOverlaysForLevel';
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
import { useFloorplanBackgroundForLevel } from '../../floorplan-background';
import { useEventBus } from '../../systems/events';
import { useUniversalSelection } from '../../systems/selection';
import { useCommandHistory, useCommandHistoryKeyboard } from '../../core/commands';
import {
  useCanvasSettings, useCanvasMouse, useViewportManager, useDxfSceneConversion,
  useCanvasContextMenu, useSmartDelete, useDrawingUIHandlers, useCanvasClickHandler,
  useFitToView, usePolygonCompletion, useCanvasKeyboardShortcuts,
  useCanvasEffects, useOverlayInteraction, useCanvasContainerHandlers,
} from '../../hooks/canvas';
import { useGuideToolWorkflows, useEntityCompleteGuideListener } from '../../hooks/guides';
import { useOverlayLayers } from '../../hooks/layers';
import { useGlobalSnapSceneSync } from '../../snapping/hooks/useGlobalSnapSceneSync';
// useHoveredOverlay REMOVED from orchestrator — ADR-040 Phase II micro-leaf pattern.
// Subscription lives in DraftLayerSubscriber (canvas-layer-stack-leaves.tsx).
import { useSpecialTools } from '../../hooks/tools';
import { useRotationTool } from '../../hooks/tools/useRotationTool';
import { useMoveTool } from '../../hooks/tools/useMoveTool';
import { useUnifiedGripInteraction } from '../../hooks/grips/useUnifiedGripInteraction';
import { useEntityJoin } from '../../hooks/useEntityJoin';
import { useGuideActions } from '../../hooks/state/useGuideActions';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { useConstructionPointState } from '../../hooks/state/useConstructionPointState';
import { PromptDialog, usePromptDialog } from '../../systems/prompt-dialog';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import DrawingContextMenu, { type DrawingContextMenuHandle } from '../../ui/components/DrawingContextMenu';
import EntityContextMenu, { type EntityContextMenuHandle } from '../../ui/components/EntityContextMenu';
import GuideContextMenu, { type GuideContextMenuHandle } from '../../ui/components/GuideContextMenu';
import GuideBatchContextMenu, { type GuideBatchContextMenuHandle } from '../../ui/components/GuideBatchContextMenu';
import type { ToolType } from '../../ui/toolbar/types';
import { useTouchGestures } from '../../hooks/gestures/useTouchGestures';
import { useResponsiveLayout as useResponsiveLayoutForCanvas } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';
/**
 * Canvas orchestrator — wires hooks together and delegates rendering to CanvasLayerStack.
 * No business logic beyond hook composition.
 *
 * ADR-183: Unified Grip System — useUnifiedGripInteraction.
 * ADR-189: Guide workflows — useGuideToolWorkflows (hooks/guides/).
 * ADR-189 B5: Container handlers — useCanvasContainerHandlers (hooks/canvas/).
 */
export const CanvasSection: React.FC<DXFViewerLayoutProps & { overlayMode: OverlayEditorMode, currentStatus: Status, currentKind: OverlayKind }> = (props) => {
  const _perfRenderStart = perfStart();
  const {
    activeTool, showGrid, showLayers,
    overlayMode = 'select', setOverlayMode,
    currentStatus = 'for-sale', currentKind = 'property',
    ...restProps
  } = props;
  useEffect(() => {
    if (PERF_LINE_PROFILE) perfEnd('CanvasSection.commit', _perfRenderStart);
  });

  // === Canvas context ===
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

  // === Transform + Viewport ===
  const defaultTransform = useMemo(() => ({ scale: 1, offsetX: 0, offsetY: 0 }), []);
  const transform = canvasContext?.transform || defaultTransform;
  const contextSetTransform = canvasContext?.setTransform || (() => {
    derr('CanvasSection', 'setTransform called but CanvasContext not available');
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewport, viewportRef, viewportReady, setTransform, transformRef } = useViewportManager({
    containerRef, transform, setTransform: contextSetTransform,
  });
  const zoomSystem = useZoom({ initialTransform: transform, onTransformChange: setTransform, viewport });

  // === Visibility ===
  const showDxfCanvas = props.dxfCanvasVisible ?? true;
  const showLayerCanvasDebug = props.layerCanvasVisible ?? true;

  // === Core stores + state ===
  const overlayStore = useOverlayStore();
  const universalSelection = useUniversalSelection();
  const { execute: executeCommand } = useCommandHistory();
  const { warning: notifyWarning, success: notifySuccess } = useNotifications();
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  useCommandHistoryKeyboard();
  const overlayStoreRef = useRef(overlayStore);
  const universalSelectionRef = useRef(universalSelection);
  overlayStoreRef.current = overlayStore;
  universalSelectionRef.current = universalSelection;
  const levelManager = useLevels();
  // ADR-281: filter out overlays linked to soft-deleted properties
  const currentOverlays = useLiveOverlaysForLevel(levelManager.currentLevelId);

  // === Entity interaction state ===
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const entitySelectedOnMouseDownRef = useRef(false);
  // 🚀 PERF (2026-05-09 Phase E → 2026-05-10 Phase II): hoveredEntityId +
  // hoveredOverlayId both removed from CanvasSection. HoverStore subscriptions
  // live exclusively in micro-leaves (DxfCanvasSubscriber, DraftLayerSubscriber).
  const eventBus = useEventBus();

  // === Settings ===
  const { state: { grid: gridContextSettings, rulers: rulerContextSettings } } = useRulersGridContext();
  const { settings: cursorSettings } = useCursorSettings();
  const { crosshairSettings, cursorCanvasSettings, snapSettings, rulerSettings, gridSettings, selectionSettings, gridMajorInterval } = useCanvasSettings({
    cursorSettings, gridContextSettings: gridContextSettings ?? null, rulerContextSettings: rulerContextSettings ?? null, showGrid,
  });
  const gripSettings = useGripStyles();

  // === Guide + Construction Point state ===
  const guideState = useGuideActions();
  // ADR-040: stable getter — reads from GuideStore at click time, prevents stale snapshot
  const getGuides = useCallback(() => getGlobalGuideStore().getGuides(), []);
  const cpState = useConstructionPointState();
  const { prompt: showPromptDialog } = usePromptDialog();

  // === DXF scene ===
  const { dxfScene } = useDxfSceneConversion({ currentScene: props.currentScene ?? null });
  const dxfSceneRef = useRef(dxfScene);
  dxfSceneRef.current = dxfScene;

  // === Snap engine scene-sync (SSoT, sole owner — ADR-040) ===
  // The SnapEngine singleton's `initialize(allEntities)` is owned exclusively
  // by this hook. `useSnapManager` instances are now consumers only.
  useGlobalSnapSceneSync({ scene: props.currentScene ?? null });

  // Ctrl+A: select all DXF entities — fired via EventBus from useKeyboardShortcuts
  // Updates both local visual state AND universalSelection (SSOT for delete)
  useEffect(() => {
    return eventBus.on('canvas:select-all', () => {
      const entities = dxfSceneRef.current?.entities;
      if (!entities?.length) return;
      const ids = entities.map(e => e.id);
      setSelectedEntityIds(ids);
      universalSelectionRef.current.clearAll();
      universalSelectionRef.current.selectMultiple(ids.map(id => ({ id, type: 'dxf-entity' as const })));
    });
  }, [eventBus]);

  // === Unified Grip System ===
  const unified = useUnifiedGripInteraction({
    selectedEntityIds, dxfScene, transform, currentOverlays, universalSelection,
    overlayStore, overlayStoreRef, activeTool, gripSettings, executeCommand,
    movementDetectionThreshold: MOVEMENT_DETECTION.MIN_MOVEMENT,
  });

  // === Polygon drawing ===
  const { draftPolygon, setDraftPolygon, draftPolygonRef, isSavingPolygon, setIsSavingPolygon, finishDrawingWithPolygonRef, finishDrawing } = usePolygonCompletion({
    levelManager, overlayStore, eventBus, currentStatus, currentKind, activeTool, overlayMode,
  });
  const { circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement } = useSpecialTools({ activeTool, levelManager });

  // === Cursor + touch gestures ===
  const { updatePosition, setActive } = useCursorActions();
  const { layoutMode: canvasLayoutMode } = useResponsiveLayoutForCanvas();
  useTouchGestures({ targetRef: containerRef, enabled: canvasLayoutMode !== 'desktop', activeTool, transform, setTransform: contextSetTransform });

  // === Mouse event handling ===
  // 🚀 PERF (2026-05-09): mouseCss / mouseWorld React state REMOVED.
  // SSoT lives in ImmediatePositionStore — see ADR-040.
  const containerHandlerHook = useCanvasContainerHandlers({
    activeTool, transform, containerRef, executeCommand,
    unified: { handleMouseDown: unified.handleMouseDown, handleMouseUp: unified.handleMouseUp },
  });
  const { draggingGuide, setDraggingGuide, handleGuideDragComplete, handleContainerMouseDown, handleContainerMouseUp } = containerHandlerHook;
  const { handleContainerMouseMove, handleContainerMouseEnter, handleContainerMouseLeave } = useCanvasMouse({
    transform, viewport, activeTool, updatePosition, setActive, containerRef,
    hoveredVertexInfo: unified.overlayProjection.hoveredVertexInfo,
    hoveredEdgeInfo: unified.overlayProjection.hoveredEdgeInfo,
    selectedGrips: unified.selectedGrips, setSelectedGrips: unified.setSelectedGrips,
    draggingVertices: unified.draggingVertices, setDraggingVertices: () => {},
    draggingEdgeMidpoint: unified.draggingEdgeMidpoint, setDraggingEdgeMidpoint: () => {},
    draggingOverlayBody: unified.draggingOverlayBody, setDraggingOverlayBody: () => {},
    dragPreviewPosition: unified.overlayProjection.dragPreviewPosition,
    setDragPreviewPosition: unified.setDragPreviewPosition,
    gripHoverThrottleRef: unified.gripHoverThrottleRef,
    justFinishedDragRef: unified.justFinishedDragRef, markDragFinished: unified.markDragFinished,
    universalSelectionRef, overlayStoreRef, executeCommand,
    movementDetectionThreshold: MOVEMENT_DETECTION.MIN_MOVEMENT,
    draggingGuide, setDraggingGuide, onGuideDragComplete: handleGuideDragComplete,
  });

  // === Guide tool workflows ===
  // 🚀 PERF (2026-05-09): mouseWorld removed — `useGuideWorkflowComputed` now
  // runs inside CanvasLayerStack and subscribes to ImmediatePositionStore.
  const guideWorkflows = useGuideToolWorkflows({
    activeTool, guideState, cpState, showPromptDialog, t, executeCommand,
    notifyWarning, notifySuccess, universalSelection,
    currentScene: props.currentScene ?? null, eventBus,
  });

  // B39 (ADR-189): "Create Guides" prompt for every drawn entity via
  // unified completion pipeline (ADR-057 EventBus). Measurement tools are
  // excluded — they already raise the prompt through `handleMeasurementComplete`.
  useEntityCompleteGuideListener(guideWorkflows.handleEntityComplete);

  // === Layer visibility ===
  const showLayerCanvas = showLayerCanvasDebug || overlayMode === 'draw' || overlayMode === 'edit';

  // === Overlay → ColorLayer ===
  // 🚀 PERF (2026-05-09): useOverlayLayers now produces ONLY the static
  // colorLayers. The mouse-driven `colorLayersWithDraft` / `isNearFirstPoint`
  // moved to `useDraftPolygonLayer` invoked inside CanvasLayerStack.
  const { hoveredVertexInfo, hoveredEdgeInfo, selectedGrips, selectedGrip, draggingVertex, draggingVertices, draggingEdgeMidpoint, dragPreviewPosition, draggingOverlayBody } = unified.overlayProjection;
  // hoveredOverlayId intentionally omitted — subscription moved to DraftLayerSubscriber
  // (ADR-040 Phase II). CanvasSection no longer re-renders on overlay hover.
  const { colorLayers } = useOverlayLayers({
    overlays: currentOverlays, isSelected: universalSelection.isSelected,
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrips, draggingVertex, draggingVertices,
    draggingEdgeMidpoint, dragPreviewPosition,
    hiddenOverlayIds: overlayStore.hiddenOverlayIds,
  });
  const { fitToOverlay } = useFitToView({ dxfScene, colorLayers, zoomSystem, setTransform, containerRef, currentOverlays });

  // ADR-340 Phase 5 — auto-fit camera to newly-loaded floorplan background.
  // Replaces legacy useFitToPdf. Tracks the last-fitted background ID to avoid
  // resetting the user's manual zoom on every re-render.
  const floorplanBg = useFloorplanBackgroundForLevel();
  const lastFittedBgIdRef = useRef<string | null>(null);
  useEffect(() => {
    const bg = floorplanBg?.background;
    if (!bg) return;
    if (lastFittedBgIdRef.current === bg.id) return;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const result = zoomSystem.zoomToFit(
      { min: { x: 0, y: 0 }, max: { x: bg.naturalBounds.width, y: bg.naturalBounds.height } },
      viewport,
      false,
    );
    if (result?.transform) {
      const { scale, offsetX, offsetY } = result.transform;
      if (!isNaN(scale) && !isNaN(offsetX) && !isNaN(offsetY)) {
        lastFittedBgIdRef.current = bg.id;
        setTransform(result.transform);
      }
    }
  }, [floorplanBg?.background, viewport.width, viewport.height, zoomSystem, setTransform]);

  const { globalRulerSettings, drawingHandlers, drawingHandlersRef, hasUnifiedDrawingPointsRef } = useCanvasEffects({
    activeTool, overlayMode, currentScene: props.currentScene ?? null,
    handleSceneChange: props.handleSceneChange, onToolChange: props.onToolChange, previewCanvasRef,
    selectedGrips: unified.selectedGrips, setSelectedGrips: unified.setSelectedGrips,
    setDragPreviewPosition: unified.setDragPreviewPosition,
    universalSelection, dxfScene, dxfCanvasRef, overlayCanvasRef, zoomSystem,
    currentLevelId: levelManager.currentLevelId, onMeasurementComplete: guideWorkflows.handleMeasurementComplete,
  });

  // === Context menu refs ===
  const drawingMenuRef = useRef<DrawingContextMenuHandle>(null);
  const entityMenuRef = useRef<EntityContextMenuHandle>(null);
  const guideMenuRef = useRef<GuideContextMenuHandle>(null);
  const guideBatchMenuRef = useRef<GuideBatchContextMenuHandle>(null);

  // === Rotation Tool ===
  const rotationTool = useRotationTool({
    activeTool, selectedEntityIds, levelManager, executeCommand, previewCanvasRef,
    onToolChange: props.onToolChange as ((tool: string) => void) | undefined,
    currentOverlays, overlayUpdate: overlayStore.update,
  });

  // === Move Tool (ADR-049: AutoCAD-style 2-click) ===
  const moveTool = useMoveTool({
    activeTool, selectedEntityIds, levelManager, executeCommand, previewCanvasRef,
    onToolChange: props.onToolChange as ((tool: string) => void) | undefined,
  });
  const handleRotationAnglePrompt = useCallback(async () => {
    const result = await showPromptDialog({
      title: t('promptDialog.rotationAngle'), label: t('promptDialog.enterAngle'),
      placeholder: t('promptDialog.anglePlaceholder'), inputType: 'number', unit: '°',
      validate: (val) => { const n = parseFloat(val); if (isNaN(n)) return t('promptDialog.invalidNumber'); return null; },
    });
    if (result !== null) { const angle = parseFloat(result); if (!isNaN(angle) && Math.abs(angle) > 0.001) rotationTool.handleAngleInput(angle); }
  }, [showPromptDialog, t, rotationTool]);

  const { handleDrawingContextMenu } = useCanvasContextMenu({
    containerRef, activeTool, overlayMode, hasUnifiedDrawingPointsRef, draftPolygonRef,
    selectedEntityIds, drawingMenuRef, entityMenuRef, rotationPhase: rotationTool.phase,
    onRotationAnglePrompt: handleRotationAnglePrompt, guideMenuRef, getGuides,
    transformRef, guideBatchMenuRef, selectedGuideIds: guideWorkflows.selectedGuideIds,
  });
  const { handleDrawingFinish, handleDrawingClose, handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc } = useDrawingUIHandlers({
    overlayMode, draftPolygonRef, finishDrawingWithPolygonRef, drawingHandlersRef, setDraftPolygon,
  });
  const { handleOverlayClick, handleMultiOverlayClick } = useOverlayInteraction({
    activeTool, overlayMode, currentOverlays, universalSelection, overlayStore,
    hoveredEdgeInfo, transformScale: transform.scale, fitToOverlay,
    setDraggingOverlayBody: unified.setDraggingOverlayBody, setDragPreviewPosition: unified.setDragPreviewPosition,
  });

  const { handleCanvasClick } = useCanvasClickHandler({
    viewportReady, viewport, transform, activeTool, overlayMode,
    circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement,
    dxfGripInteraction: unified.dxfProjection,
    rotationIsActive: rotationTool.isCollectingInput, handleRotationClick: rotationTool.handleRotationClick,
    moveIsActive: moveTool.isCollectingInput, handleMoveClick: moveTool.handleMoveClick,
    levelManager, draftPolygon, setDraftPolygon, isSavingPolygon, setIsSavingPolygon,
    finishDrawingWithPolygonRef, drawingHandlersRef, entitySelectedOnMouseDownRef,
    universalSelection, hoveredVertexInfo, hoveredEdgeInfo, selectedGrip,
    selectedGrips: unified.selectedGrips, setSelectedGrips: unified.setSelectedGrips,
    justFinishedDragRef: unified.justFinishedDragRef, draggingOverlayBody: unified.draggingOverlayBody,
    setSelectedEntityIds, currentOverlays, handleOverlayClick,
    guideAddGuide: guideState.addGuide, guideRemoveGuide: guideState.removeGuide, getGuides,
    parallelRefGuideId: guideWorkflows.parallelRefGuideId, onParallelRefSelected: guideWorkflows.handleParallelRefSelected, onParallelSideChosen: guideWorkflows.handleParallelSideChosen,
    guideAddDiagonalGuide: guideState.addDiagonalGuide, diagonalStep: guideWorkflows.diagonalStep, diagonalStartPoint: guideWorkflows.diagonalStartPoint, diagonalDirectionPoint: guideWorkflows.diagonalDirectionPoint,
    onDiagonalStartSet: guideWorkflows.handleDiagonalStartSet, onDiagonalDirectionSet: guideWorkflows.handleDiagonalDirectionSet, onDiagonalComplete: guideWorkflows.handleDiagonalComplete,
    cpAddPoint: cpState.addPoint, cpDeletePoint: cpState.deletePoint, cpFindNearest: cpState.findNearest,
    segmentsStep: guideWorkflows.segmentsStep, segmentsStartPoint: guideWorkflows.segmentsStartPoint,
    onSegmentsStartSet: guideWorkflows.handleSegmentsStartSet, onSegmentsComplete: guideWorkflows.handleSegmentsComplete,
    distanceStep: guideWorkflows.distanceStep, distanceStartPoint: guideWorkflows.distanceStartPoint,
    onDistanceStartSet: guideWorkflows.handleDistanceStartSet, onDistanceComplete: guideWorkflows.handleDistanceComplete,
    onArcSegmentsPicked: guideWorkflows.handleArcSegmentsPicked, onArcDistancePicked: guideWorkflows.handleArcDistancePicked,
    arcLineStep: guideWorkflows.arcLineStep, onArcLineLinePicked: guideWorkflows.handleArcLineLinePicked, onArcLineArcPicked: guideWorkflows.handleArcLineArcPicked,
    circleIntersectStep: guideWorkflows.circleIntersectStep, onCircleIntersectFirstPicked: guideWorkflows.handleCircleIntersectFirstPicked, onCircleIntersectSecondPicked: guideWorkflows.handleCircleIntersectSecondPicked,
    perpRefGuideId: guideWorkflows.perpRefGuideId, onPerpRefSelected: guideWorkflows.handlePerpRefSelected, onPerpPlaced: guideWorkflows.handlePerpPlaced,
    onRectCenterPlace: guideWorkflows.handleRectCenterPlace, onLineMidpointPlace: guideWorkflows.handleLineMidpointPlace, onCircleCenterPlace: guideWorkflows.handleCircleCenterPlace,
    onGridOriginSet: guideWorkflows.handleGridOriginSet, rotateRefGuideId: guideWorkflows.rotateRefGuideId,
    onRotateRefSelected: guideWorkflows.handleRotateRefSelected, onRotatePivotSet: guideWorkflows.handleRotatePivotSet,
    onRotateAllPivotSet: guideWorkflows.handleRotateAllPivotSet, rotateGroupSelectedIds: guideWorkflows.rotateGroupSelectedIds,
    onRotateGroupToggle: guideWorkflows.handleRotateGroupToggle, onRotateGroupPivotSet: guideWorkflows.handleRotateGroupPivotSet,
    equalizeSelectedIds: guideWorkflows.equalizeSelectedIds, onEqualizeToggle: guideWorkflows.handleEqualizeToggle, onEqualizeApply: guideWorkflows.handleEqualizeApply,
    onPolarArrayCenterSet: guideWorkflows.handlePolarArrayCenterSet, onScaleOriginSet: guideWorkflows.handleScaleOriginSet,
    onGuideAngleOriginSet: guideWorkflows.handleGuideAngleOriginSet, onMirrorAxisSelected: guideWorkflows.handleMirrorAxisSelected,
    onGuideFromEntity: guideWorkflows.handleGuideFromEntity, onGuideOffsetFromEntity: guideWorkflows.handleGuideOffsetFromEntity,
    onGuideSelectToggle: guideWorkflows.handleGuideSelectToggle, onGuideDeselectAll: guideWorkflows.handleGuideDeselectAll,
  });

  const { handleSmartDelete } = useSmartDelete({
    selectedGrips: unified.selectedGrips, setSelectedGrips: unified.setSelectedGrips,
    executeCommand, overlayStoreRef, universalSelectionRef, levelManager, setSelectedEntityIds, eventBus,
  });
  const entityJoinHook = useEntityJoin({ levelManager, executeCommand, setSelectedEntityIds, onWarning: notifyWarning, onSuccess: notifySuccess });
  const entityJoinState = useMemo(() => {
    const canJoin = entityJoinHook.canJoin(selectedEntityIds);
    const preview = canJoin ? entityJoinHook.getJoinPreview(selectedEntityIds) : null;
    return { canJoin, joinResultLabel: preview?.resultType !== 'not-joinable' ? preview?.resultType : undefined };
  }, [entityJoinHook, selectedEntityIds]);

  // 🚀 PERF (2026-05-09): useRotationPreview MOVED into CanvasLayerStack
  // (subscribes to ImmediatePositionStore locally — no parent re-render).
  // The `handleRotationMouseMove` callback now subscribes to the world
  // position store directly instead of a useEffect that depends on a
  // mouseWorld React state value.
  useEffect(() => {
    if (!rotationTool.isActive) return;
    return subscribeToImmediateWorldPosition((pos) => {
      if (pos) rotationTool.handleRotationMouseMove(pos);
    });
  }, [rotationTool.isActive, rotationTool.handleRotationMouseMove]);

  const handleExitDrawMode = useCallback(() => { if (overlayMode === 'draw' && setOverlayMode) setOverlayMode('select'); }, [overlayMode, setOverlayMode]);
  useCanvasKeyboardShortcuts({
    handleSmartDelete, dxfGripInteraction: unified.dxfProjection,
    setDraftPolygon, draftPolygon, selectedGrips: unified.selectedGrips, setSelectedGrips: unified.setSelectedGrips,
    activeTool, handleDrawingFinish, handleFlipArc, finishDrawing, selectedEntityIds,
    handleEntityJoin: () => entityJoinHook.joinEntities(selectedEntityIds), canEntityJoin: entityJoinState.canJoin,
    onExitDrawMode: handleExitDrawMode,
    handleRotationEscape: rotationTool.handleRotationEscape, rotationIsActive: rotationTool.isCollectingInput,
    handleMoveEscape: moveTool.handleMoveEscape, moveIsActive: moveTool.isCollectingInput,
    // SSoT deselect-all: clears both the local entity state and the UniversalSelection
    // registry (same pattern as `canvas:select-all` at line 144).
    clearEntitySelection: () => {
      setSelectedEntityIds([]);
      universalSelectionRef.current.clearAll();
    },
  });

  // === Render ===
  return (
    <>
      <CanvasLayerStack
        transform={transform} viewport={viewport} activeTool={activeTool} overlayMode={overlayMode}
        showLayers={showLayers} showDxfCanvas={showDxfCanvas} showLayerCanvas={showLayerCanvas}
        containerRef={containerRef} dxfCanvasRef={dxfCanvasRef} overlayCanvasRef={overlayCanvasRef}
        previewCanvasRef={previewCanvasRef} drawingHandlersRef={drawingHandlersRef}
        entitySelectedOnMouseDownRef={entitySelectedOnMouseDownRef} dxfScene={dxfScene}
        colorLayers={colorLayers}
        draftPolygon={draftPolygon} currentStatus={currentStatus}
        settings={{ crosshair: crosshairSettings, cursor: cursorCanvasSettings, snap: snapSettings, ruler: rulerSettings, grid: gridSettings, gridMajorInterval, selection: selectionSettings, grip: gripSettings, globalRuler: globalRulerSettings }}
        gripState={unified.gripStateForStack}
        entityState={{ selectedEntityIds, setSelectedEntityIds }}
        zoomSystem={zoomSystem} dxfGripInteraction={unified.dxfProjection} universalSelection={universalSelection}
        setTransform={setTransform}
        containerHandlers={{ onMouseMove: handleContainerMouseMove, onMouseDown: handleContainerMouseDown, onMouseUp: handleContainerMouseUp, onMouseEnter: handleContainerMouseEnter, onMouseLeave: handleContainerMouseLeave }}
        handleOverlayClick={handleOverlayClick} handleMultiOverlayClick={handleMultiOverlayClick}
        handleCanvasClick={handleCanvasClick} handleUnifiedMouseMove={unified.handleMouseMove}
        handleDrawingContextMenu={handleDrawingContextMenu}
        drawingState={{ drawingHandlers, draftPolygon, handleDrawingFinish, handleDrawingClose, handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc }}
        entityJoin={{ canJoin: entityJoinState.canJoin, joinResultLabel: entityJoinState.joinResultLabel, onJoin: () => entityJoinHook.joinEntities(selectedEntityIds), onDelete: () => handleSmartDelete() }}
        floorId={floorplanBg?.floorId ?? null}
        onMouseMove={props.onMouseMove}
        entityPickingActive={angleEntityMeasurement.isActive || rotationTool.phase === 'awaiting-entity' || moveTool.phase === 'awaiting-entity' || activeTool === 'guide-arc-segments' || activeTool === 'guide-arc-distance' || activeTool === 'guide-arc-line-intersect' || activeTool === 'guide-circle-intersect' || activeTool === 'guide-line-midpoint' || activeTool === 'guide-circle-center'}
        selectedGuideIds={guideWorkflows.selectedGuideIds} constructionPoints={cpState.points}
        guideWorkflowState={guideWorkflows.state}
        guideStateObj={guideState} cpStateObj={cpState}
        rotationPreview={{ phase: rotationTool.phase, basePoint: rotationTool.basePoint, referencePoint: rotationTool.referencePoint, currentAngle: rotationTool.currentAngle }}
        movePreview={{ phase: moveTool.phase, basePoint: moveTool.basePoint }}
        levelManager={levelManager}
      />
      <DrawingContextMenu ref={drawingMenuRef} activeTool={(overlayMode === 'draw' ? 'polygon' : activeTool) as ToolType}
        pointCount={overlayMode === 'draw' ? draftPolygon.length : (drawingHandlers?.drawingState?.tempPoints?.length ?? 0)}
        onFinish={handleDrawingFinish} onClose={handleDrawingClose} onUndoLastPoint={handleDrawingUndoLastPoint} onCancel={handleDrawingCancel} onFlipArc={handleFlipArc} />
      <EntityContextMenu ref={entityMenuRef} selectedCount={selectedEntityIds.length}
        canJoin={entityJoinState.canJoin} joinResultLabel={entityJoinState.joinResultLabel}
        onJoin={() => entityJoinHook.joinEntities(selectedEntityIds)} onDelete={() => handleSmartDelete()} onCancel={() => entityMenuRef.current?.close()} />
      <GuideContextMenu ref={guideMenuRef}
        onDelete={guideWorkflows.handleGuideContextDelete} onToggleLock={guideWorkflows.handleGuideContextToggleLock}
        onEditLabel={guideWorkflows.handleGuideContextEditLabel} onChangeColor={guideWorkflows.handleGuideContextChangeColor}
        onToggleVisibility={guideState.toggleVisibility} guidesVisible={guideState.guidesVisible} onCancel={() => guideMenuRef.current?.close()} />
      <GuideBatchContextMenu ref={guideBatchMenuRef}
        onDeleteSelected={() => { if (guideWorkflows.selectedGuideIds.size > 0) { guideState.batchDeleteGuides(Array.from(guideWorkflows.selectedGuideIds)); guideWorkflows.setSelectedGuideIds(new Set()); } }}
        onLockSelected={() => { guideState.getStore().setGuidesLocked(Array.from(guideWorkflows.selectedGuideIds), true); }}
        onUnlockSelected={() => { guideState.getStore().setGuidesLocked(Array.from(guideWorkflows.selectedGuideIds), false); }}
        onChangeColor={(color) => { guideState.getStore().setGuidesColor(Array.from(guideWorkflows.selectedGuideIds), color); }}
        onGroupSelected={() => { const store = guideState.getStore(); const group = store.addGroup(`Group ${Date.now()}`); if (group) { for (const gid of guideWorkflows.selectedGuideIds) store.setGuideGroupId(gid, group.id); } }}
        onCancel={() => guideBatchMenuRef.current?.close()} />
      <PromptDialog />
    </>
  );
};
