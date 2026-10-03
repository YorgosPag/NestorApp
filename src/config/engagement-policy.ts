/**
 * Πολιτική λήξης συμμετοχής σε υπόθεση (ADR-862 §5.3.3 · ADR-901 §5.3/§5.7).
 *
 * 🔑 Η λήξη **παράγεται** από αυτούς τους αριθμούς — **ποτέ** πληκτρολογείται ανά έγγραφο.
 *
 * - **Πρόταση** (`offered`): 14 ημέρες για «Αναλαμβάνω» — ✅ ADR-901 Ε-5 (ο επαγγελματίας λείπει συχνά
 *   στα δικαστήρια). Ίδιος αριθμός με τη λήξη της πρόσκλησης, γιατί είναι η **ίδια** απόφαση.
 * - **Ενεργή** (`active`): η **κύρια** λήξη είναι το κλείσιμο/ακύρωση της υπόθεσης (⇒ `completed`).
 *   Το ταβάνι εδώ είναι **δίχτυ ασφαλείας** (N.7.2 #4): υπόθεση που ξεχάστηκε ανοιχτή δεν κρατά
 *   ζωντανή την πρόσβαση ενός ξένου για πάντα. ⛔ ΜΗΝ το διαβάσεις ως «περίοδο χάριτος» μετά την
 *   ανάκληση — η ανάκληση είναι **άμεση** (ADR-787 Ε-2 §5).
 *
 * @module config/engagement-policy
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const ENGAGEMENT_OFFER_TTL_DAYS = 14;
export const ENGAGEMENT_ACTIVE_CEILING_DAYS = 365;

/** Η λήξη μιας **πρότασης** που γίνεται τη στιγμή `nowMs`. */
export function offerExpiresAt(nowMs: number): string {
  return new Date(engagementInvitationExpiryMs(nowMs)).toISOString();
}

/** Το ταβάνι μιας **ενεργής** συμμετοχής που αποδέχτηκε κάποιος τη στιγμή `nowMs`. */
export function activeExpiresAt(nowMs: number): string {
  return new Date(nowMs + ENGAGEMENT_ACTIVE_CEILING_DAYS * DAY_MS).toISOString();
}

/**
 * ADR-901 Ε-5 — αν ο επαγγελματίας δεν απαντήσει σε **3** ημέρες, υπενθυμίζεται **ο προσκαλών** (όχι ο
 * επαγγελματίας: ο οικοδεσπότης ξέρει αν πρέπει να τηλεφωνήσει, να ξαναστείλει ή να ορίσει άλλον).
 */
export const ENGAGEMENT_INVITATION_REMINDER_DAYS = 3;

/** Η λήξη μιας **πρόσκλησης** με email — ο **ίδιος** αριθμός με την πρόταση (μία απόφαση, Ε-5). */
export function engagementInvitationExpiryMs(nowMs: number): number {
  return nowMs + ENGAGEMENT_OFFER_TTL_DAYS * DAY_MS;
}

/** Πότε οφείλεται η υπενθύμιση στον προσκαλούντα — γράφεται **στην έκδοση**, ποτέ υπολογίζεται στο sweep. */
export function engagementInvitationReminderDueAt(nowMs: number): string {
  return new Date(nowMs + ENGAGEMENT_INVITATION_REMINDER_DAYS * DAY_MS).toISOString();
}
