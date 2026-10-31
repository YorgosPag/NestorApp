import 'server-only';

/**
 * **Στείλε την πρόσκληση σχέσης** (ADR-923 §5.12 Σ2), μέσω του ΚΟΙΝΟΥ αποστολέα: κλίμακα γλώσσας, ονομασμένη έκβαση, «ποτέ
 * εξαίρεση». Εδώ μόνο τα λόγια του είδους. ⛔ Το ωμό token **δεν** καταγράφεται ποτέ.
 * @module server/supply-relationships/supply-invitation-notice.server
 */

import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { deliverInvitationEmail, type InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import { buildSupplyInvitationEmail } from '@/services/email-templates/supply-invitation-email';

import type { IssuedSupplyInvitation } from './supply-invitation-issue.server';

/** Καλείται **αφού** γραφτεί το έγγραφο. Ποτέ δεν πετά: η πρόσκληση υπάρχει, απλώς ίσως δεν ταξίδεψε. */
export function notifySupplyInvitation({ invitation, token }: IssuedSupplyInvitation): Promise<InvitationNoticeOutcome> {
  return deliverInvitationEmail({
    invitationId: invitation.id,
    kind: 'supply',
    inviteeEmail: invitation.inviteeEmail,
    inviterUid: invitation.invitedByUid,
    compose: async (language) => buildSupplyInvitationEmail({
      language,
      supplierName: await readWorkspaceName(invitation.companyId).catch(() => ''),
      expiresAt: invitation.expiresAt,
      token,
    }),
  });
}
