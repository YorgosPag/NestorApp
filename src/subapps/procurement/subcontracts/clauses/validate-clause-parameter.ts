/**
 * @fileoverview **Επικύρωση τιμής παραμέτρου** απέναντι στον ορισμό της (ADR-928 §5.2) — καθαρή, ισομορφική.
 * @module subapps/procurement/subcontracts/clauses/validate-clause-parameter
 *
 * 🔑 Η τιμή είναι διακριτή ένωση στο είδος, αλλά φτάνει από το σύρμα: ο τύπος δεν εγγυάται ότι το ποσοστό είναι
 * ακέραιο 0..10.000 ή ότι η επιλογή υπάρχει. Εδώ κρίνεται **κάθε** είδος με τον **υπάρχοντα** φρουρό του (μονάδες
 * βάσης · λεπτά · ημέρα ISO · μητρώο μονάδων) — κανένας δεύτερος ορισμός «έγκυρου ποσοστού».
 */

import { ISO_WEEKDAYS } from '@/lib/calendar/weekly-hours';
import { isMinorAmount } from '@/lib/money/money';
import { isBasisPoints } from '@/lib/pricing/discount-rule';
import { isUomCode } from '@/lib/uom/uom-registry';
import {
  CLAUSE_PARTIES,
  type ClauseParameterDefinition,
  type ClauseParameterValue,
} from '../types/clause-parameter';
import type { SubcontractIssue, SubcontractIssueCode } from './clause-issues';

/** Όριο σύντομου κειμένου παραμέτρου (όνομα εντολοδόχου κ.λπ.) — δεν είναι χώρος για παράγραφο. */
export const CLAUSE_TEXT_PARAMETER_MAX_LENGTH = 200;

/** Κλειδί ορόσημου: πεζά λατινικά, ψηφία, `_` και `.` (π.χ. `structure.frame_complete`). */
const MILESTONE_KEY = /^[a-z][a-z0-9_.]{0,63}$/;

const isCount = (value: unknown): boolean => Number.isSafeInteger(value) && (value as number) >= 0;
const isPositiveCount = (value: unknown): boolean => Number.isSafeInteger(value) && (value as number) > 0;

function ratioIssue(definition: ClauseParameterDefinition, value: readonly number[]): SubcontractIssueCode | null {
  if (value.length !== (definition.terms?.length ?? 0)) return 'parameterRatioLength';
  return value.every(isPositiveCount) ? null : 'parameterValueInvalid';
}

function textIssue(value: string): SubcontractIssueCode | null {
  if (value.trim().length === 0) return 'parameterValueInvalid';
  return value.length > CLAUSE_TEXT_PARAMETER_MAX_LENGTH ? 'parameterTextTooLong' : null;
}

/** Το εύρημα μιας τιμής **του σωστού είδους** — `null` αν είναι έγκυρη. */
function valueIssue(definition: ClauseParameterDefinition, value: ClauseParameterValue): SubcontractIssueCode | null {
  const invalidUnless = (ok: boolean): SubcontractIssueCode | null => (ok ? null : 'parameterValueInvalid');
  switch (value.kind) {
    case 'percent': return invalidUnless(isBasisPoints(value.value));
    case 'money': return invalidUnless(isMinorAmount(value.value));
    case 'days': return invalidUnless(isCount(value.value));
    case 'ratio': return Array.isArray(value.value) ? ratioIssue(definition, value.value) : 'parameterValueInvalid';
    case 'weekday': return invalidUnless(ISO_WEEKDAYS.includes(value.value));
    case 'milestone': return invalidUnless(typeof value.value === 'string' && MILESTONE_KEY.test(value.value));
    case 'unit': return invalidUnless(typeof value.value === 'string' && isUomCode(value.value));
    case 'enum':
      return (definition.options ?? []).some((option) => option.key === value.value) ? null : 'parameterOptionUnknown';
    case 'party': return invalidUnless(CLAUSE_PARTIES.includes(value.value));
    case 'text': return typeof value.value === 'string' ? textIssue(value.value) : 'parameterValueInvalid';
  }
}

/** Επικυρώνει μια τιμή απέναντι στον ορισμό: ίδιο είδος, και έγκυρη για το είδος της. */
export function validateParameterValue(
  definition: ClauseParameterDefinition,
  value: ClauseParameterValue,
  path: string,
): SubcontractIssue[] {
  if (value.kind !== definition.kind) return [{ code: 'parameterKindMismatch', path }];
  const code = valueIssue(definition, value);
  return code === null ? [] : [{ code, path }];
}

/** Ίδια τιμή; Η αναλογία συγκρίνεται κατά στοιχείο — όλα τα άλλα είδη είναι πρωτογενή. */
export function sameParameterValue(a: ClauseParameterValue, b: ClauseParameterValue): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'ratio' && b.kind === 'ratio') {
    return a.value.length === b.value.length && a.value.every((part, index) => part === b.value[index]);
  }
  return a.value === b.value;
}
