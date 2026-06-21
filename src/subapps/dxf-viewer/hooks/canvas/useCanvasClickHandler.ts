// Priority-based canvas click routing. Extracted from CanvasSection.tsx.
// ADR-030 (selection) · ADR-046 (world coords) · ADR-147 (hit tolerance)
'use client';
import { useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { isInteractiveTool } from '../../systems/tools/ToolStateManager';
import { isColumnRegionTool, isWallRegionTool } from '../../systems/tools/region-tool-ids';
import { handleMepPointPlacementClick } from './canvas-click-mep-dispatch';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { dwarn } from '../../debug';
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
import { handleRotationEntitySelection, handleAutoAreaClick, handleOverlayDrawClick } from './canvas-click-tool-handlers';
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
    roofTool,
    floorFinishTool,
    wallCoveringTool,
    columnTool,
    foundationTool,
    beamTool,
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
    wallAttachIsActive = false, handleWallAttachClick,
    bimCopyIsActive = false, handleBimCopyClick,
    arrayPolarIsActive = false, handleArrayPolarClick,
    handleArrayPolarCenterRepick,
    arrayPathIsActive = false, handleArrayPathClick,
    handleArrayPathEntityRepick,
    levelManager,
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
    // PRIORITY 1.615: ADR-401 Phase E.1 — Wall Attach Top/Base pick-host click
    if (wallAttachIsActive && handleWallAttachClick) {
      handleWallAttachClick(worldPoint);
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
    // ADR-508 — pass worldPerPixel (=1/scale) so the wall's face-relative commit
    // applies the SAME zoom-adaptive length step as the preview ghost (WYSIWYG).
    const bimPoint = applyBimDrawingConstraint(
      activeTool,
      worldPoint,
      1 / Math.max(getImmediateTransform().scale, 0.001),
    );
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
    if (
      (isWallRegionTool(activeTool) || activeTool === 'wall-from-perimeter') &&
      wallTool?.isActive
    ) {
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
    // PRIORITY 4.7b: ADR-417 — Roof tool N-click footprint polygon (Enter to commit).
    if (activeTool === 'roof' && roofTool?.isActive) {
      roofTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.7c: ADR-419 — Floor-finish tool N-click covering polygon (Enter to commit).
    if (activeTool === 'floor-finish' && floorFinishTool?.isActive) {
      floorFinishTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.7c-bis: ADR-511 — Wall-covering tool (manual 2-click span OR Slice C room-fill).
    if ((activeTool === 'wall-covering' || activeTool === 'wall-covering-room') && wallCoveringTool?.isActive) {
      wallCoveringTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.7d: ADR-408 Εύρος Β #3 — Underfloor tool N-click heating-area polygon (Enter to commit).
    if (activeTool === 'mep-underfloor' && mepUnderfloorTool?.isActive) {
      mepUnderfloorTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.7e: ADR-422 — Thermal-space tool single click-in-region (Revit «Place Space»).
    if (activeTool === 'thermal-space' && thermalSpaceTool?.isActive) {
      thermalSpaceTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.7f: ADR-437 — Space-separator tool 2-click line placement.
    if (activeTool === 'space-separator' && spaceSeparatorTool?.isActive) {
      spaceSeparatorTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.8: ADR-363 Phase 4 — Column tool single-click placement.
    // Φάση 3 / 3c — 'column-from-perimeter' & 'column-discrete-from-perimeter' share
    // the same tool; click-inside a perimeter builds (RAW worldPoint — hit-tests
    // existing geometry, ORTHO/POLAR must NOT shift the pick).
    // ADR-419 — «Κολώνα σε περιοχή (4 γραμμές)»: ΙΔΙΑ region-detection SSoT με το
    // wall-in-region. RAW worldPoint (hit-tests existing 2D geometry, ORTHO/POLAR
    // must NOT shift the pick). Accumulated line picks reflected ως selection
    // highlight· commit clears them → selection clears.
    if (isColumnRegionTool(activeTool) && columnTool?.isActive) {
      columnTool.onCanvasClick(worldPoint);
      universalSelection.replaceEntitySelection(columnTool.getRegionPickIds?.() ?? []);
      return;
    }
    if (
      (activeTool === 'column' ||
        activeTool === 'column-from-perimeter' ||
        activeTool === 'column-discrete-from-perimeter' ||
        activeTool === 'column-discrete-from-perimeter-walls') &&
      columnTool?.isActive
    ) {
      columnTool.onCanvasClick(worldPoint);
      return;
    }
    // PRIORITY 4.85: ADR-436 Slice 1 — Foundation pad tool single-click placement
    // (mirror column freehand; RAW worldPoint so the anchor point matches the click).
    if (activeTool === 'foundation-pad' && foundationTool?.isActive) {
      foundationTool.onCanvasClick(worldPoint);
      return;
    }
    // PRIORITY 4.86: ADR-436 Slice 2 — Foundation line tools (strip / tie-beam) 2-click.
    // Uses bimPoint (ORTHO/POLAR-snapped) so the axis aligns cleanly, mirror beam.
    if ((activeTool === 'foundation-strip' || activeTool === 'foundation-tie-beam') && foundationTool?.isActive) {
      foundationTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.87: ADR-436 Slice 2 — «Πεδιλοδοκός από τοίχο» 1-click pick of an
    // existing wall. RAW worldPoint (hit-tests geometry — ORTHO must NOT shift),
    // mirror 'beam-from-wall'.
    if (activeTool === 'foundation-strip-from-wall' && foundationTool?.isActive) {
      foundationTool.onCanvasClick(worldPoint);
      return;
    }
    // PRIORITY 4.9: ADR-363 Phase 5 — Beam tool 2-click (straight/cantilever) or 3-click (curved).
    if (activeTool === 'beam' && beamTool?.isActive) {
      beamTool.onCanvasClick(bimPoint);
      return;
    }
    // PRIORITY 4.91: ADR-363 «Δοκάρι από τοίχο» — 1-click pick of an existing
    // wall. Uses the RAW worldPoint (hit-tests existing geometry, so ORTHO/POLAR
    // must NOT shift the pick), mirroring 'wall-on-entity'.
    if (activeTool === 'beam-from-wall' && beamTool?.isActive) {
      beamTool.onCanvasClick(worldPoint);
      return;
    }
    // PRIORITIES 4.92–4.93: MEP fixture / riser / furniture / floorplan-symbol /
    // electrical-panel / manifold / radiator / boiler / water-heater / segment / railing.
    // Extracted to canvas-click-mep-dispatch.ts (SRP split, ADR N.7.1).
    if (handleMepPointPlacementClick(worldPoint, bimPoint, params)) return;
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
    // PRIORITY 5: Overlay polygon drawing (extracted — canvas-click-tool-handlers).
    if (overlayMode === 'draw') {
      handleOverlayDrawClick(worldPoint, params);
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
    roofTool,
    floorFinishTool,
    wallCoveringTool,
    columnTool,
    foundationTool,
    beamTool,
    mepFixtureTool,
    furnitureTool,
    floorplanSymbolTool,
    electricalPanelTool,
    mepManifoldTool,
    mepRadiatorTool,
    mepBoilerTool,
    mepUnderfloorTool,
    thermalSpaceTool,
    spaceSeparatorTool,
    mepSegmentTool,
    mepRiserTool,
    railingTool,
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
    drawingHandlersRef, entitySelectedOnMouseDownRef,
    universalSelection,
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrip,
    setSelectedGrips, justFinishedDragRef,
    draggingOverlayBody,
    currentOverlays, handleOverlayClick,
    params,
  ]);
  return { handleCanvasClick };
}
