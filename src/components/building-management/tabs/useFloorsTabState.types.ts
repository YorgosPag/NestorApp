/**
 * useFloorsTabState — type definitions.
 * Extracted from `useFloorsTabState.ts` for file-size compliance (<500 lines).
 * Behavior-preserving; `FloorRecord` is re-exported from `useFloorsTabState.ts`.
 *
 * @module components/building-management/tabs/useFloorsTabState.types
 * @see ADR-180 (IFC Floor Management System)
 */

import type { FloorKind } from '@/utils/floor-naming';

export interface FloorRecord {
  id: string;
  number: number;
  name: string;
  elevation?: number | null;
  height?: number | null;
  buildingId: string;
  units?: number;
  hasFloorplan?: boolean;
  /**
   * ADR-461 — Revit-style classification. Flows through the list handler
   * (`{ id, ...doc.data() }`) so the table can mark special levels (foundation /
   * stair-penthouse) and count only counted storeys via `countBuildingStoreys`.
   */
  kind?: FloorKind;
  _v?: number;
}

export interface FloorsApiResponse {
  success: boolean;
  floors: FloorRecord[];
  stats: { totalFloors: number };
}

export interface FloorMutationResponse {
  success: boolean;
  floorId?: string;
  floor?: FloorRecord;
  message?: string;
  error?: string;
}
