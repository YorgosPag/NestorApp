'use client';

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import pako from 'pako';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FloorplanService');

// 🏢 ENTERPRISE: Floorplan file types
export type FloorplanFileType = 'dxf' | 'pdf';

// 🏢 ENTERPRISE: DXF Scene data type (replaces any)
export interface DxfSceneData {
  entities: Array<{
    type: string;
    layer: string;
    [key: string]: unknown;
  }>;
  layers: Record<string, {
    name: string;
    color?: string;
    visible?: boolean;
  }>;
  bounds?: {
    min: { x: number; y: number };
    max: { x: number; y: number };
  };
}

export interface FloorplanData {
  projectId: string;
  buildingId?: string; // For building-level floorplans
  type: 'project' | 'parking' | 'building' | 'storage';
  /** 🏢 ENTERPRISE: File type - DXF for drawings, PDF for background */
  fileType: FloorplanFileType;
  /** DXF scene data (only for fileType: 'dxf') */
  scene?: DxfSceneData | null;
  /** PDF rendered image as data URL (only for fileType: 'pdf') */
  pdfImageUrl?: string | null;
  /** PDF page dimensions (only for fileType: 'pdf') */
  pdfDimensions?: { width: number; height: number } | null;
  fileName: string;
  timestamp: number;
}

interface CompressedFloorplanData {
  projectId: string;
  buildingId?: string;
  type: 'project' | 'parking' | 'building' | 'storage';
  /** 🏢 ENTERPRISE: File type indicator */
  fileType: FloorplanFileType;
  /** Compressed DXF scene (only for fileType: 'dxf') */
  compressedScene?: string;
  /** PDF image URL (only for fileType: 'pdf') - stored directly, no compression needed */
  pdfImageUrl?: string;
  /** PDF dimensions (only for fileType: 'pdf') */
  pdfDimensions?: { width: number; height: number };
  fileName: string;
  timestamp: number;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
}

export class FloorplanService {
  private static COLLECTION = 'project_floorplans';

