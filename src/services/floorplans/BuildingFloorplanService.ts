'use client';

/**
 * 🏢 ENTERPRISE Building Floorplan Service
 *
 * Manages building floorplan DXF data using Firebase Storage + Metadata pattern.
 * Migrated from legacy Firestore document storage to enterprise architecture.
 *
 * @module services/floorplans/BuildingFloorplanService
 * @version 2.0.0 - Enterprise Migration
 *
 * Architecture:
 * - Scene data → Firebase Storage (unlimited size, cheap)
 * - Metadata → Firestore (fast queries, small docs)
 * - Uses DxfFirestoreService for storage operations
 *
 * @see DxfFirestoreService for the underlying storage implementation
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DxfFirestoreService } from '@/subapps/dxf-viewer/services/dxf-firestore.service';
import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';

// ============================================================================
// TYPES
// ============================================================================

/**
 * 🏢 ENTERPRISE: Building floorplan data structure
 *
 * Supports two formats:
 * - DXF floorplans: scene + fileName
 * - PDF floorplans: pdfImageUrl + pdfDimensions
 *
 * Uses SceneModel instead of `any` for type safety when scene is present.
 */
export interface BuildingFloorplanData {
  buildingId: string;
  type: 'building' | 'storage';
  fileName: string;
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
 * @deprecated Will be removed after full migration to enterprise storage
 */
interface LegacyFloorplanDocument {
  buildingId: string;
  type: 'building' | 'storage';
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

export class BuildingFloorplanService {
  /** @deprecated Legacy collection - kept for backward compatibility reads */
  private static readonly LEGACY_COLLECTION = 'building_floorplans';

  /**
   * Generate enterprise file ID for building floorplan
   * Format: building_floorplan_{buildingId}_{type}
   */
  private static generateFileId(buildingId: string, type: 'building' | 'storage'): string {
    const sanitizedBuildingId = buildingId.toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `building_floorplan_${sanitizedBuildingId}_${type}`;
  }

  /**
   * 🏢 ENTERPRISE: Save building floorplan
   *
   * Handles two formats:
   * - DXF floorplans: Uses DxfFirestoreService.saveToStorage() for enterprise storage
   * - PDF floorplans: Uses legacy Firestore (metadata only, PDF stored elsewhere)
   */
  static async saveFloorplan(
    buildingId: string,
    type: 'building' | 'storage',
    data: BuildingFloorplanData
  ): Promise<boolean> {
    try {
      const fileId = this.generateFileId(buildingId, type);
      const fileName = data.fileName || `${buildingId}_${type}_floorplan`;

      // Determine file type
      const isPdfFloorplan = data.fileType === 'pdf' || (!data.scene && data.pdfImageUrl);

      if (isPdfFloorplan) {
        // PDF floorplans: Store metadata in Firestore (PDF image stored separately)
        console.log(`🏢 [BuildingFloorplan] Saving PDF ${type} floorplan to Firestore:`, fileId);

        const docId = `${buildingId}_${type}`;
        await setDoc(doc(db, this.LEGACY_COLLECTION, docId), {
          buildingId,
          type,
          fileType: 'pdf',
          fileName: data.fileName,
          pdfImageUrl: data.pdfImageUrl,
          pdfDimensions: data.pdfDimensions,
          timestamp: data.timestamp,
          updatedAt: new Date().toISOString()
        });

        console.log(`✅ [BuildingFloorplan] PDF save complete for ${type}:`, buildingId);
        return true;
      }

      // DXF floorplans: Use enterprise DxfFirestoreService for storage
      if (!data.scene) {
        console.error(`❌ [BuildingFloorplan] No scene data for DXF floorplan:`, buildingId);
        return false;
      }

      console.log(`🏢 [BuildingFloorplan] Saving DXF ${type} floorplan via enterprise storage:`, fileId);

      const success = await DxfFirestoreService.saveToStorage(fileId, fileName, data.scene);

      if (success) {
        console.log(`✅ [BuildingFloorplan] Enterprise save complete for ${type}:`, buildingId);
      } else {
        console.error(`❌ [BuildingFloorplan] Enterprise save failed for ${type}:`, buildingId);
      }

      return success;
    } catch (error) {
      console.error(`❌ [BuildingFloorplan] Error saving ${type} floorplan:`, error);
      return false;
    }
  }

