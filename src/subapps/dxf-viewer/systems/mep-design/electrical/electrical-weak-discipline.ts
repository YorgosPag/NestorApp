/**
 * ADR-431 — the Electrical-WEAK (ασθενή) discipline descriptor (registry-entry seed).
 *
 * The 6th `MepDisciplineRegistry` descriptor (ADR-423 §6), the sibling of electrical-strong
 * (ADR-430). Like every discipline it is *parameters, not an engine*: it supplies its demand
 * (ports/outlet), channel-grouping (port budget) and sizing (90 m channel) standards, plus
 * the out classifications its source (comms-rack) carries. It shares the strong bin-packing
 * brain (`circuit-grouping-core.ts`); its only genuinely-new logic is the port-budget rule +
 * the 90 m permanent-link check. All standards are pluggable (ISO/IEC 11801 at the pilot).
 *
 * @see ./../registry/mep-discipline-registry.ts (the catalog — `electrical-weak` slot)
 * @see ./electrical-strong-discipline.ts (the strong counterpart / template)
 */

import type { ElectricalSystemClassification } from '../../../bim/types/mep-connector-types';
import { ISO11801_DEMAND_STANDARD, type WeakDemandStandard } from './electrical-weak-demand';
import { ISO11801_GROUPING_STANDARD, type WeakGroupingStandard } from './electrical-weak-grouping';
import { ISO11801_SIZING_STANDARD, type WeakSizingStandard } from './electrical-weak-sizing';

/** Parameterisation of the electrical-weak discipline for the grouping/sizing engine. */
export interface ElectricalWeakDiscipline {
  readonly id: 'electrical-weak';
  readonly demandStandard: WeakDemandStandard;
  readonly groupingStandard: WeakGroupingStandard;
  readonly sizingStandard: WeakSizingStandard;
  /** Out classifications the comms-rack source carries (data + controls). */
  readonly sourceClassifications: readonly ElectricalSystemClassification[];
}

/** The pilot electrical-weak discipline (ISO/IEC 11801 ports + port budget + 90 m channel). */
export const ELECTRICAL_WEAK_DISCIPLINE: ElectricalWeakDiscipline = {
  id: 'electrical-weak',
  demandStandard: ISO11801_DEMAND_STANDARD,
  groupingStandard: ISO11801_GROUPING_STANDARD,
  sizingStandard: ISO11801_SIZING_STANDARD,
  sourceClassifications: ['data', 'controls'],
};
