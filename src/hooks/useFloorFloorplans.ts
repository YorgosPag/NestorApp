'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floor Floorplans Hook (V2)
 * =============================================================================
 *
 * Loads floor-level floorplans using FloorFloorplanService (Enterprise pattern).
 *
 * Strategy: FloorFloorplanService.loadFloorplan() → `files` collection (FileRecord)
 *
 * 🏢 ADR-292 Phase 4: Legacy `floor_floorplans` fallback eliminated.
 * All reads go through the `files` collection exclusively.
 *
 * @module hooks/useFloorFloorplans
 * @enterprise ADR-060 - DXF Scene Storage Architecture
 */

import { useState, useEffect, useCallback } from 'react';
import { FloorFloorplanService, type FloorFloorplanData } from '@/services/floorplans/FloorFloorplanService';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { createStaleCache } from '@/lib/stale-cache';
import { RealtimeService } from '@/services/realtime';
import type { FloorplanCreatedPayload, FloorplanDeletedPayload } from '@/services/realtime';

const logger = createModuleLogger('useFloorFloorplans');

// ADR-300: Module-level cache — keyed by effective floorId or buildingId+floorNumber
const floorFloorplansCache = createStaleCache<FloorFloorplanData | null>('floor-floorplans');

// ============================================================================
// TYPES
// ============================================================================

interface UseFloorFloorplansParams {
  /** Enterprise floor ID (if available) */
  floorId: string | null;
  /** Building ID - used to find floor when floorId is null */
  buildingId: string | null;
  /** Floor number - used with buildingId to find floor */
  floorNumber: number | null;
  /** Company ID (REQUIRED for Enterprise pattern) */
  companyId?: string | null;
}

interface UseFloorFloorplansReturn {
  /** Floor floorplan data (DXF scene or PDF) */
  floorFloorplan: FloorFloorplanData | null;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manual refetch function */
  refetch: () => Promise<void>;
}

/** Floor document from floors collection */
interface FloorDocument {
  id: string;
  buildingId: string;
  name: string;
  number: number;
  companyId?: string;
}

