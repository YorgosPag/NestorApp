/**
 * ADR-406 — Pure builders for MEP fixture entity creation.
 *
 * SSoT:
 *   - IDs via `generateMepFixtureId()` (createMepFixture factory, N.6).
 *   - Geometry via `computeMepFixtureGeometry()` — pure function.
 *   - Validation via `validateMepFixtureParams()` — hardErrors block creation.
 *   - Types via `bim/types/mep-fixture-types.ts`.
 *
 * Single-click flow:
 *   - User picks the MEP fixture tool → shape preselected (default 'rectangular').
 *   - Click on canvas → `buildDefaultMepFixtureParams(clickPoint, overrides)`
 *     resolves position + width + length + body height + mounting elevation.
 *   - `buildMepFixtureEntity()` validates + builds the entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_FIXTURE_BODY_HEIGHT_MM,
  DEFAULT_FIXTURE_DIAMETER_MM,
  DEFAULT_FIXTURE_LENGTH_MM,
  DEFAULT_FIXTURE_MOUNTING_ELEVATION_MM,
  DEFAULT_FIXTURE_WIDTH_MM,
  DEFAULT_FLOOR_DRAIN_BODY_HEIGHT_MM,
  DEFAULT_FLOOR_DRAIN_CONNECTOR_DIAMETER_MM,
  DEFAULT_FLOOR_DRAIN_SIZE_MM,
  DEFAULT_SANITARY_BODY_HEIGHT_MM,
  FLOOR_DRAIN_MOUNTING_ELEVATION_MM,
  SANITARY_MOUNTING_ELEVATION_MM,
  type MepFixtureEntity,
  type MepFixtureKind,
  type MepFixtureParams,
  type MepFixtureShape,
} from '../../bim/types/mep-fixture-types';
import {
  computeMepFixtureGeometry,
  validateMepFixtureParams,
} from '../../bim/mep-fixtures/mep-fixture-geometry';
import {
  buildDefaultLightingConnector,
  buildDefaultPowerConnector,
  buildDefaultDataConnector,
  buildFloorDrainConnector,
  buildAirTerminalSupplyConnector,
  buildAhuSupplyAirConnector,
  buildSprinklerSupplyConnector,
  buildFireRiserSupplyConnector,
  buildGasMeterOutletConnector,
  buildGasCookerSupplyConnector,
} from '../../bim/types/mep-connector-types';
import type { MepConnector } from '../../bim/types/mep-connector-types';
import { buildSanitaryFixtureConnectors } from '../../bim/mep-fixtures/sanitary-fixture-connectors';
import {
  isSocketKind,
  DEFAULT_SOCKET_SIZE_MM,
  DEFAULT_SOCKET_BODY_HEIGHT_MM,
  SOCKET_MOUNTING_ELEVATION_MM,
} from '../../bim/mep-fixtures/socket-symbol-spec';
import {
  isDataOutletKind,
  DEFAULT_DATA_OUTLET_SIZE_MM,
  DEFAULT_DATA_OUTLET_BODY_HEIGHT_MM,
  DATA_OUTLET_MOUNTING_ELEVATION_MM,
} from '../../bim/mep-fixtures/data-outlet-symbol-spec';
import {
  isAirTerminalKind,
  DEFAULT_AIR_TERMINAL_SIZE_MM,
  DEFAULT_AIR_TERMINAL_BODY_HEIGHT_MM,
  AIR_TERMINAL_MOUNTING_ELEVATION_MM,
  DEFAULT_AIR_TERMINAL_DUCT_DIAMETER_MM,
} from '../../bim/mep-fixtures/air-terminal-symbol-spec';
import {
  isAhuKind,
  DEFAULT_AHU_WIDTH_MM,
  DEFAULT_AHU_LENGTH_MM,
  DEFAULT_AHU_BODY_HEIGHT_MM,
  AHU_MOUNTING_ELEVATION_MM,
  DEFAULT_AHU_DUCT_DIAMETER_MM,
} from '../../bim/mep-fixtures/ahu-symbol-spec';
import {
  isSprinklerKind,
  DEFAULT_SPRINKLER_SIZE_MM,
  DEFAULT_SPRINKLER_BODY_HEIGHT_MM,
  SPRINKLER_MOUNTING_ELEVATION_MM,
  DEFAULT_SPRINKLER_PIPE_DIAMETER_MM,
} from '../../bim/mep-fixtures/sprinkler-symbol-spec';
import {
  isFireRiserKind,
  DEFAULT_FIRE_RISER_WIDTH_MM,
  DEFAULT_FIRE_RISER_LENGTH_MM,
  DEFAULT_FIRE_RISER_BODY_HEIGHT_MM,
  FIRE_RISER_MOUNTING_ELEVATION_MM,
  DEFAULT_FIRE_RISER_PIPE_DIAMETER_MM,
} from '../../bim/mep-fixtures/fire-riser-symbol-spec';
import {
  isGasMeterKind,
  DEFAULT_GAS_METER_WIDTH_MM,
  DEFAULT_GAS_METER_LENGTH_MM,
  DEFAULT_GAS_METER_BODY_HEIGHT_MM,
  GAS_METER_MOUNTING_ELEVATION_MM,
  DEFAULT_GAS_METER_FUEL_DIAMETER_MM,
} from '../../bim/mep-fixtures/gas-meter-symbol-spec';
import {
  isGasCookerKind,
  DEFAULT_GAS_COOKER_SIZE_MM,
  DEFAULT_GAS_COOKER_BODY_HEIGHT_MM,
  GAS_COOKER_MOUNTING_ELEVATION_MM,
  DEFAULT_GAS_COOKER_FUEL_DIAMETER_MM,
} from '../../bim/mep-fixtures/gas-cooker-symbol-spec';
import {
  isPlumbingFixtureKind,
  resolvePlumbingFixtureSpec,
} from '../../bim/mep-fixtures/plumbing-fixture-spec';
import { createMepFixture } from '@/services/factories/mep-fixture.factory';
import type { SceneUnits } from '../../utils/scene-units';
import type { PlacementBuildResult } from './create-single-click-placement-tool';
import { buildBimPointEntity } from './point-completion-builders';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides for `buildDefaultMepFixtureParams`. The ribbon (contextual
 * fixture tab) supplies kind / shape / width / length / body height / mounting
 * elevation / rotation / material.
 */
