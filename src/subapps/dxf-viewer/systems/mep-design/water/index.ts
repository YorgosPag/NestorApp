/**
 * ADR-426 — Water-Supply Auto-Design (pilot): public barrel.
 *
 * Slice 1 (headless): Demand → Routing → Sizing → `WaterNetworkProposal`, consuming
 * the Stage 0 `RecognitionModel`. Slice 2 will add the preview/commit layer.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-426-water-supply-auto-design.md
 */

export {
  designWaterSupply,
} from './design-water-supply';
export type {
  WaterService,
  FixtureDemand,
  WaterDemandModel,
  ProposedSegment,
  ProposedNetwork,
  WaterNetworkProposal,
} from './water-design-types';
export { WATER_SERVICE_CLASSIFICATION } from './water-design-types';
export {
  WATER_SUPPLY_DISCIPLINE,
  type WaterSupplyDiscipline,
} from './water-supply-discipline';
export {
  EN806_DEMAND_STANDARD,
  loadingUnitsFor,
  type DemandStandard,
  type FixtureLoadingUnits,
} from './water-loading-units';
export {
  DIN1988_SIZING_STANDARD,
  type SizingStandard,
} from './water-sizing';
export { buildWaterDemandModel } from './water-demand';
export {
  resolveWaterSource,
  type WaterSource,
} from './water-source-resolve';
export {
  routeOrthogonalTrunkBranch,
  type RouteTarget,
  type RoutedSegment,
} from './orthogonal-router';
export { resolveConnectorWorldPoint } from './connector-resolve';
