/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * RULE: MUST NOT call useSyncExternalStore — push subscriptions to canvas-layer-stack-leaves.tsx.
 * After any architectural change → update the ADR changelog (same commit).
 */
'use client';
import React, { useRef, useCallback, useEffect } from 'react';
// ADR-040 Phase XXII.A: rendering CanvasLayerStack via the TransformBridge so the
// transform subscription lives below CanvasSection — CanvasSection stays inert on
// wheel zoom. Direct render is preserved as the historical reference point.
import { CanvasLayerStackTransformBridge as CanvasLayerStack } from './CanvasLayerStackTransformBridge';
import { perfStart, perfEnd, PERF_LINE_PROFILE } from '../../debug/perf-line-profile';
// ADR-040 Phase XXII.A: useCanvasRefs (stable refs + setTransform) replaces merged
// useCanvasContext (volatile). Transform read from ImmediateTransformStore at event time,
// not React context — breaks the orchestrator-leak cascade documented in Phase XXII.A.
import { useCanvasRefs } from '../../contexts/CanvasContext';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { isWallRegionTool } from '../../systems/tools/region-tool-ids';
// ADR-362 — dim create tools join the entity hit-test SSoT (entityPickingActive) so hovering an arc/circle highlights it AND fills HoverStore for the radial entity pick.
import { isDimTool } from '../../hooks/dimensions/useDimToolRouting';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLiveOverlaysForLevel } from '../../hooks/useLiveOverlaysForLevel';
import { useLevels } from '../../systems/levels';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
import { useCursorSettings, useCursorActions } from '../../systems/cursor';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Status, OverlayKind } from '../../overlays/types';
import { MOVEMENT_DETECTION } from '../../config/tolerance-config'; import { useGripStyles } from '../../settings-provider';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import { useZoom } from '../../systems/zoom'; import { dwarn, derr } from '../../debug';
import { useFloorplanBackgroundForLevel } from '../../floorplan-background';
import { useEventBus } from '../../systems/events'; import { useUniversalSelectionStable, SelectedEntitiesStore } from '../../systems/selection';
import { useMepCircuitEditorStore } from '../../bim/mep-systems/mep-circuit-editor-store';
import { useCommandHistory, useCommandHistoryKeyboard } from '../../core/commands';
import {
  useCanvasSettings, useCanvasMouse, useViewportManager, useDxfSceneConversion, useCanvasContextMenu, useDrawingUIHandlers, useCanvasClickHandler, useFitToView, useCanvasPan, usePolygonCompletion, useCanvasKeyboardShortcuts, useCanvasEffects, useOverlayInteraction, useCanvasContainerHandlers,
} from '../../hooks/canvas';
// ADR-449 PART B Slice C — «Βαφή σοβά» 2D paintbrush click wiring (direct import, όχι barrel).
import { useFinishPaintClick } from '../../hooks/canvas/useFinishPaintClick';
import { useGuideToolWorkflows, useEntityCompleteGuideListener } from '../../hooks/guides';
import { useOverlayLayers } from '../../hooks/layers';
import { SnapSceneSyncLeaf } from './SnapSceneSyncLeaf';
import { resolveSceneUnits, mmToSceneUnits } from '../../utils/scene-units'; import { DEFAULT_DUCT_WIDTH_MM, DEFAULT_PIPE_DIAMETER_MM } from '../../bim/types/mep-segment-types';
// useHoveredOverlay REMOVED from orchestrator — ADR-040 Phase II micro-leaf (subscription lives in DraftLayerSubscriber, canvas-layer-stack-leaves.tsx).
import { useSpecialTools } from '../../hooks/tools'; import { useModifyTools } from '../../hooks/tools/useModifyTools';
import { useCanvasZoomWindow } from '../../hooks/canvas/useCanvasZoomWindow';
import { useUnifiedGripInteraction } from '../../hooks/grips/useUnifiedGripInteraction';
import { useGripHoverMenuController } from '../../hooks/grips/useGripHoverMenuController'; import { useGripContextMenuController } from '../../hooks/grips/useGripContextMenuController';
import { useGuideActions } from '../../hooks/state/useGuideActions';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { useConstructionPointState } from '../../hooks/state/useConstructionPointState';
import { usePromptDialog } from '../../systems/prompt-dialog';
import { useNotifications } from '../../../../providers/NotificationProvider'; import { useTranslation } from '@/i18n/hooks/useTranslation';
import { type DrawingContextMenuHandle } from '../../ui/components/DrawingContextMenu';
import { SnapOverrideOrchestrator } from '../../snapping/overrides/SnapOverrideOrchestrator';
import { type EntityContextMenuHandle } from '../../ui/components/EntityContextMenu';
import { type GuideContextMenuHandle } from '../../ui/components/GuideContextMenu';
import { type GuideBatchContextMenuHandle } from '../../ui/components/GuideBatchContextMenu';
import type { ToolType } from '../../ui/toolbar/types';
import { isWallEntity } from '../../types/entities'; import type { WallEntity } from '../../bim/types/wall-types';
import { useTouchGestures } from '../../hooks/gestures/useTouchGestures';
import { useResponsiveLayout as useResponsiveLayoutForCanvas } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';
import { useViewportAutoFit } from '../../hooks/canvas/useViewportAutoFit'; import { useCanvasEditActions } from '../../hooks/canvas/useCanvasEditActions';
import { useCanvasSectionUI } from '../../hooks/canvas/useCanvasSectionUI';
import { useSelectionCycling } from '../../systems/selection/use-selection-cycling';
import { useCanvasSection2DFocus } from '../../hooks/canvas/useCanvasSection2DFocus';
import { CanvasSectionOverlays } from './CanvasSectionOverlays';
// ADR-532 B4 — selection-subscribed grip registry leaf (publishes AllGripsStore).
import { GripRegistryPublisher } from './GripRegistryPublisher';
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
  // === Canvas context (refs only — ADR-040 Phase XXII.A) ===
  // ADR-040 XXII.A: useCanvasRefs returns a STABLE value (refs + setTransform),
  // never recreated on transform change. Eliminates the wheel-zoom re-render
  // cascade through 15+ child hooks (was the root cause of 1-2 FPS during zoom).
  const canvasRefs = useCanvasRefs();
  if (process.env.NODE_ENV === 'development' && !canvasRefs) {
    dwarn('CanvasSection', 'CanvasProvider not found — zoom buttons will not work.');
  }
  const dxfCanvasRef = canvasRefs?.dxfRef;
  if (!dxfCanvasRef) {
    derr('CanvasSection', 'CanvasRefs.dxfRef is null — zoom buttons will not work.');
  }
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<PreviewCanvasHandle>(null);
  // === Transform + Viewport ===
  // ADR-040 XXII.A: transform read once at render-top from SSoT; hooks read live transform at
  // event time via `getImmediateTransform()`. Value passed below is back-compat dead weight
  // (renamed `_transform` in each hook) — removed in Phase XXII.B.
  const transform = getImmediateTransform();
  const contextSetTransform = canvasRefs?.setTransform || (() => {
    derr('CanvasSection', 'setTransform called but CanvasRefs not available');
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
  // ADR-532 B4 — NON-reactive selection facade: no re-render on dxf-entity selection. Render
  // consumers moved to leaves (DxfCanvasSubscriber grips, PreviewCanvasMounts ghosts,
  // PropertiesPalette, EntityContextMenuHost, GripRegistryPublisher); event-time consumers
  // read the store at call time.
  const universalSelection = useUniversalSelectionStable();
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
  // === Selection (SSoT: SelectedEntitiesStore) ===
  // ADR-532 B4 — read fresh each render (NOT memoized on the facade). The getter returns a
  // REFERENCE-STABLE array (cachedDxfIds) until selection changes, so modify-tool memos don't
  // thrash, yet the value is current on every re-render. In-place event handlers (keyboard/
  // context-menu/reorder/grips) read the store directly at event time, not this snapshot.
  const selectedEntityIds = SelectedEntitiesStore.getSelectedEntityIds();
  // SSoT: thin alias — delegates to replaceEntitySelection (SelectionSystem is the sole owner).
  // No functional-updater form: all consumers pass string[] directly.
  const setSelectedEntityIds = useCallback((ids: string[]) => {
    universalSelectionRef.current.replaceEntitySelection(ids);
  }, []);
  // ADR-357 Phase 15 (G13): Selection Cycling — Shift+Space to cycle overlapping entities.
  const handleCycleEntitySelect = useCallback((id: string) => { setSelectedEntityIds([id]); }, [setSelectedEntityIds]);
  useSelectionCycling({ activeTool, onSelectEntity: handleCycleEntitySelect });
  // ADR-040 rule 2 — getter for event-time reads (useTextDoubleClickEditor).
  const getSelectedEntityIds = useCallback(() => universalSelectionRef.current.getSelectedEntityIds(), []);
  const entitySelectedOnMouseDownRef = useRef(false);
  // 🚀 PERF (2026-05-09 Phase E → 2026-05-10 Phase II): hoveredEntityId + hoveredOverlayId
  // removed; HoverStore subscriptions live in micro-leaves (DxfCanvasSubscriber, DraftLayer).
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
  const { dxfScene, convertScene } = useDxfSceneConversion({ currentScene: props.currentScene ?? null, userDrawingUnits: Object.values(levelManager.floorplans).find(f => f.levelId === levelManager.currentLevelId)?.userDrawingUnits ?? levelManager.saveContext?.userDrawingUnits });
  const dxfSceneRef = useRef(dxfScene);
  dxfSceneRef.current = dxfScene;
  // === Snap engine scene-sync (SSoT, sole owner — ADR-040 / ADR-547) ===
  // Driven by <SnapSceneSyncLeaf/> below (subscribes to live SceneStore + overlay
  // SSoT; re-inits the snap engine on every in-session commit). Rationale: ADR-547.
  // Ctrl+A: select all DXF entities — fired via EventBus from useKeyboardShortcuts.
  // setSelectedEntityIds writes through universalSelection (SSoT).
  useEffect(() => {
    return eventBus.on('canvas:select-all', () => {
      const entities = dxfSceneRef.current?.entities;
      if (!entities?.length) return;
      setSelectedEntityIds(entities.map(e => e.id));
    });
  }, [eventBus, setSelectedEntityIds]);
  // ADR-366 Phase 4.6 / A.7.Q1 — 2D keyboard focus (Tab/Enter/Esc); wiring + ADR-030 toggle SSoT extracted to keep this orchestrator <500 lines.
  useCanvasSection2DFocus({ dxfSceneRef, transformRef, transform, viewport, universalSelectionRef });
  // === Unified Grip System ===
  // ADR-532 B4: useUnifiedGripInteraction is selection-agnostic — the grip set is
  // computed/published by the GripRegistryPublisher leaf (rendered below) and read
  // here at event time via AllGripsStore. No selectedEntityIds/dxfScene needed.
  const unified = useUnifiedGripInteraction({
    transform, currentOverlays, universalSelection,
    overlayStore, overlayStoreRef, activeTool, gripSettings, executeCommand,
    movementDetectionThreshold: MOVEMENT_DETECTION.MIN_MOVEMENT,
    onToolChange: props.onToolChange as ((tool: string) => void) | undefined,
  });
  useGripHoverMenuController({ hoveredGrip: unified.hoveredGrip, phase: unified.phase, activeTool, levelManager, executeCommand, showPromptDialog, t });
  // ADR-357 Phase 11 — right-click hot grip context menu (AutoCAD-style).
  useGripContextMenuController({ hoveredGrip: unified.hoveredGrip, activeGrip: unified.activeGrip, phase: unified.phase, activeTool, levelManager, handleEscape: unified.handleEscape });
  // === Polygon drawing ===
  const { draftPolygon, setDraftPolygon, draftPolygonRef, isSavingPolygon, setIsSavingPolygon, finishDrawingWithPolygonRef, finishDrawing } = usePolygonCompletion({
    levelManager, overlayStore, eventBus, currentStatus, currentKind, activeTool, overlayMode,
  });
  const { circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement, stairTool, wallTool, slabTool, roofTool, floorFinishTool, wallCoveringTool, columnTool, foundationTool, mepFixtureTool, furnitureTool, floorplanSymbolTool, electricalPanelTool, mepManifoldTool, mepRadiatorTool, mepBoilerTool, mepWaterHeaterTool, mepUnderfloorTool, thermalSpaceTool, spaceSeparatorTool, mepSegmentTool, mepRiserTool, railingTool, beamTool, slabOpeningTool, openingTool } = useSpecialTools({ activeTool, levelManager });
  // === Cursor + touch gestures ===
  const { updatePosition, setActive } = useCursorActions();
  const { layoutMode: canvasLayoutMode } = useResponsiveLayoutForCanvas();
  useTouchGestures({ targetRef: containerRef, enabled: canvasLayoutMode !== 'desktop', activeTool, transform, setTransform: contextSetTransform });
  // === Mouse event handling ===
  // 🚀 PERF (2026-05-09): mouseCss / mouseWorld React state REMOVED — SSoT in ImmediatePositionStore (ADR-040).
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
  useCanvasPan({ transformRef, setTransform });
  const floorplanBg = useFloorplanBackgroundForLevel();
  // ADR-399 — ΕΝΑ viewport auto-fit controller (SSoT)· λεπτομέρειες: ADR-040 changelog 2026-06-16.
  useViewportAutoFit({
    currentScene: props.currentScene ?? null, currentLevelId: levelManager.currentLevelId,
    fileRecordId: levelManager.fileRecordId ?? null, floorplanBg, viewport, zoomSystem, setTransform,
  });
  const { globalRulerSettings, drawingHandlers, drawingHandlersRef, hasUnifiedDrawingPointsRef } = useCanvasEffects({
    activeTool, overlayMode, currentScene: props.currentScene ?? null,
    handleSceneChange: props.handleSceneChange, onToolChange: props.onToolChange, previewCanvasRef,
    selectedGrips: unified.selectedGrips, setSelectedGrips: unified.setSelectedGrips,
    setDragPreviewPosition: unified.setDragPreviewPosition,
    universalSelection, onMeasurementComplete: guideWorkflows.handleMeasurementComplete,
  });
  // === Context menu refs ===
  const drawingMenuRef = useRef<DrawingContextMenuHandle>(null);
  const entityMenuRef = useRef<EntityContextMenuHandle>(null);
  const guideMenuRef = useRef<GuideContextMenuHandle>(null);
  const guideBatchMenuRef = useRef<GuideBatchContextMenuHandle>(null);
  // === Modify tools (ADR-349/350 — extracted to useModifyTools for CanvasSection size budget) ===
  const { rotationTool, moveTool, mirrorTool, scaleTool, stretchTool, trimTool, extendTool, arrayPolarTool, arrayPathTool, wallSplitTool, wallAttachTool, bimCopyTool, handleRotationAnglePrompt } = useModifyTools({
    activeTool, selectedEntityIds, setSelectedEntityIds, levelManager, executeCommand,
    onToolChange: props.onToolChange as ((tool: string) => void) | undefined,
    previewCanvasRef, transformScale: transform.scale,
    overlayStore, universalSelection, currentOverlays,
    overlayUpdate: overlayStore.update,
    showPromptDialog, t,
  });
  const { handleDrawingContextMenu } = useCanvasContextMenu({
    containerRef, activeTool, overlayMode, hasUnifiedDrawingPointsRef, draftPolygonRef,
    drawingMenuRef, entityMenuRef, rotationPhase: rotationTool.phase,
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
  const { textCreation, handleArrayPolarCenterRepick, handleArrayPathEntityRepick, handleSmartDelete, entityJoinHook, handleExitDrawMode, handleReorderEntity } = useCanvasEditActions({
    activeTool, overlayMode, setOverlayMode, transformRef, containerRef,
    onToolChange: props.onToolChange as ((tool: string) => void) | undefined,
    executeCommand, selectedGrips: unified.selectedGrips,
    setSelectedGrips: unified.setSelectedGrips, overlayStoreRef, universalSelectionRef,
    levelManager, setSelectedEntityIds, eventBus, notifyWarning, notifySuccess, hoveredDxfGrip: unified.hoveredGrip,
  });
  // ADR-449 PART B Slice C — «Βαφή σοβά» 2D paintbrush click (κοινός apply SSoT + πλήρες useLevels() write path).
  const handleFinishPaintClick = useFinishPaintClick(levelManager);
  const { handleCanvasClick } = useCanvasClickHandler({
    viewportReady, viewport, transform, activeTool, overlayMode,
    circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement,
    stairTool,
    wallTool,
    slabTool,
    roofTool,
    floorFinishTool,
    wallCoveringTool,
    columnTool,
    foundationTool,
    mepFixtureTool,
    furnitureTool,
    floorplanSymbolTool,
    electricalPanelTool,
    mepManifoldTool,
    mepRadiatorTool,
    mepBoilerTool,
    mepWaterHeaterTool,
    mepUnderfloorTool,
    thermalSpaceTool,
    spaceSeparatorTool,
    mepSegmentTool,
    mepRiserTool,
    railingTool,
    beamTool,
    slabOpeningTool,
    openingTool,
    dxfGripInteraction: unified.dxfProjection,
    rotationIsActive: rotationTool.isCollectingInput, handleRotationClick: rotationTool.handleRotationClick,
    moveIsActive: moveTool.isCollectingInput, handleMoveClick: moveTool.handleMoveClick,
    mirrorIsActive: mirrorTool.isCollectingInput, handleMirrorClick: mirrorTool.handleMirrorClick,
    scaleIsActive: scaleTool.isCollectingInput, handleScaleClick: scaleTool.handleScaleClick,
    stretchIsActive: stretchTool.isCollectingInput, handleStretchClick: stretchTool.handleStretchClick,
    trimIsActive: trimTool.isActive, handleTrimClick: trimTool.handleTrimClick,
    extendIsActive: extendTool.isActive, handleExtendClick: extendTool.handleExtendClick, wallSplitIsActive: wallSplitTool.isActive, handleWallSplitClick: wallSplitTool.handleWallSplitClick, wallAttachIsActive: wallAttachTool.isActive, handleWallAttachClick: wallAttachTool.handleWallAttachClick, bimCopyIsActive: bimCopyTool.isActive, handleBimCopyClick: bimCopyTool.handleBimCopyClick,
    arrayPolarIsActive: arrayPolarTool.isActive, handleArrayPolarClick: arrayPolarTool.handleArrayPolarClick,
    handleArrayPolarCenterRepick,
    arrayPathIsActive: arrayPathTool.isActive, handleArrayPathClick: arrayPathTool.handleArrayPathClick,
    handleArrayPathEntityRepick,
    levelManager, draftPolygon, setDraftPolygon, isSavingPolygon, setIsSavingPolygon,
    finishDrawingWithPolygonRef, drawingHandlersRef, entitySelectedOnMouseDownRef,
    universalSelection, hoveredVertexInfo, hoveredEdgeInfo, selectedGrip,
    selectedGrips: unified.selectedGrips, setSelectedGrips: unified.setSelectedGrips,
    justFinishedDragRef: unified.justFinishedDragRef, draggingOverlayBody: unified.draggingOverlayBody,
    currentOverlays, handleOverlayClick,
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
    // ADR-344 Phase 6.E follow-up — text creation tool click handler
    onTextToolClick: textCreation.handleCanvasClick,
    // ADR-449 PART B Slice C — «Βαφή σοβά» 2D paintbrush click handler
    onFinishPaintClick: handleFinishPaintClick,
  });
  useCanvasKeyboardShortcuts({
    handleSmartDelete, dxfGripInteraction: unified.dxfProjection,
    setDraftPolygon, draftPolygon, selectedGrips: unified.selectedGrips, setSelectedGrips: unified.setSelectedGrips,
    activeTool, handleDrawingFinish, handleFlipArc, finishDrawing,
    // ADR-532 B4 — join reads the live selection at keydown (no stale snapshot).
    handleEntityJoin: () => entityJoinHook.joinEntities(SelectedEntitiesStore.getSelectedEntityIds()),
    canEntityJoin: () => entityJoinHook.canJoin(SelectedEntitiesStore.getSelectedEntityIds()),
    onExitDrawMode: handleExitDrawMode,
    handleRotationEscape: rotationTool.handleRotationEscape, rotationIsActive: rotationTool.isCollectingInput,
    handleMoveEscape: moveTool.handleMoveEscape, moveIsActive: moveTool.isCollectingInput,
    handleMirrorEscape: mirrorTool.handleMirrorEscape, mirrorIsActive: mirrorTool.isCollectingInput,
    handleMirrorConfirm: mirrorTool.handleMirrorConfirm, mirrorAwaitingConfirm: mirrorTool.phase === 'awaiting-keep-originals',
    handleScaleEscape: scaleTool.handleScaleEscape, handleScaleKeyDown: scaleTool.handleScaleKeyDown, scaleIsActive: scaleTool.isCollectingInput,
    handleStretchEscape: stretchTool.handleStretchEscape, handleStretchKeyDown: stretchTool.handleStretchKeyDown, stretchIsActive: stretchTool.isCollectingInput,
    handleTrimEscape: trimTool.handleTrimEscape, handleTrimKeyDown: trimTool.handleTrimKeyDown, trimIsActive: trimTool.isActive,
    handleExtendEscape: extendTool.handleExtendEscape, handleExtendKeyDown: extendTool.handleExtendKeyDown, extendIsActive: extendTool.isActive,
    handleArrayPolarEscape: arrayPolarTool.handleArrayPolarEscape, arrayPolarIsActive: arrayPolarTool.isActive,
    handleArrayPathEscape: arrayPathTool.handleArrayPathEscape, arrayPathIsActive: arrayPathTool.isActive,
    // ADR-397 Σ2 — rotate-free hot-grip keyboard («R» → reference flow).
    handleHotGripKeyDown: unified.handleHotGripKeyDown, hotGripKeyIsActive: unified.hotGripIsActive,
    handleWallSplitEscape: wallSplitTool.handleWallSplitEscape, wallSplitIsActive: wallSplitTool.isActive, handleWallAttachEscape: wallAttachTool.handleWallAttachEscape, wallAttachIsActive: wallAttachTool.isActive, handleBimCopyEscape: bimCopyTool.handleBimCopyEscape, bimCopyIsActive: bimCopyTool.isActive,
    hasAnySelection: universalSelection.count() > selectedEntityIds.length,
    // Canonical deselect (Escape): clear the entity selection AND the active
    // circuit (Revit wire-select has no entity, so the sync no longer clears it —
    // this is the one place that does, keeping deselect symmetric).
    clearEntitySelection: () => {
      universalSelectionRef.current.clearAll();
      useMepCircuitEditorStore.getState().setActiveSystemId(null);
    },
    // Event-time getter (ADR-040: no orchestrator subscription) — a wire-selected
    // circuit has no scene entity, so the Escape guard must consult the circuit SSoT.
    hasActiveCircuit: () => useMepCircuitEditorStore.getState().activeSystemId !== null,
    handleReorderEntity,
    // ADR-357 Phase 3: Direct Distance Entry — provide temp points + point callback
    drawingTempPoints: drawingHandlers?.drawingState?.tempPoints,
    onDirectDistanceEntry: drawingHandlers?.onDrawingPoint,
    // ADR-357 Phase 5: Chain mode keyboard shortcuts
    onUndoChainVertex: handleDrawingUndoLastPoint,
    onChainFinish: handleDrawingCancel,
    // ADR-357 Phase 7: Shift+Right-click snap override menu
    drawingTempPointCount: drawingHandlers?.drawingState?.tempPoints?.length ?? 0,
    onSnapOverrideMenuRequest: (x: number, y: number) => drawingMenuRef.current?.open(x, y),
  });
  const { textEditor, handleDoubleClick, handleMouseMoveWithAutoArea } = useCanvasSectionUI({
    transformRef, containerRef, activeTool, executeCommand,
    getSelectedEntityIds, dxfScene, handleMouseMove: unified.handleMouseMove,
    levelManager, currentOverlays, transformScale: transform.scale,
  });
  // ADR-374 — ZOOM Window tool lifecycle (wiring extracted to keep orchestrator <500 lines, ADR-040).
  useCanvasZoomWindow({ activeTool, setTransform, zoomSystem, onToolChange: props.onToolChange as ((tool: string) => void) | undefined });
  // === Render ===
  return (
    <>
      {/* ADR-532 B4 — selection-subscribed grip registry publisher (renders null;
          keeps AllGripsStore current without re-rendering this orchestrator). */}
      <GripRegistryPublisher dxfScene={dxfScene} currentOverlays={currentOverlays} />
      {/* ADR-547 — sole snap-scene-sync owner (re-inits snap engine; renders null). */}
      <SnapSceneSyncLeaf levelId={levelManager.currentLevelId} fallbackScene={props.currentScene ?? null} />
      <CanvasLayerStack
        viewport={viewport} activeTool={activeTool} overlayMode={overlayMode}
        showLayers={showLayers} showDxfCanvas={showDxfCanvas} showLayerCanvas={showLayerCanvas}
        containerRef={containerRef} dxfCanvasRef={dxfCanvasRef} overlayCanvasRef={overlayCanvasRef}
        previewCanvasRef={previewCanvasRef} drawingHandlersRef={drawingHandlersRef}
        entitySelectedOnMouseDownRef={entitySelectedOnMouseDownRef} dxfScene={dxfScene}
        convertScene={convertScene}
        colorLayers={colorLayers}
        draftPolygon={draftPolygon} currentStatus={currentStatus}
        settings={{ crosshair: crosshairSettings, cursor: cursorCanvasSettings, snap: snapSettings, ruler: rulerSettings, grid: gridSettings, gridMajorInterval, selection: selectionSettings, grip: gripSettings, globalRuler: globalRulerSettings }}
        gripState={unified.gripStateForStack}
        zoomSystem={zoomSystem} dxfGripInteraction={unified.dxfProjection} universalSelection={universalSelection}
        setTransform={setTransform}
        containerHandlers={{ onMouseMove: handleContainerMouseMove, onMouseDown: handleContainerMouseDown, onMouseUp: handleContainerMouseUp, onMouseEnter: handleContainerMouseEnter, onMouseLeave: handleContainerMouseLeave, onDoubleClick: handleDoubleClick }}
        handleOverlayClick={handleOverlayClick} handleMultiOverlayClick={handleMultiOverlayClick}
        handleCanvasClick={handleCanvasClick} handleUnifiedMouseMove={handleMouseMoveWithAutoArea}
        handleDrawingContextMenu={handleDrawingContextMenu}
        drawingState={{ drawingHandlers, draftPolygon, handleDrawingFinish, handleDrawingClose, handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc }}
        floorId={floorplanBg?.floorId ?? null}
        onMouseMove={props.onMouseMove}
        entityPickingActive={angleEntityMeasurement.isActive || rotationTool.phase === 'awaiting-entity' || moveTool.phase === 'awaiting-entity' || mirrorTool.phase === 'awaiting-entity' || activeTool === 'wall-on-entity' || isWallRegionTool(activeTool) || activeTool === 'beam-from-wall' || wallAttachTool.isActive || activeTool === 'guide-arc-segments' || activeTool === 'guide-arc-distance' || activeTool === 'guide-arc-line-intersect' || activeTool === 'guide-circle-intersect' || activeTool === 'guide-line-midpoint' || activeTool === 'guide-circle-center' || isDimTool(activeTool)}
        selectedGuideIds={guideWorkflows.selectedGuideIds} constructionPoints={cpState.points}
        guideWorkflowState={guideWorkflows.state}
        guideStateObj={guideState} cpStateObj={cpState}
        rotationPreview={{ phase: rotationTool.phase, basePoint: rotationTool.basePoint, referencePoint: rotationTool.referencePoint, currentAngle: rotationTool.currentAngle }}
        movePreview={{ phase: moveTool.phase, basePoint: moveTool.basePoint, selectedOverlayIds: universalSelection.getIdsByType('overlay'), getOverlay: (id) => overlayStore.overlays[id] ?? null }}
        mirrorPreview={{ phase: mirrorTool.phase, firstPoint: mirrorTool.firstPoint, secondPoint: mirrorTool.secondPoint }}
        scalePreview={{}}
        stretchPreview={{}}
        mepFixtureGhostPreview={{ isAwaitingPosition: mepFixtureTool.isAwaitingPosition, getGhostFootprint: mepFixtureTool.getGhostFootprint }}
        electricalPanelGhostPreview={{ isAwaitingPosition: electricalPanelTool.isAwaitingPosition, getGhostFootprint: electricalPanelTool.getGhostFootprint }}
        mepManifoldGhostPreview={{ isAwaitingPosition: mepManifoldTool.isAwaitingPosition, getGhostFootprint: mepManifoldTool.getGhostFootprint }}
        mepRadiatorGhostPreview={{ isAwaitingPosition: mepRadiatorTool.isAwaitingPosition, getGhostFootprint: mepRadiatorTool.getGhostFootprint }}
        mepBoilerGhostPreview={{ isAwaitingPosition: mepBoilerTool.isAwaitingPosition, getGhostFootprint: mepBoilerTool.getGhostFootprint, getGhostSymbol: mepBoilerTool.getGhostSymbol }}
        mepWaterHeaterGhostPreview={{ isAwaitingPosition: mepWaterHeaterTool.isAwaitingPosition, getGhostFootprint: mepWaterHeaterTool.getGhostFootprint }}
        mepSegmentGhostPreview={{ isAwaitingEnd: mepSegmentTool.isAwaitingEnd, getGhostSegment: () => { const st = mepSegmentTool.state; if (!st.startPoint) return null; const lvl = levelManager.currentLevelId; const units = resolveSceneUnits(lvl ? levelManager.getLevelScene(lvl) : null); const widthMm = st.domain === 'pipe' ? (st.overrides.diameter ?? DEFAULT_PIPE_DIAMETER_MM) : (st.overrides.width ?? DEFAULT_DUCT_WIDTH_MM); return { startPoint: st.startPoint, sectionWidthCanvas: widthMm * mmToSceneUnits(units), domain: st.domain }; } }}
        slabOpeningGhostPreview={{ isAwaitingPosition: slabOpeningTool.isAwaitingPosition, kind: slabOpeningTool.state.kind, overrides: slabOpeningTool.state.overrides, hoveredEdgeMidpointGrip: unified.hoveredGrip?.slabOpeningGripKind?.startsWith('slab-opening-edge-midpoint-') ? unified.hoveredGrip : null, getSceneUnits: () => { const lvl = levelManager.currentLevelId; return resolveSceneUnits(lvl ? levelManager.getLevelScene(lvl) : null); } }}
        openingGhostPreview={{ isAwaitingPosition: openingTool.isAwaitingPosition, kind: openingTool.state.kind, overrides: openingTool.state.overrides, getHostWall: () => { const id = openingTool.state.hostWallId; const lvl = levelManager.currentLevelId; if (!id || !lvl) return null; const scene = levelManager.getLevelScene(lvl); if (!scene) return null; const e = scene.entities.find((x) => x.id === id); return e && isWallEntity(e) ? (e as WallEntity) : null; }, getSceneUnits: () => { const lvl = levelManager.currentLevelId; return resolveSceneUnits(lvl ? levelManager.getLevelScene(lvl) : null); } }}
        levelManager={levelManager}
      />
      <CanvasSectionOverlays
        drawingMenuRef={drawingMenuRef} guideMenuRef={guideMenuRef} guideBatchMenuRef={guideBatchMenuRef}
        drawingMenu={{ activeTool: (overlayMode === 'draw' ? 'polygon' : activeTool) as ToolType, pointCount: overlayMode === 'draw' ? draftPolygon.length : (drawingHandlers?.drawingState?.tempPoints?.length ?? 0), onFinish: activeTool === 'line' ? handleDrawingCancel : handleDrawingFinish, onClose: handleDrawingClose, onUndoLastPoint: handleDrawingUndoLastPoint, onCancel: handleDrawingCancel, onFlipArc: handleFlipArc, onSnapOverride: (mode) => { SnapOverrideOrchestrator.setOverride(mode); } }}
        entityMenuHost={{ entityMenuRef, currentScene: props.currentScene ?? null, dxfScene, entityJoinHook, handleSmartDelete, onToolChange: props.onToolChange as ((tool: string) => void) | undefined, replaceEntitySelection: (ids) => universalSelectionRef.current.replaceEntitySelection(ids), executeCommand, t }}
        guideMenu={{ onDelete: guideWorkflows.handleGuideContextDelete, onToggleLock: guideWorkflows.handleGuideContextToggleLock, onEditLabel: guideWorkflows.handleGuideContextEditLabel, onChangeColor: guideWorkflows.handleGuideContextChangeColor, onToggleVisibility: guideState.toggleVisibility, guidesVisible: guideState.guidesVisible, onCancel: () => guideMenuRef.current?.close() }}
        guideBatchMenu={{ onDeleteSelected: () => { if (guideWorkflows.selectedGuideIds.size > 0) { guideState.batchDeleteGuides(Array.from(guideWorkflows.selectedGuideIds)); guideWorkflows.setSelectedGuideIds(new Set()); } }, onLockSelected: () => { guideState.getStore().setGuidesLocked(Array.from(guideWorkflows.selectedGuideIds), true); }, onUnlockSelected: () => { guideState.getStore().setGuidesLocked(Array.from(guideWorkflows.selectedGuideIds), false); }, onChangeColor: (color) => { guideState.getStore().setGuidesColor(Array.from(guideWorkflows.selectedGuideIds), color); }, onGroupSelected: () => { const store = guideState.getStore(); const group = store.addGroup(`Group ${Date.now()}`); if (group) { for (const gid of guideWorkflows.selectedGuideIds) store.setGuideGroupId(gid, group.id); } }, onCancel: () => guideBatchMenuRef.current?.close() }}
        quickHover={{ dxfScene, activeTool }} quickMini={{ dxfScene, activeTool, executeCommand, levelManager }} propertiesPalette={{ dxfScene, activeTool, executeCommand, levelManager }}
        mirrorOverlay={mirrorTool.phase === 'awaiting-keep-originals' ? { onConfirm: mirrorTool.handleMirrorConfirm, onCancel: mirrorTool.handleMirrorEscape } : null}
        textEditorOverlay={textEditor.editingState ? { entityId: textEditor.editingState.entityId, initial: textEditor.editingState.initial, anchorRect: textEditor.editingState.anchorRect, onCommit: textEditor.onCommit, onCancel: textEditor.onCancel } : null}
        textCreationOverlay={textCreation.creatingState ? { entityId: textCreation.creatingState.entityId, initial: textCreation.creatingState.initial, anchorRect: textCreation.creatingState.anchorRect, onCommit: textCreation.onCommit, onCancel: textCreation.onCancel } : null}
        selectionCycling={{ onSelectEntity: handleCycleEntitySelect }}
      />
    </>
  );
};
