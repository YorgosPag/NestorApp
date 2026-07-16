/**
 * Electrical panel geometry + validation (ADR-408 Φ3).
 *
 * Pure SSoT functions — derive `ElectricalPanelGeometry` from
 * `ElectricalPanelParams` and validate params. Idempotent + side-effect free.
 * Mirrors `mep-fixture-geometry.ts`; a panel is a centred rectangular footprint
 * at the mounting plane with an optional plan rotation.
 *
 * Footprint is built in canvas units (mm × `s`) so it shares the same coordinate
 * space as `params.position` (canvas units from the user click) — identical to
 * the fixture / column geometry.
 *
 * The footprint builder, world transform, geometry orchestration, and the
 * validation skeleton are the shared `rectangular-body-geometry.ts` SSoT
 * (ADR-584 dedup) — this file supplies only the panel's own type wiring.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type {
  ElectricalPanelGeometry,
  ElectricalPanelParams,
} from '../types/electrical-panel-types';
import { MIN_PANEL_DIMENSION_MM } from '../types/electrical-panel-types';
import type { BimValidation } from '../types/bim-base';
import {
  computeRectangularBodyGeometry,
  validateRectangularBodyDimensions,
} from '../geometry/shared/rectangular-body-geometry';

/**
 * Compute `ElectricalPanelGeometry` from `ElectricalPanelParams`. Pure SSoT.
 * Caller MUST ensure positive dimensions (validator guard upstream).
 */
export function computeElectricalPanelGeometry(
  params: ElectricalPanelParams,
): ElectricalPanelGeometry {
  return computeRectangularBodyGeometry(params);
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/** Result of a panel validation pass — hard errors non-empty when invalid. */
export interface ElectricalPanelValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to `ElectricalPanelEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `ElectricalPanelParams`. Operates purely on params — geometry
 * re-derivable. Hard errors: non-positive width / length / body height, or a
 * footprint dimension below `MIN_PANEL_DIMENSION_MM` (degenerate placement).
 */
export function validateElectricalPanelParams(
  params: ElectricalPanelParams,
): ElectricalPanelValidationResult {
  return validateRectangularBodyDimensions(
    { width: params.width, length: params.length, bodyHeightMm: params.bodyHeightMm },
    'electricalPanel',
    MIN_PANEL_DIMENSION_MM,
  );
}
