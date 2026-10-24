import 'server-only';

/**
 * @fileoverview **ΤΟ EMAIL ΤΗΣ ΑΝΑΚΛΗΣΗΣ ΣΤΟΝ ΑΓΟΡΑΣΤΗ** — μετά το commit, με καταγραφή της έκβασης (ADR-916 §5.19 Φ-Δ.5).
 * @related server/invitations/invitation-notice.ts (ο ΚΟΙΝΟΣ αποστολέας — From ADR-857, κλίμακα γλώσσας, «ποτέ δεν πετά») ·
 *          services/email-templates/property-handover-withdrawal-email.ts (τα λόγια) ·
 *          lib/property-handover/handover-withdrawal-plan.ts (`withdrawalNoticeDueOf` — πότε οφείλεται)
 * @module server/property-handover-withdrawal/handover-withdrawal-notice
 *
 * ```
 * commit (ανάκληση + προβολή φακέλου) ─► email ─► έκβαση στην παράδοση (CAS: μόνο αν οφείλεται ΑΚΟΜΗ)
 * δίχτυ (νυχτερινό) ─► ό,τι δεν έγινε δεκτό, ως το όριο ─► email ─► έκβαση
 * ```
 * 🔑 **Η διεύθυνση είναι του ΛΟΓΑΡΙΑΣΜΟΥ** που αποδέχτηκε (ο αγοραστής απέδειξε ότι του ανήκει), όχι της επαφής του CRM:
 *    μιλάμε στον κάτοχο του φακέλου. Λογαριασμός που δεν υπάρχει πια ⇒ `no-address` (σήμα στο γραφείο, όχι επανάληψη)·
 *    παροδική αποτυχία ανάγνωσης ⇒ `failed` (το δίχτυ ξαναδοκιμάζει).
 * 🔒 **Κανένα** email ή uid στα ίχνη, **καμία** αιτιολογία του γραφείου στο μήνυμα (Δ10).
 * ⚠️ **ΠΟΤΕ ΔΕΝ ΠΕΤΑ**: η ανάκληση έχει ήδη γραφτεί· αποτυχία email = έκβαση στην παράδοση, όχι σφάλμα διαδρομής.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { isAuthUserNotFound } from '@/lib/auth/firebase-auth-errors';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { deliverInvitationEmail } from '@/server/invitations/invitation-notice';
import { describeHandoverInvitation } from '@/server/property-handover-invitations/handover-invitation-description';
import { buildPropertyHandoverWithdrawalEmail } from '@/services/email-templates/property-handover-withdrawal-email';
import type { PropertyHandover, PropertyHandoverWithdrawalNoticeDelivery } from '@/types/property-handover';

const logger = createModuleLogger('handover-withdrawal-notice');

/** Το είδος, για τα ίχνη του κοινού αποστολέα. */
const NOTICE_KIND = 'property-handover-withdrawal';

/**
 * **Ποιος γράφει την έκβαση** — ο ΕΝΑΣ γραφέας της παράδοσης, που δίνεται από τον καλούντα: αυτό το αρχείο στέλνει email,
 * **δεν** γράφει παραδόσεις (καμία δεύτερη διαδρομή προς τη συλλογή, κανένας κύκλος εισαγωγών).
 */
export type HandoverWithdrawalNoticeRecorder = (input: {
  readonly handoverId: string;
  readonly delivery: Exclude<PropertyHandoverWithdrawalNoticeDelivery, 'pending'>;
}) => Promise<void>;

type RecipientAddress = { readonly kind: 'address'; readonly email: string } | { readonly kind: 'no-address' } | { readonly kind: 'failed' };

/** Η διεύθυνση του λογαριασμού-κατόχου του φακέλου, κανονικοποιημένη. */
async function recipientAddressOf(userId: string): Promise<RecipientAddress> {
  try {
    const email = (await getAdminAuth().getUser(userId)).email;
    return typeof email === 'string' && email.trim() !== '' ? { kind: 'address', email: normaliseChannelEmail(email) } : { kind: 'no-address' };
  } catch (error) {
    if (isAuthUserNotFound(error)) return { kind: 'no-address' };
    logger.warn('Ο λογαριασμός του αγοραστή δεν διαβάστηκε — θα ξαναδοκιμαστεί', { error: getErrorMessage(error) });
    return { kind: 'failed' };
  }
}

/**
 * **Στείλε την ειδοποίηση ανάκλησης** — μόνο για ανακλημένη παράδοση με αγοραστή που είχε αποδεχτεί. Η γλώσσα από την
 * κλίμακα του κοινού αποστολέα (δηλωμένη του αγοραστή → του ανθρώπου που ανακάλεσε → προεπιλογή). Ποτέ δεν πετά.
 */
export async function deliverHandoverWithdrawalNotice(
  adminDb: Firestore,
  handover: PropertyHandover,
  record: HandoverWithdrawalNoticeRecorder,
): Promise<void> {
  const { recipient, withdrawal } = handover;
  if (handover.lifecycle !== 'withdrawn' || recipient === null || withdrawal === null || withdrawal.notice === null) return;
  try {
    const address = await recipientAddressOf(recipient.userId);
    if (address.kind !== 'address') {
      await record({ handoverId: handover.id, delivery: address.kind });
      return;
    }
    const description = await describeHandoverInvitation(adminDb, handover);
    const outcome = await deliverInvitationEmail({
      invitationId: handover.id,
      kind: NOTICE_KIND,
      inviteeEmail: address.email,
      inviterUid: withdrawal.withdrawnBy,
      compose: async (language) => buildPropertyHandoverWithdrawalEmail({ language, ...description }),
    });
    // Χωρίς σύνδεσμο το μήνυμα δεν μπορεί να είναι `unaddressable`· ό,τι δεν έγινε δεκτό ξαναδοκιμάζεται.
    await record({ handoverId: handover.id, delivery: outcome === 'accepted' ? 'accepted' : 'failed' });
  } catch (error) {
    logger.error('Η ειδοποίηση ανάκλησης δεν καταγράφηκε', { handoverId: handover.id, error: getErrorMessage(error) });
  }
}
