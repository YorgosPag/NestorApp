/**
 * @related ADR-759 §4.2/§4.3 — the «Στοιχεία Τοπογραφικού» card, as DATA
 *
 * 🔑 WHY A CONFIG AND NOT COMPONENTS. The card has ~30 scalar fields across
 * sections Α–Ι. Written as one editor per field that is ~30 near-identical blocks —
 * exactly the sibling-clone shape CLAUDE.md N.18 exists to stop, and the one that
 * `ssot:discover` (name-based) cannot see. Instead the card is described once here
 * and rendered by a single row component. Adding a field is one entry, not one file.
 *
 * 🔑 WHY EXPLICIT `read`/`write` LAMBDAS AND NOT STRING PATHS. String paths need a
 * runtime resolver and a cast at every use; these are ordinary functions the
 * compiler checks. `kind` discriminates the union, so the renderer narrows `read`
 * and `write` together — there is no `as` anywhere in this file (N.2).
 *
 * ⚠️ ORDER IS THE CONTRACT. The sections and their order mirror the printed form
 * («ΣΤΟΙΧΕΙΑ ΕΡΕΥΝΑΣ ΙΔΙΩΤΗ ΜΗΧΑΝΙΚΟΥ», ADR-759 §2β.2), so the engineer reads the
 * card in the same order as the drawing. Do not "tidy" it into our own taxonomy —
 * that was the first draft of §4.2 and the measurement overturned it.
 */
import type { Sourced, SurveyRecord } from '@/types/project-survey-record';

// ---------------------------------------------------------------------------
// Field accessors — a discriminated union so kind, read and write narrow together
// ---------------------------------------------------------------------------

interface FieldBase {
  /** i18n key under the `surveyRecord` namespace. */
  readonly labelKey: string;
  /** Optional i18n key for the helper line under the input. */
  readonly hintKey?: string;
  /**
   * Which **part of a list row** this accessor is — present only on row fields (Φ4β).
   *
   * 🔑 It is the join between what the drawing says and where it lands, and it exists so
   * that the writer can reuse **this very accessor** instead of restating the patch. A
   * second `(row) => ({...row, authority: next})` next to the card's own would be the
   * sibling clone N.18 exists to stop — and the failure would be silent, because both
   * compile and both look right.
   *
   * Scalar fields have no `part`: they are addressed by name through
   * `SURVEY_BINDING_SPECS`, which already points at these same constants.
   */
  readonly part?: string;
}

export interface TextFieldAccessor extends FieldBase {
  readonly kind: 'text';
  /** Render as a multi-line input — prose fields (sections Β/Γ/Δ/Ε). */
  readonly multiline?: boolean;
  read(record: SurveyRecord): Sourced<string>;
  write(record: SurveyRecord, next: Sourced<string>): SurveyRecord;
}

export interface NumberFieldAccessor extends FieldBase {
  readonly kind: 'number';
  read(record: SurveyRecord): Sourced<number>;
  write(record: SurveyRecord, next: Sourced<number>): SurveyRecord;
}

export interface BooleanFieldAccessor extends FieldBase {
  readonly kind: 'boolean';
  read(record: SurveyRecord): Sourced<boolean>;
  write(record: SurveyRecord, next: Sourced<boolean>): SurveyRecord;
}

export interface TextListFieldAccessor extends FieldBase {
  readonly kind: 'textList';
  read(record: SurveyRecord): Sourced<readonly string[]>;
  write(record: SurveyRecord, next: Sourced<readonly string[]>): SurveyRecord;
}

export type FieldAccessor =
  | TextFieldAccessor
  | NumberFieldAccessor
  | BooleanFieldAccessor
  | TextListFieldAccessor;

// ---------------------------------------------------------------------------
// Named accessors — the ones a drawing can land in (ADR-759 Φ3γ / Φ4)
// ---------------------------------------------------------------------------

