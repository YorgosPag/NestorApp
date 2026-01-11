/**
 * 🏢 ENTERPRISE CAD PROCESSOR
 *
 * Wrapper for DxfFirestoreService that implements the FileProcessor interface.
 * Handles DXF files and other CAD formats.
 *
 * Features:
 * - DXF file validation
 * - Security checks for malicious content
 * - Dual storage (Firestore + Firebase Storage)
 * - Scene data management
 *
 * @module upload/processors/CADProcessor
 * @version 1.0.0
 */

import type {
  FileProcessor,
  ValidationResult,
  ProcessedFile,
  ProcessorOptions,
  StoragePathOptions,
  DXFUploadOptions,
  DXFUploadResult,
  ProgressCallback,
} from '../types/upload.types';
import { UPLOAD_DEFAULTS } from '../types/upload.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Max DXF file size (100MB)
 */
const MAX_DXF_SIZE = UPLOAD_DEFAULTS.MAX_DXF_SIZE;

/**
 * Valid DXF extensions
 */
const VALID_EXTENSIONS = ['.dxf'];

/**
 * DXF magic bytes check (rough validation)
 * DXF files typically start with "0" or whitespace followed by section markers
 */
const DXF_HEADER_PATTERNS = ['0', '999', 'SECTION'];

// ============================================================================
// CAD PROCESSOR CLASS
// ============================================================================

export class CADProcessor implements FileProcessor {
  /**
   * Check if this processor can handle the given file type
   */
  canProcess(mimeType: string, extension: string): boolean {
    // DXF doesn't have a standard MIME type, check by extension
    return VALID_EXTENSIONS.includes(extension.toLowerCase());
  }

  /**
   * Validate a DXF/CAD file
   */
  validate(file: File): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      detectedType: 'dxf',
      mimeType: file.type,
    };

    // Check file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!VALID_EXTENSIONS.includes(extension)) {
      return {
        isValid: false,
        error: 'Μόνο αρχεία DXF επιτρέπονται',
        detectedType: 'dxf',
        mimeType: file.type,
      };
    }

    // Check file size
    if (file.size > MAX_DXF_SIZE) {
      return {
        isValid: false,
        error: `Το αρχείο είναι πολύ μεγάλο (μέγιστο ${Math.round(MAX_DXF_SIZE / 1024 / 1024)}MB)`,
        detectedType: 'dxf',
        mimeType: file.type,
      };
    }

    // Warning for large files
    const largeFileThreshold = 20 * 1024 * 1024; // 20MB
    if (file.size > largeFileThreshold) {
      result.warnings?.push(
        'Το αρχείο είναι μεγάλο. Η επεξεργασία μπορεί να πάρει χρόνο.'
      );
    }

    return result;
  }

  /**
   * Process DXF file (no processing needed - validation only)
   */
  async process(file: File, _options?: ProcessorOptions): Promise<ProcessedFile> {
    // DXF files don't need compression
    return {
      file,
      metadata: {
        wasProcessed: false,
        originalSize: file.size,
        processedSize: file.size,
      },
    };
  }

  /**
   * Get storage path for DXF scene
   */
  getStoragePath(options: StoragePathOptions): string {
    const { fileId } = options;

    if (!fileId) {
      throw new Error('fileId is required for DXF storage path');
    }

    return `dxf-scenes/${fileId}/scene.json`;
  }

  /**
   * Validate DXF content (basic check)
   */
  async validateDXFContent(file: File): Promise<ValidationResult> {
    try {
      // Read first 1KB to check for DXF headers
      const slice = file.slice(0, 1024);
      const text = await slice.text();
      const trimmed = text.trim();

      // Check for DXF patterns
      const hasDXFPattern = DXF_HEADER_PATTERNS.some(pattern =>
        trimmed.includes(pattern)
      );

      if (!hasDXFPattern) {
        return {
          isValid: false,
          error: 'Το αρχείο δεν φαίνεται να είναι έγκυρο DXF',
          detectedType: 'dxf',
        };
      }

      // Security: Check for potential script injection
      const dangerousPatterns = ['<script', 'javascript:', 'data:text/html'];
      const hasDangerousContent = dangerousPatterns.some(pattern =>
        text.toLowerCase().includes(pattern)
      );

      if (hasDangerousContent) {
        return {
          isValid: false,
          error: 'Το αρχείο περιέχει μη επιτρεπόμενο περιεχόμενο',
          detectedType: 'dxf',
        };
      }

      return {
        isValid: true,
        detectedType: 'dxf',
      };
    } catch (error) {
      console.error('❌ CAD_PROCESSOR: Content validation error:', error);
      return {
        isValid: false,
        error: 'Σφάλμα κατά την ανάγνωση του αρχείου',
        detectedType: 'dxf',
      };
    }
  }

  /**
   * 🏢 ENTERPRISE: Upload DXF file
   *
   * Note: Full DXF upload functionality is handled by DxfFirestoreService
   * This method provides a unified interface
   */
  async uploadDXF(
    file: File,
    options: DXFUploadOptions,
    onProgress?: ProgressCallback
  ): Promise<DXFUploadResult> {
    console.log('📐 CAD_PROCESSOR: Starting DXF upload', {
      fileName: file.name,
      fileSize: file.size,
    });

    // Validate file
    const validation = this.validate(file);
    if (!validation.isValid) {
      console.error('❌ CAD_PROCESSOR: Validation failed:', validation.error);
      throw new Error(validation.error || 'DXF validation failed');
    }

    onProgress?.({
      progress: 5,
      phase: 'validating',
      message: 'Επικύρωση DXF...',
    });

    // Validate content
    const contentValidation = await this.validateDXFContent(file);
    if (!contentValidation.isValid) {
      console.error('❌ CAD_PROCESSOR: Content validation failed:', contentValidation.error);
      throw new Error(contentValidation.error || 'DXF content validation failed');
    }

    onProgress?.({
      progress: 10,
      phase: 'processing',
      message: 'Επεξεργασία DXF...',
    });

    // For now, we'll import DxfFirestoreService dynamically to avoid circular deps
    // In a full implementation, this would use the service directly
    try {
      const { DxfFirestoreService } = await import('@/subapps/dxf-viewer/services/dxf-firestore.service');

      // Generate file ID from filename
      const fileId = DxfFirestoreService.generateFileId(file.name);

      // Read file content
      const content = await file.text();

      onProgress?.({
        progress: 50,
        phase: 'upload',
        message: 'Αποθήκευση DXF...',
      });

      // For scene data upload, use the autoSaveV2 method
      if (options.sceneData) {
        // Import SceneModel type for proper type checking
        type SceneModel = import('@/subapps/dxf-viewer/types/entities').SceneModel;
        const sceneData = options.sceneData as SceneModel;

        const success = await DxfFirestoreService.autoSaveV2(
          fileId,
          file.name,
          sceneData
        );

        if (!success) {
          throw new Error('Failed to save DXF scene data');
        }
      }

      onProgress?.({
        progress: 100,
        phase: 'complete',
        message: 'DXF αποθηκεύτηκε επιτυχώς!',
      });

      console.log('✅ CAD_PROCESSOR: Upload completed');

      return {
        url: '', // DXF scenes don't have a direct URL
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/dxf',
        storagePath: `dxf-scenes/${fileId}/scene.json`,
        dxfMetadata: {
          sceneId: fileId,
        },
      };
    } catch (error) {
      console.error('❌ CAD_PROCESSOR: Upload failed:', error);
      throw new Error('Σφάλμα κατά την αποθήκευση του DXF');
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance for the CAD processor
 */
export const cadProcessor = new CADProcessor();
