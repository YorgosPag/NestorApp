'use client';

/**
 * photo-upload.service — Main PhotoUploadService class.
 * ADR-293: Legacy pipeline eliminated — all uploads use canonical pipeline.
 *
 * Related files:
 * - photo-upload-types.ts (shared types, loggers, utilities)
 */

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import type { FileUploadProgress } from '@/hooks/useFileUploadState';
import { smartCompressContactPhoto } from '@/subapps/geo-canvas/floor-plan-system/parsers/raster/ImageParser';
import compressionConfig, { type UsageContext } from '@/config/photo-compression-config';
import { validateImageFile } from '@/utils/file-validation';
import { FileRecordService } from '@/services/file-record.service';
import {
  validateUploadAuth,
  createPendingFileRecordWithPolicy,
  finalizeFileRecordWithPolicy,
  markFileRecordFailedWithPolicy,
} from '@/services/filesystem/file-mutation-gateway';
import {
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
  type EntityType,
  type FileDomain,
  type FileCategory,
} from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { getErrorMessage } from '@/lib/error-utils';

// ✅ ADR-065 SRP: Re-export types for backward compatibility (9 consumers)
export {
  type PhotoUploadOptions,
  type PhotoUploadResult,
  canonicalLogger,
  legacyLogger,
  resolveContactName,
  resolvePhotoPurpose,
} from './photo-upload-types';

import {
  canonicalLogger,
  legacyLogger,
  resolveContactName,
  resolvePhotoPurpose,
  type PhotoUploadOptions,
  type PhotoUploadResult,
} from './photo-upload-types';


// ============================================================================
// MAIN SERVICE
// ============================================================================

export class PhotoUploadService {
  /**
   * 🏢 Enterprise Layer 2: Firebase Upload Reliability
   * Routes to canonical or legacy pipeline based on provided fields.
   */
  static async uploadPhoto(
    file: File,
    options: PhotoUploadOptions
  ): Promise<PhotoUploadResult> {
    legacyLogger.info('Starting photo upload', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      folderPath: options.folderPath,
      compressionEnabled: options.enableCompression !== false
    });

