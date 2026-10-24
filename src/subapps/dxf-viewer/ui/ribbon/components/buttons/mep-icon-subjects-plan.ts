/**
 * ADR-444 §Icons — MEP icon subjects DERIVED FROM THE PLAN SYMBOL SSoT (pure, zero React).
 *
 * Every element that has a 2D plan symbol gets its ribbon icon by running the VERY SAME
 * pure drawer on a canonical icon footprint (`iconFootprint`) sized from the element's
 * AUTHORED default dimensions. Change a plan symbol → its ribbon icon follows; there is
 * no second drawing to keep in sync. (Revit / ArchiCAD hand-draw ribbon bitmaps that
 * are unrelated to the annotation symbol the engineer then sees on the sheet.)
 *
 * Connector stubs whose length is a world-scale rule (radiator / water-heater lateral
 * stubs) stay plan-only; the icon shows the body glyph that identifies the element.
 */

import type { PlanarPoint } from '../../../../bim/types/bim-base';
import type { FootprintBasis, SymbolStroke } from '../../../../bim/floorplan-symbols/symbol-vector-helpers';
import { ellipse } from '../../../../bim/floorplan-symbols/symbol-vector-helpers';
import { socketDrawer, DEFAULT_SOCKET_SIZE_MM } from '../../../../bim/mep-fixtures/socket-symbol-spec';
import { dataOutletDrawer, DEFAULT_DATA_OUTLET_SIZE_MM } from '../../../../bim/mep-fixtures/data-outlet-symbol-spec';
import { airTerminalDrawer, DEFAULT_AIR_TERMINAL_SIZE_MM } from '../../../../bim/mep-fixtures/air-terminal-symbol-spec';
import { ahuDrawer, DEFAULT_AHU_WIDTH_MM, DEFAULT_AHU_LENGTH_MM } from '../../../../bim/mep-fixtures/ahu-symbol-spec';
import { sprinklerDrawer, DEFAULT_SPRINKLER_SIZE_MM } from '../../../../bim/mep-fixtures/sprinkler-symbol-spec';
import {
  fireRiserDrawer, DEFAULT_FIRE_RISER_WIDTH_MM, DEFAULT_FIRE_RISER_LENGTH_MM,
} from '../../../../bim/mep-fixtures/fire-riser-symbol-spec';
import {
  gasMeterDrawer, DEFAULT_GAS_METER_WIDTH_MM, DEFAULT_GAS_METER_LENGTH_MM,
} from '../../../../bim/mep-fixtures/gas-meter-symbol-spec';
import { gasCookerDrawer, DEFAULT_GAS_COOKER_SIZE_MM } from '../../../../bim/mep-fixtures/gas-cooker-symbol-spec';
import { buildLuminaireCrossStrokes, buildFloorDrainGridStrokes } from '../../../../bim/mep-fixtures/mep-fixture-symbol';
import { DEFAULT_FIXTURE_DIAMETER_MM, DEFAULT_FLOOR_DRAIN_SIZE_MM } from '../../../../bim/types/mep-fixture-types';
import {
  SANITARY_SPEC, SANITARY_DRAWERS, isSanitaryKind, type SanitaryKind,
} from '../../../../bim/sanitary/sanitary-symbol-spec';
import { APPLIANCE_SPEC, APPLIANCE_DRAWERS, type ApplianceKind } from '../../../../bim/appliances/appliance-symbol-spec';
import { buildBoardStrokes, buildRackStrokes } from '../../../../bim/electrical-panels/electrical-panel-symbol';
import { DEFAULT_PANEL_WIDTH_MM, DEFAULT_PANEL_LENGTH_MM } from '../../../../bim/types/electrical-panel-types';
import { buildFinStrokes } from '../../../../bim/mep-radiators/mep-radiator-symbol';
import { DEFAULT_RADIATOR_WIDTH_MM, DEFAULT_RADIATOR_LENGTH_MM } from '../../../../bim/types/mep-radiator-types';
import { buildDividerStroke, buildFlameStrokes } from '../../../../bim/mep-boilers/mep-boiler-symbol-glyphs';
import { DEFAULT_BOILER_WIDTH_MM, DEFAULT_BOILER_LENGTH_MM } from '../../../../bim/types/mep-boiler-types';
import { buildWaterHeaterTankGlyph } from '../../../../bim/mep-water-heaters/mep-water-heater-symbol';
import { DEFAULT_WATER_HEATER_WIDTH_MM, DEFAULT_WATER_HEATER_LENGTH_MM } from '../../../../bim/types/mep-water-heater-types';
import { buildManifoldStubStrokes, buildDrainageGratingStrokes } from '../../../../bim/mep-manifolds/mep-manifold-symbol';
import {
  DEFAULT_MANIFOLD_WIDTH_MM, DEFAULT_MANIFOLD_LENGTH_MM, DEFAULT_DRAINAGE_COLLECTOR_SIZE_MM,
} from '../../../../bim/types/mep-manifold-types';
import { buildRiserSymbol } from '../../../../bim/mep-segments/mep-riser-symbol';
import {
  iconFootprint, footprintOutline, footprintCentre,
  type IconFootprint, type MepIconGeometry,
} from './mep-icon-geometry';