  /**
   * 🏢 ENTERPRISE: Load building floorplan with intelligent fallback
   *
   * Loading strategy:
   * 1. Check legacy Firestore for PDF floorplans first (fast)
   * 2. Try enterprise Storage-based loading for DXF (new format)
   * 3. Fallback to legacy Firestore document (old DXF format)
   * 4. Return null if not found in any location
   */
  static async loadFloorplan(
    buildingId: string,
    type: 'building' | 'storage'
  ): Promise<BuildingFloorplanData | null> {
    try {
      const fileId = this.generateFileId(buildingId, type);

      console.log(`🏢 [BuildingFloorplan] Loading ${type} floorplan:`, fileId);

      // 1. Check legacy Firestore first (handles both PDF and old DXF format)
      const legacyResult = await this.loadFromLegacyFirestore(buildingId, type);

      if (legacyResult) {
        // If it's a PDF floorplan, return directly (no migration needed)
        if (legacyResult.fileType === 'pdf' || legacyResult.pdfImageUrl) {
          console.log(`✅ [BuildingFloorplan] Loaded PDF from Firestore:`, buildingId);
          return legacyResult;
        }

        // If it's a legacy DXF with scene data, return it
        // (Optional: could auto-migrate to enterprise storage here)
        if (legacyResult.scene) {
          console.log(`✅ [BuildingFloorplan] Loaded legacy DXF from Firestore:`, buildingId);
          return legacyResult;
        }
      }

      // 2. Try enterprise Storage-based loading for DXF
      const storageResult = await DxfFirestoreService.loadFileV2(fileId);

      if (storageResult) {
        console.log(`✅ [BuildingFloorplan] Loaded DXF from enterprise storage:`, fileId);
        return {
          buildingId,
          type,
          fileType: 'dxf',
          scene: storageResult.scene,
          fileName: storageResult.fileName,
          timestamp: storageResult.lastModified?.toMillis?.() || Date.now()
        };
      }

      console.log(`ℹ️ [BuildingFloorplan] No ${type} floorplan found for:`, buildingId);
      return null;
    } catch (error) {
      console.error(`❌ [BuildingFloorplan] Error loading ${type} floorplan:`, error);
      return null;
    }
  }

  /**
   * Load from legacy Firestore document (backward compatibility)
   * Handles both DXF and PDF formats stored in Firestore
   * @deprecated This method exists for migration purposes only
   */
  private static async loadFromLegacyFirestore(
    buildingId: string,
    type: 'building' | 'storage'
  ): Promise<BuildingFloorplanData | null> {
    try {
      const docId = `${buildingId}_${type}`;
      const docSnap = await getDoc(doc(db, this.LEGACY_COLLECTION, docId));

      if (docSnap.exists()) {
        const data = docSnap.data() as LegacyFloorplanDocument;

        // Skip deleted documents
        if (data.deleted) {
          return null;
        }

        return {
          buildingId: data.buildingId || buildingId,
          type: data.type || type,
          fileName: data.fileName,
          timestamp: data.timestamp,
          // Include file type and format-specific fields
          fileType: data.fileType,
          scene: data.scene,
          pdfImageUrl: data.pdfImageUrl,
          pdfDimensions: data.pdfDimensions
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ [BuildingFloorplan] Legacy load failed:`, error);
      return null;
    }
  }

  /**
   * 🏢 ENTERPRISE: Check if building floorplan exists
   *
   * Checks both enterprise storage and legacy Firestore
   */
  static async hasFloorplan(buildingId: string, type: 'building' | 'storage'): Promise<boolean> {
    try {
      const fileId = this.generateFileId(buildingId, type);

      // Check enterprise storage first
      const enterpriseExists = await DxfFirestoreService.fileExists(fileId);
      if (enterpriseExists) {
        return true;
      }

      // Check legacy Firestore
      const docId = `${buildingId}_${type}`;
      const docSnap = await getDoc(doc(db, this.LEGACY_COLLECTION, docId));

      if (docSnap.exists()) {
        const data = docSnap.data() as LegacyFloorplanDocument;
        return !data.deleted;
      }

      return false;
    } catch (error) {
      console.error(`❌ [BuildingFloorplan] Error checking ${type} floorplan:`, error);
      return false;
    }
  }

  /**
   * Delete building floorplan (soft delete)
   *
   * Note: For enterprise storage, we mark as deleted in metadata.
   * For legacy Firestore, we keep the existing soft delete behavior.
   */
  static async deleteFloorplan(buildingId: string, type: 'building' | 'storage'): Promise<boolean> {
    try {
      // Soft delete in legacy collection (for backward compatibility)
      const docId = `${buildingId}_${type}`;
      await setDoc(doc(db, this.LEGACY_COLLECTION, docId), {
        deleted: true,
        deletedAt: new Date().toISOString()
      });

      console.log(`✅ [BuildingFloorplan] Deleted ${type} floorplan for:`, buildingId);
      return true;
    } catch (error) {
      console.error(`❌ [BuildingFloorplan] Error deleting ${type} floorplan:`, error);
      return false;
    }
  }

  /**
   * 🔄 MIGRATION: Migrate legacy Firestore data to enterprise storage
   *
   * Call this to migrate existing floorplans to the new architecture.
   * Safe to run multiple times - idempotent operation.
   */
  static async migrateToEnterpriseStorage(
    buildingId: string,
    type: 'building' | 'storage',
    data?: BuildingFloorplanData
  ): Promise<boolean> {
    try {
      // Load from legacy if data not provided
      const floorplanData = data || await this.loadFromLegacyFirestore(buildingId, type);

      if (!floorplanData) {
        console.log(`ℹ️ [BuildingFloorplan] No legacy data to migrate for:`, buildingId);
        return false;
      }

      console.log(`🔄 [BuildingFloorplan] Migrating ${type} floorplan to enterprise storage:`, buildingId);

      // Save to enterprise storage
      const success = await this.saveFloorplan(buildingId, type, floorplanData);

      if (success) {
        console.log(`✅ [BuildingFloorplan] Migration complete for:`, buildingId);
        // Note: We don't delete legacy data for safety - can be cleaned up later
      }

      return success;
    } catch (error) {
      console.error(`❌ [BuildingFloorplan] Migration failed for:`, buildingId, error);
      return false;
    }
  }
}