/**
 * @fileoverview **ΕΙΝΑΙ ΓΡΑΜΜΕΝΗ Η ΤΑΜΠΕΛΑ;** — η κρίση των στοιχείων του φορέα (ADR-861 Φ1).
 * @module lib/platform-operator/operator-readiness
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΧΩΡΙΣΤΑ ΑΠΟ ΤΗ ΡΙΖΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ρίζα (`constants/platform-operator.ts`) έχει **μηδέν εισαγωγές**. Η κρίση χρειάζεται τους
 * **υπάρχοντες** κριτές — ΑΦΜ (`greek-vat-number`) · ΓΕΜΗ (`gemi-number`) · email
 * (`email-validation`) · Τ.Κ. (`postal-code`) — και **δεν** ξαναγράφει κανέναν. Όλοι καθαροί:
 * η κρίση τρέχει στην εκκίνηση του διακομιστή, όπου client SDK δεν επιτρέπεται να αρχικοποιηθεί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΚΡΙΝΟΝΤΑΙ Ο ΤΡΕΧΩΝ ΚΑΙ ΟΙ ΜΕΛΛΟΝΤΙΚΟΙ — ΟΧΙ ΜΟΝΟ «ΣΗΜΕΡΑ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η εκκίνηση γίνεται **μία** φορά, και ο διακομιστής μπορεί να μείνει όρθιος εβδομάδες. Μια
 * προγραμματισμένη μεταβίβαση με άκυρο ΑΦΜ θα γινόταν «τρέχουσα» χωρίς επανεκκίνηση, δηλαδή
 * άγραφη ταμπέλα **χωρίς κανέναν έλεγχο**. Γι' αυτό κάθε γραμμή από τον τρέχοντα και μετά κρίνεται
 * **τώρα**. Οι παλιές γραμμές δεν κρίνονται για περιεχόμενο — είναι ό,τι δημοσιεύτηκε — μόνο για **σειρά**.
 *
 * ⚠️ **Καμία τιμή του φορέα δεν φτάνει ποτέ στο ημερολόγιο**: μόνο ονόματα ελαττωμάτων και ημερομηνίες.
 *
 * **Layering**: καθαρή — δοκιμάσιμη χωρίς δίκτυο, δίσκο ή ρολόι (η στιγμή είναι **όρισμα**).
 */

import {
  PLATFORM_OPERATORS,
  calendarDayOf,
  operatorOn,
  type CalendarDay,
  type OperatorIdentity,
  type OperatorMailbox,
  type OperatorRecord,
  type OperatorSeat,
} from '@/constants/platform-operator';
import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { isValidEmail } from '@/lib/validation/email-validation';
import { isValidGreekVat } from '@/lib/validation/greek-vat-number';
import { isValidGreekPostalCode } from '@/utils/address/postal-code';

/** Κάθε λόγος για τον οποίο μια γραμμή **δεν** είναι γραμμένη ταμπέλα. Ονομασμένος, ποτέ boolean. */
export type OperatorDefect =
  | 'effective-date-malformed'
  | 'history-out-of-order'
  | 'name-missing'
  | 'legal-form-missing'
  | 'seat-incomplete'
  | 'seat-country-unsupported'
  | 'postal-code-invalid'
  | 'vat-invalid'
  | 'gemi-invalid'
  | 'contact-email-invalid'
  | 'privacy-email-invalid'
  | 'contact-mailbox-unconfirmed'
  | 'privacy-mailbox-unconfirmed';

/** Τα ελαττώματα **μίας** γραμμής, με την ημερομηνία της ως ταυτότητα. */
export interface RecordProblem {
  readonly effectiveFrom: CalendarDay;
  readonly defects: readonly OperatorDefect[];
}

/** Η απάντηση στο «μπορεί η εφαρμογή να ανοίξει στο κοινό **σήμερα**;». */
export type LaunchReadiness =
  | { readonly status: 'ready'; readonly day: CalendarDay; readonly record: OperatorRecord }
  | { readonly status: 'pending'; readonly day: CalendarDay }
  | { readonly status: 'incomplete'; readonly day: CalendarDay; readonly problems: readonly RecordProblem[] };

