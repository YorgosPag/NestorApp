/**
 * ADR-430 — Electrical-strong (ισχυρά) Auto-Design: public barrel.
 *
 * Slice 1 (headless): Source → Demand → Grouping (split-by-service, group-by-zone, bin-pack)
 * → Phase balance → Sizing → `ElectricalNetworkProposal` (N circuits), consuming the Stage 0
 * `RecognitionModel`. The output is logical circuits, NOT segments (the wire is derived at
 * render). Slice 2 adds the preview/commit layer (proposal store + pure commit builder + ghost
 * + ribbon + atomic CompoundCommand of `CreateMepSystemCommand`s).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-430-electrical-strong-auto-design.md
 */

export { designElectricalStrong } from './design-electrical-strong';
export type {
  ElectricalCircuitService,
  PhaseLabel,
  TerminalElectricalDemand,
  ElectricalDemandModel,
  ProposedCircuit,
  ElectricalNetworkProposal,
} from './electrical-design-types';
export { ELECTRICAL_SERVICE_CLASSIFICATION } from './electrical-design-types';
export {
  ELECTRICAL_STRONG_DISCIPLINE,
  type ElectricalStrongDiscipline,
} from './electrical-strong-discipline';
export {
  HD384_DEMAND_STANDARD,
  buildElectricalDemandModel,
  type ElectricalDemandStandard,
} from './electrical-demand';
export {
  HD384_GROUPING_STANDARD,
  groupIntoCircuits,
  balancePhases,
  type ElectricalGroupingStandard,
  type ElectricalCircuitRule,
  type CircuitGroup,
} from './electrical-circuit-grouping';
export {
  HD384_SIZING_STANDARD,
  sizeCircuit,
  daisyChainLengthM,
  type ElectricalSizingStandard,
  type CircuitSizing,
} from './electrical-sizing';
export {
  resolveElectricalPanelSource,
  resolveElectricalSource,
  type ElectricalPanelSource,
} from './electrical-source-resolve';

// ─── ADR-431 — Electrical-WEAK (ασθενή) discipline (2nd consumer of the shared core) ──
export { designElectricalWeak } from './design-electrical-weak';
export type {
  WeakCircuitService,
  WeakCableType,
  ProposedWeakChannel,
  WeakNetworkProposal,
} from './electrical-weak-design-types';
export { WEAK_SERVICE_CLASSIFICATION } from './electrical-weak-design-types';
export {
  ELECTRICAL_WEAK_DISCIPLINE,
  type ElectricalWeakDiscipline,
} from './electrical-weak-discipline';
export {
  ISO11801_DEMAND_STANDARD,
  buildWeakDemandModel,
  type WeakDemandStandard,
} from './electrical-weak-demand';
export {
  ISO11801_GROUPING_STANDARD,
  type WeakGroupingStandard,
  type WeakChannelRule,
  type WeakCircuitGroup,
} from './electrical-weak-grouping';
export {
  ISO11801_SIZING_STANDARD,
  sizeWeakChannel,
  type WeakSizingStandard,
  type WeakChannelSizing,
} from './electrical-weak-sizing';

// Shared discipline-agnostic grouping core (ADR-431 Boy-Scout).
export {
  groupIntoCircuits as groupCircuitsCore,
  daisyChainLengthM as daisyChainLengthMCore,
  type CircuitCap,
  type TerminalDemand,
  type GroupingStandard,
} from './circuit-grouping-core';
