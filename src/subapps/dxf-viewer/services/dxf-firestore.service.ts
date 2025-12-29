import { db, storage } from '../../../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';
import { COLLECTIONS } from '../../../config/firestore-collections';
import type { SceneModel } from '../types/scene';
import {
  DxfSecurityValidator,
  type SecurityValidationResult,
  SecuritySeverity
} from '../security/DxfSecurityValidator';

export interface DxfFileMetadata {
  id: string;
  fileName: string;
  storageUrl: string; // Firebase Storage download URL
  lastModified: Timestamp;
  version: number;
  checksum?: string;
  sizeBytes?: number;
  entityCount?: number;
  securityValidation?: {
    validatedAt: Timestamp;
    validationResults: SecurityValidationResult[];
    isSecure: boolean;
  };
}

export interface DxfFileRecord {
  id: string;
  fileName: string;
  scene: SceneModel; // For backward compatibility - will be removed later
  lastModified: Timestamp;
  version: number;
  checksum?: string;
}

export class DxfFirestoreService {
  private static readonly COLLECTION_NAME = COLLECTIONS.CAD_FILES;
  private static readonly STORAGE_FOLDER = 'dxf-scenes';
  
  /**
   * Auto-save scene to Firestore
   */
  static async autoSave(fileId: string, fileName: string, scene: SceneModel): Promise<boolean> {
    try {

      // Get current version
      const currentDoc = await this.getFile(fileId);
      const newVersion = (currentDoc?.version || 0) + 1;
      
      const record: DxfFileRecord = {
        id: fileId,
        fileName,
        scene,
        lastModified: serverTimestamp() as Timestamp,
        version: newVersion,
        checksum: this.generateSceneChecksum(scene)
      };
      
      const docRef = doc(db, this.COLLECTION_NAME, fileId);
      await setDoc(docRef, record);

      return true;
    } catch (error) {
      console.error('❌ [DxfFirestore] Auto-save failed:', error);
      return false;
    }
  }
  
  /**
   * Load scene from Firestore
   */
  static async loadFile(fileId: string): Promise<DxfFileRecord | null> {
    try {

      return await this.getFile(fileId);
    } catch (error) {
      console.error('❌ [DxfFirestore] Load failed:', error);
      return null;
    }
  }

  // ==========================================================================
  // 🚀 NEW STORAGE-BASED METHODS (PHASE 4)
  // ==========================================================================

  // ==========================================================================
  // 🔒 ENTERPRISE SECURITY METHODS (PHASE 1)
  // ==========================================================================

  /**
   * Enterprise validation before save operations
   */
  static async validateForSave(fileName: string, scene: SceneModel): Promise<{
    isValid: boolean;
    fileId: string;
    sanitizedFileName: string;
    validationResults: SecurityValidationResult[];
  }> {
    console.log('🔒 [DxfFirestore] Running enterprise security validation...');

    // Estimate file size from scene JSON
    const sceneJson = JSON.stringify(scene, null, 0);
    const estimatedFileSize = sceneJson.length;

    // Run complete validation workflow
    const validationResults = DxfSecurityValidator.validateDxfUpload({
      fileName,
      fileSize: estimatedFileSize,
      scene
    });

    // Generate secure identifiers
    const sanitizedFileName = DxfSecurityValidator.sanitizeFileName(fileName);
    const fileId = DxfSecurityValidator.generateSecureFileId(fileName);

    // Check if validation passed
    const isValid = !DxfSecurityValidator.hasBlockingErrors(validationResults);

    const summary = DxfSecurityValidator.getValidationSummary(validationResults);

    console.log('🔒 [DxfFirestore] Security validation summary:', {
      isValid,
      fileId,
      sanitizedFileName,
      criticalErrors: summary.criticalErrors,
      highErrors: summary.highErrors,
      mediumErrors: summary.mediumErrors,
      lowWarnings: summary.lowWarnings
    });

    if (!isValid) {
      console.error('❌ [DxfFirestore] Security validation FAILED:', {
        fileName,
        fileId,
        blockingErrors: validationResults.filter(r =>
          !r.isValid && (r.severity === SecuritySeverity.HIGH || r.severity === SecuritySeverity.CRITICAL)
        ).map(r => r.message)
      });
    }

    return {
      isValid,
      fileId,
      sanitizedFileName,
      validationResults
    };
  }

