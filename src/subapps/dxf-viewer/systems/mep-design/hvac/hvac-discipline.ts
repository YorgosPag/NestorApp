/**
 * ADR-432 — the HVAC (ventilation) discipline descriptor (registry-entry seed).
 *
 * The 5th `MepDisciplineRegistry` descriptor (ADR-423 §4), after water/drainage/heating/
 * electrical. A discipline is *parameters, not an engine*: HVAC supplies its air-flow
 * demand + ASHRAE duct sizing standards to the SHARED orthogonal trunk-branch router
 * (the same one water/drainage/heating use). Adding it required ZERO new routing engine —
 * the only genuinely new pieces are the air-flow demand and the duct sizing, both pluggable.
 *
 * @see ./../water/water-supply-discipline.ts (the pipe analogue / template)
 * @see ./../registry/mep-discipline-registry.ts (the catalog)
 */

import type { AirService } from './hvac-design-types';
import { CONSTANT_AIRFLOW_DEMAND_STANDARD, type AirDemandStandard } from './air-flow-standard';
import { ASHRAE_EQUAL_FRICTION_SIZING, type DuctSizingStandard } from './duct-sizing';

/** Parameterisation of the HVAC discipline for the shared engine. */
export interface HvacDiscipline {
  readonly id: 'hvac';
  readonly services: readonly AirService[];
  readonly demandStandard: AirDemandStandard;
  readonly sizingStandard: DuctSizingStandard;
}

/** The pilot HVAC discipline (constant air-flow demand + ASHRAE equal-friction sizing). */
export const HVAC_DISCIPLINE: HvacDiscipline = {
  id: 'hvac',
  services: ['supply'],
  demandStandard: CONSTANT_AIRFLOW_DEMAND_STANDARD,
  sizingStandard: ASHRAE_EQUAL_FRICTION_SIZING,
};
