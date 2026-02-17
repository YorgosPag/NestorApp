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

export type {
  SpaceColumn,
  SpaceCardField,
  SpaceActions,
  SpaceActionState,
} from './types';
