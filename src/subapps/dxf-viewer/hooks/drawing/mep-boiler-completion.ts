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
import type { Point3D } from '../../bim/types/bim-base';
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

export type { SceneUnits };

// ─── Param overrides accepted by the builder ───────────────────────────────────

/**
 * Field overrides for `buildDefaultMepBoilerParams`. The ribbon supplies kind /
 * width / length / body height / mounting elevation / rotation / connector diameter
 * / thermal output.
 */
export interface MepBoilerParamOverrides {
  readonly kind?: MepBoilerKind;
  readonly shape?: MepBoilerShape;
  /** mm. Cabinet width (run along the wall). */
  readonly width?: number;
  /** mm. Cabinet depth. */
  readonly length?: number;
  /** mm. Cabinet vertical height. */
  readonly bodyHeightMm?: number;
  /** mm. Mounting elevation (vertical centre) above FFL. */
  readonly mountingElevationMm?: number;
  /** Degrees CCW. */
  readonly rotation?: number;
  /** mm. Supply/return connector diameter. */
  readonly connectorDiameterMm?: number;
  /** W. Catalogue thermal output. */
  readonly thermalOutputW?: number;
  readonly material?: string;
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
  const width = overrides.width ?? DEFAULT_BOILER_WIDTH_MM;
  const length = overrides.length ?? DEFAULT_BOILER_LENGTH_MM;
  const bodyHeightMm = overrides.bodyHeightMm ?? DEFAULT_BOILER_BODY_HEIGHT_MM;
  const mountingElevationMm = overrides.mountingElevationMm ?? DEFAULT_BOILER_MOUNTING_ELEVATION_MM;
  const rotation = overrides.rotation ?? 0;
  const connectorDiameterMm = overrides.connectorDiameterMm ?? DEFAULT_BOILER_CONNECTOR_DIAMETER_MM;

  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  const base: MepBoilerParams = {
    kind,
    shape,
    position,
    rotation,
    width,
    length,
    bodyHeightMm,
    mountingElevationMm,
    connectorDiameterMm,
    sceneUnits,
    ...(overrides.thermalOutputW !== undefined ? { thermalOutputW: overrides.thermalOutputW } : {}),
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
  };

  // ADR-408 Εύρος Β — a boiler is a hydronic SOURCE: carry derived supply +
  // return connectors so pipes can snap and join the supply/return networks.
  return { ...base, connectors: buildBoilerConnectors(base) };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildMepBoilerEntityResult =
  | { readonly ok: true; readonly entity: MepBoilerEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `MepBoilerEntity` from `MepBoilerParams`. Geometry computed via SSoT
 * `computeMepBoilerGeometry()`. Hard errors short-circuit creation.
 */
export function buildMepBoilerEntity(
  params: Readonly<MepBoilerParams>,
  layerId: string,
): BuildMepBoilerEntityResult {
  const validation = validateMepBoilerParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeMepBoilerGeometry(params);
  const entity = createMepBoiler({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}
