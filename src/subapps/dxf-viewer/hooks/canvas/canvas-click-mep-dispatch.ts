// MEP + fixture + railing point-placement dispatch helpers.
// Extracted from useCanvasClickHandler.ts (SRP split, ADR N.7.1 ≤500 lines).
// Pure dispatch — no hooks, no React state.
//
// ADR-406 (MEP fixture) · ADR-407 (railing) · ADR-408 (MEP tools) · ADR-410 (furniture)
// ADR-415 (floorplan-symbol)
import type { Point2D } from '../../rendering/types/Types';
// ADR-584 / N.18 — fixture tool-kind predicates via the shared barrel (one import).
import {
  plumbingFixtureToolKind, socketFixtureToolKind, dataOutletFixtureToolKind,
  airTerminalFixtureToolKind, ahuFixtureToolKind, sprinklerFixtureToolKind,
  fireRiserFixtureToolKind, gasMeterFixtureToolKind, gasCookerFixtureToolKind,
} from '../../bim/mep-fixtures/fixture-tool-kinds';
import type {
  MepFixtureToolLike,
  MepSegmentToolLike,
  MepManifoldToolLike,
  MepRadiatorToolLike,
  MepBoilerToolLike,
  FurnitureToolLike,
  GenericSolidToolLike,
  FloorplanSymbolToolLike,
  ElectricalPanelToolLike,
  RailingToolLike,
} from './canvas-click-tool-types';

// Minimal slice of UseCanvasClickHandlerParams needed for this dispatch block.
export interface MepDispatchParams {
  activeTool: string;
  mepFixtureTool?: MepFixtureToolLike;
  mepRiserTool?: { readonly isActive: boolean; onCanvasClick(point: Readonly<Point2D>): boolean };
  furnitureTool?: FurnitureToolLike;
  genericSolidTool?: GenericSolidToolLike;
  floorplanSymbolTool?: FloorplanSymbolToolLike;
  electricalPanelTool?: ElectricalPanelToolLike;
  mepManifoldTool?: MepManifoldToolLike;
  mepRadiatorTool?: MepRadiatorToolLike;
  mepBoilerTool?: MepBoilerToolLike;
  mepWaterHeaterTool?: MepBoilerToolLike;
  mepSegmentTool?: MepSegmentToolLike;
  railingTool?: RailingToolLike;
}

/**
 * Handles MEP fixture + single-click BIM point-placement tools (priorities 4.92–4.93).
 * Returns `true` when the click was consumed so the caller can `return` early.
 *
 * @param worldPoint  Raw world-space click position (no ORTHO/POLAR — free-point placement).
 * @param bimPoint    ORTHO/POLAR-constrained point (used only for segment/railing tools).
 */
