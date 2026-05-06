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
export type { LinkableItem } from './BuildingSpaceLinkDialog';

export { buildTypeCodeField, buildFloorField, buildAreaField, buildPriceField } from './buildingSpaceCardFields';

export type {
  SpaceColumn,
  SpaceCardField,
  SpaceActions,
  SpaceActionState,
} from './types';
