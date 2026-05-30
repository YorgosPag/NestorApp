/**
 * 🏢 ENTERPRISE: useCanvasClickHandler Hook
 *
 * @description Handles all canvas click logic with priority-based routing:
 * 1. Grip interaction (DXF entity grips)
 * 1.3. Rotation tool entity selection (awaiting-entity phase)
 * 1.5. Rotation tool click (base point or angle confirmation)
 * 1.6. Guide tool clicks (delegated to guide-click-handlers.ts)
 * 1.9. Angle entity measurement picking (delegated to entity-pick-handlers.ts)
 * 2. Circle TTT entity picking (delegated to entity-pick-handlers.ts)
 * 3. Line Perpendicular entity picking (delegated to entity-pick-handlers.ts)
 * 4. Line Parallel entity picking (delegated to entity-pick-handlers.ts)
 * 5. Overlay polygon drawing (draftPolygon)
 * 6. Unified drawing/measurement tools
 * 7. Move tool overlay body drag
 * 8. Empty canvas deselection
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~260 lines of click routing logic
 * SPLIT: Types → canvas-click-types.ts, Guides → guide-click-handlers.ts,
 *        Entity picks → entity-pick-handlers.ts
 *
 * @see ADR-030: Universal Selection System
 * @see ADR-046: World Coordinate Click Pattern
 * @see ADR-147: Centralized Hit Tolerance
 */
