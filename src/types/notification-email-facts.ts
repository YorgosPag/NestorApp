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

/** ADR-841 §7 Α21.21 Φάση Β — «Θα είστε ανοιχτά στις αργίες;» με απάντηση ενός κλικ. */
export interface HolidayQuestionFacts {
  readonly kind: 'holiday-hours-question';
  readonly questionId: string;
  readonly nonce: string;
}

/**
 * ADR-867 Β6 — **«έχεις αδιάβαστο μήνυμα»** (το missed-activity email του Teams · το «when I'm not
 * active» του Slack). Η πύλη αποστολής ρωτά τη στιγμή της αποστολής: *διάβασε το νήμα από το `since`
 * και μετά; το σίγασε; βγήκε από το ακροατήριο; λείπει;* — οποιοδήποτε «ναι» ⇒ **δεν** φεύγει.
 *
 * ⚠️ **Κανένα κείμενο μηνύματος εδώ, επίτηδες**: ανάκληση μέσα στο παράθυρο των 60′ (Β4β) δεν
 * επιτρέπεται να φτάσει σε εισερχόμενα email που ήδη περιμένει στην ουρά.
 */
export interface NetworkThreadUnreadFacts {
  readonly kind: 'network-thread-unread';
  readonly threadId: string;
  /** Η στιγμή του **πρώτου** αδιάβαστου μηνύματος αυτού του διαστήματος. */
  readonly since: string;
}

/** Κλειστό σύνολο — νέο είδος = νέο μέλος **και** κλάδος στον αναγνώστη και στην πύλη. */
export type NotificationEmailFacts = HolidayQuestionFacts | NetworkThreadUnreadFacts;

/** Ό,τι ταυτίζει **μία** ερώτηση ενός email — η πύλη αποστολής ρωτά «έχει ακόμη νόημα;» με αυτό. */
export type HolidayQuestionFactsRef = Pick<HolidayQuestionFacts, 'questionId' | 'nonce'>;

/** Ό,τι ταυτίζει **ένα** αδιάβαστο νήμα ενός ανθρώπου — η πύλη αποστολής ρωτά «εκκρεμεί ακόμη;». */
export interface NetworkUnreadRef {
  readonly threadId: string;
  readonly recipientUid: string;
  readonly since: string;
}

/** **Ένα κλειδί, δύο πλευρές** (φορτωτής ⇄ πύλη) — ίδιο σχήμα με το {@link holidayQuestionFactsKey}. */
export function networkUnreadKey(ref: NetworkUnreadRef): string {
  return `${ref.threadId}:${ref.recipientUid}:${ref.since}`;
}

/** **Ένα κλειδί, δύο πλευρές** (φορτωτής ⇄ πύλη): ταυτότητα **και** nonce — ερώτηση που ξαναεκδόθηκε δεν απαντά για την παλιά. */
export function holidayQuestionFactsKey(ref: HolidayQuestionFactsRef): string {
  return `${ref.questionId}:${ref.nonce}`;
}

/** **Ανεκτικός αναγνώστης** — παλιό έγγραφο της ουράς ή σκουπίδι ⇒ `undefined`, ποτέ σφάλμα (email χωρίς κουμπιά). */
export function readNotificationEmailFacts(raw: unknown): NotificationEmailFacts | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { kind, questionId, nonce, threadId, since } = raw as Record<string, unknown>;
  if (kind === 'holiday-hours-question') {
    return typeof questionId === 'string' && typeof nonce === 'string' ? { kind, questionId, nonce } : undefined;
  }
  if (kind === 'network-thread-unread') {
    return typeof threadId === 'string' && typeof since === 'string' ? { kind, threadId, since } : undefined;
  }
  return undefined;
}
