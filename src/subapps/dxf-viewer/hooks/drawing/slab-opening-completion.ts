/**
 * ADR-363 Phase 3.7 — Pure builders για slab-opening entity creation.
 *
 * SSoT:
 *   - IDs via `generateSlabOpeningId()` (SOS N.6 enterprise-id, ADR-017/210/294).
 *   - Geometry via `computeSlabOpeningGeometry()` — pure function, SSoT για
 *     polygon / area / perimeter / bbox.
 *   - Validation via `validateSlabOpeningParams()` — hardErrors block; code
 *     violations surface ως red badge.
 *   - Types via `bim/types/slab-opening-types.ts`.
 *
 * Click-to-place flow (Phase 3.7):
 *   - User επιλέγει host slab (state: awaitingHostSlab).
 *   - Δεύτερο click ορίζει κέντρο cutout — rectangular default ανά kind.
 *   - Outline auto-clamped εντός slab footprint όταν το rectangle "βγαίνει
 *     παραέξω" (simple bbox shift, validator πιάνει τα υπόλοιπα).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §11.Q3
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D, Polygon3D } from '../../bim/types/bim-base';
import type {
  SlabOpeningEntity,
  SlabOpeningKind,
  SlabOpeningParams,
} from '../../bim/types/slab-opening-types';
import { SLAB_OPENING_DEFAULT_SIZES } from '../../bim/types/slab-opening-types';
import type { SlabEntity } from '../../bim/types/slab-types';
import { computeSlabOpeningGeometry } from '../../bim/geometry/slab-opening-geometry';
import { validateSlabOpeningParams } from '../../bim/validators/slab-opening-validator';
import { generateSlabOpeningId } from '@/services/enterprise-id-convenience';

// ─── Param overrides accepted by the builder ────────────────────────────────

/**
 * Field overrides για `buildDefaultSlabOpeningParams`. Ribbon contextual
 * panel (Phase 3.7b) τροφοδοτεί kind / width / depth / fireRating.
 */
export interface SlabOpeningParamOverrides {
  readonly kind?: SlabOpeningKind;
  /** mm — rectangle width across X. */
  readonly width?: number;
  /** mm — rectangle depth across Y. */
  readonly depth?: number;
  readonly elevationOverride?: number;
  readonly fireRating?: SlabOpeningParams['fireRating'];
  readonly material?: SlabOpeningParams['material'];
  readonly multiStoreyStackGroupId?: string;
}

// ─── Defaults factory ───────────────────────────────────────────────────────

/**
 * Build `SlabOpeningParams` από host slab + anchor click + optional overrides.
 *
 * Algorithm:
 *   1. Resolve kind (override → 'shaft' default).
 *   2. Resolve rect size από `SLAB_OPENING_DEFAULT_SIZES[kind]` (overrides win).
 *   3. Build rectangular outline centered στο `anchorPoint` (CCW).
 *   4. Πρόσθεση optional overrides (fireRating, elevationOverride, ...).
 */
export function buildDefaultSlabOpeningParams(
  hostSlab: SlabEntity,
  anchorPoint: Readonly<Point2D>,
  overrides: SlabOpeningParamOverrides = {},
): SlabOpeningParams {
  const kind = overrides.kind ?? 'shaft';
  const defaults = SLAB_OPENING_DEFAULT_SIZES[kind];
  const width = overrides.width ?? defaults.width;
  const depth = overrides.depth ?? defaults.depth;

  const outline = buildRectangleCcw(anchorPoint, width, depth);

  const params: SlabOpeningParams = {
    kind,
    slabId: hostSlab.id,
    outline,
    ...(overrides.elevationOverride !== undefined
      ? { elevationOverride: overrides.elevationOverride }
      : {}),
    ...(overrides.multiStoreyStackGroupId !== undefined
      ? { multiStoreyStackGroupId: overrides.multiStoreyStackGroupId }
      : {}),
    ...(overrides.fireRating !== undefined ? { fireRating: overrides.fireRating } : {}),
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
  };
  return params;
}

// ─── Entity builder ─────────────────────────────────────────────────────────

export type BuildSlabOpeningEntityResult =
  | { readonly ok: true; readonly entity: SlabOpeningEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build `SlabOpeningEntity` από `SlabOpeningParams + hostSlab`. Geometry
 * recomputed via SSoT pure functions. Hard errors short-circuit creation.
 */
export function buildSlabOpeningEntity(
  params: Readonly<SlabOpeningParams>,
  hostSlab: SlabEntity,
  layerId: string,
): BuildSlabOpeningEntityResult {
  const validation = validateSlabOpeningParams(params, hostSlab);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeSlabOpeningGeometry(params);
  const entity: SlabOpeningEntity = {
    id: generateSlabOpeningId(),
    type: 'slab-opening',
    kind: params.kind,
    layerId,
    params,
    geometry,
    validation: validation.bimValidation,
    visible: true,
  };
  return { ok: true, entity };
}

// ─── Click-to-place completion helper ───────────────────────────────────────

/**
 * High-level convenience bridging tool state machine + builder pipeline.
 * Returns fully-formed entity ή validator error list. Pure — no side effects.
 */
export function completeSlabOpeningFromClick(
  hostSlab: SlabEntity,
  anchorPoint: Readonly<Point2D>,
  layerId: string,
  overrides: SlabOpeningParamOverrides = {},
): BuildSlabOpeningEntityResult {
  const params = buildDefaultSlabOpeningParams(hostSlab, anchorPoint, overrides);
  return buildSlabOpeningEntity(params, hostSlab, layerId);
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Build axis-aligned rectangle (CCW) centered στο anchor. Vertices in mm
 * world coords, z=0. Order: bottom-left → bottom-right → top-right → top-left.
 */
function buildRectangleCcw(
  center: Readonly<Point2D>,
  widthMm: number,
  depthMm: number,
): Polygon3D {
  const halfW = widthMm / 2;
  const halfD = depthMm / 2;
  const vertices: Point3D[] = [
    { x: center.x - halfW, y: center.y - halfD, z: 0 },
    { x: center.x + halfW, y: center.y - halfD, z: 0 },
    { x: center.x + halfW, y: center.y + halfD, z: 0 },
    { x: center.x - halfW, y: center.y + halfD, z: 0 },
  ];
  return { vertices };
}