    // Validate file using enterprise validation
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      legacyLogger.error('File validation failed', { error: validation.error });
      throw new Error(validation.error || 'Invalid file');
    }

    legacyLogger.info('File validation passed');

    // 🏢 CANONICAL PIPELINE ROUTING (ADR-031 + ADR-293 Phase 5 Batch 29)
    // entityId supersedes contactId (legacy alias); defaults CONTACT/ADMIN/PHOTOS preserve BC.
    const resolvedEntityId = options.entityId ?? options.contactId;
    const hasCanonicalFields = !!(options.companyId && resolvedEntityId && options.createdBy);

    if (hasCanonicalFields) {
      const resolvedEntityType = options.entityType ?? ENTITY_TYPES.CONTACT;
      const resolvedDomain = options.domain ?? FILE_DOMAINS.ADMIN;
      const resolvedCategory = options.category ?? FILE_CATEGORIES.PHOTOS;
      const resolvedEntityLabel = options.entityLabel
        ?? resolveContactName(options.contactName, options.contactData);
      const resolvedPurpose = resolvePhotoPurpose(options.purpose);

      canonicalLogger.info('Routing to canonical pipeline', {
        entityType: resolvedEntityType,
        entityId: resolvedEntityId,
        domain: resolvedDomain,
        category: resolvedCategory,
        companyId: options.companyId,
        createdBy: options.createdBy,
      });

      const canonicalResult = await PhotoUploadService.uploadEntityPhotoCanonical(file, {
        entityType: resolvedEntityType,
        entityId: resolvedEntityId!,
        domain: resolvedDomain,
        category: resolvedCategory,
        companyId: options.companyId!,
        createdBy: options.createdBy!,
        entityLabel: resolvedEntityLabel,
        purpose: resolvedPurpose,
        onProgress: options.onProgress,
        enableCompression: options.enableCompression,
        compressionUsage: options.compressionUsage,
      });

      return {
        success: canonicalResult.success,
        url: canonicalResult.url,
        fileName: canonicalResult.fileName,
        fileSize: canonicalResult.fileSize,
        mimeType: canonicalResult.mimeType,
        storagePath: canonicalResult.storagePath,
        compressionInfo: canonicalResult.compressionInfo,
      };
    }

    // 🚨 ADR-293: Legacy pipeline eliminated — canonical fields REQUIRED
    legacyLogger.error('Upload rejected: canonical fields (companyId, entityId|contactId, createdBy) are REQUIRED. Legacy pipeline has been removed.', {
      hasCompanyId: !!options.companyId,
      hasEntityId: !!resolvedEntityId,
      hasCreatedBy: !!options.createdBy,
    });
    throw new Error('Upload requires canonical fields (companyId, entityId, createdBy). Legacy upload pipeline has been removed (ADR-293).');
  }

  /**
   * 🏢 ENTERPRISE: Deletes photo from Firebase Storage with smart cleanup
   */
  static async deletePhoto(storagePath: string): Promise<void> {
    legacyLogger.info('Starting photo deletion', { storagePath });
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
      legacyLogger.info('Photo deleted successfully from storage');
    } catch (error: unknown) {
      if (
        PhotoUploadService.isFirebaseStorageError(error) &&
        error.code === 'storage/object-not-found'
      ) {
        legacyLogger.warn('File not found — already deleted, skipping', { storagePath });
        return;
      }
      legacyLogger.error('Storage deletion failed', { storagePath, error });
      throw error;
    }
  }

  /**
   * 🏢 ENTERPRISE: Type guard for Firebase Storage errors
   */
  private static isFirebaseStorageError(error: unknown): error is { code: string; message: string } {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'string'
    );
  }

  /**
   * 🏢 ENTERPRISE: Smart photo cleanup from URL (Base64 or Firebase Storage)
   */
  static async deletePhotoByURL(photoURL: string): Promise<void> {
    if (!photoURL || photoURL.trim() === '') {
      legacyLogger.info('Empty URL - nothing to delete');
      return;
    }

    try {
      if (this.isFirebaseStorageURL(photoURL)) {
        legacyLogger.info('Deleting Firebase Storage photo');
        const storagePath = this.extractStoragePathFromURL(photoURL);
        if (storagePath) {
          await this.deletePhoto(storagePath);
        }
      } else if (photoURL.startsWith('data:image/')) {
        legacyLogger.info('Base64 photo - no storage cleanup needed');
      } else {
        legacyLogger.warn('Unknown photo URL format', { urlPreview: photoURL.substring(0, 50) });
      }
    } catch (error) {
      legacyLogger.error('Error deleting photo by URL', { error });
    }
  }

  /**
   * 🏢 ENTERPRISE: Cleanup multiple photos with batch processing
   */
  static async cleanupMultiplePhotos(photoURLs: string[]): Promise<void> {
    if (!Array.isArray(photoURLs) || photoURLs.length === 0) {
      legacyLogger.info('No photos to cleanup');
      return;
    }

    legacyLogger.info('Starting batch cleanup', { count: photoURLs.length });

    const deletePromises = photoURLs.map(async (url, index) => {
      try {
        legacyLogger.info('Deleting photo', { index: index + 1, total: photoURLs.length });
        await this.deletePhotoByURL(url);
      } catch (error) {
        legacyLogger.error('Failed to delete photo', { index: index + 1, error });
      }
    });

    await Promise.allSettled(deletePromises);
    legacyLogger.info('Batch cleanup completed');
  }

  /**
   * 🏢 ENTERPRISE: Check if URL is Firebase Storage URL
   */
  static isFirebaseStorageURL(url: string): boolean {
    return url.includes('firebasestorage.googleapis.com') || url.includes('appspot.com');
  }

  /** Deletes contact photo */
  static async deleteContactPhoto(photoURL: string): Promise<void> {
    try {
      const storagePath = this.extractStoragePathFromURL(photoURL);
      if (storagePath) {
        await this.deletePhoto(storagePath);
      }
    } catch (error) {
      legacyLogger.error('Error deleting contact photo', { error });
    }
  }

  /** Extracts storage path from Firebase Download URL */
  private static extractStoragePathFromURL(downloadURL: string): string | null {
    try {
      const url = new URL(downloadURL);
      if (url.hostname.includes('firebasestorage.googleapis.com')) {
        const pathMatch = url.pathname.match(/\/o\/(.+)$/);
        if (pathMatch) {
          return decodeURIComponent(pathMatch[1]);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // 🏢 ENTERPRISE: CANONICAL FILE STORAGE SYSTEM
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Canonical entity-polymorphic photo upload (ADR-293 Phase 5 Batch 29).
   * Creates pending FileRecord → uploads binary → finalizes FileRecord.
   * Works for any EntityType (contact, property, building, floor, parking, storage, project).
   */
  static async uploadEntityPhotoCanonical(
    file: File,
    options: {
      entityType: EntityType;
      entityId: string;
      domain: FileDomain;
      category: FileCategory;
      createdBy: string;
      companyId: string;
      entityLabel?: string;
      purpose?: string;
      onProgress?: (progress: FileUploadProgress) => void;
      enableCompression?: boolean;
      compressionUsage?: UsageContext;
    }
  ): Promise<PhotoUploadResult & { fileRecord: FileRecord }> {
    canonicalLogger.info('Starting entity photo upload with centralized naming', {
      entityType: options.entityType,
      entityId: options.entityId,
      domain: options.domain,
      category: options.category,
      entityLabel: options.entityLabel,
      purpose: options.purpose,
      fileSize: file.size,
    });

    // ADR-292: Canonical auth validation via gateway SSoT
    await validateUploadAuth(options.companyId);

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      canonicalLogger.error('File validation failed', { error: validation.error });
      throw new Error(validation.error || 'Invalid file');
    }

    // Step A: Create pending FileRecord (via gateway — ADR-292)
    const { fileId, storagePath, fileRecord } = await createPendingFileRecordWithPolicy({
      companyId: options.companyId,
      entityType: options.entityType,
      entityId: options.entityId,
      domain: options.domain,
      category: options.category,
      entityLabel: options.entityLabel,
      purpose: options.purpose,
      originalFilename: file.name,
      ext: file.name.split('.').pop()?.toLowerCase() || 'jpg',
      contentType: file.type,
      createdBy: options.createdBy,
    });

    canonicalLogger.info('Pending FileRecord created', { fileId, storagePath });

    try {
      // Compression logic
      let fileToUpload = file;
      let compressionInfo: PhotoUploadResult['compressionInfo'] = {
        wasCompressed: false,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
      };

      if (options.enableCompression !== false) {
        const compressionUsage = options.compressionUsage || 'profile-modal';
        const compressionDecision = compressionConfig.shouldCompress(file.size, compressionUsage);

        if (compressionDecision.shouldCompress) {
          canonicalLogger.info('Compressing image');
          try {
            const compressionResult = await smartCompressContactPhoto(file, compressionUsage);
            const compressedFile = new File([compressionResult.blob], file.name, {
              type: 'image/jpeg',
              lastModified: file.lastModified,
            });

            fileToUpload = compressedFile;
            compressionInfo = {
              wasCompressed: true,
              originalSize: file.size,
              compressedSize: compressionResult.blob.size,
              compressionRatio: compressionResult.compressionInfo.stats.compressionRatio,
              strategy: compressionResult.compressionInfo.strategy,
            };

            canonicalLogger.info('Compression completed', compressionInfo);
          } catch (compressionError) {
            canonicalLogger.warn('Compression failed, uploading original', { error: compressionError });
          }
        }
      }

      // Step B: Upload binary to canonical path
      canonicalLogger.info('Uploading to canonical path', { storagePath });
      const storageRef = ref(storage, storagePath);

      const uploadResult = await new Promise<{ url: string }>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (options.onProgress) {
              options.onProgress({
                progress: Math.round(progress),
                phase: progress < 95 ? 'upload' : 'processing',
              });
            }
          },
          (error) => {
            canonicalLogger.error('Upload error', { error });
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ url: downloadURL });
            } catch (error) {
              reject(error);
            }
          }
        );
      });

      canonicalLogger.info('Binary uploaded successfully');

      // Step C: Finalize FileRecord (via gateway — ADR-292)
      await finalizeFileRecordWithPolicy({
        fileId,
        sizeBytes: fileToUpload.size,
        downloadUrl: uploadResult.url,
      });

      canonicalLogger.info('FileRecord finalized successfully');

      const finalFileRecord = await FileRecordService.getFileRecord(fileId);

      return {
        url: uploadResult.url,
        fileName: `${fileId}.${fileRecord.ext}`,
        fileSize: fileToUpload.size,
        mimeType: fileToUpload.type,
        storagePath,
        compressionInfo,
        fileRecord: finalFileRecord || fileRecord,
      };
    } catch (error) {
      canonicalLogger.error('Upload failed, marking FileRecord as failed');
      await markFileRecordFailedWithPolicy(fileId, getErrorMessage(error));
      throw error;
    }
  }

  /**
   * 🏢 ENTERPRISE: Get entity photos from canonical storage (ADR-293 Phase 5 Batch 29).
   * Polymorphic replacement for legacy getContactPhotos.
   */
  static async getEntityPhotos(
    entityType: EntityType,
    entityId: string,
    options?: {
      companyId?: string;
      domain?: FileDomain;
      category?: FileCategory;
    }
  ): Promise<FileRecord[]> {
    const resolvedDomain = options?.domain ?? FILE_DOMAINS.ADMIN;
    const resolvedCategory = options?.category ?? FILE_CATEGORIES.PHOTOS;

    canonicalLogger.info('Getting entity photos', {
      entityType,
      entityId,
      domain: resolvedDomain,
      category: resolvedCategory,
    });

    const files = await FileRecordService.getFilesByEntity(
      entityType,
      entityId,
      {
        companyId: options?.companyId,
        domain: resolvedDomain,
        category: resolvedCategory,
      }
    );

    canonicalLogger.info('Entity photos retrieved', { count: files.length });
    return files;
  }

}
