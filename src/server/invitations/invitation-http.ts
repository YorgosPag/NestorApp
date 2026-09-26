import 'server-only';

/**
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ ΣΤΟ ΣΥΝΟΡΟ HTTP** — ό,τι κάθε διαδρομή πρόσκλησης (χώρου · φωτογράφου) κάνει **ίδια**.
 * @related ADR-853 §7.5 · §15 · §20 · ADR-884 §4.5 (Κ3α — το δεύτερο είδος)
 * @module server/invitations/invitation-http
 *
 * Εξήχθη από τις διαδρομές `workspace-invitations/{preview,redeem}` (2026-09-26) με την άφιξη του δεύτερου είδους:
 * - **ο πίνακας «άρνηση πυρήνα → κωδικός HTTP»** της **όψης** — ένα λεξιλόγιο, μία σημασία στο δίκτυο·
 * - **ο εξαργυρωτής από το Auth** — ποιος πατά τον σύνδεσμο, με email **του Auth** (ποτέ του token, §15).
 */

import { z } from 'zod';

import { getAdminAuth } from '@/lib/firebaseAdmin';
import { provenMailboxAccountOf } from '@/server/auth/mailbox-proof-custody';
import type { InvitationCoreRefusal } from '@/types/invitation-core';

import type { InvitationRedeemer } from './invitation-redeem';

/**
 * **Άρνηση πυρήνα → κωδικός HTTP για την ΟΨΗ** (GET ⇒ μιλά ο **πόρος**). `Record`: νέα άρνηση πυρήνα **δεν
 * μεταγλωττίζεται** μέχρι να αποκτήσει σημασία στο δίκτυο. Η **εξαργύρωση** απαντά `422` σε κάθε άρνηση — εκεί
 * κρίνεται **πράξη**.
 */
export const INVITATION_PREVIEW_STATUS: Readonly<Record<InvitationCoreRefusal, number>> = {
  /** Το κείμενο δεν είναι σύνδεσμός μας — σφάλμα αιτήματος. */
  'link-invalid': 400,
  /** RFC 9110 §15.5.20 **421** — εκδόθηκε για **άλλον** server (άλλο περιβάλλον/κλειδί). */
  'link-foreign': 421,
  'invitation-unknown': 404,
  /** **410 Gone** — «υπήρχε, δεν ισχύει πια». */
  'expired': 410,
  'already-used': 410,
  'revoked': 410,
  /** Άφταστο από την όψη (θέλει ταυτότητα) — δηλωμένο για πληρότητα. */
  'wrong-recipient': 403,
};

/**
 * **Το σώμα κάθε εξαργύρωσης** — το token σε **σώμα**, ποτέ σε URL (RFC 6819 §5.1.5)· η πράξη **ρητή**, χωρίς
 * προεπιλογή («δέχομαι» ή «αρνούμαι» δεν μαντεύεται ποτέ).
 */
export const INVITATION_REDEEM_BODY = z.object({
  token: z.string().min(8).max(4096),
  action: z.enum(['accept', 'decline']),
});

/** Ονομασμένη άρνηση εξαργύρωσης — κάθε λόγος στέλνει τον άνθρωπο σε **άλλη** ενέργεια (ADR-853 §5 #7). */
export type InvitationLinkRefusedBody<R extends string> = { readonly error: 'LINK_REFUSED'; readonly reason: R };

/** «Δεν μπόρεσα να ρωτήσω» — ποτέ ονομασμένη άρνηση (N.12 · ADR-787 Ε-5 §4 #3). */
export type InvitationRedeemUnavailableBody = { readonly error: 'REDEEM_UNAVAILABLE' };

/**
 * **Ο άνθρωπος που πατά τον σύνδεσμο, όπως τον ξέρει ο ΙΔΙΟΚΤΗΤΗΣ του λογαριασμού.** 🔴 Το token (ζει έως μία ώρα)
 * **δεν αρκεί**: ένα `email` από εκεί μπορεί να είναι μπαγιάτικο — και το email **επιβεβαιώνεται** από την
 * πρόσκληση (ADR-853 §15). ⛔ Ποτέ custom claim `emailVerified` (δεύτερη αυθεντία).
 * @throws όταν το Auth δεν απαντά — ο καλών απαντά 503 («δεν μάθαμε»), ποτέ ονομασμένη άρνηση.
 */
export async function readInvitationRedeemer(uid: string): Promise<InvitationRedeemer> {
  const record = await getAdminAuth().getUser(uid);
  return { ...provenMailboxAccountOf(record), email: record.email ?? '' };
}
