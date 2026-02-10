/**
 * 🏢 ENTERPRISE IMAGE PROCESSOR
 *
 * Wrapper for PhotoUploadService that implements the FileProcessor interface.
 * Provides unified access to image upload with compression.
 *
 * Features:
 * - Image validation (type, size)
 * - Smart compression based on usage context
 * - Retry mechanism with server-side fallback
 * - Professional filename generation
 *
 * @module upload/processors/ImageProcessor
 * @version 1.0.0
 */

import type {
  FileProcessor,
  ValidationResult,
  ProcessedFile,
  ProcessorOptions,
  StoragePathOptions,
  ImageUploadOptions,
  ImageUploadResult,
  ProgressCallback,
} from '../types/upload.types';
import { ALLOWED_MIME_TYPES } from '../types/upload.types';
import { PhotoUploadService, type PhotoUploadOptions as OriginalPhotoUploadOptions } from '@/services/photo-upload.service';
import { validateImageFile } from '@/utils/file-validation';
import { smartCompressContactPhoto } from '@/subapps/geo-canvas/floor-plan-system/parsers/raster/ImageParser';
import compressionConfig, { type UsageContext } from '@/config/photo-compression-config';

// ============================================================================
// IMAGE PROCESSOR CLASS
// ============================================================================

export class ImageProcessor implements FileProcessor {
  /**
   * Check if this processor can handle the given file type
   */
  canProcess(mimeType: string, extension: string): boolean {
    const isValidMimeType = ALLOWED_MIME_TYPES.image.includes(mimeType as typeof ALLOWED_MIME_TYPES.image[number]);
    const isValidExtension = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(extension.toLowerCase());
    return isValidMimeType || isValidExtension;
  }

  /**
   * Validate an image file
   */
  validate(file: File): ValidationResult {
    // Use existing enterprise validation
    const validation = validateImageFile(file);

    return {
      isValid: validation.isValid,
      error: validation.error,
      // Note: FileValidationResult doesn't have warnings property
      warnings: [],
      detectedType: 'image',
      mimeType: file.type,
    };
  }

  /**
   * Process image file (compression)
   */
  async process(file: File, options?: ProcessorOptions): Promise<ProcessedFile> {
    // Check if compression is needed
    const enableCompression = options?.enableCompression !== false;

    if (!enableCompression) {
      return {
        file,
        metadata: {
          wasProcessed: false,
          originalSize: file.size,
          processedSize: file.size,
        },
      };
    }

    // Use centralized compression config
    const compressionUsage: UsageContext = (options?.extra?.compressionUsage as UsageContext) || 'profile-modal';
    const compressionDecision = compressionConfig.shouldCompress(file.size, compressionUsage);

    if (!compressionDecision.shouldCompress) {
      console.log('✅ IMAGE_PROCESSOR: No compression needed:', compressionDecision.strategy.reason);
      return {
        file,
        metadata: {
          wasProcessed: false,
          originalSize: file.size,
          processedSize: file.size,
          processingStrategy: 'no-compression',
        },
      };
    }

    console.log('🗜️ IMAGE_PROCESSOR: Compressing image...');

    try {
      // Map full UsageContext to the limited set supported by smartCompressContactPhoto
      type SmartCompressUsage = 'avatar' | 'list-item' | 'profile-modal' | 'print';
      const usageMap: Record<UsageContext, SmartCompressUsage> = {
        'avatar': 'avatar',
        'list-item': 'list-item',
        'profile-modal': 'profile-modal',
        'company-logo': 'profile-modal',
        'business-card': 'profile-modal',
        'document-scan': 'print',
        'technical-drawing': 'print',
        'print': 'print',
        'archive': 'print',
      };
      const mappedUsage = usageMap[compressionUsage] || 'profile-modal';

      const compressionResult = await smartCompressContactPhoto(file, mappedUsage);

      // Convert blob to file
      const compressedFile = new File([compressionResult.blob], file.name, {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      });

      console.log('✅ IMAGE_PROCESSOR: Compression completed', {
        originalSize: file.size,
        compressedSize: compressionResult.blob.size,
        ratio: compressionResult.compressionInfo.stats.compressionRatio,
      });

      return {
        file: compressedFile,
        metadata: {
          wasProcessed: true,
          originalSize: file.size,
          processedSize: compressionResult.blob.size,
          processingStrategy: compressionResult.compressionInfo.strategy,
        },
      };
    } catch (error) {
      console.warn('⚠️ IMAGE_PROCESSOR: Compression failed, using original:', error);
      return {
        file,
        metadata: {
          wasProcessed: false,
          originalSize: file.size,
          processedSize: file.size,
          processingStrategy: 'compression-failed',
        },
      };
    }
  }

