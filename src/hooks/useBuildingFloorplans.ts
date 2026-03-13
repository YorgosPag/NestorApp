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
      return { building: buildingData, storage: storageData };
    },
    deps: [buildingIdStr],
    enabled: !!buildingIdStr,
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
