/**
 * Το **ένα** σφάλμα των γραφέων της υπεργολαβίας (ADR-928 Φ1) — κλειστό σύνολο ειδών, το καθένα με **ένα** HTTP status.
 * Οι γραφείς ρίχνουν αυτό· η διαδρομή το μεταφράζει σε `ApiError` σε **ένα** σημείο (`toSubcontractApiError`), όπως το
 * `CatalogWriteError` του ADR-923 §5.9. Τα ευρήματα ταξιδεύουν ως **κωδικοί** (N.11), ποτέ κείμενο.
 * @module server/subcontracts/subcontract-write-error
 */

import { ApiError } from '@/lib/api/api-error-types';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import type { ClauseGovernanceRefusal } from '@/subapps/procurement/subcontracts/clauses/clause-governance';
import type { AgreementLifecycleRefusal } from '@/subapps/procurement/subcontracts/agreements/agreement-lifecycle';
import {
  SUBCONTRACT_ERROR_CODE_PREFIX,
  SUBCONTRACT_WRITE_ERROR_KINDS,
  type SubcontractWriteErrorKind,
} from '@/subapps/procurement/subcontracts/schema/subcontract-write-kinds';
// Ο πίνακας ειδών ζει στο καθαρό `subcontract-write-kinds` (ADR-928 Φ3α-2): τον διαβάζει και η οθόνη.

export class SubcontractWriteError extends Error {
  constructor(
    readonly kind: SubcontractWriteErrorKind,
    readonly issues: readonly SubcontractIssue[] = [],
    readonly details: Readonly<Record<string, string | number>> = {},
  ) {
    super(`subcontract write rejected: ${kind}`);
    this.name = 'SubcontractWriteError';
  }
}

/** Ρίχνει `invalid` αν υπάρχουν ευρήματα — το κοινό τέλος κάθε σημασιολογικής επικύρωσης. */
export function assertNoSubcontractIssues(issues: readonly SubcontractIssue[]): void {
  if (issues.length > 0) throw new SubcontractWriteError('invalid', issues);
}

/** Η άρνηση μιας καθαρής μηχανής (διακυβέρνηση, κύκλος ζωής) γίνεται σφάλμα γραφέα — `null` ⇒ καμία άρνηση. */
export function assertGovernance(refusal: ClauseGovernanceRefusal | AgreementLifecycleRefusal | null): void {
  if (refusal !== null) throw new SubcontractWriteError(refusal);
}

/** Η **μία** μετάφραση σε σφάλμα API: status από τον πίνακα, `errorCode` = είδος, ευρήματα στο σώμα. */
export function toSubcontractApiError(error: SubcontractWriteError): ApiError {
  return new ApiError(SUBCONTRACT_WRITE_ERROR_KINDS[error.kind], error.message, `${SUBCONTRACT_ERROR_CODE_PREFIX}${error.kind}`, {
    issues: error.issues,
    ...error.details,
  });
}
