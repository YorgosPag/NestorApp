/**
 * ADR-428 — the Heating (Hydronic) discipline descriptor (registry-entry seed).
 *
 * The 3rd `MepDisciplineRegistry` descriptor (ADR-423 §4), after water (426) and drainage
 * (427). A discipline is *parameters, not an engine*: the heating discipline supplies its
 * demand (W → l/s at a design ΔΤ) + velocity sizing standards and its two classifications
 * (`hydronic-supply` / `hydronic-return`) to the shared engine. Adding it required ZERO new
 * routing/sizing engine code — both networks reuse the shared orthogonal trunk-branch router
 * (the same one water and drainage use); the only new pieces are the thermal demand and the
 * velocity sizing, both pluggable.
 *
 * @see ./../water/water-supply-discipline.ts · ./../drainage/drainage-discipline.ts
 * @see ./../registry/mep-discipline-registry.ts (the catalog)
 */

import { HEATING_70_50_DEMAND_STANDARD, type HeatingDemandStandard } from './heating-flow';
import { HYDRONIC_VELOCITY_SIZING, type HeatingSizingStandard } from './heating-sizing';

/** Parameterisation of the heating discipline for the shared engine. */
export interface HeatingDiscipline {
  readonly id: 'heating';
  readonly demandStandard: HeatingDemandStandard;
  readonly sizingStandard: HeatingSizingStandard;
}

/** The pilot heating discipline (70/50 regime demand + velocity-limited sizing). */
export const HEATING_DISCIPLINE: HeatingDiscipline = {
  id: 'heating',
  demandStandard: HEATING_70_50_DEMAND_STANDARD,
  sizingStandard: HYDRONIC_VELOCITY_SIZING,
};
