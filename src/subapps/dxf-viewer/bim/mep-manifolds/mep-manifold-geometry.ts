/**
 * Plumbing manifold geometry + validation + connector layout (ADR-408 Φ12).
 *
 * Pure SSoT functions — derive `MepManifoldGeometry` from `MepManifoldParams`,
 * validate params, and lay out the inlet + N outlet connectors. Idempotent +
 * side-effect free. Mirrors `electrical-panel-geometry.ts`; a manifold is a
 * centred rectangular bar footprint at the mounting plane with an optional plan
 * rotation.
 *
 * Footprint + connector local positions are built in canvas units (mm × `s`) so
 * they share the same coordinate space as `params.position` — identical to the
 * panel / fixture geometry. Connector `localPosition` is therefore consumed
 * directly by `connectorWorldPosition` (which translates without re-scaling).
 *
 * The footprint builder, world transform, geometry orchestration, and the
 * validation skeleton are the shared `rectangular-body-geometry.ts` SSoT
 * (ADR-584 dedup) — this file supplies only the manifold's own connector
 * layout + the extra outlet-count hard error.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import type { BimValidation, Point3D } from '../types/bim-base';
import type {
  MepManifoldGeometry,
  MepManifoldParams,
} from '../types/mep-manifold-types';
import {
  MAX_MANIFOLD_OUTLET_COUNT,
  MIN_MANIFOLD_DIMENSION_MM,
  MIN_MANIFOLD_OUTLET_COUNT,
} from '../types/mep-manifold-types';
import type { MepConnector } from '../types/mep-connector-types';
import {
  buildManifoldInletConnector,
  buildManifoldOutletConnector,
  buildManifoldBranchInletConnector,
} from '../types/mep-connector-types';
import { isDrainageCollectorKind } from '../types/mep-manifold-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  computeRectangularBodyGeometry,
  validateRectangularBodyDimensions,
} from '../geometry/shared/rectangular-body-geometry';

/**
 * Compute `MepManifoldGeometry` from `MepManifoldParams`. Pure SSoT.
 * Caller MUST ensure positive dimensions (validator guard upstream).
 */
export function computeMepManifoldGeometry(
  params: MepManifoldParams,
): MepManifoldGeometry {
  return computeRectangularBodyGeometry(params);
}

// ─── Connector layout (pure SSoT) ──────────────────────────────────────────────

/** Clamp the requested outlet count to the supported range. */
export function clampOutletCount(n: number): number {
  if (!Number.isFinite(n)) return MIN_MANIFOLD_OUTLET_COUNT;
  return Math.max(MIN_MANIFOLD_OUTLET_COUNT, Math.min(MAX_MANIFOLD_OUTLET_COUNT, Math.round(n)));
}

/**
 * Host-local connector offsets (scene units, pre-rotation). The bar runs along
 * local X (width). The inlet sits at the −X short end on the centreline; the
 * outlets are evenly distributed along the +Y (front) edge across the bar width.
 */
function manifoldConnectorLocalPositions(params: MepManifoldParams): {
  readonly inlet: Point3D;
  readonly outlets: readonly Point3D[];
} {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const hw = (params.width * s) / 2;
  const hl = (params.length * s) / 2;
  const count = clampOutletCount(params.outletCount);

  const inlet: Point3D = { x: -hw, y: 0, z: 0 };

  const outlets: Point3D[] = Array.from({ length: count }, (_, i) => {
    // Even spread within the bar: x_i = -hw + width * (i+1)/(count+1).
    const frac = (i + 1) / (count + 1);
    return { x: -hw + params.width * s * frac, y: hl, z: 0 };
  });

  return { inlet, outlets };
}

/**
 * Build the full embedded connector set for a manifold (1 inlet + N outlets),
 * derived from `params`. SSoT consumed by both the completion builder (creation)
 * and `seedDefaultConnectors` (load-time re-materialisation).
 */
export function buildMepManifoldConnectors(params: MepManifoldParams): MepConnector[] {
  const { inlet, outlets } = manifoldConnectorLocalPositions(params);
  // ADR-408 Φ14 — a drainage collector (φρεάτιο) is the mirror of a water manifold:
  // the geometry is identical (one −X connector + N front-edge connectors) but the
  // ROLES flip. So the single −X connector becomes the sewer OUTLET and the N
  // front-edge connectors become gravity branch INLETS. Default classification is
  // sanitary-drainage for a collector, else the manifold-owned value (Φ-heating;
  // absent ⇒ domestic-cold-water).
  if (isDrainageCollectorKind(params.kind)) {
    const classification = params.systemClassification ?? 'sanitary-drainage';
    return [
      buildManifoldOutletConnector(0, inlet, params.outletDiameterMm, classification),
      ...outlets.map((p, i) =>
        buildManifoldBranchInletConnector(i, p, params.inletDiameterMm, classification),
      ),
    ];
  }
  // ADR-408 Φ12 — water distributor: 1 inlet (−X) + N outlets (front edge).
  const classification = params.systemClassification ?? 'domestic-cold-water';
  return [
    buildManifoldInletConnector(inlet, params.inletDiameterMm, classification),
    ...outlets.map((p, i) =>
      buildManifoldOutletConnector(i, p, params.outletDiameterMm, classification),
    ),
  ];
}

// ─── Validation ─────────────────────────────────────────────────────────────────

/** Result of a manifold validation pass — hard errors non-empty when invalid. */
export interface MepManifoldValidationResult {
  /** When non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking — surfaced as red badge in the property panel. i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload for direct assignment to `MepManifoldEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `MepManifoldParams`. Operates purely on params — geometry
 * re-derivable. Hard errors: non-positive width / length / body height, a
 * footprint dimension below `MIN_MANIFOLD_DIMENSION_MM`, or zero outlets.
 */
export function validateMepManifoldParams(
  params: MepManifoldParams,
): MepManifoldValidationResult {
  const { hardErrors, codeViolations, bimValidation } = validateRectangularBodyDimensions(
    { width: params.width, length: params.length, bodyHeightMm: params.bodyHeightMm },
    'mepManifold',
    MIN_MANIFOLD_DIMENSION_MM,
  );

  if (clampOutletCount(params.outletCount) < MIN_MANIFOLD_OUTLET_COUNT) {
    hardErrors.push('mepManifold.validation.hardErrors.noOutlets');
  }

  return { hardErrors, codeViolations, bimValidation };
}
