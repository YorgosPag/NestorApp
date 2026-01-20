/**
 * =============================================================================
 * 🏢 ENTERPRISE: useFileDisplayName Hook
 * =============================================================================
 *
 * React hook for runtime translation of FileRecord display names.
 * Uses current i18n context to translate category and purpose labels.
 *
 * ARCHITECTURE:
 * - Metadata-driven translation (category + purpose fields)
 * - Clean fallback for legacy files (no string parsing)
 * - Professional patterns (SAP/Salesforce/Microsoft approach)
 *
 * @module hooks/useFileDisplayName
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * @example
 * ```tsx
 * const translateDisplayName = useFileDisplayName();
 * const displayName = translateDisplayName(fileRecord);
 * // Auto-translates based on current language!
 * // Greek mode: "Φωτογραφία Προφίλ - Γιώργος Παπαδόπουλος"
 * // English mode: "Photo Profile - George Papadopoulos"
 * ```
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FileRecord } from '@/types/file-record';

/**
 * 🏢 ENTERPRISE: Hook for runtime display name translation
 *
 * Returns a function that translates FileRecord display names
 * based on the current i18n language context.
 *
 * TRANSLATION LOGIC:
 * 1. Files with full metadata (category + purpose) → Translate both
 * 2. Files with category only → Translate category, keep rest
 * 3. Legacy files (no metadata) → Return stored displayName AS-IS
 *
 * This is a CLEAN, metadata-driven approach with NO hardcoded maps
 * or string parsing (enterprise-grade architecture).
 */
export function useFileDisplayName() {
  const { t, i18n } = useTranslation('files');

  /**
   * Translate display name from FileRecord
   * 🏢 IMPORTANT: Re-creates when language changes (i18n.language dependency)
   */
  const translateDisplayName = useCallback(
    (fileRecord: FileRecord): string => {
      // 🏢 ENTERPRISE: Clean architecture - metadata-driven translation

      // CASE 1: No metadata → return stored displayName AS-IS (legacy files)
      if (!fileRecord.category) {
        return fileRecord.displayName;
      }

      // CASE 2: Has category but no purpose → translate category only
      if (!fileRecord.purpose) {
        // Extract parts from original displayName
        // Format: "Category - Entity Label - Descriptors (vN)"
        const parts = fileRecord.displayName.split(' - ');

        if (parts.length === 0) {
          return fileRecord.displayName;
        }

        // Translate category, keep rest as-is
        const categoryLabel = t(`categories.${fileRecord.category}`, { defaultValue: fileRecord.category });
        const translatedParts = [categoryLabel, ...parts.slice(1)];

        return translatedParts.join(' - ');
      }

      // CASE 3: Has full metadata (category + purpose) → translate both (ENTERPRISE!)
      const parts = fileRecord.displayName.split(' - ');

      if (parts.length === 0) {
        return fileRecord.displayName;
      }

      // Translate category and purpose
      const categoryLabel = t(`categories.${fileRecord.category}`, { defaultValue: fileRecord.category });
      const purposeLabel = t(`purposes.${fileRecord.purpose}`, { defaultValue: fileRecord.purpose });

      // Rebuild first part: "Category Purpose"
      const firstPart = `${categoryLabel} ${purposeLabel}`;

      // Replace first part, keep rest as-is (entity labels, dates, etc.)
      const translatedParts = [firstPart, ...parts.slice(1)];

      return translatedParts.join(' - ');
    },
    [t, i18n.language] // 🏢 CRITICAL: Must include i18n.language to trigger re-render on language change!
  );

  return translateDisplayName;
}