/**
 * 🔑 WHY THESE ARE NAMED AND THE REST ARE NOT.
 *
 * A value read from a drawing that gets approved into the card must go through
 * **the same** `write` the engineer's keyboard goes through — the *same object*, not
 * a copy that happens to touch the same property. A second read/write pair for
 * `implementationAct.number` would be the sibling clone N.18 exists to stop, and the
 * failure mode is silent: both would compile, both would look right, and the day one
 * of them is corrected the other keeps writing the old shape.
 *
 * So the binding catalogue (`survey-bindable-fields.ts`) imports **these constants**
 * and the section arrays below embed the very same references. Identity is the
 * guarantee; a test asserts every bound spec is reachable from `allSurveyCardFields()`,
 * which is what makes "written to the database but invisible on the card" impossible.
 *
 * ⚠️ The un-named ones are un-named **on purpose**: `deviation`, `buildingSystem`,
 * `declaredFloors`, `suspensionStatus` and `isBuildable` are the fields the real G753
 * leaves blank or states only as prose. Naming them would invite a catalogue entry
 * with no reader behind it — the dead-vocabulary defect this whole ADR chain hunts.
 */

/** Section «Το έγγραφο» — when the surveyor signed what the record transcribes. */
export const SURVEY_DATE_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'fields.surveyDate',
  hintKey: 'fields.surveyDateHint',
  read: (r) => r.surveyDate,
  write: (r, v) => ({ ...r, surveyDate: v }),
};

// ── Section Α — ΟΡΟΙ ΔΟΜΗΣΗΣ ────────────────────────────────────────────────

export const SECTOR_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'fields.sector',
  read: (r) => r.buildingTerms.sector,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, sector: v } }),
};

export const PLOT_BOUNDARY_LABELS_FIELD: TextListFieldAccessor = {
  kind: 'textList',
  labelKey: 'fields.plotBoundaryLabels',
  hintKey: 'fields.plotBoundaryLabelsHint',
  read: (r) => r.buildingTerms.plotBoundaryLabels,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, plotBoundaryLabels: v } }),
};

export const MIN_FRONTAGE_FIELD: NumberFieldAccessor = {
  kind: 'number',
  labelKey: 'fields.minFrontage',
  read: (r) => r.buildingTerms.minFrontage,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, minFrontage: v } }),
};

export const MIN_AREA_FIELD: NumberFieldAccessor = {
  kind: 'number',
  labelKey: 'fields.minArea',
  read: (r) => r.buildingTerms.minArea,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, minArea: v } }),
};

export const DECLARED_COVERAGE_PCT_FIELD: NumberFieldAccessor = {
  kind: 'number',
  labelKey: 'fields.declaredCoveragePct',
  read: (r) => r.buildingTerms.declaredCoveragePct,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, declaredCoveragePct: v } }),
};

export const MAX_COVERAGE_PCT_FIELD: NumberFieldAccessor = {
  kind: 'number',
  labelKey: 'fields.maxCoveragePct',
  hintKey: 'fields.maxCoverageHint',
  read: (r) => r.buildingTerms.maxCoveragePct,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, maxCoveragePct: v } }),
};

/** Text, not number: the drawing says «κατά ΝΟΚ» as often as a figure. */
export const DECLARED_MAX_HEIGHT_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'fields.declaredMaxHeight',
  hintKey: 'fields.declaredMaxHeightHint',
  read: (r) => r.buildingTerms.declaredMaxHeight,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, declaredMaxHeight: v } }),
};

// 🔴 Three ΣΔ fields, not one. ADR-759 §4.2 rule 2: `1,3` alone keeps the result and
// destroys the reason, and the reason (the social factor) is what the engineer needs
// to see separately. The reader picks the three by arithmetic, not by position —
// see `uniqueSumTriple` in `lib/document-body/document-body-values.ts`.
export const DECLARED_SD_FIELD: NumberFieldAccessor = {
  kind: 'number',
  labelKey: 'fields.declaredSd',
  hintKey: 'fields.sdHint',
  read: (r) => r.buildingTerms.declaredSd,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, declaredSd: v } }),
};

export const SOCIAL_FACTOR_SD_FIELD: NumberFieldAccessor = {
  kind: 'number',
  labelKey: 'fields.socialFactorSd',
  read: (r) => r.buildingTerms.socialFactorSd,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, socialFactorSd: v } }),
};

export const TOTAL_SD_FIELD: NumberFieldAccessor = {
  kind: 'number',
  labelKey: 'fields.totalSd',
  read: (r) => r.buildingTerms.totalSd,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, totalSd: v } }),
};

export const LAND_USE_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'fields.landUse',
  read: (r) => r.buildingTerms.landUse,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, landUse: v } }),
};

