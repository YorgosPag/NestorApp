/**
 * ADR-363 SSoT — BIM entity passthrough for the spatial index.
 *
 * All six BIM element types (wall / opening / slab / slab-opening / column / beam)
 * share the same four-field shape: kind + params + geometry + validation.
 * This is the single source of truth for that passthrough — consumed by
 * HitTestingService.convertToEntityModel so BoundsCalculator can index every
 * BIM entity via `geometry.bbox`.
 *
 * Stair is intentionally excluded: it has special geometry-recompute logic
 * (ADR-358 §G6 re-derivable contract) that lives in its own dedicated branch.
 */

import type { BimElementType } from '../types/bim-base';
import type { EntityModel } from '../../rendering/types/Types';
import type { BaseEntity } from '../../types/base-entity';

type BaseModel = Omit<BaseEntity, 'type'> & { readonly type: string };

/** Minimal shape all BIM entities satisfy. */
type BimLike = {
  readonly kind?: unknown;
  readonly params?: unknown;
  readonly geometry?: unknown;
  readonly validation?: unknown;
};

/**
 * Ο τύπος-στόχος του passthrough. ADR-511 — το `wall-covering` ΕΙΝΑΙ BIM στοιχείο
 * (kind + params + geometry, `computeWallCoveringGeometry`) αλλά ΔΕΝ ανήκει στο
 * `BimElementType` (ιστορικό κενό: δεν έχει δικό του kind union στο `BimElementKind`).
 * Το δεχόμαστε ΡΗΤΑ εδώ αντί να το περάσουμε με cast — ο κώδικας λέει την αλήθεια.
 */
export type BimPassthroughType = BimElementType | 'wall-covering';

/**
 * Build an EntityModel for any BIM element type by spreading the four
 * parametric fields on top of the resolved base model.
 */
export function buildBimEntityModel(
  type: BimPassthroughType,
  entity: unknown,
  base: BaseModel,
): EntityModel {
  const bim = entity as BimLike;
  return {
    ...base,
    type,
    kind: bim.kind,
    params: bim.params,
    geometry: bim.geometry,
    validation: bim.validation,
  } as unknown as EntityModel;
}
