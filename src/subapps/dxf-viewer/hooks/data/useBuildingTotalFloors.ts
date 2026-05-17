'use client';

/**
 * ADR-358 Phase 9B-1 — Building total floor count.
 *
 * Thin wrapper around `useRealtimeBuildingFloors` (SSoT in
 * `src/services/realtime/hooks/useRealtimeBuildingFloors.ts`) that exposes
 * just the `floorsCount` field for the stair ribbon widget. The full hook
 * also tracks floorplan presence which the widget does not need; this
 * wrapper keeps the API surface narrow and the dependency intent explicit
 * (no duplicate Firestore subscription).
 */

import { useRealtimeBuildingFloors } from '@/services/realtime/hooks/useRealtimeBuildingFloors';

export interface BuildingTotalFloors {
  readonly floorsCount: number;
  readonly loading: boolean;
}

export function useBuildingTotalFloors(
  buildingId: string | null | undefined,
): BuildingTotalFloors {
  const { floorsCount, loading } = useRealtimeBuildingFloors(buildingId ?? null);
  return { floorsCount, loading };
}
