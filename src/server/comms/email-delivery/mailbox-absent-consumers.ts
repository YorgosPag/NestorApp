/**
 * @fileoverview **ΠΟΙΟΣ ΠΡΕΠΕΙ ΝΑ ΜΑΘΕΙ ΟΤΙ ΕΝΑ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟ ΔΕΝ ΥΠΑΡΧΕΙ** — το μητρώο καταναλωτών
 *   (ADR-841 §7 Α21.20).
 * @related app/api/communications/webhooks/mailgun/events/route.ts (ο καλών) ·
 *   services/mandate/showcase-email-return.service.ts (ο πρώτος καταναλωτής)
 * @module server/comms/email-delivery/mailbox-absent-consumers
 *
 * 🔑 **ΕΝΑ σημείο, όχι ο κάθε καταναλωτής μέσα στο route**: το route μιλά με τον πάροχο· αυτό το αρχείο
 * λέει *τι σημαίνει* ο θάνατος ενός γραμματοκιβωτίου για την πλατφόρμα. Επόμενος καταναλωτής (π.χ.
 * επαφές CRM, προσκλήσεις) = μία γραμμή εδώ.
 *
 * ⚠️ **Κάθε καταναλωτής ΟΦΕΙΛΕΙ να είναι ιδεμποτενής**: καλείται σε **κάθε** επανάληψη του ίδιου
 * συμβάντος όσο αυτό είναι η ισχύουσα απόδειξη. Αποτυχία ⇒ **πετά**, ώστε ο πάροχος να ξαναστείλει.
 *
 * ⚠️ **SERVER-ONLY**.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { revokeShowcaseEmailConfirmations } from '@/services/mandate/showcase-email-return.service';
import type { RecipientStanding } from '@/types/email-delivery';

export interface MailboxAbsence {
  readonly email: string;
  /** Η στιγμή της απόδειξης — ό,τι είναι **παλαιότερο** από αυτήν παύει να ισχύει. */
  readonly evidenceAt: string;
  readonly evidenceEventId: string;
}

/** Η απόδειξη από την κατάσταση — ή `null` αν η κατάσταση δεν κρατά απόδειξη. */
export function absenceOf(standing: RecipientStanding): MailboxAbsence | null {
  if (standing.mailboxAbsentAt === null || standing.evidenceEventId === null) return null;
  return { email: standing.email, evidenceAt: standing.mailboxAbsentAt, evidenceEventId: standing.evidenceEventId };
}

/** **Ενημέρωσε κάθε καταναλωτή.** Πετά αν κάποιος αποτύχει. */
export async function announceMailboxAbsent(adminDb: AdminFirestore, absence: MailboxAbsence): Promise<void> {
  await revokeShowcaseEmailConfirmations(adminDb, absence);
}
