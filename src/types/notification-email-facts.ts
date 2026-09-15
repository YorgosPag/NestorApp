/**
 * @fileoverview **ΓΕΓΟΝΟΤΑ ΤΟΥ EMAIL ΜΙΑΣ ΕΙΔΟΠΟΙΗΣΗΣ, ΟΧΙ URL** — ό,τι χρειάζεται ο αποστολέας για κουμπιά ενέργειας
 *   (ADR-841 §7 Α21.21 Φάση Β · ADR-848).
 * @related server/notifications/notification-email-leg.ts (γράφει στην ουρά) ·
 *   server/notifications/notification-email-actions.ts (υπογράφει τη στιγμή της αποστολής)
 * @module types/notification-email-facts
 *
 * 🔑 **Η ουρά κρατά ΓΕΓΟΝΟΤΑ, όχι URL** (δόγμα `notification-email-envelope`): ένα μήνυμα που περιμένει το παράθυρο των
 * 20:00 δεν κουβαλά σύνδεσμο με origin ή μυστικό που ίσως άλλαξαν ως τότε. Κλειστό σύνολο ειδών — νέο είδος = νέα γραμμή
 * εδώ **και** στον αποδότη, αλλιώς ο μεταγλωττιστής αρνείται.
 *
 * **Layering**: leaf — καθαροί τύποι.
 */

export type NotificationEmailFacts = {
  /** ADR-841 §7 Α21.21 Φάση Β — «Θα είστε ανοιχτά στις αργίες;» με απάντηση ενός κλικ. */
  readonly kind: 'holiday-hours-question';
  readonly questionId: string;
  readonly nonce: string;
};

/** Ό,τι ταυτίζει **μία** ερώτηση ενός email — η πύλη αποστολής ρωτά «έχει ακόμη νόημα;» με αυτό. */
export type HolidayQuestionFactsRef = Pick<NotificationEmailFacts, 'questionId' | 'nonce'>;

/** **Ένα κλειδί, δύο πλευρές** (φορτωτής ⇄ πύλη): ταυτότητα **και** nonce — ερώτηση που ξαναεκδόθηκε δεν απαντά για την παλιά. */
export function holidayQuestionFactsKey(ref: HolidayQuestionFactsRef): string {
  return `${ref.questionId}:${ref.nonce}`;
}

/** **Ανεκτικός αναγνώστης** — παλιό έγγραφο της ουράς ή σκουπίδι ⇒ `undefined`, ποτέ σφάλμα (email χωρίς κουμπιά). */
export function readNotificationEmailFacts(raw: unknown): NotificationEmailFacts | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { kind, questionId, nonce } = raw as Record<string, unknown>;
  return kind === 'holiday-hours-question' && typeof questionId === 'string' && typeof nonce === 'string'
    ? { kind, questionId, nonce }
    : undefined;
}
