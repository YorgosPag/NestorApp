import 'server-only';

/**
 * @fileoverview ADR-915 §28 Η-Β6 — **η πόρτα του συνδέσμου ανάθεσης**: ΕΝΑ σύνορο για τα δημόσια API της σελίδας
 *   `/document-request` (`GET /api/issuance-link` · `POST /api/issuance-link/answer`).
 * @related server/vendor-portal/vendor-link-door.ts (το πρότυπο, ADR-876 §5) · issuance-invitation-answer.ts
 * @module server/issuance-invitations/issuance-link-door
 *
 * Ο άνθρωπος δεν έχει λογαριασμό· **είναι** ο σύνδεσμός του. Με τη σειρά:
 *   1. **Διαπιστευτήριο από `Authorization: Bearer`** — ποτέ από τη διαδρομή (θα έμενε σε κάθε access log).
 *   2. **Υπογραφή χωρίς βάση** (`readInvitationToken`) — πλαστό = μηδέν ανάγνωση Firestore· δίνει και τον **principal**.
 *   3. **Σύνορο ιδεμποτίας** (CHECK 3.92) με principal `issuance-link:<invitationId>` — ποτέ `anon`: δύο διαφορετικοί
 *      σύνδεσμοι με ίδιο κλειδί και σώμα θα έπαιρναν ο ένας την απάντηση του άλλου.
 *   4. Ο handler — που ξανακρίνει **τα πάντα** μέσα στη συναλλαγή.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { runIdempotently } from '@/lib/api/idempotency/with-idempotency';
import type { IdempotencyPolicy } from '@/lib/api/idempotency/idempotency-contract';
import { extractBearerToken } from '@/lib/auth/token-credentials';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { readInvitationToken } from '@/server/invitations/invitation-token';

import type { LinkRefusal } from './issuance-invitation-answer';
import { ISSUANCE_INVITE_SECRET_ENV } from './issuance-invitation-kind';

const logger = createModuleLogger('ISSUANCE_LINK_DOOR');

/** Ό,τι μπορεί να απαντήσει η πόρτα πέρα από τις αρνήσεις του συνδέσμου. */
export const DOOR_FAILURES = ['missing-link', 'unavailable', 'server-error'] as const;
export type DoorFailure = (typeof DOOR_FAILURES)[number];

/** Κάθε άρνηση → HTTP. Εξαντλητικό: νέα άρνηση χωρίς γραμμή εδώ δεν μεταγλωττίζεται. Ο κωδικός **είναι** το κλειδί της οθόνης. */
const STATUS: Readonly<Record<LinkRefusal | DoorFailure, number>> = {
  'link-invalid': 400,
  'link-foreign': 400,
  'invitation-unknown': 404,
  expired: 410,
  'already-used': 409,
  revoked: 410,
  'wrong-recipient': 403,
  superseded: 410,
  'lead-changed': 409,
  'answer-mismatch': 400,
  'missing-link': 401,
  unavailable: 503,
  'server-error': 500,
};

export function issuanceLinkFailure(reason: LinkRefusal | DoorFailure): NextResponse {
  return NextResponse.json({ success: false, error: reason }, { status: STATUS[reason] });
}

export type IssuanceLinkHandler = (request: NextRequest, token: string) => Promise<NextResponse>;

/** **Η πόρτα.** Επιστρέφει handler έτοιμο για `withHeavyRateLimit`. */
export function withIssuanceLinkDoor(
  options: { readonly idempotency?: IdempotencyPolicy },
  handler: IssuanceLinkHandler,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const token = extractBearerToken(request);
    if (!token) return issuanceLinkFailure('missing-link');
    const reading = await readInvitationToken(ISSUANCE_INVITE_SECRET_ENV, token, 0, nowISO());
    if (reading.kind === 'secret-missing') return issuanceLinkFailure('unavailable');
    if (reading.kind === 'refused') return issuanceLinkFailure(reading.reason);

    return runIdempotently(request, `issuance-link:${reading.invitationId}`, options.idempotency, async () => {
      try {
        return { response: await handler(request, token), thrown: false };
      } catch (error) {
        logger.error('Αίτημα συνδέσμου ανάθεσης απέτυχε', { error: getErrorMessage(error, 'unknown') });
        return { response: issuanceLinkFailure('server-error'), thrown: true };
      }
    });
  };
}
