'use client';

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, auth } from '@/lib/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { smartCompressContactPhoto, ImageParser } from '@/subapps/geo-canvas/floor-plan-system/parsers/raster/ImageParser';
import compressionConfig, { type UsageContext } from '@/config/photo-compression-config';

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
 */
function generateUniqueFileName(originalName: string, prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.substring(originalName.lastIndexOf('.'));
  const baseName = originalName.substring(0, originalName.lastIndexOf('.'))
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50); // Limit length

  return prefix
    ? `${prefix}_${baseName}_${timestamp}_${random}${extension}`
    : `${baseName}_${timestamp}_${random}${extension}`;
}

/**
 * Validates image file for upload
 */
function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Μόνο αρχεία εικόνας επιτρέπονται (JPG, PNG, GIF, WebP)'
    };
  }

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Το αρχείο πρέπει να είναι μικρότερο από 5MB'
    };
  }

  return { isValid: true };
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
    console.log('🔄 ENTERPRISE: Starting photo upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      folderPath: options.folderPath,
      compressionEnabled: options.enableCompression !== false
    });

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      console.error('❌ File validation failed:', validation.error);
      throw new Error(validation.error || 'Invalid file');
    }

    console.log('✅ File validation passed');

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
        console.log('🗜️ Compression needed:', compressionDecision.strategy.reason);
        console.log('📊 Compression strategy:', compressionDecision.strategy.name);
        console.log('🎯 Target profile:', compressionDecision.strategy.profile);
        if (compressionDecision.estimatedSavings) {
          console.log('💾 Estimated savings:', compressionDecision.estimatedSavings);
        }

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

          console.log('✅ Compression completed:', {
            strategy: compressionResult.compressionInfo.strategy,
            originalSize: `${Math.round(file.size / 1024)}KB`,
            compressedSize: `${Math.round(compressionResult.blob.size / 1024)}KB`,
            savings: `${compressionInfo.compressionRatio}%`
          });
        } catch (compressionError) {
          console.warn('⚠️ Compression failed, uploading original:', compressionError);
          // Continue with original file if compression fails
        }
      } else {
        console.log('✅ No compression needed:', compressionDecision.strategy.reason);
      }
    }

    console.log('📊 Final upload file:', {
      fileName: fileToUpload.name,
      fileSize: `${Math.round(fileToUpload.size / 1024)}KB`,
      fileType: fileToUpload.type,
      wasCompressed: compressionInfo.wasCompressed
    });

    // Check authentication status and try anonymous login if needed
    console.log('🔐 Checking authentication status...');
    console.log('🔐 Auth current user:', auth.currentUser ? 'Authenticated' : 'Not authenticated');

    // 🔧 FIX: Skip authentication for development - Firebase Storage rules should allow uploads
    console.log('📤 Proceeding with upload (authentication optional for storage)');

    try {
      // Use the exact filename provided (already custom-generated) or generate unique
      const fileName = options.fileName || generateUniqueFileName(file.name);

      // 🔧 FIX: Ensure simple path format for Firebase Storage
      const storagePath = `${options.folderPath}/${fileName}`.replace(/\/+/g, '/'); // Remove double slashes

      console.log('🔍 STORAGE PATH DEBUG:', {
        folderPath: options.folderPath,
        fileName: fileName,
        finalPath: storagePath
      });
      console.log('📁 ENTERPRISE: Storage path:', storagePath);
      const storageRef = ref(storage, storagePath);
      console.log('🔗 ENTERPRISE: Storage reference created');

      // 🏢 ENTERPRISE LAYER 2: Enhanced reliability mechanisms με REDUCED timeouts
      const maxRetries = 2; // Μείωσα από 3 σε 2
      const progressTimeout = 5000; // Μείωσα από 10s σε 5s για ταχύτερο fallback
      const totalTimeout = 15000; // Μείωσα από 30s σε 15s
      let currentAttempt = 0;

      const attemptUpload = (): Promise<PhotoUploadResult> => {
        currentAttempt++;
        console.log(`⬆️ ENTERPRISE: Upload attempt ${currentAttempt}/${maxRetries}`);

        return new Promise<PhotoUploadResult>((resolve, reject) => {
          // Create upload task with resumable upload
          const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

          let progressReceived = false;
          let lastProgressTime = Date.now();

          // 🕐 Progressive timeout mechanism - IMMEDIATE FALLBACK
          const progressTimeoutId = setTimeout(() => {
            if (!progressReceived) {
              console.log(`⏰ ENTERPRISE: No progress after ${progressTimeout}ms on attempt ${currentAttempt} - trying fallback IMMEDIATELY`);
              uploadTask.cancel();

              // 🚀 IMMEDIATE FALLBACK: Δεν περιμένω retries - πάω κατευθείαν σε server-side
              console.log('🎯 ENTERPRISE: Client-side stuck at 0% - attempting server-side fallback IMMEDIATELY');
              PhotoUploadService.fallbackToServerUpload(fileToUpload, options, compressionInfo)
                .then(resolve)
                .catch(reject);
            }
          }, progressTimeout);

          // 🕐 Total timeout mechanism - IMMEDIATE FALLBACK
          const totalTimeoutId = setTimeout(() => {
            console.log(`⏰ ENTERPRISE: Total upload timeout after ${totalTimeout}ms on attempt ${currentAttempt}`);
            uploadTask.cancel();

            // 🚀 IMMEDIATE FALLBACK: Πάω κατευθείαν σε server-side upload
            console.log('🎯 ENTERPRISE: Client-side upload timeout - attempting server-side fallback IMMEDIATELY');
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
                console.log(`✅ ENTERPRISE: Upload started successfully on attempt ${currentAttempt}`);
              }
              lastProgressTime = Date.now();

              // Progress tracking
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log(`📈 ENTERPRISE: Upload progress: ${Math.round(progress)}% (attempt ${currentAttempt})`);

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
              console.error(`❌ ENTERPRISE: Photo upload error on attempt ${currentAttempt}:`, error);
              console.error('❌ Error code:', error.code);
              console.error('❌ Error message:', error.message);

              const isRetryableError =
                error.code === 'storage/retry-limit-exceeded' ||
                error.code === 'storage/canceled' ||
                (error.code === 'storage/unknown' &&
                 error.message &&
                 (error.message.includes('retry') || error.message.includes('Max retry time')));

              if (isRetryableError && currentAttempt < maxRetries) {
                console.log(`🔄 ENTERPRISE: Retrying upload due to ${error.code} (${currentAttempt + 1}/${maxRetries})`);
                setTimeout(() => {
                  attemptUpload().then(resolve).catch(reject);
                }, 2000 * currentAttempt); // Exponential backoff
                return;
              } else if (currentAttempt >= maxRetries && isRetryableError) {
                // 🚀 FALLBACK: Try server-side upload when retryable error persists
                console.log('🎯 ENTERPRISE: All client-side retries failed - attempting server-side fallback');
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
                  console.log('🔧 ENTERPRISE: Detected retry-limit-exceeded error');
                  errorMessage = 'Πρόβλημα δικτύου - Δοκιμάστε ξανά σε λίγο';
                  break;
                case 'storage/unknown':
                  const isHiddenRetryError = error.message &&
                    (error.message.includes('retry') || error.message.includes('Max retry time'));

                  errorMessage = isHiddenRetryError
                    ? 'Πρόβλημα δικτύου - Δοκιμάστε ξανά σε λίγο'
                    : 'Άγνωστο σφάλμα κατά το ανέβασμα';

                  console.log('🔍 ENTERPRISE: Unknown error analysis:', { isHiddenRetryError, message: error.message });
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
                console.log(`🎉 ENTERPRISE: Upload completed successfully on attempt ${currentAttempt}!`);
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log('✅ ENTERPRISE: Download URL obtained:', downloadURL);

                resolve({
                  url: downloadURL,
                  fileName: fileName,
                  fileSize: fileToUpload.size,
                  mimeType: fileToUpload.type,
                  storagePath: storagePath,
                  compressionInfo: compressionInfo
                });
              } catch (error) {
                console.error('❌ ENTERPRISE: Failed to get download URL:', error);
                reject(new Error('Αποτυχία λήψης URL αρχείου'));
              }
            }
          );
        });
      };

      // Start the upload with retry mechanism
      return await attemptUpload();

    } catch (error) {
      console.error('Photo upload service error:', error);
      throw new Error('Σφάλμα υπηρεσίας ανεβάσματος');
    }
  }

  /**
   * Deletes photo from Firebase Storage
   */
  static async deletePhoto(storagePath: string): Promise<void> {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Photo delete error:', error);
      // Don't throw error if file doesn't exist
      if ((error as any)?.code !== 'storage/object-not-found') {
        throw new Error('Αποτυχία διαγραφής αρχείου');
      }
    }
  }

  /**
   * Uploads contact photo specifically with optimized compression για profiles
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
   */
  static async uploadCompanyLogo(
    file: File,
    companyId?: string,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<PhotoUploadResult> {
    const prefix = companyId ? `company_${companyId}` : 'company';

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
      console.error('Error deleting contact photo:', error);
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
    console.log('🚀 SERVER-FALLBACK: Starting server-side upload fallback');

    try {
      // Create FormData for server-side upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderPath', options.folderPath);

      // Generate filename if not provided
      const fileName = options.fileName || generateUniqueFileName(file.name);

      console.log('📤 SERVER-FALLBACK: Sending to /api/upload/photo', {
        fileName: file.name,
        fileSize: file.size,
        folderPath: options.folderPath
      });

      // Send to server-side upload API
      const response = await fetch('/api/upload/photo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
        console.error('❌ SERVER-FALLBACK: Server upload failed:', errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ SERVER-FALLBACK: Upload successful!', result);

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
      console.error('❌ SERVER-FALLBACK: Fallback upload failed:', error);
      throw new Error('Αποτυχία και της εναλλακτικής μεθόδου ανεβάσματος');
    }
  }
}