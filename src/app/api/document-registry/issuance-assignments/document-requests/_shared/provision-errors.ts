/**
 * @fileoverview ADR-942 Φ2 — η ΜΙΑ μετάφραση «άρνηση δοσίματος» → HTTP, για τις δύο πόρτες του γραφείου
 *   (`…/provided` = ανέβασμα ως απάντηση · `…/provisions` = υπάρχον αρχείο / ανάκληση).
 * @module api/document-registry/issuance-assignments/document-requests/_shared/provision-errors
 */

import 'server-only';

import { ApiError } from '@/lib/api/ApiErrorHandler';

export type ProvisionRefusal = 'not-found' | 'case-closed' | 'unknown';

export function provisionRefusalError(rejection: ProvisionRefusal): ApiError {
  if (rejection === 'not-found') return new ApiError(404, 'File is not a document of this assignment', 'NOT_FOUND');
  if (rejection === 'case-closed') return new ApiError(409, 'The assignment is not in progress', 'CASE_CLOSED');
  return new ApiError(503, 'Document requests could not be read', 'UNAVAILABLE');
}
