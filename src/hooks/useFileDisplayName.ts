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
import { STUDY_ENTRIES } from '@/config/upload-entry-points/entries-studies';

/**
 * 🏢 ENTERPRISE: Add file extension to display name
 * Ensures file extension is shown for clarity (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
 */
function addExtension(displayName: string, ext?: string): string {
  if (!ext) return displayName;

  // Normalize extension (add dot if needed)
  const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;

  // Check if displayName already ends with the extension
  if (displayName.toLowerCase().endsWith(normalizedExt.toLowerCase())) {
    return displayName;
  }

  return `${displayName}${normalizedExt}`;
}

// 🏢 ADR-191: Purpose → entry point label map
// Lazy-initialized to prevent TDZ issues with Webpack module concatenation + Terser
let _purposeToLabelMap: Map<string, { el: string; en: string }> | null = null;
function getPurposeToLabelMap(): Map<string, { el: string; en: string }> {
  if (!_purposeToLabelMap) {
    _purposeToLabelMap = new Map(STUDY_ENTRIES.map((e) => [e.purpose, e.label]));
  }
  return _purposeToLabelMap;
}

/**
 * 🏢 ENTERPRISE: Hook for runtime display name translation
 *
 * Returns a function that translates FileRecord display names
 * based on the current i18n language context.
 *
 * TRANSLATION LOGIC:
 * 1. Study files (purpose maps to STUDY_ENTRIES) → Use entry point label
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

      // CASE 1: No metadata → return stored displayName with extension (legacy files)
      if (!fileRecord.category) {
        return addExtension(fileRecord.displayName, fileRecord.ext);
      }

      // CASE 2: Has category but no purpose → translate category only
      if (!fileRecord.purpose) {
        // Extract parts from original displayName
        // Format: "Category - Entity Label - Descriptors (vN)"
        const parts = fileRecord.displayName.split(' - ');

        if (parts.length === 0) {
          return addExtension(fileRecord.displayName, fileRecord.ext);
        }

        // Translate category, keep rest as-is
        const categoryLabel = t(`categories.${fileRecord.category}`, { defaultValue: fileRecord.category });
        const translatedParts = [categoryLabel, ...parts.slice(1)];

        // 🏢 ENTERPRISE: Add file extension for clarity
        return addExtension(translatedParts.join(' - '), fileRecord.ext);
      }

      // CASE 3: Has full metadata (category + purpose)
      const parts = fileRecord.displayName.split(' - ');

      if (parts.length === 0) {
        return addExtension(fileRecord.displayName, fileRecord.ext);
      }

      // 🏢 ADR-191: Study entry points get their label from STUDY_ENTRIES config
      const entryPointLabel = getPurposeToLabelMap().get(fileRecord.purpose);
      if (entryPointLabel) {
        // Use entry point label in current language (e.g., "Αίτηση Οικοδομικής Άδειας")
        const lang = i18n.language as 'el' | 'en';
        const firstPart = lang === 'en' ? entryPointLabel.en : entryPointLabel.el;
        const translatedParts = [firstPart, ...parts.slice(1)];
        return addExtension(translatedParts.join(' - '), fileRecord.ext);
      }

      // Non-study files: translate category + purpose via i18n
      const categoryLabel = t(`categories.${fileRecord.category}`, { defaultValue: fileRecord.category });
      const purposeLabel = t(`purposes.${fileRecord.purpose}`, { defaultValue: fileRecord.purpose });
      const firstPart = `${categoryLabel} ${purposeLabel}`;
      const translatedParts = [firstPart, ...parts.slice(1)];

      // 🏢 ENTERPRISE: Add file extension for clarity (ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
      return addExtension(translatedParts.join(' - '), fileRecord.ext);
    },
    [t, i18n.language] // 🏢 CRITICAL: Must include i18n.language to trigger re-render on language change!
  );

  return translateDisplayName;
}
