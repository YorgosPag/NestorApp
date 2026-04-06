/**
 * 📁 ENTERPRISE FILE SYSTEM — FALLBACK CONFIGURATION
 *
 * Extracted from EnterpriseFileSystemService.ts (ADR-065 Phase 5)
 * Hardcoded fallback data for offline mode and initial setup
 */

import type {
  FileSizeUnit,
  FileTypeValidation,
  FileUploadSettings,
  FileSecuritySettings,
  FileSystemConfiguration,
} from './filesystem-types';

// ============================================================================
// FALLBACK SIZE UNITS (by locale)
// ============================================================================

export function getFallbackSizeUnits(locale: string): FileSizeUnit[] {
  const unitsMap: Record<string, FileSizeUnit[]> = {
    en: [
      { key: 'bytes', label: 'Bytes', labelShort: 'Bytes', factor: 1, order: 0 },
      { key: 'kb', label: 'Kilobytes', labelShort: 'KB', factor: 1024, order: 1 },
      { key: 'mb', label: 'Megabytes', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
      { key: 'gb', label: 'Gigabytes', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
      { key: 'tb', label: 'Terabytes', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
    ],
    el: [
      { key: 'bytes', label: 'Ψηφιολέξεις', labelShort: 'Bytes', factor: 1, order: 0 },
      { key: 'kb', label: 'Κιλοψηφιολέξεις', labelShort: 'KB', factor: 1024, order: 1 },
      { key: 'mb', label: 'Μεγαψηφιολέξεις', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
      { key: 'gb', label: 'Γιγαψηφιολέξεις', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
      { key: 'tb', label: 'Τεραψηφιολέξεις', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
    ],
    de: [
      { key: 'bytes', label: 'Bytes', labelShort: 'Bytes', factor: 1, order: 0 },
      { key: 'kb', label: 'Kilobytes', labelShort: 'KB', factor: 1024, order: 1 },
      { key: 'mb', label: 'Megabytes', labelShort: 'MB', factor: 1024 * 1024, order: 2 },
      { key: 'gb', label: 'Gigabytes', labelShort: 'GB', factor: 1024 * 1024 * 1024, order: 3 },
      { key: 'tb', label: 'Terabytes', labelShort: 'TB', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
    ],
    fr: [
      { key: 'bytes', label: 'Octets', labelShort: 'octets', factor: 1, order: 0 },
      { key: 'kb', label: 'Kilooctets', labelShort: 'Ko', factor: 1024, order: 1 },
      { key: 'mb', label: 'Mégaoctets', labelShort: 'Mo', factor: 1024 * 1024, order: 2 },
      { key: 'gb', label: 'Gigaoctets', labelShort: 'Go', factor: 1024 * 1024 * 1024, order: 3 },
      { key: 'tb', label: 'Téraoctets', labelShort: 'To', factor: 1024 * 1024 * 1024 * 1024, order: 4 }
    ]
  };

  return unitsMap[locale] || unitsMap['en'];
}

// ============================================================================
// FALLBACK FILE TYPE VALIDATIONS
// ============================================================================

export function getFallbackFileTypeValidations(): FileTypeValidation[] {
  return [
    {
      fileType: 'image',
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      errorMessage: 'Please select a valid image file (JPG, PNG, GIF, WebP)',
      isEnabled: true
    },
    {
      fileType: 'document',
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
      allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/rtf'],
      errorMessage: 'Please select a valid document file (PDF, DOC, DOCX, TXT, RTF)',
      isEnabled: true
    },
    {
      fileType: 'video',
      maxSize: 100 * 1024 * 1024, // 100MB
      allowedExtensions: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
      allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'],
      errorMessage: 'Please select a valid video file (MP4, MOV, AVI, MKV, WebM)',
      isEnabled: true
    },
    {
      fileType: 'any',
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedExtensions: [],
      allowedMimeTypes: [],
      errorMessage: 'File too large or invalid format',
      isEnabled: true
    }
  ];
}

// ============================================================================
// FALLBACK UPLOAD & SECURITY SETTINGS
// ============================================================================

export function getFallbackUploadSettings(): FileUploadSettings {
  return {
    maxConcurrentUploads: parseInt(process.env.NEXT_PUBLIC_MAX_CONCURRENT_UPLOADS || '3'),
    chunkSize: parseInt(process.env.NEXT_PUBLIC_UPLOAD_CHUNK_SIZE || '1048576'),
    retryAttempts: parseInt(process.env.NEXT_PUBLIC_UPLOAD_RETRY_ATTEMPTS || '3'),
    timeoutSeconds: parseInt(process.env.NEXT_PUBLIC_UPLOAD_TIMEOUT || '300'),
    enableProgressTracking: process.env.NEXT_PUBLIC_ENABLE_PROGRESS_TRACKING !== 'false',
    enableThumbnailGeneration: process.env.NEXT_PUBLIC_ENABLE_THUMBNAIL_GENERATION !== 'false',
    thumbnailSizes: [150, 300, 500],
    compressionEnabled: process.env.NEXT_PUBLIC_ENABLE_COMPRESSION !== 'false',
    compressionQuality: parseFloat(process.env.NEXT_PUBLIC_COMPRESSION_QUALITY || '0.8')
  };
}

export function getFallbackSecuritySettings(): FileSecuritySettings {
  return {
    enableVirusScanning: process.env.NEXT_PUBLIC_ENABLE_VIRUS_SCANNING === 'true',
    quarantineDirectory: process.env.NEXT_PUBLIC_QUARANTINE_DIR || '/quarantine',
    allowExecutableFiles: process.env.NEXT_PUBLIC_ALLOW_EXECUTABLES === 'true',
    blockSuspiciousExtensions: process.env.NEXT_PUBLIC_BLOCK_SUSPICIOUS !== 'false',
    enableContentTypeValidation: process.env.NEXT_PUBLIC_VALIDATE_CONTENT_TYPE !== 'false',
    maxFileNameLength: parseInt(process.env.NEXT_PUBLIC_MAX_FILENAME_LENGTH || '255'),
    allowSpecialCharacters: process.env.NEXT_PUBLIC_ALLOW_SPECIAL_CHARS === 'true'
  };
}

// ============================================================================
// FALLBACK VALIDATION MESSAGES
// ============================================================================

export function getFallbackValidationMessages(locale: string): Record<string, string> {
  const messagesMap: Record<string, Record<string, string>> = {
    en: {
      fileTooLarge: 'File size exceeds the maximum allowed limit',
      invalidFileType: 'File type is not allowed',
      invalidExtension: 'File extension is not allowed',
      uploadFailed: 'File upload failed',
      processingFailed: 'File processing failed'
    },
    el: {
      fileTooLarge: 'Το μέγεθος του αρχείου υπερβαίνει το επιτρεπόμενο όριο',
      invalidFileType: 'Ο τύπος αρχείου δεν επιτρέπεται',
      invalidExtension: 'Η επέκταση αρχείου δεν επιτρέπεται',
      uploadFailed: 'Η μεταφόρτωση του αρχείου απέτυχε',
      processingFailed: 'Η επεξεργασία του αρχείου απέτυχε'
    }
  };

  return messagesMap[locale] || messagesMap['en'];
}

// ============================================================================
// COMPLETE FALLBACK CONFIGURATION
// ============================================================================

export function getFallbackConfiguration(locale: string): FileSystemConfiguration {
  return {
    sizeUnits: getFallbackSizeUnits(locale),
    fileTypeValidations: getFallbackFileTypeValidations(),
    uploadSettings: getFallbackUploadSettings(),
    securitySettings: getFallbackSecuritySettings(),
    validationMessages: getFallbackValidationMessages(locale),
    customSettings: {}
  };
}

/** Ensure complete configuration with fallbacks for missing sections */
export function ensureCompleteConfiguration(config: FileSystemConfiguration): FileSystemConfiguration {
  return {
    sizeUnits: config.sizeUnits || getFallbackSizeUnits('en'),
    fileTypeValidations: config.fileTypeValidations || getFallbackFileTypeValidations(),
    uploadSettings: config.uploadSettings || getFallbackUploadSettings(),
    securitySettings: config.securitySettings || getFallbackSecuritySettings(),
    validationMessages: config.validationMessages || getFallbackValidationMessages('en'),
    customSettings: config.customSettings || {}
  };
}

/** Fallback file size formatting (English units, no DB lookup) */
export function formatFileSizeFallback(bytes: number, decimals: number = 2): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return parseFloat(size.toFixed(decimals)) + ' ' + sizes[i];
}
