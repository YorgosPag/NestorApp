// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import type { ContactFormData } from '@/types/ContactFormTypes';
// 🏢 ENTERPRISE: Import shared utilities from canonical naming module
import { sanitizeForFilename } from '@/services/upload/utils/file-display-name';
import { generateFileId } from '@/services/upload/utils/storage-path';

// 🌐 i18n: Fallback labels as i18n keys (to be translated by consuming component)
const FALLBACK_LABELS = {
  unknownFirstName: 'files.fallback.unknownFirstName', // 'Άγνωστο'
  unknownLastName: 'files.fallback.unknownLastName', // 'Όνομα'
  unknownCompany: 'files.fallback.unknownCompany', // 'Εταιρεία'
  representative: 'files.fallback.representative', // 'εκπρόσωπος'
  unknownService: 'files.fallback.unknownService', // 'Υπηρεσία'
} as const;

// ============================================================================
// 🏢 ENTERPRISE FILE NAMING SERVICE - CLIENT-SIDE FILENAME GENERATION
// ============================================================================
// 🔗 ARCHITECTURE NOTE: This service handles client-side File object naming
// for contact photo/logo uploads. For Firestore displayName generation,
// use the canonical naming authority: buildFileDisplayName from
// src/services/upload/utils/file-display-name.ts
//
// This service is a THIN WRAPPER that uses shared utilities from the
// canonical naming module (ADR-031).
// ============================================================================

/**
 * 🎯 Κεντρικοποιημένο Service για την ονοματοδοσία αρχείων (Client-side)
 *
 * Αυτό το service διασφαλίζει ότι όλα τα αρχεία φωτογραφιών/λογότυπων
 * παίρνουν σωστά ονόματα με βάση τα στοιχεία της επαφής.
 *
 * ⚠️ IMPORTANT: Για Firestore displayName, χρησιμοποίησε το buildFileDisplayName
 * από το src/services/upload/utils/file-display-name.ts
 *
 * Παραδείγματα:
 * - Φυσικό πρόσωπο: "Γιώργος_Παπαδόπουλος_photo.jpg"
 * - Εταιρεία: "ΑΛΦΑ_ΑΕ_logo.png"
 * - Δημόσια Υπηρεσία: "Δήμος_Αθηναίων_logo.jpg"
 */
export class FileNamingService {

  /**
   * Sanitize filename - uses canonical utility from file-display-name.ts
   * 🏢 ENTERPRISE: Shared implementation to prevent divergence
   */
  private static sanitizeFilename(name: string): string {
    return sanitizeForFilename(name);
  }

  /**
   * Get file extension from filename
   */
  private static getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return '';
    return filename.substring(lastDot);
  }

  /**
   * Generate filename για φυσικά πρόσωπα
   */
  private static generateIndividualFilename(
    formData: ContactFormData,
    originalFilename: string,
    purpose: 'photo' | 'logo' = 'photo',
    index?: number
  ): string {
    // 🌐 i18n: Use fallback keys (actual translation happens in UI layer)
    const firstName = formData.firstName || 'Unknown';
    const lastName = formData.lastName || 'Name';
    const extension = this.getFileExtension(originalFilename);

    // Αν έχουμε index (για multiple photos)
    const indexSuffix = index !== undefined ? `_${index + 1}` : '';

    const baseName = `${firstName}_${lastName}_${purpose}${indexSuffix}`;
    const sanitized = this.sanitizeFilename(baseName);

    return `${sanitized}${extension}`;
  }

  /**
   * Generate filename για εταιρείες
   */
  private static generateCompanyFilename(
    formData: ContactFormData,
    originalFilename: string,
    purpose: 'logo' | 'representative' = 'logo'
  ): string {
    // 🌐 i18n: Use English fallback (filenames should be language-neutral)
    const companyName = formData.companyName?.trim()
      ? formData.companyName
      : (formData.tradeName || formData.name || 'Unknown_Company');
    const extension = this.getFileExtension(originalFilename);

    const purposeLabel = purpose === 'logo' ? 'logo' : 'representative';
    const baseName = `${companyName}_${purposeLabel}`;
    const sanitized = this.sanitizeFilename(baseName);

    return `${sanitized}${extension}`;
  }

  /**
   * Generate filename για δημόσιες υπηρεσίες
   */
  private static generateServiceFilename(
    formData: ContactFormData,
    originalFilename: string,
    purpose: 'logo' | 'photo' = 'logo'
  ): string {
    // 🌐 i18n: Use English fallback (filenames should be language-neutral)
    const serviceName = formData.serviceName || formData.name || 'Service';
    const extension = this.getFileExtension(originalFilename);

    const baseName = `${serviceName}_${purpose}`;
    const sanitized = this.sanitizeFilename(baseName);

    return `${sanitized}${extension}`;
  }

  /**
   * 🎯 MAIN METHOD: Generate proper filename based on contact type
   *
   * @param file - The original file
   * @param formData - Contact form data με τα στοιχεία επαφής
   * @param purpose - Σκοπός του αρχείου (logo, photo, representative)
   * @param index - Index για multiple photos
   * @returns Renamed file με σωστό όνομα
   */
  public static generateProperFilename(
    file: File,
    formData: ContactFormData,
    purpose: 'logo' | 'photo' | 'representative' = 'photo',
    index?: number
  ): File {
    let newFilename: string;

    // Determine contact type και generate filename accordingly
    switch (formData.type) {
      case 'individual':
        newFilename = this.generateIndividualFilename(
          formData,
          file.name,
          'photo',
          index
        );
        break;

      case 'company':
        newFilename = this.generateCompanyFilename(
          formData,
          file.name,
          purpose as 'logo' | 'representative'
        );
        break;

      case 'service':
        newFilename = this.generateServiceFilename(
          formData,
          file.name,
          purpose as 'logo' | 'photo'
        );
        break;

      default:
        // Fallback - χρήση canonical ID generation (ADR-293)
        const fallbackId = generateFileId();
        const extension = this.getFileExtension(file.name);
        newFilename = `${fallbackId}${extension}`;
    }

    // Create new File object με το νέο όνομα
    const renamedFile = new File([file], newFilename, {
      type: file.type,
      lastModified: file.lastModified
    });

    return renamedFile;
  }

  /**
   * Generate filename για Base64 data URL
   * (Χρήσιμο όταν αποθηκεύουμε Base64 strings)
   */
  public static generateFilenameFromBase64(
    formData: ContactFormData,
    purpose: 'logo' | 'photo' | 'representative' = 'photo',
    mimeType: string = 'image/jpeg',
    index?: number
  ): string {
    // Determine extension από mime type
    const extension = mimeType.includes('png') ? '.png' : '.jpg';
    const dummyFilename = `photo${extension}`;

    // Create dummy file για να χρησιμοποιήσουμε την existing logic
    const dummyFile = new File([], dummyFilename);
    const renamedFile = this.generateProperFilename(
      dummyFile,
      formData,
      purpose,
      index
    );

    return renamedFile.name;
  }

  /**
   * Debug method - εμφάνιση ονόματος που θα δοθεί
   */
  public static previewFilename(
    originalName: string,
    formData: ContactFormData,
    purpose: 'logo' | 'photo' | 'representative' = 'photo'
  ): string {
    const dummyFile = new File([], originalName);
    const renamed = this.generateProperFilename(dummyFile, formData, purpose);
    return renamed.name;
  }
}

// Export as singleton instance for convenience
export const fileNamingService = FileNamingService;