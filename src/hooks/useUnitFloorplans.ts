'use client';

import { useState, useEffect, useCallback } from 'react';
import { UnitFloorplanService, type UnitFloorplanData } from '@/services/floorplans/UnitFloorplanService';
import { createModuleLogger } from '@/lib/telemetry';
import { RealtimeService } from '@/services/realtime';
import type { FloorplanCreatedPayload, FloorplanDeletedPayload } from '@/services/realtime';

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

  const fetchFloorplans = useCallback(async () => {
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
  }, [unitIdStr, companyId]);

  useEffect(() => {
    if (unitIdStr && unitIdStr !== '0' && unitIdStr !== 'undefined' && companyId) {
      fetchFloorplans();
    } else {
      setUnitFloorplan(null);
      setLoading(false);
    }
  }, [unitIdStr, companyId, fetchFloorplans]);

  // 🏢 ENTERPRISE: Event bus subscribers for cross-tab floorplan sync (ADR-228 Tier 2)
  useEffect(() => {
    if (!unitIdStr || unitIdStr === '0') return;

    const handleCreated = (payload: FloorplanCreatedPayload) => {
      if (payload.floorplan.entityId === unitIdStr) {
        logger.info('Floorplan created for current unit — refetching');
        fetchFloorplans();
      }
    };

    const handleDeleted = (_payload: FloorplanDeletedPayload) => {
      logger.info('Floorplan deleted — refetching');
      fetchFloorplans();
    };

    const unsub1 = RealtimeService.subscribe('FLOORPLAN_CREATED', handleCreated);
    const unsub2 = RealtimeService.subscribe('FLOORPLAN_DELETED', handleDeleted);

    return () => { unsub1(); unsub2(); };
  }, [unitIdStr, fetchFloorplans]);

  return {
    unitFloorplan,
    loading,
    error,
    refetch: fetchFloorplans
  };
}
