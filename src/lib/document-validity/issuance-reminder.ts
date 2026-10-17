/**
 * =============================================================================
 * Μητρώο λήξεων — ΟΙ ΥΠΕΝΘΥΜΙΣΕΙΣ των μηνυμάτων της ανάθεσης έκδοσης (ADR-915 §31)
 * =============================================================================
 *
 * **«Δεν απάντησε — να του το θυμίσουμε;»** Πρακτική DocuSign / Adobe Acrobat Sign: η πρώτη υπενθύμιση 72 ώρες μετά την
 * αποστολή, και μία ακόμη πριν λήξει ο σύνδεσμος. Τηλεμετρία του **μηνύματος**, όπως η παράδοση (`issuance-delivery.ts`):
 * δεν περνά από τον μειωτή και δεν αλλάζει σε ποιον είναι η μπάλα.
 *
 * 🔴 **Ποτέ αυτόματη ΠΡΩΤΗ αποστολή** (§18.5): το πρόγραμμα γεννιέται **μόνο** όταν ο αποστολέας αναφέρει ότι το χειροκίνητο
 *    μήνυμα του γραφείου **έφυγε** (`planIssuanceReminders`). Email που δεν έφυγε δεν έχει τι να υπενθυμίσει.
 * 🔴 **Ποτέ υπενθύμιση σε email που επέστρεψε ή σημάνθηκε ανεπιθύμητο** (`REMINDER_ALLOWED_AFTER`): η αναδίπλωση της
 *    παράδοσης (§30) είναι η πηγή — και μια επιστροφή της **ίδιας** της υπενθύμισης σταματά την επόμενη.
 * 🔑 **Προληπτικά, όχι υπολογισμένα στη σάρωση**: το `dueAt` γράφεται στο μήνυμα· η σάρωση απλώς ρωτά «ποιες οφείλονται;».
 *    Αλλαγή πολιτικής δεν ξαναγράφει την ιστορία των μηνυμάτων που ήδη έφυγαν.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { withMessage, type IssuanceAssignmentRecord } from './issuance-assignment';
import type { IssuanceDelivery, IssuanceDeliveryOutcome } from './issuance-delivery';

const HOUR_MS = 60 * 60 * 1000;

/**
 * **Η πολιτική** — μία δήλωση, δύο υπενθυμίσεις το πολύ:
 * - `firstAfterHours` 72 — DocuSign «3 ημέρες μετά» · Adobe «κάθε τρίτη ημέρα» μετρά από την παράδοση·
 * - `lastBeforeExpiryHours` 24 — «λήγει αύριο» (DocuSign: προειδοποίηση πριν τη λήξη)·
 * - `minGapHours` 24 — ποτέ δύο υπενθυμίσεις μέσα στην ίδια ημέρα·
 * - `minRemainingHours` 4 — υπενθύμιση για σύνδεσμο που λήγει σε λίγες ώρες είναι θόρυβος, όχι βοήθεια.
 */
export const ISSUANCE_REMINDER_POLICY = {
  firstAfterHours: 72,
  lastBeforeExpiryHours: 24,
  minGapHours: 24,
  minRemainingHours: 4,
  /**
   * **Ώρες γραφείου του παραλήπτη** (Δευτέρα–Παρασκευή, 09:00–19:00, ώρα Ελλάδας) — Adobe Sign «every business day». Η
   * υπενθύμιση ζητά ανθρώπινη ενέργεια· ένα email στις 23:00 θάβεται κάτω από την πρωινή αλληλογραφία. Το cron (ADR-740)
   * τρέχει μόνο μέσα σε αυτές τις ώρες· η σάρωση το **ξαναελέγχει**, γιατί ένα catch-up μετά από επανεκκίνηση δεν το ξέρει.
   */
  officeHours: { fromHour: 9, untilHour: 19, weekdays: [1, 2, 3, 4, 5] },
} as const;

/** Μέσα στις ώρες γραφείου; — από τα **τοπικά** μέρη της στιγμής (ο καλών τα παράγει στη ζώνη, ποτέ με `getHours()`). */
export function insideReminderHours(local: { readonly hour: number; readonly weekday: number }): boolean {
  const { fromHour, untilHour, weekdays } = ISSUANCE_REMINDER_POLICY.officeHours;
  return (weekdays as readonly number[]).includes(local.weekday) && local.hour >= fromHour && local.hour < untilHour;
}

/**
 * **Επιτρέπεται να ξαναγράψουμε σε αυτή τη διεύθυνση;** — ανά τιμή του κλειστού λεξιλογίου (CHECK 3.73). Μόνο ό,τι
 * **έφυγε** και **δεν** απορρίφθηκε: το `complained` σημαίνει ότι το έλαβε **και** δεν το θέλει (GDPR · φήμη αποστολέα).
 */
export const REMINDER_ALLOWED_AFTER: Readonly<Record<IssuanceDeliveryOutcome, boolean>> = {
  accepted: true, delivered: true, failed: false, unaddressable: false, bounced: false, complained: false,
};

/** Οι υπενθυμίσεις ενός μηνύματος — `dueAt` είναι και το πεδίο ερωτήματος της σάρωσης (`null` = καμία άλλη). */
export interface IssuanceReminders {
  readonly dueAt: string | null;
  /** Πότε έφυγε κάθε υπενθύμιση που ο πάροχος δέχτηκε — με σειρά. */
  readonly sentAt: readonly string[];
}

