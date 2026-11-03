/**
 * @fileoverview **Επικύρωση δομημένων εμπορικών όρων** (ADR-928 §5.4) — ΦΠΑ από τον ΕΝΑ πίνακα, ποσά/ποσοστά ακέραια,
 * επιμερισμός = 100%, συνεργείο, απαιτούμενα έγγραφα. Κοινή για πρότυπο (`defaultTerms`) και συμφωνητικό (Φ2).
 * @module subapps/procurement/subcontracts/terms/validate-commercial-terms
 */

import { isMinorAmount } from '@/lib/money/money';
import { isBasisPoints } from '@/lib/pricing/discount-rule';
import { isGreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import { joinPath, type SubcontractIssue } from '../clauses/clause-issues';
import { hasAuthoritativeText } from '../clauses/validate-parameter-definition';
import { validateShares } from '../shares/validate-shares';
import { REQUIRED_DOCUMENT_KINDS, type CommercialTerms } from '../types/commercial-terms';
import { validatePaymentPlan } from './validate-payment-plan';

const isNonNegativeInt = (value: unknown): boolean => Number.isSafeInteger(value) && (value as number) >= 0;
const isPositiveInt = (value: unknown): boolean => Number.isSafeInteger(value) && (value as number) > 0;

function fiscalIssues(terms: CommercialTerms, path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (!isGreekVatRatePercent(terms.vat.rate)) issues.push({ code: 'vatRateInvalid', path: joinPath(path, 'vat', 'rate') });
  if (!isBasisPoints(terms.withholding.rate)) issues.push({ code: 'shareInvalid', path: joinPath(path, 'withholding', 'rate') });
  if (!isMinorAmount(terms.cashLimitPerPayment)) issues.push({ code: 'amountInvalid', path: joinPath(path, 'cashLimitPerPayment') });
  const penalty = terms.penalty;
  if (penalty && (!isMinorAmount(penalty.perDay) || !isBasisPoints(penalty.capOfContractValue))) {
    issues.push({ code: 'amountInvalid', path: joinPath(path, 'penalty') });
  }
  return issues;
}

function crewIssues(terms: CommercialTerms, path: string): SubcontractIssue[] {
  const crew = terms.crew;
  if (!crew) return [];
  const issues: SubcontractIssue[] = [];
  if (!isNonNegativeInt(crew.minimumHeadcount)) issues.push({ code: 'quantityInvalid', path: joinPath(path, 'crew', 'minimumHeadcount') });
  crew.members.forEach((member, index) => {
    const at = joinPath(path, 'crew', 'members', index);
    if (!hasAuthoritativeText(member.role)) issues.push({ code: 'parameterLabelRequired', path: joinPath(at, 'role') });
    if (!isPositiveInt(member.ratioParts)) issues.push({ code: 'quantityInvalid', path: joinPath(at, 'ratioParts') });
    if (member.dailyWage !== null && !isMinorAmount(member.dailyWage)) issues.push({ code: 'amountInvalid', path: joinPath(at, 'dailyWage') });
  });
  return issues;
}

function costSharingIssues(terms: CommercialTerms, path: string): SubcontractIssue[] {
  return terms.costSharing.flatMap((item, index) => {
    const at = joinPath(path, 'costSharing', index);
    const description: SubcontractIssue[] = hasAuthoritativeText(item.description)
      ? []
      : [{ code: 'lineDescriptionRequired', path: joinPath(at, 'description') }];
    return [...description, ...validateShares(item.shares.map((share) => share.share), joinPath(at, 'shares'), {
      allowEmpty: false,
      identityOf: (shareIndex) => item.shares[shareIndex].party,
    })];
  });
}

function documentAndOutputIssues(terms: CommercialTerms, path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  terms.requiredDocuments.forEach((document, index) => {
    const whenOk = document.when.kind === 'before_each_payment' || isNonNegativeInt(document.when.days);
    if (!REQUIRED_DOCUMENT_KINDS.includes(document.kind) || !whenOk) {
      issues.push({ code: 'parameterValueInvalid', path: joinPath(path, 'requiredDocuments', index) });
    }
  });
  terms.minimumOutputs.forEach((output, index) => {
    if (!isPositiveInt(output.milliUnitsPerDay)) issues.push({ code: 'quantityInvalid', path: joinPath(path, 'minimumOutputs', index) });
  });
  return issues;
}

/**
 * Οι εμπορικοί όροι ολόκληροι. `lineIds`: οι γραμμές του εγγράφου — η ελάχιστη απόδοση πρέπει να δείχνει σε μία.
 */
export function validateCommercialTerms(terms: CommercialTerms, path: string, lineIds: ReadonlySet<string>): SubcontractIssue[] {
  const orphanOutputs: SubcontractIssue[] = terms.minimumOutputs.flatMap((output, index) =>
    lineIds.has(output.lineId) ? [] : [{ code: 'parameterValueInvalid' as const, path: joinPath(path, 'minimumOutputs', index, 'lineId') }],
  );
  return [
    ...fiscalIssues(terms, path),
    ...validatePaymentPlan(terms.paymentPlan, joinPath(path, 'paymentPlan')),
    ...crewIssues(terms, path),
    ...costSharingIssues(terms, path),
    ...documentAndOutputIssues(terms, path),
    ...orphanOutputs,
  ];
}