export const IN_SOCIAL_FACTOR_ZONE_FIELD: BooleanFieldAccessor = {
  kind: 'boolean',
  labelKey: 'fields.inSocialFactorZone',
  read: (r) => r.buildingTerms.inSocialFactorZone,
  write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, inSocialFactorZone: v } }),
};

// ── Section Β — ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ ────────────────────────────────────────

export const SETTLEMENT_ACTS_FIELD: TextFieldAccessor = {
  kind: 'text',
  multiline: true,
  labelKey: 'fields.settlementActs',
  read: (r) => r.settlement.settlementActs,
  write: (r, v) => ({ ...r, settlement: { ...r.settlement, settlementActs: v } }),
};

export const IMPLEMENTATION_ACT_NUMBER_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'implementationAct.number',
  hintKey: 'implementationAct.numberHint',
  read: (r) => r.settlement.implementationAct.number,
  write: (r, v) => ({
    ...r,
    settlement: {
      ...r.settlement,
      implementationAct: { ...r.settlement.implementationAct, number: v },
    },
  }),
};

export const IMPLEMENTATION_ACT_DECISION_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'implementationAct.decision',
  read: (r) => r.settlement.implementationAct.decision,
  write: (r, v) => ({
    ...r,
    settlement: {
      ...r.settlement,
      implementationAct: { ...r.settlement.implementationAct, decision: v },
    },
  }),
};

export const IMPLEMENTATION_ACT_VOLUME_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'implementationAct.volume',
  read: (r) => r.settlement.implementationAct.volume,
  write: (r, v) => ({
    ...r,
    settlement: {
      ...r.settlement,
      implementationAct: { ...r.settlement.implementationAct, volume: v },
    },
  }),
};

export const IMPLEMENTATION_ACT_ENTRY_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'implementationAct.entry',
  read: (r) => r.settlement.implementationAct.entry,
  write: (r, v) => ({
    ...r,
    settlement: {
      ...r.settlement,
      implementationAct: { ...r.settlement.implementationAct, entry: v },
    },
  }),
};

export const IMPLEMENTATION_ACT_DATE_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'implementationAct.date',
  read: (r) => r.settlement.implementationAct.date,
  write: (r, v) => ({
    ...r,
    settlement: {
      ...r.settlement,
      implementationAct: { ...r.settlement.implementationAct, date: v },
    },
  }),
};

export const IMPLEMENTATION_ACT_REGISTRY_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'implementationAct.registry',
  read: (r) => r.settlement.implementationAct.registry,
  write: (r, v) => ({
    ...r,
    settlement: {
      ...r.settlement,
      implementationAct: { ...r.settlement.implementationAct, registry: v },
    },
  }),
};

/** Genuinely plural in G753: "Πολεοδομικών Ενοτήτων 16 και 17". */
export const IMPLEMENTATION_ACT_URBAN_UNITS_FIELD: TextListFieldAccessor = {
  kind: 'textList',
  labelKey: 'implementationAct.urbanUnits',
  read: (r) => r.settlement.implementationAct.urbanUnits,
  write: (r, v) => ({
    ...r,
    settlement: {
      ...r.settlement,
      implementationAct: { ...r.settlement.implementationAct, urbanUnits: v },
    },
  }),
};

export const IMPLEMENTATION_ACT_ORIGINAL_PROPERTIES_FIELD: TextListFieldAccessor = {
  kind: 'textList',
  labelKey: 'implementationAct.originalProperties',
  read: (r) => r.settlement.implementationAct.originalProperties,
  write: (r, v) => ({
    ...r,
    settlement: {
      ...r.settlement,
      implementationAct: { ...r.settlement.implementationAct, originalProperties: v },
    },
  }),
};

// ── Sections Γ–Ζ ────────────────────────────────────────────────────────────

/**
 * The prose of section Γ — **and not `isBuildable`**.
 *
 * 🔴 The drawing says «Είναι με τα κατά κανόνα όρια αρτιότητας». Deriving `true` from
 * that sentence is an inference, not a reading: the same section can carry conditions
 * («είναι άρτιο **κατά παρέκκλιση**»), and a boolean that says «buildable» where the
 * drawing said something conditional is a lie with the right shape (§2β.5). The
 * sentence lands verbatim; the checkbox stays the engineer's decision.
 */
