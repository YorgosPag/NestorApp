'use client';

/**
 * useBuildingFloorplans — Fetches building + storage floorplan data
 *
 * Uses centralized useAsyncData hook (ADR-223).
 */

import { BuildingFloorplanService, type BuildingFloorplanData } from '@/services/floorplans/BuildingFloorplanService';
import { useAsyncData } from '@/hooks/useAsyncData';

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

  return {
    buildingFloorplan: data?.building ?? null,
    storageFloorplan: data?.storage ?? null,
    loading,
    error,
    refetch,
  };
}