  /**
   * Save scene to Firebase Storage + metadata to Firestore (Enterprise Edition)
   */
  static async saveToStorage(fileId: string, fileName: string, scene: SceneModel): Promise<boolean> {
    try {
      console.log('🔄 [DxfFirestore] Saving to Storage:', fileId);

      // 1. Create scene JSON for storage
      const sceneJson = JSON.stringify(scene, null, 0); // No formatting to save space
      const sceneBytes = new TextEncoder().encode(sceneJson);

      // 2. Upload to Firebase Storage
      const storagePath = `${this.STORAGE_FOLDER}/${fileId}/scene.json`;
      const storageRef = ref(storage, storagePath);

      const snapshot = await uploadBytes(storageRef, sceneBytes, {
        contentType: 'application/json',
        customMetadata: {
          fileName,
          version: Date.now().toString()
        }
      });

      // 3. Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);

      // 4. Get current version for incrementing
      const currentMetadata = await this.getFileMetadata(fileId);
      const newVersion = (currentMetadata?.version || 0) + 1;

      // 4.5. Run security validation for audit trail
      const validation = await this.validateForSave(fileName, scene);

      // 5. Save metadata to Firestore (NO SCENE DATA)
      const metadata: DxfFileMetadata = {
        id: fileId,
        fileName,
        storageUrl: downloadURL,
        lastModified: serverTimestamp() as Timestamp,
        version: newVersion,
        checksum: this.generateSceneChecksum(scene),
        sizeBytes: sceneBytes.length,
        entityCount: scene.entities.length,
        securityValidation: {
          validatedAt: serverTimestamp() as Timestamp,
          validationResults: validation.validationResults,
          isSecure: validation.isValid
        }
      };

      const docRef = doc(db, this.COLLECTION_NAME, fileId);
      await setDoc(docRef, metadata);

      console.log('✅ [DxfFirestore] Storage save complete:', {
        fileId,
        storageUrl: downloadURL,
        sizeKB: Math.round(sceneBytes.length / 1024),
        entities: scene.entities.length
      });

      return true;
    } catch (error: unknown) {
      // Enterprise error handling with detailed logging
      const errorDetails = {
        operation: 'saveToStorage',
        fileId,
        fileName,
        entityCount: scene.entities.length,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : { message: String(error) }
      };

      console.error('❌ [DxfFirestore] Storage save failed:', errorDetails);

      // Attempt recovery strategies for common errors
      if (error instanceof Error) {
        // Check for quota exceeded error
        if (error.message.includes('quota') || error.message.includes('QUOTA_EXCEEDED')) {
          console.warn('💾 [DxfFirestore] Storage quota exceeded - consider cleanup');
          // In production, could trigger automatic cleanup or notification
        }

        // Check for network errors
        if (error.message.includes('network') || error.message.includes('fetch')) {
          console.warn('🌐 [DxfFirestore] Network error detected - retries may help');
          // In production, could implement automatic retry with exponential backoff
        }

        // Check for permissions errors
        if (error.message.includes('permission') || error.message.includes('PERMISSION_DENIED')) {
          console.error('🔒 [DxfFirestore] Permission denied - check Firebase rules');
        }
      }

      return false;
    }
  }

