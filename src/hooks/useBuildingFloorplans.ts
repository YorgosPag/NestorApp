'use client';

/**
 * useBuildingFloorplans — Fetches building + storage floorplan data
 *
 * Uses centralized useAsyncData hook (ADR-223).
 */

import { useEffect } from 'react';
import { BuildingFloorplanService, type BuildingFloorplanData } from '@/services/floorplans/BuildingFloorplanService';
import { useAsyncData } from '@/hooks/useAsyncData';
import { RealtimeService } from '@/services/realtime';
import type { FloorplanCreatedPayload, FloorplanDeletedPayload } from '@/services/realtime';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// ADR-300: Module-level cache survives React unmount/remount (navigation)
// Keyed by buildingId
const buildingFloorplansCache = createStaleCache<FloorplanResult>('building-floorplans');

interface FloorplanResult {
  building: BuildingFloorplanData | null;
  storage: BuildingFloorplanData | null;
}

interface UseBuildingFloorplansReturn {
  buildingFloorplan: BuildingFloorplanData | null;
  storageFloorplan: BuildingFloorplanData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBuildingFloorplans(buildingId: string | number): UseBuildingFloorplansReturn {
  const buildingIdStr = buildingId.toString();

  const { data, loading, error, refetch } = useAsyncData<FloorplanResult>({
    fetcher: async () => {
      const [buildingData, storageData] = await Promise.all([
        BuildingFloorplanService.loadFloorplan(buildingIdStr, 'building'),
        BuildingFloorplanService.loadFloorplan(buildingIdStr, 'storage'),
      ]);
      const result = { building: buildingData, storage: storageData };
      // ADR-300: Write to module-level cache so next remount skips spinner
      buildingFloorplansCache.set(result, buildingIdStr);
      return result;
    },
    deps: [buildingIdStr],
    enabled: !!buildingIdStr,
    initialData: buildingFloorplansCache.get(buildingIdStr) ?? undefined,
    silentInitialFetch: buildingFloorplansCache.hasLoaded(buildingIdStr),
  });

  // 🏢 ENTERPRISE: Event bus subscribers for cross-tab floorplan sync (ADR-228 Tier 2)
  useEffect(() => {
    if (!buildingIdStr) return;

    const handleCreated = (payload: FloorplanCreatedPayload) => {
      if (payload.floorplan.entityId === buildingIdStr) {
        refetch();
      }
    };

    const handleDeleted = (_payload: FloorplanDeletedPayload) => {
      refetch();
    };

    const unsub1 = RealtimeService.subscribe('FLOORPLAN_CREATED', handleCreated);
    const unsub2 = RealtimeService.subscribe('FLOORPLAN_DELETED', handleDeleted);

    return () => { unsub1(); unsub2(); };
  }, [buildingIdStr, refetch]);

  return {
    buildingFloorplan: data?.building ?? null,
    storageFloorplan: data?.storage ?? null,
    loading,
    error,
    refetch,
  };
}
