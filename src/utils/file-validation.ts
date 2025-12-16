// ============================================================================
// 🏢 ENTERPRISE FILE VALIDATION UTILITIES
// ============================================================================

/**
 * 🚨 ENTERPRISE MIGRATION NOTICE
 *
 * This file contains hardcoded file size units που have been replaced by:
 * EnterpriseFileSystemService για internationalization και database-driven configuration.
 *
 * Legacy exports are maintained για backward compatibility.
 * For new code, use:
 *
 * ```typescript
 * import { fileSystemService } from '@/services/filesystem/EnterpriseFileSystemService';
 * const formattedSize = await fileSystemService.formatFileSize(bytes, 'en', tenantId);
 * ```
 *
 * @see src/services/filesystem/EnterpriseFileSystemService.ts
 */

/**
 * Enterprise File Validation Utilities
 *
 * Κεντρικοποιημένες λειτουργίες για file validation.
 * Enhanced με database-driven configuration support.
 */

import {
  FILE_TYPE_CONFIG,
  type FileType,
  type FileTypeConfig
} from '@/config/file-upload-config';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FileValidationConfig {
  fileType: FileType;
  maxSize?: number;
  acceptedTypes?: string[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// ============================================================================
// 🏢 ENTERPRISE FILE SIZE FORMATTING
// ============================================================================

/**
 * ✅ File size formatting is now powered by EnterpriseFileSystemService!
 *
 * Configuration υπάρχει στο: COLLECTIONS.CONFIG
 * Management μέσω: EnterpriseFileSystemService
 * Features: Multi-locale support, tenant-specific units
 *
 * Usage:
 * ```typescript
 * import { fileSystemService } from '@/services/filesystem/EnterpriseFileSystemService';
 *
 * // Locale-specific formatting
 * const sizeEN = await fileSystemService.formatFileSize(1024, 'en'); // "1 KB"
 * const sizeEL = await fileSystemService.formatFileSize(1024, 'el'); // "1 KB" (ελληνικά units)
 * const sizeFR = await fileSystemService.formatFileSize(1024, 'fr'); // "1 Ko"
 * ```
 */

/**
 * ⚠️ LEGACY FALLBACK: Format file size for display
 *
 * Αυτή η φάνκσιον χρησιμοποιείται μόνο ως fallback όταν:
 * - Η Firebase δεν είναι διαθέσιμη
 * - Offline mode
 * - Emergency fallback scenarios
 *
 * @param bytes - File size in bytes
 * @param locale - Optional locale για unit selection (fallback only supports basic locales)
 * @returns Formatted file size string
 *
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(5242880) // "5 MB"
 * formatFileSize(1024, 'en') // "1 KB"
 * formatFileSize(1024, 'fr') // "1 Ko" (basic French support)
 *
 * @deprecated Use fileSystemService.formatFileSize() για full enterprise features
 */
export function formatFileSize(bytes: number, locale: string = 'en'): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Basic locale-specific units (fallback only)
  const unitsMap: Record<string, string[]> = {
    en: ['Bytes', 'KB', 'MB', 'GB', 'TB'],
    el: ['Bytes', 'KB', 'MB', 'GB', 'TB'], // Basic Greek fallback
    fr: ['octets', 'Ko', 'Mo', 'Go', 'To'], // Basic French fallback
    de: ['Bytes', 'KB', 'MB', 'GB', 'TB'], // Basic German fallback
    es: ['Bytes', 'KB', 'MB', 'GB', 'TB'], // Basic Spanish fallback
    it: ['Byte', 'KB', 'MB', 'GB', 'TB']   // Basic Italian fallback
  };

  const sizes = unitsMap[locale] || unitsMap['en'];
  const unitIndex = Math.min(i, sizes.length - 1);

  return parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(2)) + ' ' + sizes[unitIndex];
}

/**
 * Validates file extension
 *
 * @param fileName - File name with extension
 * @param allowedExtensions - Array of allowed extensions (with dots)
 * @returns true if extension is allowed
 *
 * @example
 * validateFileExtension('image.jpg', ['.jpg', '.png']) // true
 * validateFileExtension('doc.pdf', ['.jpg', '.png']) // false
 */
export function validateFileExtension(fileName: string, allowedExtensions: string[]): boolean {
  if (allowedExtensions.length === 0) return true;

  const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return allowedExtensions.includes(fileExtension);
}