export interface MepFixtureParamOverrides {
  readonly kind?: MepFixtureKind;
  readonly shape?: MepFixtureShape;
  /** mm. Rectangular → width; circular → diameter. */
  readonly width?: number;
  /** mm. Rectangular → length. Ignored when circular. */
  readonly length?: number;
  /** mm. Body thickness. */
  readonly bodyHeightMm?: number;
  /** mm. Mounting elevation above FFL. */
  readonly mountingElevationMm?: number;
  /** Degrees CCW. Ignored when circular. */
  readonly rotation?: number;
  readonly material?: string;
  /** ADR-411 — CC0 mesh asset id (mesh representation when set). */
  readonly assetId?: string;
  /** ADR-411 — uniform mesh scale multiplier. */
  readonly scaleOverride?: number;
}

// ─── Per-kind defaults (footprint + elevation + connector) ───────────────────

interface FixtureKindDefaults {
  readonly shape: MepFixtureShape;
  readonly width: number;
  readonly length: number;
  readonly bodyHeightMm: number;
  readonly mountingElevationMm: number;
  readonly connectors: MepConnector[];
}

/**
 * Resolve the per-kind default footprint / elevation / connector for a fixture.
 *   - floor-drain (ADR-408 Φ14) → square floor-level basin (150×150, FFL=0) + a
 *     single sanitary-drainage outlet so a snapped drain pipe joins the network.
 *   - plumbing fixture (sanitary terminal WC/basin/… ADR-408 Φ14 OR appliance
 *     washing-machine/… ADR-408 Δρόμος B) → authored footprint from the
 *     {@link resolvePlumbingFixtureSpec} SSoT, floor-standing (FFL=0) + a drain
 *     outlet sized by DN + the domestic water-supply inlet(s) it needs.
 *   - light fixture (ADR-406/408 Φ1) → ceiling-relative luminaire + a default
 *     lighting power-in connector (so it can join a circuit once Systems exist).
 */
