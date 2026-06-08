/**
 * ADR-427 — Sanitary Drainage Auto-Design (2nd discipline): public barrel.
 *
 * Slice 1 (headless): Demand → Outfall → Routing → Sizing → Slope → `DrainageNetworkProposal`,
 * consuming the Stage 0 `RecognitionModel`. Slice 2 will add the preview/commit layer.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-427-sanitary-drainage-auto-design.md
 */

export { designDrainage } from './design-drainage';
export type {
  FixtureDischarge,
  DrainageDemandModel,
  ProposedDrainageSegment,
  ProposedDrainageNetwork,
  DrainageNetworkProposal,
} from './drainage-design-types';
export { DRAINAGE_CLASSIFICATION } from './drainage-design-types';
export {
  SANITARY_DRAINAGE_DISCIPLINE,
  type SanitaryDrainageDiscipline,
} from './drainage-discipline';
export {
  EN12056_DEMAND_STANDARD,
  peakWastewaterFlow,
  type DischargeDemandStandard,
  type ApplianceDischarge,
} from './discharge-units';
export {
  EN12056_DRAINAGE_SIZING,
  type DrainageSizingStandard,
} from './drainage-sizing';
export { buildDrainageDemandModel } from './drainage-demand';
export {
  resolveDrainageOutfall,
  type DrainageOutfall,
} from './outfall-resolve';
export { routeGravityNetwork } from './gravity-router';
export {
  assignGravitySlopes,
  type RoutedSizedRun,
  type SlopedRun,
} from './slope-assignment';
