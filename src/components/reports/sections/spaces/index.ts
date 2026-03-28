/**
 * @module reports/sections/spaces
 * @enterprise ADR-265 Phase 10 — Spaces (Parking/Storage) section components
 */

export { SpacesKPIs } from './SpacesKPIs';
export { ParkingOccupancyChart } from './ParkingOccupancyChart';
export { ParkingZoneChart } from './ParkingZoneChart';
export { StorageUtilizationChart } from './StorageUtilizationChart';
export { SpaceValueByBuildingChart } from './SpaceValueByBuildingChart';

export type {
  SpacesReportPayload,
  BuildingValueItem,
} from './types';
