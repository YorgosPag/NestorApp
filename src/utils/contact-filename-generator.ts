/**
 * Centralized Contact Filename Generator
 *
 * Κεντρικοποιημένη λειτουργικότητα για δημιουργία custom filenames
 * βάσει των στοιχείων της επαφής.
 *
 * @author Claude Code
 * @version 1.0.0
 */

import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FilenameGeneratorOptions {
  /** Original file to extract extension */
  originalFile: File;
  /** Contact form data */
  contactData: ContactFormData;
  /** Type of file being uploaded */
  fileType: 'logo' | 'representative' | 'profile' | 'gallery';
  /** Photo index for multiple photos (για gallery) */
  photoIndex?: number;
}

// ============================================================================
// CORE FUNCTIONALITY
// ============================================================================

/**
 * Clean name function - removes special characters and normalizes
 */
function cleanName(name: string): string {
  return name
    .replace(/[^a-zA-ZΑ-Ωα-ω0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase(); // Convert to lowercase
}

/**
 * Generate contact-based filename
 *
 * @param options - Filename generation options
 * @returns Custom filename string
 */
export function generateContactFilename(options: FilenameGeneratorOptions): string {
  const { originalFile, contactData, fileType, photoIndex = 0 } = options;

  // Extract file extension
  const fileExtension = originalFile.name.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();

  // Extract contact names based on type
  const firstName = contactData.firstName?.trim() || '';
  const lastName = contactData.lastName?.trim() || '';
  const companyName = contactData.companyName?.trim() || contactData.title?.trim() || '';
  const serviceName = contactData.serviceName?.trim() || contactData.organizationName?.trim() || '';

  let baseName = '';

  // Generate base name based on contact type and file type
  if (firstName && lastName) {
    // Individual Contact
    switch (fileType) {
      case 'profile':
      case 'gallery':
        baseName = `${cleanName(firstName)}_${cleanName(lastName)}`;
        if (fileType === 'gallery') {
          baseName += `_${photoIndex + 1}`;
        }
        break;
      case 'logo':
      case 'representative':
        baseName = `${cleanName(firstName)}_${cleanName(lastName)}_${fileType}`;
        break;
    }
  } else if (companyName) {
    // Company Contact
    baseName = `${cleanName(companyName)}_${fileType}`;
    if (fileType === 'gallery') {
      baseName += `_${photoIndex + 1}`;
    }
  } else if (serviceName) {
    // Service Contact
    baseName = `${cleanName(serviceName)}_${fileType}`;
    if (fileType === 'gallery') {
      baseName += `_${photoIndex + 1}`;
    }
  } else {
    // Fallback
    baseName = `contact_${fileType}`;
    if (fileType === 'gallery') {
      baseName += `_${photoIndex + 1}`;
    }
  }

  // Add timestamp for uniqueness
  baseName += `_${timestamp}`;

  return `${baseName}.${fileExtension}`;
}

/**
 * Create a new File object with custom filename
 *
 * @param originalFile - Original file object
 * @param customFilename - New filename to use
 * @returns New File object with custom name
 */
export function createFileWithCustomName(originalFile: File, customFilename: string): File {
  return new File([originalFile], customFilename, {
    type: originalFile.type,
    lastModified: originalFile.lastModified
  });
}

/**
 * Helper function that combines filename generation and file creation
 *
 * @param options - Filename generation options
 * @returns Object with custom filename and new File object
 */
export function generateContactFileWithCustomName(options: FilenameGeneratorOptions): {
  customFilename: string;
  customFile: File;
  originalFilename: string;
} {
  const customFilename = generateContactFilename(options);
  const customFile = createFileWithCustomName(options.originalFile, customFilename);

  return {
    customFilename,
    customFile,
    originalFilename: options.originalFile.name
  };
}

// ============================================================================
// LOGGING HELPERS
// ============================================================================

/**
 * Log filename generation details
 */
export function logFilenameGeneration(
  originalFilename: string,
  customFilename: string,
  contactData: ContactFormData,
  fileType: string
): void {
  console.log(`🏷️ FILENAME: Custom filename generated`, {
    originalFilename,
    customFilename,
    fileType,
    contactInfo: {
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      companyName: contactData.companyName,
      serviceName: contactData.serviceName
    }
  });
}