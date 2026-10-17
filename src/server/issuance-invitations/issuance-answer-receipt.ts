import 'server-only';

/**
 * @fileoverview ADR-915 §30 Η-Δ5 — **η απόδειξη απάντησης** στο γραμματοκιβώτιο όπου στάλθηκε ο σύνδεσμος: «Καταγράψαμε:
 *   εγκρίνατε… στις …· δεν ήσασταν εσείς;».
 * @related issuance-invitation-answer.ts (ο καλών) · services/email-templates/issuance-invitation-email.ts (`receipt`) ·
 *   server/invitations/invitation-notice.ts (`deliverInvitationEmail` — γλώσσα, ονομασμένη έκβαση, ποτέ εξαίρεση)
 * @module server/issuance-invitations/issuance-answer-receipt
 *
 * 🔑 **Η άμυνα ΜΕΤΑ το γεγονός, συμπληρωματική του κωδικού (§29)**: ο σύνδεσμος μπορεί να προωθηθεί· η απόδειξη πηγαίνει
 *    **πάντα** στη διεύθυνση της πρόσκλησης (`inviteeEmail`), ποτέ σε όποιον τον κράτησε. Ο πραγματικός ιδιοκτήτης μαθαίνει
 *    ότι απάντησε κάποιος άλλος — όπως η ειδοποίηση «νέα σύνδεση» της Google.
 * 🔑 **Συναλλακτική επιβεβαίωση πράξης που έγινε**, ποτέ πρώτη αποστολή: φεύγει μόνο αφού η απάντηση γράφτηκε, και **μία**
 *    φορά (ο σύνδεσμος είναι μίας χρήσης · το `Idempotency-Key` της διαδρομής κρατά την επανάληψη του πελάτη).
 * 🔒 **Χωρίς κουμπί, χωρίς σύνδεσμο**: τίποτα να «πατηθεί» από όποιον κι αν τη διαβάσει.
 * ⚠️ **Δεν πετά ποτέ** — η απάντηση έχει ήδη καταγραφεί.
 */

import type { LinkVerification } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceLinkAnswer } from '@/lib/document-validity/issuance-request';
import { deliverInvitationEmail, type InvitationNoticeOutcome } from '@/server/invitations/invitation-notice';
import { buildIssuanceEmail, type IssuanceEmailFacts } from '@/services/email-templates/issuance-invitation-email';
import type { IssuanceInvitation } from '@/types/issuance-invitation';

export interface IssuanceAnswerReceipt {
  readonly invitation: IssuanceInvitation;
  readonly facts: IssuanceEmailFacts;
  readonly answer: IssuanceLinkAnswer;
  /** Το σχόλιο του ίδιου του αποδέκτη — του το επιστρέφουμε όπως καταγράφηκε. */
  readonly comment: string | null;
  readonly verifiedBy: LinkVerification;
  readonly answeredAt: string;
}

/** **Στείλε την απόδειξη** στη διεύθυνση του συνδέσμου. Ποτέ δεν πετά. */
export function sendIssuanceAnswerReceipt(receipt: IssuanceAnswerReceipt): Promise<InvitationNoticeOutcome> {
  const { invitation } = receipt;
  return deliverInvitationEmail({
    invitationId: invitation.id,
    kind: 'document-issuance-receipt',
    inviteeEmail: invitation.inviteeEmail,
    inviterUid: invitation.invitedByUid,
    compose: async (language) => buildIssuanceEmail({
      kind: 'receipt', language, facts: receipt.facts, answer: receipt.answer,
      answeredAt: receipt.answeredAt, verifiedBy: receipt.verifiedBy, comment: receipt.comment,
    }),
  });
}
