// ⚠️ ARCHITECTURE-CRITICAL — ADR-040. Shell MUST NOT call useSyncExternalStore (CHECK 6C).
'use client';
import React, { useCallback, useMemo, useRef } from 'react';
import { PreviewCanvas } from '../../canvas-v2/preview-canvas';
import RulerCornerBox from '../../canvas-v2/overlays/RulerCornerBox';
// ADR-549 Phase 8 — the CAD crosshair is the OS HARDWARE cursor (CSS `cursor: url(png)`) for perfect
// 1:1 tracking; replaces the old canvas `CrosshairOverlay`. Low-freq settings only (no CHECK 6C store).
import { useCrosshairCursor } from '../../systems/cursor/useCrosshairCursor';
// 🏢 ADR-418: resolve active scene units imperatively at zoom time (no subscription)
import { resolveSceneUnits } from '../../utils/scene-units';
// ADR-732 Batch 2 — Ο ΕΝΑΣ καμβάς της ζώνης Α (grid + floorplan κάτοψη σε ένα στρώμα z0)·
// σειρά ζωγραφικής: grid ΚΑΤΩ από την κάτοψη (Giorgio 2026-06-05, ADR-040).
import { UnderlayDispatchCanvas } from './overlay-dispatch/UnderlayDispatchCanvas';
import { TopoGridUnderlayLeaf } from './TopoGridUnderlayLeaf'; import { NorthArrowLeaf } from './NorthArrowLeaf';
import { DRAWING_AREA_CHROME } from '../../rendering/core/drawing-area'; import { PANEL_LAYOUT } from '../../config/panel-tokens'; import { RULERS_GRID_CONFIG } from '../../systems/rulers-grid/config'; import { PREVIEW_DEFAULTS } from '../../config/color-config';
import { buildDxfRulerSettings } from './canvas-layer-stack-ruler-settings'; import { canvasUI } from '@/styles/design-tokens/canvas'; import { isInDrawingMode } from '../../systems/tools/ToolStateManager';
import type { Point2D } from '../../rendering/types/Types';
import { setHoveredEntity, setHoveredOverlay } from '../../systems/hover/HoverStore';
// ADR-561 EXT — copy-drag detection for the inverted-ghost gate, via the SAME copy-intent
// SSoT the commits use. Plain getSnapshot reads inside it (NOT useSyncExternalStore) →
// CHECK 6C compliant; the Shell stays inert per ADR-040.
import { isGripCopyIntent } from '../../systems/grip/grip-copy-intent';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas'; import type { DxfRenderOptions } from '../../canvas-v2/dxf-canvas/dxf-types'; import type { CanvasLayerStackProps } from './canvas-layer-stack-types';
import {
  SnapIndicatorSubscriber,
  DraftLayerSubscriber,
  DxfCanvasSubscriber,
  WebglLineLayerSubscriber,
  PreviewCanvasMounts,
  type LayerCanvasPassthroughProps,
} from './canvas-layer-stack-leaves';
import { CanvasStackPreviewLeaves } from './canvas-layer-stack-preview-leaves';
import { AutoAreaResultPanel } from './AutoAreaResultPanel'; import { AutoAreaPreviewOverlay } from './AutoAreaPreviewOverlay'; import { ClashReportPanel } from './ClashReportPanel';
// ADR-449 PART B Slice C — «Βαφή σοβά» 2D paintbrush material palette (leaf, gate σε activeTool).
import { FinishPaint2DPanel } from './FinishPaint2DPanel';
import { RegionPerimeterPreviewOverlay } from './RegionPerimeterPreviewOverlay';
import { CanvasNumericInputOverlay } from '../../systems/canvas-numeric-input/CanvasNumericInputOverlay'; import { BasemapPlacementLeaf } from './BasemapPlacementLeaf'; import { DynamicInputSubscriber } from './DynamicInputSubscriber'; import { CanvasLayerStack3dLeaf } from './canvas-layer-stack-3d-leaf'; import { CanvasStackHudLeaves } from './canvas-layer-stack-hud-leaves';
import { ViewMode3DToggleButton } from '../../bim-3d/viewport/ViewMode3DToggleButton'; import { Focus2DOverlayLeaf } from './Focus2DOverlayLeaf'; import { SelectionCursorIcon } from '../../accessibility/SelectionCursorIcon';
// ADR-575/640 — GROUP + BLOCK container selection affordances (overlays + gizmos), grouped
// out of this shell to keep it under the 500-line budget (N.7.1). ADR-040 leaves inside.
import { ContainerSelectionLayers } from './ContainerSelectionLayers';
import { CutPlaneSliderLeaf } from './CutPlaneSliderLeaf'; /* ADR-452 cut-plane slider, self-gated 2D */ import { AxisCutSliderLeaf } from './AxisCutSliderLeaf'; /* ADR-455 vertical X/Y section sliders, self-gated 2D */ import { useDxfOverlay3DSync } from './useDxfOverlay3DSync'; import { useLevelId3DSync } from './useLevelId3DSync';
// ADR-732 Batch 1 — Ο ΕΝΑΣ καμβάς της ζώνης Β (analytical + envelope + mep-wires + proposals):
// αντικαθιστά τα πρώην EnvelopeOverlay/HomeRunWiresOverlay canvases (και τα dispatch canvases
// των ADR-552/554 που ζούσαν σε άλλα leaves) με ένα full-viewport στρώμα z-[11].
import { Overlay2DDispatchCanvas } from './overlay-dispatch/Overlay2DDispatchCanvas';
// ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών» row-move handle overlay (self-gated leaf).
import { DimRowHandleOverlay } from './DimRowHandleOverlay';
// ADR-399 Phase D — 2D «Όλοι οι όροφοι» read-only underlay (other floors, faded, behind active).
import { FloorUnderlayOverlay } from './FloorUnderlayOverlay';
import { CanvasLayerStack2DOverlays } from './canvas-layer-stack-2d-overlays-leaf';
import { useCanvasLayerStackHandlers } from './useCanvasLayerStackHandlers'; import { useCanvasLayerStackZoomHandlers } from './useCanvasLayerStackZoomHandlers';
export type { CanvasLayerStackProps } from './canvas-layer-stack-types';
// Σταθερή αναφορά (dep του floorplan painter memo — ADR-732)· inline literal θα άλλαζε
// ταυτότητα σε κάθε shell render.
const FLOORPLAN_CAD = { mode: 'cad-y-up', chrome: DRAWING_AREA_CHROME } as const;
export const CanvasLayerStack = React.memo(function CanvasLayerStack({
  viewport, activeTool, overlayMode, showLayers,
  showDxfCanvas, showLayerCanvas,
  containerRef, dxfCanvasRef, overlayCanvasRef, previewCanvasRef, drawingHandlersRef, entitySelectedOnMouseDownRef,
  dxfScene, convertScene, colorLayers, draftPolygon, currentStatus,
  settings, gripState,
  zoomSystem, dxfGripInteraction, universalSelection, setTransform,
  containerHandlers,
  handleOverlayClick, handleMultiOverlayClick, handleCanvasClick, handleUnifiedMouseMove,
  handleDrawingContextMenu,
  drawingState, floorId, onMouseMove,
  entityPickingActive,
  selectedGuideIds, constructionPoints,
  guideWorkflowState, guideStateObj, cpStateObj,
  rotationPreview, movePreview, copyPreview, mirrorPreview, scalePreview, stretchPreview, mepFixtureGhostPreview, floorplanSymbolGhostPreview, attachImageGhostPreview, electricalPanelGhostPreview, mepManifoldGhostPreview, mepRadiatorGhostPreview, mepBoilerGhostPreview, mepWaterHeaterGhostPreview, mepSegmentGhostPreview, slabOpeningGhostPreview, openingGhostPreview, levelManager,
}: CanvasLayerStackProps) {
  // --- Destructure grouped props ---
  const {
    crosshair: crosshairSettings, cursor: cursorCanvasSettings, snap: snapSettings,
    ruler: rulerSettings, grid: gridSettings, gridMajorInterval,
    selection: selectionSettings, grip: gripSettings, globalRuler: globalRulerSettings,
  } = settings;
  const {
    draggingVertex, draggingEdgeMidpoint, hoveredVertexInfo, hoveredEdgeInfo,
    draggingOverlayBody, dragPreviewPosition,
  } = gripState;
  const {
    drawingHandlers, handleDrawingFinish, handleDrawingClose,
    handleDrawingCancel, handleDrawingUndoLastPoint, handleFlipArc,
  } = drawingState;
  // --- Computed values ---
  const isGripDragging =
    draggingVertex !== null ||
    draggingEdgeMidpoint !== null ||
    hoveredVertexInfo !== null ||
    hoveredEdgeInfo !== null;
  // --- Named callbacks (extracted to keep shell <500 lines — N.7.1, ADR-040) ---
  const {
    handleTransformChange,
    handleDxfEntitiesSelected,
    handleUnifiedMarqueeResult,
    handleOverlayClickWithEntityClear,
    handleMultiOverlayClickWithEntityClear,
    handleDxfEntitySelect,
  } = useCanvasLayerStackHandlers({
    setTransform, zoomSystem, universalSelection,
    handleOverlayClick, handleMultiOverlayClick, entitySelectedOnMouseDownRef,
  });
  const handleDxfMouseMove = useCallback(
    (screenPos: Point2D, worldPos: Point2D) => {
      if (worldPos) {
        handleUnifiedMouseMove(worldPos, screenPos);
      }
      if (onMouseMove && worldPos) {
        const mockEvent = {
          clientX: screenPos.x,
          clientY: screenPos.y,
          preventDefault: () => {},
          stopPropagation: () => {},
        } as React.MouseEvent;
        onMouseMove(worldPos, mockEvent);
      }
      // 🚀 PERF (2026-05-09): ImmediatePositionStore updated upstream.
      if (isInDrawingMode(activeTool, overlayMode) && worldPos && drawingHandlersRef.current?.onDrawingHover) {
        drawingHandlersRef.current.onDrawingHover(worldPos);
      }
    },
    [handleUnifiedMouseMove, onMouseMove, activeTool, overlayMode, drawingHandlersRef],
  );
  // ADR-040 perf: refs so callbacks don't capture stale scene/colorLayers while staying stable.
  const dxfSceneRef = useRef(dxfScene);
  dxfSceneRef.current = dxfScene;
  const colorLayersRef = useRef(colorLayers);
  colorLayersRef.current = colorLayers;
  // Ruler/zoom callbacks — extracted to keep the shell <500 lines (N.7.1, ADR-040).
  const {
    handleRulerZoomToFit, handleRulerWheelZoom, handleZoomActualSize,
    handleZoomIn, handleZoomOut, handleZoomPrevious, handleZoomToRatio,
  } = useCanvasLayerStackZoomHandlers({
    zoomSystem, viewport, sceneRef: dxfSceneRef, colorLayersRef,
  });
  // --- Computed props ---
  const draggingOverlayDelta =
    draggingOverlayBody && dragPreviewPosition
      ? {
          overlayId: draggingOverlayBody.overlayId,
          delta: {
            x: dragPreviewPosition.x - draggingOverlayBody.startPoint.x,
            y: dragPreviewPosition.y - draggingOverlayBody.startPoint.y,
          },
        }
      : null;
  const dxfRulerSettings = useMemo(
    () => buildDxfRulerSettings(globalRulerSettings, gridSettings.size * gridMajorInterval),
    [globalRulerSettings, gridSettings.size, gridMajorInterval],
  );
  // --- Stable references for downstream memos (avoid fresh-spread per render) ---
  const gridSettingsDisabled = useMemo(
    () => ({ ...gridSettings, enabled: false }),
    [gridSettings],
  );
  const rulerSettingsDisabled = useMemo(
    () => ({ ...rulerSettings, enabled: false }),
    [rulerSettings],
  );
  const layerRenderOptions = useMemo(
    () => ({
      // ADR-040 Φ4/Φ10: the crosshair + cursor pickbox are owned exclusively by the
      // compositor <CrosshairOverlay> (translate3d, off-main-thread). The canvas
      // crosshair/cursor prop surface was deleted in Φ10 (dead) — the layer-canvas
      // has NO cursor-frequency content; it repaints only on real content change.
      showSnapIndicators: true,
      showGrid: false,
      showRulers: false,
      showSelectionBox: false,
      selectionBox: null,
      gripSettings,
    }),
    [gripSettings],
  );
  useDxfOverlay3DSync(dxfScene);
  useLevelId3DSync(levelManager.currentLevelId);
  const layerClassName = `absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['0']}`;
  const layerStyle = useMemo(
    () => canvasUI.positioning.layers.layerCanvasWithTools(activeTool, crosshairSettings.enabled),
    [activeTool, crosshairSettings.enabled],
  );
  // Shared getters consumed by all 3 PreviewCanvas mounts (Rotation / Move / GripDrag).
  const getPreviewCanvas = useCallback(
    () => previewCanvasRef.current?.getCanvas() ?? null,
    [previewCanvasRef],
  );
  const getViewportEl = useCallback(() => {
    const canvas = dxfCanvasRef?.current?.getCanvas?.();
    return canvas instanceof HTMLElement ? canvas : null;
  }, [dxfCanvasRef]);
  // --- LayerCanvas passthrough props (ref and layers excluded — injected by DraftLayerSubscriber) ---
  // ADR-040 Φ12/3.2c — LayerCanvas is a read-only render layer. Interaction props
  // (selection/click/mousemove/wheel/transform/drawing-hover/context-menu) are NOT
  // passed: the DxfCanvas above owns every pointer path (the same handlers are wired
  // to it below). Only render-relevant state reaches the LayerCanvas.
  const layerCanvasPassthroughProps: LayerCanvasPassthroughProps = useMemo(() => ({
    viewport,
    activeTool,
    layersVisible: showLayers,
    enableUnifiedCanvas: true,
    crosshairSettings,
    cursorSettings: cursorCanvasSettings,
    snapSettings,
    // 🏢 Grid is NOT on this canvas — it lives on the bottom-most GridUnderlayCanvas
    // (beneath the floorplan κάτοψη). See ADR-040 (2026-06-05).
    gridSettings: gridSettingsDisabled,
    rulerSettings: rulerSettingsDisabled,
    selectionSettings,
    renderOptions: layerRenderOptions,
    draggingOverlay: draggingOverlayDelta,
    className: layerClassName,
    style: layerStyle,
  }), [
    viewport, activeTool, showLayers,
    crosshairSettings, cursorCanvasSettings,
    snapSettings, gridSettingsDisabled, rulerSettingsDisabled, selectionSettings,
    layerRenderOptions, draggingOverlayDelta, layerClassName, layerStyle,
  ]);
  // DxfCanvas renderOptions base (hoveredEntityId injected by DxfCanvasSubscriber).
  // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): memoized for stable identity so
  // DxfCanvasSubscriber's useMemo on { ...base, hoveredEntityId } stays effective.
  // ADR-049 SSOT: dragPreview removed — grip-drag ghost lives on PreviewCanvas
  // via GripDragPreviewMount, same path as toolbar Move tool.
  // ADR-532 B4 — selectedEntityIds is injected by DxfCanvasSubscriber (leaf
  // self-subscribes useSelectedEntityIds) so the Shell — and the orchestrator —
  // stay inert on entity selection. Base omits it (and hoveredEntityId).
  // ADR-049 inverted ghost: the grip-dragged entity dims at its origin (ghost) while its
  // SOLID moving copy is drawn on PreviewCanvas. A STRING id (not the live dragPreview
  // object) keeps the memo stable through the drag — the main canvas re-renders only on
  // drag start/end (id flips), never per-frame, preserving the ADR-040 static-main-canvas.
  const gripDraggedEntityId = dxfGripInteraction.dragPreview?.entityId ?? null;
  // ADR-561 EXT — a grip drag that is a COPY (Ctrl/⌘ held, or the right-click «Copy» toggle)
  // keeps its source as a permanent original → it must stay SOLID, not dim as the inverted
  // ghost. Read once per Shell render (drag start/end); plain getSnapshot (no subscription).
  const gripDragIsCopy = gripDraggedEntityId != null && isGripCopyIntent();
  const dxfRenderOptionsBase = useMemo<Omit<DxfRenderOptions, 'hoveredEntityId' | 'selectedEntityIds'>>(
    () => ({
      showGrid: false,
      showLayerNames: false,
      wireframeMode: false,
      gripInteractionState: dxfGripInteraction.gripInteractionState,
      // ADR-550 — dim ALL selected originals while a real moving copy is shown: the 2-click Move
      // (awaiting-destination) AND the Rotate tool (awaiting-angle). Scale/Stretch are store-driven
      // → the leaf OR-s them in (CHECK 6C forbids useSyncExternalStore in this Shell).
      movePreviewActive:
        movePreview.phase === 'awaiting-destination' || rotationPreview.phase === 'awaiting-angle',
      // Giorgio 2026-07-21 — a transform tool is armed with a selection but the base point
      // is not yet picked → paint the selection ORANGE (grips are hidden). Cleared the moment
      // the ghost phase begins (destination/target/angle/second-point) → live move colour.
      armedTransformHighlight:
        (activeTool === 'move' && movePreview.phase === 'awaiting-base-point') ||
        (activeTool === 'copy' && copyPreview.phase === 'awaiting-base-point') ||
        (activeTool === 'rotate' &&
          (rotationPreview.phase === 'awaiting-base-point' || rotationPreview.phase === 'awaiting-reference')) ||
        (activeTool === 'mirror' && mirrorPreview.phase === 'awaiting-first-point'),
      gripDraggedEntityId,
      gripDragIsCopy,
    }),
    [dxfGripInteraction.gripInteractionState, activeTool, movePreview.phase, copyPreview.phase, rotationPreview.phase, mirrorPreview.phase, gripDraggedEntityId, gripDragIsCopy],
  );
  // Guide workflow computed params (passed to DxfCanvasSubscriber)
  // ADR-040 Phase XXII.B — το transform ΒΓΗΚΕ από τα params: το useGuideWorkflowComputed
  // διαβάζει scale μόνο του (useTransformScale, leaf-level) — το αντικείμενο μένει σταθερό στο pan.
  const guideComputedParams = useMemo(() => ({
    activeTool,
    guideState: guideStateObj,
    cpState: cpStateObj,
    state: guideWorkflowState,
  }), [activeTool, guideStateObj, cpStateObj, guideWorkflowState]);

  // ADR-549 Phase 8 — hardware-cursor crosshair on the canvas-stack div (inline, overrides the class
  // cursor). Perfect 1:1 tracking (OS cursor plane). Shown whenever the crosshair is enabled — no
  // scene gate, for full parity with the 3D viewport (the crosshair shows on an empty canvas too).
  // The container class is `cursor-crosshair` (safety net: a dropped inline PNG falls back to a
  // native crosshair, never an invisible cursor).
  useCrosshairCursor(containerRef as React.RefObject<HTMLElement | null>, {
    enabled: crosshairSettings.enabled,
  });

  return (
    <>
      <div className="flex-1 relative">
        <div
          ref={containerRef as React.RefObject<HTMLDivElement>}
          className={`canvas-stack relative w-full h-full cursor-crosshair bg-[var(--canvas-background-dxf)] bg-[image:var(--canvas-background-dxf-image)] ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`}
          onMouseMove={containerHandlers.onMouseMove}
          onMouseDown={containerHandlers.onMouseDown}
          onMouseUp={containerHandlers.onMouseUp}
          onMouseEnter={containerHandlers.onMouseEnter}
          onMouseLeave={containerHandlers.onMouseLeave}
          onDoubleClick={containerHandlers.onDoubleClick}
          onContextMenu={handleDrawingContextMenu}
        >
          {/* 🏢 ADR-732 ζώνη Α — ΕΝΑΣ underlay καμβάς: grid (κάτω) + floorplan κάτοψη (πάνω).
              Bottom-most στρώμα, always mounted (grid shows on an empty canvas too).
              ADR-040 (2026-06-05): ο κάναβος ΚΑΤΩ από την κάτοψη — τώρα ως σειρά passes. */}
          <UnderlayDispatchCanvas
            gridSettings={gridSettings}
            viewport={viewport}
            floorId={floorId ?? null}
            cad={FLOORPLAN_CAD}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['0']}`}
          />
          {/* ADR-399 Phase D — 2D underlay of other building floors (read-only, faded),
              behind the active DXF canvas. Self-gated to floor3DScope==='all' && mode==='2d'. */}
          <FloorUnderlayOverlay viewport={viewport} />
          {showLayerCanvas && (
            <DraftLayerSubscriber
              canvasRef={overlayCanvasRef as React.RefObject<HTMLCanvasElement>}
              colorLayers={colorLayers}
              draftPolygon={draftPolygon}
              currentStatus={currentStatus}
              overlayMode={overlayMode}
              layerCanvasPassthroughProps={layerCanvasPassthroughProps}
            />
          )}
          {/* ADR-639 Στάδιο 5 — GPU line layer (z5): the bulk solid LINE/POLYLINE geometry on
              persistent LineSegments2, pan/zoom = camera-matrix-only. Sits ABOVE grid/floorplan/
              draft (z0) and BELOW the DxfCanvas (z10) so detail + selection/hover overpaint it
              (correct painter order: bulk lines bottom, detail on top). Pure JSX mount — ZERO
              useSyncExternalStore in this shell (ADR-040 CHECK 6C). Self-gates to large scenes via
              WEBGL_LINE_LAYER_MIN_ENTITIES; below the gate it builds nothing and Canvas2D draws all. */}
          <WebglLineLayerSubscriber
            scene={dxfScene}
            sceneLevelId={levelManager.currentLevelId}
            convertScene={convertScene}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['5']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
          />
          {showDxfCanvas && (
            <DxfCanvasSubscriber
              dxfCanvasRef={dxfCanvasRef}
              scene={dxfScene}
              sceneLevelId={levelManager.currentLevelId}
              convertScene={convertScene}
              viewport={viewport}
              activeTool={activeTool}
              overlayMode={overlayMode}
              colorLayers={colorLayers}
              renderOptionsBase={dxfRenderOptionsBase}
              crosshairSettings={crosshairSettings}
              gridSettings={gridSettingsDisabled}
              rulerSettings={dxfRulerSettings}
              selectedGuideIds={selectedGuideIds}
              constructionPoints={constructionPoints}
              panelHighlightPointId={guideWorkflowState.panelHighlightPointId}
              guideWorkflowComputedParams={guideComputedParams}
              isGripDragging={isGripDragging || dxfGripInteraction.isDraggingGrip}
              entityPickingActive={entityPickingActive}
              onLayerSelected={handleOverlayClickWithEntityClear}
              onMultiLayerSelected={handleMultiOverlayClickWithEntityClear}
              onEntitiesSelected={handleDxfEntitiesSelected}
              onUnifiedMarqueeResult={handleUnifiedMarqueeResult}
              onHoverEntity={(id) => setHoveredEntity(id)}
              onHoverOverlay={(id) => setHoveredOverlay(id)}
              onEntitySelect={handleDxfEntitySelect}
              onGripMouseDown={(worldPos) => dxfGripInteraction.handleGripMouseDown(worldPos)}
              onGripMouseUp={(worldPos) => dxfGripInteraction.handleGripMouseUp(worldPos)}
              onContextMenu={handleDrawingContextMenu}
              onCanvasClick={handleCanvasClick}
              onTransformChange={handleTransformChange}
              onWheelZoom={zoomSystem.handleWheelZoom}
              onMouseMove={handleDxfMouseMove}
              className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['10']}`}
            />
          )}
          {/* ADR-656 M11 — live ΕΓΣΑ87 coordinate graticule (z20: above entities, below snap/rulers).
              Self-subscribing ADR-040 micro-leaf owns the low-freq visibility flag; the Shell stays
              subscription-free (CHECK 6C) and only threads the transform/viewport it already holds.
              SEPARATE from the F7 drawing-aid grid (GridUnderlayCanvas z0). */}
          <TopoGridUnderlayLeaf
            viewport={viewport}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['20']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
          />
          {/* ADR-656 M12 — North-arrow HUD (top-right corner, z30). Screen-anchored SVG micro-leaf:
              self-subscribes low-freq stores only (CHECK 6C), no transform dependency (North stays
              put on pan/zoom). Bakes to entities separately via the panel. */}
          <NorthArrowLeaf
            className={`absolute top-2 right-2 ${PANEL_LAYOUT.Z_INDEX['30']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
          />
          <PreviewCanvas
            ref={previewCanvasRef as React.RefObject<PreviewCanvasHandle>}
            viewport={viewport}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}
            defaultOptions={PREVIEW_DEFAULTS}
            sceneUnits={dxfScene?.units ?? 'mm'}
          />
          {/* PreviewCanvas mounts: Rotation / Move / GripDrag (ADR-049 SSOT) */}
          <PreviewCanvasMounts
            rotation={rotationPreview}
            move={movePreview}
            copy={copyPreview}
            mirror={mirrorPreview}
            scale={scalePreview}
            stretch={stretchPreview}
            mepFixtureGhost={mepFixtureGhostPreview}
            floorplanSymbolGhost={floorplanSymbolGhostPreview}
            attachImageGhost={attachImageGhostPreview}
            electricalPanelGhost={electricalPanelGhostPreview}
            mepManifoldGhost={mepManifoldGhostPreview}
            mepRadiatorGhost={mepRadiatorGhostPreview}
            mepBoilerGhost={mepBoilerGhostPreview}
            mepWaterHeaterGhost={mepWaterHeaterGhostPreview}
            mepSegmentGhost={mepSegmentGhostPreview}
            slabOpeningGhost={slabOpeningGhostPreview}
            openingGhost={openingGhostPreview}
            gripDragPreview={dxfGripInteraction.dragPreview}
            levelManager={levelManager}
            viewport={viewport}
            getCanvas={getPreviewCanvas}
            getViewportElement={getViewportEl}
          />
          {/* ADR-549 Phase 8 — the CAD crosshair is now the OS hardware cursor (see useCrosshairCursor
              above); the canvas `CrosshairOverlay` is retired. The snap marker overlay stays. */}
          <SnapIndicatorSubscriber
            viewport={viewport}
            dxfCanvasRef={dxfCanvasRef}
            className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${PANEL_LAYOUT.Z_INDEX['30']}`}
          />
          {/* ADR-575/640 — GROUP + BLOCK selection affordances (dashed box overlays + move/
              rotation gizmos). Self-subscribing ADR-040 leaves; the shell stays subscription-free. */}
          <ContainerSelectionLayers
            sceneLevelId={levelManager.currentLevelId}
            viewport={viewport}
            gripInteractionState={dxfGripInteraction.gripInteractionState}
            gripSize={settings.grip?.gripSize}
          />
          <RulerCornerBox
            rulerWidth={rulerSettings.width ?? RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH}
            rulerHeight={rulerSettings.height ?? RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT}
            backgroundColor={globalRulerSettings.horizontal.showBackground !== false ? globalRulerSettings.horizontal.backgroundColor : 'transparent'}
            textColor={globalRulerSettings.horizontal.textColor}
            onZoomToFit={handleRulerZoomToFit}
            onZoomActualSize={handleZoomActualSize}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomPrevious={handleZoomPrevious}
            onZoomToRatio={handleZoomToRatio}
            onWheelZoom={handleRulerWheelZoom}
            showTicks={globalRulerSettings.horizontal.showMajorTicks}
            showLabels={globalRulerSettings.horizontal.showLabels}
            showUnits={globalRulerSettings.horizontal.showUnits}
            className={PANEL_LAYOUT.Z_INDEX['30']}
          />
          {/* Read-only 2D overlay group (AutoArea/Region/Riser/HeatLoad/PipeSizing/
              Balancing) — εξαγωγή σε leaf ώστε ο shell να μένει <500 γραμμές (N.7.1).
              Ίδια σειρά render (z-order αμετάβλητο), ίδιο data flow. STAGE ADR-040. */}
          <CanvasLayerStack2DOverlays viewport={viewport} />
          {/* Εφήμερα preview overlays z-20 (λάσο/μολύβι/μέτρημα/zoom-window) — το κριτήριο
              ένταξης και ο λόγος εξαγωγής ζουν στο ίδιο το leaf. STAGE ADR-040. */}
          <CanvasStackPreviewLeaves viewport={viewport} sceneUnits={dxfScene?.units ?? 'mm'} />
          {/* ADR-782 §23 — χειροκίνητη τοποθέτηση υποβάθρου. Κάθεται στο z-30 (ΠΑΝΩ από τα
              overlays του 2Δ, ΚΑΤΩ από το 3Δ viewport του z-50): όσο η συνεδρία τρέχει, ο δείκτης
              ανήκει σε αυτήν και κανένα εργαλείο σχεδίασης δεν μπορεί να ξεκινήσει ταυτόχρονα.
              Το ίδιο leaf επιστρέφει `null` εκτός συνεδρίας — μηδέν κόστος, καμία επιφάνεια. */}
          <BasemapPlacementLeaf viewport={viewport} className={`absolute ${PANEL_LAYOUT.INSET['0']} w-full h-full ${PANEL_LAYOUT.Z_INDEX['30']}`} />
          <CanvasNumericInputOverlay />
          <DynamicInputSubscriber
            activeTool={activeTool}
            viewport={viewport}
            onDrawingPoint={drawingHandlers.onDrawingPoint}
            getSceneUnits={() => {
              // ADR-513 — draw-time read του ενεργού level scene (mirror slabOpening ghost).
              const lvl = levelManager.currentLevelId;
              return resolveSceneUnits(lvl ? levelManager.getLevelScene(lvl) : dxfSceneRef.current);
            }}
            getCanvasEl={() => dxfCanvasRef?.current?.getCanvas?.() ?? null}
          />
          <CanvasLayerStack3dLeaf />
          {/* ADR-040 — τα HUD που ζουν ΚΑΙ ΣΤΙΣ ΔΥΟ προβολές (πάνω από το 3Δ viewport, z-50):
              απόδοση παρόχου χάρτη (ADR-782 §14) + Performance HUD (ADR-366 §B.5.U). */}
          <CanvasStackHudLeaves getCanvas2D={() => dxfCanvasRef?.current?.getCanvas?.() ?? null} />
          <Focus2DOverlayLeaf scene={dxfScene} viewport={viewport} />
          {/* ADR-732 ζώνη Β — analytical (ADR-552) + envelope (ADR-396 P4) + mep-wires
              (ADR-408 Φ7) + proposals (ADR-554) σε ΕΝΑΝ καμβά z-[11] (πάνω από dxf z10,
              κάτω από preview z15)· η σειρά ζωγραφικής αναπαράγει το πρώην z-συμβόλαιο. */}
          <Overlay2DDispatchCanvas
            scene={dxfScene}
            viewport={viewport}
            currentLevelId={levelManager.currentLevelId}
            gripDragPreview={dxfGripInteraction.dragPreview}
          />
          {/* ADR-362 Round 35 — row-move handles (self-gated: renders null unless the mode is ON). */}
          <DimRowHandleOverlay viewport={viewport} currentLevelId={levelManager.currentLevelId} />
          <SelectionCursorIcon />
          <ViewMode3DToggleButton /><CutPlaneSliderLeaf />{/* ADR-452 */}
          <AxisCutSliderLeaf bounds={dxfScene?.bounds ?? null} />{/* ADR-455 */}
        </div>
      </div>
      <AutoAreaResultPanel />
      {/* ADR-435 Slice 1b — Clash Detective results card (self-contained leaf). */}
      <ClashReportPanel />
      {/* ADR-449 PART B Slice C — «Βαφή σοβά» palette (renders only όταν activeTool==='finish-paint'). */}
      <FinishPaint2DPanel />
    </>
  );
});
