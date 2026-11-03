/**
 * Το **ένα** σφάλμα των γραφέων της υπεργολαβίας (ADR-928 Φ1) — κλειστό σύνολο ειδών, το καθένα με **ένα** HTTP status.
 * Οι γραφείς ρίχνουν αυτό· η διαδρομή το μεταφράζει σε `ApiError` σε **ένα** σημείο (`toSubcontractApiError`), όπως το
 * `CatalogWriteError` του ADR-923 §5.9. Τα ευρήματα ταξιδεύουν ως **κωδικοί** (N.11), ποτέ κείμενο.
 * @module server/subcontracts/subcontract-write-error
 */

import { ApiError } from '@/lib/api/api-error-types';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import type { ClauseGovernanceRefusal } from '@/subapps/procurement/subcontracts/clauses/clause-governance';

export const SUBCONTRACT_WRITE_ERROR_KINDS = {
  invalid: 422,
  notFound: 404,
  duplicate: 409,
  revisionMismatch: 409,
  proposalPending: 409,
  invalidTransition: 409,
  translationStale: 409,
  selfApproval: 403,
  notProposer: 403,
} as const satisfies Readonly<Record<string, number>>;
// Κάθε άρνηση της διακυβέρνησης είναι είδος σφάλματος: το `assertGovernance` δεν μεταγλωττίζεται αλλιώς.

export type SubcontractWriteErrorKind = keyof typeof SUBCONTRACT_WRITE_ERROR_KINDS;

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

/** Η άρνηση της διακυβέρνησης (καθαρή μηχανή) γίνεται σφάλμα γραφέα — `null` ⇒ καμία άρνηση. */
export function assertGovernance(refusal: ClauseGovernanceRefusal | null): void {
  if (refusal !== null) throw new SubcontractWriteError(refusal);
}

/** Η **μία** μετάφραση σε σφάλμα API: status από τον πίνακα, `errorCode` = είδος, ευρήματα στο σώμα. */
export function toSubcontractApiError(error: SubcontractWriteError): ApiError {
  return new ApiError(SUBCONTRACT_WRITE_ERROR_KINDS[error.kind], error.message, `subcontracts.${error.kind}`, {
    issues: error.issues,
    ...error.details,
  });
}
