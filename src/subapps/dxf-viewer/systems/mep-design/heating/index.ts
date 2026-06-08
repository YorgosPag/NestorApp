/**
 * ADR-428 — Heating (Hydronic) Auto-Design: public barrel.
 *
 * Slice 1 (headless): Demand → Source/Sink → Routing ×2 → Sizing → `HeatingNetworkProposal`
 * (supply + return), consuming the Stage 0 `RecognitionModel`. Slice 2 will add the
 * preview/commit layer (ghost + ribbon + atomic CompoundCommand).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-428-heating-auto-design.md
 */

export { designHeating } from './design-heating';
export type {
  HeatingNetworkRole,
  TerminalHeatDemand,
  HeatingDemandModel,
  ProposedHeatingSegment,
  ProposedHeatingNetwork,
  HeatingNetworkProposal,
} from './heating-design-types';
export { HEATING_ROLE_CLASSIFICATION } from './heating-design-types';
export { HEATING_DISCIPLINE, type HeatingDiscipline } from './heating-discipline';
export {
  HEATING_70_50_DEMAND_STANDARD,
  flowLpsForTerminal,
  type HeatingDemandStandard,
} from './heating-flow';
export {
  HYDRONIC_VELOCITY_SIZING,
  type HeatingSizingStandard,
} from './heating-sizing';
export { buildHeatingDemandModel } from './heating-demand';
export {
  resolveHeatingSupplySource,
  resolveHeatingReturnSink,
  type HeatingEndpoint,
} from './heating-source-resolve';
