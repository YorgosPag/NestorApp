/**
 * @fileoverview ADR-915 §30 Η-Δ1 — **η συσχέτιση** ενός μηνύματος ανάθεσης με τα γεγονότα παράδοσης του παρόχου: τι γράφει ο
 *   αποστολέας στο `v:nestor-ref`, και πώς το διαβάζει ο webhook. Ένα σημείο, δύο κατευθύνσεις.
 * @related issuance-invitation-send.ts (γράφει) · issuance-delivery-events.ts (διαβάζει) · types/email-delivery.ts
 * @module server/issuance-invitations/issuance-delivery-ref
 *
 * 🔒 **Ποτέ token, ποτέ διεύθυνση**: το `ref` ζει στα logs και στα webhooks του παρόχου. Μόνο ταυτότητες, που χωρίς τη βάση
 *    δεν λένε τίποτα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import type { DeliverySlot } from '@/lib/document-validity/issuance-delivery';
import type { EmailDeliveryCorrelation, EmailDeliveryPurpose } from '@/types/email-delivery';

const PURPOSE = 'document-issuance-invitation' satisfies EmailDeliveryPurpose;

/** Ανάμεσα σε `invitationId` και `contactId` — οι ταυτότητες Firestore δεν περιέχουν ποτέ `/`. */
const SLOT_SEPARATOR = '/';

/** **Τι ταξιδεύει με το μήνυμα** — ένα σημείο για τον αποστολέα και τον αναγνώστη. Ποτέ token, ποτέ διεύθυνση. */
export function issuanceDeliveryCorrelation(invitationId: string, slot: DeliverySlot): EmailDeliveryCorrelation {
  return { purpose: PURPOSE, ref: slot.kind === 'recipient' ? invitationId : `${invitationId}${SLOT_SEPARATOR}${slot.contactId}` };
}

/** Το αντίστροφο — ό,τι δεν έχει το σχήμα μας ⇒ `null` (το γεγονός αγνοείται, ποτέ μαντεψιά). */
export function parseIssuanceDeliveryRef(ref: string): { readonly invitationId: string; readonly slot: DeliverySlot } | null {
  const parts = ref.split(SLOT_SEPARATOR);
  if (parts.some((part) => part.trim() === '') || parts.length > 2) return null;
  const [invitationId, contactId] = parts;
  return { invitationId, slot: contactId === undefined ? { kind: 'recipient' } : { kind: 'co-owner', contactId } };
}
