/**
 * @fileoverview ADR-943 Φ5β (Ζ-3) — **η αντίρρηση του ιδιοκτήτη** στην αυτοψία, από τη σελίδα της προκαταβολής, χωρίς
 *   λογαριασμό.
 * @related server/issuance-invitations/issuance-advance-objection.ts (η πράξη) · issuance-link-door.ts (η πόρτα) ·
 *   ../advance-checkout/route.ts (το ίδιο ιδίωμα)
 *
 * `POST` · `Authorization: Bearer <σύνδεσμος>` · `{ reason, accessCode }` → `{ status: 'objected', advance }` |
 * `{ status: 'refused', reason: 'not-objectable' }`. Σύνορο ιδεμποτίας ανά σύνδεσμο (πόρτα, CHECK 3.92): επανάληψη δικτύου
 * ⇒ η **ίδια** απάντηση, μία αντίρρηση. Καμία κίνηση χρημάτων: ο εκτελεστής σβήνει την εντολή αποδέσμευσης μόνος του.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { issuanceAdvanceObjectionBody } from '@/lib/document-validity/issuance-request';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { PRIVATE_CHANNEL_HEADERS } from '@/lib/http/private-response-headers';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { objectToIssuanceAdvance } from '@/server/issuance-invitations/issuance-advance-objection';
import { issuanceLinkFailure, withIssuanceLinkDoor } from '@/server/issuance-invitations/issuance-link-door';

export const dynamic = 'force-dynamic';

async function objectionHandler(request: NextRequest, token: string): Promise<NextResponse> {
  const parsed = issuanceAdvanceObjectionBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return issuanceLinkFailure('answer-mismatch');
  const outcome = await objectToIssuanceAdvance(getAdminFirestore(), token, parsed.data, new Date());
  if (outcome.kind === 'unavailable') return issuanceLinkFailure('unavailable');
  if (outcome.kind === 'refused') return issuanceLinkFailure(outcome.reason, outcome.remaining);
  return NextResponse.json({ success: true, data: outcome.result }, { headers: PRIVATE_CHANNEL_HEADERS });
}

export const POST = withHeavyRateLimit(withIssuanceLinkDoor({}, objectionHandler));
