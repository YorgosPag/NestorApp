/**
 * @fileoverview Utility Accessors Module
 * @description Extracted from modal-select.ts - HELPER FUNCTIONS & MISCELLANEOUS CONSTANTS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// UTILITY CONSTANTS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Document Type Options Configuration Type
 * ✅ ENTERPRISE: Type-safe document type options
 */
export interface DocumentTypeOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Board Type Options Configuration Type
 * ✅ ENTERPRISE: Type-safe board type options
 */
export interface BoardTypeOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Representative Position Options Configuration Type
 * ✅ ENTERPRISE: Type-safe representative position options
 */
export interface RepresentativePositionOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Property Type Options Configuration Type
 * ✅ ENTERPRISE: Type-safe property type options
 */
export interface PropertyTypeOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Unit Filter Options Configuration Type
 * ✅ ENTERPRISE: Type-safe unit filter options
 */
export interface UnitFilterOption {
  readonly value: string;
  readonly label: string;
}

// ====================================================================
// MISCELLANEOUS CONSTANTS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Document Type Options - Centralized για document type selections
 * ✅ ENTERPRISE: Single source of truth για όλα τα document type options
 */
export const VOCAB_DOCUMENT_TYPES: readonly DocumentTypeOption[] = [
  { value: 'certificate', label: 'Πιστοποιητικό' },
  { value: 'announcement', label: 'Ανακοίνωση' },
  { value: 'registration', label: 'Έγγραφο Σύστασης' },
  { value: 'amendment', label: 'Τροποποίηση Καταστατικού' }
] as const;

/**
 * Board Type Options - Centralized για company board type selections
 * ✅ ENTERPRISE: Single source of truth για όλα τα board type options
 */
export const VOCAB_BOARD_TYPES: readonly BoardTypeOption[] = [
  { value: 'general_assembly', label: 'Γενική Συνέλευση' },
  { value: 'board_directors', label: 'Διοικητικό Συμβούλιο' },
  { value: 'supervisory_board', label: 'Εποπτικό Συμβούλιο' }
] as const;

/**
 * Representative Position Options - Centralized για representative position selections
 * ✅ ENTERPRISE: Single source of truth για όλα τα representative position options
 */
export const VOCAB_REPRESENTATIVE_POSITIONS: readonly RepresentativePositionOption[] = [
  { value: 'ceo', label: 'Διευθύνων Σύμβουλος' },
  { value: 'president', label: 'Πρόεδρος Δ.Σ.' },
  { value: 'manager', label: 'Διαχειριστής' },
  { value: 'legal_rep', label: 'Νόμιμος Εκπρόσωπος' },
  { value: 'secretary', label: 'Γραμματέας' }
] as const;

/**
 * Property Type Options - Centralized για property type filtering
 * ✅ ENTERPRISE: Single source of truth για όλα τα property type options
 */
export const VOCAB_PROPERTY_TYPE_OPTIONS: readonly PropertyTypeOption[] = [
  { value: 'apartment', label: 'Διαμέρισμα' },
  { value: 'house', label: 'Κατοικία' },
  { value: 'office', label: 'Γραφείο' },
  { value: 'retail', label: 'Κατάστημα' },
  { value: 'warehouse', label: 'Αποθήκη' },
  { value: 'parking', label: 'Θέση Στάθμευσης' }
] as const;

/**
 * Unit Filter Options - Centralized για unit filtering UI
 * ✅ ENTERPRISE: Single source of truth για όλα τα unit filter options
 */
export const VOCAB_UNIT_FILTER_OPTIONS: readonly UnitFilterOption[] = [
  { value: 'available', label: 'Διαθέσιμες' },
  { value: 'rented', label: 'Ενοικιασμένες' },
  { value: 'sold', label: 'Πωληθείσες' },
  { value: 'reserved', label: 'Κρατημένες' },
  { value: 'maintenance', label: 'Συντήρηση' }
] as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get document type options
 * ✅ CENTRALIZED: Getter function για document type options
 */
export function getDocumentTypeOptions(): readonly DocumentTypeOption[] {
  return VOCAB_DOCUMENT_TYPES;
}

/**
 * Get board type options
 * ✅ CENTRALIZED: Getter function για board type options
 */
export function getBoardTypeOptions(): readonly BoardTypeOption[] {
  return VOCAB_BOARD_TYPES;
}

/**
 * Get representative position options
 * ✅ CENTRALIZED: Getter function για representative position options
 */
export function getRepresentativePositionOptions(): readonly RepresentativePositionOption[] {
  return VOCAB_REPRESENTATIVE_POSITIONS;
}

/**
 * Get property type options
 * ✅ CENTRALIZED: Getter function για property type options
 */
export function getPropertyTypeOptions(): readonly PropertyTypeOption[] {
  return VOCAB_PROPERTY_TYPE_OPTIONS;
}

/**
 * Get unit filter options
 * ✅ CENTRALIZED: Getter function για unit filter options
 */
export function getUnitFilterOptions(): readonly UnitFilterOption[] {
  return VOCAB_UNIT_FILTER_OPTIONS;
}

// ====================================================================
// DOMAIN-SPECIFIC AGGREGATORS - 🏢 ENTERPRISE ORGANIZATION
// ====================================================================

/**
 * Get all company-related options
 * ✅ CENTRALIZED: Domain-organized access pattern για company options
 */
export function getCompanyOptions() {
  return {
    documentTypes: VOCAB_DOCUMENT_TYPES,
    boardTypes: VOCAB_BOARD_TYPES,
    representativePositions: VOCAB_REPRESENTATIVE_POSITIONS
  } as const;
}

/**
 * Get all property-related options
 * ✅ CENTRALIZED: Domain-organized access pattern για property options
 */
export function getPropertyOptions() {
  return {
    propertyTypes: VOCAB_PROPERTY_TYPE_OPTIONS,
    unitFilters: VOCAB_UNIT_FILTER_OPTIONS
  } as const;
}

/**
 * Get all utility options combined
 * ✅ CENTRALIZED: Complete utility options access pattern
 */
export function getAllUtilityOptions() {
  return {
    company: getCompanyOptions(),
    property: getPropertyOptions()
  } as const;
}