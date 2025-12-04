'use client';

import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { FileNamingService } from './FileNamingService';

// ============================================================================
// 🏢 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ PHOTO UPLOAD SERVICE - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * 🎯 Enterprise Photo Upload Service
 *
 * Κεντρικοποιημένο σύστημα για όλες τις φωτογραφίες:
 * - Company logos
 * - Service logos
 * - Individual photos
 * - Multiple photos (galleries)
 *
 * SINGLE SOURCE OF TRUTH για upload logic
 * Εξαλείφει 4+ διπλότυπα handleEnterpriseLogoUpload/handleEnterprisePhotoUpload
 *
 * 📝 AUTOMATIC FILE NAMING:
 * Όλα τα αρχεία παίρνουν αυτόματα σωστά ονόματα με βάση την επαφή!
 */

/**
 * 🔥 Κεντρικοποιημένος Enterprise Logo Upload Handler
 *
 * Χρησιμοποιείται από:
 * - CompanyContactTabbedSection
 * - ServiceContactTabbedSection
 * - CompanyContactSection
 * - ServiceContactSection
 *
 * @param file - The file to upload
 * @param onProgress - Progress callback
 * @param formData - Optional: Contact form data για automatic renaming
 * @returns Upload result with Base64 URL
 */
export async function handleEnterpriseLogoUpload(
  file: File,
  onProgress: (progress: FileUploadProgress) => void,
  formData?: ContactFormData
): Promise<FileUploadResult> {

  // 📝 AUTO-RENAME: Αν έχουμε formData, μετονομάζουμε το αρχείο
  let processedFile = file;
  if (formData) {
    processedFile = FileNamingService.generateProperFilename(
      file,
      formData,
      'logo'
    );
    console.log(`📝 Auto-renamed: "${file.name}" → "${processedFile.name}"`);
  }

  const result = await new Promise<FileUploadResult>((resolve, reject) => {
    const reader = new FileReader();
    onProgress({ progress: 0, bytesTransferred: 0, totalBytes: processedFile.size });

    reader.onload = (e) => {
      const base64URL = e.target?.result as string;
      console.log('🔍 PhotoUploadService: Converting to base64:', {
        originalName: file.name,
        renamedName: processedFile.name,
        urlStart: base64URL?.substring(0, 50),
        isBase64: base64URL?.startsWith('data:'),
        fileType: processedFile.type
      });
      onProgress({ progress: 100, bytesTransferred: processedFile.size, totalBytes: processedFile.size });
      resolve({
        success: true,
        url: base64URL,
        fileName: processedFile.name, // Χρήση του renamed filename
        compressionInfo: {
          originalSize: processedFile.size,
          compressedSize: processedFile.size,
          compressionRatio: 1.0,
          quality: 1.0
        }
      });
    };

    reader.onerror = () => reject(new Error('Base64 conversion failed'));
    reader.readAsDataURL(processedFile);
  });

  return result;
}

/**
 * 🔥 Κεντρικοποιημένος Enterprise Photo Upload Handler
 *
 * Χρησιμοποιείται από:
 * - CompanyContactTabbedSection (εκπρόσωπος)
 * - IndividualContactSection (προφίλ)
 * - Multiple photo galleries
 *
 * @param file - The file to upload
 * @param onProgress - Progress callback
 * @param formData - Optional: Contact form data για automatic renaming
 * @param purpose - Optional: 'photo' | 'representative' για σωστό naming
 * @param index - Optional: Index για multiple photos
 * @returns Upload result with Base64 URL
 */
export async function handleEnterprisePhotoUpload(
  file: File,
  onProgress: (progress: FileUploadProgress) => void,
  formData?: ContactFormData,
  purpose: 'photo' | 'representative' = 'photo',
  index?: number
): Promise<FileUploadResult> {

  // 📝 AUTO-RENAME: Αν έχουμε formData, μετονομάζουμε το αρχείο
  let processedFile = file;
  if (formData) {
    processedFile = FileNamingService.generateProperFilename(
      file,
      formData,
      purpose,
      index
    );
    console.log(`📝 Auto-renamed: "${file.name}" → "${processedFile.name}"`);
  }

  const result = await new Promise<FileUploadResult>((resolve, reject) => {
    const reader = new FileReader();
    onProgress({ progress: 0, bytesTransferred: 0, totalBytes: processedFile.size });

    reader.onload = (e) => {
      const base64URL = e.target?.result as string;
      console.log('🔍 PhotoUploadService: Converting to base64:', {
        originalName: file.name,
        renamedName: processedFile.name,
        urlStart: base64URL?.substring(0, 50),
        isBase64: base64URL?.startsWith('data:'),
        fileType: processedFile.type
      });
      onProgress({ progress: 100, bytesTransferred: processedFile.size, totalBytes: processedFile.size });
      resolve({
        success: true,
        url: base64URL,
        fileName: processedFile.name, // Χρήση του renamed filename
        compressionInfo: {
          originalSize: processedFile.size,
          compressedSize: processedFile.size,
          compressionRatio: 1.0,
          quality: 1.0
        }
      });
    };

    reader.onerror = () => reject(new Error('Base64 conversion failed'));
    reader.readAsDataURL(processedFile);
  });

  return result;
}

/**
 * 🎯 Photo Upload Service Object (για structured imports)
 */
export const PhotoUploadService = {
  handleLogoUpload: handleEnterpriseLogoUpload,
  handlePhotoUpload: handleEnterprisePhotoUpload,
} as const;

export default PhotoUploadService;