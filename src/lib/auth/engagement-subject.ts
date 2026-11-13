/**
 * =============================================================================
 * Η ΥΠΟΘΕΣΗ ΜΙΑΣ ΣΥΜΜΕΤΟΧΗΣ — «ίδια υπόθεση;», ΜΙΑ φορά (ADR-862 §5.3.10)
 * =============================================================================
 *
 * Η συμμετοχή δίνει πρόσβαση σε **δύο** είδη υπόθεσης (`EngagementSubject`), και το καθένα ονομάζει
 * το κλειδί του αλλιώς (`caseId` · `assignmentId`). Η σύγκριση γίνεται **εδώ**: αν τη ξανάγραφε κάθε
 * καταναλωτής, μια σύγκριση μόνο του `caseId` θα έβρισκε **ίδιες** δύο αναθέσεις έκδοσης (και τα δύο
 * `undefined`) — δηλαδή πρόσβαση σε ξένη υπόθεση.
 *
 * 🔑 Τα αποθηκευμένα έγγραφα μεταβίβασης κρατούν το `subject.caseId` τους — **καμία μετανάστευση**.
 * Το φίλτρο Firestore ανά είδος ζει στο `engagement-ref.ts`, με **ρητά** ονόματα πεδίων (πύλες δεικτών).
 *
 * Καθαρό — χωρίς Firestore, χωρίς `server-only`.
 *
 * @module lib/auth/engagement-subject
 */

import type { EngagementSubject } from '@/types/engagement';

/** Το id της υπόθεσης — όποιο κι αν είναι το είδος της. */
function subjectIdOf(subject: EngagementSubject): string {
  switch (subject.kind) {
    case 'conveyance_case':
      return subject.caseId;
    case 'document_issuance':
      return subject.assignmentId;
  }
}

/** Δείχνουν οι δύο στην **ίδια** υπόθεση; — ίδιο είδος **και** ίδιο κλειδί (άλλο είδος ⇒ ποτέ ίδια). */
export function isSameSubject(a: EngagementSubject, b: EngagementSubject): boolean {
  return a.kind === b.kind && subjectIdOf(a) === subjectIdOf(b);
}