function resolveFixtureKindDefaults(
  kind: MepFixtureKind,
  overrides: MepFixtureParamOverrides,
  sceneUnits: SceneUnits,
): FixtureKindDefaults {
  if (kind === 'floor-drain') {
    return {
      shape: 'rectangular',
      width: overrides.width ?? DEFAULT_FLOOR_DRAIN_SIZE_MM,
      length: overrides.length ?? DEFAULT_FLOOR_DRAIN_SIZE_MM,
      bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_FLOOR_DRAIN_BODY_HEIGHT_MM,
      mountingElevationMm: overrides.mountingElevationMm ?? FLOOR_DRAIN_MOUNTING_ELEVATION_MM,
      connectors: [buildFloorDrainConnector({ x: 0, y: 0, z: 0 }, DEFAULT_FLOOR_DRAIN_CONNECTOR_DIAMETER_MM)],
    };
  }
  if (isPlumbingFixtureKind(kind)) {
    const spec = resolvePlumbingFixtureSpec(kind);
    return {
      shape: 'rectangular',
      width: overrides.width ?? spec.widthMm,
      length: overrides.length ?? spec.depthMm,
      bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_SANITARY_BODY_HEIGHT_MM,
      mountingElevationMm: overrides.mountingElevationMm ?? SANITARY_MOUNTING_ELEVATION_MM,
      // Revit plumbing fixture (sanitary terminal OR appliance — ADR-408 Δρόμος B):
      // drain outlet + domestic water-supply inlets (SSoT).
      connectors: buildSanitaryFixtureConnectors(kind, sceneUnits),
    };
  }
  // ADR-430 — a socket (πρίζα) is a wall-mounted electrical receptacle: a small
  // square box at ~300mm above FFL + a single `'power'` connector (general outlet),
  // so it joins a 16A socket circuit (not a 10A lighting circuit like a luminaire).
  if (isSocketKind(kind)) {
    return {
      shape: 'rectangular',
      width: overrides.width ?? DEFAULT_SOCKET_SIZE_MM,
      length: overrides.length ?? DEFAULT_SOCKET_SIZE_MM,
      bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_SOCKET_BODY_HEIGHT_MM,
      mountingElevationMm: overrides.mountingElevationMm ?? SOCKET_MOUNTING_ELEVATION_MM,
      connectors: [buildDefaultPowerConnector()],
    };
  }
  // ADR-431 — a data outlet (πρίζα δικτύου / RJ45) is a wall-mounted weak-current
  // receptacle: a small square box at ~300mm above FFL + a single `'data'` connector,
  // so it joins a structured-cabling channel (not a power circuit like a socket).
  if (isDataOutletKind(kind)) {
    return {
      shape: 'rectangular',
      width: overrides.width ?? DEFAULT_DATA_OUTLET_SIZE_MM,
      length: overrides.length ?? DEFAULT_DATA_OUTLET_SIZE_MM,
      bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_DATA_OUTLET_BODY_HEIGHT_MM,
      mountingElevationMm: overrides.mountingElevationMm ?? DATA_OUTLET_MOUNTING_ELEVATION_MM,
      connectors: [buildDefaultDataConnector()],
    };
  }
  // ADR-432 — an air terminal (στόμιο/diffuser) is a ceiling-mounted supply diffuser:
  // a square box at ceiling height + a single supply-air duct INLET, so the HVAC engine
  // routes the supply duct network to it.
  if (isAirTerminalKind(kind)) {
    return {
      shape: 'rectangular',
      width: overrides.width ?? DEFAULT_AIR_TERMINAL_SIZE_MM,
      length: overrides.length ?? DEFAULT_AIR_TERMINAL_SIZE_MM,
      bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_AIR_TERMINAL_BODY_HEIGHT_MM,
      mountingElevationMm: overrides.mountingElevationMm ?? AIR_TERMINAL_MOUNTING_ELEVATION_MM,
      connectors: [buildAirTerminalSupplyConnector({ x: 0, y: 0, z: 0 }, DEFAULT_AIR_TERMINAL_DUCT_DIAMETER_MM)],
    };
  }
  // ADR-432 — an AHU (ΚΚΜ) is the supply-air SOURCE: a plant unit at ceiling-plenum
  // height + a single supply-air duct OUTLET, so the HVAC engine roots the supply duct
  // network at it.
  if (isAhuKind(kind)) {
    return {
      shape: 'rectangular',
      width: overrides.width ?? DEFAULT_AHU_WIDTH_MM,
      length: overrides.length ?? DEFAULT_AHU_LENGTH_MM,
      bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_AHU_BODY_HEIGHT_MM,
      mountingElevationMm: overrides.mountingElevationMm ?? AHU_MOUNTING_ELEVATION_MM,
      connectors: [buildAhuSupplyAirConnector({ x: 0, y: 0, z: 0 }, DEFAULT_AHU_DUCT_DIAMETER_MM)],
    };
  }
  // ADR-433 — a sprinkler head (καταιονητήρας) is a ceiling-mounted fire terminal: a round
  // head at ceiling height + a single fire-sprinkler pipe INLET, so the fire engine routes
  // the wet-pipe network to it.
  if (isSprinklerKind(kind)) {
    return {
      shape: 'circular',
      width: overrides.width ?? DEFAULT_SPRINKLER_SIZE_MM,
      length: overrides.length ?? DEFAULT_SPRINKLER_SIZE_MM,
      bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_SPRINKLER_BODY_HEIGHT_MM,
      mountingElevationMm: overrides.mountingElevationMm ?? SPRINKLER_MOUNTING_ELEVATION_MM,
      connectors: [buildSprinklerSupplyConnector({ x: 0, y: 0, z: 0 }, DEFAULT_SPRINKLER_PIPE_DIAMETER_MM)],
    };
  }
  // ADR-433 — a fire riser (στήλη πυρόσβεσης) is the wet-pipe SOURCE: a riser/valve assembly
  // at ceiling-plenum height + a single fire-sprinkler pipe OUTLET, so the fire engine roots
  // the wet-pipe network at it.
  if (isFireRiserKind(kind)) {
    return {
      shape: 'rectangular',
      width: overrides.width ?? DEFAULT_FIRE_RISER_WIDTH_MM,
      length: overrides.length ?? DEFAULT_FIRE_RISER_LENGTH_MM,
      bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_FIRE_RISER_BODY_HEIGHT_MM,
      mountingElevationMm: overrides.mountingElevationMm ?? FIRE_RISER_MOUNTING_ELEVATION_MM,
      connectors: [buildFireRiserSupplyConnector({ x: 0, y: 0, z: 0 }, DEFAULT_FIRE_RISER_PIPE_DIAMETER_MM)],
    };
  }
  // ADR-434 — a gas meter (μετρητής αερίου) is the fuel-gas SOURCE: a wall-mounted unit + a single
  // fuel-gas OUTLET, so the gas engine roots the fuel network at it.
  if (isGasMeterKind(kind)) {
    return {
      shape: 'rectangular',
      width: overrides.width ?? DEFAULT_GAS_METER_WIDTH_MM,
      length: overrides.length ?? DEFAULT_GAS_METER_LENGTH_MM,
      bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_GAS_METER_BODY_HEIGHT_MM,
      mountingElevationMm: overrides.mountingElevationMm ?? GAS_METER_MOUNTING_ELEVATION_MM,
      connectors: [buildGasMeterOutletConnector({ x: 0, y: 0, z: 0 }, DEFAULT_GAS_METER_FUEL_DIAMETER_MM)],
    };
  }
  // ADR-434 — a gas cooker (εστία αερίου) is a gas TERMINAL: a counter-height hob + a single
  // fuel-gas INLET, so the gas engine routes the fuel network to it (alongside the gas boiler).
  if (isGasCookerKind(kind)) {
    return {
      shape: 'rectangular',
      width: overrides.width ?? DEFAULT_GAS_COOKER_SIZE_MM,
      length: overrides.length ?? DEFAULT_GAS_COOKER_SIZE_MM,
      bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_GAS_COOKER_BODY_HEIGHT_MM,
      mountingElevationMm: overrides.mountingElevationMm ?? GAS_COOKER_MOUNTING_ELEVATION_MM,
      connectors: [buildGasCookerSupplyConnector({ x: 0, y: 0, z: 0 }, DEFAULT_GAS_COOKER_FUEL_DIAMETER_MM)],
    };
  }
  const shape: MepFixtureShape = overrides.shape ?? 'rectangular';
  return {
    shape,
    width: overrides.width ?? (shape === 'circular' ? DEFAULT_FIXTURE_DIAMETER_MM : DEFAULT_FIXTURE_WIDTH_MM),
    length: overrides.length ?? DEFAULT_FIXTURE_LENGTH_MM,
    bodyHeightMm: overrides.bodyHeightMm ?? DEFAULT_FIXTURE_BODY_HEIGHT_MM,
    mountingElevationMm: overrides.mountingElevationMm ?? DEFAULT_FIXTURE_MOUNTING_ELEVATION_MM,
    connectors: [buildDefaultLightingConnector()],
  };
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `MepFixtureParams` from a clicked point + optional overrides. Per-kind
 * footprint / elevation / connector come from {@link resolveFixtureKindDefaults}.
 */
export function buildDefaultMepFixtureParams(
  clickPoint: Readonly<Point2D>,
  overrides: MepFixtureParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): MepFixtureParams {
  const kind: MepFixtureKind = overrides.kind ?? 'light-fixture';
  const d = resolveFixtureKindDefaults(kind, overrides, sceneUnits);
  const rotation = overrides.rotation ?? 0;
  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  return {
    kind,
    shape: d.shape,
    position,
    rotation,
    width: d.width,
    length: d.length,
    bodyHeightMm: d.bodyHeightMm,
    mountingElevationMm: d.mountingElevationMm,
    sceneUnits,
    connectors: d.connectors,
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
    // ADR-411 — optional mesh representation (omitted ⇒ parametric, back-compat).
    ...(overrides.assetId ? { assetId: overrides.assetId } : {}),
    ...(overrides.scaleOverride !== undefined ? { scaleOverride: overrides.scaleOverride } : {}),
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildMepFixtureEntityResult = PlacementBuildResult<MepFixtureEntity>;

/**
 * Build a `MepFixtureEntity` from `MepFixtureParams`. Geometry computed via SSoT
 * `computeMepFixtureGeometry()`. Hard errors short-circuit creation.
 */
export function buildMepFixtureEntity(
  params: Readonly<MepFixtureParams>,
  layerId: string,
): BuildMepFixtureEntityResult {
  return buildBimPointEntity(params, layerId, {
    validate: validateMepFixtureParams,
    computeGeometry: computeMepFixtureGeometry,
    createEntity: createMepFixture,
  });
}
