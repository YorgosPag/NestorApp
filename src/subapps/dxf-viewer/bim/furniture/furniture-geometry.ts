/**
 * Furniture geometry + validation (ADR-410, vertical slice).
 *
 * Pure SSoT functions — derive `FurnitureGeometry` from `FurnitureParams` and
 * validate params. Idempotent + side-effect free. Mirrors the mep-fixture
 * geometry split; a furniture footprint is a centred rectangle (`widthMm` ×
 * `depthMm`) at the mounting plane, with optional plan rotation.
 *
 * Footprint is built in canvas units (mm × `s`) so it shares the same coordinate
 * space as `params.position` (canvas units from the user click).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../types/bim-base';
import type { FurnitureGeometry, FurnitureParams } from '../types/furniture-types';
import { MIN_FURNITURE_DIMENSION_MM } from '../types/furniture-types';
import { computeCentredBoxFootprint } from '../geometry/shared/centred-box-footprint';

/**
 * Compute `FurnitureGeometry` from `FurnitureParams`. Pure SSoT. Caller MUST
 * ensure positive dimensions (validator guard upstream). Throws nothing.
 *
 * ADR-683 Φ3: ο μετασχηματισμός ίχνους ζει πλέον στο `computeCentredBoxFootprint`
 * — κοινός με το `imported-mesh`, ώστε τα δύο να μην αποκλίνουν ποτέ (N.18).
 */
export function computeFurnitureGeometry(params: FurnitureParams): FurnitureGeometry {
  return computeCentredBoxFootprint({
    widthMm: params.widthMm,
    depthMm: params.depthMm,
    heightMm: params.heightMm,
    position: params.position,
    rotationDeg: params.rotationDeg,
    sceneUnits: params.sceneUnits,
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Result of a furniture validation pass — hard errors non-empty when invalid. */
export interface FurnitureValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to `FurnitureEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `FurnitureParams`. Operates purely on params — geometry re-derivable.
 * Hard errors: non-positive / degenerate footprint dimensions, or a missing
 * `assetId` (cannot resolve the mesh).
 */
export function validateFurnitureParams(params: FurnitureParams): FurnitureValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (!params.assetId) {
    hardErrors.push('furniture.validation.hardErrors.missingAsset');
  }

  for (const dim of [params.widthMm, params.depthMm] as const) {
    if (dim <= 0) {
      hardErrors.push('furniture.validation.hardErrors.nonPositiveDimension');
      break;
    }
    if (dim < MIN_FURNITURE_DIMENSION_MM) {
      hardErrors.push('furniture.validation.hardErrors.dimensionTooSmall');
      break;
    }
  }

  if (params.heightMm <= 0) {
    hardErrors.push('furniture.validation.hardErrors.nonPositiveHeight');
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
