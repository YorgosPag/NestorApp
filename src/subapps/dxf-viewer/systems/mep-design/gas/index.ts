/**
 * ADR-434 — Gas (φυσικό αέριο) Auto-Design: public barrel.
 *
 * Slice 1 (headless): Demand → Source → Routing → Sizing → `GasNetworkProposal`, consuming
 * the Stage 0 `RecognitionModel`. Slice 2 adds the preview/commit layer. Completes the 8/8
 * MEP discipline grid (ADR-423).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-434-gas-auto-design.md
 */

export { designGas } from './design-gas';
export type {
  GasService,
  TerminalGasDemand,
  GasDemandModel,
  ProposedFuelSegment,
  ProposedFuelNetwork,
  GasNetworkProposal,
} from './gas-design-types';
export { GAS_SERVICE_CLASSIFICATION } from './gas-design-types';
export {
  GAS_DISCIPLINE,
  type GasDiscipline,
} from './gas-discipline';
export {
  CONSTANT_GAS_DEMAND_STANDARD,
  DEFAULT_GAS_COOKER_FLOW_CMH,
  DEFAULT_GAS_APPLIANCE_FLOW_CMH,
  type GasDemandStandard,
} from './gas-flow-standard';
export {
  LOW_PRESSURE_VELOCITY_SIZING,
  type GasSizingStandard,
} from './gas-sizing';
export { buildGasDemandModel } from './gas-demand';
export {
  resolveGasSource,
  type GasSource,
} from './gas-source-resolve';
