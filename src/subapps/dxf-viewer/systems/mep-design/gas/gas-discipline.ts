/**
 * ADR-434 — the gas (φυσικό αέριο) discipline descriptor (registry-entry seed).
 *
 * The 8th & final `MepDisciplineRegistry` descriptor (ADR-423 §4), completing the grid. A
 * discipline is *parameters, not an engine*: gas supplies its gas-flow demand + low-pressure
 * sizing standards to the SHARED orthogonal trunk-branch router (the same one water/drainage/
 * heating/HVAC/fire use). Adding it required ZERO new routing engine — the only genuinely new
 * pieces are the gas-flow demand and the gas sizing, both pluggable.
 *
 * @see ./../hvac/hvac-discipline.ts (the new-system-family analogue / template)
 * @see ./../registry/mep-discipline-registry.ts (the catalog)
 */

import type { GasService } from './gas-design-types';
import { CONSTANT_GAS_DEMAND_STANDARD, type GasDemandStandard } from './gas-flow-standard';
import { LOW_PRESSURE_VELOCITY_SIZING, type GasSizingStandard } from './gas-sizing';

/** Parameterisation of the gas discipline for the shared engine. */
export interface GasDiscipline {
  readonly id: 'gas';
  readonly services: readonly GasService[];
  readonly demandStandard: GasDemandStandard;
  readonly sizingStandard: GasSizingStandard;
}

/** The pilot gas discipline (constant appliance-flow demand + low-pressure velocity sizing). */
export const GAS_DISCIPLINE: GasDiscipline = {
  id: 'gas',
  services: ['gas'],
  demandStandard: CONSTANT_GAS_DEMAND_STANDARD,
  sizingStandard: LOW_PRESSURE_VELOCITY_SIZING,
};