export const BUILDABILITY_NOTE_FIELD: TextFieldAccessor = {
  kind: 'text',
  multiline: true,
  labelKey: 'fields.buildabilityNote',
  read: (r) => r.buildabilityNote,
  write: (r, v) => ({ ...r, buildabilityNote: v }),
};

export const ROAD_PLAN_DEFINITION_FIELD: TextFieldAccessor = {
  kind: 'text',
  multiline: true,
  labelKey: 'fields.roadPlanDefinition',
  read: (r) => r.roadPlanDefinition,
  write: (r, v) => ({ ...r, roadPlanDefinition: v }),
};

/**
 * 🔴 ADR-759 §2β.5: this number comes from the survey text, never from the
 * `Pinakas-Syntetagmenon` table — that table describes a different parcel
 * (4092,13 m² in another coordinate system) and would be wrong by 3×.
 *
 * The body states it **three times** independently (1.364,05 · 1364,05 · 1.364,05),
 * in three different documents of the same sheet — see `resolve-document-body.ts`.
 */
export const PLOT_AREA_FIELD: NumberFieldAccessor = {
  kind: 'number',
  labelKey: 'fields.plotArea',
  read: (r) => r.plotArea,
  write: (r, v) => ({ ...r, plotArea: v }),
};

export const HEIGHT_DATUM_FIELD: TextFieldAccessor = {
  kind: 'text',
  labelKey: 'fields.heightDatum',
  read: (r) => r.heightDatum,
  write: (r, v) => ({ ...r, heightDatum: v }),
};

/** One titled group of fields in the card. */
export interface SurveyCardSection {
  /** Stable id — used for anchors and test selectors, never shown. */
  readonly id: string;
  /** i18n key under `sections.*`. */
  readonly titleKey: string;
  readonly fields: readonly FieldAccessor[];
}

// ---------------------------------------------------------------------------
// Section «Το έγγραφο» — what this record transcribes, and when (ADR-759 Φ3γ)
// ---------------------------------------------------------------------------

/**
 * Not a section of the printed form — the form does not describe *itself*.
 *
 * 🔴 IT EXISTS BECAUSE THE FIELD DID NOT RENDER. `surveyDate` has been in the schema
 * since Φ2 and appeared in **no** section, so `SURVEY_CARD_ORDER` never drew it: the
 * engineer could neither read nor fill the one date that says *when the surveyor said
 * all this*. Landing «ΧΡΟΝΟΣ ΜΕΛΕΤΗΣ» into it without this section would have written
 * a value nobody can see — the §Η.1 failure, and the same "declared but unreachable"
 * shape as `no-primary-address` (ADR-759 §4.4).
 *
 * It sits **first** because it answers the question the reader asks before any other:
 * *which document am I looking at?* The Α–Ι order below is untouched.
 */
export const SURVEY_SECTION_DOC: SurveyCardSection = {
  id: 'doc-provenance',
  titleKey: 'sections.doc',
  fields: [SURVEY_DATE_FIELD],
};

// ---------------------------------------------------------------------------
// Section Α — ΟΡΟΙ ΔΟΜΗΣΗΣ
// ---------------------------------------------------------------------------

export const SURVEY_SECTION_A: SurveyCardSection = {
  id: 'a-building-terms',
  titleKey: 'sections.a',
  fields: [
    SECTOR_FIELD,
    PLOT_BOUNDARY_LABELS_FIELD,
    MIN_FRONTAGE_FIELD,
    MIN_AREA_FIELD,
    {
      // Blank in the G753 sample — and that is precisely why it is listed.
      kind: 'text',
      labelKey: 'fields.deviation',
      read: (r) => r.buildingTerms.deviation,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, deviation: v } }),
    },
    {
      // Also blank in the sample.
      kind: 'text',
      labelKey: 'fields.buildingSystem',
      read: (r) => r.buildingTerms.buildingSystem,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, buildingSystem: v } }),
    },
    DECLARED_COVERAGE_PCT_FIELD,
    MAX_COVERAGE_PCT_FIELD,
    DECLARED_MAX_HEIGHT_FIELD,
    {
      // Blank in the sample.
      kind: 'number',
      labelKey: 'fields.declaredFloors',
      read: (r) => r.buildingTerms.declaredFloors,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, declaredFloors: v } }),
    },
    DECLARED_SD_FIELD,
    SOCIAL_FACTOR_SD_FIELD,
    TOTAL_SD_FIELD,
    LAND_USE_FIELD,
    IN_SOCIAL_FACTOR_ZONE_FIELD,
  ],
};