const CALENDAR_DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** Υπαρκτή ημερολογιακή μέρα; — το σχήμα **και** η ύπαρξη (`2026-02-30` δεν υπάρχει). */
function isCalendarDay(value: string): boolean {
  if (!CALENDAR_DAY_SHAPE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const blank = (value: string): boolean => value.trim().length === 0;

function identityDefects(identity: OperatorIdentity): OperatorDefect[] {
  if (identity.kind === 'natural-person') return blank(identity.fullName) ? ['name-missing'] : [];
  const defects: OperatorDefect[] = [];
  if (blank(identity.legalName)) defects.push('name-missing');
  if (blank(identity.legalForm)) defects.push('legal-form-missing');
  return defects;
}

/**
 * ⚠️ **Μόνο ελληνική έδρα κρίνεται σήμερα.** ΑΦΜ και Τ.Κ. έχουν ελληνικούς κριτές· ξένη έδρα
 * απορρίπτεται **ρητά** (`seat-country-unsupported`) αντί να περάσει ανέλεγκτη.
 */
function seatDefects(seat: OperatorSeat): OperatorDefect[] {
  const defects: OperatorDefect[] = [];
  if ([seat.street, seat.number, seat.postalCode, seat.city].some(blank)) defects.push('seat-incomplete');
  if (seat.country !== 'GR') return [...defects, 'seat-country-unsupported'];
  if (!blank(seat.postalCode) && !isValidGreekPostalCode(seat.postalCode)) defects.push('postal-code-invalid');
  return defects;
}

/** Τα δύο ονόματα ελαττώματος ανά ρόλο — ρητά, ώστε ο τύπος να μην εξαρτάται από συμπερασμό template literal. */
const MAILBOX_DEFECTS = {
  contact: { invalid: 'contact-email-invalid', unconfirmed: 'contact-mailbox-unconfirmed' },
  privacy: { invalid: 'privacy-email-invalid', unconfirmed: 'privacy-mailbox-unconfirmed' },
} as const satisfies Record<'contact' | 'privacy', { invalid: OperatorDefect; unconfirmed: OperatorDefect }>;

/**
 * **Διαβάζει άνθρωπος αυτή τη διεύθυνση τη μέρα `day`;** — υπαρκτή μέρα επιβεβαίωσης **που έχει ήδη
 * έρθει**, σε έγκυρη διεύθυνση. Επιβεβαίωση «από το μέλλον» δεν είναι απόδειξη.
 *
 * 🔑 **ΕΝΑΣ κανόνας, δύο καταναλωτές** (ADR-861 Φ2): η άρνηση δημόσιου ανοίγματος (εδώ) **και** η
 * σελίδα που δείχνει τη διεύθυνση (`operator-presentation.ts`). Δεν μπορούν να διαφωνήσουν.
 */
export function isMailboxConfirmed(mailbox: OperatorMailbox, day: CalendarDay): boolean {
  return isValidEmail(mailbox.address) && receivingConfirmed(mailbox, day);
}

/** Μόνο το σκέλος της ημερομηνίας — ώστε τα δύο ελαττώματα να ονομάζονται **ανεξάρτητα**. */
function receivingConfirmed(mailbox: OperatorMailbox, day: CalendarDay): boolean {
  const confirmed = mailbox.receivingConfirmedOn;
  return confirmed !== null && isCalendarDay(confirmed) && confirmed <= day;
}

function mailboxDefects(mailbox: OperatorMailbox, role: keyof typeof MAILBOX_DEFECTS, day: CalendarDay): OperatorDefect[] {
  const defects: OperatorDefect[] = [];
  if (!isValidEmail(mailbox.address)) defects.push(MAILBOX_DEFECTS[role].invalid);
  if (!receivingConfirmed(mailbox, day)) defects.push(MAILBOX_DEFECTS[role].unconfirmed);
  return defects;
}

/** Όλα τα ελαττώματα περιεχομένου μίας γραμμής, κρινόμενης τη μέρα `day`. */
export function operatorRecordDefects(record: OperatorRecord, day: CalendarDay): readonly OperatorDefect[] {
  const defects: OperatorDefect[] = [];
  if (!isCalendarDay(record.effectiveFrom)) defects.push('effective-date-malformed');
  defects.push(...identityDefects(record.identity), ...seatDefects(record.seat));
  if (!isValidGreekVat(record.vatNumber)) defects.push('vat-invalid');
  if (record.gemiNumber !== null && canonicalGemiNumber(record.gemiNumber) === null) defects.push('gemi-invalid');
  defects.push(...mailboxDefects(record.contact, 'contact', day), ...mailboxDefects(record.privacy, 'privacy', day));
  return defects;
}

/** Οι γραμμές που **σπάνε** τη σειρά του ιστορικού (append-only ⇒ αυστηρά αύξουσες ημερομηνίες). */
function outOfOrder(history: readonly OperatorRecord[]): ReadonlySet<OperatorRecord> {
  const broken = new Set<OperatorRecord>();
  for (let i = 1; i < history.length; i++) {
    if (history[i].effectiveFrom <= history[i - 1].effectiveFrom) broken.add(history[i]);
  }
  return broken;
}

/**
 * **Μπορεί η εφαρμογή να ανοίξει στο κοινό τη στιγμή `now`;**
 *
 * `pending` ⇒ κανένας φορέας δεν ισχύει. `incomplete` ⇒ ο τρέχων **ή** κάποιος μελλοντικός έχει
 * ελάττωμα, **ή** το ιστορικό δεν είναι αύξον. `ready` ⇒ τίποτα από τα παραπάνω.
 */
export function judgeLaunchReadiness(
  now: Date = new Date(),
  history: readonly OperatorRecord[] = PLATFORM_OPERATORS,
): LaunchReadiness {
  const day = calendarDayOf(now);
  const standing = operatorOn(day, history);
  if (standing.kind === 'pending') return { status: 'pending', day };

  const broken = outOfOrder(history);
  const problems: RecordProblem[] = [];
  for (const record of history) {
    const judged = record.effectiveFrom >= standing.record.effectiveFrom;
    const defects = [
      ...(judged ? operatorRecordDefects(record, day) : []),
      ...(broken.has(record) ? (['history-out-of-order'] as const) : []),
    ];
    if (defects.length > 0) problems.push({ effectiveFrom: record.effectiveFrom, defects });
  }
  return problems.length === 0
    ? { status: 'ready', day, record: standing.record }
    : { status: 'incomplete', day, problems };
}

/** Μία γραμμή ημερολογίου ανά πρόβλημα — **ονόματα και ημερομηνίες, ποτέ τιμές**. */
export function describeReadiness(readiness: LaunchReadiness): readonly string[] {
  if (readiness.status === 'ready') return [];
  if (readiness.status === 'pending') return [`no operator in effect on ${readiness.day}`];
  return readiness.problems.map((p) => `record from ${p.effectiveFrom}: ${p.defects.join(', ')}`);
}
