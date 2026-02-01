'use client';

/**
 * 🏢 ENTERPRISE Floor Floorplan Service
 *
 * Manages floor-level floorplan DXF/PDF data using Firebase Storage + Metadata pattern.
 * Follows the same architecture as BuildingFloorplanService.
 *
 * @module services/floorplans/FloorFloorplanService
 * @version 1.0.0
 *
 * Architecture:
 * - Scene data → Firebase Storage (unlimited size, cheap)
 * - Metadata → Firestore (fast queries, small docs)
 * - Uses DxfFirestoreService for storage operations
 *
 * @see BuildingFloorplanService for the pattern reference
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DxfFirestoreService } from '@/subapps/dxf-viewer/services/dxf-firestore.service';
import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import { Logger, LogLevel, DevNullOutput } from '@/subapps/dxf-viewer/settings/telemetry/Logger';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';

// =============================================================================
// 🏢 ENTERPRISE LOGGER CONFIGURATION
// =============================================================================

/**
 * FloorFloorplan Logger - Enterprise-grade logging
 *
 * PRODUCTION: Only ERROR level (clean console)
 * DEVELOPMENT: DEBUG level (verbose for debugging)
 */
const floorplanLogger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
  prefix: '[FloorFloorplan]',
  output: process.env.NODE_ENV === 'production' ? new DevNullOutput() : undefined
});

/**
 * Error classification for intelligent logging
 * @enterprise Pattern: Expected errors (file not found) → silent, real errors → logged
 */
const isExpectedError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  return message.includes('not found') ||
         message.includes('404') ||
         message.includes('does not exist') ||
         (message.includes('permission') && message.includes('missing'));
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * 🏢 ENTERPRISE: Floor floorplan data structure
 *
 * Supports two formats:
 * - DXF floorplans: scene + fileName
 * - PDF floorplans: pdfImageUrl + pdfDimensions
 *
 * Uses SceneModel instead of `any` for type safety when scene is present.
 */
export interface FloorFloorplanData {
  /** Building ID that contains this floor */
  buildingId: string;
  /** Floor ID */
  floorId: string;
  /** Floor number for display */
  floorNumber: number;
  /** Floorplan type */
  type: 'floor';
  /** Original filename */
  fileName: string;
  /** Upload timestamp */
  timestamp: number;
  /** File type discriminator */
  fileType?: 'dxf' | 'pdf';
  /** DXF scene data (present for DXF files) */
  scene?: SceneModel | null;
  /** PDF image URL (present for PDF files) */
  pdfImageUrl?: string;
  /** PDF dimensions (present for PDF files) */
  pdfDimensions?: { width: number; height: number } | null;
}

/**
 * Legacy Firestore document structure (for backward compatibility)
 * Supports both DXF and PDF formats stored in Firestore
 */
