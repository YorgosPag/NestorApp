// BIM tool click-placement dispatch (priorities 4.5–4.96). SRP split out of
// useCanvasClickHandler.ts (N.7.1) — mirrors the sibling canvas-click-mep-dispatch.ts.
// Returns `true` when the click was consumed so the caller can `return` early.
'use client';
import type { Point2D } from '../../rendering/types/Types';
import type { UseCanvasClickHandlerParams } from './canvas-click-types';
import { isColumnRegionTool, isWallRegionTool } from '../../systems/tools/region-tool-ids';
// ADR-363 Phase 1J — wall-on-entity selects the hovered (picked) source entity.
import { getHoveredEntity } from '../../systems/hover/HoverStore';
// PRIORITIES 4.92–4.93: MEP fixture / riser / furniture / … extracted (SRP split).
import { handleMepPointPlacementClick } from './canvas-click-mep-dispatch';

/**
 * Dispatch a canvas click to the active BIM placement tool (stair / wall / slab / roof /
 * floor-finish / wall-covering / column / foundation / beam / opening / MEP …).
 *
 * @param worldPoint  RAW world-space click (hit-tests existing geometry — ORTHO/POLAR must NOT shift it).
 * @param bimPoint    ORTHO/POLAR-constrained point (freehand placements that want directional snap).
 * @param shiftKey    Modifier (e.g. ADR-528 whole-line beam auto-span).
 * @returns `true` when consumed.
 */
