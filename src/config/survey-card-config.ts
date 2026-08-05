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

/** One titled group of fields in the card. */
export interface SurveyCardSection {
  /** Stable id — used for anchors and test selectors, never shown. */
  readonly id: string;
  /** i18n key under `sections.*`. */
  readonly titleKey: string;
  readonly fields: readonly FieldAccessor[];
}

// ---------------------------------------------------------------------------
// Section Α — ΟΡΟΙ ΔΟΜΗΣΗΣ
// ---------------------------------------------------------------------------

export const SURVEY_SECTION_A: SurveyCardSection = {
  id: 'a-building-terms',
  titleKey: 'sections.a',
  fields: [
    {
      kind: 'text',
      labelKey: 'fields.sector',
      read: (r) => r.buildingTerms.sector,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, sector: v } }),
    },
    {
      kind: 'textList',
      labelKey: 'fields.plotBoundaryLabels',
      hintKey: 'fields.plotBoundaryLabelsHint',
      read: (r) => r.buildingTerms.plotBoundaryLabels,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, plotBoundaryLabels: v } }),
    },
    {
      kind: 'number',
      labelKey: 'fields.minFrontage',
      read: (r) => r.buildingTerms.minFrontage,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, minFrontage: v } }),
    },
    {
      kind: 'number',
      labelKey: 'fields.minArea',
      read: (r) => r.buildingTerms.minArea,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, minArea: v } }),
    },
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
    {
      kind: 'number',
      labelKey: 'fields.declaredCoveragePct',
      read: (r) => r.buildingTerms.declaredCoveragePct,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, declaredCoveragePct: v } }),
    },
    {
      kind: 'number',
      labelKey: 'fields.maxCoveragePct',
      hintKey: 'fields.maxCoverageHint',
      read: (r) => r.buildingTerms.maxCoveragePct,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, maxCoveragePct: v } }),
    },
    {
      // Text, not number: the drawing says «κατά ΝΟΚ» as often as a figure.
      kind: 'text',
      labelKey: 'fields.declaredMaxHeight',
      hintKey: 'fields.declaredMaxHeightHint',
      read: (r) => r.buildingTerms.declaredMaxHeight,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, declaredMaxHeight: v } }),
    },
    {
      // Blank in the sample.
      kind: 'number',
      labelKey: 'fields.declaredFloors',
      read: (r) => r.buildingTerms.declaredFloors,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, declaredFloors: v } }),
    },
    // 🔴 Three ΣΔ fields, not one. ADR-759 §4.2 rule 2: `1,3` alone keeps the
    // result and destroys the reason, and the reason (the social factor) is what
    // the engineer needs to see separately.
    {
      kind: 'number',
      labelKey: 'fields.declaredSd',
      hintKey: 'fields.sdHint',
      read: (r) => r.buildingTerms.declaredSd,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, declaredSd: v } }),
    },
    {
      kind: 'number',
      labelKey: 'fields.socialFactorSd',
      read: (r) => r.buildingTerms.socialFactorSd,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, socialFactorSd: v } }),
    },
    {
      kind: 'number',
      labelKey: 'fields.totalSd',
      read: (r) => r.buildingTerms.totalSd,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, totalSd: v } }),
    },
    {
      kind: 'text',
      labelKey: 'fields.landUse',
      read: (r) => r.buildingTerms.landUse,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, landUse: v } }),
    },
    {
      kind: 'boolean',
      labelKey: 'fields.inSocialFactorZone',
      read: (r) => r.buildingTerms.inSocialFactorZone,
      write: (r, v) => ({ ...r, buildingTerms: { ...r.buildingTerms, inSocialFactorZone: v } }),
    },
  ],
};

// ---------------------------------------------------------------------------
// Section Β — ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ (+ Πράξη Εφαρμογής)
// ---------------------------------------------------------------------------

export const SURVEY_SECTION_B: SurveyCardSection = {
  id: 'b-settlement',
  titleKey: 'sections.b',
  fields: [
    {
      kind: 'text',
      multiline: true,
      labelKey: 'fields.settlementActs',
      read: (r) => r.settlement.settlementActs,
      write: (r, v) => ({ ...r, settlement: { ...r.settlement, settlementActs: v } }),
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
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
    },
    {
      // Genuinely plural in G753: "Πολεοδομικών Ενοτήτων 16 και 17".
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
    },
    {
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
    },
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
    {
      kind: 'text',
      multiline: true,
      labelKey: 'fields.buildabilityNote',
      read: (r) => r.buildabilityNote,
      write: (r, v) => ({ ...r, buildabilityNote: v }),
    },
  ],
};

export const SURVEY_SECTION_D: SurveyCardSection = {
  id: 'd-road-plan',
  titleKey: 'sections.d',
  fields: [
    {
      kind: 'text',
      multiline: true,
      labelKey: 'fields.roadPlanDefinition',
      read: (r) => r.roadPlanDefinition,
      write: (r, v) => ({ ...r, roadPlanDefinition: v }),
    },
  ],
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
  fields: [
    {
      // 🔴 ADR-759 §2β.5: this number comes from the survey text, never from the
      // `Pinakas-Syntetagmenon` table — that table describes a different parcel
      // (4092,13 m² in another coordinate system) and would be wrong by 3×.
      kind: 'number',
      labelKey: 'fields.plotArea',
      read: (r) => r.plotArea,
      write: (r, v) => ({ ...r, plotArea: v }),
    },
  ],
};

export const SURVEY_SECTION_Z: SurveyCardSection = {
  id: 'z-height-datum',
  titleKey: 'sections.z',
  fields: [
    {
      kind: 'text',
      labelKey: 'fields.heightDatum',
      read: (r) => r.heightDatum,
      write: (r, v) => ({ ...r, heightDatum: v }),
    },
  ],
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