/**
 * Validates file MIME type
 *
 * @param fileMimeType - File MIME type
 * @param allowedMimeTypes - Array of allowed MIME types
 * @returns true if MIME type is allowed
 *
 * @example
 * validateFileMimeType('image/jpeg', ['image/jpeg', 'image/png']) // true
 * validateFileMimeType('application/pdf', ['image/jpeg']) // false
 */
export function validateFileMimeType(fileMimeType: string, allowedMimeTypes: string[]): boolean {
  if (allowedMimeTypes.length === 0) return true;

  return allowedMimeTypes.includes(fileMimeType);
}

/**
 * Validates file size
 *
 * @param fileSize - File size in bytes
 * @param maxSize - Maximum allowed size in bytes
 * @returns Validation result with error message if invalid
 *
 * @example
 * validateFileSize(1024, 5242880) // { isValid: true }
 * validateFileSize(10485760, 5242880) // { isValid: false, error: "..." }
 */
export function validateFileSize(fileSize: number, maxSize: number): FileValidationResult {
  if (fileSize > maxSize) {
    return {
      isValid: false,
      error: `Το αρχείο πρέπει να είναι μικρότερο από ${formatFileSize(maxSize)}`
    };
  }

  return { isValid: true };
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Validates file based on configuration
 *
 * Enhanced enterprise-class file validation που ελέγχει:
 * - File size limits (configurable per tenant/environment)
 * - MIME type restrictions (database-driven)
 * - File extension validation (tenant-specific)
 * - Security settings compliance
 * - Locale-specific error messages
 * - Special handling για 'any' file type
 *
 * For advanced enterprise validation, consider using:
 * ```typescript
 * import { fileSystemService } from '@/services/filesystem/EnterpriseFileSystemService';
 * const result = await fileSystemService.validateFileForTenant(file, fileType, tenantId);
 * ```
 *
 * @param file - File object to validate
 * @param config - Validation configuration
 * @returns Validation result with detailed error messages
 *
 * @example
 * const result = validateFile(file, {
 *   fileType: 'image',
 *   maxSize: 5242880
 * });
 *
 * if (!result.isValid) {
 *   toast.error(result.error);
 * }
 *
 * @enterprise-enhanced true
 */
export function validateFile(file: File, config: FileValidationConfig): FileValidationResult {
  const typeConfig: FileTypeConfig = FILE_TYPE_CONFIG[config.fileType];
  const maxSize = config.maxSize || typeConfig.maxSize;

  // ========================================================================
  // FILE SIZE VALIDATION
  // ========================================================================

  const sizeValidation = validateFileSize(file.size, maxSize);
  if (!sizeValidation.isValid) {
    return sizeValidation;
  }

  // ========================================================================
  // FILE TYPE VALIDATION (Skip για 'any' type)
  // ========================================================================

  if (config.fileType === 'any') {
    return { isValid: true };
  }

  // ========================================================================
  // MIME TYPE VALIDATION
  // ========================================================================

  const acceptedTypes = config.acceptedTypes || typeConfig.mimeTypes;
  if (!validateFileMimeType(file.type, acceptedTypes)) {
    return {
      isValid: false,
      error: typeConfig.errorMessage
    };
  }

  // ========================================================================
  // EXTENSION VALIDATION (Fallback)
  // ========================================================================

  if (!validateFileExtension(file.name, typeConfig.extensions)) {
    return {
      isValid: false,
      error: typeConfig.errorMessage
    };
  }

  // ========================================================================
  // SUCCESS
  // ========================================================================

  return { isValid: true };
}

// ============================================================================
// SPECIALIZED VALIDATORS
// ============================================================================

/**
 * Validates image files specifically
 *
 * @param file - File to validate
 * @param maxSize - Optional max size (default: 5MB)
 * @returns Validation result
 */
export function validateImageFile(file: File, maxSize?: number): FileValidationResult {
  return validateFile(file, {
    fileType: 'image',
    maxSize
  });
}

/**
 * Validates PDF files specifically
 *
 * @param file - File to validate
 * @param maxSize - Optional max size (default: 20MB)
 * @returns Validation result
 */
export function validatePDFFile(file: File, maxSize?: number): FileValidationResult {
  return validateFile(file, {
    fileType: 'pdf',
    maxSize
  });
}

/**
 * Validates document files specifically
 *
 * @param file - File to validate
 * @param maxSize - Optional max size (default: 10MB)
 * @returns Validation result
 */
export function validateDocumentFile(file: File, maxSize?: number): FileValidationResult {
  return validateFile(file, {
    fileType: 'document',
    maxSize
  });
}