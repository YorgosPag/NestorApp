/**
 * =============================================================================
 * 🏢 ENTERPRISE FILE DISPLAY NAME — TYPES
 * =============================================================================
 *
 * Input/output contracts for buildFileDisplayName and related builders.
 *
 * @module upload/utils/file-display-name-types
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-314 Phase C.5.7 — SRP split from file-display-name.ts
 */

import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';

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

  /** 🏢 ENTERPRISE: Language for display name ('el' or 'en')
   * @default 'el' - Always use Greek for stored displayNames to ensure consistency */
  language?: 'el' | 'en';
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
