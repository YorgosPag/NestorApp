/**
 * =============================================================================
 * ISO 19650 VALIDATORS — type guards + regex validators + derivation fallback
 * =============================================================================
 *
 * Pure helpers that operate on values produced (or about to be produced) for
 * the 5 FileRecord ISO 19650 fields (ADR-373). Zero side effects, zero I/O.
 *
 * Used by:
 *  - iso19650-enricher (validates AI output, applies derivation fallback)
 *  - file-record-post-finalize-hooks (sanitizes payload before Firestore write)
 *  - Phase 2 UI (form validation for manual override)
 *
 * @module services/iso19650/validators
 * @see ADR-373 §D2 + §D5
 */

import {
  DISCIPLINE_CODES,
  DOCUMENT_SERIES,
  CDE_STATES,
  SUITABILITY_CODES,
  SUITABILITY_CODE_REGEX,
  REVISION_CODE_REGEX,
  BUILDING_CODE_REGEX,
  STUDY_GROUP_TO_DEFAULT_DISCIPLINE,
  type DisciplineCode,
  type DocumentSeries,
  type CdeState,
  type SuitabilityCode,
} from '@/config/iso19650-constants';
import { getGroupForPurpose } from '@/config/study-groups-config';

// ============================================================================
// TYPE GUARDS — runtime validation που στενεύει unknown → typed enum value
// ============================================================================

export function isDisciplineCode(value: unknown): value is DisciplineCode {
  return typeof value === 'string' && value in DISCIPLINE_CODES;
}

export function isDocumentSeries(value: unknown): value is DocumentSeries {
  if (typeof value !== 'number') return false;
  return value in DOCUMENT_SERIES;
}

export function isCdeState(value: unknown): value is CdeState {
  return typeof value === 'string' && value in CDE_STATES;
}

export function isSuitabilityCode(value: unknown): value is SuitabilityCode {
  return typeof value === 'string' && value in SUITABILITY_CODES;
}

// ============================================================================
// REGEX VALIDATORS — return boolean (true = valid)
// ============================================================================

/**
 * Validates revision tag against `(P|T|C|R|AB) + 2 digits` pattern.
 * Examples valid: 'P01', 'T02', 'C03', 'R10', 'AB99'
 * Examples invalid: 'P1', 'P001', 'X05', 'p01', 'IFC' (suitability — separate field)
 */
export function validateRevisionCode(value: unknown): value is string {
  return typeof value === 'string' && REVISION_CODE_REGEX.test(value);
}

/**
 * Validates suitability code against BS 1192:2007+A2 §8.
 * Valid: 'IFA', 'IFR', 'IFC', 'ASB'. Invalid: 'IFT', 'ifc', etc.
 */
export function validateSuitabilityCode(value: unknown): value is string {
  return typeof value === 'string' && SUITABILITY_CODE_REGEX.test(value);
}

/**
 * Validates building short code against composite Greek/Latin pattern.
 * Examples valid: 'Κ1', 'Κ12', 'Κ1-Α', 'Κ1-Β1', 'A-1', 'B12-Γ2'
 * Examples invalid: 'κ1' (lowercase), 'Κ123' (3 digits), 'Κ1-Α-Β' (multi-dash)
 */
export function validateBuildingCode(value: unknown): value is string {
  return typeof value === 'string' && BUILDING_CODE_REGEX.test(value);
}

// ============================================================================
// DERIVATION FALLBACK — used when AI enrichment fails / skipped (OQ7)
// ============================================================================

/**
 * Derivation result subset — only `disciplineCode` is derivable from purpose.
 * Other ISO fields (documentSeries, revisionCode, buildingCode, cdeState)
 * require AI content analysis — derivation never fills them.
 */
export interface PurposeDerivation {
  disciplineCode: DisciplineCode | null;
  derivedFromStudyGroup: string | null;
}

/**
 * Derive default `disciplineCode` from a FileRecord `purpose` (e.g. 'study-floorplan').
 *
 * Lookup chain:
 *   purpose → StudyGroup (via getGroupForPurpose, SSoT in study-groups-config)
 *           → DisciplineCode (via STUDY_GROUP_TO_DEFAULT_DISCIPLINE)
 *
 * Returns `{ disciplineCode: null, derivedFromStudyGroup: null }` when the
 * purpose is unknown or has no associated study group.
 *
 * NOTE (OQ7): always-AI policy means this is a FALLBACK only — invoked when
 * the AI call is skipped (budget cap) or fails (timeout / quota / parse error).
 */
export function deriveFromPurpose(purpose: string | undefined | null): PurposeDerivation {
  if (!purpose) {
    return { disciplineCode: null, derivedFromStudyGroup: null };
  }

  const group = getGroupForPurpose(purpose);
  if (!group) {
    return { disciplineCode: null, derivedFromStudyGroup: null };
  }

  return {
    disciplineCode: STUDY_GROUP_TO_DEFAULT_DISCIPLINE[group] ?? null,
    derivedFromStudyGroup: group,
  };
}
