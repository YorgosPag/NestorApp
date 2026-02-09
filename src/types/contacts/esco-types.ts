/**
 * ============================================================================
 * ESCO Professional Classification Types (ADR-034)
 * ============================================================================
 *
 * European Skills, Competences, Qualifications and Occupations (ESCO)
 * Integration types for standardized occupation classification.
 *
 * Based on:
 * - ESCO v1.2.1 (December 2025)
 * - ISCO-08 hierarchy (ILO International Standard Classification of Occupations)
 * - EU multilingual taxonomy (28 languages, EL/EN supported)
 *
 * Architecture:
 * - Hybrid approach: Firestore cached subset + ESCO API fallback
 * - Bilingual support (Greek/English)
 * - Backward compatible with free-text profession field
 *
 * @module types/contacts/esco-types
 * @see https://esco.ec.europa.eu
 */

// ============================================================================
// ESCO OCCUPATION — Core Data Model
// ============================================================================

/**
 * ESCO Occupation document stored in Firestore cache.
 *
 * Maps to: `system/esco_cache/occupations/{documentId}`
 * Source: ESCO CSV download (occupations dataset)
 *
 * @example
 * ```typescript
 * const occupation: EscoOccupation = {
 *   uri: 'http://data.europa.eu/esco/occupation/abcd-1234',
 *   iscoCode: '2142',
 *   iscoGroup: '214',
 *   preferredLabel: {
 *     el: 'Πολιτικός Μηχανικός',
 *     en: 'Civil Engineer',
 *   },
 *   alternativeLabels: {
 *     el: ['Δομοστατικός Μηχανικός', 'Μηχανικός Κατασκευών'],
 *     en: ['Structural Engineer', 'Construction Engineer'],
 *   },
 * };
 * ```
 */
export interface EscoOccupation {
  /** ESCO unique URI identifier (e.g., "http://data.europa.eu/esco/occupation/{uuid}") */
  uri: string;

  /** ISCO-08 4-digit unit group code (e.g., "2142" for Civil Engineers) */
  iscoCode: string;

  /** ISCO-08 3-digit minor group code (e.g., "214" for Engineering Professionals) */
  iscoGroup: string;

  /** Preferred label in supported languages */
  preferredLabel: EscoBilingualText;

  /** Alternative labels / synonyms in supported languages */
  alternativeLabels?: EscoBilingualLabels;

  /** Description of the occupation in supported languages */
  description?: EscoBilingualText;
}

/**
 * Bilingual text pair (Greek + English).
 * Used for preferred labels and descriptions.
 */
export interface EscoBilingualText {
  /** Greek label */
  el: string;
  /** English label */
  en: string;
}

/**
 * Bilingual alternative labels (arrays of synonyms).
 * Used for search indexing — allows finding occupations by alternative names.
 */
export interface EscoBilingualLabels {
  /** Greek alternative labels */
  el: string[];
  /** English alternative labels */
  en: string[];
}

// ============================================================================
// ESCO SEARCH — Query & Results
// ============================================================================

/**
 * ESCO occupation search parameters.
 * Used by `EscoService.searchOccupations()`.
 */
export interface EscoSearchParams {
  /** Search query text (minimum 2 characters) */
  query: string;

  /** Language for search and results */
  language: EscoLanguage;

  /** Maximum number of results (default: 20) */
  limit?: number;

  /** Offset for pagination (default: 0) */
  offset?: number;

  /** Filter by ISCO major group (1-digit code, e.g., "2" for Professionals) */
  iscoMajorGroup?: string;
}

/**
 * ESCO search result item.
 * Includes match metadata for UI display.
 */
export interface EscoSearchResult {
  /** The matched occupation */
  occupation: EscoOccupation;

  /** Relevance score (0-1, higher = better match) */
  score: number;

  /** Which field matched (preferred label, alternative label, etc.) */
  matchedField: 'preferredLabel' | 'alternativeLabel' | 'iscoCode';
}

/**
 * ESCO search response.
 */
export interface EscoSearchResponse {
  /** Search results ordered by relevance */
  results: EscoSearchResult[];

  /** Total number of matching occupations */
  total: number;

  /** Search query used */
  query: string;

  /** Language used for search */
  language: EscoLanguage;
}

// ============================================================================
// ESCO CONTACT FIELDS — Integration with Contact System
// ============================================================================

/**
 * ESCO professional fields stored on an IndividualContact.
 *
 * These fields are **optional** and **backward compatible**:
 * - Contacts without ESCO data continue to work with free-text `profession`
 * - When user selects an ESCO occupation, `escoUri` and `iscoCode` are set
 * - `profession` field is always set (human-readable, cached label)
 *
 * Stored directly on the contact document (not in a subcollection).
 */