'use client';
import { useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { isInteractiveTool } from '../../systems/tools/ToolStateManager';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { TOLERANCE_CONFIG, POLYGON_TOLERANCES } from '../../config/tolerance-config';
import { setAutoAreaState } from '../../systems/auto-area/AutoAreaResultStore';
import { collectAreaCandidates, collectHoleAreas } from '../../systems/auto-area/auto-area-hit';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { dlog, dwarn } from '../../debug';
import { PolygonCropStore } from '../../systems/lasso/LassoCropStore';
// ADR-040 Phase XXII.A — transform reads from SSoT (orchestrator-decoupling).
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
// ADR-363 Phase 1J — wall-on-entity selects the hovered (picked) source entity.
import { getHoveredEntity } from '../../systems/hover/HoverStore';
// ADR-363 — apply F8 ortho / F10 polar to BIM tool clicks (wall/stair/beam/slab)
// using their preview-store anchor, so the committed point matches the preview.
import { applyBimDrawingConstraint } from '../drawing/bim-ortho-reference';
// ── Re-exports for backward compatibility ───────────────────────────────────
export type {
  ArcPickableEntity,
  LinePickableEntity,
  UseCanvasClickHandlerParams,
  UseCanvasClickHandlerReturn,
} from './canvas-click-types';
import type { UseCanvasClickHandlerParams, UseCanvasClickHandlerReturn } from './canvas-click-types';
import { handleGuideToolClick } from './guide-click-handlers';
import type { GuideClickContext } from './guide-click-handlers';
import {
  handleAngleEntityPick,
  handleCircleTTTPick,
  handleLinePerpendicularPick,
  handleLineParallelPick,
} from './entity-pick-handlers';
import type { EntityPickContext } from './entity-pick-handlers';
import { testEntityHit } from './canvas-click-entity-hit';
// ============================================================================
// HOOK
// ============================================================================
export function useCanvasClickHandler(params: UseCanvasClickHandlerParams): UseCanvasClickHandlerReturn {
  // ADR-040 XXII.A: `transform` param retained for signature compat; reads via SSoT.
  const {
    viewportReady, viewport, transform: _transform,
    activeTool, overlayMode,
    circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement, dxfGripInteraction,
    stairTool,
    wallTool,
    slabTool,
    columnTool,
    beamTool,
    slabOpeningTool,
    openingTool,
    rotationIsActive = false, handleRotationClick,
    moveIsActive = false, handleMoveClick,
    mirrorIsActive = false, handleMirrorClick,
    scaleIsActive = false, handleScaleClick,
    stretchIsActive = false, handleStretchClick,
    trimIsActive = false, handleTrimClick,
    extendIsActive = false, handleExtendClick,
    wallSplitIsActive = false, handleWallSplitClick,
    bimCopyIsActive = false, handleBimCopyClick,
    arrayPolarIsActive = false, handleArrayPolarClick,
    handleArrayPolarCenterRepick,
    arrayPathIsActive = false, handleArrayPathClick,
    handleArrayPathEntityRepick,
    levelManager,
    draftPolygon, setDraftPolygon, isSavingPolygon, setIsSavingPolygon,
    finishDrawingWithPolygonRef,
    drawingHandlersRef, entitySelectedOnMouseDownRef,
    universalSelection,
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrip,
    setSelectedGrips, justFinishedDragRef,
    draggingOverlayBody,
    currentOverlays, handleOverlayClick,
  } = params;
  void _transform;
  const handleCanvasClick = useCallback((worldPoint: Point2D, shiftKey: boolean = false) => {
    // Block interactions until viewport is ready
    if (!viewportReady) {
      dwarn('useCanvasClickHandler', 'Click blocked: viewport not ready', viewport);
      return;
    }
    // PRIORITY 0.5: Polygon crop — accumulate click-to-add polygon point
    if (activeTool === 'polygon-crop') {
      PolygonCropStore.addPoint(worldPoint.x, worldPoint.y);
      return;
    }
    // PRIORITY 1: DXF entity grip interaction (ONLY in select mode — not during drawing)
    if (!isInteractiveTool(activeTool) && activeTool !== 'rotate' && activeTool !== 'scale' && activeTool !== 'stretch' && activeTool !== 'mstretch' && dxfGripInteraction.handleGripClick(worldPoint)) {
      return;
    }
    // PRIORITY 1.3: ADR-188 — Rotation tool entity selection (awaiting-entity phase)
    if (activeTool === 'rotate' && !rotationIsActive) {
      if (handleRotationEntitySelection(worldPoint, params)) return;
      return; // Click on empty space during awaiting-entity → stay in phase
    }
    // PRIORITY 1.5: ADR-188 — Rotation tool click (base point or angle confirmation)
    if (rotationIsActive && handleRotationClick) {
      handleRotationClick(worldPoint);
      return;
    }
    // PRIORITY 1.55: ADR-049 — Move tool click (base point or destination)
    if (moveIsActive && handleMoveClick) {
      handleMoveClick(worldPoint);
      return;
    }
    // PRIORITY 1.56: Mirror tool click (axis point 1 or 2)
    if (mirrorIsActive && handleMirrorClick) {
      handleMirrorClick(worldPoint);
      return;
    }
    // PRIORITY 1.57: ADR-348 — Scale tool click (base point or reference point)
    if (scaleIsActive && handleScaleClick) {
      handleScaleClick(worldPoint);
      return;
    }
    // PRIORITY 1.58: ADR-349 — Stretch / MStretch tool click (base point or displacement)
    if (stretchIsActive && handleStretchClick) {
      handleStretchClick(worldPoint);
      return;
    }
    // PRIORITY 1.59: ADR-350 — Trim tool click (single pick / SHIFT+click = EXTEND)
    if (trimIsActive && handleTrimClick) {
      handleTrimClick(worldPoint, shiftKey);
      return;
    }
    // PRIORITY 1.60: ADR-353 — Extend tool click (single pick / SHIFT+click = TRIM inverse)
    if (extendIsActive && handleExtendClick) {
      handleExtendClick(worldPoint, shiftKey);
      return;
    }
    // PRIORITY 1.61: ADR-363 Phase 5.6 — Wall Split tool click (Revit Split Element)
    if (wallSplitIsActive && handleWallSplitClick) {
      handleWallSplitClick(worldPoint);
      return;
    }
    // PRIORITY 1.62: ADR-363 R1 — BIM Copy tool click (AutoCAD COPY: base + target)
    if (bimCopyIsActive && handleBimCopyClick) {
      handleBimCopyClick(worldPoint);
      return;
    }
    // PRIORITY 1.605: ADR-353 Phase B/C — Array interactive picks
    //   Polar: (a) re-pick center from ribbon, (b) initial center during tool
    //   Path:  (a) re-pick path entity from ribbon, (b) initial pick during tool
    if (handleArrayPolarCenterRepick && handleArrayPolarCenterRepick(worldPoint)) {
      return;
    }
    if (arrayPolarIsActive && handleArrayPolarClick) {
      handleArrayPolarClick(worldPoint);
      return;
    }
    if (handleArrayPathEntityRepick && handleArrayPathEntityRepick()) {
      return;
    }
    if (arrayPathIsActive && handleArrayPathClick) {
      handleArrayPathClick();
      return;
    }
    // PRIORITY 1.6: ADR-189 — Construction guide tools
    // ADR-040 XXII.A: live SSoT read at click time.
    const guideCtx: GuideClickContext = { worldPoint, shiftKey, transform: getImmediateTransform(), levelManager };
    if (handleGuideToolClick(guideCtx, params)) {
      return;
    }
    // PRIORITY 1.7: Auto area measurement — point-in-polygon click
    if (activeTool === 'auto-measure-area') {
      handleAutoAreaClick(worldPoint, params);
      return;
    }
    // PRIORITY 1.9-4: Entity picking tools (angle, circle-ttt, perpendicular, parallel)
    // ADR-040 XXII.A: live SSoT read at click time.
    const entityCtx: EntityPickContext = { worldPoint, transform: getImmediateTransform(), levelManager };
    if (handleAngleEntityPick(entityCtx, angleEntityMeasurement, universalSelection.replaceEntitySelection)) return;
    if (handleCircleTTTPick(entityCtx, circleTTT, activeTool)) return;
    if (handleLinePerpendicularPick(entityCtx, linePerpendicular, activeTool)) return;
    if (handleLineParallelPick(entityCtx, lineParallel, activeTool)) return;
    // ADR-363 — F8 ortho / F10 polar for BIM tools with a placement anchor
    // (wall/stair/beam/slab). No-op for every other tool and for column /
    // opening / slab-opening (no free directional reference). Reads the live
    // toggle from the cadToggleState SSoT mirror and the anchor from the tool's
    // preview store, so the committed point equals the rubber-band preview.
    const bimPoint = applyBimDrawingConstraint(activeTool, worldPoint);
    // PRIORITY 4.5: ADR-358 Phase 5a — Stair tool 2-click placement.
    if (activeTool === 'stair' && stairTool?.isActive) {
      stairTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.6: ADR-363 Phase 1B — Wall tool 2-click placement (continuous).
    // Phase 1J — 'wall-on-entity' shares the same tool; it hit-tests existing 2D
    // geometry so it must receive the RAW worldPoint (ORTHO/POLAR must NOT shift
    // the pick), whereas freehand 'wall' keeps the F8/F10-constrained bimPoint.
    // PRIORITY 4.65: ADR-363 Phase 1K — Wall-in-region (pick 4 lines / click
    // inside / box). Uses the RAW worldPoint (hit-tests existing 2D geometry, so
    // ORTHO/POLAR must NOT shift the pick). Accumulated line picks are reflected
    // as a selection highlight; a commit clears the picks → selection clears.
    if (activeTool === 'wall-in-region' && wallTool?.isActive) {
      wallTool.onCanvasClick(worldPoint);
      universalSelection.replaceEntitySelection(wallTool.getRegionPickIds?.() ?? []);
      return;
    }
    if ((activeTool === 'wall' || activeTool === 'wall-on-entity') && wallTool?.isActive) {
      if (activeTool === 'wall-on-entity') {
        // Click 1 (awaitingStart) picks the source entity; select the hovered
        // entity for highlight + grips. Click 2 (awaitingSide) places the wall →
        // clear the source selection. `isAwaitingStart` is read BEFORE the call
        // (reflects the committed render state at this click boundary).
        const wasPick = wallTool.isAwaitingStart;
        const advanced = wallTool.onCanvasClick(worldPoint);
        if (wasPick) {
          const hoveredId = getHoveredEntity();
          if (advanced && hoveredId) universalSelection.replaceEntitySelection([hoveredId]);
        } else if (advanced) {
          universalSelection.replaceEntitySelection([]);
        }
        return;
      }
      wallTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.7: ADR-363 Phase 3 — Slab tool N-click polygon (Enter to commit).
    if (activeTool === 'slab' && slabTool?.isActive) {
      slabTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.8: ADR-363 Phase 4 — Column tool single-click placement.
    if (activeTool === 'column' && columnTool?.isActive) {
      columnTool.onCanvasClick(worldPoint);
      return;
    }
    // PRIORITY 4.9: ADR-363 Phase 5 — Beam tool 2-click (straight/cantilever) or 3-click (curved).
    if (activeTool === 'beam' && beamTool?.isActive) {
      beamTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.95: ADR-363 Phase 3.7 — Slab-opening tool 2-click (host slab + position).
    if (activeTool === 'slab-opening' && slabOpeningTool?.isActive) {
      slabOpeningTool.onCanvasClick(worldPoint);
      return;
    }
    // PRIORITY 4.96: ADR-363 Phase 2 — Opening tool 2-click (host wall + position along axis).
    if (activeTool === 'opening' && openingTool?.isActive) {
      openingTool.onCanvasClick(worldPoint);
      return;
    }
    // PRIORITY 5: Overlay polygon drawing
    if (overlayMode === 'draw') {
      if (isSavingPolygon) return;
      // Auto-close: click near first point with 3+ points → save.
      // 🚀 PERF (2026-05-09): isNearFirstPoint computed inline at click time
      // (was a reactive prop forcing CanvasSection to re-render on mousemove).
      const isNearFirst = (() => {
        if (draftPolygon.length < 3) return false;
        const [fx, fy] = draftPolygon[0];
        const dx = worldPoint.x - fx;
        const dy = worldPoint.y - fy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // ADR-040 XXII.A: live SSoT read.
        return distance < (POLYGON_TOLERANCES.CLOSE_DETECTION / getImmediateTransform().scale);
      })();
      if (isNearFirst && draftPolygon.length >= 3) {
        setIsSavingPolygon(true);
        finishDrawingWithPolygonRef.current(draftPolygon).then(success => {
          setIsSavingPolygon(false);
          if (success) setDraftPolygon([]);
        });
        return;
      }
      const worldPointArray: [number, number] = [worldPoint.x, worldPoint.y];
      setDraftPolygon(prev => [...prev, worldPointArray]);
      return;
    }
    // PRIORITY 5.5: ADR-344 Phase 6.E/6.F — text / mtext creation tool
    // Both 'text' and 'mtext' open an in-canvas TipTap overlay at the click point.
    if ((activeTool === 'text' || activeTool === 'mtext') && params.onTextToolClick) {
      if (params.onTextToolClick(worldPoint)) return;
    }
    // PRIORITY 6: Unified drawing/measurement tools
    if (isInteractiveTool(activeTool) && drawingHandlersRef.current) {
      drawingHandlersRef.current.onDrawingPoint?.(worldPoint);
      return;
    }
    // PRIORITY 7: Move tool — overlay body hit-test
    if (activeTool === 'move' && !draggingOverlayBody) {
      for (const overlay of currentOverlays) {
        if (!overlay.polygon || overlay.polygon.length < 3) continue;
        const vertices = overlay.polygon.map(([x, y]) => ({ x, y }));
        if (isPointInPolygon(worldPoint, vertices)) {
          handleOverlayClick(overlay.id, worldPoint);
          return;
        }
      }
    }
    // Move tool during drag — skip (drag-end handled by handleContainerMouseUp)
    if (activeTool === 'move' && draggingOverlayBody) {
      return;
    }
    // PRIORITY 8: Clear overlay + grip selection on empty canvas click.
    // DXF entity selection is intentionally preserved — deselect happens only on Escape
    // (AutoCAD / BricsCAD pattern: Escape is the canonical deselect trigger).
    {
      const isClickOnGrip = hoveredVertexInfo !== null || hoveredEdgeInfo !== null;
      const hasSelectedGrip = selectedGrip !== null;
      const justFinishedDrag = justFinishedDragRef.current;
      if (!isClickOnGrip && !hasSelectedGrip && !justFinishedDrag && !entitySelectedOnMouseDownRef.current) {
        universalSelection.clearByType('overlay');
        setSelectedGrips([]);
      }
      entitySelectedOnMouseDownRef.current = false;
    }
  // ADR-040 XXII.A: `transform` removed from deps — SSoT read at event time.
  }, [
    viewportReady, viewport,
    activeTool, overlayMode,
    circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement, dxfGripInteraction,
    stairTool,
    wallTool,
    slabTool,
    columnTool,
    beamTool,
    slabOpeningTool,
    openingTool,
    rotationIsActive, handleRotationClick,
    moveIsActive, handleMoveClick,
    mirrorIsActive, handleMirrorClick,
    scaleIsActive, handleScaleClick,
    stretchIsActive, handleStretchClick,
    trimIsActive, handleTrimClick,
    extendIsActive, handleExtendClick,
    arrayPolarIsActive, handleArrayPolarClick,
    handleArrayPolarCenterRepick,
    arrayPathIsActive, handleArrayPathClick,
    handleArrayPathEntityRepick,
    levelManager,
    draftPolygon, isSavingPolygon,
    finishDrawingWithPolygonRef, drawingHandlersRef, entitySelectedOnMouseDownRef,
    universalSelection,
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrip,
    setSelectedGrips, justFinishedDragRef,
    draggingOverlayBody,
    currentOverlays, handleOverlayClick,
    setDraftPolygon, setIsSavingPolygon,
    params,
  ]);
  return { handleCanvasClick };
}
// ============================================================================
// ROTATION ENTITY SELECTION (PRIORITY 1.3)
// ============================================================================
/**
 * ADR-188: Rotation tool entity selection in awaiting-entity phase.
 * Checks scene entities + overlays for hit. Returns true if entity was selected.
 */
function handleRotationEntitySelection(
  worldPoint: Point2D,
  p: UseCanvasClickHandlerParams,
): boolean {
  const scene = p.levelManager.currentLevelId
    ? p.levelManager.getLevelScene(p.levelManager.currentLevelId)
    : null;
  if (scene?.entities) {
    // ADR-040 XXII.A: live SSoT read (p.transform is dead since Phase XXII.A).
    const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / getImmediateTransform().scale;
    for (const entity of scene.entities) {
      if (testEntityHit(worldPoint, entity, hitTolerance)) {
        p.universalSelection.replaceEntitySelection([entity.id]);
        dlog('useCanvasClickHandler', 'Rotation entity selected:', entity.id);
        return true;
      }
    }
  }
  // Check overlays (colored layers)
  for (const overlay of p.currentOverlays) {
    if (!overlay.polygon || overlay.polygon.length < 3) continue;
    const vertices = overlay.polygon.map(([x, y]) => ({ x, y }));
    if (isPointInPolygon(worldPoint, vertices)) {
      p.universalSelection.handleOverlaySelect(overlay.id);
      dlog('useCanvasClickHandler', 'Rotation overlay selected:', overlay.id);
      return true;
    }
  }
  return false;
}
// ============================================================================
// AUTO AREA CLICK (PRIORITY 1.7)
// ============================================================================
/** Finds smallest closed polygon at worldPoint → writes result to AutoAreaResultStore. */
function handleAutoAreaClick(worldPoint: Point2D, p: UseCanvasClickHandlerParams): void {
  // ADR-040 XXII.A: live SSoT read.
  const liveTransform = getImmediateTransform();
  const screen = CoordinateTransforms.worldToScreen(worldPoint, liveTransform, p.viewport);
  const scene = p.levelManager.currentLevelId
    ? p.levelManager.getLevelScene(p.levelManager.currentLevelId)
    : null;
  const candidates = collectAreaCandidates(worldPoint, scene?.entities ?? [], p.currentOverlays, liveTransform.scale);
  if (candidates.length === 0) {
    setAutoAreaState({ found: false, screenX: screen.x, screenY: screen.y });
    return;
  }
  const best = candidates.reduce((a, b) => a.area < b.area ? a : b);
  const holes = collectHoleAreas(best.polygon, best.area, scene?.entities ?? [], p.currentOverlays, liveTransform.scale);
  const holesArea = holes.reduce((sum, h) => sum + h.area, 0);
  setAutoAreaState({
    found: true,
    area: best.area,
    netArea: best.area - holesArea,
    holesCount: holes.length,
    holesArea,
    perimeter: best.perimeter,
    source: best.source,
    layerName: best.layerName,
    screenX: screen.x,
    screenY: screen.y,
  });
  dlog('handleAutoAreaClick', `area=${best.area.toFixed(2)} netArea=${(best.area - holesArea).toFixed(2)} holes=${holes.length} source=${best.source}`);
}
