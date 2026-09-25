import 'server-only';

/**
 * Ονομασμένη άρνηση → απάντηση HTTP, για τις διαδρομές `/api/shares/*` (ADR-315).
 *
 * Κάθε διαδρομή δηλώνει **τον δικό της** χάρτη `λόγος → status` (δημιουργία: `forbidden` 403 ·
 * ρυθμίσεις: `not-found` 404)· το σχήμα του σώματος `{ error, reason? }` είναι **ένα** — αυτό
 * διαβάζει ο browser (`ApiClientError.errorBody`, π.χ. `max-below-count`).
 *
 * @module server/sharing/share-refusal-response
 */

import { NextResponse } from 'next/server';

export interface ShareRefusalBody<R extends string> {
  readonly error: R;
  readonly reason?: string;
}

export function shareRefusalResponse<R extends string>(
  refusal: R,
  reason: string | undefined,
  statusOf: Readonly<Record<R, number>>,
): NextResponse<ShareRefusalBody<R>> {
  return NextResponse.json(
    { error: refusal, ...(reason ? { reason } : {}) },
    { status: statusOf[refusal] },
  );
}
