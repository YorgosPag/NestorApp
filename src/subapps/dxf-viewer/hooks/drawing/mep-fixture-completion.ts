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
  type MepFixtureEntity,
  type MepFixtureKind,
  type MepFixtureParams,
  type MepFixtureShape,
} from '../../bim/types/mep-fixture-types';
import {
  computeMepFixtureGeometry,
  validateMepFixtureParams,
} from '../../bim/mep-fixtures/mep-fixture-geometry';
import { buildDefaultLightingConnector } from '../../bim/types/mep-connector-types';
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
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `MepFixtureParams` from a clicked point + optional overrides.
 * Circular shape defaults `width` to the downlight diameter (length is ignored).
 */
export function buildDefaultMepFixtureParams(
  clickPoint: Readonly<Point2D>,
  overrides: MepFixtureParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): MepFixtureParams {
  const kind: MepFixtureKind = overrides.kind ?? 'light-fixture';
  const shape: MepFixtureShape = overrides.shape ?? 'rectangular';
  const width = overrides.width ?? (shape === 'circular' ? DEFAULT_FIXTURE_DIAMETER_MM : DEFAULT_FIXTURE_WIDTH_MM);
  const length = overrides.length ?? DEFAULT_FIXTURE_LENGTH_MM;
  const bodyHeightMm = overrides.bodyHeightMm ?? DEFAULT_FIXTURE_BODY_HEIGHT_MM;
  const mountingElevationMm = overrides.mountingElevationMm ?? DEFAULT_FIXTURE_MOUNTING_ELEVATION_MM;
  const rotation = overrides.rotation ?? 0;

  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  return {
    kind,
    shape,
    position,
    rotation,
    width,
    length,
    bodyHeightMm,
    mountingElevationMm,
    sceneUnits,
    // ADR-408 Φ1 — a light fixture is an electrical load: carry a default
    // lighting power-in connector so it can join a circuit (nothing reads it
    // for logic until Φ2+ Systems exist).
    connectors: [buildDefaultLightingConnector()],
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
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
