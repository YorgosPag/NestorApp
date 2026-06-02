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
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { Point3D } from '../types/bim-base';
import type { BimValidation } from '../types/bim-base';
import type {
  ElectricalPanelGeometry,
  ElectricalPanelParams,
} from '../types/electrical-panel-types';
import { MIN_PANEL_DIMENSION_MM } from '../types/electrical-panel-types';
import { polygonArea, polygonBbox } from '../geometry/shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute `ElectricalPanelGeometry` from `ElectricalPanelParams`. Pure SSoT.
 * Caller MUST ensure positive dimensions (validator guard upstream).
 */
export function computeElectricalPanelGeometry(
  params: ElectricalPanelParams,
): ElectricalPanelGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const local = buildRectangularLocal(params.width, params.length, s);
  const transformed = transformFootprint(local, params);

  const bbox = polygonBbox(transformed);
  const areaCanvas2 = polygonArea(transformed);
  const canvasToM = (1 / s) * MM_TO_M;
  const areaM2 = areaCanvas2 * canvasToM * canvasToM;

  return {
    footprint: { vertices: transformed },
    bbox,
    area: areaM2,
    height: Math.max(0, params.bodyHeightMm),
  };
}

// ─── Local footprint builder ───────────────────────────────────────────────────

function buildRectangularLocal(width: number, length: number, s: number): Point3D[] {
  const hw = (width * s) / 2;
  const hl = (length * s) / 2;
  return [
    { x: -hw, y: -hl, z: 0 },
    { x:  hw, y: -hl, z: 0 },
    { x:  hw, y:  hl, z: 0 },
    { x: -hw, y:  hl, z: 0 },
  ];
}

/**
 * Translate local-frame vertices to world coords (anchor = centre on
 * `position`) and rotate around `position`.
 */
function transformFootprint(
  local: readonly Point3D[],
  params: ElectricalPanelParams,
): Point3D[] {
  const { position } = params;
  const cos = Math.cos(params.rotation * DEG_TO_RAD);
  const sin = Math.sin(params.rotation * DEG_TO_RAD);
  return local.map((v) => {
    const rx = v.x * cos - v.y * sin;
    const ry = v.x * sin + v.y * cos;
    return { x: position.x + rx, y: position.y + ry, z: 0 };
  });
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
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (params.width <= 0) {
    hardErrors.push('electricalPanel.validation.hardErrors.nonPositiveWidth');
  } else if (params.width < MIN_PANEL_DIMENSION_MM) {
    hardErrors.push('electricalPanel.validation.hardErrors.dimensionTooSmall');
  }

  if (params.length <= 0) {
    hardErrors.push('electricalPanel.validation.hardErrors.nonPositiveLength');
  } else if (params.length < MIN_PANEL_DIMENSION_MM) {
    hardErrors.push('electricalPanel.validation.hardErrors.dimensionTooSmall');
  }

  if (params.bodyHeightMm <= 0) {
    hardErrors.push('electricalPanel.validation.hardErrors.nonPositiveBodyHeight');
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