/** Resolved floor info — includes companyId from the floor document */
interface ResolvedFloor {
  floorId: string;
  /** CompanyId from the floor document (authoritative for file queries) */
  floorCompanyId?: string;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * 🏢 ENTERPRISE: Floor Floorplans Hook (V2)
 *
 * Loading order:
 * 1. Resolve floorId (direct or from buildingId + floorNumber)
 * 2. PRIMARY: Enterprise FileRecord path (FloorFloorplanService)
 * 3. FALLBACK: Legacy floor_floorplans collection (old PDF data only)
 */
export function useFloorFloorplans(params: UseFloorFloorplansParams): UseFloorFloorplansReturn {
  const { floorId, buildingId, floorNumber, companyId } = params;

  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const initCacheKey = floorId ?? `${buildingId ?? 'none'}-${floorNumber ?? 'none'}`;
  const [floorFloorplan, setFloorFloorplan] = useState<FloorFloorplanData | null>(
    floorFloorplansCache.get(initCacheKey) ?? null
  );
  const [loading, setLoading] = useState(!floorFloorplansCache.hasLoaded(initCacheKey));
  const [error, setError] = useState<string | null>(null);

  /**
   * Resolve floor from buildingId + floorNumber.
   * Returns both floorId AND the floor's companyId (authoritative for file queries).
   */
  const findFloor = useCallback(async (bId: string, fNum: number): Promise<ResolvedFloor | null> => {
    try {
      const floorsRef = collection(db, COLLECTIONS.FLOORS);
      const q = query(
        floorsRef,
        where('buildingId', '==', bId),
        where('number', '==', fNum)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const floorDoc = snapshot.docs[0];
        const data = floorDoc.data() as FloorDocument;
        logger.info('Found floor', { id: floorDoc.id, companyId: data.companyId });
        return { floorId: floorDoc.id, floorCompanyId: data.companyId };
      }

      return null;
    } catch (err) {
      logger.warn('Error finding floor', { error: err });
      return null;
    }
  }, []);

  /**
   * PRIMARY: Load via Enterprise FileRecord pattern.
   * Uses overrideCompanyId (from floor document) when available — critical for
   * super_admin scenarios where unit.companyId differs from floor/building.companyId.
   */
  const loadEnterprise = useCallback(async (fId: string, overrideCompanyId?: string): Promise<FloorFloorplanData | null> => {
    const effectiveCompanyId = overrideCompanyId || companyId;
    if (!effectiveCompanyId) {
      logger.warn('No companyId available — cannot load enterprise path');
      return null;
    }

    try {
      logger.debug('Loading via FloorFloorplanService', { data: { companyId: effectiveCompanyId, floorId: fId } });
      const result = await FloorFloorplanService.loadFloorplan({ companyId: effectiveCompanyId, floorId: fId });
      logger.debug('Enterprise result', { data: { found: !!result, hasScene: !!result?.scene, fileName: result?.fileName, fileType: result?.fileType } });
      return result;
    } catch (err) {
      logger.error('Enterprise load failed', { error: err });
      return null;
    }
  }, [companyId]);

  /**
   * Main fetch function — enterprise-first strategy.
   *
   * Uses the floor document's companyId for FileRecord queries when available.
   * This is critical for super_admin: unit.companyId may differ from floor/building.companyId,
   * and files are stored under the floor's tenant.
   */
  const fetchFloorplans = useCallback(async () => {
    if (!floorId && (!buildingId || floorNumber === null)) {
      setFloorFloorplan(null);
      setLoading(false);
      return;
    }

    const cacheKey = floorId ?? `${buildingId ?? 'none'}-${floorNumber ?? 'none'}`;
    try {
      // ADR-300: Only show spinner on first load — not on re-navigation
      if (!floorFloorplansCache.hasLoaded(cacheKey)) setLoading(true);
      setError(null);

      // Step 1: Resolve floorId + floor's companyId
      let effectiveFloorId = floorId;
      let floorCompanyId: string | undefined;

      if (!effectiveFloorId && buildingId && floorNumber !== null) {
        const resolved = await findFloor(buildingId, floorNumber);
        effectiveFloorId = resolved?.floorId ?? null;
        floorCompanyId = resolved?.floorCompanyId;
      } else if (effectiveFloorId) {
        // floorId provided directly — fetch floor doc to get its companyId
        try {
          const { doc: docRef, getDoc } = await import('firebase/firestore');
          const floorSnap = await getDoc(docRef(db, COLLECTIONS.FLOORS, effectiveFloorId));
          if (floorSnap.exists()) {
            const data = floorSnap.data() as FloorDocument;
            floorCompanyId = data.companyId;
            logger.info('Resolved floorCompanyId from floor doc', { floorId: effectiveFloorId, floorCompanyId });
          }
        } catch {
          // Non-critical — fall back to caller's companyId
        }
      }

      if (!effectiveFloorId) {
        logger.info('Could not determine floorId');
        setFloorFloorplan(null);
        return;
      }

      logger.debug('START fetch', { data: { floorId: effectiveFloorId, floorCompanyId, callerCompanyId: companyId, buildingId, floorNumber } });

      // 🏢 ADR-292 Phase 4: Enterprise FileRecord path ONLY (legacy fallback eliminated)
      const floorplanData = await loadEnterprise(effectiveFloorId, floorCompanyId);
      // ADR-300: Write to module-level cache so next remount skips spinner
      floorFloorplansCache.set(floorplanData, cacheKey);
      setFloorFloorplan(floorplanData);

      if (floorplanData) {
        logger.info('Floor floorplan loaded', {
          floorId: floorplanData.floorId,
          fileType: floorplanData.fileType || 'dxf',
          hasScene: !!floorplanData.scene,
          hasPdf: !!floorplanData.pdfImageUrl,
        });
      } else {
        logger.info('No floorplan found for floor', { floorId: effectiveFloorId });
      }

    } catch (err) {
      const errorMessage = getErrorMessage(err);
      logger.error('Error fetching floor floorplan', { error: err });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [floorId, buildingId, floorNumber, companyId, findFloor, loadEnterprise]);

  useEffect(() => {
    fetchFloorplans();
  }, [fetchFloorplans]);

  // 🏢 ENTERPRISE: Event bus subscribers for cross-tab floorplan sync (ADR-228 Tier 2)
  useEffect(() => {
    if (!floorId && (!buildingId || floorNumber === null)) return;

    const handleCreated = (payload: FloorplanCreatedPayload) => {
      if (payload.floorplan.entityId === floorId) {
        logger.info('Floorplan created for current floor — refetching');
        fetchFloorplans();
      }
    };

    const handleDeleted = (_payload: FloorplanDeletedPayload) => {
      fetchFloorplans();
    };

    const unsub1 = RealtimeService.subscribe('FLOORPLAN_CREATED', handleCreated);
    const unsub2 = RealtimeService.subscribe('FLOORPLAN_DELETED', handleDeleted);

    return () => { unsub1(); unsub2(); };
  }, [floorId, buildingId, floorNumber, fetchFloorplans]);

  return {
    floorFloorplan,
    loading,
    error,
    refetch: fetchFloorplans,
  };
}

export default useFloorFloorplans;
