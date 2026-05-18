/**
 * ADR-363 Phase 3 — Pure builders για slab entity creation.
 *
 * SSoT:
 *   - IDs via `generateSlabId()` (N.6 enterprise-id).
 *   - Geometry via `computeSlabGeometry()` — pure function.
 *   - Validation via `validateSlabParams()` — hardErrors block creation.
 *   - Types via `bim/types/slab-types.ts`.
 *
 * Polygon-drawing flow (Phase 3):
 *   - User multi-clicks (Enter ή auto-close near first vertex) → vertex list.
 *   - `buildDefaultSlabParams()` wraps vertices + applies overrides + defaults
 *     (thickness 200mm, kind 'floor', elevation 0 — depends on kind).
 *   - `buildSlabEntity()` validates + builds entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_SLAB_THICKNESS_MM,
  SLAB_KIND_DEFAULT_ELEVATION_MM,
  type SlabEntity,
  type SlabKind,
  type SlabParams,
  type SlabReinforcement,
} from '../../bim/types/slab-types';
import { computeSlabGeometry } from '../../bim/geometry/slab-geometry';
import { validateSlabParams } from '../../bim/validators/slab-validator';
import { generateSlabId } from '@/services/enterprise-id-convenience';

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultSlabParams`. Ribbon (contextual slab tab)
 * supplies kind / thickness / elevation / reinforcement.
 */
export interface SlabParamOverrides {
  readonly kind?: SlabKind;
  /** mm. Πάχος πλάκας. */
  readonly thickness?: number;
  /** mm. z από project origin. */
  readonly elevation?: number;
  readonly reinforcement?: SlabReinforcement;
  readonly material?: string;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `SlabParams` από vertex list + optional overrides.
 *
 * Algorithm:
 *   1. Resolve kind (override → 'floor' default).
 *   2. Resolve thickness (override → DEFAULT_SLAB_THICKNESS_MM).
 *   3. Resolve elevation (override → SLAB_KIND_DEFAULT_ELEVATION_MM[kind]).
 *   4. Lift 2D vertices σε Point3D (z=0).
 *
 * Vertices αναμένονται σε scene units (mm convention — caller responsible
 * για conversion αν χρειάζεται). Δεν κάνει copy/normalize — caller passes
 * defensive copy αν χρειάζεται.
 */
export function buildDefaultSlabParams(
  vertices: readonly Point2D[],
  overrides: SlabParamOverrides = {},
): SlabParams {
  const kind = overrides.kind ?? 'floor';
  const thickness = overrides.thickness ?? DEFAULT_SLAB_THICKNESS_MM;
  const elevation = overrides.elevation ?? SLAB_KIND_DEFAULT_ELEVATION_MM[kind];

  const lifted: Point3D[] = vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));

  const params: SlabParams = {
    kind,
    outline: { vertices: lifted },
    elevation,
    thickness,
    ...(overrides.reinforcement !== undefined ? { reinforcement: overrides.reinforcement } : {}),
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
  };
  return params;
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildSlabEntityResult =
  | { readonly ok: true; readonly entity: SlabEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `SlabEntity` από `SlabParams`. Geometry computed via SSoT
 * `computeSlabGeometry()`. Hard errors short-circuit creation.
 */
export function buildSlabEntity(
  params: Readonly<SlabParams>,
  layerId: string,
): BuildSlabEntityResult {
  const validation = validateSlabParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeSlabGeometry(params);
  const entity: SlabEntity = {
    id: generateSlabId(),
    type: 'slab',
    kind: params.kind,
    layerId,
    params,
    geometry,
    validation: validation.bimValidation,
    visible: true,
  };
  return { ok: true, entity };
}

// ─── Polygon-click completion helper ─────────────────────────────────────────

/**
 * High-level helper που bridges το slab-tool FSM (Phase 3: N-click polygon
 * + Enter ή auto-close) και το builder pipeline. Pure — no side effects.
 *
 * Caller MUST ensure `vertices.length >= 3` (FSM guard upstream) — αλλιώς
 * το validator hard-errors και η `buildSlabEntity` επιστρέφει `ok: false`.
 */
export function completeSlabFromPolygonClicks(
  vertices: readonly Point2D[],
  layerId: string,
  overrides: SlabParamOverrides = {},
): BuildSlabEntityResult {
  const params = buildDefaultSlabParams(vertices, overrides);
  return buildSlabEntity(params, layerId);
}
