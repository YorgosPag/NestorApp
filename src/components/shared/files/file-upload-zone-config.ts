/**
 * =============================================================================
 * 🏢 ENTERPRISE: FileUploadZone — Config, Types & Helpers
 * =============================================================================
 *
 * Extracted from FileUploadZone.tsx to comply with Google SRP file-size limit.
 * Contains: props interface, constants, and pure helper functions.
 *
 * @module components/shared/files/file-upload-zone-config
 * @enterprise ADR-031 - Canonical File Storage System
 */

import {
  FILE_TYPE_CONFIG,
  UPLOAD_LIMITS,
  type FileType,
} from '@/config/file-upload-config';
import { type UsageContext, COMPRESSION_USAGE } from '@/config/photo-compression-config';
import { formatFileSize } from '@/utils/file-validation';

// ============================================================================
// RE-EXPORTS (consumers that import from this module get everything they need)
// ============================================================================

export type { UsageContext };
export { COMPRESSION_USAGE };

// ============================================================================
// TYPES
// ============================================================================

export interface FileUploadZoneProps {
  /** Upload handler - receives processed files (compressed if applicable) */
  onUpload: (files: File[]) => Promise<void>;
  /** Accept file types (e.g., "image/*,.pdf") */
  accept?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Uploading state */
  uploading?: boolean;
  /** Enable image compression (default: true) */
  enableCompression?: boolean;
  /** Compression usage context for smart compression */
  compressionUsage?: UsageContext;
  /** Override the default file types hint text */
  typesHint?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** 50 MB — from centralized UPLOAD_LIMITS config */
export const DEFAULT_MAX_SIZE = UPLOAD_LIMITS.MAX_FILE_SIZE;

export const DEFAULT_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx';

/** Image MIME types used for compression detection */
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect file type from MIME type.
 * Returns a FileType key that maps into FILE_TYPE_CONFIG.
 */
export function detectFileType(mimeType: string): FileType {
  if (IMAGE_MIME_TYPES.includes(mimeType)) {
    return 'image';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'document';
  }
  return 'any';
}


/** Format bytes to human-readable string — delegates to centralized formatFileSize */
export const formatBytes = formatFileSize;

// ============================================================================
// ACCEPT → HINT MAPPING (SSoT for dynamic file type hints)
// ============================================================================

/**
 * Maps accept string tokens to i18n file type keys.
 * Order matters — determines display order in the hint.
 */
const ACCEPT_TO_TYPE_KEY: ReadonlyArray<{ pattern: RegExp; key: string }> = [
  { pattern: /image\/\*|\.jpg|\.jpeg|\.png|\.gif|\.webp|image\/jpeg|image\/png/, key: 'images' },
  { pattern: /\.dxf|application\/dxf|image\/vnd\.dxf/, key: 'dxf' },
  { pattern: /\.pdf|application\/pdf/, key: 'pdf' },
  { pattern: /\.docx?|application\/msword|wordprocessingml/, key: 'word' },
  { pattern: /\.xlsx?|application\/vnd\.ms-excel|spreadsheetml/, key: 'excel' },
];

/**
 * Derive human-readable file type keys from an `accept` string.
 *
 * @example
 * deriveTypeKeys('.dxf,.pdf,.jpg') → ['images', 'dxf', 'pdf']
 * deriveTypeKeys('image/*,.pdf,.doc,.docx,.xls,.xlsx') → ['images', 'pdf', 'word', 'excel']
 */
export function deriveTypeKeys(accept: string): string[] {
  const keys: string[] = [];
  for (const { pattern, key } of ACCEPT_TO_TYPE_KEY) {
    if (pattern.test(accept) && !keys.includes(key)) {
      keys.push(key);
    }
  }
  return keys;
}
