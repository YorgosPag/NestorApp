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
  buildFloorDrainConnector,
} from '../../bim/types/mep-connector-types';
import type { MepConnector } from '../../bim/types/mep-connector-types';
import { buildSanitaryFixtureConnectors } from '../../bim/mep-fixtures/sanitary-fixture-connectors';
import {
  isPlumbingFixtureKind,
  resolvePlumbingFixtureSpec,
} from '../../bim/mep-fixtures/plumbing-fixture-spec';
import { createMepFixture } from '@/services/factories/mep-fixture.factory';
import type { SceneUnits } from '../../utils/scene-units';

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

export type BuildMepFixtureEntityResult =
  | { readonly ok: true; readonly entity: MepFixtureEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `MepFixtureEntity` from `MepFixtureParams`. Geometry computed via SSoT
 * `computeMepFixtureGeometry()`. Hard errors short-circuit creation.
 */
export function buildMepFixtureEntity(
  params: Readonly<MepFixtureParams>,
  layerId: string,
): BuildMepFixtureEntityResult {
  const validation = validateMepFixtureParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeMepFixtureGeometry(params);
  const entity = createMepFixture({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}
