// Priority-based canvas click routing. Extracted from CanvasSection.tsx.
// ADR-030 (selection) · ADR-046 (world coords) · ADR-147 (hit tolerance)
'use client';
import { useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { isInteractiveTool } from '../../systems/tools/ToolStateManager';
// PRIORITIES 4.5–4.96: BIM tool click-placement dispatch (SRP split, N.7.1).
import { dispatchBimToolClick } from './canvas-click-bim-dispatch';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { dwarn } from '../../debug';
import { PolygonCropStore } from '../../systems/lasso/LassoCropStore';
// ADR-040 Phase XXII.A — transform reads from SSoT (orchestrator-decoupling).
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
// ADR-363 — apply F8 ortho / F10 polar to BIM tool clicks (wall/stair/beam/slab)
// using their preview-store anchor, so the committed point matches the preview.
import { applyBimDrawingConstraint } from '../drawing/bim-ortho-reference';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
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
import { handleRotationEntitySelection, handleAutoAreaClick, handleHatchPickPointClick, handleOverlayDrawClick } from './canvas-click-tool-handlers';
// ADR-507 Φ3 — pick-mode SSoT (Τρόπος Α boundary ⇄ Τρόπος Β pick-point).
import { isHatchPickPointActive } from '../../bim/hatch/hatch-pick-mode-store';
// ADR-507 — armed «Επιλογή γραμμοσκίασης»: hatch-only pick (even-odd SSoT, world-coords).
import { isHatchSelectArmed, runArmedHatchPick } from '../../bim/hatch/hatch-select-mode-store';
// ADR-563 Φ4-Α — interactive cut-line dimension: advance the 3-click FSM + commit.
import { advanceCutlineClick } from '../../systems/dimensions/auto/run-cutline-dimension';
import type { Entity } from '../../types/entities';
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
    beamBetweenMembersTool,
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
    wallMergeIsActive = false, handleWallMergeClick,
    wallGapOpeningIsActive = false, handleWallGapOpeningClick,
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
    // PRIORITY 0.6: ADR-507 — armed «Επιλογή γραμμοσκίασης» (one-shot). Tool-agnostic
    // intercept ΑΚΡΙΒΩΣ ΠΡΙΝ τη δημιουργία pick-point (PRIORITY 1.75) → επιλέγει την
    // υφιστάμενη γραμμοσκίαση αντί να σχεδιάσει νέα. Reuse: even-odd SSoT (`pickTopHatchAt`,
    // ίδιο με το hover-highlight) + `replaceEntitySelection`. Consume + disarm.
    if (isHatchSelectArmed()) {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;
      // Pick→select→finalize μέσω του ΚΟΙΝΟΥ `runArmedHatchPick` SSoT (ίδιο με το
      // mouse-handler-up). Επιτυχία → replace-selection + disarm + έξοδος tool· αστοχία
      // → μένει armed. Πάντα consume.
      runArmedHatchPick(
        worldPoint,
        (scene?.entities ?? []) as unknown as Entity[],
        (ids) => universalSelection.replaceEntitySelection(ids),
      );
      return; // πάντα consume — ΠΟΤΕ δημιουργία pick-point όσο armed
    }
    // PRIORITY 0.65: ADR-449 PART B Slice C — «Βαφή σοβά» 2D paintbrush. Όσο το εργαλείο
    // 'finish-paint' είναι ενεργό, ένα κλικ σε όψη σοβά τη βάφει με το τρέχον πινέλο
    // (CanvasSection `useFinishPaintClick` → κοινός apply SSoT). Το εργαλείο είναι category
    // 'drawing' → το mouse-up ΗΔΗ skip-άρει την επιλογή entity· εδώ consume-άρουμε ΠΑΝΤΑ το
    // κλικ (πριν grips/drawing/selection) ώστε το paintbrush να μένει armed για πολλές όψεις.
    if (activeTool === 'finish-paint') {
      params.onFinishPaintClick?.(worldPoint);
      return; // πάντα consume όσο το paintbrush είναι ενεργό
    }
    // PRIORITY 0.66: ADR-563 Φ4-Α — «Γραμμή τομής» interactive dimensioning. Η
    // 3-click FSM (αρχή/τέλος/τοποθέτηση) ζει σε zero-React store· ο κεντρικός
    // dispatcher έχει τον `levelManager` (SceneAppendAccessor) για το undoable
    // batch commit στο 3ο κλικ. Το `worldPoint` είναι ΗΔΗ snapped (κεντρικό
    // findSnapPoint στο mouse-up). Πάντα consume όσο το εργαλείο είναι ενεργό.
    if (activeTool === 'auto-dim-cutline') {
      advanceCutlineClick(worldPoint, levelManager);
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
    // PRIORITY 1.617: ADR-566 — Wall Merge tool click (pick wall 1 → wall 2)
    if (wallMergeIsActive && handleWallMergeClick) {
      handleWallMergeClick(worldPoint);
      return;
    }
    // PRIORITY 1.618: ADR-568 — Wall gap-bridge + opening click (pick wall 1 → wall 2)
    if (wallGapOpeningIsActive && handleWallGapOpeningClick) {
      handleWallGapOpeningClick(worldPoint);
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
    // PRIORITY 1.75: ADR-507 Φ3 — Hatch pick-point (Τρόπος Β). ΕΝΑ κλικ μέσα σε
    // περιοχή → auto boundary + νησιά → HatchEntity. Καταναλώνει το κλικ ώστε να
    // ΜΗΝ μπει στο unified drawing (boundary accumulation = Τρόπος Α).
    if (isHatchPickPointActive(activeTool)) {
      handleHatchPickPointClick(worldPoint, params);
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
      worldPerPixel(getImmediateTransform().scale),
    );
    // PRIORITIES 4.5–4.96: BIM tool click-placement dispatch (stair / wall / slab /
    // roof / floor-finish / wall-covering / column / foundation / beam / opening /
    // MEP …). Extracted to canvas-click-bim-dispatch.ts (SRP split, N.7.1). Consumes
    // the click (returns true) exactly as the inline block did.
    if (dispatchBimToolClick(worldPoint, bimPoint, shiftKey, params)) return;
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
    beamBetweenMembersTool,
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