type Drawer = (fp: FootprintBasis) => SymbolStroke[];

/** Outline + the element's own plan drawer — the generic fixture shape. */
function planFixture(fp: IconFootprint, drawer: Drawer): MepIconGeometry {
  return { body: [footprintOutline(fp), ...drawer(fp)] };
}

/** Same as {@link planFixture} for a `[v0..v3]` corner builder (panel / boiler / …). */
function cornerGlyph(
  fp: IconFootprint,
  build: (v0: PlanarPoint, v1: PlanarPoint, v2: PlanarPoint, v3: PlanarPoint) => readonly SymbolStroke[],
): readonly SymbolStroke[] {
  return build(fp[0], fp[1], fp[2], fp[3]);
}

// ─── Electrical ────────────────────────────────────────────────────────────────

/** Luminaire (IEC 60617): circular body + the ±45° "X" — the plan's circular light. */
export function luminaireIcon(): MepIconGeometry {
  const fp = iconFootprint(DEFAULT_FIXTURE_DIAMETER_MM, DEFAULT_FIXTURE_DIAMETER_MM);
  const centre = footprintCentre(fp);
  const r = (fp[1].x - fp[0].x) / 2;
  return { body: [ellipse(fp, 0.5, 0.5, 0.5, 0.5, 40), ...buildLuminaireCrossStrokes(centre, r)] };
}

export const socketIcon = (): MepIconGeometry =>
  planFixture(iconFootprint(DEFAULT_SOCKET_SIZE_MM, DEFAULT_SOCKET_SIZE_MM), socketDrawer);

export const dataOutletIcon = (): MepIconGeometry =>
  planFixture(iconFootprint(DEFAULT_DATA_OUTLET_SIZE_MM, DEFAULT_DATA_OUTLET_SIZE_MM), dataOutletDrawer);

/** Distribution board: panel body + the breaker-row dividers. */
export function electricalPanelIcon(): MepIconGeometry {
  const fp = iconFootprint(DEFAULT_PANEL_WIDTH_MM, DEFAULT_PANEL_LENGTH_MM);
  return { body: [footprintOutline(fp), ...buildBoardStrokes(fp)] };
}

/** Comms rack = the SAME panel body with the patch-panel glyph (header + port ticks). */
export function commsRackIcon(): MepIconGeometry {
  const fp = iconFootprint(DEFAULT_PANEL_WIDTH_MM, DEFAULT_PANEL_LENGTH_MM);
  const [divider, ...ports] = buildRackStrokes(fp);
  return { body: [footprintOutline(fp), divider], detail: ports };
}

// ─── Water supply + plumbing fixtures ─────────────────────────────────────────

/** Manifold bar + its inlet stub + three branch stubs (plan stub SSoT). */
export function manifoldIcon(): MepIconGeometry {
  const fp = iconFootprint(DEFAULT_MANIFOLD_WIDTH_MM, DEFAULT_MANIFOLD_LENGTH_MM, { x: 14, y: 16 }, 14);
  const stubs = buildManifoldStubStrokes(fp[0], fp[1], fp[2], fp[3], 5, 3);
  return { body: [footprintOutline(fp), ...stubs] };
}

/** A sanitary terminal / appliance at its authored width × depth. */
export function plumbingFixtureIcon(kind: SanitaryKind | ApplianceKind): MepIconGeometry {
  if (isSanitaryKind(kind)) {
    const spec = SANITARY_SPEC[kind];
    return planFixture(iconFootprint(spec.widthMm, spec.depthMm), SANITARY_DRAWERS[kind]);
  }
  const spec = APPLIANCE_SPEC[kind];
  return planFixture(iconFootprint(spec.widthMm, spec.depthMm), APPLIANCE_DRAWERS[kind]);
}

