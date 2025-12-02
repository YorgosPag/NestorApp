// ============================================================================
// FILE VALIDATION UTILITIES
// ============================================================================

/**
 * Enterprise File Validation Utilities
 *
 * Κεντρικοποιημένες λειτουργίες για file validation.
 * Extracted από useEnterpriseFileUpload για reusability.
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

/**
 * Formats file size for display
 *
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 *
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(5242880) // "5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
 * Validates file based on configuration
 *
 * Enterprise-class file validation που ελέγχει:
 * - File size limits
 * - MIME type restrictions
 * - File extension validation
 * - Special handling για 'any' file type
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