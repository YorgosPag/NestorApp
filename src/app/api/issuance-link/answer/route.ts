/**
 * @fileoverview `POST /api/issuance-link/answer` — **η απάντηση** με τον σύνδεσμο ανάθεσης (ADR-915 §28), χωρίς λογαριασμό.
 * @related server/issuance-invitations/issuance-link-door.ts (η πόρτα) · issuance-invitation-answer.ts (η πράξη)
 *
 * `Authorization: Bearer <σύνδεσμος>` · `{ answer: 'approve' | 'reject' | 'accept' | 'decline', note }` → `{ answer }`.
 * - Το ακροατήριο (ιδιοκτήτης / επαγγελματίας) κρίνεται από τον **σύνδεσμο**, ποτέ από το σώμα (`answer-mismatch`).
 * - Δύο κλικ ⇒ ένα αποτέλεσμα (`already-used`)· σύνορο ιδεμποτίας ανά σύνδεσμο (πόρτα).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { issuanceLinkAnswerBody } from '@/lib/document-validity/issuance-request';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { answerIssuanceLink } from '@/server/issuance-invitations/issuance-invitation-answer';
import { issuanceLinkFailure, withIssuanceLinkDoor } from '@/server/issuance-invitations/issuance-link-door';

async function answerHandler(request: NextRequest, token: string): Promise<NextResponse> {
  const parsed = issuanceLinkAnswerBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return issuanceLinkFailure('answer-mismatch');
  const outcome = await answerIssuanceLink(getAdminFirestore(), token, parsed.data, new Date());
  if (outcome.kind === 'unavailable') return issuanceLinkFailure('unavailable');
  if (outcome.kind === 'refused') return issuanceLinkFailure(outcome.reason);
  return NextResponse.json({ success: true, data: { answer: outcome.answer } });
}

export const POST = withHeavyRateLimit(withIssuanceLinkDoor({}, answerHandler));
