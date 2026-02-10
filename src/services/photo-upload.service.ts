'use client';

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useFileUploadState';
import { smartCompressContactPhoto } from '@/subapps/geo-canvas/floor-plan-system/parsers/raster/ImageParser';
import compressionConfig, { type UsageContext } from '@/config/photo-compression-config';
import { validateImageFile } from '@/utils/file-validation';
import { generateTempId } from '@/services/enterprise-id.service';
// 🏢 ENTERPRISE: Canonical File Storage System imports
import { FileRecordService } from '@/services/file-record.service';
import {
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
  PHOTO_PURPOSES,
  DEPRECATION_MESSAGES,
  FILE_STORAGE_FLAGS,
  FILE_STORAGE_ERROR_MESSAGES,
  type PhotoPurpose,
} from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';
import { createModuleLogger } from '@/lib/telemetry';
import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// MODULE LOGGERS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Logger for canonical file storage flows
 * Uses canonical logger from src/lib/telemetry
 */
const canonicalLogger = createModuleLogger('CANONICAL_UPLOAD');

/**
 * 🏢 ENTERPRISE: Logger for legacy photo upload methods
 * Uses canonical logger from src/lib/telemetry
 */
const legacyLogger = createModuleLogger('PHOTO_UPLOAD');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoUploadOptions {
  /** Folder path in Firebase Storage (e.g., 'contacts', 'projects') */
  folderPath: string;
  /** Optional custom filename (will use original if not provided) */
  fileName?: string;
  /** Progress callback */
  onProgress?: (progress: FileUploadProgress) => void;
  /** Enable automatic compression (default: true) */
  enableCompression?: boolean;
  /** Compression usage context for smart compression */
  compressionUsage?: UsageContext;
  /** Maximum file size before compression is forced (default: 500KB) */
  maxSizeKB?: number;
  /** Contact data for FileNamingService (optional) */
  contactData?: ContactFormData | { type?: string; name?: string; id?: string; [key: string]: unknown };
  /** Upload purpose for FileNamingService (optional) */
  purpose?: string;
  /** Photo index for FileNamingService (optional) */
  photoIndex?: number;

  // =========================================================================
  // 🏢 CANONICAL PIPELINE FIELDS (ADR-031)
  // =========================================================================
  // If ALL THREE canonical fields are provided, the upload will use the
  // canonical pipeline (createPendingFileRecord → upload → finalize).
  // Otherwise, legacy folderPath pipeline is used with deprecation warning.
  // =========================================================================

  /** 🏢 CANONICAL: Contact ID for FileRecord linkage */
  contactId?: string;
  /** 🏢 CANONICAL: Company ID for multi-tenant isolation (REQUIRED for canonical) */
  companyId?: string;
  /** 🏢 CANONICAL: User ID who is uploading */
  createdBy?: string;
  /** 🏢 CANONICAL: Contact name for display name generation */
  contactName?: string;
}

