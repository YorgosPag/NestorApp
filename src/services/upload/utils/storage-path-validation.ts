/**
 * =============================================================================
 * 🏢 ENTERPRISE CANONICAL STORAGE PATH — VALIDATION
 * =============================================================================
 *
 * Segment-level guards + the full parameter validator for the canonical storage
 * path scheme. Extracted from `storage-path.ts` (N.7.1, 2026-07-26) so the
 * builder file keeps ONE responsibility: assembling paths.
 *
 * These predicates are also the readers' guards: `parseStoragePath` validates a
 * parsed path with the very same functions the builder validates inputs with,
 * so "what may be written" and "what is accepted as valid on read" can never
 * drift apart.
 *
 * @module upload/utils/storage-path-validation
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-709 - Immutable Storage Path (single scheme)
 */

import {
  type FileDomain,
  type FileCategory,
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
  isPlatformEntityType,
} from '@/config/domain-constants';
import type { StoragePathParams } from './storage-path';

/**
 * Validation error with specific field information
 */
export interface StoragePathValidationError {
  field: keyof StoragePathParams;
  message: string;
  value: unknown;
}

/**
 * Validates that a string contains only safe path characters (IDs)
 * 🏢 ENTERPRISE: Supports Unicode (Greek IDs like Α-101, ΤΕΣΤ) and dots (A_D0.1)
 * Allows: Unicode letters, digits, underscore, hyphen, dot
 */
export function isValidPathSegment(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  // Unicode-aware: \p{L} = any letter, \p{N} = any digit
  return /^[\p{L}\p{N}_.\-]+$/u.test(value);
}

/**
 * Validates file extension (allows alphanumeric only)
 */
export function isValidExtension(ext: string): boolean {
  if (!ext || typeof ext !== 'string') return false;
  // Remove leading dot if present
  const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;
  return /^[a-zA-Z0-9]+$/.test(cleanExt);
}

// entityType narrowing is NOT defined here: the ENTITY_TYPES list lives in
// `config/domain-constants`, so `isPlatformEntityType` lives next to it and is imported
// (SSoT — this file used to hold a byte-identical copy). `isValidDomain` /
// `isValidCategory` below stay local on purpose: FILE_DOMAINS/FILE_CATEGORIES
// are consumed by the storage path surface only, so this file IS their owner.

/**
 * Validates domain against FILE_DOMAINS enum
 */
export function isValidDomain(value: string): value is FileDomain {
  return Object.values(FILE_DOMAINS).includes(value as FileDomain);
}

/**
 * Validates category against FILE_CATEGORIES enum
 */
export function isValidCategory(value: string): value is FileCategory {
  return Object.values(FILE_CATEGORIES).includes(value as FileCategory);
}

/**
 * Validates all storage path parameters
 * @returns Array of validation errors (empty if valid)
 */
export function validateStoragePathParams(
  params: StoragePathParams
): StoragePathValidationError[] {
  const errors: StoragePathValidationError[] = [];

  // Required fields validation
  if (!isPlatformEntityType(params.entityType)) {
    errors.push({
      field: 'entityType',
      message: `Invalid entityType. Must be one of: ${Object.values(ENTITY_TYPES).join(', ')}`,
      value: params.entityType,
    });
  }

  if (!isValidPathSegment(params.entityId)) {
    errors.push({
      field: 'entityId',
      message: 'Invalid entityId. Must contain only alphanumeric, underscore, or hyphen characters.',
      value: params.entityId,
    });
  }

  if (!isValidDomain(params.domain)) {
    errors.push({
      field: 'domain',
      message: `Invalid domain. Must be one of: ${Object.values(FILE_DOMAINS).join(', ')}`,
      value: params.domain,
    });
  }

  if (!isValidCategory(params.category)) {
    errors.push({
      field: 'category',
      message: `Invalid category. Must be one of: ${Object.values(FILE_CATEGORIES).join(', ')}`,
      value: params.category,
    });
  }

  if (!isValidPathSegment(params.fileId)) {
    errors.push({
      field: 'fileId',
      message: 'Invalid fileId. Must contain only alphanumeric, underscore, or hyphen characters.',
      value: params.fileId,
    });
  }

  if (!isValidExtension(params.ext)) {
    errors.push({
      field: 'ext',
      message: 'Invalid extension. Must contain only alphanumeric characters.',
      value: params.ext,
    });
  }

  // companyId is REQUIRED for multi-tenant isolation
  if (!isValidPathSegment(params.companyId)) {
    errors.push({
      field: 'companyId',
      message: 'companyId is REQUIRED. Must contain only alphanumeric, underscore, or hyphen characters.',
      value: params.companyId,
    });
  }

  return errors;
}
