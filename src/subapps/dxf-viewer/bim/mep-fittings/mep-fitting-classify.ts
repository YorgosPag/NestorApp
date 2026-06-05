/**
 * ADR-408 Φ11 — classify a pipe junction into a fitting kind (SSoT, pure).
 *
 * Given a resolved `PipeJunction` (the incident pipe ends + their directions +
 * diameters), decide which fitting Revit would auto-place. Topology is read purely
 * from the incident count + the angle between the two directions (for the 2-incident
 * case) + the diameter spread:
 *
 *   - any host incident                → null       (equipment is the fitting)
 *   - 1 incident                       → `cap`      (dead end)
 *   - 2 collinear, same Ø              → `coupling` (straight inline join)
 *   - 2 collinear, different Ø         → `reducer`
 *   - 2 angled                         → `elbow`
 *   - 3 incidents                      → `tee`
 *   - 4 incidents                      → `cross`
 *   - ≥5 incidents                     → null (skip — no standard fitting)
 *
 * Collinear test: the two unit directions point opposite ways through the node, so
 * `dot(dirA, dirB) ≤ -0.985` (within ≈10° of a straight line). Diameter spread test:
 * `|dA − dB| > 1mm`. `primaryDiameterMm` = the largest incident Ø; `secondaryDiameterMm`
 * is emitted only for a reducer (the smaller Ø). Elbows default to `radiused`.
 *
 * Pure: no store / Firestore / React. Deterministic — same junction ⇒ same
 * classification.
 *
 * @see ../mep-systems/mep-pipe-junctions.ts — produces the `PipeJunction` input
 * @see ../mep-fittings/mep-fitting-resolve.ts — turns this into a draft
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import type { PipeJunction } from '../mep-systems/mep-pipe-junctions';
import type { MepFittingIncident, MepFittingKind, ElbowStyle } from '../types/mep-fitting-types';
import { DEFAULT_ELBOW_STYLE } from '../types/mep-fitting-types';

/** Max |dot| for two directions to count as collinear (≈10° tolerance). */
const COLLINEAR_DOT_THRESHOLD = -0.985;
/** mm. Diameter difference above which a 2-incident node is a reducer, not coupling. */
const DIAMETER_EPSILON_MM = 1;

/** The decided fitting topology for a junction (or null to skip). */
export interface FittingClassification {
  /** Fitting kind, or `null` when the junction has ≥5 incidents (no standard fitting). */
  readonly kind: MepFittingKind | null;
  /** mm. Nominal Ø — the largest incident diameter. */
  readonly primaryDiameterMm: number;
  /** mm. Reducer only — the smaller Ø. */
  readonly secondaryDiameterMm?: number;
  /** Elbow only — bend style (`radiused` default). */
  readonly elbowStyle?: ElbowStyle;
}

/** Largest incident diameter (nominal Ø of the fitting). */
function maxDiameter(incidents: readonly MepFittingIncident[]): number {
  return incidents.reduce((m, inc) => (inc.diameterMm > m ? inc.diameterMm : m), 0);
}

/** Smallest incident diameter. */
function minDiameter(incidents: readonly MepFittingIncident[]): number {
  return incidents.reduce((m, inc) => (inc.diameterMm < m ? inc.diameterMm : m), Infinity);
}

/** Dot product of two unit directions (z included for 3D-readiness). */
function dot(a: MepFittingIncident, b: MepFittingIncident): number {
  return (
    a.directionUnit.x * b.directionUnit.x +
    a.directionUnit.y * b.directionUnit.y +
    (a.directionUnit.z ?? 0) * (b.directionUnit.z ?? 0)
  );
}

/** Classify the 2-incident case: coupling | reducer | elbow. */
function classifyPair(incidents: readonly MepFittingIncident[]): FittingClassification {
  const [a, b] = [incidents[0]!, incidents[1]!];
  const primaryDiameterMm = maxDiameter(incidents);
  const collinear = dot(a, b) <= COLLINEAR_DOT_THRESHOLD;
  const diff = Math.abs(a.diameterMm - b.diameterMm);

  if (!collinear) {
    // Angled join → elbow. When the two ends differ in Ø it is a REDUCING elbow
    // (Revit's single "Reducing Elbow" component / IFC `IfcPipeFitting` BEND with two
    // port diameters): the swept bend tapers from the large Ø to the small one. We
    // keep `kind: 'elbow'` (one fitting per node) and carry the smaller Ø so the body
    // SSoT can taper — same idempotency, no extra entity.
    const elbow: FittingClassification = {
      kind: 'elbow',
      primaryDiameterMm,
      elbowStyle: DEFAULT_ELBOW_STYLE,
    };
    return diff > DIAMETER_EPSILON_MM
      ? { ...elbow, secondaryDiameterMm: minDiameter(incidents) }
      : elbow;
  }

  if (diff > DIAMETER_EPSILON_MM) {
    return { kind: 'reducer', primaryDiameterMm, secondaryDiameterMm: minDiameter(incidents) };
  }
  return { kind: 'coupling', primaryDiameterMm };
}

/**
 * Classify a junction into a fitting kind. Pure SSoT. `kind === null` ⇒ the caller
 * skips the node (≥5 incidents — no standard pipe fitting covers it).
 */
export function classifyJunction(junction: PipeJunction): FittingClassification {
  const { incidents } = junction;
  const primaryDiameterMm = maxDiameter(incidents);

  // A pipe end that lands on a point host (manifold outlet / fixture port) carries
  // a host incident — the equipment IS the fitting there, so no auto-fitting is
  // placed (Revit). Short-circuit BEFORE the count switch so a 1-pipe-at-host node
  // is NOT mistaken for a dead-end cap (ADR-408 Φ-B2b EXT #2).
  if (incidents.some((inc) => inc.host)) {
    return { kind: null, primaryDiameterMm };
  }

  switch (incidents.length) {
    case 1:
      return { kind: 'cap', primaryDiameterMm };
    case 2:
      return classifyPair(incidents);
    case 3:
      return { kind: 'tee', primaryDiameterMm };
    case 4:
      return { kind: 'cross', primaryDiameterMm };
    default:
      return { kind: null, primaryDiameterMm };
  }
}
