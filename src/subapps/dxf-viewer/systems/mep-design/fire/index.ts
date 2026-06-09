/**
 * ADR-433 — Fire-protection (sprinkler) Auto-Design: public barrel.
 *
 * Slice 1 (headless): Demand → Source → Routing → Sizing → `FireNetworkProposal`,
 * consuming the Stage 0 `RecognitionModel`. Slice 2 adds the preview/commit layer.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-433-fire-protection-auto-design.md
 */

export { designFire } from './design-fire';
export type {
  FireService,
  SprinklerDemand,
  FireDemandModel,
  ProposedSegment,
  ProposedNetwork,
  FireNetworkProposal,
} from './fire-design-types';
export { FIRE_SERVICE_CLASSIFICATION } from './fire-design-types';
export {
  FIRE_PROTECTION_DISCIPLINE,
  type FireProtectionDiscipline,
} from './fire-protection-discipline';
export {
  NFPA13_LIGHT_HAZARD_DEMAND_STANDARD,
  DEFAULT_SPRINKLER_FLOW_LPM,
  type FireDemandStandard,
} from './fire-flow-standard';
export {
  VELOCITY_LIMITED_FIRE_SIZING,
  type FireSizingStandard,
} from './fire-sizing';
export { buildFireDemandModel } from './fire-demand';
export {
  resolveFireSource,
  type FireSource,
} from './fire-source-resolve';
