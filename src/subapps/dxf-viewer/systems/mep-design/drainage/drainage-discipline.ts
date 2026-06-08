/**
 * ADR-427 — the Sanitary-Drainage discipline descriptor (registry-entry seed).
 *
 * The 2nd `MepDisciplineRegistry` descriptor (ADR-423 §4), after the water pilot. A
 * discipline is *parameters, not an engine*: the gravity drainage discipline supplies its
 * EN 12056-2 demand + sizing standards (and its single classification) to the shared engine.
 * Adding it required ZERO new engine code beyond the gravity slope step — the router, the
 * commit path, the fittings, the recognition layer are all reused.
 *
 * @see ./../water/water-supply-discipline.ts (the pressurised counterpart)
 * @see ./../registry/mep-discipline-registry.ts (the catalog)
 */

import { EN12056_DEMAND_STANDARD, type DischargeDemandStandard } from './discharge-units';
import { EN12056_DRAINAGE_SIZING, type DrainageSizingStandard } from './drainage-sizing';

/** Parameterisation of the sanitary-drainage discipline for the shared engine. */
export interface SanitaryDrainageDiscipline {
  readonly id: 'sanitary-drainage';
  readonly demandStandard: DischargeDemandStandard;
  readonly sizingStandard: DrainageSizingStandard;
}

/** The pilot drainage discipline (EN 12056-2 System I demand + sizing). */
export const SANITARY_DRAINAGE_DISCIPLINE: SanitaryDrainageDiscipline = {
  id: 'sanitary-drainage',
  demandStandard: EN12056_DEMAND_STANDARD,
  sizingStandard: EN12056_DRAINAGE_SIZING,
};
