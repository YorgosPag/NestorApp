'use client';

/**
 * photo-upload.service — Main PhotoUploadService class.
 * ADR-065 SRP split: delegates legacy pipeline to photo-upload-legacy-pipeline.ts.
 *
 * Related files:
 * - photo-upload-types.ts (shared types, loggers, utilities)
 * - photo-upload-legacy-pipeline.ts (legacy upload pipeline)
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
  LEGACY_STORAGE_PATHS,
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

// ✅ ADR-065 SRP: Legacy pipeline extracted to dedicated module
import { executeLegacyUpload } from './photo-upload-legacy-pipeline';

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

    // 🏢 CANONICAL PIPELINE ROUTING (ADR-031)
    const hasCanonicalFields = !!(options.companyId && options.contactId && options.createdBy);

    if (hasCanonicalFields) {
      canonicalLogger.info('Routing to canonical pipeline', {
        contactId: options.contactId,
        companyId: options.companyId,
        createdBy: options.createdBy,
      });

      const resolvedContactName = resolveContactName(options.contactName, options.contactData);
      const resolvedPurpose = resolvePhotoPurpose(options.purpose);

      const contactId = options.contactId!;
      const companyId = options.companyId!;
      const createdBy = options.createdBy!;

      const canonicalResult = await PhotoUploadService.uploadContactPhotoCanonical(file, {
        contactId,
        companyId,
        createdBy,
        contactName: resolvedContactName,
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

    // ✅ ADR-065 SRP: Delegate to extracted legacy pipeline
    return executeLegacyUpload(file, options);
  }

  /**
   * 🏢 ENTERPRISE: Deletes photo from Firebase Storage with smart cleanup
   */
  static async deletePhoto(storagePath: string): Promise<void> {
    try {
      legacyLogger.info('Starting photo deletion', { storagePath });
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
      legacyLogger.info('Photo deleted successfully from storage');
    } catch (error: unknown) {
      legacyLogger.error('Photo delete error', { error });

      const isObjectNotFound = PhotoUploadService.isFirebaseStorageError(error) &&
                                error.code === 'storage/object-not-found';

      if (isObjectNotFound) {
        legacyLogger.warn('File not found - probably already deleted');
      } else {
        legacyLogger.error('Actual deletion error', { error });
        throw new Error('Αποτυχία διαγραφής αρχείου');
      }
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

  /**
   * @deprecated ADR-054: Use uploadContactPhotoCanonical() instead.
   */
  static async uploadContactPhoto(
    file: File,
    contactId?: string,
    onProgress?: (progress: FileUploadProgress) => void,
    compressionUsage: UsageContext = 'profile-modal'
  ): Promise<PhotoUploadResult> {
    return this.uploadPhoto(file, {
      folderPath: LEGACY_STORAGE_PATHS.CONTACTS_PHOTOS,
      fileName: file.name,
      onProgress,
      enableCompression: true,
      compressionUsage
    });
  }

  /**
   * @deprecated ADR-054: Consider using uploadPhoto() with canonical fields.
   */
  static async uploadCompanyLogo(
    file: File,
    companyId?: string,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<PhotoUploadResult> {
    const prefix = companyId ? `company_${companyId}` : process.env.NEXT_PUBLIC_DEFAULT_COMPANY_PREFIX || 'company';

    return this.uploadPhoto(file, {
      folderPath: LEGACY_STORAGE_PATHS.COMPANIES_LOGOS,
      fileName: `${prefix}_${file.name}`,
      onProgress,
      enableCompression: true,
      compressionUsage: 'company-logo'
    });
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
   * 🏢 ENTERPRISE: Canonical contact photo upload
   * Creates pending FileRecord → uploads binary → finalizes FileRecord.
   */
  static async uploadContactPhotoCanonical(
    file: File,
    options: {
      contactId: string;
      createdBy: string;
      companyId: string;
      contactName?: string;
      purpose?: 'profile' | 'id' | 'other';
      onProgress?: (progress: FileUploadProgress) => void;
      enableCompression?: boolean;
      compressionUsage?: UsageContext;
    }
  ): Promise<PhotoUploadResult & { fileRecord: FileRecord }> {
    canonicalLogger.info('Starting contact photo upload with centralized naming', {
      contactId: options.contactId,
      contactName: options.contactName,
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
      entityType: ENTITY_TYPES.CONTACT,
      entityId: options.contactId,
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      entityLabel: options.contactName,
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
   * 🏢 ENTERPRISE: Get contact photos from canonical storage
   */
  static async getContactPhotos(
    contactId: string,
    options?: { companyId?: string; includeLegacy?: boolean }
  ): Promise<FileRecord[]> {
    canonicalLogger.info('Getting contact photos', { contactId });

    const files = await FileRecordService.getFilesByEntity(
      ENTITY_TYPES.CONTACT,
      contactId,
      {
        domain: FILE_DOMAINS.ADMIN,
        category: FILE_CATEGORIES.PHOTOS,
      }
    );

    canonicalLogger.info('Contact photos retrieved', { count: files.length });
    return files;
  }

  /**
   * 🏢 ENTERPRISE: Check if URL is legacy contact photo path
   */
  static isLegacyContactPhotoPath(path: string): boolean {
    const legacyPrefix = LEGACY_STORAGE_PATHS.CONTACTS_PHOTOS;
    return path.startsWith(`${legacyPrefix}/`) || path.includes(`/${legacyPrefix}/`);
  }
}
