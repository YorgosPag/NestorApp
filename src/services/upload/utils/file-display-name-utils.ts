/**
 * =============================================================================
 * 🏢 ENTERPRISE FILE DISPLAY NAME — UTILITIES
 * =============================================================================
 *
 * Pure helpers for display name generation: date formatting (filename-safe),
 * string sanitization, search normalization, and the purpose→label map.
 *
 * @module upload/utils/file-display-name-utils
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-314 Phase C.5.7 — SRP split from file-display-name.ts
 *
 * SSoT NOTE: `formatDateForFilename` is semantically distinct from the SSoT
 * `formatDateForDisplay` in `@/lib/intl-domain` which takes an ISO string
 * and returns `dd/mm/yyyy` (slashes) for UI forms. This helper takes a
 * `Date` and returns `dd-mm-yyyy` (dashes) — filesystem-safe for export
 * filenames.
 */

import { STUDY_ENTRIES } from '@/config/upload-entry-points/entries-studies';

// ============================================================================
// 🏢 ENTERPRISE: PURPOSE → ENTRY POINT LABEL MAP (ADR-191)
// ============================================================================
// Built once at module init. Maps study purposes to their i18n labels.
// Used as fallback when customTitle is not provided.

export const purposeToLabelMap = new Map<string, { el: string; en: string }>(
  STUDY_ENTRIES.map((e) => [e.purpose, e.label])
);

/**
 * Format date for export filename (dashes, filesystem-safe)
 *
 * Renamed from `formatDateForDisplay` (ADR-314 Phase C.5.7) to avoid SSoT
 * collision with `@/lib/intl-domain`::formatDateForDisplay which returns
 * slash-separated dates for UI forms.
 *
 * @example formatDateForFilename(new Date('2026-04-18')) // "18-04-2026"
 */
export function formatDateForFilename(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Sanitize string for filename (remove special chars, keep Greek/Latin/digits)
 */
export function sanitizeForFilename(str: string): string {
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
export function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Keep only alphanumeric
    .replace(/\s+/g, ' ')
    .trim();
}
