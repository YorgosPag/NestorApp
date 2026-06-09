/**
 * ADR-430 — the Electrical-strong (ισχυρά) discipline descriptor (registry-entry seed).
 *
 * The 4th `MepDisciplineRegistry` descriptor (ADR-423 §4), after water (426), drainage (427)
 * and heating (428). Like the others, a discipline is *parameters, not an engine*: the
 * electrical discipline supplies its demand (VA per point), circuit-grouping (breaker/point
 * limits + phases) and sizing (conductor / voltage-drop) standards. Unlike the pipe
 * disciplines it shares NO routing/sizing engine with them — its output is N logical circuits
 * (`MepSystem`s), not segments, and its "engine" is the bin-packing grouping + the HD 384
 * sizing here. All three standards are pluggable (ΕΛΟΤ HD 384 / IEC 60364 at the pilot).
 *
 * @see ./../registry/mep-discipline-registry.ts (the catalog — `electrical-strong` slot)
 * @see ../heating/heating-discipline.ts (the pipe-discipline counterpart / structure template)
 */

import { HD384_DEMAND_STANDARD, type ElectricalDemandStandard } from './electrical-demand';
import {
  HD384_GROUPING_STANDARD,
  type ElectricalGroupingStandard,
} from './electrical-circuit-grouping';
import { HD384_SIZING_STANDARD, type ElectricalSizingStandard } from './electrical-sizing';

/** Parameterisation of the electrical-strong discipline for the grouping/sizing engine. */
export interface ElectricalStrongDiscipline {
  readonly id: 'electrical-strong';
  readonly demandStandard: ElectricalDemandStandard;
  readonly groupingStandard: ElectricalGroupingStandard;
  readonly sizingStandard: ElectricalSizingStandard;
}

/** The pilot electrical-strong discipline (HD 384 VA demand + circuit limits + voltage-drop). */
export const ELECTRICAL_STRONG_DISCIPLINE: ElectricalStrongDiscipline = {
  id: 'electrical-strong',
  demandStandard: HD384_DEMAND_STANDARD,
  groupingStandard: HD384_GROUPING_STANDARD,
  sizingStandard: HD384_SIZING_STANDARD,
};
