'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floor Floorplans Hook (V2)
 * =============================================================================
 *
 * Loads floor-level floorplans using FloorFloorplanService (Enterprise pattern).
 *
 * Strategy order (V2 — enterprise-first):
 * 1. PRIMARY: FloorFloorplanService.loadFloorplan() → `files` collection (FileRecord)
 * 2. FALLBACK: Legacy `floor_floorplans` collection (for old embedded PDF data)
 *
 * Removed: cadFiles full-collection scan (was downloading ALL docs without WHERE)
 *
 * @module hooks/useFloorFloorplans
 * @enterprise ADR-060 - DXF Scene Storage Architecture
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FloorFloorplanService, type FloorFloorplanData } from '@/services/floorplans/FloorFloorplanService';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFloorFloorplans');

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

/** Legacy floor_floorplans metadata */
interface FloorFloorplanMetadata {
  buildingId: string;
  floorId: string;
  floorNumber?: number;
  type: 'floor';
  fileName: string;
  timestamp: number;
  fileType?: 'dxf' | 'pdf';
  pdfImageUrl?: string;
  pdfDimensions?: { width: number; height: number } | null;
  deleted?: boolean;
}

/** Floor document from floors collection */
interface FloorDocument {
  id: string;
  buildingId: string;
  name: string;
  number: number;
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

  const [floorFloorplan, setFloorFloorplan] = useState<FloorFloorplanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resolve floorId from buildingId + floorNumber
   */
  const findFloorId = useCallback(async (bId: string, fNum: number): Promise<string | null> => {
    try {
      const floorsRef = collection(db, 'floors');
      const q = query(
        floorsRef,
        where('buildingId', '==', bId),
        where('number', '==', fNum)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const floorDoc = snapshot.docs[0];
        logger.info('Found floor', { id: floorDoc.id });
        return floorDoc.id;
      }

      return null;
    } catch (err) {
      logger.warn('Error finding floor', { error: err });
      return null;
    }
  }, []);

  /**
   * PRIMARY: Load via Enterprise FileRecord pattern
   */
  const loadEnterprise = useCallback(async (fId: string): Promise<FloorFloorplanData | null> => {
    if (!companyId) {
      logger.warn('companyId required for Enterprise pattern — skipping');
      return null;
    }

    try {
      logger.info('Loading via FloorFloorplanService', { companyId, floorId: fId });
      return await FloorFloorplanService.loadFloorplan({ companyId, floorId: fId });
    } catch (err) {
      logger.warn('Enterprise load failed', { error: err });
      return null;
    }
  }, [companyId]);

  /**
   * FALLBACK: Search legacy floor_floorplans collection
   * Only useful for old PDF floorplans with embedded pdfImageUrl
   */
  const searchLegacyFloorFloorplans = useCallback(async (floorIdStr: string): Promise<FloorFloorplanData | null> => {
    try {
      const floorplansRef = collection(db, 'floor_floorplans');
      const q = query(floorplansRef, where('floorId', '==', floorIdStr));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data() as FloorFloorplanMetadata;

        if (docData.deleted) {
          return null;
        }

        // Only return PDF data from legacy collection — DXF scenes should come from FileRecord
        if (docData.fileType === 'pdf' || docData.pdfImageUrl) {
          logger.info('Found legacy PDF floorplan', { floorId: floorIdStr });
          return {
            buildingId: docData.buildingId,
            floorId: docData.floorId,
            floorNumber: docData.floorNumber || 0,
            type: 'floor',
            fileName: docData.fileName,
            timestamp: docData.timestamp,
            fileType: 'pdf',
            pdfImageUrl: docData.pdfImageUrl,
            pdfDimensions: docData.pdfDimensions,
          };
        }

        // For DXF entries in legacy collection, try enterprise path
        if (companyId) {
          return await FloorFloorplanService.loadFloorplan({ companyId, floorId: floorIdStr });
        }

        return null;
      }

      return null;
    } catch (err) {
      logger.warn('Error searching legacy floor_floorplans', { error: err });
      return null;
    }
  }, [companyId]);

  /**
   * Main fetch function — enterprise-first strategy
   */
  const fetchFloorplans = useCallback(async () => {
    if (!floorId && (!buildingId || floorNumber === null)) {
      setFloorFloorplan(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Step 1: Resolve floorId
      let effectiveFloorId = floorId;
      if (!effectiveFloorId && buildingId && floorNumber !== null) {
        effectiveFloorId = await findFloorId(buildingId, floorNumber);
      }

      if (!effectiveFloorId) {
        logger.info('Could not determine floorId');
        setFloorFloorplan(null);
        return;
      }

      logger.info('Fetching floor floorplan', { floorId: effectiveFloorId, companyId });

      // Step 2: PRIMARY — Enterprise FileRecord path
      let floorplanData = await loadEnterprise(effectiveFloorId);

      // Step 3: FALLBACK — Legacy floor_floorplans (old PDF data)
      if (!floorplanData) {
        floorplanData = await searchLegacyFloorFloorplans(effectiveFloorId);
      }

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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Error fetching floor floorplan', { error: err });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [floorId, buildingId, floorNumber, companyId, findFloorId, loadEnterprise, searchLegacyFloorFloorplans]);

  useEffect(() => {
    fetchFloorplans();
  }, [fetchFloorplans]);

  return {
    floorFloorplan,
    loading,
    error,
    refetch: fetchFloorplans,
  };
}

export default useFloorFloorplans;