// ---------------------------------------------------------------------------
// Section Β — ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ (+ Πράξη Εφαρμογής)
// ---------------------------------------------------------------------------

export const SURVEY_SECTION_B: SurveyCardSection = {
  id: 'b-settlement',
  titleKey: 'sections.b',
  fields: [
    SETTLEMENT_ACTS_FIELD,
    // Ίδιο αντικείμενο με τον κατάλογο δεσμών — εδώ **αναφορά**, όχι δίδυμο: η προσγείωση
    // του «Π.Ε. 39» από την πινακίδα γράφει από την ίδια ακριβώς `write`.
    IMPLEMENTATION_ACT_NUMBER_FIELD,
    IMPLEMENTATION_ACT_DECISION_FIELD,
    IMPLEMENTATION_ACT_VOLUME_FIELD,
    IMPLEMENTATION_ACT_ENTRY_FIELD,
    IMPLEMENTATION_ACT_DATE_FIELD,
    IMPLEMENTATION_ACT_REGISTRY_FIELD,
    IMPLEMENTATION_ACT_URBAN_UNITS_FIELD,
    IMPLEMENTATION_ACT_ORIGINAL_PROPERTIES_FIELD,
  ],
};

// ---------------------------------------------------------------------------
// Sections Γ–Ζ — short sections, each a field or two on the printed form
// ---------------------------------------------------------------------------

export const SURVEY_SECTION_C: SurveyCardSection = {
  id: 'c-buildability',
  titleKey: 'sections.c',
  fields: [
    {
      kind: 'boolean',
      labelKey: 'fields.isBuildable',
      read: (r) => r.isBuildable,
      write: (r, v) => ({ ...r, isBuildable: v }),
    },
    BUILDABILITY_NOTE_FIELD,
  ],
};

export const SURVEY_SECTION_D: SurveyCardSection = {
  id: 'd-road-plan',
  titleKey: 'sections.d',
  fields: [ROAD_PLAN_DEFINITION_FIELD],
};

export const SURVEY_SECTION_E: SurveyCardSection = {
  id: 'e-suspension',
  titleKey: 'sections.e',
  fields: [
    {
      kind: 'text',
      labelKey: 'fields.suspensionStatus',
      read: (r) => r.suspensionStatus,
      write: (r, v) => ({ ...r, suspensionStatus: v }),
    },
  ],
};

export const SURVEY_SECTION_ST: SurveyCardSection = {
  id: 'st-plot-area',
  titleKey: 'sections.st',
  fields: [PLOT_AREA_FIELD],
};

export const SURVEY_SECTION_Z: SurveyCardSection = {
  id: 'z-height-datum',
  titleKey: 'sections.z',
  fields: [HEIGHT_DATUM_FIELD],
};

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

/**
 * Scalar sections of the card.
 *
 * Sections Α′ (institutional acts), Η (remarks), Θ (approvals) and Ι (title deeds)
 * are **repeating lists**, not scalar fields, so they live in `survey-list-config`.
 *
 * ⚠️ THIS IS NOT THE RENDER ORDER. The printed form interleaves — Α′ sits between Α
 * and Β — so the order the engineer actually sees is `SURVEY_CARD_ORDER` in
 * `survey-card-order.ts`, which is the SSoT for it. This array is the scalar-only
 * view, kept for the field-level anchors. A test asserts every section here appears
 * in that order exactly once, so a new section cannot be added and silently not
 * render.
 */
export const SURVEY_CARD_SECTIONS: readonly SurveyCardSection[] = [
  SURVEY_SECTION_DOC,
  SURVEY_SECTION_A,
  SURVEY_SECTION_B,
  SURVEY_SECTION_C,
  SURVEY_SECTION_D,
  SURVEY_SECTION_E,
  SURVEY_SECTION_ST,
  SURVEY_SECTION_Z,
];

/** Every scalar field of the card, flattened. Used by tests and by the empty-count. */
export function allSurveyCardFields(): readonly FieldAccessor[] {
  return SURVEY_CARD_SECTIONS.flatMap((section) => section.fields);
}