export interface EscoContactFields {
  /** ESCO occupation URI — link to EU taxonomy (optional) */
  escoUri?: string;

  /** Cached ESCO preferred label in user's language (optional) */
  escoLabel?: string;

  /** ISCO-08 4-digit code for grouping/filtering (optional) */
  iscoCode?: string;
}

// ============================================================================
// ESCO PICKER — UI Component Types
// ============================================================================

/**
 * Value emitted by the EscoOccupationPicker component.
 *
 * Two modes:
 * 1. **ESCO selection**: User selects from autocomplete → all fields populated
 * 2. **Free text**: User types custom text → only `profession` populated
 */
export interface EscoPickerValue {
  /** Human-readable profession text (always set) */
  profession: string;

  /** ESCO occupation URI (set only when user selects from autocomplete) */
  escoUri?: string;

  /** Cached ESCO label (set only when user selects from autocomplete) */
  escoLabel?: string;

  /** ISCO-08 code (set only when user selects from autocomplete) */
  iscoCode?: string;
}

/**
 * Props for the EscoOccupationPicker component.
 */
export interface EscoOccupationPickerProps {
  /** Current profession value (free text or ESCO label) */
  value: string;

  /** Current ESCO URI (if previously selected from ESCO) */
  escoUri?: string;

  /** Current ISCO code (if previously selected from ESCO) */
  iscoCode?: string;

  /** Callback when value changes */
  onChange: (value: EscoPickerValue) => void;

  /** Disabled state */
  disabled?: boolean;

  /** Placeholder text */
  placeholder?: string;

  /** Language for ESCO labels */
  language?: EscoLanguage;
}

// ============================================================================
// ESCO CONSTANTS & ENUMS
// ============================================================================

/** Supported ESCO languages in this application */
export type EscoLanguage = 'el' | 'en';

/**
 * ISCO-08 Major Groups (Level 1 classification).
 * Used for top-level filtering in the occupation picker.
 */
export const ISCO_MAJOR_GROUPS = {
  '1': { el: 'Διευθυντές', en: 'Managers' },
  '2': { el: 'Επαγγελματίες', en: 'Professionals' },
  '3': { el: 'Τεχνικοί', en: 'Technicians and Associate Professionals' },
  '4': { el: 'Υπάλληλοι Γραφείου', en: 'Clerical Support Workers' },
  '5': { el: 'Υπηρεσίες & Πωλήσεις', en: 'Service and Sales Workers' },
  '6': { el: 'Γεωργία & Αλιεία', en: 'Skilled Agricultural Workers' },
  '7': { el: 'Βιοτέχνες & Τεχνίτες', en: 'Craft and Related Trades Workers' },
  '8': { el: 'Χειριστές Μηχανημάτων', en: 'Plant and Machine Operators' },
  '9': { el: 'Ανειδίκευτοι Εργάτες', en: 'Elementary Occupations' },
  '0': { el: 'Ένοπλες Δυνάμεις', en: 'Armed Forces Occupations' },
} as const;

/** Type for ISCO major group code */
export type IscoMajorGroupCode = keyof typeof ISCO_MAJOR_GROUPS;

// ============================================================================
// FIRESTORE DOCUMENT — Cached ESCO Data
// ============================================================================

/**
 * ESCO occupation document as stored in Firestore.
 * Extends EscoOccupation with Firestore metadata.
 *
 * Collection: `system/esco_cache/occupations`
 */
export interface EscoOccupationDocument extends EscoOccupation {
  /** Firestore document ID (derived from URI hash) */
  id?: string;

  /** Lowercase search tokens for prefix matching (Greek) */
  searchTokensEl: string[];

  /** Lowercase search tokens for prefix matching (English) */
  searchTokensEn: string[];

  /** Timestamp of last cache update */
  updatedAt: Date;
}

// ============================================================================
// IMPORT SCRIPT — CSV Processing Types
// ============================================================================

/**
 * Raw ESCO CSV row from the occupations download.
 * Used by the import script only.
 */
export interface EscoCsvRow {
  conceptUri: string;
  conceptType: string;
  iscoGroup: string;
  preferredLabel: string;
  altLabels: string;
  description: string;
}

/**
 * Import configuration for the ESCO CSV→Firestore script.
 */
export interface EscoImportConfig {
  /** Path to the Greek CSV file */
  csvPathEl: string;

  /** Path to the English CSV file */
  csvPathEn: string;

  /** Firestore collection path for cached occupations */
  collectionPath: string;

  /** Batch size for Firestore writes (max 500) */
  batchSize: number;
}
