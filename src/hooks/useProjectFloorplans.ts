'use client';

import { useState, useEffect, useCallback } from 'react';
import { type FloorplanData } from '@/services/floorplans/FloorplanService';
import { useAuth } from '@/hooks/useAuth';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createModuleLogger } from '@/lib/telemetry';
import pako from 'pako';

const logger = createModuleLogger('useProjectFloorplans');

/** 🏢 ENTERPRISE: File type discriminator */
type FloorplanFileType = 'dxf' | 'pdf';

/** 🏢 ENTERPRISE: Firestore data interface (supports both DXF and PDF) */
interface FirestoreFloorplanData {
  projectId: string;
  buildingId?: string;
  type: 'project' | 'parking' | 'building' | 'storage';
  /** 🏢 ENTERPRISE: File type indicator */
  fileType?: FloorplanFileType;
  /** Compressed DXF scene (only for fileType: 'dxf') */
  compressedScene?: string;
  /** PDF image URL (only for fileType: 'pdf') */
  pdfImageUrl?: string;
  /** PDF dimensions (only for fileType: 'pdf') */
  pdfDimensions?: { width: number; height: number };
  fileName: string;
  timestamp: number;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
}

/** 🏢 ENTERPRISE: Hook return type */
interface UseProjectFloorplansReturn {
  projectFloorplan: FloorplanData | null;
  parkingFloorplan: FloorplanData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * 🏢 ENTERPRISE: Decompress scene data from Firestore
 * Centralized decompression - same logic as FloorplanService
 */
function decompressScene(compressedData: string): unknown {
  try {
    const binaryString = atob(compressedData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // ✅ ENTERPRISE: pako.ungzip returns string when { to: 'string' } is used
    // TypeScript requires double assertion: unknown → string (pako lacks proper types)
    const decompressed = pako.ungzip(bytes, { to: 'string' }) as unknown as string;
    return JSON.parse(decompressed);
  } catch (error) {
    logger.error('Decompression error', { error });
    throw error;
  }
}

/**
 * 🏢 ENTERPRISE: Process raw Firestore data to FloorplanData
 * Handles DXF (compressed), PDF, and legacy uncompressed data
 */
function processFloorplanData(rawData: Record<string, unknown>): FloorplanData | null {
  if (!rawData || rawData.deleted) {
    return null;
  }

  const firestoreData = rawData as unknown as FirestoreFloorplanData;
  const fileType = firestoreData.fileType || 'dxf'; // Default to DXF for backward compatibility

  // 🏢 ENTERPRISE: Handle PDF floorplan
  if (fileType === 'pdf') {
    logger.info('Processing PDF floorplan from Firestore', {
      fileName: firestoreData.fileName,
      hasPdfImageUrl: !!firestoreData.pdfImageUrl,
      projectId: firestoreData.projectId
    });

    return {
      projectId: firestoreData.projectId,
      buildingId: firestoreData.buildingId,
      type: firestoreData.type,
      fileType: 'pdf',
      scene: null,
      pdfImageUrl: firestoreData.pdfImageUrl || null,
      pdfDimensions: firestoreData.pdfDimensions || null,
      fileName: firestoreData.fileName,
      timestamp: firestoreData.timestamp
    };
  }

  // 🏢 ENTERPRISE: Handle compressed DXF floorplan
  if (firestoreData.compressed && firestoreData.compressedScene) {
    const scene = decompressScene(firestoreData.compressedScene);

    return {
      projectId: firestoreData.projectId,
      buildingId: firestoreData.buildingId,
      type: firestoreData.type,
      fileType: 'dxf',
      // 🏢 ENTERPRISE: Cast decompressed scene to proper type (DxfSceneData structure)
      scene: scene as FloorplanData['scene'],
      pdfImageUrl: null,
      pdfDimensions: null,
      fileName: firestoreData.fileName,
      timestamp: firestoreData.timestamp
    };
  }

  // 🏢 ENTERPRISE: Legacy uncompressed DXF data
  const legacyData = rawData as unknown as FloorplanData;
  return {
    ...legacyData,
    fileType: 'dxf',
    pdfImageUrl: null,
    pdfDimensions: null
  };
}

/**
 * 🏢 ENTERPRISE: Real-time Firestore hook for project floorplans
 *
 * Uses onSnapshot for automatic real-time updates across all tabs/windows.
 * When DXF Viewer saves a floorplan, the Audit page updates automatically!
 *
 * @param projectId - The project ID to watch
 * @returns FloorplanData for project and parking, with loading/error states
 */
export function useProjectFloorplans(projectId: string | number): UseProjectFloorplansReturn {
  const [projectFloorplan, setProjectFloorplan] = useState<FloorplanData | null>(null);
  const [parkingFloorplan, setParkingFloorplan] = useState<FloorplanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 🏢 ENTERPRISE: Get authentication state to prevent permission errors
  const { user, loading: authLoading } = useAuth();

  const projectIdStr = projectId.toString();

  /**
   * 🏢 ENTERPRISE: Manual refetch trigger
   * Forces re-subscription to Firestore listeners
   */
  const refetch = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // ✅ ENTERPRISE: Real-time Firestore listener for PROJECT floorplan
  useEffect(() => {
    if (!projectIdStr) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const docId = `${projectIdStr}_project`;

    logger.info('Setting up real-time listener for project floorplan', { docId });

    const unsubscribe = firestoreQueryService.subscribeDoc<FirestoreFloorplanData>(
      'PROJECT_FLOORPLANS',
      docId,
      (data) => {
        if (data) {
          try {
            const rawData = data as unknown as Record<string, unknown>;
            logger.info('Raw Firestore data received', {
              docId,
              fileType: data.fileType,
              hasCompressedScene: !!data.compressedScene,
              hasPdfImageUrl: !!data.pdfImageUrl,
              fileName: data.fileName,
              compressed: data.compressed
            });
            const processed = processFloorplanData(rawData);
            logger.info('Processed data', {
              docId,
              hasData: !!processed,
              fileType: processed?.fileType,
              hasPdfImageUrl: !!processed?.pdfImageUrl,
              timestamp: processed?.timestamp
            });
            setProjectFloorplan(processed);
          } catch (err) {
            logger.error('Error processing project floorplan', { error: err });
            setProjectFloorplan(null);
          }
        } else {
          logger.info('Project floorplan document does not exist', { docId });
          setProjectFloorplan(null);
        }
        setLoading(false);
      },
      (err) => {
        logger.error('Firestore listener error (project)', { error: err });
        setError(err.message);
        setLoading(false);
      },
      { enabled: !authLoading && !!user }
    );

    return () => {
      logger.info('Unsubscribing from project floorplan listener', { docId });
      unsubscribe();
    };
  }, [projectIdStr, refreshTrigger, user, authLoading]);

  // ✅ ENTERPRISE: Real-time Firestore listener for PARKING floorplan
  useEffect(() => {
    if (!projectIdStr) {
      return;
    }

    const docId = `${projectIdStr}_parking`;

    logger.info('Setting up real-time listener for parking floorplan', { docId });

    const unsubscribe = firestoreQueryService.subscribeDoc<FirestoreFloorplanData>(
      'PROJECT_FLOORPLANS',
      docId,
      (data) => {
        if (data) {
          try {
            const rawData = data as unknown as Record<string, unknown>;
            const processed = processFloorplanData(rawData);
            logger.info('Real-time update received for parking floorplan', {
              docId,
              hasData: !!processed,
              timestamp: processed?.timestamp
            });
            setParkingFloorplan(processed);
          } catch (err) {
            logger.error('Error processing parking floorplan', { error: err });
            setParkingFloorplan(null);
          }
        } else {
          logger.info('Parking floorplan document does not exist', { docId });
          setParkingFloorplan(null);
        }
      },
      (err) => {
        logger.error('Firestore listener error (parking)', { error: err });
        setError(err.message);
      },
      { enabled: !authLoading && !!user }
    );

    return () => {
      logger.info('Unsubscribing from parking floorplan listener', { docId });
      unsubscribe();
    };
  }, [projectIdStr, refreshTrigger, user, authLoading]);

  return {
    projectFloorplan,
    parkingFloorplan,
    loading,
    error,
    refetch
  };
}