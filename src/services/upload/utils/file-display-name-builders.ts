/**
 * =============================================================================
 * 🏢 ENTERPRISE FILE DISPLAY NAME — DOMAIN BUILDERS
 * =============================================================================
 *
 * Convenience builders for common file patterns (contact photo, floorplan,
 * contract) plus the deprecated runtime record translator.
 *
 * @module upload/utils/file-display-name-builders
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-314 Phase C.5.7 — SRP split from file-display-name.ts
 */

import {
  ENTITY_TYPES,
  FILE_DOMAINS,
  FILE_CATEGORIES,
} from '@/config/domain-constants';
import type { FileDisplayNameResult } from './file-display-name-types';
import { buildFileDisplayName } from './file-display-name-core';
import { getFileCategoryLabel, getPurposeLabel } from './file-display-name-i18n';

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

/**
 * 🏢 ENTERPRISE: Runtime translation of file display names
 *
 * ⚠️ DEPRECATED: Use `useFileDisplayName()` hook instead!
 *
 * This function is DEPRECATED because it uses the global i18n instance,
 * which doesn't react to language changes in React components.
 *
 * For React components, use the `useFileDisplayName()` hook from
 * `@/hooks/useFileDisplayName` which properly reacts to language changes.
 *
 * This function is kept only for backwards compatibility with non-React code.
 *
 * @deprecated Use `useFileDisplayName()` hook for React components
 * @see {@link useFileDisplayName} - React hook for runtime translation
 */
export function buildDisplayNameFromRecord(fileRecord: {
  category?: string;
  purpose?: string;
  displayName: string;
}): string {
  // 🚨 DEPRECATED: This uses global i18n, which doesn't react to language changes
  // Use useFileDisplayName() hook in React components instead!

  // If no category metadata, return stored displayName as fallback
  if (!fileRecord.category) {
    return fileRecord.displayName;
  }

  // Extract parts from original displayName
  const parts = fileRecord.displayName.split(' - ');

  if (parts.length === 0) {
    return fileRecord.displayName;
  }

  // Translate category
  const categoryLabel = getFileCategoryLabel(fileRecord.category);

  let firstPart = categoryLabel;
  if (fileRecord.purpose) {
    const purposeLabel = getPurposeLabel(fileRecord.purpose);
    firstPart = `${categoryLabel} ${purposeLabel}`;
  }

  // Replace first part, keep rest as-is
  const translatedParts = [firstPart, ...parts.slice(1)];

  return translatedParts.join(' - ');
}
