/**
 * photo-upload-types — Shared types, loggers, and utility functions for photo upload.
 * ADR-065 SRP split from photo-upload.service.ts.
 *
 * Related files:
 * - photo-upload.service.ts (main service class)
 */

import type { FileUploadProgress, FileUploadResult } from '@/hooks/useFileUploadState';
import type { UsageContext } from '@/config/photo-compression-config';
import type { ContactFormData } from '@/types/ContactFormTypes';
import {
  PHOTO_PURPOSES,
  type PhotoPurpose,
} from '@/config/domain-constants';
import { generateFileId } from '@/services/upload/utils/storage-path';
import { createModuleLogger } from '@/lib/telemetry';

// ============================================================================
// MODULE LOGGERS
// ============================================================================

/** 🏢 ENTERPRISE: Logger for canonical file storage flows */
export const canonicalLogger = createModuleLogger('CANONICAL_UPLOAD');

/** 🏢 ENTERPRISE: Logger for legacy photo upload methods */
export const legacyLogger = createModuleLogger('PHOTO_UPLOAD');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoUploadOptions {
  /** Folder path in Firebase Storage — ONLY for legacy pipeline (omit when using canonical fields) */
  folderPath?: string;
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
  /** Contact data for FileNamingService (optional) */
  contactData?: ContactFormData | { type?: string; name?: string; id?: string; [key: string]: unknown };
  /** Upload purpose for FileNamingService (optional) */
  purpose?: string;
  /** Photo index for FileNamingService (optional) */
  photoIndex?: number;

  // 🏢 CANONICAL PIPELINE FIELDS (ADR-031)
  /** 🏢 CANONICAL: Contact ID for FileRecord linkage */
  contactId?: string;
  /** 🏢 CANONICAL: Company ID for multi-tenant isolation (REQUIRED for canonical) */
  companyId?: string;
  /** 🏢 CANONICAL: User ID who is uploading */
  createdBy?: string;
  /** 🏢 CANONICAL: Contact name for display name generation */
  contactName?: string;
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
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generates a unique filename for Firebase Storage
 * 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
 */
export function generateUniqueFileName(originalName: string, prefix?: string): string {
  const fileId = generateFileId();
  const extension = originalName.substring(originalName.lastIndexOf('.'));
  const baseName = originalName.substring(0, originalName.lastIndexOf('.'))
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);

  return prefix
    ? `${prefix}_${baseName}_${fileId}${extension}`
    : `${baseName}_${fileId}${extension}`;
}

/**
 * 🏢 ENTERPRISE: Type-safe contact name resolution
 */
export function resolveContactName(
  contactName: string | undefined,
  contactData: { name?: string } | undefined
): string | undefined {
  if (contactName && typeof contactName === 'string' && contactName.trim()) {
    return contactName.trim();
  }
  if (contactData?.name && typeof contactData.name === 'string' && contactData.name.trim()) {
    return contactData.name.trim();
  }
  return undefined;
}

/**
 * 🏢 ENTERPRISE: Type-safe photo purpose resolution
 */
export function resolvePhotoPurpose(purpose: string | undefined): PhotoPurpose {
  const validPurposes = Object.values(PHOTO_PURPOSES);
  if (purpose && validPurposes.includes(purpose as PhotoPurpose)) {
    return purpose as PhotoPurpose;
  }
  return PHOTO_PURPOSES.PROFILE;
}
