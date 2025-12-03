'use client';

import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

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
 * @returns Upload result with Base64 URL
 */
export async function handleEnterpriseLogoUpload(
  file: File,
  onProgress: (progress: FileUploadProgress) => void
): Promise<FileUploadResult> {

  const result = await new Promise<FileUploadResult>((resolve, reject) => {
    const reader = new FileReader();
    onProgress({ progress: 0, bytesTransferred: 0, totalBytes: file.size });

    reader.onload = (e) => {
      const base64URL = e.target?.result as string;
      console.log('🔍 PhotoUploadService: Converting to base64:', {
        urlStart: base64URL?.substring(0, 50),
        isBase64: base64URL?.startsWith('data:'),
        fileType: file.type
      });
      onProgress({ progress: 100, bytesTransferred: file.size, totalBytes: file.size });
      resolve({
        success: true,
        url: base64URL,
        fileName: file.name,
        compressionInfo: {
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 1.0,
          quality: 1.0
        }
      });
    };

    reader.onerror = () => reject(new Error('Base64 conversion failed'));
    reader.readAsDataURL(file);
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
 * @returns Upload result with Base64 URL
 */
export async function handleEnterprisePhotoUpload(
  file: File,
  onProgress: (progress: FileUploadProgress) => void
): Promise<FileUploadResult> {

  const result = await new Promise<FileUploadResult>((resolve, reject) => {
    const reader = new FileReader();
    onProgress({ progress: 0, bytesTransferred: 0, totalBytes: file.size });

    reader.onload = (e) => {
      const base64URL = e.target?.result as string;
      console.log('🔍 PhotoUploadService: Converting to base64:', {
        urlStart: base64URL?.substring(0, 50),
        isBase64: base64URL?.startsWith('data:'),
        fileType: file.type
      });
      onProgress({ progress: 100, bytesTransferred: file.size, totalBytes: file.size });
      resolve({
        success: true,
        url: base64URL,
        fileName: file.name,
        compressionInfo: {
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 1.0,
          quality: 1.0
        }
      });
    };

    reader.onerror = () => reject(new Error('Base64 conversion failed'));
    reader.readAsDataURL(file);
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