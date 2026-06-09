/**
 * ADR-408 Φ3 — Pure builders for electrical panel entity creation.
 *
 * SSoT:
 *   - IDs via `generateElectricalPanelId()` (createElectricalPanel factory, N.6).
 *   - Geometry via `computeElectricalPanelGeometry()` — pure function.
 *   - Validation via `validateElectricalPanelParams()` — hardErrors block creation.
 *   - Types via `bim/types/electrical-panel-types.ts`.
 *
 * Single-click flow (mirror of `mep-fixture-completion.ts`):
 *   - User picks the electrical panel tool.
 *   - Click on canvas → `buildDefaultElectricalPanelParams(clickPoint, overrides)`
 *     resolves position + width + length + body height + mounting elevation.
 *   - `buildElectricalPanelEntity()` validates + builds the entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_PANEL_BODY_HEIGHT_MM,
  DEFAULT_PANEL_LENGTH_MM,
  DEFAULT_PANEL_MOUNTING_ELEVATION_MM,
  DEFAULT_PANEL_WIDTH_MM,
  type ElectricalPanelEntity,
  type ElectricalPanelKind,
  type ElectricalPanelParams,
  type ElectricalPanelShape,
} from '../../bim/types/electrical-panel-types';
import {
  computeElectricalPanelGeometry,
  validateElectricalPanelParams,
} from '../../bim/electrical-panels/electrical-panel-geometry';
import {
  buildDefaultPanelOutgoingConnector,
  buildDefaultCommsRackOutgoingConnector,
} from '../../bim/types/mep-connector-types';
import { createElectricalPanel } from '@/services/factories/electrical-panel.factory';
import type { SceneUnits } from '../../utils/scene-units';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ───────────────────────────────────

/**
 * Field overrides for `buildDefaultElectricalPanelParams`. The ribbon supplies
 * kind / width / length / body height / mounting elevation / rotation / material.
 */
export interface ElectricalPanelParamOverrides {
  readonly kind?: ElectricalPanelKind;
  readonly shape?: ElectricalPanelShape;
  /** mm. Footprint width. */
  readonly width?: number;
  /** mm. Footprint length (depth). */
  readonly length?: number;
  /** mm. Body height. */
  readonly bodyHeightMm?: number;
  /** mm. Mounting elevation (vertical centre) above FFL. */
  readonly mountingElevationMm?: number;
  /** Degrees CCW. */
  readonly rotation?: number;
  readonly material?: string;
}

// ─── Defaults factory ──────────────────────────────────────────────────────────

/**
 * Build `ElectricalPanelParams` from a clicked point + optional overrides.
 */
export function buildDefaultElectricalPanelParams(
  clickPoint: Readonly<Point2D>,
  overrides: ElectricalPanelParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): ElectricalPanelParams {
  const kind: ElectricalPanelKind = overrides.kind ?? 'distribution-board';
  const shape: ElectricalPanelShape = overrides.shape ?? 'rectangular';
  const width = overrides.width ?? DEFAULT_PANEL_WIDTH_MM;
  const length = overrides.length ?? DEFAULT_PANEL_LENGTH_MM;
  const bodyHeightMm = overrides.bodyHeightMm ?? DEFAULT_PANEL_BODY_HEIGHT_MM;
  const mountingElevationMm = overrides.mountingElevationMm ?? DEFAULT_PANEL_MOUNTING_ELEVATION_MM;
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
    // ADR-408/431 — a panel is a circuit SOURCE: carry a default out connector so a
    // MepSystem can reference it as sourceEntityId/sourceConnectorId. A comms-rack
    // sources weak-current channels → `'data'` out connector; a distribution-board
    // sources power circuits → `'power'` out connector (kind-aware).
    connectors: [
      kind === 'comms-rack'
        ? buildDefaultCommsRackOutgoingConnector()
        : buildDefaultPanelOutgoingConnector(),
    ],
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildElectricalPanelEntityResult =
  | { readonly ok: true; readonly entity: ElectricalPanelEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build an `ElectricalPanelEntity` from `ElectricalPanelParams`. Geometry
 * computed via SSoT `computeElectricalPanelGeometry()`. Hard errors short-circuit
 * creation.
 */
export function buildElectricalPanelEntity(
  params: Readonly<ElectricalPanelParams>,
  layerId: string,
): BuildElectricalPanelEntityResult {
  const validation = validateElectricalPanelParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeElectricalPanelGeometry(params);
  const entity = createElectricalPanel({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}
