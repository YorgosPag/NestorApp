'use client';

import { useState, useEffect } from 'react';
import { UnitFloorplanService, type UnitFloorplanData } from '@/services/floorplans/UnitFloorplanService';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useUnitFloorplans');

interface UseUnitFloorplansReturn {
  unitFloorplan: UnitFloorplanData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUnitFloorplans(unitId: string | number): UseUnitFloorplansReturn {
  const [unitFloorplan, setUnitFloorplan] = useState<UnitFloorplanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unitIdStr = unitId.toString();

  const fetchFloorplans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      logger.info('Fetching unit floorplan from Firestore', { unitId: unitIdStr });
      
      // Load unit floorplan
      const unitData = await UnitFloorplanService.loadFloorplan(unitIdStr);
      setUnitFloorplan(unitData);
      
      logger.info('Unit floorplan loaded', { hasUnitFloorplan: !!unitData });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Error fetching unit floorplan', { error: err });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unitIdStr && unitIdStr !== '0' && unitIdStr !== 'undefined') {
      fetchFloorplans();
    } else {
      setUnitFloorplan(null);
      setLoading(false);
    }
  }, [unitIdStr]);

  return {
    unitFloorplan,
    loading,
    error,
    refetch: fetchFloorplans
  };
}