export function dispatchBimToolClick(
  worldPoint: Point2D,
  bimPoint: Point2D,
  shiftKey: boolean,
  params: UseCanvasClickHandlerParams,
): boolean {
  const {
    activeTool,
    stairTool,
    stairRegionTool,
    wallTool,
    slabTool,
    roofTool,
    floorFinishTool,
    wallCoveringTool,
    columnTool,
    foundationTool,
    beamTool,
    beamBetweenMembersTool,
    mepUnderfloorTool,
    thermalSpaceTool,
    bathroomAutoArrangeTool,
    spaceSeparatorTool,
    slabOpeningTool,
    openingTool,
    selfOpeningTool,
    blockLibraryTool,
    universalSelection,
  } = params;

  // PRIORITY 4.5: ADR-358 Phase 5a — Stair tool 2-click placement.
  if (activeTool === 'stair' && stairTool?.isActive) {
    stairTool.onCanvasClick(bimPoint);
    return true;
  }
  // PRIORITY 4.55: ADR-619 — «Σκάλα από περιοχή»: N-click vertex chain (Enter/auto-close
  // to commit → shape classify → auto stair). ΙΔΙΟ engine με το slab/column-from-polygon →
  // bimPoint (ORTHO/POLAR-constrained· οι κορυφές θέλουν directional snap).
  if (activeTool === 'stair-from-region' && stairRegionTool?.isActive) {
    stairRegionTool.onCanvasClick(bimPoint);
    return true;
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
    return true;
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
      return true;
    }
    wallTool.onCanvasClick(bimPoint);
    return true;
  }
  // PRIORITY 4.7: ADR-363 Phase 3 — Slab tool N-click polygon (Enter to commit).
  if (activeTool === 'slab' && slabTool?.isActive) {
    slabTool.onCanvasClick(bimPoint);
    return true;
  }
  // PRIORITY 4.7b: ADR-417 — Roof tool N-click footprint polygon (Enter to commit).
  if (activeTool === 'roof' && roofTool?.isActive) {
    roofTool.onCanvasClick(bimPoint);
    return true;
  }
  // PRIORITY 4.7c: ADR-419 — Floor-finish tool N-click covering polygon (Enter to commit).
  if (activeTool === 'floor-finish' && floorFinishTool?.isActive) {
    floorFinishTool.onCanvasClick(bimPoint);
    return true;
  }
  // PRIORITY 4.7c-bis: ADR-511 — Wall-covering tool (manual 2-click span OR Slice C room-fill).
  if ((activeTool === 'wall-covering' || activeTool === 'wall-covering-room') && wallCoveringTool?.isActive) {
    wallCoveringTool.onCanvasClick(bimPoint);
    return true;
  }
  // PRIORITY 4.7d: ADR-408 Εύρος Β #3 — Underfloor tool N-click heating-area polygon (Enter to commit).
  if (activeTool === 'mep-underfloor' && mepUnderfloorTool?.isActive) {
    mepUnderfloorTool.onCanvasClick(bimPoint);
    return true;
  }
  // PRIORITY 4.7e: ADR-422 — Thermal-space tool single click-in-region (Revit «Place Space»).
  if (activeTool === 'thermal-space' && thermalSpaceTool?.isActive) {
    thermalSpaceTool.onCanvasClick(bimPoint);
    return true;
  }
  // PRIORITY 4.7e-bis: ADR-638 Στάδιο 2b — Bathroom auto-arrange hover→click region-pick.
  // WORLDPOINT — hit-tests existing geometry· ORTHO/POLAR ΔΕΝ πρέπει να μετακινήσει το pick.
  if (activeTool === 'bathroom-auto-arrange' && bathroomAutoArrangeTool?.isActive) {
    bathroomAutoArrangeTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.7f: ADR-437 — Space-separator tool 2-click line placement.
  if (activeTool === 'space-separator' && spaceSeparatorTool?.isActive) {
    spaceSeparatorTool.onCanvasClick(bimPoint);
    return true;
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
    return true;
  }
  // PRIORITY 4.8-poly: ADR-363 §column-polygon-sketch — «Κολώνα από σχεδιασμένο
  // πολύγωνο»: N-click vertex chain (Enter/auto-close to commit). ΙΔΙΟ engine με το
  // slab → bimPoint (ORTHO/POLAR-constrained, οι κορυφές θέλουν directional snap).
  if (activeTool === 'column-from-polygon' && columnTool?.isActive) {
    columnTool.onCanvasClick(bimPoint);
    return true;
  }
  if (
    (activeTool === 'column' ||
      activeTool === 'column-from-perimeter' ||
      activeTool === 'column-discrete-from-perimeter' ||
      activeTool === 'column-discrete-from-perimeter-walls') &&
    columnTool?.isActive
  ) {
    columnTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.85: ADR-436 Slice 1 — Foundation pad tool single-click placement
  // (mirror column freehand; RAW worldPoint so the anchor point matches the click).
  if (activeTool === 'foundation-pad' && foundationTool?.isActive) {
    foundationTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.86: ADR-436 Slice 2 — Foundation line tools (strip / tie-beam) 2-click.
  // Uses bimPoint (ORTHO/POLAR-snapped) so the axis aligns cleanly, mirror beam.
  if ((activeTool === 'foundation-strip' || activeTool === 'foundation-tie-beam') && foundationTool?.isActive) {
    foundationTool.onCanvasClick(bimPoint);
    return true;
  }
  // PRIORITY 4.87: ADR-436 Slice 2 — «Πεδιλοδοκός από τοίχο» 1-click pick of an
  // existing wall. RAW worldPoint (hit-tests geometry — ORTHO must NOT shift),
  // mirror 'beam-from-wall'.
  if (activeTool === 'foundation-strip-from-wall' && foundationTool?.isActive) {
    foundationTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.9: ADR-363 Phase 5 — Beam tool 2-click (straight/cantilever) or 3-click (curved).
  // ADR-528 §whole-line — forward `shiftKey`: Shift+κλικ → auto-span όλης της σειράς συγγραμμικών στηρίξεων.
  if (activeTool === 'beam' && beamTool?.isActive) {
    beamTool.onCanvasClick(bimPoint, shiftKey);
    return true;
  }
  // PRIORITY 4.91: ADR-363 «Δοκάρι από τοίχο» — 1-click pick of an existing
  // wall. Uses the RAW worldPoint (hit-tests existing geometry, so ORTHO/POLAR
  // must NOT shift the pick), mirroring 'wall-on-entity'.
  if (activeTool === 'beam-from-wall' && beamTool?.isActive) {
    beamTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.915: ADR-569 «Δοκάρι ανάμεσα σε μέλη» — κλικ σε υπάρχον μέλος (κολόνα/τοιχίο).
  // RAW worldPoint (hit-tests existing geometry — ORTHO/POLAR must NOT shift the pick).
  if (activeTool === 'beam-between-members' && beamBetweenMembersTool?.isActive) {
    beamBetweenMembersTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.915b: Block Library M1 — re-place a session block with one click (RAW
  // worldPoint· free-point placement, no existing-geometry hit-test, mirror furniture).
  if (activeTool === 'block-library' && blockLibraryTool?.isActive) {
    blockLibraryTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITIES 4.92–4.93: MEP fixture / riser / furniture / floorplan-symbol /
  // electrical-panel / manifold / radiator / boiler / water-heater / segment / railing.
  // Extracted to canvas-click-mep-dispatch.ts (SRP split, ADR N.7.1).
  if (handleMepPointPlacementClick(worldPoint, bimPoint, params)) return true;
  // PRIORITY 4.95: ADR-363 Phase 3.7 — Slab-opening tool 2-click (host slab + position).
  if (activeTool === 'slab-opening' && slabOpeningTool?.isActive) {
    slabOpeningTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.96: ADR-363 Phase 2 — Opening tool 2-click (host wall + position along axis).
  if (activeTool === 'opening' && openingTool?.isActive) {
    openingTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.97: ADR-615 — Free-standing (self-hosted) opening single-click.
  // Uses the RAW worldPoint (hit-tests / snaps to existing 2D DXF lines — ORTHO/POLAR must NOT shift the pick).
  if (activeTool === 'self-opening' && selfOpeningTool?.isActive) {
    selfOpeningTool.onCanvasClick(worldPoint);
    return true;
  }
  return false;
}
