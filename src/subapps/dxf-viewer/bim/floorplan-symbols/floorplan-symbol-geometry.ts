/**
 * Floorplan symbol geometry + validation (ADR-415 Φ1, vertical slice).
 *
 * Pure SSoT functions — derive `FloorplanSymbolGeometry` from
 * `FloorplanSymbolParams` and validate params. Idempotent + side-effect free.
 * Mirrors `furniture-geometry.ts`; the footprint is a centred rectangle
 * (`widthMm` × `depthMm`) with optional plan rotation, built in canvas units
 * (mm × `s`) so it shares the same coordinate space as `params.position`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../types/bim-base';
import type {
  FloorplanSymbolGeometry,
  FloorplanSymbolParams,
} from '../types/floorplan-symbol-types';
import { MIN_FLOORPLAN_SYMBOL_DIMENSION_MM } from '../types/floorplan-symbol-types';
import { computeCentredBoxFootprint } from '../geometry/shared/centred-box-footprint';

/**
 * Compute `FloorplanSymbolGeometry` from `FloorplanSymbolParams`. Pure SSoT.
 * Caller MUST ensure positive dimensions (validator guard upstream). Throws
 * nothing.
 */
export function computeFloorplanSymbolGeometry(
  params: FloorplanSymbolParams,
): FloorplanSymbolGeometry {
  // N.18 — ΕΝΑΣ πυρήνας: ίδιο ερώτημα με έπιπλο/imported-mesh («κεντραρισμένο ορθογώνιο,
  // περιστραμμένο, σε canvas units»). Το docstring από πάνω το έλεγε ήδη — «Mirrors
  // furniture-geometry.ts» — αλλά ο τύπος από κάτω ήταν ΑΝΤΙΓΡΑΜΜΕΝΟΣ, όχι κοινός.
  // ⚠️ Το `height` του SSoT αγνοείται εδώ σκόπιμα: το σύμβολο κάτοψης ΔΕΝ έχει ύψος
  // (ADR-415 — είναι 2Δ σύμβολο), γι' αυτό περνιέται 0 και δεν διαβάζεται πίσω.
  const { footprint, bbox, area } = computeCentredBoxFootprint({
    widthMm: params.widthMm,
    depthMm: params.depthMm,
    heightMm: 0,
    position: params.position,
    rotationDeg: params.rotationDeg,
    sceneUnits: params.sceneUnits,
  });
  return { footprint, bbox, area };
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Result of a validation pass — hard errors non-empty when invalid. */
export interface FloorplanSymbolValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to the entity. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `FloorplanSymbolParams`. Operates purely on params — geometry
 * re-derivable. Hard errors: non-positive / degenerate footprint dimensions, or
 * a missing `assetId`.
 */
export function validateFloorplanSymbolParams(
  params: FloorplanSymbolParams,
): FloorplanSymbolValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (!params.assetId) {
    hardErrors.push('floorplanSymbol.validation.hardErrors.missingAsset');
  }

  for (const dim of [params.widthMm, params.depthMm] as const) {
    if (dim <= 0) {
      hardErrors.push('floorplanSymbol.validation.hardErrors.nonPositiveDimension');
      break;
    }
    if (dim < MIN_FLOORPLAN_SYMBOL_DIMENSION_MM) {
      hardErrors.push('floorplanSymbol.validation.hardErrors.dimensionTooSmall');
      break;
    }
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
