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
   * Uploads photo to Firebase Storage with progress tracking and automatic compression
   */
  static async uploadPhoto(
    file: File,
    options: PhotoUploadOptions
  ): Promise<PhotoUploadResult> {
    console.log('🔄 Starting photo upload:', {
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

    if (!auth.currentUser) {
      console.warn('⚠️ No authenticated user - attempting anonymous authentication...');
      try {
        await signInAnonymously(auth);
        console.log('✅ Anonymous authentication successful');
      } catch (authError) {
        console.error('❌ Anonymous authentication failed:', authError);
        console.warn('⚠️ Proceeding without authentication - uploads may fail');
      }
    }

    try {
      // Generate unique filename
      const fileName = options.fileName
        ? generateUniqueFileName(options.fileName)
        : generateUniqueFileName(file.name);

      // Create storage reference
      const storagePath = `${options.folderPath}/${fileName}`;
      console.log('📁 Storage path:', storagePath);
      const storageRef = ref(storage, storagePath);
      console.log('🔗 Storage reference created');

      // Create upload task with resumable upload
      console.log('⬆️ Starting upload task...');
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

      // Progress tracking promise
      return new Promise<PhotoUploadResult>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Progress tracking
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`📈 Upload progress: ${Math.round(progress)}%`);

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
            // Handle upload errors
            console.error('❌ Photo upload error:', error);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error message:', error.message);

            let errorMessage: string;
            switch (error.code) {
              case 'storage/unauthorized':
                errorMessage = 'Δεν έχετε άδεια για ανέβασμα αρχείων';
                break;
              case 'storage/canceled':
                errorMessage = 'Το ανέβασμα ακυρώθηκε';
                break;
              case 'storage/unknown':
                errorMessage = 'Άγνωστο σφάλμα κατά το ανέβασμα';
                break;
              default:
                errorMessage = 'Σφάλμα κατά το ανέβασμα αρχείου';
            }

            reject(new Error(errorMessage));
          },
          async () => {
            try {
              // Upload completed successfully
              console.log('🎉 Upload completed! Getting download URL...');
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('✅ Download URL obtained:', downloadURL);

              resolve({
                url: downloadURL,
                fileName: fileName,
                fileSize: fileToUpload.size,
                mimeType: fileToUpload.type,
                storagePath: storagePath,
                compressionInfo: compressionInfo
              });
            } catch (error) {
              console.error('❌ Failed to get download URL:', error);
              reject(new Error('Αποτυχία λήψης URL αρχείου'));
            }
          }
        );
      });

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
      fileName: `${prefix}_${file.name}`,
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
}