  /**
   * Load scene from Firebase Storage + metadata from Firestore
   */
  static async loadFromStorage(fileId: string): Promise<DxfFileRecord | null> {
    try {
      console.log('🔄 [DxfFirestore] Loading from Storage:', fileId);

      // 1. Get metadata from Firestore
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) {
        console.log('❌ [DxfFirestore] No metadata found for:', fileId);
        return null;
      }

      // 2. Download scene from Storage
      const storageRef = ref(storage, metadata.storageUrl);
      const sceneBytes = await getBytes(storageRef);
      const sceneJson = new TextDecoder().decode(sceneBytes);
      const scene = JSON.parse(sceneJson) as SceneModel;

      console.log('✅ [DxfFirestore] Storage load complete:', {
        fileId,
        sizeKB: Math.round(sceneBytes.byteLength / 1024), // ✅ ENTERPRISE FIX: ArrayBuffer has byteLength, not length
        entities: scene.entities.length
      });

      // 3. Return in legacy format for backward compatibility
      return {
        id: metadata.id,
        fileName: metadata.fileName,
        scene,
        lastModified: metadata.lastModified,
        version: metadata.version,
        checksum: metadata.checksum
      };
    } catch (error: unknown) {
      // Enterprise error handling for load operations
      const errorDetails = {
        operation: 'loadFromStorage',
        fileId,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : { message: String(error) }
      };

      console.error('❌ [DxfFirestore] Storage load failed:', errorDetails);

      // Analyze error for recovery options
      if (error instanceof Error) {
        // Check for file not found errors
        if (error.message.includes('404') || error.message.includes('not found')) {
          console.warn('📂 [DxfFirestore] File not found in Storage - may be legacy Firestore file');
          // Caller should try fallback to Firestore
        }

        // Check for network errors
        if (error.message.includes('network') || error.message.includes('fetch')) {
          console.warn('🌐 [DxfFirestore] Network error during load - retry may help');
        }

        // Check for corrupted file errors
        if (error.message.includes('JSON') || error.message.includes('parse')) {
          console.error('💥 [DxfFirestore] File corruption detected - JSON parse failed');
          // In production, could mark file for repair or backup restoration
        }
      }

      return null;
    }
  }

  /**
   * Get file metadata only (without scene data)
   */
  static async getFileMetadata(fileId: string): Promise<DxfFileMetadata | null> {
    const docRef = doc(db, this.COLLECTION_NAME, fileId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as DxfFileMetadata;
    }

    return null;
  }

  /**
   * Check if file exists in Firestore
   */
  static async fileExists(fileId: string): Promise<boolean> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, fileId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error('❌ [DxfFirestore] File existence check failed:', error);
      return false;
    }
  }
  
  /**
   * Generate a simple checksum for change detection
   */
  private static generateSceneChecksum(scene: SceneModel): string {
    const data = {
      entityCount: scene.entities.length,
      layerCount: Object.keys(scene.layers).length,
      bounds: scene.bounds,
      units: scene.units
    };
    return btoa(JSON.stringify(data)).substring(0, 16);
  }
  
  /**
   * Internal method to get document
   */
  private static async getFile(fileId: string): Promise<DxfFileRecord | null> {
    const docRef = doc(db, this.COLLECTION_NAME, fileId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as DxfFileRecord;
    }
    
    return null;
  }

  // ==========================================================================
  // 🔄 BACKWARD COMPATIBILITY & MIGRATION HELPERS
  // ==========================================================================

  /**
   * 🔒 Enterprise Auto-save with Security Validation (V3)
   */
  static async autoSaveV3(fileName: string, scene: SceneModel): Promise<{
    success: boolean;
    fileId?: string;
    validationResults?: SecurityValidationResult[];
    errorMessage?: string;
  }> {
    try {
      console.log('🔒 [DxfFirestore] Enterprise auto-save V3 starting...', { fileName });

      // Step 1: Run security validation first
      const validation = await this.validateForSave(fileName, scene);

      if (!validation.isValid) {
        const summary = DxfSecurityValidator.getValidationSummary(validation.validationResults);
        return {
          success: false,
          validationResults: validation.validationResults,
          errorMessage: `Security validation failed: ${summary.criticalErrors + summary.highErrors} blocking errors found`
        };
      }

      // Step 2: Use validated file ID and sanitized name
      const success = await this.saveToStorage(validation.fileId, validation.sanitizedFileName, scene);

      if (success) {
        console.log('✅ [DxfFirestore] Enterprise auto-save V3 completed successfully');
        return {
          success: true,
          fileId: validation.fileId,
          validationResults: validation.validationResults
        };
      } else {
        return {
          success: false,
          errorMessage: 'Storage operation failed'
        };
      }
    } catch (error: unknown) {
      console.error('❌ [DxfFirestore] Enterprise auto-save V3 failed:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Auto-save with intelligent routing (Storage for new files, Firestore for legacy)
   * @deprecated Use autoSaveV3 for enterprise security features
   */
  static async autoSaveV2(fileId: string, fileName: string, scene: SceneModel): Promise<boolean> {
    // Check if file already exists to determine save method
    const existingMetadata = await this.getFileMetadata(fileId);

    if (existingMetadata && existingMetadata.storageUrl) {
      // File already uses Storage - continue using Storage
      return this.saveToStorage(fileId, fileName, scene);
    } else {
      // New file or legacy file - use Storage for better performance
      return this.saveToStorage(fileId, fileName, scene);
    }
  }

  /**
   * Load with intelligent routing (try Storage first, fallback to Firestore)
   */
  static async loadFileV2(fileId: string): Promise<DxfFileRecord | null> {
    try {
      // 1. Try Storage-based loading first
      const storageResult = await this.loadFromStorage(fileId);
      if (storageResult) {
        console.log('✅ [DxfFirestore] Loaded from Storage:', fileId);
        return storageResult;
      }

      // 2. Fallback to legacy Firestore loading
      console.log('🔄 [DxfFirestore] Fallback to Firestore for:', fileId);
      const firestoreResult = await this.getFile(fileId);

      if (firestoreResult) {
        // Optional: Migrate to Storage in background
        // this.migrateToStorage(fileId, firestoreResult.fileName, firestoreResult.scene);
        return firestoreResult;
      }

      return null;
    } catch (error) {
      console.error('❌ [DxfFirestore] Load V2 failed:', error);
      return null;
    }
  }

  /**
   * Migrate existing Firestore-based file to Storage
   */
  static async migrateToStorage(fileId: string, fileName: string, scene: SceneModel): Promise<boolean> {
    try {
      console.log('🔄 [DxfFirestore] Migrating to Storage:', fileId);

      // Save to Storage
      const success = await this.saveToStorage(fileId, fileName, scene);

      if (success) {
        console.log('✅ [DxfFirestore] Migration complete:', fileId);
        // Note: We don't delete the old Firestore document for safety
        // It can be cleaned up later in a separate operation
      }

      return success;
    } catch (error) {
      console.error('❌ [DxfFirestore] Migration failed:', error);
      return false;
    }
  }

  /**
   * Generate file ID from filename
   */
  static generateFileId(fileName: string): string {
    // Remove extension and sanitize for Firestore document ID
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    return baseName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100); // Firestore ID limit
  }
}