export function handleMepPointPlacementClick(
  worldPoint: Point2D,
  bimPoint: Point2D,
  params: MepDispatchParams,
): boolean {
  const {
    activeTool,
    mepFixtureTool,
    mepRiserTool,
    furnitureTool,
    genericSolidTool,
    floorplanSymbolTool,
    electricalPanelTool,
    mepManifoldTool,
    mepRadiatorTool,
    mepBoilerTool,
    mepWaterHeaterTool,
    mepSegmentTool,
    railingTool,
  } = params;

  // PRIORITY 4.92: ADR-406 — MEP fixture tool single-click placement (RAW
  // worldPoint; free-point placement, no existing-geometry hit-test).
  // ADR-408 Φ14 / Δρόμος B — the floor drain (σιφώνι), the five sanitary terminals
  // (mep-wc/…) AND the appliances (mep-washing-machine/…) share the fixture tool
  // with the light fixture; all route here (the active tool id drives the kind preset).
  if (
    (activeTool === 'mep-fixture' ||
      activeTool === 'mep-floor-drain' ||
      plumbingFixtureToolKind(activeTool) !== null ||
      socketFixtureToolKind(activeTool) !== null ||
      dataOutletFixtureToolKind(activeTool) !== null ||
      airTerminalFixtureToolKind(activeTool) !== null ||
      ahuFixtureToolKind(activeTool) !== null ||
      sprinklerFixtureToolKind(activeTool) !== null ||
      fireRiserFixtureToolKind(activeTool) !== null ||
      gasMeterFixtureToolKind(activeTool) !== null ||
      gasCookerFixtureToolKind(activeTool) !== null) &&
    mepFixtureTool?.isActive
  ) {
    mepFixtureTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.92-bis: ADR-408 Φ15 — MEP riser (vertical drain stack) single-click
  // placement (RAW worldPoint; free-point, no existing-geometry hit-test).
  if (activeTool === 'mep-drain-riser' && mepRiserTool?.isActive) {
    mepRiserTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.92a: ADR-410 — Furniture tool single-click placement (RAW
  // worldPoint; free-point placement, no existing-geometry hit-test).
  if (activeTool === 'furniture' && furnitureTool?.isActive) {
    furnitureTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.92a-ter: ADR-684 — Generic-solid tool single-click placement (RAW
  // worldPoint; free-point placement, no existing-geometry hit-test).
  if (activeTool === 'generic-solid' && genericSolidTool?.isActive) {
    genericSolidTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.92a-bis: ADR-415 — Floorplan-symbol tool single-click placement
  // (RAW worldPoint; free-point placement, no existing-geometry hit-test).
  if (activeTool === 'floorplan-symbol' && floorplanSymbolTool?.isActive) {
    floorplanSymbolTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.92b: ADR-408 Φ3 — Electrical panel tool single-click placement
  // (RAW worldPoint; free-point placement, no existing-geometry hit-test).
  if (activeTool === 'electrical-panel' && electricalPanelTool?.isActive) {
    electricalPanelTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.92b': ADR-408 Φ12 — Plumbing manifold tool single-click placement
  // (RAW worldPoint; free-point placement, no existing-geometry hit-test).
  if (
    (activeTool === 'mep-manifold' || activeTool === 'mep-drainage-collector') &&
    mepManifoldTool?.isActive
  ) {
    mepManifoldTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.92b'': ADR-408 Εύρος Β — heating radiator tool single-click placement
  // (RAW worldPoint; free-point placement, no existing-geometry hit-test).
  if (activeTool === 'mep-radiator' && mepRadiatorTool?.isActive) {
    mepRadiatorTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.92b''': ADR-408 Εύρος Β #2 — heating boiler tool single-click placement
  // (RAW worldPoint; free-point placement, no existing-geometry hit-test).
  if (activeTool === 'mep-boiler' && mepBoilerTool?.isActive) {
    mepBoilerTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.92b'''': ADR-408 DHW — domestic water heater tool single-click placement
  // (RAW worldPoint; free-point placement, no existing-geometry hit-test).
  if (activeTool === 'mep-water-heater' && mepWaterHeaterTool?.isActive) {
    mepWaterHeaterTool.onCanvasClick(worldPoint);
    return true;
  }
  // PRIORITY 4.92c: ADR-408 Φ8 — duct/pipe MEP segment 2-click run. Uses the
  // ORTHO/POLAR-aware `bimPoint` (like beam/railing) so the run snaps to
  // axis-locked angles during the 2-click chain.
  if (
    (activeTool === 'mep-duct' ||
      activeTool === 'mep-pipe' ||
      activeTool === 'mep-drain-pipe') &&
    mepSegmentTool?.isActive
  ) {
    // ADR-408 Φ-B1 — connector-mate: when the click snapped to an MEP connector
    // (carries a 3D `z`), use the EXACT snapped point so the endpoint lands on the
    // connector — the snap overrides ORTHO/POLAR (which would shift x,y off it).
    // Otherwise the ORTHO/POLAR-constrained `bimPoint` drives free 2-click drawing.
    const connectorZ = (worldPoint as { z?: number }).z;
    mepSegmentTool.onCanvasClick(connectorZ !== undefined ? worldPoint : bimPoint);
    return true;
  }
  // PRIORITY 4.93: ADR-407 — Railing tool 2-click straight guardrail. Uses the
  // ORTHO/POLAR-aware `bimPoint` (like the beam tool) so the path snaps to
  // axis-locked angles during the 2-click chain.
  if (activeTool === 'railing' && railingTool?.isActive) {
    railingTool.onCanvasClick(bimPoint);
    return true;
  }
  return false;
}
