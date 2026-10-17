/**
 * @fileoverview **ΠΟΙΟΣ ΠΡΕΠΕΙ ΝΑ ΜΑΘΕΙ ΤΙ ΑΠΕΓΙΝΕ ΤΟ ΔΙΚΟ ΤΟΥ EMAIL** — το μητρώο καταναλωτών ανά σκοπό (`purpose`)
 *   (ADR-841 §7 Α21.20 · ADR-915 §30).
 * @related app/api/communications/webhooks/mailgun/events/route.ts (ο καλών) ·
 *   mailbox-absent-consumers.ts (ο αδελφός: συνέπειες ανά **διεύθυνση**) · types/email-delivery.ts (`EMAIL_DELIVERY_PURPOSES`)
 * @module server/comms/email-delivery/delivery-event-consumers
 *
 * 🔑 **Δύο ερωτήσεις, δύο μητρώα**: το `mailbox-absent-consumers` απαντά «πέθανε αυτή η διεύθυνση — ποιος νοιάζεται;»
 *    (για **κάθε** μήνυμα προς αυτήν)· εδώ απαντάμε «τι απέγινε **αυτό** το μήνυμα;», για όποιον το έστειλε με συσχέτιση.
 * 🔑 **`Record<EmailDeliveryPurpose, …>`, ποτέ `Partial`**: νέος σκοπός δεν μεταγλωττίζεται χωρίς απόφαση εδώ — ακόμη κι
 *    αν η απόφαση είναι «κανείς» (`null`, με λόγο).
 * ⚠️ **Κάθε καταναλωτής ΟΦΕΙΛΕΙ να είναι ιδεμποτής**: καλείται και στο `duplicate` του ημερολογίου, ώστε μια αποτυχία του
 *    να διορθώνεται στην επόμενη παράδοση του παρόχου. Αποτυχία ⇒ **πετά** (5xx ⇒ ο πάροχος ξαναστέλνει).
 *
 * ⚠️ **SERVER-ONLY**.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { applyIssuanceDeliveryEvent } from '@/server/issuance-invitations/issuance-delivery-events';
import type { EmailDeliveryEvent, EmailDeliveryPurpose } from '@/types/email-delivery';

type DeliveryEventConsumer = (adminDb: AdminFirestore, event: EmailDeliveryEvent) => Promise<unknown>;

const CONSUMERS: Readonly<Record<EmailDeliveryPurpose, DeliveryEventConsumer | null>> = {
  /** Η επιβεβαίωση email βιτρίνας ακούει μόνο τον **θάνατο** της διεύθυνσης — `mailbox-absent-consumers`. */
  'showcase-email-confirmation': null,
  'document-issuance-invitation': applyIssuanceDeliveryEvent,
};

/** **Δώσε το γεγονός στον ιδιοκτήτη του μηνύματος** — αν έχει. Πετά αν ο καταναλωτής αποτύχει. */
export async function announceDeliveryEvent(adminDb: AdminFirestore, event: EmailDeliveryEvent): Promise<void> {
  if (event.purpose === null || event.ref === null) return;
  await CONSUMERS[event.purpose]?.(adminDb, event);
}
