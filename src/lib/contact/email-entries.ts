/**
 * 📧 Λίστα διευθύνσεων (π.χ. «a@x.gr, b@x.gr» από σάρωση προσφοράς) → `EmailInfo[]` μιας **υπάρχουσας** επαφής.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-29, ADR-327 §8.5.4)**: η επεξεργασία προμηθευτή στη σάρωση προσφοράς ξανάγραφε ΟΛΑ τα
 * email με `type: 'work'` — τιμή που η φόρμα εταιρείας δεν προσφέρει (κενή λίστα «Τύπος»), και ταυτόχρονα **έσβηνε**
 * τον τύπο και την ετικέτα που είχε διαλέξει ο άνθρωπος για τις ίδιες διευθύνσεις. Ίδια διεύθυνση ⇒ ίδια εγγραφή.
 *
 * @module lib/contact/email-entries
 */

import type { EmailInfo } from '@/types/contacts';
import type { ContactOwnerKind } from './contact-owner-kind';
import { inferEmailType, isEmailTypeOfferedFor } from './email-type-vocabulary';

/**
 * - Διεύθυνση που υπάρχει ήδη (χωρίς διάκριση πεζών) ⇒ **κρατά** τύπο και ετικέτα, αν ο τύπος ανήκει στο υποσύνολο
 *   του κατόχου· αλλιώς ο κανόνας `inferEmailType`.
 * - Νέα διεύθυνση ⇒ `inferEmailType` (εταιρεία `info@` ⇒ `info`, αλλιώς η προεπιλογή του κατόχου).
 * - Κύρια = η πρώτη της λίστας (η σειρά είναι επιλογή του ανθρώπου).
 */
export function emailEntriesFromAddresses(
  addresses: readonly string[],
  existing: readonly EmailInfo[] | undefined,
  owner: ContactOwnerKind,
): EmailInfo[] {
  const byAddress = new Map((existing ?? []).map((entry) => [entry.email.trim().toLowerCase(), entry]));
  return addresses.map((email, i) => {
    const kept = byAddress.get(email.trim().toLowerCase());
    const type = kept && isEmailTypeOfferedFor(kept.type, owner) ? kept.type : inferEmailType(email, owner, 'work');
    return { email, type, isPrimary: i === 0, ...(kept?.label ? { label: kept.label } : {}) };
  });
}