/** **Το πρόγραμμα** ενός μηνύματος — ντετερμινιστικό από το πότε στάλθηκε και πότε λήγει ο σύνδεσμος. */
export function issuanceReminderSchedule(messageAt: string, expiresAt: string): readonly string[] {
  const { firstAfterHours, lastBeforeExpiryHours, minGapHours, minRemainingHours } = ISSUANCE_REMINDER_POLICY;
  const expiresMs = Date.parse(expiresAt);
  const candidates = [Date.parse(messageAt) + firstAfterHours * HOUR_MS, expiresMs - lastBeforeExpiryHours * HOUR_MS];
  const schedule: number[] = [];
  for (const at of candidates) {
    const previous = schedule.at(-1) ?? Date.parse(messageAt);
    if (at - previous >= minGapHours * HOUR_MS && expiresMs - at >= minRemainingHours * HOUR_MS) schedule.push(at);
  }
  return schedule.map((at) => new Date(at).toISOString());
}

/** Η επόμενη οφειλόμενη, μετά από `sent` υπενθυμίσεις — `null` = εξαντλήθηκαν. */
function nextDueAt(schedule: readonly string[], sent: number): string | null {
  return schedule[sent] ?? null;
}

/**
 * **Το πρόγραμμα ξεκινά** — μόνο στο μήνυμα με αυτό το `invitationId`, μόνο αν το μήνυμα **έφυγε** (`delivery`), και μόνο
 * μία φορά: ένα δεύτερο αίτημα δεν ξαναγράφει υπενθυμίσεις που ήδη τρέχουν. `null` = τίποτα να γραφτεί.
 */
export function planIssuanceReminders(record: IssuanceAssignmentRecord, invitationId: string, expiresAt: string): IssuanceAssignmentRecord | null {
  return withMessage(record, invitationId, (message) => {
    if (message.reminders !== null || message.delivery === null || !REMINDER_ALLOWED_AFTER[message.delivery.recipient]) return null;
    const dueAt = nextDueAt(issuanceReminderSchedule(message.at, expiresAt), 0);
    return dueAt === null ? null : { ...message, reminders: { dueAt, sentAt: [] } };
  });
}

/** **Μία υπενθύμιση έφυγε** — CAS στο `dueAt` που κρίθηκε· το επόμενο από το **ίδιο** πρόγραμμα. */
export function withIssuanceReminderSent(record: IssuanceAssignmentRecord, invitationId: string, expected: { readonly dueAt: string; readonly sentAt: string; readonly expiresAt: string }): IssuanceAssignmentRecord | null {
  return withMessage(record, invitationId, (message) => {
    if (message.reminders?.dueAt !== expected.dueAt) return null;
    const sentAt = [...message.reminders.sentAt, expected.sentAt];
    return { ...message, reminders: { dueAt: nextDueAt(issuanceReminderSchedule(message.at, expected.expiresAt), sentAt.length), sentAt } };
  });
}

/** **Τέλος υπενθυμίσεων** για αυτό το μήνυμα (απαντήθηκε · αντικαταστάθηκε · επέστρεψε…) — CAS στο `dueAt`. */
export function withIssuanceRemindersRetired(record: IssuanceAssignmentRecord, invitationId: string, expectedDueAt: string): IssuanceAssignmentRecord | null {
  return withMessage(record, invitationId, (message) => (
    message.reminders?.dueAt !== expectedDueAt ? null : { ...message, reminders: { ...message.reminders, dueAt: null } }
  ));
}

/** Γιατί **δεν** στέλνεται άλλη υπενθύμιση — ονομασμένο, για την αναφορά της σάρωσης. */
export type ReminderRetirement = 'link-closed' | 'delivery' | 'expiring';

export type IssuanceReminderVerdict =
  | { readonly kind: 'remind'; readonly dueAt: string }
  | { readonly kind: 'retire'; readonly dueAt: string; readonly reason: ReminderRetirement }
  | { readonly kind: 'wait' };

export interface IssuanceReminderCase {
  readonly reminders: IssuanceReminders | null;
  readonly delivery: IssuanceDelivery | null;
  /** Ο σύνδεσμος θα απαντούσε ακόμη; — η **ίδια** κρίση με τη σελίδα του συνδέσμου (`false` = κλειστός, για οποιονδήποτε λόγο). */
  readonly linkOpen: boolean;
  readonly expiresAt: string;
  readonly nowIso: string;
}

/**
 * **Η κρίση** — καθαρή, ώστε να ασκείται χωρίς βάση. Η σειρά είναι συμβόλαιο: κλειστός σύνδεσμος → παράδοση → λήξη → ώρα.
 * Ένα «όχι» από τα τρία πρώτα **αποσύρει** το πρόγραμμα (η σάρωση δεν το ξαναβλέπει)· το «όχι ακόμη» απλώς περιμένει.
 */
export function issuanceReminderVerdict(input: IssuanceReminderCase): IssuanceReminderVerdict {
  const dueAt = input.reminders?.dueAt ?? null;
  if (dueAt === null) return { kind: 'wait' };
  if (!input.linkOpen) return { kind: 'retire', dueAt, reason: 'link-closed' };
  if (input.delivery === null || !REMINDER_ALLOWED_AFTER[input.delivery.recipient]) return { kind: 'retire', dueAt, reason: 'delivery' };
  const nowMs = Date.parse(input.nowIso);
  if (Date.parse(input.expiresAt) - nowMs < ISSUANCE_REMINDER_POLICY.minRemainingHours * HOUR_MS) return { kind: 'retire', dueAt, reason: 'expiring' };
  return Date.parse(dueAt) <= nowMs ? { kind: 'remind', dueAt } : { kind: 'wait' };
}