export interface PhotoUploadResult extends FileUploadResult {
  /** Firebase Storage reference path */
  storagePath: string;
  /** Compression information (if compression was applied) */
  compressionInfo?: {
    wasCompressed: boolean;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    strategy?: string;
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generates a unique filename for Firebase Storage
 * 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
 */
function generateUniqueFileName(originalName: string, prefix?: string): string {
  const timestamp = Date.now();
  const uniqueId = generateTempId(); // Crypto-secure temp ID
  const extension = originalName.substring(originalName.lastIndexOf('.'));
  const baseName = originalName.substring(0, originalName.lastIndexOf('.'))
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50); // Limit length

  return prefix
    ? `${prefix}_${baseName}_${timestamp}_${uniqueId}${extension}`
    : `${baseName}_${timestamp}_${uniqueId}${extension}`;
}


// ============================================================================
// TYPE-SAFE HELPER FUNCTIONS (ADR-031)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Type-safe contact name resolution
 * Resolves contact name from options without unsafe `as string` casts
 *
 * @param contactName - Direct contact name if provided
 * @param contactData - Contact data object with possible name field
 * @returns Resolved contact name or undefined (handled by naming builder)
 */
function resolveContactName(
  contactName: string | undefined,
  contactData: { name?: string } | undefined
): string | undefined {
  // Priority: explicit contactName > contactData.name
  if (contactName && typeof contactName === 'string' && contactName.trim()) {
    return contactName.trim();
  }

  if (contactData?.name && typeof contactData.name === 'string' && contactData.name.trim()) {
    return contactData.name.trim();
  }

  // Return undefined - naming builder will use i18n fallback
  return undefined;
}

/**
 * 🏢 ENTERPRISE: Type-safe photo purpose resolution
 * Validates purpose against domain constants
 *
 * @param purpose - Purpose string from options
 * @returns Valid PhotoPurpose value (defaults to PROFILE)
 */
function resolvePhotoPurpose(purpose: string | undefined): PhotoPurpose {
  const validPurposes = Object.values(PHOTO_PURPOSES);

  if (purpose && validPurposes.includes(purpose as PhotoPurpose)) {
    return purpose as PhotoPurpose;
  }

  // Default to profile if not specified or invalid
  return PHOTO_PURPOSES.PROFILE;
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class PhotoUploadService {
  /**
   * 🏢 Enterprise Layer 2: Firebase Upload Reliability
   * Uploads photo to Firebase Storage with enhanced reliability and progress tracking
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

    // =========================================================================
    // 🏢 CANONICAL PIPELINE ROUTING (ADR-031)
    // =========================================================================
    // If ALL canonical fields are provided, use canonical pipeline.
    // Otherwise, use legacy pipeline with deprecation warning (or hard error in production).
    // =========================================================================
    const hasCanonicalFields = !!(options.companyId && options.contactId && options.createdBy);

    if (hasCanonicalFields) {
      canonicalLogger.info('Routing to canonical pipeline', {
        contactId: options.contactId,
        companyId: options.companyId,
        createdBy: options.createdBy,
      });

      // 🏢 ENTERPRISE: Type-safe contact name resolution (no `as string` casts)
      const resolvedContactName = resolveContactName(options.contactName, options.contactData);

      // 🏢 ENTERPRISE: Type-safe purpose resolution using domain constants
      const resolvedPurpose = resolvePhotoPurpose(options.purpose);

      // Delegate to canonical method
      const canonicalResult = await PhotoUploadService.uploadContactPhotoCanonical(file, {
        contactId: options.contactId!,
        companyId: options.companyId!,
        createdBy: options.createdBy!,
        contactName: resolvedContactName,
        purpose: resolvedPurpose,
        onProgress: options.onProgress,
        enableCompression: options.enableCompression,
        compressionUsage: options.compressionUsage,
      });

      // Return result compatible with legacy interface
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

    // =========================================================================
    // 🚨 PRODUCTION LOCK: Block legacy writes if feature flag is enabled
    // =========================================================================
    if (FILE_STORAGE_FLAGS.BLOCK_LEGACY_WRITES) {
      legacyLogger.error(FILE_STORAGE_ERROR_MESSAGES.PRODUCTION_LOCK);
      throw new Error(FILE_STORAGE_ERROR_MESSAGES.PRODUCTION_LOCK);
    }

    // =========================================================================
    // ⚠️ LEGACY PIPELINE (DEPRECATED) - Migration mode only
    // =========================================================================
    legacyLogger.warn(DEPRECATION_MESSAGES.LEGACY_UPLOAD);

    // 🔥 COMPRESSION LOGIC
    let fileToUpload = file;
    let compressionInfo: PhotoUploadResult['compressionInfo'] = {
      wasCompressed: false,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 0
    };

    if (options.enableCompression !== false) {
      const compressionUsage = options.compressionUsage || 'profile-modal';

      // Use centralized compression config
      const compressionDecision = compressionConfig.shouldCompress(file.size, compressionUsage);

      if (compressionDecision.shouldCompress) {
        legacyLogger.info('Compression needed', {
          reason: compressionDecision.strategy.reason,
          strategy: compressionDecision.strategy.name,
          targetProfile: compressionDecision.strategy.profile,
          estimatedSavings: compressionDecision.estimatedSavings,
        });

        try {
          const compressionResult = await smartCompressContactPhoto(file, compressionUsage);

          // Convert blob to file
          const compressedFile = new File([compressionResult.blob], file.name, {
            type: 'image/jpeg',
            lastModified: file.lastModified
          });

          fileToUpload = compressedFile;
          compressionInfo = {
            wasCompressed: true,
            originalSize: file.size,
            compressedSize: compressionResult.blob.size,
            compressionRatio: compressionResult.compressionInfo.stats.compressionRatio,
            strategy: compressionResult.compressionInfo.strategy
          };

          legacyLogger.info('Compression completed', {
            strategy: compressionResult.compressionInfo.strategy,
            originalSize: `${Math.round(file.size / 1024)}KB`,
            compressedSize: `${Math.round(compressionResult.blob.size / 1024)}KB`,
            savings: `${compressionInfo.compressionRatio}%`
          });
        } catch (compressionError) {
          legacyLogger.warn('Compression failed, uploading original', { error: compressionError });
          // Continue with original file if compression fails
        }
      } else {
        legacyLogger.info('No compression needed', { reason: compressionDecision.strategy.reason });
      }
    }

    legacyLogger.info('Final upload file', {
      fileName: fileToUpload.name,
      fileSize: `${Math.round(fileToUpload.size / 1024)}KB`,
      fileType: fileToUpload.type,
      wasCompressed: compressionInfo.wasCompressed
    });

    // Check authentication status and try anonymous login if needed
    legacyLogger.info('Checking authentication status', {
      isAuthenticated: !!auth.currentUser,
    });

    // 🔧 FIX: Skip authentication for development - Firebase Storage rules should allow uploads
    legacyLogger.info('Proceeding with upload (authentication optional for storage)');

    try {
      // 🏢 ENTERPRISE: Use FileNamingService για client-side uploads
      let fileName: string;

      if (options.fileName) {
        // Use provided custom filename
        fileName = options.fileName;
      } else if (options.contactData && fileToUpload.type.startsWith('image/')) {
        // Use FileNamingService για professional naming
        try {
          const { FileNamingService } = await import('@/services/FileNamingService');

          // Map purpose string to FileNamingService purpose type
          let servicePurpose: 'logo' | 'photo' | 'representative' = 'photo';
          if (options.purpose === 'logo') {
            servicePurpose = 'logo';
          } else if (options.purpose === 'representative' || options.purpose === 'avatar') {
            servicePurpose = 'representative';
          }

          // Generate professional filename
          // 🏢 ENTERPRISE: Type assertion for backward compatibility with partial contact data
          const renamedFile = FileNamingService.generateProperFilename(
            fileToUpload,
            options.contactData as unknown as import('@/types/ContactFormTypes').ContactFormData,
            servicePurpose,
            options.photoIndex
          );

          fileName = renamedFile.name;

          legacyLogger.info('FileNamingService applied', {
            original: fileToUpload.name,
            renamed: fileName,
            purpose: servicePurpose,
            contactType: options.contactData.type
          });

        } catch (error) {
          legacyLogger.error('FileNamingService failed, using fallback', { error });
          fileName = generateUniqueFileName(fileToUpload.name);
        }
      } else {
        // Fallback to unique filename generation
        fileName = generateUniqueFileName(fileToUpload.name);
      }

      // 🔧 FIX: Ensure simple path format for Firebase Storage
      const storagePath = `${options.folderPath}/${fileName}`.replace(/\/+/g, '/'); // Remove double slashes

      legacyLogger.info('Storage path configured', {
        folderPath: options.folderPath,
        fileName: fileName,
        finalPath: storagePath
      });
      const storageRef = ref(storage, storagePath);
      legacyLogger.info('Storage reference created');

      // 🏢 ENTERPRISE LAYER 2: Enhanced reliability mechanisms με INCREASED timeouts για Firebase Storage
      const maxRetries = 2; // Μείωσα από 3 σε 2
      const progressTimeout = 10000; // Αύξησα από 5s σε 10s για καλύτερη σταθερότητα
      const totalTimeout = 45000; // Αύξησα από 15s σε 45s για Firebase Storage
      let currentAttempt = 0;

      const attemptUpload = (): Promise<PhotoUploadResult> => {
        currentAttempt++;
        legacyLogger.info('Upload attempt', { attempt: currentAttempt, maxRetries });

        return new Promise<PhotoUploadResult>((resolve, reject) => {
          // Create upload task with resumable upload
          const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

          let progressReceived = false;
          let lastProgressTime = Date.now();

          // 🕐 Progressive timeout mechanism - IMMEDIATE FALLBACK
          const progressTimeoutId = setTimeout(() => {
            if (!progressReceived) {
              legacyLogger.warn('No progress - trying fallback', { timeout: progressTimeout, attempt: currentAttempt });
              uploadTask.cancel();

              // 🚀 IMMEDIATE FALLBACK: Δεν περιμένω retries - πάω κατευθείαν σε server-side
              legacyLogger.info('Client-side stuck - attempting server-side fallback');
              PhotoUploadService.fallbackToServerUpload(fileToUpload, options, compressionInfo)
                .then(resolve)
                .catch(reject);
            }
          }, progressTimeout);

          // 🕐 Total timeout mechanism - IMMEDIATE FALLBACK
          const totalTimeoutId = setTimeout(() => {
            legacyLogger.warn('Total upload timeout', { timeout: totalTimeout, attempt: currentAttempt });
            uploadTask.cancel();

            // 🚀 IMMEDIATE FALLBACK: Πάω κατευθείαν σε server-side upload
            legacyLogger.info('Upload timeout - attempting server-side fallback');
            PhotoUploadService.fallbackToServerUpload(fileToUpload, options, compressionInfo)
              .then(resolve)
              .catch(reject);
          }, totalTimeout);

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              // Clear timeouts on first progress - upload is active
              if (!progressReceived) {
                progressReceived = true;
                clearTimeout(progressTimeoutId);
                legacyLogger.info('Upload started successfully', { attempt: currentAttempt });
              }
              lastProgressTime = Date.now();

              // Progress tracking
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              legacyLogger.info('Upload progress', { progress: Math.round(progress), attempt: currentAttempt });

              // Determine phase based on progress
              let phase: FileUploadProgress['phase'];
              if (progress < 50) {
                phase = 'upload';
              } else if (progress < 95) {
                phase = 'processing';
              } else {
                phase = 'complete';
              }

              // Call progress callback
              if (options.onProgress) {
                options.onProgress({
                  progress: Math.round(progress),
                  phase
                });
              }
            },
            (error) => {
              // Clear timeouts on error
              clearTimeout(progressTimeoutId);
              clearTimeout(totalTimeoutId);

              // Handle upload errors
              legacyLogger.error('Photo upload error', {
                attempt: currentAttempt,
                code: error.code,
                message: error.message
              });

              const isRetryableError =
                error.code === 'storage/retry-limit-exceeded' ||
                error.code === 'storage/canceled' ||
                (error.code === 'storage/unknown' &&
                 error.message &&
                 (error.message.includes('retry') || error.message.includes('Max retry time')));

              if (isRetryableError && currentAttempt < maxRetries) {
                legacyLogger.info('Retrying upload', { errorCode: error.code, nextAttempt: currentAttempt + 1, maxRetries });
                setTimeout(() => {
                  attemptUpload().then(resolve).catch(reject);
                }, 2000 * currentAttempt); // Exponential backoff
                return;
              } else if (currentAttempt >= maxRetries && isRetryableError) {
                // 🚀 FALLBACK: Try server-side upload when retryable error persists
                legacyLogger.info('All client-side retries failed - attempting server-side fallback');
                PhotoUploadService.fallbackToServerUpload(fileToUpload, options, compressionInfo)
                  .then(resolve)
                  .catch(reject);
                return;
              }

              let errorMessage: string;
              switch (error.code) {
                case 'storage/unauthorized':
                  errorMessage = 'Δεν έχετε άδεια για ανέβασμα αρχείων';
                  break;
                case 'storage/canceled':
                  errorMessage = currentAttempt >= maxRetries
                    ? 'Πρόβλημα δικτύου - Δοκιμάστε ξανά σε λίγο'
                    : 'Το ανέβασμα ακυρώθηκε';
                  break;
                case 'storage/retry-limit-exceeded':
                  legacyLogger.info('Detected retry-limit-exceeded error');
                  errorMessage = 'Πρόβλημα δικτύου - Δοκιμάστε ξανά σε λίγο';
                  break;
                case 'storage/unknown':
                  const isHiddenRetryError = error.message &&
                    (error.message.includes('retry') || error.message.includes('Max retry time'));

                  errorMessage = isHiddenRetryError
                    ? 'Πρόβλημα δικτύου - Δοκιμάστε ξανά σε λίγο'
                    : 'Άγνωστο σφάλμα κατά το ανέβασμα';

                  legacyLogger.info('Unknown error analysis', { isHiddenRetryError, message: error.message });
                  break;
                default:
                  errorMessage = 'Σφάλμα κατά το ανέβασμα αρχείου';
              }

              reject(new Error(errorMessage));
            },
            async () => {
              // Clear timeouts on success
              clearTimeout(progressTimeoutId);
              clearTimeout(totalTimeoutId);

              try {
                // Upload completed successfully
                legacyLogger.info('Upload completed successfully', { attempt: currentAttempt });
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                legacyLogger.info('Download URL obtained', { url: downloadURL });

                resolve({
                  url: downloadURL,
                  fileName: fileName,
                  fileSize: fileToUpload.size,
                  mimeType: fileToUpload.type,
                  storagePath: storagePath,
                  compressionInfo: compressionInfo
                });
              } catch (error) {
                legacyLogger.error('Failed to get download URL', { error });
                reject(new Error('Αποτυχία λήψης URL αρχείου'));
              }
            }
          );
        });
      };

      // Start the upload with retry mechanism
      return await attemptUpload();

    } catch (error) {
      legacyLogger.error('Photo upload service error', { error });
      throw new Error('Σφάλμα υπηρεσίας ανεβάσματος');
    }
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

      // 🏢 ENTERPRISE: Type-safe error handling without `as any`
      const isObjectNotFound = PhotoUploadService.isFirebaseStorageError(error) &&
                                error.code === 'storage/object-not-found';

      if (isObjectNotFound) {
        // File doesn't exist - this is OK, probably already deleted
        legacyLogger.warn('File not found - probably already deleted');
      } else {
        // Actual deletion error - throw
        legacyLogger.error('Actual deletion error', { error });
        throw new Error('Αποτυχία διαγραφής αρχείου');
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Type guard for Firebase Storage errors
   * Replaces unsafe `as any` with proper TypeScript type checking
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
        // Base64 photos don't need storage cleanup
      } else {
        legacyLogger.warn('Unknown photo URL format', { urlPreview: photoURL.substring(0, 50) });
      }
    } catch (error) {
      legacyLogger.error('Error deleting photo by URL', { error });
      // Don't throw - deletion failures shouldn't break the app
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
        // Continue with other photos even if one fails
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
   * Uploads contact photo specifically with optimized compression για profiles
   *
   * @deprecated ADR-054: Use uploadContactPhotoCanonical() instead for new code.
   * This method does not create FileRecord documents in Firestore.
   * The canonical method ensures proper audit trail and multi-tenant isolation.
   *
   * @example
   * ```typescript
   * // ❌ DEPRECATED: Don't use this
   * await PhotoUploadService.uploadContactPhoto(file, contactId);
   *
   * // ✅ CANONICAL: Use this instead
   * await PhotoUploadService.uploadContactPhotoCanonical(file, {
   *   contactId: 'contact_123',
   *   companyId: 'company_xyz',
   *   createdBy: 'user_abc',
   * });
   * ```
   */
  static async uploadContactPhoto(
    file: File,
    contactId?: string,
    onProgress?: (progress: FileUploadProgress) => void,
    compressionUsage: UsageContext = 'profile-modal'
  ): Promise<PhotoUploadResult> {
    const prefix = contactId ? `contact_${contactId}` : 'contact';

    return this.uploadPhoto(file, {
      folderPath: 'contacts/photos',
      fileName: file.name, // 🔥 Use the exact filename from the file object
      onProgress,
      enableCompression: true,
      compressionUsage: compressionUsage
    });
  }

  /**
   * Uploads company logo specifically with optimized compression για logos
   *
   * @deprecated ADR-054: Consider using uploadPhoto() with canonical fields for new code.
   * This method does not create FileRecord documents in Firestore.
   *
   * @example
   * ```typescript
   * // ❌ DEPRECATED: Don't use this
   * await PhotoUploadService.uploadCompanyLogo(file, companyId);
   *
   * // ✅ CANONICAL: Use uploadPhoto with canonical fields
   * await PhotoUploadService.uploadPhoto(file, {
   *   folderPath: 'companies/logos',
   *   companyId: 'company_xyz',
   *   createdBy: 'user_abc',
   *   contactId: 'company_xyz', // Use companyId as entityId for company files
   * });
   * ```
   */
  static async uploadCompanyLogo(
    file: File,
    companyId?: string,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<PhotoUploadResult> {
    // 🏢 ENTERPRISE: Dynamic prefix generation based on company data
    const prefix = companyId ? `company_${companyId}` : process.env.NEXT_PUBLIC_DEFAULT_COMPANY_PREFIX || 'company';

    return this.uploadPhoto(file, {
      folderPath: 'companies/logos',
      fileName: `${prefix}_${file.name}`,
      onProgress,
      enableCompression: true,
      compressionUsage: 'company-logo' // Specialized compression για company logos
    });
  }

  /**
   * Deletes contact photo
   */
  static async deleteContactPhoto(photoURL: string): Promise<void> {
    try {
      // Extract storage path from Firebase URL
      const storagePath = this.extractStoragePathFromURL(photoURL);
      if (storagePath) {
        await this.deletePhoto(storagePath);
      }
    } catch (error) {
      legacyLogger.error('Error deleting contact photo', { error });
      // Don't throw - photo deletion is not critical
    }
  }

  /**
   * Extracts storage path from Firebase Download URL
   */
  private static extractStoragePathFromURL(downloadURL: string): string | null {
    try {
      // Firebase download URLs follow pattern:
      // https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token=...
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

  /**
   * 🎯 ENTERPRISE FALLBACK: Server-side upload when client-side fails
   * Fallback mechanism for cases where client-side Firebase SDK has connectivity issues
   */
  private static async fallbackToServerUpload(
    file: File,
    options: PhotoUploadOptions,
    compressionInfo: PhotoUploadResult['compressionInfo']
  ): Promise<PhotoUploadResult> {
    legacyLogger.info('Starting server-side upload fallback');

    try {
      // Create FormData for server-side upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderPath', options.folderPath);

      // 🏢 ENTERPRISE: Send contact data for FileNamingService
      if (options.contactData) {
        formData.append('contactData', JSON.stringify(options.contactData));
      }
      if (options.purpose) {
        formData.append('purpose', options.purpose);
      }
      if (options.photoIndex !== undefined) {
        formData.append('photoIndex', options.photoIndex.toString());
      }

      // Generate filename if not provided
      const fileName = options.fileName || generateUniqueFileName(file.name);

      legacyLogger.info('Sending to server-side API', {
        fileName: file.name,
        fileSize: file.size,
        folderPath: options.folderPath,
        hasContactData: !!options.contactData,
        purpose: options.purpose,
        photoIndex: options.photoIndex
      });

      // Send to server-side upload API
      const response = await fetch('/api/upload/photo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
        legacyLogger.error('Server upload failed', { errorData });
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      legacyLogger.info('Server upload successful', { result });

      // Return in the expected format
      return {
        url: result.url,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        storagePath: result.storagePath,
        compressionInfo: compressionInfo
      };

    } catch (error) {
      legacyLogger.error('Fallback upload failed', { error });
      throw new Error('Αποτυχία και της εναλλακτικής μεθόδου ανεβάσματος');
    }
  }

  // ==========================================================================
  // 🏢 ENTERPRISE: CANONICAL FILE STORAGE SYSTEM
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Canonical contact photo upload
   *
   * Uses the new FileRecord system:
   * 1. Creates pending FileRecord in Firestore
   * 2. Uploads binary to canonical path (IDs only)
   * 3. Finalizes FileRecord with downloadUrl and sizeBytes
   *
   * @param file - Image file to upload
   * @param options - Canonical upload options
   * @returns PhotoUploadResult with FileRecord reference
   *
   * @example
   * ```typescript
   * const result = await PhotoUploadService.uploadContactPhotoCanonical(file, {
   *   contactId: 'contact_123',
   *   contactName: 'Γιώργος Παπαδόπουλος', // Naming context
   *   purpose: 'profile',                   // Naming context
   *   createdBy: 'user_abc',
   *   companyId: 'company_xyz', // REQUIRED for multi-tenant
   * });
   * // displayName is generated centrally: "Φωτογραφία Προφίλ - Γιώργος Παπαδόπουλος"
   * ```
   */
  static async uploadContactPhotoCanonical(
    file: File,
    options: {
      /** Contact ID this photo belongs to */
      contactId: string;
      /** User ID who is uploading */
      createdBy: string;
      /** Company ID for multi-tenant isolation (REQUIRED) */
      companyId: string;

      // =========================================================================
      // NAMING CONTEXT (for centralized display name generation)
      // =========================================================================
      /** Contact name (e.g., "Γιώργος Παπαδόπουλος") */
      contactName?: string;
      /** Photo purpose (e.g., "profile", "id") */
      purpose?: 'profile' | 'id' | 'other';

      /** Progress callback */
      onProgress?: (progress: FileUploadProgress) => void;
      /** Enable compression (default: true) */
      enableCompression?: boolean;
      /** Compression usage context */
      compressionUsage?: UsageContext;
    }
  ): Promise<PhotoUploadResult & { fileRecord: FileRecord }> {
    canonicalLogger.info('Starting contact photo upload with centralized naming', {
      contactId: options.contactId,
      contactName: options.contactName,
      purpose: options.purpose,
      fileSize: file.size,
    });

    // Validate file using enterprise validation
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      canonicalLogger.error('File validation failed', { error: validation.error });
      throw new Error(validation.error || 'Invalid file');
    }

    // Step A: Create pending FileRecord
    // 🏢 ENTERPRISE: Using naming context - displayName generated centrally
    const { fileId, storagePath, fileRecord } = await FileRecordService.createPendingFileRecord({
      companyId: options.companyId,
      entityType: ENTITY_TYPES.CONTACT,
      entityId: options.contactId,
      domain: FILE_DOMAINS.ADMIN,
      category: FILE_CATEGORIES.PHOTOS,
      // Naming context (centralized name generation)
      entityLabel: options.contactName,
      purpose: options.purpose,
      // File metadata
      originalFilename: file.name,
      ext: file.name.split('.').pop()?.toLowerCase() || 'jpg',
      contentType: file.type,
      createdBy: options.createdBy,
    });

    canonicalLogger.info('Pending FileRecord created', {
      fileId,
      storagePath,
    });

    try {
      // Compression logic (reuse existing)
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

      // Step C: Finalize FileRecord
      await FileRecordService.finalizeFileRecord({
        fileId,
        sizeBytes: fileToUpload.size,
        downloadUrl: uploadResult.url,
      });

      canonicalLogger.info('FileRecord finalized successfully');

      // Get updated FileRecord
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
      // Mark FileRecord as failed
      canonicalLogger.error('Upload failed, marking FileRecord as failed');
      await FileRecordService.markFileRecordFailed(
        fileId,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * 🏢 ENTERPRISE: Get contact photos from canonical storage
   *
   * Fetches FileRecords for a contact's photos.
   * Can also fall back to legacy path for backward compatibility.
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
   * Returns true for old paths like 'contacts/photos/filename.jpg'
   */
  static isLegacyContactPhotoPath(path: string): boolean {
    return path.startsWith('contacts/photos/') || path.includes('/contacts/photos/');
  }
}
