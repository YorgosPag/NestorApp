/**
 * ADR-408 Εύρος Β #3 — Pure builders for the Underfloor (radiant floor) heating loop.
 *
 * Mirror of `floor-finish-completion.ts` (ADR-419 area entity), specialised for the
 * hydronic loop:
 *   - `buildDefaultMepUnderfloorParams()` wraps the polygon vertices, applies the
 *     serpentine defaults (spacing / clearance / pattern / screed offset / connector
 *     diameter), then seeds the two entry connectors via the `buildUnderfloorConnectors`
 *     SSoT so the persisted `params.connectors` is materialised at creation.
 *   - `buildMepUnderfloorEntity()` validates, computes geometry via
 *     `computeMepUnderfloorGeometry()` (SSoT) and delegates to the
 *     `createMepUnderfloor()` factory (auto-fills id / ifcGuid / ifcType).
 *
 * SSoT: geometry + connectors NEVER hand-authored — derived from `params`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see hooks/drawing/floor-finish-completion.ts — the area-entity template
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type {
  MepUnderfloorEntity,
  MepUnderfloorParams,
  MepUnderfloorPattern,
} from '../../bim/types/mep-underfloor-types';
import {
  DEFAULT_UNDERFLOOR_SPACING_MM,
  DEFAULT_UNDERFLOOR_EDGE_CLEARANCE_MM,
  DEFAULT_UNDERFLOOR_PATTERN,
  DEFAULT_UNDERFLOOR_SCREED_OFFSET_MM,
  DEFAULT_UNDERFLOOR_CONNECTOR_DIAMETER_MM,
  MIN_UNDERFLOOR_VERTICES,
} from '../../bim/types/mep-underfloor-types';
import {
  computeMepUnderfloorGeometry,
  buildUnderfloorConnectors,
  validateMepUnderfloorParams,
} from '../../bim/mep-underfloor/mep-underfloor-geometry';
import { createMepUnderfloor } from '@/services/factories/mep-underfloor.factory';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides for `buildDefaultMepUnderfloorParams`. Ribbon (contextual tab)
 * supplies spacing / clearance / pattern / thermal output / name.
 */
export interface MepUnderfloorParamOverrides {
  /** mm. Centre-to-centre pipe spacing of the serpentine rows. */
  readonly pipeSpacingMm?: number;
  /** mm. Inset from the room walls before the field starts. */
  readonly edgeClearanceMm?: number;
  /** Serpentine layout pattern. */
  readonly patternType?: MepUnderfloorPattern;
  /** Footprint edge index where the supply/return enter. */
  readonly entrySide?: number;
  /** mm. Pipe centreline elevation above storey FFL. */
  readonly screedOffsetMm?: number;
  /** mm. Nominal supply/return connector diameter. */
  readonly connectorDiameterMm?: number;
  /** W. Optional catalogue thermal output. */
  readonly thermalOutputW?: number;
  /** User-supplied label. */
  readonly name?: string;
  /** FK → Floor.id (storey reference). */
  readonly floorId?: string;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `MepUnderfloorParams` from a vertex list + optional overrides. Lifts the 2D
 * vertices to a `Point3D` footprint (z=0, world mm) and seeds the two entry connectors
 * via the `buildUnderfloorConnectors` SSoT. Vertices are in scene units (mm convention).
 */
export function buildDefaultMepUnderfloorParams(
  vertices: readonly Point2D[],
  overrides: MepUnderfloorParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): MepUnderfloorParams {
  const lifted: Point3D[] = vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));

  const base: MepUnderfloorParams = {
    kind: 'hydronic-loop',
    footprint: { vertices: lifted },
    pipeSpacingMm: overrides.pipeSpacingMm ?? DEFAULT_UNDERFLOOR_SPACING_MM,
    edgeClearanceMm: overrides.edgeClearanceMm ?? DEFAULT_UNDERFLOOR_EDGE_CLEARANCE_MM,
    patternType: overrides.patternType ?? DEFAULT_UNDERFLOOR_PATTERN,
    screedOffsetMm: overrides.screedOffsetMm ?? DEFAULT_UNDERFLOOR_SCREED_OFFSET_MM,
    connectorDiameterMm: overrides.connectorDiameterMm ?? DEFAULT_UNDERFLOOR_CONNECTOR_DIAMETER_MM,
    sceneUnits,
    ...(overrides.entrySide !== undefined ? { entrySide: overrides.entrySide } : {}),
    ...(overrides.thermalOutputW !== undefined ? { thermalOutputW: overrides.thermalOutputW } : {}),
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    ...(overrides.floorId !== undefined ? { floorId: overrides.floorId } : {}),
  };

  // Seed the two entry connectors (supply/return) — SSoT, identity host transform.
  return { ...base, connectors: buildUnderfloorConnectors(base) };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildMepUnderfloorEntityResult =
  | { readonly ok: true; readonly entity: MepUnderfloorEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `MepUnderfloorEntity` from `MepUnderfloorParams`. Geometry computed via the
 * SSoT `computeMepUnderfloorGeometry()`. Hard-errors on validation failure (< 3
 * vertices / non-positive or too-small spacing). Final entity assembled via the
 * `createMepUnderfloor()` factory (auto-fills ifcGuid + ifcType='IfcSpaceHeater').
 */
export function buildMepUnderfloorEntity(
  params: Readonly<MepUnderfloorParams>,
  layerId: string,
): BuildMepUnderfloorEntityResult {
  if (params.footprint.vertices.length < MIN_UNDERFLOOR_VERTICES) {
    return { ok: false, hardErrors: ['mepUnderfloor.validation.hardErrors.tooFewVertices'] };
  }
  const validation = validateMepUnderfloorParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeMepUnderfloorGeometry(params);
  const entity = createMepUnderfloor({ params, geometry, layerId, visible: true });
  return { ok: true, entity };
}
