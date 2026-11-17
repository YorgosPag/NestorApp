/**
 * ADR-915 §45.20 · ADR-943 Φ5α — **η άρνηση μιας πράξης μηχανικού πάνω στην ανάθεση έκδοσης → HTTP**, κάθε λόγος ρητά.
 * Ένας πίνακας για κάθε πράξη του χώρου της συμμετοχής (`writeEngagementIssuanceAction`)· οι κωδικοί είναι και τα κλειδιά
 * μηνυμάτων της οθόνης.
 *
 * @module api/engagements/_shared/issuance-action-response
 */

import { NextResponse } from 'next/server';

import type { EngagementIssuanceRefusal } from '@/services/document-registry/issuance-engagement-action.server';

export const ENGAGEMENT_ISSUANCE_REFUSAL_STATUS: Readonly<Record<EngagementIssuanceRefusal, readonly [number, string]>> = {
  'not-found': [404, 'NOT_FOUND'],
  'not-engaged': [403, 'ENGAGEMENT_NOT_ACTIVE'],
  unavailable: [503, 'UNAVAILABLE'],
  stale: [409, 'STALE'],
  'transition-refused': [409, 'TRANSITION_REFUSED'],
  'terms-refused': [422, 'TERMS_REFUSED'],
  // Δομικά ανέφικτο από τη φόρμα (ο μειωτής κρίνει ποιες πράξεις επιτρέπονται στη συμμετοχή).
  'actor-refused': [422, 'ACTOR_REFUSED'],
  unqualified: [422, 'UNQUALIFIED'],
  'receipt-mismatch': [422, 'RECEIPT_MISMATCH'],
};

/** Η απάντηση άρνησης από έναν πίνακα `λόγος → [status, κωδικός]`. */
export function issuanceRefusalResponse<R extends string>(table: Readonly<Record<R, readonly [number, string]>>, refusal: R): NextResponse {
  const [status, code] = table[refusal];
  return NextResponse.json({ success: false, error: code }, { status });
}
