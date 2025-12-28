/**
 * @fileoverview Encoding & Boolean Options Module
 * @description Extracted from modal-select.ts - ENCODING & BOOLEAN OPTIONS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// ENCODING OPTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Standardized encoding options για DXF imports
 */
export const MODAL_SELECT_ENCODING_OPTIONS = [
  {
    value: 'windows-1253',
    label: 'Windows-1253 (Greek)',
    description: 'Για σωστή εμφάνιση Ελληνικών χαρακτήρων'
  },
  {
    value: 'UTF-8',
    label: 'UTF-8 (Προεπιλογή)',
    description: 'Διεθνής κωδικοποίηση Unicode'
  },
  {
    value: 'windows-1252',
    label: 'Windows-1252 (Western)',
    description: 'Λατινικοί χαρακτήρες'
  },
  {
    value: 'ISO-8859-7',
    label: 'ISO-8859-7 (Greek)',
    description: 'Παλαιότερη Ελληνική κωδικοποίηση'
  }
] as const;

// ====================================================================
// BOOLEAN OPTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Standardized boolean options (Ναι/Όχι)
 */
export const MODAL_SELECT_BOOLEAN_OPTIONS = [
  { value: 'yes', label: 'Ναι' },
  { value: 'no', label: 'Όχι' }
] as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get encoding options για DXF imports
 */
export function getEncodingOptions() {
  return MODAL_SELECT_ENCODING_OPTIONS;
}

/**
 * Get boolean options (Ναι/Όχι)
 */
export function getBooleanOptions() {
  return MODAL_SELECT_BOOLEAN_OPTIONS;
}