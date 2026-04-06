'use client';

/**
 * photo-upload-legacy-pipeline — Legacy upload pipeline with retry/fallback mechanism.
 * ADR-065 SRP split from photo-upload.service.ts.
 *
 * This module contains the deprecated legacy pipeline that uploads directly
 * to Firebase Storage without creating FileRecord documents.
 * New code should use the canonical pipeline in PhotoUploadService.
 *
 * Related files:
 * - photo-upload.service.ts (main service class)
 * - photo-upload-types.ts (shared types)
 */

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';
import type { FileUploadProgress } from '@/hooks/useFileUploadState';
import { smartCompressContactPhoto } from '@/subapps/geo-canvas/floor-plan-system/parsers/raster/ImageParser';
import compressionConfig from '@/config/photo-compression-config';
import {
  DEPRECATION_MESSAGES,
  FILE_STORAGE_FLAGS,
  FILE_STORAGE_ERROR_MESSAGES,
  API_ROUTES,
} from '@/config/domain-constants';
// 🏢 ENTERPRISE: Greek error messages from centralized constants (CLAUDE.md N.11)
import {
  legacyLogger,
  generateUniqueFileName,
  type PhotoUploadOptions,
  type PhotoUploadResult,
} from './photo-upload-types';

// ============================================================================
// LEGACY UPLOAD PIPELINE
// ============================================================================

/**
 * 🚨 LEGACY PIPELINE (DEPRECATED) — Extracted for SRP compliance.
 * Handles compression, file naming, retry mechanism, and server-side fallback.
 * Called by PhotoUploadService.uploadPhoto() when canonical fields are NOT provided.
 */
export async function executeLegacyUpload(
  file: File,
  options: PhotoUploadOptions,
): Promise<PhotoUploadResult> {
  // 🚨 PRODUCTION LOCK: Block legacy writes if feature flag is enabled
  if (FILE_STORAGE_FLAGS.BLOCK_LEGACY_WRITES) {
    legacyLogger.error(FILE_STORAGE_ERROR_MESSAGES.PRODUCTION_LOCK);
    throw new Error(FILE_STORAGE_ERROR_MESSAGES.PRODUCTION_LOCK);
  }

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

  // Check authentication status
  legacyLogger.info('Checking authentication status', { isAuthenticated: !!auth.currentUser });
  legacyLogger.info('Proceeding with upload (authentication optional for storage)');

  try {
    // 🏢 ENTERPRISE: Resolve file name
    let fileName: string;

    if (options.fileName) {
      fileName = options.fileName;
    } else if (options.contactData && fileToUpload.type.startsWith('image/')) {
      try {
        const { FileNamingService } = await import('@/services/FileNamingService');

        let servicePurpose: 'logo' | 'photo' | 'representative' = 'photo';
        if (options.purpose === 'logo') {
          servicePurpose = 'logo';
        } else if (options.purpose === 'representative' || options.purpose === 'avatar') {
          servicePurpose = 'representative';
        }

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
      fileName = generateUniqueFileName(fileToUpload.name);
    }

    // 🔧 FIX: Ensure simple path format for Firebase Storage
    const storagePath = `${options.folderPath}/${fileName}`.replace(/\/+/g, '/');

    legacyLogger.info('Storage path configured', {
      folderPath: options.folderPath,
      fileName,
      finalPath: storagePath
    });
    const storageRef = ref(storage, storagePath);
    legacyLogger.info('Storage reference created');

    // 🏢 ENTERPRISE LAYER 2: Enhanced reliability with retry + fallback
    const maxRetries = 2;
    const progressTimeout = 10000;
    const totalTimeout = 45000;
    let currentAttempt = 0;

    const attemptUpload = (): Promise<PhotoUploadResult> => {
      currentAttempt++;
      legacyLogger.info('Upload attempt', { attempt: currentAttempt, maxRetries });

      return new Promise<PhotoUploadResult>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

        let progressReceived = false;

        // 🕐 Progressive timeout — IMMEDIATE FALLBACK
        const progressTimeoutId = setTimeout(() => {
          if (!progressReceived) {
            legacyLogger.warn('No progress - trying fallback', { timeout: progressTimeout, attempt: currentAttempt });
            uploadTask.cancel();
            legacyLogger.info('Client-side stuck - attempting server-side fallback');
            fallbackToServerUpload(fileToUpload, options, compressionInfo)
              .then(resolve)
              .catch(reject);
          }
        }, progressTimeout);

        // 🕐 Total timeout — IMMEDIATE FALLBACK
        const totalTimeoutId = setTimeout(() => {
          legacyLogger.warn('Total upload timeout', { timeout: totalTimeout, attempt: currentAttempt });
          uploadTask.cancel();
          legacyLogger.info('Upload timeout - attempting server-side fallback');
          fallbackToServerUpload(fileToUpload, options, compressionInfo)
            .then(resolve)
            .catch(reject);
        }, totalTimeout);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (!progressReceived) {
              progressReceived = true;
              clearTimeout(progressTimeoutId);
              legacyLogger.info('Upload started successfully', { attempt: currentAttempt });
            }

            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            legacyLogger.info('Upload progress', { progress: Math.round(progress), attempt: currentAttempt });

            let phase: FileUploadProgress['phase'];
            if (progress < 50) {
              phase = 'upload';
            } else if (progress < 95) {
              phase = 'processing';
            } else {
              phase = 'complete';
            }

            if (options.onProgress) {
              options.onProgress({ progress: Math.round(progress), phase });
            }
          },
          (error) => {
            clearTimeout(progressTimeoutId);
            clearTimeout(totalTimeoutId);

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
              }, 2000 * currentAttempt);
              return;
            } else if (currentAttempt >= maxRetries && isRetryableError) {
              legacyLogger.info('All client-side retries failed - attempting server-side fallback');
              fallbackToServerUpload(fileToUpload, options, compressionInfo)
                .then(resolve)
                .catch(reject);
              return;
            }

            const errorMessage = resolveStorageErrorMessage(error.code, error.message, currentAttempt >= maxRetries);
            reject(new Error(errorMessage));
          },
          async () => {
            clearTimeout(progressTimeoutId);
            clearTimeout(totalTimeoutId);

            try {
              legacyLogger.info('Upload completed successfully', { attempt: currentAttempt });
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              legacyLogger.info('Download URL obtained', { url: downloadURL });

              resolve({
                url: downloadURL,
                fileName,
                fileSize: fileToUpload.size,
                mimeType: fileToUpload.type,
                storagePath,
                compressionInfo
              });
            } catch (error) {
              legacyLogger.error('Failed to get download URL', { error });
              reject(new Error('Αποτυχία λήψης URL αρχείου'));
            }
          }
        );
      });
    };

    return await attemptUpload();

  } catch (error) {
    legacyLogger.error('Photo upload service error', { error });
    throw new Error(FILE_STORAGE_ERROR_MESSAGES.UPLOAD_SERVICE_ERROR);
  }
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * 🎯 ENTERPRISE FALLBACK: Server-side upload when client-side fails
 */
