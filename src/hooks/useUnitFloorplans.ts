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

/**
 * 🏢 ENTERPRISE: Load unit floorplan with companyId (REQUIRED) for Storage-backed scenes.
 * @param unitId - The unit ID to load floorplan for
 * @param companyId - Company ID (REQUIRED for FileRecord lookup)
 */
export function useUnitFloorplans(unitId: string | number, companyId: string): UseUnitFloorplansReturn {
  const [unitFloorplan, setUnitFloorplan] = useState<UnitFloorplanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unitIdStr = unitId.toString();

  const fetchFloorplans = async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Fetching unit floorplan', { unitId: unitIdStr, companyId });

      const unitData = await UnitFloorplanService.loadFloorplan({ companyId, unitId: unitIdStr });
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
    if (unitIdStr && unitIdStr !== '0' && unitIdStr !== 'undefined' && companyId) {
      fetchFloorplans();
    } else {
      setUnitFloorplan(null);
      setLoading(false);
    }
  }, [unitIdStr, companyId]);

  return {
    unitFloorplan,
    loading,
    error,
    refetch: fetchFloorplans
  };
}
