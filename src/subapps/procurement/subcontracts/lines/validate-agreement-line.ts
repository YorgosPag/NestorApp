/**
 * @fileoverview **Επικύρωση γραμμών (schedule of values)** — κοινή για πρότυπο ειδικότητας και συμφωνητικό (ADR-928 §5.3 · §5.4).
 * @module subapps/procurement/subcontracts/lines/validate-agreement-line
 *
 * Ποσά σε λεπτά, ποσότητες σε χιλιοστά της μονάδας ⇒ **ακέραιοι** παντού. Τα στάδια αθροίζουν ακριβώς 10.000 (ο ΕΝΑΣ
 * έλεγχος `validateShares`). Ο κανόνας επιμέτρησης είναι κείμενο της εταιρείας σε μπλοκ, **χωρίς** παραμέτρους.
 */

import { isMinorAmount } from '@/lib/money/money';
import { isUomCode } from '@/lib/uom/uom-registry';
import { joinPath, type SubcontractIssue } from '../clauses/clause-issues';
import { validateClauseBlocks } from '../clauses/validate-clause-body';
import { hasAuthoritativeText } from '../clauses/validate-parameter-definition';
import { validateShares } from '../shares/validate-shares';
import {
  AGREEMENT_LINE_KINDS,
  AGREEMENT_LINE_PRICINGS,
  type AgreementLine,
} from '../types/agreement-line';
import { PAYMENT_BASES } from '../types/payment-plan';
import { validateRetention } from '../terms/validate-payment-plan';

const NO_PARAMETERS: ReadonlySet<string> = new Set();
const isNonNegativeInt = (value: unknown): boolean => Number.isSafeInteger(value) && (value as number) >= 0;
const isPositiveInt = (value: unknown): boolean => Number.isSafeInteger(value) && (value as number) > 0;

function priceIssues(line: AgreementLine, path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (!isUomCode(line.unit)) issues.push({ code: 'unitUnknown', path: joinPath(path, 'unit') });
  if (!isMinorAmount(line.unitPrice)) issues.push({ code: 'amountInvalid', path: joinPath(path, 'unitPrice') });
  if (line.clientUnitPrice !== null && !isMinorAmount(line.clientUnitPrice)) {
    issues.push({ code: 'amountInvalid', path: joinPath(path, 'clientUnitPrice') });
  }
  if (line.estimatedMilliQuantity !== null && !isNonNegativeInt(line.estimatedMilliQuantity)) {
    issues.push({ code: 'quantityInvalid', path: joinPath(path, 'estimatedMilliQuantity') });
  }
  return issues;
}

function shapeIssues(line: AgreementLine, path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (!AGREEMENT_LINE_KINDS.includes(line.kind)) issues.push({ code: 'parameterValueInvalid', path: joinPath(path, 'kind') });
  if (!AGREEMENT_LINE_PRICINGS.includes(line.pricing)) issues.push({ code: 'parameterValueInvalid', path: joinPath(path, 'pricing') });
  if (!hasAuthoritativeText(line.description)) issues.push({ code: 'lineDescriptionRequired', path: joinPath(path, 'description') });
  line.stages.forEach((stage, index) => {
    if (!hasAuthoritativeText(stage.label)) issues.push({ code: 'parameterLabelRequired', path: joinPath(path, 'stages', index, 'label') });
  });
  return issues;
}

function attachmentIssues(line: AgreementLine, path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (line.measurementRule) {
    issues.push(...validateClauseBlocks(line.measurementRule.blocks, NO_PARAMETERS, joinPath(path, 'measurementRule', 'blocks')));
  }
  const cap = line.insuredDaysCap;
  if (cap && !isUomCode(cap.unit)) issues.push({ code: 'unitUnknown', path: joinPath(path, 'insuredDaysCap', 'unit') });
  if (cap && !isPositiveInt(cap.milliUnitsPerInsuredDay)) {
    issues.push({ code: 'quantityInvalid', path: joinPath(path, 'insuredDaysCap', 'milliUnitsPerInsuredDay') });
  }
  const override = line.paymentOverride;
  if (override?.basis !== undefined && !PAYMENT_BASES.includes(override.basis)) {
    issues.push({ code: 'scheduleInvalid', path: joinPath(path, 'paymentOverride', 'basis') });
  }
  if (override?.retention) issues.push(...validateRetention(override.retention, joinPath(path, 'paymentOverride', 'retention')));
  return issues;
}

export function validateAgreementLine(line: AgreementLine, path: string): SubcontractIssue[] {
  return [
    ...shapeIssues(line, path),
    ...priceIssues(line, path),
    ...validateShares(line.stages.map((stage) => stage.share), joinPath(path, 'stages'), {
      allowEmpty: true,
      identityOf: (index) => line.stages[index].key,
    }),
    ...attachmentIssues(line, path),
  ];
}

/** Όλες οι γραμμές: η καθεμία, και μοναδικό `id` μέσα στο έγγραφο (οι αναθεωρήσεις/πιστοποιήσεις δένουν σε αυτό). */
export function validateAgreementLines(lines: readonly AgreementLine[], path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    const at = joinPath(path, index);
    if (line.id.trim().length === 0 || seen.has(line.id)) issues.push({ code: 'lineIdDuplicate', path: joinPath(at, 'id') });
    seen.add(line.id);
    issues.push(...validateAgreementLine(line, at));
  });
  return issues;
}
