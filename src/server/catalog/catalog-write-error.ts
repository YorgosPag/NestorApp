/**
 * Το **ένα** σφάλμα των γραφέων του καταλόγου (ADR-923 §5.9) — κλειστό σύνολο ειδών, το καθένα με **ένα**
 * HTTP status. Οι γραφείς ρίχνουν αυτό· ο route το μεταφράζει σε `ApiError` σε **ένα** σημείο
 * (`toCatalogApiError`), ώστε το ίδιο λάθος να μην πάρει ποτέ δύο διαφορετικούς κωδικούς σε δύο routes.
 *
 * Τα ευρήματα επικύρωσης ταξιδεύουν ως **κωδικοί** (`CatalogIssue`), ποτέ κείμενο (N.11): η οθόνη τα
 * μεταφράζει από το `catalog:issues.*` και τα δείχνει δίπλα στο πεδίο που λέει το `path`.
 * @module server/catalog/catalog-write-error
 */

import { ApiError } from '@/lib/api/api-error-types';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
// Ο πίνακας ειδών → status ζει στο κοινό `catalog-write-kinds` (ένας ορισμός για διακομιστή ΚΑΙ πελάτη).
import { CATALOG_WRITE_ERROR_KINDS, type CatalogWriteErrorKind } from '@/subapps/catalog/schema/catalog-write-kinds';

export class CatalogWriteError extends Error {
  constructor(
    readonly kind: CatalogWriteErrorKind,
    readonly issues: readonly CatalogIssue[] = [],
    readonly details: Readonly<Record<string, string | number>> = {},
  ) {
    super(`catalog write rejected: ${kind}`);
    this.name = 'CatalogWriteError';
  }
}

/** Ρίχνει `invalid` αν υπάρχουν ευρήματα — το κοινό τέλος κάθε σημασιολογικής επικύρωσης. */
export function assertNoIssues(issues: readonly CatalogIssue[]): void {
  if (issues.length > 0) throw new CatalogWriteError('invalid', issues);
}

/** Η **μία** μετάφραση σε σφάλμα API: status από τον πίνακα, `errorCode` = είδος, ευρήματα στο σώμα. */
export function toCatalogApiError(error: CatalogWriteError): ApiError {
  return new ApiError(CATALOG_WRITE_ERROR_KINDS[error.kind], error.message, `catalog.${error.kind}`, {
    issues: error.issues,
    ...error.details,
  });
}
