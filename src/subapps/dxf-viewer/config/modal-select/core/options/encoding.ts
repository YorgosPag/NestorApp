/**
 * @fileoverview Encoding & Boolean Options Module
 * @description Extracted from modal-select.ts - ENCODING & BOOLEAN OPTIONS
 * Values are i18n keys (dxf-viewer namespace) — consumers must use t() to render.
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.1.0 - i18n keys (ADR-296 Phase 4H)
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING, i18n SSoT
 */

// ====================================================================
// ENCODING OPTIONS - i18n keys (dxf-viewer namespace)
// ====================================================================

export const MODAL_SELECT_ENCODING_OPTIONS = [
  {
    value: 'windows-1253',
    label: 'encoding.windows1253',
    description: 'encoding.windows1253Desc'
  },
  {
    value: 'UTF-8',
    label: 'encoding.utf8',
    description: 'encoding.utf8Desc'
  },
  {
    value: 'windows-1252',
    label: 'encoding.windows1252',
    description: 'encoding.windows1252Desc'
  },
  {
    value: 'ISO-8859-7',
    label: 'encoding.iso88597',
    description: 'encoding.iso88597Desc'
  }
] as const;

// ====================================================================
// BOOLEAN OPTIONS - i18n keys (dxf-viewer namespace)
// ====================================================================

export const MODAL_SELECT_BOOLEAN_OPTIONS = [
  { value: 'yes', label: 'common:boolean.yes' },
  { value: 'no', label: 'common:boolean.no' }
] as const;

// ====================================================================
// ACCESSOR FUNCTIONS
// ====================================================================

export function getEncodingOptions() {
  return MODAL_SELECT_ENCODING_OPTIONS;
}

export function getBooleanOptions() {
  return MODAL_SELECT_BOOLEAN_OPTIONS;
}