/**
 * 👤 SSoT — **ο κάτοχος** ενός στοιχείου επικοινωνίας (τηλέφωνο, email, ιστοσελίδα, social): πρόσωπο, εταιρεία ή υπηρεσία.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-29, ADR-327 §8.5.4)**: ο άξονας γεννήθηκε μέσα στο `phone-type-vocabulary.ts`
 * (`PhoneOwnerKind`). Τα λεξιλόγια email / ιστοσελίδας / social χρειάζονται τον **ίδιο** άξονα· τρία αντίγραφα του
 * `contactType === 'company' || …` θα ήταν τρεις ευκαιρίες να διαφωνήσουν για το τι είναι «άγνωστος κάτοχος».
 *
 * Καθαρό (χωρίς React/server) ⇒ το διαβάζουν και πελάτης και server.
 *
 * @module lib/contact/contact-owner-kind
 */

/** Τίνος είναι το στοιχείο επικοινωνίας — καθορίζει ποιο υποσύνολο κάθε λεξιλογίου τύπου προσφέρεται. */
export type ContactOwnerKind = 'individual' | 'company' | 'service';

/** Ο κάτοχος από το πεδίο `type` ενός εγγράφου επαφής — άγνωστο/λείπει ⇒ πρόσωπο (η ιστορική προεπιλογή). */
export function contactOwnerKindOf(contactType: unknown): ContactOwnerKind {
  return contactType === 'company' || contactType === 'service' ? contactType : 'individual';
}
