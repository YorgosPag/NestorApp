/**
 * @fileoverview **POST /api/property-handover-invitations/redeem** — ο αγοραστής δέχεται ή αρνείται τον φάκελό του.
 * @related ADR-916 Φ-Β · Δ7 · ADR-853 §7.5 · §15 · §20 · πρότυπο `api/spatial-tours/capture-invitations/redeem/route.ts`
 * @module app/api/property-handover-invitations/redeem/route
 *
 * 🔴 **ΔΥΟ ΕΛΕΓΧΟΙ ΤΑΥΤΟΤΗΤΑΣ**: υπογεγραμμένο token (σε **σώμα**, ποτέ σε URL) **ΚΑΙ** συνδεδεμένος λογαριασμός με email
 * **του Auth** ίδιο με τον παραλήπτη — ο κοινός πυρήνας. Η αποδοχή δένει τον λογαριασμό και γεννά τον φάκελο **στην ίδια**
 * συναλλαγή (δύο κλικ ⇒ ένας φάκελος).
 *
 * 🔑 **`withPersonalOrOrgAuth`**: ο αγοραστής **δεν** είναι μέλος κανενός χώρου και **δεν** γίνεται ποτέ — καμία γραφή
 * claim εδώ. Μετά την αποδοχή, η οθόνη τον στέλνει στον **φάκελό** του (`dossierId` στην απάντηση).
 *
 * 📦 **ADR-916 Φ-Γ1 — μετά την απόκριση** (`after`): αν η πώληση έχει ήδη ολοκληρωθεί, ο **ίδιος** γραφέας συμφιλίωσης
 * ξεκινά την αντιγραφή των αρχείων (Ο12). Η απάντηση **δεν** περιμένει τα αρχεία — ο φάκελος είναι ζωντανός και τα
 * δείχνει καθώς φτάνουν· ό,τι δεν προλάβει το συνεχίζει το cron `property-handover-delivery`.
 */

import { after, NextResponse, type NextRequest } from 'next/server';

import { INVITATION_REDEEM_REFUSED_STATUS } from '@/contracts/invitation-redeem-body';
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
  respondToHandoverInvitation,
  type HandoverRedeemOutcome,
} from '@/server/property-handover-invitations/handover-invitation-redeem';
import { syncPropertyHandovers } from '@/services/property-handover/property-handover-write.service';
import type { InvitationCoreRefusal } from '@/types/invitation-core';
import type { PropertyHandoverInvitationKindRefusal } from '@/types/property-handover-invitation';

const logger = createModuleLogger('PROPERTY_HANDOVER_INVITATION_REDEEM');

export const dynamic = 'force-dynamic';

type RedeemResponse =
  | { readonly status: 'accepted'; readonly dossierId: string }
  | { readonly status: 'declined' }
  | InvitationLinkRefusedBody<InvitationCoreRefusal | PropertyHandoverInvitationKindRefusal>
  | InvitationRedeemUnavailableBody;

/** **Έκβαση → HTTP**, κλειστό σύνολο, χωρίς `default`. */
function respond(outcome: HandoverRedeemOutcome): NextResponse<RedeemResponse> {
  switch (outcome.kind) {
    case 'accepted':
      return NextResponse.json({ status: 'accepted', dossierId: outcome.effect.dossier.id } as const);
    case 'declined':
      return NextResponse.json({ status: 'declined' } as const);
    case 'refused':
      // 🔑 **422**: το αίτημα ήταν κατανοητό· ο **κόσμος** δεν το επιτρέπει — και ο λόγος ταξιδεύει.
      return NextResponse.json({ error: 'LINK_REFUSED', reason: outcome.reason } as const, { status: INVITATION_REDEEM_REFUSED_STATUS });
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
    const outcome = await respondToHandoverInvitation(db, { action: parsed.data.action, token: parsed.data.token, identity });
    if (outcome.kind === 'accepted') {
      const { propertyId } = outcome.effect.after;
      after(() => syncPropertyHandovers(db, propertyId, { cause: 'acceptance', performedBy: actor.ctx.uid }));
    }
    return respond(outcome);
  } catch (error: unknown) {
    logger.error('Η εξαργύρωση πρόσκλησης αγοραστή δεν ολοκληρώθηκε', { uid: actor.ctx.uid, error: getErrorMessage(error) });
    return NextResponse.json({ error: 'REDEEM_UNAVAILABLE' } as const, { status: 503 });
  }
}

export const POST = withHeavyRateLimit(withPersonalOrOrgAuth<RedeemResponse>(handler));
