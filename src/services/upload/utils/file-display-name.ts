/**
 * =============================================================================
 * 🏢 ENTERPRISE FILE DISPLAY NAME BUILDER
 * =============================================================================
 *
 * Centralized naming module for generating human-readable file display names.
 * This is a pure function that generates display names for Firestore FileRecord.
 *
 * IMPORTANT: Storage paths use IDs only - display names belong in Firestore!
 *
 * @module upload/utils/file-display-name
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Usage in Step A (createPendingFileRecord):
 * ```typescript
 * const { displayName, normalizedTitle, exportFilename } = buildFileDisplayName({
 *   entityType: 'contact',
 *   entityId: 'contact_123',
 *   domain: 'admin',
 *   category: 'photos',
 *   entityLabel: 'Γιώργος Παπαδόπουλος', // from i18n or entity data
 *   purpose: 'profile',
 *   occurredAt: new Date(),
 * });
 * ```
 */

import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import {
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
} from '@/config/domain-constants';

// 🏢 ENTERPRISE: Use canonical i18n system (no direct JSON imports)
import i18n from '@/i18n/config';
import { loadNamespace } from '@/i18n/lazy-config';

// ============================================================================
// I18N INTEGRATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Ensure 'files' namespace is loaded
 * This should be called at app startup or before first use
 */
export async function ensureFilesNamespaceLoaded(): Promise<void> {
  const lang = i18n.language === 'en' ? 'en' : 'el';
  await loadNamespace('files', lang);
}

/**
 * Get translation from files namespace with fallback
 */
