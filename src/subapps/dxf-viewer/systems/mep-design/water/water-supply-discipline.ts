/**
 * ADR-426 — the Water-Supply discipline descriptor (registry-entry seed).
 *
 * The ADR-423 §4 `MepDisciplineRegistry` vision: each discipline is *parameters, not
 * an engine*. This is the first such descriptor — the cold/hot services, the demand +
 * sizing standards, and the routing constants the shared engine reads. Adding drainage
 * later = another descriptor (its own standards + flow model), never an engine fork.
 * The full multi-discipline registry is generalised when the 2nd discipline lands
 * (ADR-423 §6 step 4); this seed keeps the pilot honest to the pattern now.
 */

import type { WaterService } from './water-design-types';
import { EN806_DEMAND_STANDARD, type DemandStandard } from './water-loading-units';
import { DIN1988_SIZING_STANDARD, type SizingStandard } from './water-sizing';

/** Parameterisation of the water-supply discipline for the shared engine. */
export interface WaterSupplyDiscipline {
  readonly id: 'water-supply';
  readonly services: readonly WaterService[];
  readonly demandStandard: DemandStandard;
  readonly sizingStandard: SizingStandard;
  /** Lateral offset (mm) of the hot spine from the cold spine (parallel runs). */
  readonly hotSpineOffsetMm: number;
}

/** The pilot water-supply discipline (EN 806 demand + DIN 1988-3 sizing). */
export const WATER_SUPPLY_DISCIPLINE: WaterSupplyDiscipline = {
  id: 'water-supply',
  services: ['cold', 'hot'],
  demandStandard: EN806_DEMAND_STANDARD,
  sizingStandard: DIN1988_SIZING_STANDARD,
  hotSpineOffsetMm: 80,
};
