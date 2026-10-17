/**
 * @fileoverview `POST /api/issuance-link/unlock` — **το ξεκλείδωμα** του συνδέσμου ανάθεσης με τον κωδικό του δεύτερου
 *   καναλιού (ADR-915 §29), χωρίς λογαριασμό.
 * @related server/issuance-invitations/issuance-link-door.ts (η πόρτα) · issuance-invitation-answer.ts (`unlockIssuanceLink`)
 *
 * `Authorization: Bearer <σύνδεσμος>` · `{ accessCode }` → `{ view }` ή `{ error, remaining }`.
 * - Κάθε κλήση = **μία** προσπάθεια (μετρά στο όριο των 5)· καμία πράξη στην ανάθεση.
 * - POST, όχι GET: η προσπάθεια **γράφει** τον μετρητή — και τα Safe Links δεν πρέπει ποτέ να τη χρεώνουν.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { issuanceLinkUnlockBody } from '@/lib/document-validity/issuance-request';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { unlockIssuanceLink } from '@/server/issuance-invitations/issuance-invitation-answer';
import { issuanceLinkFailure, withIssuanceLinkDoor } from '@/server/issuance-invitations/issuance-link-door';

export const dynamic = 'force-dynamic';

async function unlockHandler(request: NextRequest, token: string): Promise<NextResponse> {
  const parsed = issuanceLinkUnlockBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return issuanceLinkFailure('code-required');
  const outcome = await unlockIssuanceLink(getAdminFirestore(), token, parsed.data.accessCode, new Date());
  if (outcome.kind === 'unavailable') return issuanceLinkFailure('unavailable');
  if (outcome.kind === 'refused') return issuanceLinkFailure(outcome.reason, outcome.remaining);
  return NextResponse.json({ success: true, data: { view: outcome.view } });
}

export const POST = withHeavyRateLimit(withIssuanceLinkDoor({}, unlockHandler));