function getFileTranslation(key: string, fallback: string): string {
  // Try to get from i18n, fallback to key if not found
  const result = i18n.t(`files:${key}`, { defaultValue: fallback });
  return typeof result === 'string' ? result : fallback;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input parameters for building file display name
 */
export interface FileDisplayNameInput {
  /** Entity type (contact, building, floor, unit, project) */
  entityType: EntityType;

  /** Entity ID (for reference, not included in display name) */
  entityId: string;

  /** Business domain (admin, construction, legal, financial) */
  domain: FileDomain;

  /** Content category (photos, floorplans, contracts, invoices) */
  category: FileCategory;

  /** Human-readable entity label - e.g., "Γιώργος Παπαδόπουλος" or "Κτίριο Α" */
  entityLabel?: string;

  /** Optional purpose/descriptor - e.g., "profile", "front", "signed" */
  purpose?: string;

  /** Additional descriptors - e.g., ["1ος Όροφος", "Διαμέρισμα 1"] */
  descriptors?: string[];

  /** When the file was created/occurred */
  occurredAt?: Date;

  /** Revision number if applicable */
  revision?: number;

  /** File extension (for export filename) */
  ext?: string;

  /** Original filename (for fallback) */
  originalFilename?: string;

  /** 🏢 ENTERPRISE: Custom title για "Άλλο Έγγραφο" (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
   * When provided, replaces category+purpose with this custom title */
  customTitle?: string;
}

/**
 * Output from building file display name
 */
export interface FileDisplayNameResult {
  /** Human-readable display name for UI (Greek/any language) */
  displayName: string;

  /** Normalized title (no special chars, for sorting/search) */
  normalizedTitle: string;

  /** Filename for export/download (Content-Disposition) */
  exportFilename: string;
}

// ============================================================================
// I18N LABEL GETTERS (using canonical i18n system)
// ============================================================================

/**
 * Get label for domain from i18n (files:domains.{domain})
 */
function getDomainLabel(domain: string): string {
  return getFileTranslation(`domains.${domain}`, domain);
}

/**
 * Get label for category from i18n (files:categories.{category})
 */
function getCategoryLabel(category: string): string {
  return getFileTranslation(`categories.${category}`, category);
}

/**
 * Get label for entity type from i18n (files:entityTypes.{entityType})
 */
function getEntityTypeLabel(entityType: string): string {
  return getFileTranslation(`entityTypes.${entityType}`, entityType);
}

/**
 * Get label for purpose from i18n (files:purposes.{purpose})
 */
function getPurposeLabel(purpose: string): string {
  return getFileTranslation(`purposes.${purpose}`, purpose);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format date for display name
 */
function formatDateForDisplay(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Sanitize string for filename (remove special chars)
 */
function sanitizeForFilename(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9Α-Ωα-ωάέήίόύώΐΰ\s\-_]/g, '') // Keep Greek, Latin, numbers
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Remove multiple underscores
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .trim();
}

/**
 * Normalize string for sorting/search (lowercase, no accents)
 */
function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Keep only alphanumeric
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Build human-readable file display name
 *
 * This is a PURE FUNCTION that generates display names for Firestore FileRecord.
 * It does NOT modify storage paths - those use IDs only!
 *
 * @example
 * ```typescript
 * // Contact photo
 * const result = buildFileDisplayName({
 *   entityType: 'contact',
 *   entityId: 'contact_123',
 *   domain: 'admin',
 *   category: 'photos',
 *   entityLabel: 'Γιώργος Παπαδόπουλος',
 *   purpose: 'profile',
 * });
 * // result.displayName = "Φωτογραφία Προφίλ - Γιώργος Παπαδόπουλος"
 * // result.exportFilename = "Φωτογραφία_Προφίλ_Γιώργος_Παπαδόπουλος.jpg"
 *
 * // Building floorplan
 * const result2 = buildFileDisplayName({
 *   entityType: 'floor',
 *   entityId: 'floor_456',
 *   domain: 'construction',
 *   category: 'floorplans',
 *   entityLabel: 'Κτίριο Α',
 *   descriptors: ['1ος Όροφος'],
 *   revision: 2,
 * });
 * // result2.displayName = "Κάτοψη - Κτίριο Α - 1ος Όροφος (v2)"
 * ```
 */
export function buildFileDisplayName(input: FileDisplayNameInput): FileDisplayNameResult {
  const parts: string[] = [];

  // 🏢 ENTERPRISE: Custom title takes precedence (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
  if (input.customTitle && input.customTitle.trim() !== '') {
    // Use custom title as the first part
    parts.push(input.customTitle.trim());
  } else {
    // 1. Category label (always first)
    const categoryLabel = getCategoryLabel(input.category);
    parts.push(categoryLabel);

    // 2. Purpose/descriptor if provided
    if (input.purpose) {
      // Capitalize first letter
      const purposeLabel = input.purpose.charAt(0).toUpperCase() + input.purpose.slice(1);
      parts[0] = `${categoryLabel} ${purposeLabel}`;
    }
  }

  // 3. Entity label if provided
  if (input.entityLabel) {
    parts.push(input.entityLabel);
  }

  // 4. Additional descriptors
  if (input.descriptors && input.descriptors.length > 0) {
    parts.push(...input.descriptors);
  }

  // 5. Date if provided
  if (input.occurredAt) {
    parts.push(formatDateForDisplay(input.occurredAt));
  }

  // 6. Revision if provided
  let revisionSuffix = '';
  if (input.revision !== undefined && input.revision > 1) {
    revisionSuffix = ` (v${input.revision})`;
  }

  // Build display name
  const displayName = parts.join(' - ') + revisionSuffix;

  // Build normalized title (for sorting/search)
  const normalizedTitle = normalizeForSearch(displayName);

  // Build export filename
  const ext = input.ext || 'file';
  const sanitizedParts = parts.map(sanitizeForFilename).filter(Boolean);
  const exportFilename = sanitizedParts.join('_') + (revisionSuffix ? `_v${input.revision}` : '') + `.${ext}`;

  return {
    displayName,
    normalizedTitle,
    exportFilename,
  };
}

// ============================================================================
// HELPER BUILDERS (for common patterns)
// ============================================================================

/**
 * Build display name for contact photo
 * 🏢 ENTERPRISE: ext is REQUIRED - no hardcoded defaults (ADR-030)
 */
export function buildContactPhotoDisplayName(
  contactName: string,
  ext: string,
  purpose: 'profile' | 'id' | 'other' = 'profile'
): FileDisplayNameResult {
  // 🏢 ENTERPRISE: Use i18n labels instead of hardcoded values
  const purposeLabel = purpose === 'other' ? '' : getPurposeLabel(purpose);

  return buildFileDisplayName({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: '', // Not needed for display name
    domain: FILE_DOMAINS.ADMIN,
    category: FILE_CATEGORIES.PHOTOS,
    entityLabel: contactName,
    purpose: purposeLabel,
    ext,
  });
}

/**
 * Build display name for floorplan
 * 🏢 ENTERPRISE: ext is REQUIRED - no hardcoded defaults (ADR-030)
 */
export function buildFloorplanDisplayName(
  buildingName: string,
  ext: string,
  floorLabel?: string,
  revision?: number
): FileDisplayNameResult {
  const descriptors = floorLabel ? [floorLabel] : [];

  return buildFileDisplayName({
    entityType: ENTITY_TYPES.FLOOR,
    entityId: '', // Not needed for display name
    domain: FILE_DOMAINS.CONSTRUCTION,
    category: FILE_CATEGORIES.FLOORPLANS,
    entityLabel: buildingName,
    descriptors,
    revision,
    ext,
  });
}

/**
 * Build display name for contract document
 * 🏢 ENTERPRISE: ext is REQUIRED - no hardcoded defaults (ADR-030)
 */
export function buildContractDisplayName(
  entityLabel: string,
  ext: string,
  occurredAt?: Date,
  revision?: number
): FileDisplayNameResult {
  return buildFileDisplayName({
    entityType: ENTITY_TYPES.PROJECT,
    entityId: '', // Not needed for display name
    domain: FILE_DOMAINS.LEGAL,
    category: FILE_CATEGORIES.CONTRACTS,
    entityLabel,
    occurredAt,
    revision,
    ext,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  getDomainLabel,
  getCategoryLabel,
  getEntityTypeLabel,
  formatDateForDisplay,
  sanitizeForFilename,
  normalizeForSearch,
};
