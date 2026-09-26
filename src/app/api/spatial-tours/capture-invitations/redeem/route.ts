/**
 * @fileoverview **POST /api/spatial-tours/capture-invitations/redeem** — ο φωτογράφος δέχεται ή αρνείται.
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · ADR-853 §7.5 · §15 · §20 · πρότυπο `api/workspace-invitations/redeem/route.ts`
 * @module app/api/spatial-tours/capture-invitations/redeem/route
 *
 * 🔴 **ΔΥΟ ΕΛΕΓΧΟΙ ΤΑΥΤΟΤΗΤΑΣ**: υπογεγραμμένο token (σε **σώμα**, ποτέ σε URL) **ΚΑΙ** συνδεδεμένος λογαριασμός με
 * email **του Auth** ίδιο με τον παραλήπτη — ο κοινός πυρήνας. Η αποδοχή γράφει την άδεια λήψης **στην ίδια**
 * συναλλαγή (δύο κλικ ⇒ μία άδεια).
 *
 * 🔑 **`withPersonalOrOrgAuth`**: ο φωτογράφος **δεν** είναι μέλος κανενός χώρου (Φ0.5) και **δεν** γίνεται ποτέ —
 * καμία γραφή claim εδώ, σε αντίθεση με την πρόσκληση χώρου. Μετά την αποδοχή, η οθόνη τον στέλνει στο «Οι λήψεις μου».
 */

import { NextResponse, type NextRequest } from 'next/server';

import { readJsonBody } from '@/lib/api/json-body';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withHeavyRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';
import {
  INVITATION_REDEEM_BODY,
  readInvitationRedeemer,
  type InvitationLinkRefusedBody,
  type InvitationRedeemUnavailableBody,
} from '@/server/invitations/invitation-http';
import {
  acceptTourCaptureInvitation,
  declineTourCaptureInvitation,
  type TourCaptureRedeemOutcome,
} from '@/server/spatial-tour/tour-capture-invitation-redeem';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

const logger = createModuleLogger('TOUR_CAPTURE_INVITATION_REDEEM');

export const dynamic = 'force-dynamic';

type RedeemResponse =
  | { readonly status: 'accepted' | 'declined' }
  | InvitationLinkRefusedBody<InvitationCoreRefusal>
  | InvitationRedeemUnavailableBody;

/** **Έκβαση → HTTP**, κλειστό σύνολο, χωρίς `default`. */
function respond(outcome: TourCaptureRedeemOutcome): NextResponse<RedeemResponse> {
  switch (outcome.kind) {
    case 'accepted':
    case 'declined':
      return NextResponse.json({ status: outcome.kind } as const);
    case 'refused':
      // 🔑 **422**: το αίτημα ήταν κατανοητό· ο **κόσμος** δεν το επιτρέπει — και ο λόγος ταξιδεύει.
      return NextResponse.json({ error: 'LINK_REFUSED', reason: outcome.reason } as const, { status: 422 });
    case 'unavailable':
      return NextResponse.json({ error: 'REDEEM_UNAVAILABLE' } as const, { status: 503 });
  }
}

async function handler(request: NextRequest, actor: ApiActor): Promise<NextResponse<RedeemResponse>> {
  const parsed = await readJsonBody(request, INVITATION_REDEEM_BODY);
  if ('rejected' in parsed) return parsed.rejected;

  try {
    // 🔴 §15 — ο λογαριασμός **από το Auth**, ποτέ από το token.
    const identity = await readInvitationRedeemer(actor.ctx.uid);
    const db = getAdminFirestore();
    const input = { token: parsed.data.token, identity };
    const outcome = parsed.data.action === 'accept'
      ? await acceptTourCaptureInvitation(db, input)
      : await declineTourCaptureInvitation(db, input);
    return respond(outcome);
  } catch (error: unknown) {
    logger.error('Η εξαργύρωση πρόσκλησης φωτογράφου δεν ολοκληρώθηκε', { uid: actor.ctx.uid, error: getErrorMessage(error) });
    return NextResponse.json({ error: 'REDEEM_UNAVAILABLE' } as const, { status: 503 });
  }
}

export const POST = withHeavyRateLimit(withPersonalOrOrgAuth<RedeemResponse>(handler));
