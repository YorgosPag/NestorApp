/**
 * @fileoverview **Επικύρωση ορισμών παραμέτρων** μιας έκδοσης ρήτρας (ADR-928 §5.2 · §5.2.1) — καθαρή.
 * @module subapps/procurement/subcontracts/clauses/validate-parameter-definition
 *
 * Κρίνει ό,τι ο τύπος δεν μπορεί: μοναδικά κλειδιά, επιλογές/μέλη όπου χρειάζονται, **συνέπεια ζωνών** (προτιμώμενη ⊆
 * αποδεκτή ⊆ επιτρεπτή), ζώνη του σωστού είδους, και δέσιμο σε εμπορικό όρο με το είδος που ο όρος έχει.
 */

import { CLAUSE_AUTHORITATIVE_LANGUAGE } from '../types/clause';
import type {
  ClauseParameterDefinition,
  LocalizedText,
  NumericRange,
  NumericTolerance,
  OptionTolerance,
} from '../types/clause-parameter';
import { joinPath, type SubcontractIssue } from './clause-issues';
import { COMMERCIAL_TERM_BINDINGS } from './commercial-term-bindings';
import { inNumericRange, numericValueOf } from './tolerance-verdict';
import { validateParameterValue } from './validate-clause-parameter';

/** Κλειδί παραμέτρου/επιλογής/μέλους: πεζά λατινικά, ψηφία, `_`. */
export const CLAUSE_PARAMETER_KEY = /^[a-z][a-z0-9_]{0,47}$/;

const NUMERIC_KINDS = new Set(['percent', 'money', 'days']);

export function hasAuthoritativeText(text: LocalizedText | undefined): boolean {
  return (text?.[CLAUSE_AUTHORITATIVE_LANGUAGE] ?? '').trim().length > 0;
}

/** Κλειδιά με ετικέτα: έγκυρα, μοναδικά, με ελληνική ετικέτα. Κοινό για επιλογές `enum` και μέλη `ratio`. */
function keyedLabelIssues(
  items: readonly { readonly key: string; readonly label: LocalizedText }[] | undefined,
  path: string,
  missing: SubcontractIssue['code'],
): SubcontractIssue[] {
  if (!items || items.length === 0) return [{ code: missing, path }];
  const issues: SubcontractIssue[] = [];
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (!CLAUSE_PARAMETER_KEY.test(item.key)) issues.push({ code: 'parameterKeyInvalid', path: joinPath(path, index, 'key') });
    if (seen.has(item.key)) issues.push({ code: 'parameterOptionDuplicate', path: joinPath(path, index, 'key') });
    if (!hasAuthoritativeText(item.label)) issues.push({ code: 'parameterLabelRequired', path: joinPath(path, index, 'label') });
    seen.add(item.key);
  });
  return issues;
}

function isOrderedRange(range: NumericRange): boolean {
  return range.min === null || range.max === null || range.min <= range.max;
}

const rangeWithin = (inner: NumericRange, outer: NumericRange): boolean =>
  (outer.min === null || (inner.min !== null && inner.min >= outer.min))
  && (outer.max === null || (inner.max !== null && inner.max <= outer.max));

function numericToleranceIssues(definition: ClauseParameterDefinition, tolerance: NumericTolerance, path: string): SubcontractIssue[] {
  if (!isOrderedRange(tolerance.acceptable) || !isOrderedRange(tolerance.walkAway)) {
    return [{ code: 'toleranceRangeInvalid', path }];
  }
  const issues: SubcontractIssue[] = [];
  if (!rangeWithin(tolerance.acceptable, tolerance.walkAway)) issues.push({ code: 'toleranceAcceptableOutsideWalkAway', path });
  const preferred = numericValueOf(definition.preferred);
  if (preferred !== null && !inNumericRange(tolerance.acceptable, preferred)) {
    issues.push({ code: 'tolerancePreferredOutsideAcceptable', path });
  }
  return issues;
}

function optionToleranceIssues(definition: ClauseParameterDefinition, tolerance: OptionTolerance, path: string): SubcontractIssue[] {
  const known = new Set((definition.options ?? []).map((option) => option.key));
  const listed = [...tolerance.acceptable, ...tolerance.forbidden];
  const issues: SubcontractIssue[] = [];
  const overlaps = tolerance.acceptable.some((key) => tolerance.forbidden.includes(key));
  if (listed.some((key) => !known.has(key)) || overlaps) issues.push({ code: 'toleranceOptionUnknown', path });
  const preferred = definition.preferred.kind === 'enum' ? definition.preferred.value : null;
  if (preferred === null || !tolerance.acceptable.includes(preferred)) {
    issues.push({ code: 'tolerancePreferredOutsideAcceptable', path });
  }
  return issues;
}

function toleranceIssues(definition: ClauseParameterDefinition, path: string): SubcontractIssue[] {
  const tolerance = definition.tolerance;
  if (tolerance === null || tolerance.kind === 'fixed') return [];
  const fits = tolerance.kind === 'numeric' ? NUMERIC_KINDS.has(definition.kind) : definition.kind === 'enum';
  if (!fits) return [{ code: 'toleranceKindMismatch', path }];
  return tolerance.kind === 'numeric'
    ? numericToleranceIssues(definition, tolerance, path)
    : optionToleranceIssues(definition, tolerance, path);
}

function bindingIssues(definition: ClauseParameterDefinition, path: string): SubcontractIssue[] {
  if (definition.source.kind !== 'term') return [];
  const spec = COMMERCIAL_TERM_BINDINGS[definition.source.term];
  if (!spec) return [{ code: 'bindingTermMissing', path }];
  if (spec.kind !== definition.kind) return [{ code: 'bindingKindMismatch', path }];
  const required = spec.optionKeys;
  if (!required) return [];
  const defined = (definition.options ?? []).map((option) => option.key);
  const same = defined.length === required.length && required.every((key) => defined.includes(key));
  return same ? [] : [{ code: 'bindingKindMismatch', path }];
}

function definitionIssues(definition: ClauseParameterDefinition, path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (!CLAUSE_PARAMETER_KEY.test(definition.key)) issues.push({ code: 'parameterKeyInvalid', path: joinPath(path, 'key') });
  if (!hasAuthoritativeText(definition.label)) issues.push({ code: 'parameterLabelRequired', path: joinPath(path, 'label') });
  if (definition.kind === 'enum') issues.push(...keyedLabelIssues(definition.options, joinPath(path, 'options'), 'parameterOptionsMissing'));
  if (definition.kind === 'ratio') issues.push(...keyedLabelIssues(definition.terms, joinPath(path, 'terms'), 'parameterTermsMissing'));
  issues.push(...validateParameterValue(definition, definition.preferred, joinPath(path, 'preferred')));
  issues.push(...toleranceIssues(definition, joinPath(path, 'tolerance')));
  issues.push(...bindingIssues(definition, joinPath(path, 'source')));
  return issues;
}

/** Επικυρώνει όλους τους ορισμούς μιας έκδοσης: τον καθένα, και τη μοναδικότητα των κλειδιών τους. */
export function validateParameterDefinitions(definitions: readonly ClauseParameterDefinition[], path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  const seen = new Set<string>();
  definitions.forEach((definition, index) => {
    const at = joinPath(path, index);
    if (seen.has(definition.key)) issues.push({ code: 'parameterKeyDuplicate', path: joinPath(at, 'key') });
    seen.add(definition.key);
    issues.push(...definitionIssues(definition, at));
  });
  return issues;
}
