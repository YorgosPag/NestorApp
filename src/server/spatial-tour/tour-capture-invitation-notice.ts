import 'server-only';

/**
 * @fileoverview **ΣΤΕΙΛΕ ΤΗΝ ΠΡΟΣΚΛΗΣΗ ΣΤΟΝ ΦΩΤΟΓΡΑΦΟ** (ADR-884 Φ0.5 · §4.5 Κ3α).
 * @module server/spatial-tour/tour-capture-invitation-notice
 * @related `server/invitations/invitation-notice.ts` (ο ΚΟΙΝΟΣ αποστολέας) · `tour-capture-invitation-email.ts`
 *
 * Ό,τι είναι κοινό (κλίμακα γλώσσας · ονομασμένη έκβαση · «ποτέ εξαίρεση») ζει στον κοινό αποστολέα· εδώ μένει
 * μόνο ό,τι λέει **η περιήγηση**: ποιο ακίνητο και ποιο γραφείο — διαβασμένα **τη στιγμή της αποστολής**, από τους
 * **ίδιους** αναγνώστες με την όψη (ποτέ στιγμιότυπο που παλιώνει).
 * ⛔ Το ωμό token **δεν** καταγράφεται ποτέ.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { deliverInvitationEmail, type InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import { buildTourCaptureInvitationEmail } from '@/services/email-templates/tour-capture-invitation-email';
import type { TourCaptureInvitation } from '@/types/spatial-tour';

import { describeTourCaptureInvitation } from './tour-capture-invitation-preview';

/** **Στείλε την πρόσκληση φωτογράφου.** Καλείται **αφού** γραφτεί το έγγραφο, με το ωμό token. Ποτέ δεν πετά. */
export async function notifyTourCaptureInvitation(
  db: Firestore,
  input: { readonly invitation: TourCaptureInvitation; readonly token: string },
): Promise<InvitationNoticeOutcome> {
  const { invitation } = input;
  return deliverInvitationEmail({
    invitationId: invitation.id,
    kind: 'tour-capture',
    inviteeEmail: invitation.inviteeEmail,
    inviterUid: invitation.invitedByUid,
    compose: async (language) => {
      const described = await describeTourCaptureInvitation(db, invitation);
      return buildTourCaptureInvitationEmail({
        language,
        ...described,
        reason: invitation.reason,
        grantExpiresAt: invitation.grantExpiresAt,
        expiresAt: invitation.expiresAt,
        token: input.token,
        nowISOValue: invitation.createdAt,
      });
    },
  });
}
