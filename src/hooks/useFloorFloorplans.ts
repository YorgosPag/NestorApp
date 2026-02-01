'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floor Floorplans Hook
 * =============================================================================
 *
 * Hook for loading floor-level floorplans using FloorFloorplanService.
 * Follows the same pattern as useBuildingFloorplans and useUnitFloorplans.
 *
 * @module hooks/useFloorFloorplans
 * @enterprise ADR-060 - DXF Scene Storage Architecture
 *
 * Features:
 * - Loads floor floorplan from FloorFloorplanService
 * - Finds floor by buildingId + floorNumber when floorId is null
 * - Supports both DXF and PDF floorplans
 * - Real-time refetch capability
 *
 * @example
 * ```tsx
 * const { floorFloorplan, loading, error } = useFloorFloorplans({
 *   floorId: null,
 *   buildingId: 'building-123',
 *   floorNumber: 1,
 * });
 *
 * if (floorFloorplan?.scene) {
 *   // Render DXF scene
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FloorFloorplanService, type FloorFloorplanData } from '@/services/floorplans/FloorFloorplanService';
import { DxfFirestoreService } from '@/subapps/dxf-viewer/services/dxf-firestore.service';

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

/**
 * Floor floorplan metadata from Firestore
 */
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

/**
 * Floor document from floors collection
 */
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
 * 🏢 ENTERPRISE: Floor Floorplans Hook
 *
 * Loads floor floorplan data using multiple strategies:
 * 1. If floorId provided, use it directly
 * 2. If buildingId + floorNumber provided, find floorId from floors collection
 * 3. Search floor_floorplans collection
 * 4. Search cadFiles collection
 *
 * @param params - Floor identification parameters
 * @returns Floor floorplan data, loading state, error, and refetch function
 */
export function useFloorFloorplans(params: UseFloorFloorplansParams): UseFloorFloorplansReturn {
  const { floorId, buildingId, floorNumber } = params;

  const [floorFloorplan, setFloorFloorplan] = useState<FloorFloorplanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 🏢 ENTERPRISE: Find floorId from buildingId + floorNumber
   */
  const findFloorId = useCallback(async (bId: string, fNum: number): Promise<string | null> => {
    try {
      console.log('🔍 [useFloorFloorplans] Finding floor by buildingId + number:', { buildingId: bId, floorNumber: fNum });

      const floorsRef = collection(db, 'floors');
      const q = query(
        floorsRef,
        where('buildingId', '==', bId),
        where('number', '==', fNum)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const floorDoc = snapshot.docs[0];
        const floorData = floorDoc.data() as FloorDocument;
        console.log('✅ [useFloorFloorplans] Found floor:', { id: floorDoc.id, name: floorData.name });
        return floorDoc.id;
      }

      console.log('📋 [useFloorFloorplans] No floor found for buildingId + number');
      return null;
    } catch (err) {
      console.warn('⚠️ [useFloorFloorplans] Error finding floor:', err);
      return null;
    }
  }, []);

  /**
   * 🏢 ENTERPRISE: Strategy 1 - Search floor_floorplans collection
   */
  const searchFloorFloorplans = useCallback(async (floorIdStr: string): Promise<FloorFloorplanData | null> => {
    try {
      console.log('🔍 [useFloorFloorplans] Searching floor_floorplans collection for:', floorIdStr);

      const floorplansRef = collection(db, 'floor_floorplans');
      const q = query(floorplansRef, where('floorId', '==', floorIdStr));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data() as FloorFloorplanMetadata;

        if (docData.deleted) {
          console.log('⚠️ [useFloorFloorplans] Floorplan is deleted');
          return null;
        }

        console.log('✅ [useFloorFloorplans] Found floorplan metadata:', {
          buildingId: docData.buildingId,
          floorId: docData.floorId,
          fileType: docData.fileType,
        });

        if (docData.fileType === 'pdf' || docData.pdfImageUrl) {
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

        return await FloorFloorplanService.loadFloorplan(docData.buildingId, floorIdStr);
      }

      console.log('📋 [useFloorFloorplans] No floorplan found in floor_floorplans collection');
      return null;
    } catch (err) {
      console.warn('⚠️ [useFloorFloorplans] Error searching floor_floorplans:', err);
      return null;
    }
  }, []);

  /**
   * 🏢 ENTERPRISE: Strategy 2 - Search cadFiles collection
   */
  const searchCadFiles = useCallback(async (floorIdStr: string): Promise<FloorFloorplanData | null> => {
    try {
      console.log('🔍 [useFloorFloorplans] Searching cadFiles collection for floor:', floorIdStr);

      const cadFilesRef = collection(db, 'cadFiles');
      const snapshot = await getDocs(cadFilesRef);

      const matchingDoc = snapshot.docs.find(d => {
        const fileId = d.id;
        return fileId.includes(floorIdStr) && fileId.startsWith('floor_floorplan_');
      });

      if (matchingDoc) {
        const fileId = matchingDoc.id;
        console.log('✅ [useFloorFloorplans] Found cadFile:', fileId);

        const parts = fileId.replace('floor_floorplan_', '').split('_');
        const floorIdIndex = parts.findIndex(p => p === floorIdStr || parts.join('_').includes(floorIdStr));
        const extractedBuildingId = floorIdIndex > 0 ? parts.slice(0, floorIdIndex).join('_') : parts[0];

        const sceneData = await DxfFirestoreService.loadFileV2(fileId);

        if (sceneData) {
          return {
            buildingId: extractedBuildingId,
            floorId: floorIdStr,
            floorNumber: 0,
            type: 'floor',
            fileName: sceneData.fileName,
            timestamp: sceneData.lastModified?.toMillis?.() || Date.now(),
            fileType: 'dxf',
            scene: sceneData.scene,
          };
        }
      }

      console.log('📋 [useFloorFloorplans] No cadFile found for floor');
      return null;
    } catch (err) {
      console.warn('⚠️ [useFloorFloorplans] Error searching cadFiles:', err);
      return null;
    }
  }, []);

  /**
   * 🏢 ENTERPRISE: Strategy 3 - Load directly with FloorFloorplanService
   */
  const loadDirectly = useCallback(async (bId: string, fId: string): Promise<FloorFloorplanData | null> => {
    try {
      console.log('🔍 [useFloorFloorplans] Loading directly with FloorFloorplanService:', { buildingId: bId, floorId: fId });
      return await FloorFloorplanService.loadFloorplan(bId, fId);
    } catch (err) {
      console.warn('⚠️ [useFloorFloorplans] Error loading directly:', err);
      return null;
    }
  }, []);

  /**
   * Main fetch function - tries multiple strategies
   */
  const fetchFloorplans = useCallback(async () => {
    // Check if we have enough data to search
    if (!floorId && (!buildingId || floorNumber === null)) {
      console.log('📋 [useFloorFloorplans] No floor identification data provided');
      setFloorFloorplan(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Determine the floorId to use
      let effectiveFloorId = floorId;

      // If no floorId but have buildingId + floorNumber, find the floorId
      if (!effectiveFloorId && buildingId && floorNumber !== null) {
        effectiveFloorId = await findFloorId(buildingId, floorNumber);
      }

      if (!effectiveFloorId) {
        console.log('📋 [useFloorFloorplans] Could not determine floorId');
        setFloorFloorplan(null);
        setLoading(false);
        return;
      }

      console.log('🏢 [useFloorFloorplans] Fetching floor floorplan for:', effectiveFloorId);

      // Strategy 1: Search floor_floorplans collection
      let floorplanData = await searchFloorFloorplans(effectiveFloorId);

      // Strategy 2: Search cadFiles collection
      if (!floorplanData) {
        floorplanData = await searchCadFiles(effectiveFloorId);
      }

      // Strategy 3: Try loading directly if we have buildingId
      if (!floorplanData && buildingId) {
        floorplanData = await loadDirectly(buildingId, effectiveFloorId);
      }

      setFloorFloorplan(floorplanData);

      if (floorplanData) {
        console.log('✅ [useFloorFloorplans] Floor floorplan loaded:', {
          buildingId: floorplanData.buildingId,
          floorId: floorplanData.floorId,
          fileType: floorplanData.fileType || 'dxf',
          hasScene: !!floorplanData.scene,
          hasPdf: !!floorplanData.pdfImageUrl,
        });
      } else {
        console.log('📋 [useFloorFloorplans] No floorplan found');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ [useFloorFloorplans] Error fetching floor floorplan:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [floorId, buildingId, floorNumber, findFloorId, searchFloorFloorplans, searchCadFiles, loadDirectly]);

  // Fetch on mount and when params change
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
