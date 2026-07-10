/**
 * ADR-408 Εύρος Β #2 — Pure builders for heating boiler entity creation.
 *
 * SSoT:
 *   - IDs via `generateMepBoilerId()` (createMepBoiler factory, N.6).
 *   - Geometry via `computeMepBoilerGeometry()` — pure function.
 *   - Connectors via `buildBoilerConnectors()` — supply + return, derived.
 *   - Validation via `validateMepBoilerParams()` — hardErrors block creation.
 *   - Types via `bim/types/mep-boiler-types.ts`.
 *
 * Single-click flow (mirror of `mep-radiator-completion.ts`):
 *   - User picks the boiler tool.
 *   - Click on canvas → `buildDefaultMepBoilerParams(clickPoint, overrides)`.
 *   - `buildMepBoilerEntity()` validates + builds the entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  DEFAULT_BOILER_BODY_HEIGHT_MM,
  DEFAULT_BOILER_CONNECTOR_DIAMETER_MM,
  DEFAULT_BOILER_LENGTH_MM,
  DEFAULT_BOILER_MOUNTING_ELEVATION_MM,
  DEFAULT_BOILER_WIDTH_MM,
  type MepBoilerEntity,
  type MepBoilerKind,
  type MepBoilerParams,
  type MepBoilerShape,
} from '../../bim/types/mep-boiler-types';
import {
  buildBoilerConnectors,
  computeMepBoilerGeometry,
  validateMepBoilerParams,
} from '../../bim/mep-boilers/mep-boiler-geometry';
import { createMepBoiler } from '@/services/factories/mep-boiler.factory';
import type { SceneUnits } from '../../utils/scene-units';
import type { PlacementBuildResult } from './create-single-click-placement-tool';
import {
  assembleMepApplianceBodyParams,
  buildBimPointEntity,
  resolveBodyPlacement,
  type BodyPlacementParamOverrides,
} from './point-completion-builders';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ───────────────────────────────────

/**
 * Field overrides for `buildDefaultMepBoilerParams`. The ribbon supplies kind /
 * width / length / body height / mounting elevation / rotation / connector diameter
 * / thermal output. Footprint/pose fields are inherited from
 * {@link BodyPlacementParamOverrides}.
 */
export interface MepBoilerParamOverrides extends BodyPlacementParamOverrides {
  readonly kind?: MepBoilerKind;
  readonly shape?: MepBoilerShape;
  /** mm. Supply/return connector diameter. */
  readonly connectorDiameterMm?: number;
  /** W. Catalogue thermal output. */
  readonly thermalOutputW?: number;
}

// ─── Defaults factory ──────────────────────────────────────────────────────────

/**
 * Build `MepBoilerParams` from a clicked point + optional overrides. The two
 * connectors (supply outlet + return inlet) are derived from the resolved params
 * via `buildBoilerConnectors` so a freshly drawn boiler can immediately join a
 * hydronic-supply and a hydronic-return network.
 */
export function buildDefaultMepBoilerParams(
  clickPoint: Readonly<Point2D>,
  overrides: MepBoilerParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): MepBoilerParams {
  const kind: MepBoilerKind = overrides.kind ?? 'wall-boiler';
  const shape: MepBoilerShape = overrides.shape ?? 'rectangular';
  const placement = resolveBodyPlacement(clickPoint, overrides, {
    width: DEFAULT_BOILER_WIDTH_MM,
    length: DEFAULT_BOILER_LENGTH_MM,
    bodyHeightMm: DEFAULT_BOILER_BODY_HEIGHT_MM,
    mountingElevationMm: DEFAULT_BOILER_MOUNTING_ELEVATION_MM,
  });

  const base: MepBoilerParams = assembleMepApplianceBodyParams(kind, shape, placement, sceneUnits, {
    connectorDiameterMm: overrides.connectorDiameterMm ?? DEFAULT_BOILER_CONNECTOR_DIAMETER_MM,
    thermalOutputW: overrides.thermalOutputW,
    material: overrides.material,
  });

  // ADR-408 Εύρος Β — a boiler is a hydronic SOURCE: carry derived supply +
  // return connectors so pipes can snap and join the supply/return networks.
  return { ...base, connectors: buildBoilerConnectors(base) };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildMepBoilerEntityResult = PlacementBuildResult<MepBoilerEntity>;

/**
 * Build a `MepBoilerEntity` from `MepBoilerParams`. Geometry computed via SSoT
 * `computeMepBoilerGeometry()`. Hard errors short-circuit creation.
 */
export function buildMepBoilerEntity(
  params: Readonly<MepBoilerParams>,
  layerId: string,
): BuildMepBoilerEntityResult {
  return buildBimPointEntity(params, layerId, {
    validate: validateMepBoilerParams,
    computeGeometry: computeMepBoilerGeometry,
    createEntity: createMepBoiler,
  });
}
