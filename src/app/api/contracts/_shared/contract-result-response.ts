/**
 * =============================================================================
 * Contract route responses — shared service-result → HTTP mapping
 * =============================================================================
 *
 * `LegalContractService` methods return `{ success, error? }` rather than
 * throwing, so every contract route repeats the same conflict branch. Extracted
 * 2026-08-01 (ADR-745 / N.18): the two existing routes had drifted into a
 * token-identical block and jscpd flagged them as clones.
 *
 * 409 is the right code here: the service's failures are state conflicts
 * (contract already exists for the phase, contract already signed), not bad input —
 * argument validation happens earlier in each route and answers 400.
 *
 * @module app/api/contracts/_shared/contract-result-response
 */

import { NextResponse } from 'next/server';

/** The shape every `LegalContractService` mutation returns. */
interface ServiceResult {
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Map a failed service result to a 409 response.
 *
 * @returns the response to send, or `null` when the call succeeded and the route
 *   should build its own success payload (each route returns a different body).
 */
export function conflictIfFailed(result: ServiceResult): NextResponse | null {
  if (result.success) return null;

  return NextResponse.json(
    { success: false, error: result.error },
    { status: 409 },
  );
}
