/**
 * @fileoverview Το **κλειστό λεξιλόγιο ευρημάτων** επικύρωσης της υπεργολαβίας (ADR-928 Φ1).
 * @module subapps/procurement/subcontracts/clauses/clause-issues
 *
 * Τα ευρήματα ταξιδεύουν ως **κωδικοί + διαδρομή**, ποτέ κείμενο (N.11) — όπως το `CatalogIssue` του ADR-923: η οθόνη
 * (Φ3) τα μεταφράζει και τα δείχνει δίπλα στο πεδίο που λέει το `path`. Ένας κωδικός = μία αιτία.
 */

export const SUBCONTRACT_ISSUE_CODES = [
  // ── Παράμετροι ─────────────────────────────────────────────────────────────
  'parameterKeyInvalid',
  'parameterKeyDuplicate',
  'parameterKindMismatch',
  'parameterValueInvalid',
  'parameterOptionsMissing',
  'parameterOptionDuplicate',
  'parameterOptionUnknown',
  'parameterTermsMissing',
  'parameterRatioLength',
  'parameterTextTooLong',
  'parameterLabelRequired',
  'toleranceKindMismatch',
  'toleranceRangeInvalid',
  'tolerancePreferredOutsideAcceptable',
  'toleranceAcceptableOutsideWalkAway',
  'toleranceOptionUnknown',
  'bindingKindMismatch',
  'bindingTermMissing',
  // ── Σώμα ρήτρας ────────────────────────────────────────────────────────────
  'clauseKeyInvalid',
  'clauseKeyTaken',
  'clauseTitleRequired',
  'headingRequired',
  'bodyEmpty',
  'blockEmpty',
  'inlineTextEmpty',
  'paramReferenceUnknown',
  'parameterUnreferenced',
  'translationParamsMismatch',
  'translationLanguageInvalid',
  // ── Μερίδια ────────────────────────────────────────────────────────────────
  'sharesEmpty',
  'shareInvalid',
  'sharesNotWhole',
  'shareKeyDuplicate',
  // ── Πρότυπο ειδικότητας ────────────────────────────────────────────────────
  'templateCodeInvalid',
  'templateCodeTaken',
  'tradeUnknown',
  'lineIdDuplicate',
  'lineDescriptionRequired',
  'unitUnknown',
  'amountInvalid',
  'quantityInvalid',
  'clauseRefDuplicate',
  'clauseRefUnknown',
  'clauseRefNotApproved',
  'overrideUnknownParameter',
  'overrideOnBoundParameter',
  'overrideNeedsApproval',
  'overrideForbidden',
  'termOutsideTolerance',
  'vatRateInvalid',
  'scheduleInvalid',
  // ── Συμφωνητικό (Φ2) ───────────────────────────────────────────────────────
  'clauseVersionOutdated',
  'deviationForbidden',
  'deviationReasonRequired',
  'translationMissing',
  'issuerProfileMissing',
  'contactUnknown',
  'projectUnknown',
  'buildingNotInProject',
  'scopeMismatch',
  'notEditable',
  'validUntilPast',
] as const;

export type SubcontractIssueCode = (typeof SUBCONTRACT_ISSUE_CODES)[number];

/** Ένα εύρημα: τι, και πού (διαδρομή με τελείες, π.χ. `parameters.2.tolerance.acceptable`). */
export interface SubcontractIssue {
  readonly code: SubcontractIssueCode;
  readonly path: string;
}

/** Η **μία** σύνθεση διαδρομής — `joinPath('lines', 3, 'stages')` ⇒ `lines.3.stages`. */
export function joinPath(...segments: readonly (string | number)[]): string {
  return segments.filter((segment) => segment !== '').join('.');
}
