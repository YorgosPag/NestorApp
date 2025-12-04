'use client';

import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// 🏢 ENTERPRISE FILE NAMING SERVICE - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * 🎯 Κεντρικοποιημένο Service για την ονοματοδοσία αρχείων
 *
 * Αυτό το service διασφαλίζει ότι όλα τα αρχεία φωτογραφιών/λογότυπων
 * παίρνουν σωστά ονόματα με βάση τα στοιχεία της επαφής.
 *
 * Παραδείγματα:
 * - Φυσικό πρόσωπο: "Γιώργος_Παπαδόπουλος_photo.jpg"
 * - Εταιρεία: "ΑΛΦΑ_ΑΕ_logo.png"
 * - Δημόσια Υπηρεσία: "Δήμος_Αθηναίων_logo.jpg"
 */
export class FileNamingService {

  /**
   * Sanitize filename - αφαίρεση special characters
   */
  private static sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9Α-Ωα-ωάέήίόύώΐΰ\s\-_.]/g, '') // Keep Greek, Latin, numbers, spaces, dashes, dots
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Remove multiple underscores
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .trim();
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
    const firstName = formData.firstName || 'Άγνωστο';
    const lastName = formData.lastName || 'Όνομα';
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
    const companyName = formData.companyName?.trim()
      ? formData.companyName
      : (formData.tradeName || formData.legalName || 'Εταιρεία_' + Date.now());
    const extension = this.getFileExtension(originalFilename);

    const purposeLabel = purpose === 'logo' ? 'logo' : 'εκπρόσωπος';
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
    const serviceName = formData.serviceName || formData.name || 'Υπηρεσία';
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
        // Fallback - χρήση original name με timestamp
        const timestamp = Date.now();
        const extension = this.getFileExtension(file.name);
        newFilename = `upload_${timestamp}${extension}`;
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