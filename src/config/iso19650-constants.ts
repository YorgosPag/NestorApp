/**
 * =============================================================================
 * ISO 19650 METADATA CONSTANTS — SSoT
 * =============================================================================
 *
 * Centralized enums + regex validators for ISO 19650-1/-2:2018 + BS 1192:2007+A2
 * metadata fields injected into FileRecord (ADR-373).
 *
 * Used by:
 *  - src/types/file-record.ts          (type imports for FileRecord fields)
 *  - src/services/iso19650/validators  (regex + type guards + derivation)
 *  - src/services/ai-pipeline/tools/handlers/iso19650-enricher  (AI prompt + schema)
 *
 * Architecture: data-only constants, zero logic. Safe to import client + server.
 *
 * @module config/iso19650-constants
 * @see ADR-373 — FileRecord ISO 19650 Metadata Enrichment (Phase 1)
 * @see ADR-191 — Enterprise Document Management (parent)
 */

import type { StudyGroup } from './study-groups-config';

// ============================================================================
// DISCIPLINE CODES (OQ1 — 13 single-letter codes, approved 2026-05-24)
// ============================================================================
// Core 8: A/S/M/E/K/H/N/X — always available
// Extended 5: T/L/P/F/D — added 2026-05-24 για ελληνικές κατασκευαστικές
// ----------------------------------------------------------------------------
// `label` / `labelEl` are SERVER-SIDE data used in AI prompt building and
// validator messages. UI surfaces (Phase 2) will read via i18n keys —
// these constants act as the canonical default text.
// ============================================================================

export const DISCIPLINE_CODES = {
  // ─── Core 8 (BS 1192 / ISO 19650-2 §5.1.7) ───────────────────────────────
  A: { studyGroup: 'architectural' as StudyGroup, label: 'Architectural',                 labelEl: 'Αρχιτεκτονικά' },
  S: { studyGroup: 'structural'    as StudyGroup, label: 'Structural',                    labelEl: 'Στατικά' },
  M: { studyGroup: 'mechanical'    as StudyGroup, label: 'Mechanical (HVAC/Plumbing)',    labelEl: 'Μηχανολογικά' },
  E: { studyGroup: 'mechanical'    as StudyGroup, label: 'Electrical',                    labelEl: 'Ηλεκτρολογικά' },
  K: { studyGroup: 'energy'        as StudyGroup, label: 'KENAK (Energy)',                labelEl: 'Ενεργειακά (ΚΕΝΑΚ)' },
  H: { studyGroup: 'site'          as StudyGroup, label: 'HSE (Health/Safety/Environment)', labelEl: 'ΣΑΥ-ΦΑΥ / Εργοταξιακά' },
  N: { studyGroup: 'administrative' as StudyGroup, label: 'Notarial/Legal',               labelEl: 'Διοικητικά/Νομικά' },
  X: { studyGroup: 'fiscal'        as StudyGroup, label: 'Fiscal',                        labelEl: 'Φορολογικά/Ασφαλιστικά' },
  // ─── Extended 5 (Greek market specifics, OQ1 approved 2026-05-24) ────────
  T: { studyGroup: 'site'          as StudyGroup, label: 'Topographic',                   labelEl: 'Τοπογραφικά' },
  L: { studyGroup: 'mechanical'    as StudyGroup, label: 'Lift / Elevator',               labelEl: 'Ανελκυστήρες' },
  P: { studyGroup: 'administrative' as StudyGroup, label: 'Permits',                      labelEl: 'Άδειες (οικοδομική, ΤΑΥΤ, ΗΛΠΑΠ)' },
  F: { studyGroup: 'mechanical'    as StudyGroup, label: 'Fire Safety',                   labelEl: 'Πυρασφάλεια' },
  D: { studyGroup: 'site'          as StudyGroup, label: 'Demolition / AEKK',             labelEl: 'Κατεδαφίσεις / ΑΕΚΚ' },
} as const;

export type DisciplineCode = keyof typeof DISCIPLINE_CODES;

/** All discipline codes as an array (useful for OpenAI schema enums + tests). */
export const DISCIPLINE_CODE_VALUES = Object.keys(DISCIPLINE_CODES) as DisciplineCode[];

// ============================================================================
// DOCUMENT SERIES (OQ3 — strict enum, 9 series, approved 2026-05-24)
// ============================================================================
// Numeric series per ISO 19650 + Greek architectural convention.
// 100=κατόψεις, 200=όψεις, 300=τομές, 400=λεπτομέρειες,
// 500=κουφώματα/πίνακες, 600=διαμορφώσεις, 700=στατικά σχέδια,
// 800=Η/Μ schematics, 900=as-built / AIM.
// ============================================================================

export const DOCUMENT_SERIES = {
  100: { labelEl: 'Κατόψεις',           labelEn: 'Plans' },
  200: { labelEl: 'Όψεις',              labelEn: 'Elevations' },
  300: { labelEl: 'Τομές',              labelEn: 'Sections' },
  400: { labelEl: 'Λεπτομέρειες',       labelEn: 'Details' },
  500: { labelEl: 'Κουφώματα / Πίνακες', labelEn: 'Schedules' },
  600: { labelEl: 'Διαμορφώσεις',       labelEn: 'Landscape' },
  700: { labelEl: 'Στατικά σχέδια',     labelEn: 'Structural Drawings' },
  800: { labelEl: 'Η/Μ Schematics',     labelEn: 'MEP Schematics' },
  900: { labelEl: 'As-Built / AIM',     labelEn: 'As-Built / AIM' },
} as const;

export type DocumentSeries = keyof typeof DOCUMENT_SERIES;

