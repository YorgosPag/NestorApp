/**
 * @fileoverview **ΤΟ ΚΟΥΜΠΙ ΤΗΣ ΣΕΛΙΔΑΣ «ΘΑ ΕΙΣΤΕ ΑΝΟΙΧΤΑ ΣΤΙΣ ΑΡΓΙΕΣ;»** — η μόνη διαδρομή που γράφει ειδικές μέρες χωρίς
 *   σύνδεση (ADR-841 §7 Α21.21 Φάση Β).
 * @related services/mandate/holiday-hours-question-decision.ts · app/(auth)/hours-question/[token]/page.tsx ·
 *   app/api/showcase-email-confirmations/[token]/route.ts (το πρότυπο)
 * @module app/api/holiday-hours-questions/[token]/route
 *
 * 🔴 **ΧΩΡΙΣ `withAuth`, ΕΠΙΤΗΔΕΣ**: η εξουσιοδότηση **είναι** ο σύνδεσμος (υπογεγραμμένος, ανά παραλήπτη, λήγει με την
 * τελευταία αργία της περιόδου). Ό,τι γράφει περνά από τον **ίδιο** κριτή ειδικών ωρών με τη φόρμα.
 *
 * 🔑 **`POST` ΚΑΙ ΜΟΝΟ**: οι σαρωτές αλληλογραφίας κάνουν `GET` στον σύνδεσμο του email — εκεί βρίσκουν μια σελίδα που
 * δεν γράφει, ποτέ αυτή την πόρτα.
 *
 * ⚠️ `withSensitiveRateLimit`: πόρτα χωρίς ταυτότητα είναι η μόνη που ένας άγνωστος χτυπά επ' άπειρον. Το σχήμα του σώματος
 * έχει **φρουρούς πόρου** (60 απαντήσεις)· ταβάνι, ορίζοντας και «ήδη απαντημένη» κρίνονται **ονομαστικά** από τον κριτή.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { HOLIDAY_ANSWER_KINDS } from '@/lib/calendar/holiday-question';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import {
  decideHolidayQuestion,
  type HolidayQuestionDecision,
} from '@/services/mandate/holiday-hours-question-decision';
import type { HolidayHoursQuestionRefusal, HolidayQuestionDecisionResponse } from '@/types/holiday-hours-question';

const bodySchema = z.object({
  answers: z
    .array(z.object({ locationId: z.string().max(128), date: z.string().max(10), kind: z.enum(HOLIDAY_ANSWER_KINDS) }))
    .min(1)
    .max(60),
});

/**
 * 🔑 **Ο κωδικός λέει ποιος πρέπει να κάνει κάτι**: 404 δεν υπάρχει · 409 έχει ήδη απαντηθεί · 410 έληξε / η βιτρίνα
 * αποσύρθηκε · 422 γέμισαν οι ειδικές μέρες (η φόρμα) · 400 άκυρος · **503 δικό μας** (λείπει μυστικό ή βάση).
 */
const STATUS: Record<HolidayHoursQuestionRefusal | 'unavailable', number> = {
  'link-invalid': 400,
  'question-unknown': 404,
  'already-answered': 409,
  expired: 410,
  'without-showcase': 410,
  'special-hours-invalid': 422,
  unavailable: 503,
};

function respond(outcome: HolidayQuestionDecision): NextResponse<HolidayQuestionDecisionResponse> {
  if (!outcome.ok) return NextResponse.json({ ok: false, reason: outcome.reason }, { status: STATUS[outcome.reason] });
  return NextResponse.json({ ok: true, remaining: outcome.remaining, outcomes: outcome.outcomes.map(({ outcome: kind }) => kind) });
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse<HolidayQuestionDecisionResponse>> {
  const { token: raw } = await context.params;
  const token = decodeRouteParam(raw);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: 'link-invalid' }, { status: 400 });

  return respond(await decideHolidayQuestion(getAdminFirestore(), token, parsed.data.answers));
}

export const POST = withSensitiveRateLimit(handler);