interface LegacyFloorplanDocument {
  buildingId: string;
  floorId: string;
  floorNumber?: number;
  type: 'floor';
  fileName: string;
  timestamp: number;
  updatedAt?: string;
  deleted?: boolean;
  deletedAt?: string;
  // DXF format fields
  scene?: SceneModel;
  // PDF format fields
  fileType?: 'dxf' | 'pdf';
  pdfImageUrl?: string;
  pdfDimensions?: { width: number; height: number } | null;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class FloorFloorplanService {
  /** Firestore collection for floor floorplans */
  private static readonly COLLECTION = 'floor_floorplans';

  /**
   * Generate enterprise file ID for floor floorplan
   * Format: floor_floorplan_{buildingId}_{floorId}
   */
  private static generateFileId(buildingId: string, floorId: string): string {
    const sanitizedBuildingId = buildingId.toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedFloorId = floorId.toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `floor_floorplan_${sanitizedBuildingId}_${sanitizedFloorId}`;
  }

  /**
   * 🏢 ENTERPRISE: Save floor floorplan
   *
   * Handles two formats:
   * - DXF floorplans: Uses DxfFirestoreService.saveToStorage() for enterprise storage
   * - PDF floorplans: Uses Firestore (metadata only, PDF stored elsewhere)
   */
  static async saveFloorplan(
    buildingId: string,
    floorId: string,
    data: FloorFloorplanData
  ): Promise<boolean> {
    try {
      const fileId = this.generateFileId(buildingId, floorId);
      const fileName = data.fileName || `${buildingId}_floor_${floorId}_floorplan`;

      // Determine file type
      const isPdfFloorplan = data.fileType === 'pdf' || (!data.scene && data.pdfImageUrl);

      if (isPdfFloorplan) {
        // PDF floorplans: Store metadata in Firestore (PDF image stored separately)
        floorplanLogger.debug(`Saving PDF floor floorplan to Firestore`, { fileId, buildingId, floorId });

        const docId = `${buildingId}_${floorId}_floor`;
        await setDoc(doc(db, this.COLLECTION, docId), {
          buildingId,
          floorId,
          floorNumber: data.floorNumber,
          type: 'floor',
          fileType: 'pdf',
          fileName: data.fileName,
          pdfImageUrl: data.pdfImageUrl,
          pdfDimensions: data.pdfDimensions,
          timestamp: data.timestamp,
          updatedAt: new Date().toISOString()
        });

        floorplanLogger.info(`PDF save complete for floor`, { buildingId, floorId });

        // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
        RealtimeService.dispatchFloorplanCreated({
          floorplanId: docId,
          floorplan: {
            buildingId,
            floorId,
            type: 'floor',
            fileType: 'pdf',
            fileName: data.fileName,
          },
          timestamp: Date.now(),
        });

        return true;
      }

      // DXF floorplans: Use enterprise DxfFirestoreService for storage
      if (!data.scene) {
        floorplanLogger.warn(`No scene data for DXF floorplan`, { buildingId, floorId });
        return false;
      }

      floorplanLogger.debug(`Saving DXF floor floorplan via enterprise storage`, { fileId, buildingId, floorId });

      const success = await DxfFirestoreService.saveToStorage(fileId, fileName, data.scene);

      if (success) {
        floorplanLogger.info(`Enterprise save complete for floor`, { buildingId, floorId });

        // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
        RealtimeService.dispatchFloorplanCreated({
          floorplanId: fileId,
          floorplan: {
            buildingId,
            floorId,
            type: 'floor',
            fileType: 'dxf',
            fileName,
          },
          timestamp: Date.now(),
        });
      } else {
        floorplanLogger.error(`Enterprise save failed for floor`, { buildingId, floorId });
      }

      return success;
    } catch (error) {
      floorplanLogger.error(`Error saving floor floorplan`, {
        buildingId,
        floorId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 🏢 ENTERPRISE: Load floor floorplan with intelligent fallback
   *
   * Loading strategy:
   * 1. Check Firestore for PDF floorplans first (fast)
   * 2. Try enterprise Storage-based loading for DXF (new format)
   * 3. Fallback to legacy Firestore document (old DXF format)
   * 4. Return null if not found in any location
   */
  static async loadFloorplan(
    buildingId: string,
    floorId: string
  ): Promise<FloorFloorplanData | null> {
    try {
      const fileId = this.generateFileId(buildingId, floorId);

      floorplanLogger.debug(`Loading floor floorplan`, { fileId, buildingId, floorId });

      // 1. Check Firestore first (handles both PDF and old DXF format)
      const firestoreResult = await this.loadFromFirestore(buildingId, floorId);

      if (firestoreResult) {
        // If it's a PDF floorplan, return directly (no migration needed)
        if (firestoreResult.fileType === 'pdf' || firestoreResult.pdfImageUrl) {
          floorplanLogger.debug(`Loaded PDF from Firestore`, { buildingId, floorId });
          return firestoreResult;
        }

        // If it's a legacy DXF with scene data, return it
        if (firestoreResult.scene) {
          floorplanLogger.debug(`Loaded legacy DXF from Firestore`, { buildingId, floorId });
          return firestoreResult;
        }
      }

      // 2. Try enterprise Storage-based loading for DXF
      const storageResult = await DxfFirestoreService.loadFileV2(fileId);

      if (storageResult) {
        floorplanLogger.debug(`Loaded DXF from enterprise storage`, { fileId });
        return {
          buildingId,
          floorId,
          floorNumber: 0, // Will be updated from context
          type: 'floor',
          fileType: 'dxf',
          scene: storageResult.scene,
          fileName: storageResult.fileName,
          timestamp: storageResult.lastModified?.toMillis?.() || Date.now()
        };
      }

      // 🏢 ENTERPRISE: Silent on "not found" - expected for floors without floorplans
      return null;
    } catch (error) {
      // 🏢 ENTERPRISE: Intelligent error classification
      if (error instanceof Error && isExpectedError(error)) {
        return null;
      }
      floorplanLogger.error(`Error loading floor floorplan`, {
        buildingId,
        floorId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Load from Firestore document
   */
  private static async loadFromFirestore(
    buildingId: string,
    floorId: string
  ): Promise<FloorFloorplanData | null> {
    try {
      const docId = `${buildingId}_${floorId}_floor`;
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));

      if (docSnap.exists()) {
        const data = docSnap.data() as LegacyFloorplanDocument;

        // Skip deleted documents
        if (data.deleted) {
          return null;
        }

        return {
          buildingId: data.buildingId || buildingId,
          floorId: data.floorId || floorId,
          floorNumber: data.floorNumber || 0,
          type: 'floor',
          fileName: data.fileName,
          timestamp: data.timestamp,
          fileType: data.fileType,
          scene: data.scene,
          pdfImageUrl: data.pdfImageUrl,
          pdfDimensions: data.pdfDimensions
        };
      }

      return null;
    } catch (error) {
      if (error instanceof Error && isExpectedError(error)) {
        return null;
      }
      floorplanLogger.warn('Firestore load failed', {
        buildingId,
        floorId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * 🏢 ENTERPRISE: Check if floor floorplan exists
   *
   * Checks both enterprise storage and Firestore
   */
  static async hasFloorplan(buildingId: string, floorId: string): Promise<boolean> {
    try {
      const fileId = this.generateFileId(buildingId, floorId);

      // Check enterprise storage first
      const enterpriseExists = await DxfFirestoreService.fileExists(fileId);
      if (enterpriseExists) {
        return true;
      }

      // Check Firestore
      const docId = `${buildingId}_${floorId}_floor`;
      const docSnap = await getDoc(doc(db, this.COLLECTION, docId));

      if (docSnap.exists()) {
        const data = docSnap.data() as LegacyFloorplanDocument;
        return !data.deleted;
      }

      return false;
    } catch (error) {
      if (error instanceof Error && isExpectedError(error)) {
        return false;
      }
      floorplanLogger.warn(`Error checking floor floorplan`, {
        buildingId,
        floorId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Delete floor floorplan (soft delete)
   */
  static async deleteFloorplan(buildingId: string, floorId: string): Promise<boolean> {
    try {
      // Soft delete in Firestore
      const docId = `${buildingId}_${floorId}_floor`;
      await setDoc(doc(db, this.COLLECTION, docId), {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      floorplanLogger.info(`Deleted floor floorplan`, { buildingId, floorId });

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatchFloorplanDeleted({
        floorplanId: docId,
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      floorplanLogger.error(`Error deleting floor floorplan`, {
        buildingId,
        floorId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}
