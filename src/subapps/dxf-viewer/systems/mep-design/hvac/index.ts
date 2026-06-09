/**
 * ADR-432 — HVAC (ventilation) Auto-Design: public barrel.
 *
 * Slice 1 (headless): Demand → Source → Routing → Duct Sizing → `DuctNetworkProposal`,
 * consuming the Stage 0 `RecognitionModel`. Slice 2 adds the preview/commit layer.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-432-hvac-auto-design.md
 */

export { designHvac } from './design-hvac';
export type {
  AirService,
  TerminalAirDemand,
  HvacDemandModel,
  ProposedDuctSegment,
  ProposedDuctNetwork,
  DuctNetworkProposal,
} from './hvac-design-types';
export { AIR_SERVICE_CLASSIFICATION } from './hvac-design-types';
export {
  HVAC_DISCIPLINE,
  type HvacDiscipline,
} from './hvac-discipline';
export {
  CONSTANT_AIRFLOW_DEMAND_STANDARD,
  DEFAULT_TERMINAL_AIRFLOW_CMH,
  type AirDemandStandard,
} from './air-flow-standard';
export {
  ASHRAE_EQUAL_FRICTION_SIZING,
  type DuctSizingStandard,
} from './duct-sizing';
export { buildHvacDemandModel } from './hvac-air-demand';
export {
  resolveHvacSource,
  type HvacSource,
} from './hvac-source-resolve';
