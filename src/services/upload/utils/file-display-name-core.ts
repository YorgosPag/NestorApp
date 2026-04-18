/**
 * =============================================================================
 * 🏢 ENTERPRISE FILE DISPLAY NAME — CORE BUILDER
 * =============================================================================
 *
 * Pure function that composes a FileDisplayNameResult from structured input.
 * Does NOT modify storage paths (those use IDs only — see ADR-031).
 *
 * @module upload/utils/file-display-name-core
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-314 Phase C.5.7 — SRP split from file-display-name.ts
 */

import type { FileDisplayNameInput, FileDisplayNameResult } from './file-display-name-types';
import { getFileCategoryLabel, getPurposeLabel } from './file-display-name-i18n';
import {
  purposeToLabelMap,
  formatDateForFilename,
  sanitizeForFilename,
  normalizeForSearch,
} from './file-display-name-utils';

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
  // 🏢 ENTERPRISE: Always use Greek ('el') for stored displayNames to ensure consistency
  const language = input.language || 'el';

  // 🏢 ENTERPRISE: Custom title takes precedence (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
  if (input.customTitle && input.customTitle.trim() !== '') {
    // Use custom title as the first part
    parts.push(input.customTitle.trim());
  } else {
    // 🏢 ADR-191: Try entry point label from purpose → STUDY_ENTRIES map
    // This is the most reliable way to get the correct label for study files
    const entryPointLabel = input.purpose
      ? purposeToLabelMap.get(input.purpose)
      : undefined;

    if (entryPointLabel) {
      // Use study entry point label (e.g., "Αίτηση Οικοδομικής Άδειας")
      const label = language === 'en' ? entryPointLabel.en : entryPointLabel.el;
      parts.push(label);
    } else {
      // Fallback: Category + purpose label for non-study files
      const categoryLabel = getFileCategoryLabel(input.category, language);
      parts.push(categoryLabel);

      if (input.purpose) {
        const purposeLabel = getPurposeLabel(input.purpose, language);
        parts[0] = `${categoryLabel} ${purposeLabel}`;
      }
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
    parts.push(formatDateForFilename(input.occurredAt));
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
