/**
 * @fileoverview **ΤΟ ΚΟΥΜΠΙ ΤΗΣ ΣΕΛΙΔΑΣ ΕΠΙΒΕΒΑΙΩΣΗΣ** — η μόνη διαδρομή που γράφει «αυτό το email λαμβάνει» (ADR-841 §7 Α21.18).
 * @related services/mandate/showcase-email-confirmation-decision.ts · app/(auth)/card-email/[token]/page.tsx ·
 *   app/api/mandate/[token]/route.ts (το πρότυπο)
 * @module app/api/showcase-email-confirmations/[token]/route
 *
 * 🔴 **ΧΩΡΙΣ `withAuth`, ΕΠΙΤΗΔΕΣ**: ο παραλήπτης είναι **γραμματοκιβώτιο**, όχι λογαριασμός — συχνά ένα
 * `office@` που το διαβάζει γραμματέας. Η εξουσιοδότηση **είναι** ο σύνδεσμος (υπογεγραμμένος, μίας χρήσης,
 * 72ω, ακυρώνεται από νεότερο).
 *
 * 🔑 **`POST` ΚΑΙ ΜΟΝΟ**: ο σύνδεσμος του email ανοίγει τη **σελίδα**, που δεν γράφει. Οι σαρωτές αλληλογραφίας
 * κάνουν `GET` — εδώ δεν φτάνουν ποτέ.
 *
 * ⚠️ `withSensitiveRateLimit`: πόρτα χωρίς ταυτότητα είναι η μόνη που ένας άγνωστος χτυπά επ' άπειρον.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import {
  decideShowcaseEmailConfirmation,
  type ShowcaseEmailConfirmationOutcome,
} from '@/services/mandate/showcase-email-confirmation-decision';
import {
  SHOWCASE_EMAIL_CONFIRMATION_DECISIONS,
  type ShowcaseEmailConfirmationDecision,
  type ShowcaseEmailConfirmationRefusal,
} from '@/types/showcase-email-confirmation';

export interface EmailConfirmationDecisionResponse {
  readonly ok: boolean;
  readonly decision?: ShowcaseEmailConfirmationDecision;
  /** Κωδικός — γίνεται **κλειδί i18n** στην οθόνη (N.11), ποτέ ωμό κείμενο. */
  readonly reason?: ShowcaseEmailConfirmationRefusal | 'unavailable';
}

/** Κλειστό σύνολο, ελεγμένο **πριν** αγγίξουμε τη βάση. */
function decisionFrom(value: unknown): ShowcaseEmailConfirmationDecision | null {
  return SHOWCASE_EMAIL_CONFIRMATION_DECISIONS.find((decision) => decision === value) ?? null;
}

/**
 * 🔑 **Ο κωδικός λέει ποιος πρέπει να κάνει κάτι**: 404 δεν υπάρχει · 409 έχει ήδη απαντηθεί · 410 έληξε /
 * αντικαταστάθηκε / η διεύθυνση έφυγε από την κάρτα · 400 άκυρος · **503 δικό μας** (λείπει μυστικό ή βάση).
 */
const STATUS: Record<ShowcaseEmailConfirmationRefusal | 'unavailable', number> = {
  'link-invalid': 400,
  'request-unknown': 404,
  'already-confirmed': 409,
  'already-disowned': 409,
  expired: 410,
  superseded: 410,
  'email-changed': 410,
  unavailable: 503,
};

function respond(outcome: ShowcaseEmailConfirmationOutcome): NextResponse<EmailConfirmationDecisionResponse> {
  if (outcome.ok) return NextResponse.json({ ok: true, decision: outcome.decision });
  return NextResponse.json({ ok: false, reason: outcome.reason }, { status: STATUS[outcome.reason] });
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse<EmailConfirmationDecisionResponse>> {
  const { token: raw } = await context.params;
  const token = decodeRouteParam(raw);

  const body: unknown = await request.json().catch(() => null);
  const decision = decisionFrom((body as { decision?: unknown } | null)?.decision);
  if (decision === null) return NextResponse.json({ ok: false, reason: 'link-invalid' }, { status: 400 });

  return respond(await decideShowcaseEmailConfirmation(getAdminFirestore(), token, decision));
}

export const POST = withSensitiveRateLimit(handler);