// ─── Drainage ──────────────────────────────────────────────────────────────────

/** Drainage collector (φρεάτιο): body + grating + its inlet/outlet stubs. */
export function drainageCollectorIcon(): MepIconGeometry {
  const size = DEFAULT_DRAINAGE_COLLECTOR_SIZE_MM;
  const fp = iconFootprint(size, size, { x: 14, y: 15 }, 13);
  return {
    body: [footprintOutline(fp), ...buildManifoldStubStrokes(fp[0], fp[1], fp[2], fp[3], 5, 2)],
    detail: cornerGlyph(fp, buildDrainageGratingStrokes),
  };
}

export function floorDrainIcon(): MepIconGeometry {
  const fp = iconFootprint(DEFAULT_FLOOR_DRAIN_SIZE_MM, DEFAULT_FLOOR_DRAIN_SIZE_MM, undefined, 18);
  return { body: [footprintOutline(fp)], detail: cornerGlyph(fp, buildFloorDrainGridStrokes) };
}

/** Drain riser (κατακόρυφη στήλη): circle + end-on "X" + downward flow arrow. */
export function drainRiserIcon(): MepIconGeometry {
  const riser = buildRiserSymbol({ x: 12, y: 8 }, 6, 'down');
  const circleFp = iconFootprint(1, 1, { x: riser.cx, y: riser.cy }, riser.r * 2);
  return { body: [ellipse(circleFp, 0.5, 0.5, 0.5, 0.5, 32), ...riser.strokes] };
}

// ─── Heating ───────────────────────────────────────────────────────────────────

export function radiatorIcon(): MepIconGeometry {
  const fp = iconFootprint(DEFAULT_RADIATOR_WIDTH_MM, DEFAULT_RADIATOR_LENGTH_MM);
  return { body: [footprintOutline(fp)], detail: cornerGlyph(fp, buildFinStrokes) };
}

/** Boiler: cabinet + chamber divider + burner flame (the plan's core body glyph). */
export function boilerIcon(): MepIconGeometry {
  const fp = iconFootprint(DEFAULT_BOILER_WIDTH_MM, DEFAULT_BOILER_LENGTH_MM);
  const [v0, v1, v2, v3] = fp;
  return { body: [footprintOutline(fp), buildDividerStroke(v0, v1, v2, v3), ...buildFlameStrokes(v0, v1, v2, v3)] };
}

export function waterHeaterIcon(): MepIconGeometry {
  const fp = iconFootprint(DEFAULT_WATER_HEATER_WIDTH_MM, DEFAULT_WATER_HEATER_LENGTH_MM);
  return { body: [footprintOutline(fp), ...cornerGlyph(fp, buildWaterHeaterTankGlyph)] };
}

// ─── HVAC + fire + gas ─────────────────────────────────────────────────────────

export const airTerminalIcon = (): MepIconGeometry =>
  planFixture(iconFootprint(DEFAULT_AIR_TERMINAL_SIZE_MM, DEFAULT_AIR_TERMINAL_SIZE_MM), airTerminalDrawer);

export const ahuIcon = (): MepIconGeometry =>
  planFixture(iconFootprint(DEFAULT_AHU_WIDTH_MM, DEFAULT_AHU_LENGTH_MM), ahuDrawer);

export const sprinklerIcon = (): MepIconGeometry =>
  planFixture(iconFootprint(DEFAULT_SPRINKLER_SIZE_MM, DEFAULT_SPRINKLER_SIZE_MM), sprinklerDrawer);

export const fireRiserIcon = (): MepIconGeometry =>
  planFixture(iconFootprint(DEFAULT_FIRE_RISER_WIDTH_MM, DEFAULT_FIRE_RISER_LENGTH_MM), fireRiserDrawer);

export const gasMeterIcon = (): MepIconGeometry =>
  planFixture(iconFootprint(DEFAULT_GAS_METER_WIDTH_MM, DEFAULT_GAS_METER_LENGTH_MM), gasMeterDrawer);

export const gasCookerIcon = (): MepIconGeometry =>
  planFixture(iconFootprint(DEFAULT_GAS_COOKER_SIZE_MM, DEFAULT_GAS_COOKER_SIZE_MM), gasCookerDrawer);
