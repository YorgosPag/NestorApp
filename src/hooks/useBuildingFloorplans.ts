'use client';

import { useState, useEffect } from 'react';
import { BuildingFloorplanService, type BuildingFloorplanData } from '@/services/floorplans/BuildingFloorplanService';

interface UseBuildingFloorplansReturn {
  buildingFloorplan: BuildingFloorplanData | null;
  storageFloorplan: BuildingFloorplanData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBuildingFloorplans(buildingId: string | number): UseBuildingFloorplansReturn {
  const [buildingFloorplan, setBuildingFloorplan] = useState<BuildingFloorplanData | null>(null);
  const [storageFloorplan, setStorageFloorplan] = useState<BuildingFloorplanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildingIdStr = buildingId.toString();

  const fetchFloorplans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load both building floorplan types in parallel
      const [buildingData, storageData] = await Promise.all([
        BuildingFloorplanService.loadFloorplan(buildingIdStr, 'building'),
        BuildingFloorplanService.loadFloorplan(buildingIdStr, 'storage')
      ]);

      setBuildingFloorplan(buildingData);
      setStorageFloorplan(storageData);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Error fetching building floorplans:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (buildingIdStr) {
      fetchFloorplans();
    }
  }, [buildingIdStr]);

  return {
    buildingFloorplan,
    storageFloorplan,
    loading,
    error,
    refetch: fetchFloorplans
  };
}