async function fallbackToServerUpload(
  file: File,
  options: PhotoUploadOptions,
  compressionInfo: PhotoUploadResult['compressionInfo']
): Promise<PhotoUploadResult> {
  legacyLogger.info('Starting server-side upload fallback');

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderPath', options.folderPath);

    if (options.contactData) {
      formData.append('contactData', JSON.stringify(options.contactData));
    }
    if (options.purpose) {
      formData.append('purpose', options.purpose);
    }
    if (options.photoIndex !== undefined) {
      formData.append('photoIndex', options.photoIndex.toString());
    }

    legacyLogger.info('Sending to server-side API', {
      fileName: file.name,
      fileSize: file.size,
      folderPath: options.folderPath,
      hasContactData: !!options.contactData,
      purpose: options.purpose,
      photoIndex: options.photoIndex
    });

    const response = await fetch(API_ROUTES.UPLOAD.PHOTO, {
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

    return {
      url: result.url,
      fileName: result.fileName,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      storagePath: result.storagePath,
      compressionInfo
    };
  } catch (error) {
    legacyLogger.error('Fallback upload failed', { error });
    throw new Error(FILE_STORAGE_ERROR_MESSAGES.FALLBACK_UPLOAD_FAILED);
  }
}

/**
 * Maps Firebase Storage error codes to user-facing messages
 */
export function resolveStorageErrorMessage(code: string, message: string | undefined, retriesExhausted: boolean): string {
  switch (code) {
    case 'storage/unauthorized':
      return 'Δεν έχετε άδεια για ανέβασμα αρχείων';
    case 'storage/canceled':
      return retriesExhausted
        ? 'Πρόβλημα δικτύου - Δοκιμάστε ξανά σε λίγο'
        : 'Το ανέβασμα ακυρώθηκε';
    case 'storage/retry-limit-exceeded':
      return 'Πρόβλημα δικτύου - Δοκιμάστε ξανά σε λίγο';
    case 'storage/unknown': {
      const isHiddenRetryError = message &&
        (message.includes('retry') || message.includes('Max retry time'));
      return isHiddenRetryError
        ? 'Πρόβλημα δικτύου - Δοκιμάστε ξανά σε λίγο'
        : 'Άγνωστο σφάλμα κατά το ανέβασμα';
    }
    default:
      return 'Σφάλμα κατά το ανέβασμα αρχείου';
  }
}
