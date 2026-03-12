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

  const [floorFloorplan, setFloorFloorplan] = useState<FloorFloorplanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resolve floor from buildingId + floorNumber.
   * Returns both floorId AND the floor's companyId (authoritative for file queries).
   */
  const findFloor = useCallback(async (bId: string, fNum: number): Promise<ResolvedFloor | null> => {
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

    try {
      setLoading(true);
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
          const floorsRef = collection(db, 'floors');
          const q = query(floorsRef, where('__name__', '==', effectiveFloorId));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data() as FloorDocument;
            floorCompanyId = data.companyId;
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

      // Step 2: PRIMARY — Enterprise FileRecord path (use floor's companyId first)
      let floorplanData = await loadEnterprise(effectiveFloorId, floorCompanyId);

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
  }, [floorId, buildingId, floorNumber, companyId, findFloor, loadEnterprise, searchLegacyFloorFloorplans]);

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
