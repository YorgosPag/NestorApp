/**
 * Centralized Building Space Components — Barrel Export
 *
 * Shared table, card grid, and action components
 * used by all building space tabs (Units, Parking, Storage).
 *
 * @module components/building-management/shared
 */

export { BuildingSpaceTable } from './BuildingSpaceTable';
export { BuildingSpaceCardGrid } from './BuildingSpaceCardGrid';
export { BuildingSpaceActions } from './BuildingSpaceActions';
export { BuildingSpaceConfirmDialog } from './BuildingSpaceConfirmDialog';
export { BuildingSpaceLinkDialog } from './BuildingSpaceLinkDialog';
export { SpaceFloorplanInline } from './SpaceFloorplanInline';
export { BuildingSpaceWarningBanner } from './BuildingSpaceWarningBanner';
export { BuildingSpaceFilterBar } from './BuildingSpaceFilterBar';
export { BuildingSpaceViewSwitch } from './BuildingSpaceViewSwitch';
export type { LinkableItem } from './BuildingSpaceLinkDialog';
export type { SpaceFilterOption, SpaceSelectFilter } from './BuildingSpaceFilterBar';

export { buildTypeCodeField, buildFloorField, buildAreaField, buildPriceField } from './buildingSpaceCardFields';
export { buildPriceColumn } from './buildingSpacePriceColumn';

export type {
  SpaceColumn,
  SpaceCardField,
  SpaceActions,
  SpaceActionState,
  BuildingSpaceViewMode,
} from './types';
