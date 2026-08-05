/**
 * @related ADR-759 §4.1 + Q5 — comparing a survey against the project's Building Terms
 *
 * This module answers one question per field: **what should the engineer see, and
 * what may they do about it?** It is pure — no React, no Firestore — because the
 * answer is the entire design and deserves to be testable on its own.
 *
 * The three-action model (adopt / accept-the-difference / nothing yet) is Revit's
 * Coordination Review, generalised from geometry to numbers. ADR-759 §4.1 originally
 * specified only "Adopt →"; the missing third action is what stops a difference the
 * engineer already judged from reappearing as unresolved on every visit — and a card
 * that cries wolf trains people to stop reading it (ADR-759 §5.8).
 */
import type { ProjectBuildingCodePhase2 } from '@/types/project-building-code';
import { parseStrictDecimal } from '@/lib/survey-record/survey-number';
import {
  isReconciliationCurrent,
  type FieldReconciliation,
  type ReconcilableField,
  type SurveyRecord,
} from '@/types/project-survey-record';

/**
 * What the UI must render for one comparable field.
 *
 * Every state is explicit. There is deliberately no "other" bucket: ADR-759 §2.2 is
 * a case study in three distinct causes hiding behind two generic messages, and the
 * engineer being unable to tell "missing capability" from "missing wiring".
 */
export type ReconciliationState =
  /** The survey says nothing about this field. Nothing to decide. */
  | 'no-survey-value'
  /** The survey says something that is not a number (e.g. «κατά ΝΟΚ»). Show it, offer no adopt. */
  | 'not-comparable'
  /** Both sides agree. Nothing to decide. */
  | 'identical'
  /** They differ and nobody has judged it yet. */
  | 'undecided'
  /** The survey value was adopted, and it is still the value that was adopted. */
  | 'adopted'
  /** The difference was reviewed and accepted. */
  | 'kept-ours'
  /** A decision exists, but the survey value has changed since — judge it again. */
  | 'reopened';

export interface FieldComparison {
  readonly field: ReconcilableField;
  readonly state: ReconciliationState;
  /** Numeric survey value, when there is one that can be compared. */
  readonly surveyValue: number | null;
  /** The survey's own wording — always shown, even when not comparable. */
  readonly surveyText: string | null;
  /** Current project value. */
  readonly projectValue: number;
  /** The decision on record, if any. */
  readonly decision: FieldReconciliation | null;
}

/** Can the engineer act on this comparison at all? */
export function isActionable(state: ReconciliationState): boolean {
  return state === 'undecided' || state === 'reopened';
}

/**
 * The survey value that corresponds to a Building Terms field.
 *
 * 🔑 `sd` maps to `totalSd`, not `declaredSd`: the total (`0,8 + 0,5 = 1,3`) is what
 * actually applies, which is the question `buildingCode.sd` asks. Coverage follows
 * the same logic — the raised maximum when the plot has one, otherwise the plain
 * declared figure. Keeping all three ΣΔ numbers in the record and comparing only the
 * effective one is the point of §4.2 rule 2: the components explain the total.
 */
function surveyValueFor(record: SurveyRecord, field: ReconcilableField): number | null {
  const terms = record.buildingTerms;
  switch (field) {
    case 'sd':
      return terms.totalSd.value ?? terms.declaredSd.value;
    case 'coveragePct':
      return terms.maxCoveragePct.value ?? terms.declaredCoveragePct.value;
    case 'maxHeight':
      // Declared as free text in the real form — numeric only sometimes.
      return parseNumericHeight(terms.declaredMaxHeight.value);
    default: {
      const never: never = field;
      throw new Error(`surveyValueFor: unhandled field ${String(never)}`);
    }
  }
}

/** The survey's own wording for a field — shown verbatim regardless of comparability. */
function surveyTextFor(record: SurveyRecord, field: ReconcilableField): string | null {
  const terms = record.buildingTerms;
  switch (field) {
    case 'sd': {
      const total = terms.totalSd.value ?? terms.declaredSd.value;
      return total === null ? null : String(total);
    }
    case 'coveragePct': {
      const pct = terms.maxCoveragePct.value ?? terms.declaredCoveragePct.value;
      return pct === null ? null : String(pct);
    }
    case 'maxHeight':
      return terms.declaredMaxHeight.value;
    default: {
      const never: never = field;
      throw new Error(`surveyTextFor: unhandled field ${String(never)}`);
    }
  }
}

/**
 * Read a height that may be prose.
 *
 * Returns `null` for anything that is not cleanly a number — «κατά ΝΟΚ» must NOT
 * become `0`, and a value like `"11 μ."` must not silently become `11` on the
 * strength of a prefix match. Only a value that is entirely numeric is comparable;
 * everything else is shown as text with no adopt button. This is the same refusal as
 * ADR-759 §2β.5: a plausible-looking number in the wrong place is worse than none.
 */
function parseNumericHeight(text: string | null): number | null {
  return parseStrictDecimal(text);
}

function projectValueFor(code: ProjectBuildingCodePhase2, field: ReconcilableField): number {
  switch (field) {
    case 'sd':
      return code.sd;
    case 'coveragePct':
      return code.coveragePct;
    case 'maxHeight':
      return code.maxHeight;
    default: {
      const never: never = field;
      throw new Error(`projectValueFor: unhandled field ${String(never)}`);
    }
  }
}

function resolveState(
  surveyValue: number | null,
  surveyText: string | null,
  projectValue: number,
  decision: FieldReconciliation | null,
  isCurrent: boolean
): ReconciliationState {
  if (surveyValue === null) {
    return surveyText === null ? 'no-survey-value' : 'not-comparable';
  }
  if (surveyValue === projectValue) return 'identical';
  if (decision === null) return 'undecided';
  // A decision that no longer matches the value it was made about is not a decision.
  if (!isCurrent) return 'reopened';
  return decision.action === 'adopted' ? 'adopted' : 'kept-ours';
}

/** Build the comparison for one field. */
export function compareField(
  record: SurveyRecord,
  code: ProjectBuildingCodePhase2,
  field: ReconcilableField
): FieldComparison {
  const surveyValue = surveyValueFor(record, field);
  const surveyText = surveyTextFor(record, field);
  const projectValue = projectValueFor(code, field);
  const decision = record.reconciliations.find((r) => r.field === field) ?? null;
  const isCurrent = isReconciliationCurrent(record.reconciliations, field, surveyValue);

  return {
    field,
    state: resolveState(surveyValue, surveyText, projectValue, decision, isCurrent),
    surveyValue,
    surveyText,
    projectValue,
    decision,
  };
}

/** Every comparable field, in the order the Building Terms form lists them. */
export const RECONCILABLE_FIELDS: readonly ReconcilableField[] = [
  'sd',
  'coveragePct',
  'maxHeight',
];

/** The full comparison table for the card. */
export function compareSurveyToBuildingCode(
  record: SurveyRecord,
  code: ProjectBuildingCodePhase2
): readonly FieldComparison[] {
  return RECONCILABLE_FIELDS.map((field) => compareField(record, code, field));
}

/**
 * Record a decision, replacing any previous one for the same field.
 *
 * Pure: returns the new ledger, never mutates. The caller persists it.
 */
export function recordDecision(
  reconciliations: readonly FieldReconciliation[],
  decision: FieldReconciliation
): readonly FieldReconciliation[] {
  return [...reconciliations.filter((r) => r.field !== decision.field), decision];
}

/** How many fields still need the engineer's judgement — the card's badge count. */
export function countActionable(comparisons: readonly FieldComparison[]): number {
  return comparisons.filter((c) => isActionable(c.state)).length;
}
