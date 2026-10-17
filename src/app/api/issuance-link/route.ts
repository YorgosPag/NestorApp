/**
 * @fileoverview `GET /api/issuance-link` — **η όψη** του συνδέσμου ανάθεσης έκδοσης (ADR-915 §28), χωρίς λογαριασμό.
 * @related server/issuance-invitations/issuance-link-door.ts (η πόρτα) · issuance-invitation-answer.ts (η όψη)
 *
 * `Authorization: Bearer <σύνδεσμος>` → `{ access: 'open', view }` · `{ access: 'code-required', gate }` (§29) · `{ error }`.
 * ⚠️ **Καμία πράξη σε GET** — τα Safe Links ανοίγουν τη σελίδα πριν τον άνθρωπο. Το «ανοίχτηκε» γράφεται μετά την
 *    απάντηση (`after`), μη μπλοκάρον, ως **ένδειξη**, όχι απόδειξη.
 */

import { after, NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { viewIssuanceLink } from '@/server/issuance-invitations/issuance-invitation-answer';
import { issuanceLinkFailure, withIssuanceLinkDoor } from '@/server/issuance-invitations/issuance-link-door';

export const dynamic = 'force-dynamic';

async function viewHandler(_request: NextRequest, token: string): Promise<NextResponse> {
  const outcome = await viewIssuanceLink(getAdminFirestore(), token, new Date());
  if (outcome.kind === 'unavailable') return issuanceLinkFailure('unavailable');
  if (outcome.kind === 'refused') return issuanceLinkFailure(outcome.reason, outcome.remaining);
  after(outcome.markOpened);
  return NextResponse.json({ success: true, data: outcome.landing });
}

export const GET = withHeavyRateLimit(withIssuanceLinkDoor({}, viewHandler));