  /**
   * Compress scene data using gzip
   */
  private static compressScene(scene: DxfSceneData | null | undefined): { compressedData: string; originalSize: number; compressedSize: number } {
    try {
      const jsonString = JSON.stringify(scene);
      const originalSize = new TextEncoder().encode(jsonString).length;
      
      // Compress using pako (gzip)
      const compressed = pako.gzip(jsonString);
      
      // Convert to base64 for storage
      const compressedData = btoa(String.fromCharCode(...compressed));
      const compressedSize = compressedData.length;
      
      // Debug logging removed
      
      return { compressedData, originalSize, compressedSize };
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  /**
   * Decompress scene data
   */
  private static decompressScene(compressedData: string): DxfSceneData {
    try {
      // Convert from base64
      const binaryString = atob(compressedData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Decompress using pako
      // 🏢 ENTERPRISE: pako.ungzip returns string when { to: 'string' } is used
      const decompressed = pako.ungzip(bytes, { to: 'string' }) as unknown as string;

      // Parse JSON
      return JSON.parse(decompressed);
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  /**
   * 🏢 ENTERPRISE: Save floorplan data to Firestore
   * Supports both DXF (compressed scene) and PDF (image URL)
   */
  static async saveFloorplan(projectId: string, type: 'project' | 'parking' | 'building' | 'storage', data: FloorplanData): Promise<boolean> {
    try {
      const docId = `${projectId}_${type}`;
      const fileType = data.fileType || 'dxf'; // Default to DXF for backward compatibility

      // ✅ ENTERPRISE DEBUG: Verify floorplan save operation
      logger.info('saveFloorplan called', {
        projectId,
        type,
        docId,
        fileType,
        fileName: data.fileName,
        hasScene: fileType === 'dxf' ? !!data.scene : false,
        hasPdfImage: fileType === 'pdf' ? !!data.pdfImageUrl : false,
        entitiesCount: data.scene?.entities?.length || 0
      });

      let docData: CompressedFloorplanData;

      if (fileType === 'pdf') {
        // 🏢 ENTERPRISE: PDF floorplan - store image URL directly
        const pdfSize = data.pdfImageUrl?.length || 0;
        docData = {
          projectId,
          type,
          fileType: 'pdf',
          pdfImageUrl: data.pdfImageUrl || undefined,
          pdfDimensions: data.pdfDimensions || undefined,
          fileName: data.fileName,
          timestamp: data.timestamp,
          compressed: false, // PDF images are not compressed
          originalSize: pdfSize,
          compressedSize: pdfSize,
        };
      } else {
        // 🏢 ENTERPRISE: DXF floorplan - compress scene data
        const { compressedData, originalSize, compressedSize } = this.compressScene(data.scene);
        docData = {
          projectId,
          type,
          fileType: 'dxf',
          compressedScene: compressedData,
          fileName: data.fileName,
          timestamp: data.timestamp,
          compressed: true,
          originalSize,
          compressedSize,
        };
      }

      // Only include buildingId if it's defined
      if (data.buildingId !== undefined) {
        docData.buildingId = data.buildingId;
      }

      // Debug logging removed
      // console.log(`🗂️ Document data being saved:`, {
      //   docId,
      //   fileName: docData.fileName,
      //   timestamp: docData.timestamp,
      //   updatedAt: docData.updatedAt,
      //   compressed: docData.compressed,
      //   originalSize: docData.originalSize,
      //   compressedSize: docData.compressedSize,
      //   compressionRatio: `${((1 - docData.compressedSize/docData.originalSize) * 100).toFixed(1)}%`,
      //   entitiesCount: data.scene?.entities?.length || 0
      // });

      await setDoc(doc(db, this.COLLECTION, docId), docData);

      // ✅ ENTERPRISE DEBUG: Confirm successful save
      logger.info('Successfully saved floorplan to Firestore', {
        docId,
        collection: this.COLLECTION,
        fileType,
        compressionRatio: docData.compressed ? `${((1 - docData.compressedSize/docData.originalSize) * 100).toFixed(1)}%` : 'N/A (PDF)'
      });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatchFloorplanCreated({
        floorplanId: docId,
        floorplan: {
          entityType: ENTITY_TYPES.PROJECT,
          entityId: projectId,
          name: data.fileName,
        },
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      // ✅ ENTERPRISE DEBUG: Log error details
      logger.error('saveFloorplan FAILED', {
        projectId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * 🏢 ENTERPRISE: Load floorplan data from Firestore
   * Supports both DXF (compressed scene) and PDF (image URL)
   */
  static async loadFloorplan(projectId: string, type: 'project' | 'parking' | 'building' | 'storage'): Promise<FloorplanData | null> {
    try {
      const docId = `${projectId}_${type}`;
      // ✅ ENTERPRISE DEBUG: Log load attempt
      logger.info('loadFloorplan called', { projectId, type, docId });

      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));

      if (docSnap.exists()) {
        const rawData = docSnap.data();
        const fileType = (rawData.fileType as FloorplanFileType) || 'dxf'; // Default to DXF for backward compatibility

        // 🏢 ENTERPRISE: Handle PDF floorplan
        if (fileType === 'pdf') {
          const pdfData = rawData as CompressedFloorplanData;
          const data: FloorplanData = {
            projectId: pdfData.projectId,
            buildingId: pdfData.buildingId,
            type: pdfData.type,
            fileType: 'pdf',
            pdfImageUrl: pdfData.pdfImageUrl || null,
            pdfDimensions: pdfData.pdfDimensions || null,
            scene: null,
            fileName: pdfData.fileName,
            timestamp: pdfData.timestamp
          };
          logger.info('Loaded PDF floorplan', { docId, fileName: data.fileName });
          return data;
        }

        // 🏢 ENTERPRISE: Handle DXF floorplan (compressed)
        if (rawData.compressed && rawData.compressedScene) {
          const compressedData = rawData as CompressedFloorplanData;

          // Decompress scene (compressedScene is guaranteed to exist by if-check above)
          const scene = this.decompressScene(compressedData.compressedScene!);

          // Return as standard FloorplanData
          const data: FloorplanData = {
            projectId: compressedData.projectId,
            buildingId: compressedData.buildingId,
            type: compressedData.type,
            fileType: 'dxf',
            scene: scene,
            pdfImageUrl: null,
            pdfDimensions: null,
            fileName: compressedData.fileName,
            timestamp: compressedData.timestamp
          };

          // Debug logging removed - Successfully loaded compressed floorplan
          
          return data;
        } else {
          // Legacy uncompressed data - assume DXF
          const legacyData = rawData as Partial<FloorplanData>;
          const data: FloorplanData = {
            projectId: legacyData.projectId || projectId,
            buildingId: legacyData.buildingId,
            type: legacyData.type || type,
            fileType: 'dxf',
            scene: legacyData.scene || null,
            pdfImageUrl: null,
            pdfDimensions: null,
            fileName: legacyData.fileName || 'unknown.dxf',
            timestamp: legacyData.timestamp || Date.now()
          };
          logger.info('Loaded legacy uncompressed floorplan', { docId });
          return data;
        }
      } else {
        // ✅ ENTERPRISE DEBUG: Document not found
        logger.warn('No floorplan found', { projectId, type, docId });
        return null;
      }
    } catch (error) {
      // ✅ ENTERPRISE DEBUG: Log load error
      logger.error('loadFloorplan FAILED', {
        projectId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Check if floorplan exists
   */
  static async hasFloorplan(projectId: string, type: 'project' | 'parking' | 'building' | 'storage'): Promise<boolean> {
    try {
      const docId = `${projectId}_${type}`;
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));
      return docSnap.exists();
    } catch (error) {
      // Error logging removed //(`❌ Error checking ${type} floorplan:`, error);
      return false;
    }
  }

  /**
   * Delete floorplan
   */
  static async deleteFloorplan(projectId: string, type: 'project' | 'parking' | 'building' | 'storage'): Promise<boolean> {
    try {
      const docId = `${projectId}_${type}`;
      // Debug logging removed - Deleting floorplan from Firestore
      
      // Note: We could use deleteDoc here, but for now just mark as deleted
      await setDoc(doc(db, this.COLLECTION, docId), {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatchFloorplanDeleted({
        floorplanId: docId,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      // Error logging removed //(`❌ Error deleting ${type} floorplan:`, error);
      return false;
    }
  }
}