/** All document series as an array (typed numerically — useful for OpenAI schema). */
export const DOCUMENT_SERIES_VALUES: readonly DocumentSeries[] =
  Object.keys(DOCUMENT_SERIES).map(Number) as DocumentSeries[];

// ============================================================================
// CDE STATES (OQ4 — ISO 19650-1 §10.2, approved 2026-05-24)
// ============================================================================
// Common Data Environment workflow state. ORTHOGONAL to FileLifecycleState
// (which is data-retention state). `SUPERSEDED` chosen over `ARCHIVED` for
// disambiguation with `lifecycleState.archived`.
// ============================================================================

export const CDE_STATES = {
  WIP:        { labelEl: 'Σε εξέλιξη',      labelEn: 'Work in Progress' },
  SHARED:     { labelEl: 'Σε διαβούλευση',  labelEn: 'Shared for Review' },
  PUBLISHED:  { labelEl: 'Εγκεκριμένο',      labelEn: 'Authorized for Use' },
  SUPERSEDED: { labelEl: 'Αντικαταστάθηκε',  labelEn: 'Superseded by Newer Revision' },
} as const;

export type CdeState = keyof typeof CDE_STATES;

/** All CDE states as an array. */
export const CDE_STATE_VALUES = Object.keys(CDE_STATES) as CdeState[];

// ============================================================================
// SUITABILITY CODES (BS 1192:2007+A2 — Phase 2, approved 2026-05-24 OQ2)
// ============================================================================
// Separate from revisionCode per BS 1192 separation pattern (Aconex/Bentley).
// Documents carry a suitability code describing their authorization status
// as an annotation on top of the revision stage.
// ============================================================================

export const SUITABILITY_CODES = {
  IFA: { labelEl: 'Για Έγκριση',           labelEn: 'Issued for Approval' },
  IFR: { labelEl: 'Για Σχολιασμό',         labelEn: 'Issued for Review' },
  IFC: { labelEl: 'Για Κατασκευή',         labelEn: 'Issued for Construction' },
  ASB: { labelEl: 'Τελικό Κατασκευής',     labelEn: 'As-Built' },
} as const;

export type SuitabilityCode = keyof typeof SUITABILITY_CODES;

/** All suitability codes as an array. */
export const SUITABILITY_CODE_VALUES = Object.keys(SUITABILITY_CODES) as SuitabilityCode[];

// ============================================================================
// REGEX VALIDATORS (OQ2 + OQ5 — approved 2026-05-24)
// ============================================================================

/**
 * Suitability code regex (BS 1192:2007+A2 §8).
 * Values: IFA / IFR / IFC / ASB.
 * Lives in separate `suitabilityCode` field from revisionCode.
 */
export const SUITABILITY_CODE_REGEX = /^(IFA|IFR|IFC|ASB)$/;

/**
 * Revision code regex (ISO 19650-2 §5.1.7).
 *  - P = Preliminary
 *  - T = Tender
 *  - C = Construction
 *  - R = Revision
 *  - AB = As-Built variant
 * Followed by exactly 2 digits.
 *
 * Suitability codes (IFA/IFR/IFC/ASB) live in separate `suitabilityCode` field
 * (BS 1192 separation pattern, Aconex/Bentley convention).
 *
 * Examples: P01, T02, C03, R10, AB99
 */
export const REVISION_CODE_REGEX = /^(P|T|C|R|AB)\d{2}$/;

/**
 * Composite building code regex (OQ5 approved 2026-05-24).
 *  - Required prefix: 1 uppercase letter (Greek or Latin)
 *  - Then EITHER:
 *      • 1-2 digits + optional dash-suffix (Κ1, Κ12, Κ1-Α, B12-Γ2)
 *      • A dash + 1-3 alphanumeric chars suffix (A-1, P-Γ2)
 *
 * Accepts: Κ1, Κ12, Κ1-Α, Κ1-Β1, A-1, B12-Γ2, A1, Α99
 * Rejects: κ1 (lowercase), Κ123 (>2 digits), Κ1-Α-Β (multi-dash),
 *          Κ (letter only), 1Κ (digit first), Κ1- (trailing dash),
 *          Κ1-αβγδ (>3-char suffix / lowercase suffix).
 */
export const BUILDING_CODE_REGEX = /^[Α-ΩA-Z](\d{1,2}(-[Α-ΩA-Z\d]{1,3})?|-[Α-ΩA-Z\d]{1,3})$/;

// ============================================================================
// REVERSE MAPPING — StudyGroup → default DisciplineCode
// ============================================================================
// Used by `deriveFromPurpose()` as FALLBACK when AI enrichment fails / is
// skipped (OQ7: always-AI, derivation only as safety net).
//
// Note: `mechanical` defaults to 'M' — AI may override to 'E', 'L', 'F'
// based on actual document content.
// ============================================================================

export const STUDY_GROUP_TO_DEFAULT_DISCIPLINE: Record<StudyGroup, DisciplineCode> = {
  administrative: 'N',
  fiscal:         'X',
  architectural:  'A',
  structural:     'S',
  mechanical:     'M',
  energy:         'K',
  site:           'H',
};

// ============================================================================
// AI BUDGET CAP (OQ6 — approved 2026-05-24)
// ============================================================================
// Hard per-file budget for ISO 19650 enrichment AI vision calls.
// 10× the standard gpt-4o-mini vision cost (~$0.001) — safety net για
// edge cases like multi-page PDFs > 50 pages.
//
// If estimated cost > this cap → skip AI call + fallback to purpose-derived
// disciplineCode only. Logged in iso19650Source.aiReasoning.
// ============================================================================

export const ISO19650_BUDGET_CAP_USD = 0.01;
