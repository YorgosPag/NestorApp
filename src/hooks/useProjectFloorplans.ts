'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type FloorplanData } from '@/services/floorplans/FloorplanService';
// ✅ ENTERPRISE: Import pako for decompression (same as FloorplanService)
// @ts-ignore - Pako module lacks TypeScript definitions
import pako from 'pako';

/** 🏢 ENTERPRISE: Firestore collection name - Single source of truth */
const FLOORPLANS_COLLECTION = 'project_floorplans';

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
    console.error('❌ Decompression error:', error);
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
    console.log('📄 [useProjectFloorplans] Processing PDF floorplan from Firestore:', {
      fileName: firestoreData.fileName,
      hasPdfImageUrl: !!firestoreData.pdfImageUrl,
      pdfImageUrlLength: firestoreData.pdfImageUrl?.length || 0,
      dimensions: firestoreData.pdfDimensions,
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

    console.log('🔔 Setting up real-time listener for project floorplan:', docId);

    const unsubscribe = onSnapshot(
      doc(db, FLOORPLANS_COLLECTION, docId),
      (snapshot) => {
        if (snapshot.exists()) {
          try {
            const rawData = snapshot.data();
            console.log('📡 [useProjectFloorplans] Raw Firestore data received:', {
              docId,
              fileType: rawData.fileType,
              hasCompressedScene: !!rawData.compressedScene,
              hasPdfImageUrl: !!rawData.pdfImageUrl,
              fileName: rawData.fileName,
              compressed: rawData.compressed
            });
            const data = processFloorplanData(rawData);
            console.log('📡 [useProjectFloorplans] Processed data:', {
              docId,
              hasData: !!data,
              fileType: data?.fileType,
              hasPdfImageUrl: !!data?.pdfImageUrl,
              timestamp: data?.timestamp
            });
            setProjectFloorplan(data);
          } catch (err) {
            console.error('❌ Error processing project floorplan:', err);
            setProjectFloorplan(null);
          }
        } else {
          console.log('📡 Project floorplan document does not exist:', docId);
          setProjectFloorplan(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('❌ Firestore listener error (project):', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      console.log('🔕 Unsubscribing from project floorplan listener:', docId);
      unsubscribe();
    };
  }, [projectIdStr, refreshTrigger]);

  // ✅ ENTERPRISE: Real-time Firestore listener for PARKING floorplan
  useEffect(() => {
    if (!projectIdStr) {
      return;
    }

    const docId = `${projectIdStr}_parking`;

    console.log('🔔 Setting up real-time listener for parking floorplan:', docId);

    const unsubscribe = onSnapshot(
      doc(db, FLOORPLANS_COLLECTION, docId),
      (snapshot) => {
        if (snapshot.exists()) {
          try {
            const data = processFloorplanData(snapshot.data());
            console.log('📡 Real-time update received for parking floorplan:', {
              docId,
              hasData: !!data,
              timestamp: data?.timestamp
            });
            setParkingFloorplan(data);
          } catch (err) {
            console.error('❌ Error processing parking floorplan:', err);
            setParkingFloorplan(null);
          }
        } else {
          console.log('📡 Parking floorplan document does not exist:', docId);
          setParkingFloorplan(null);
        }
      },
      (err) => {
        console.error('❌ Firestore listener error (parking):', err);
        setError(err.message);
      }
    );

    return () => {
      console.log('🔕 Unsubscribing from parking floorplan listener:', docId);
      unsubscribe();
    };
  }, [projectIdStr, refreshTrigger]);

  return {
    projectFloorplan,
    parkingFloorplan,
    loading,
    error,
    refetch
  };
}