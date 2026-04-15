'use client';

import { useState, useEffect, useCallback } from 'react';
import { PropertyFloorplanService, type PropertyFloorplanData } from '@/services/floorplans/PropertyFloorplanService';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { RealtimeService } from '@/services/realtime';
import type { FloorplanCreatedPayload, FloorplanDeletedPayload } from '@/services/realtime';
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('usePropertyFloorplans');
const propertyFloorplansCache = createStaleCache<PropertyFloorplanData | null>('property-floorplans');

interface UsePropertyFloorplansReturn {
  propertyFloorplan: PropertyFloorplanData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * 🏢 ENTERPRISE: Load property floorplan with companyId (REQUIRED) for Storage-backed scenes.
 * @param propertyId - The property ID to load floorplan for
 * @param companyId - Company ID (REQUIRED for FileRecord lookup)
 */
export function usePropertyFloorplans(propertyId: string | number, companyId: string): UsePropertyFloorplansReturn {
  const propertyIdStr = propertyId.toString();
  const cacheKey = `${propertyIdStr}-${companyId}`;
  const [propertyFloorplan, setPropertyFloorplan] = useState<PropertyFloorplanData | null>(
    propertyFloorplansCache.get(cacheKey) ?? null
  );
  const [loading, setLoading] = useState(!propertyFloorplansCache.hasLoaded(cacheKey));
  const [error, setError] = useState<string | null>(null);

  const fetchFloorplans = useCallback(async () => {
    try {
      if (!propertyFloorplansCache.hasLoaded(cacheKey)) setLoading(true);
      setError(null);

      logger.info('Fetching property floorplan', { propertyId: propertyIdStr, companyId });

      const data = await PropertyFloorplanService.loadFloorplan({ companyId, propertyId: propertyIdStr });
      propertyFloorplansCache.set(data, cacheKey);
      setPropertyFloorplan(data);

      logger.info('Property floorplan loaded', { hasPropertyFloorplan: !!data });

    } catch (err) {
      const errorMessage = getErrorMessage(err);
      logger.error('Error fetching property floorplan', { error: err });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [propertyIdStr, companyId, cacheKey]);

  useEffect(() => {
    if (propertyIdStr && propertyIdStr !== '0' && propertyIdStr !== 'undefined' && companyId) {
      fetchFloorplans();
    } else {
      setPropertyFloorplan(null);
      setLoading(false);
    }
  }, [propertyIdStr, companyId, fetchFloorplans]);

  // 🏢 ENTERPRISE: Event bus subscribers for cross-tab floorplan sync (ADR-228 Tier 2)
  useEffect(() => {
    if (!propertyIdStr || propertyIdStr === '0') return;

    const handleCreated = (payload: FloorplanCreatedPayload) => {
      if (payload.floorplan.entityId === propertyIdStr) {
        logger.info('Floorplan created for current property — refetching');
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
  }, [propertyIdStr, fetchFloorplans]);

  return {
    propertyFloorplan,
    loading,
    error,
    refetch: fetchFloorplans
  };
}
