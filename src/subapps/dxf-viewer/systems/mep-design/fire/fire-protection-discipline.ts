/**
 * ADR-433 — the Fire-protection (sprinkler) discipline descriptor (registry-entry seed).
 *
 * The 7th `MepDisciplineRegistry` descriptor (ADR-423 §4), after water / drainage / heating /
 * electrical-strong / HVAC / electrical-weak. A discipline is *parameters, not an engine*:
 * fire protection supplies its design-flow demand + velocity-limited DN sizing standards to
 * the SHARED orthogonal trunk-branch router (the same one water/drainage/heating/HVAC use).
 * Adding it required ZERO new routing engine — the only genuinely new pieces are the fire
 * design-flow demand and the wet-pipe sizing, both pluggable. Being `pressurised` it is a
 * faithful pipe mirror of water (the segment carries the `fire-sprinkler` classification),
 * NOT the HVAC duct.
 *
 * @see ./../water/water-supply-discipline.ts (the pipe analogue / template)
 * @see ./../registry/mep-discipline-registry.ts (the catalog)
 */

import type { FireService } from './fire-design-types';
import { NFPA13_LIGHT_HAZARD_DEMAND_STANDARD, type FireDemandStandard } from './fire-flow-standard';
import { VELOCITY_LIMITED_FIRE_SIZING, type FireSizingStandard } from './fire-sizing';

/** Parameterisation of the fire-protection discipline for the shared engine. */
export interface FireProtectionDiscipline {
  readonly id: 'fire-protection';
  readonly services: readonly FireService[];
  readonly demandStandard: FireDemandStandard;
  readonly sizingStandard: FireSizingStandard;
}

/** The pilot fire-protection discipline (NFPA 13 light-hazard demand + velocity-limited sizing). */
export const FIRE_PROTECTION_DISCIPLINE: FireProtectionDiscipline = {
  id: 'fire-protection',
  services: ['sprinkler'],
  demandStandard: NFPA13_LIGHT_HAZARD_DEMAND_STANDARD,
  sizingStandard: VELOCITY_LIMITED_FIRE_SIZING,
};