  /**
   * Get storage path for image
   */
  getStoragePath(options: StoragePathOptions): string {
    const { folderPath, fileName } = options;

    if (!folderPath) {
      throw new Error('folderPath is required for image storage path');
    }

    const finalFileName = fileName || `image_${Date.now()}.jpg`;
    return `${folderPath}/${finalFileName}`.replace(/\/+/g, '/');
  }

  /**
   * 🏢 ENTERPRISE: Upload image with full processing pipeline
   */
  async uploadImage(
    file: File,
    options: ImageUploadOptions,
    onProgress?: ProgressCallback
  ): Promise<ImageUploadResult> {
    console.log('🖼️ IMAGE_PROCESSOR: Starting image upload', {
      fileName: file.name,
      fileSize: file.size,
      folderPath: options.folderPath,
    });

    // Validate
    const validation = this.validate(file);
    if (!validation.isValid) {
      console.error('❌ IMAGE_PROCESSOR: Validation failed:', validation.error);
      throw new Error(validation.error || 'Image validation failed');
    }

    onProgress?.({
      progress: 5,
      phase: 'validating',
      message: 'Επικύρωση εικόνας...',
    });

    // Map to PhotoUploadService options
    const photoOptions: OriginalPhotoUploadOptions = {
      folderPath: options.folderPath,
      fileName: options.fileName,
      onProgress: onProgress ? (p) => {
        onProgress({
          progress: p.progress,
          phase: p.phase as 'upload' | 'processing' | 'complete',
        });
      } : undefined,
      enableCompression: options.enableCompression,
      compressionUsage: options.compressionUsage,
      maxSizeKB: options.maxSizeKB,
      contactData: options.contactData,
      purpose: options.purpose,
      photoIndex: options.photoIndex,
    };

    // Use PhotoUploadService for the actual upload
    const result = await PhotoUploadService.uploadPhoto(file, photoOptions);

    console.log('✅ IMAGE_PROCESSOR: Upload completed');

    return {
      url: result.url,
      fileName: result.fileName,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      storagePath: result.storagePath,
      compressionInfo: result.compressionInfo,
    };
  }

  /**
   * Upload contact photo (convenience method)
   */
  async uploadContactPhoto(
    file: File,
    contactId?: string,
    onProgress?: ProgressCallback
  ): Promise<ImageUploadResult> {
    const result = await PhotoUploadService.uploadContactPhoto(
      file,
      contactId,
      onProgress ? (p) => {
        onProgress({
          progress: p.progress,
          phase: p.phase as 'upload' | 'processing' | 'complete',
        });
      } : undefined
    );

    return {
      url: result.url,
      fileName: result.fileName,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      storagePath: result.storagePath,
      compressionInfo: result.compressionInfo,
    };
  }

  /**
   * Upload company logo (convenience method)
   */
  async uploadCompanyLogo(
    file: File,
    companyId?: string,
    onProgress?: ProgressCallback
  ): Promise<ImageUploadResult> {
    const result = await PhotoUploadService.uploadCompanyLogo(
      file,
      companyId,
      onProgress ? (p) => {
        onProgress({
          progress: p.progress,
          phase: p.phase as 'upload' | 'processing' | 'complete',
        });
      } : undefined
    );

    return {
      url: result.url,
      fileName: result.fileName,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      storagePath: result.storagePath,
      compressionInfo: result.compressionInfo,
    };
  }

  /**
   * Delete image from storage
   */
  async deleteImage(storagePath: string): Promise<void> {
    await PhotoUploadService.deletePhoto(storagePath);
  }

  /**
   * Delete image by URL
   */
  async deleteImageByURL(url: string): Promise<void> {
    await PhotoUploadService.deletePhotoByURL(url);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance for the image processor
 */
export const imageProcessor = new ImageProcessor();
