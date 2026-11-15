/**
 * =============================================================================
 * Μητρώο λήξεων — ΟΙ ΥΠΕΝΘΥΜΙΣΕΙΣ ΠΑΡΑΔΟΣΗΣ της ανάθεσης έκδοσης (ADR-915 §45 Φ3)
 * =============================================================================
 *
 * **«Η προθεσμία πλησιάζει ή πέρασε — να το θυμίσουμε στον επαγγελματία;»** Δύο δρόμοι, ένα ίχνος:
 * - **αυτόματος** (Vanta «due-date reminders»): η παραμονή της προθεσμίας · η επόμενη εργάσιμη · κάθε 5 εργάσιμες,
 *   το πολύ {@link ISSUANCE_DELIVERY_REMINDER_POLICY.maxAutomatic} για **κάθε** προθεσμία·
 * - **χειροκίνητος** (DocuSign «Remind»): ένα πάτημα του γραφείου, όχι δύο μέσα στην ίδια ημέρα.
 *
 * 🔑 **Προληπτικά, όπως η §31**: το `dueAt` γράφεται στην ανάθεση τη στιγμή που **γεννιέται** η προθεσμία (έγκριση της
 *    προσφοράς · ορισμός · αλλαγή — `withDeliveryReminderPlan`, από τον ΕΝΑ γραφέα)· η σάρωση απλώς ρωτά «ποιες οφείλονται;».
 * 🔑 **Το πρόγραμμα δένεται με ΜΙΑ προθεσμία** (`forDueOn`): νέα προθεσμία ⇒ νέο πρόγραμμα, και το παλιό δεν στέλνει τίποτα
 *    — υπενθύμιση με παλιά ημερομηνία θα ήταν ψέμα.
 * 🔑 **Τηλεμετρία, όχι στάδιο**: δεν περνά από τον μειωτή, δεν αλλάζει σε ποιον είναι η μπάλα.
 * 🔑 **Η ημέρα μετρά στην ώρα Ελλάδας**, με τις ελληνικές αργίες (`business-days`)· η ώρα αποστολής την ορίζουν οι ώρες
 *    γραφείου της §31 (`insideReminderHours`), που τις ξαναελέγχει η σάρωση.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O. Εισάγει από τον μειωτή **μόνο τύπους**.
 *
 * @module lib/document-validity/issuance-delivery-reminder
 */

import { addBusinessDays, shiftToBusinessDay } from '@/lib/calendar/business-days';
import { addDaysToDateKey } from '@/lib/calendar/date-key';
import { nextConveyanceDayStart } from '@/lib/conveyance/conveyance-calendar';

import type { IssuanceAssignmentRecord } from './issuance-assignment';
import { issuanceDeliveryOf, issuanceLatenessOf } from './issuance-delivery-due';
import { ISSUANCE_REMINDER_POLICY, type IssuanceReminders } from './issuance-reminder';
import { issuanceStageOf } from './issuance-stage';

const HOUR_MS = 60 * 60 * 1000;

/**
 * **Η πολιτική** — ΕΝΑ σημείο:
 * - `afterBusinessDays` 1 — η πρώτη υπενθύμιση **μετά** την προθεσμία, την επόμενη εργάσιμη·
 * - `repeatEveryBusinessDays` 5 — μετά, μία την εβδομάδα εργασίας·
 * - `maxAutomatic` 3 — μαζί με την παραμονή: παραμονή · +1 · +6 εργάσιμες. Ποτέ ατέρμονη ροή email·
 * - `manualMinGapHours` — ίδιο με τη §31: ποτέ δύο υπενθυμίσεις μέσα στην ίδια ημέρα, από όποιον δρόμο κι αν έρθουν·
 * - `maxManual` — αμυντικό φρένο του ιστορικού, όχι πολιτική.
 */
export const ISSUANCE_DELIVERY_REMINDER_POLICY = {
  afterBusinessDays: 1,
  repeatEveryBusinessDays: 5,
  maxAutomatic: 3,
  manualMinGapHours: ISSUANCE_REMINDER_POLICY.minGapHours,
  maxManual: 20,
} as const;

/** Μία χειροκίνητη υπενθύμιση — ποιος πάτησε και πότε (ο πάροχος τη δέχτηκε). */
export interface ManualDeliveryReminder {
  readonly at: string;
  readonly byUid: string;
}

/**
 * Οι υπενθυμίσεις παράδοσης της ανάθεσης. `dueAt` (από το {@link IssuanceReminders}) είναι και το πεδίο ερωτήματος της
 * σάρωσης· `sentAt` = οι **αυτόματες** για το `forDueOn`.
 */
export interface IssuanceDeliveryReminders extends IssuanceReminders {
  /** Η προθεσμία που υπηρετεί το αυτόματο πρόγραμμα· `null` = κανένα (π.χ. μόνο χειροκίνητες, χωρίς προθεσμία). */
  readonly forDueOn: string | null;
  readonly manual: readonly ManualDeliveryReminder[];
}

/** Η αρχή μιας ημέρας **στην Ελλάδα**, ως στιγμή ISO — ντετερμινιστικά, ανεξάρτητα από τη ζώνη του server. */
function athensDayStartIso(dayKey: string): string | null {
  const before = addDaysToDateKey(dayKey, -1);
  // Μεσημέρι UTC της προηγούμενης = απόγευμα στην Ελλάδα ⇒ η «επόμενη αρχή ημέρας» είναι τα μεσάνυχτα της `dayKey`.
  return before === null ? null : nextConveyanceDayStart(new Date(`${before}T12:00:00Z`)).toISOString();
}

/** Οι **ημέρες** του προγράμματος μιας προθεσμίας: παραμονή (προηγούμενη εργάσιμη) · +1 εργάσιμη · κάθε 5 εργάσιμες. */
export function deliveryReminderDays(dueOn: string): readonly string[] {
  const { afterBusinessDays, repeatEveryBusinessDays, maxAutomatic } = ISSUANCE_DELIVERY_REMINDER_POLICY;
  const dayBefore = addDaysToDateKey(dueOn, -1);
  const eve = dayBefore === null ? null : shiftToBusinessDay(dayBefore, 'previous_business_day');
  const days: string[] = eve === null ? [] : [eve];
  let next = addBusinessDays(dueOn, afterBusinessDays);
  while (days.length < maxAutomatic && next !== null) {
    days.push(next);
    next = addBusinessDays(next, repeatEveryBusinessDays);
  }
  return days;
}

/** Το πρόγραμμα ως στιγμές (αρχή κάθε ημέρας στην Ελλάδα), με σειρά. */
export function deliveryReminderSchedule(dueOn: string): readonly string[] {
  return deliveryReminderDays(dueOn).flatMap((day) => athensDayStartIso(day) ?? []);
}

/**
 * Η επόμενη αυτόματη, **μετά** το `nowIso` — `null` = εξαντλήθηκαν. Θέσεις που πέρασαν χωρίς αποστολή (π.χ. σύντομη
 * προθεσμία, ή σάρωση εκτός λειτουργίας) **δεν** στέλνονται καθυστερημένα κατά ριπές: πάμε στην επόμενη μελλοντική.
 */
function nextAutomaticAt(dueOn: string, sent: number, nowIso: string): string | null {
  if (sent >= ISSUANCE_DELIVERY_REMINDER_POLICY.maxAutomatic) return null;
  return deliveryReminderSchedule(dueOn).find((at) => at > nowIso) ?? null;
}

/**
 * **Το πρόγραμμα ακολουθεί την προθεσμία** — καλείται από τον ΕΝΑ γραφέα σε **κάθε** αλλαγή της ανάθεσης. Αναληφθείσα
 * ανάθεση με προθεσμία που **δεν** υπηρετείται ακόμη ⇒ νέο αυτόματο πρόγραμμα (οι χειροκίνητες μένουν — είναι ιστορία
 * της ανάθεσης, όχι της προθεσμίας). Αλλιώς η ανάθεση επιστρέφει **ίδια** (ιδεμποτές).
 */
export function withDeliveryReminderPlan(record: IssuanceAssignmentRecord, nowIso: string): IssuanceAssignmentRecord {
  if (issuanceStageOf(record) !== 'accepted') return record;
  const dueOn = issuanceDeliveryOf(record)?.dueOn ?? null;
  const current = record.deliveryReminders;
  if (dueOn === null || current?.forDueOn === dueOn) return record;
  return {
    ...record,
    deliveryReminders: { forDueOn: dueOn, dueAt: nextAutomaticAt(dueOn, 0, nowIso), sentAt: [], manual: current?.manual ?? [] },
  };
}

/** Η τελευταία υπενθύμιση παράδοσης, από **οποιονδήποτε** δρόμο — `null` = καμία. */
export function lastDeliveryReminderAt(reminders: IssuanceDeliveryReminders | null): string | null {
  if (reminders === null) return null;
  const all = [...reminders.sentAt, ...reminders.manual.map((entry) => entry.at)].sort();
  return all.at(-1) ?? null;
}

/** Μέσα στο κενό των `manualMinGapHours` από την τελευταία υπενθύμιση; */
function withinGap(reminders: IssuanceDeliveryReminders | null, nowIso: string): boolean {
  const last = lastDeliveryReminderAt(reminders);
  return last !== null && Date.parse(nowIso) - Date.parse(last) < ISSUANCE_DELIVERY_REMINDER_POLICY.manualMinGapHours * HOUR_MS;
}

/** **Μία αυτόματη έφυγε** — CAS στο `dueAt` που κρίθηκε· η επόμενη από το **ίδιο** πρόγραμμα. `null` = τίποτα να γραφτεί. */
export function withDeliveryReminderSent(record: IssuanceAssignmentRecord, expected: { readonly dueAt: string; readonly sentAt: string }): IssuanceAssignmentRecord | null {
  const reminders = record.deliveryReminders;
  if (reminders === null || reminders.dueAt !== expected.dueAt || reminders.forDueOn === null) return null;
  const sentAt = [...reminders.sentAt, expected.sentAt];
  return { ...record, deliveryReminders: { ...reminders, sentAt, dueAt: nextAutomaticAt(reminders.forDueOn, sentAt.length, expected.sentAt) } };
}

/** **Τέλος αυτόματων** για αυτή την προθεσμία — CAS στο `dueAt`. */
export function withDeliveryRemindersRetired(record: IssuanceAssignmentRecord, expectedDueAt: string): IssuanceAssignmentRecord | null {
  const reminders = record.deliveryReminders;
  if (reminders === null || reminders.dueAt !== expectedDueAt) return null;
  return { ...record, deliveryReminders: { ...reminders, dueAt: null } };
}

/**
 * Γιατί **δεν** στέλνεται χειροκίνητη:
 * - `too-soon` — άλλη υπενθύμιση (αυτόματη ή χειροκίνητη) μέσα στο κενό της ημέρας·
 * - `limit`    — γεμάτο ιστορικό (αμυντικό φρένο).
 */
export type ManualDeliveryReminderRefusal = 'too-soon' | 'limit';

/** Η κρίση **πριν** από το email — η ίδια ξανατρέχει στην καταγραφή (CAS), ώστε δύο πατήματα να μη γράψουν δύο. */
export function manualDeliveryReminderRefusal(reminders: IssuanceDeliveryReminders | null, nowIso: string): ManualDeliveryReminderRefusal | null {
  if (withinGap(reminders, nowIso)) return 'too-soon';
  return (reminders?.manual.length ?? 0) >= ISSUANCE_DELIVERY_REMINDER_POLICY.maxManual ? 'limit' : null;
}

/** **Μία χειροκίνητη έφυγε** — `null` αν στο μεταξύ η κρίση άλλαξε (άλλο πάτημα πρόλαβε). Το αυτόματο πρόγραμμα μένει. */
export function withManualDeliveryReminder(record: IssuanceAssignmentRecord, entry: ManualDeliveryReminder): IssuanceAssignmentRecord | null {
  const reminders = record.deliveryReminders;
  if (manualDeliveryReminderRefusal(reminders, entry.at) !== null) return null;
  const base: IssuanceDeliveryReminders = reminders ?? { forDueOn: null, dueAt: null, sentAt: [], manual: [] };
  return { ...record, deliveryReminders: { ...base, manual: [...base.manual, entry] } };
}

/** **Πότε** μιλά η υπενθύμιση σε σχέση με την προθεσμία — αλλάζει θέμα, επικεφαλίδα και εισαγωγή του email. */
export const DELIVERY_REMINDER_MOMENTS = ['upcoming', 'due-today', 'overdue', 'no-due-date'] as const;
export type DeliveryReminderMoment = (typeof DELIVERY_REMINDER_MOMENTS)[number];

/** Η στιγμή, από τη **μία** βαθμίδα καθυστέρησης (`issuanceLatenessOf`) — `today` = η ημέρα αποστολής στην Ελλάδα. */
export function deliveryReminderMomentOf(dueOn: string | null, today: string): DeliveryReminderMoment {
  const { tier } = issuanceLatenessOf(dueOn, today);
  return tier === 'due-soon' || tier === 'on-track' ? 'upcoming' : tier;
}

/** Γιατί σταματά το αυτόματο πρόγραμμα — ονομασμένο, για την αναφορά της σάρωσης. */
export type DeliveryReminderRetirement = 'closed' | 'due-changed';

export type DeliveryReminderVerdict =
  | { readonly kind: 'remind'; readonly dueAt: string; readonly dueOn: string }
  | { readonly kind: 'retire'; readonly dueAt: string; readonly reason: DeliveryReminderRetirement }
  | { readonly kind: 'wait' };

export interface DeliveryReminderCase {
  readonly reminders: IssuanceDeliveryReminders | null;
  /**
   * Η ανάθεση είναι **ακόμη** αναληφθείσα και ανοιχτή — η **ίδια** κρίση με την οθόνη (`issuanceStateOf` με το νεότερο
   * έγγραφο του μητρώου): ολοκληρωμένη · ακυρωμένη · αποσυρμένη ⇒ `false`.
   */
  readonly open: boolean;
  /** Η **τρέχουσα** προθεσμία (`issuanceDeliveryOf`) — `null` = καμία. */
  readonly dueOn: string | null;
  readonly nowIso: string;
}

/**
 * **Η κρίση** — καθαρή. Σειρά-συμβόλαιο: κλειστή → άλλη προθεσμία → πρόσφατη υπενθύμιση → ώρα. Τα δύο πρώτα
 * **αποσύρουν** (η σάρωση δεν ξαναβλέπει το πρόγραμμα)· η πρόσφατη χειροκίνητη απλώς **μεταθέτει** την αυτόματη.
 */
export function deliveryReminderVerdict(input: DeliveryReminderCase): DeliveryReminderVerdict {
  const dueAt = input.reminders?.dueAt ?? null;
  const forDueOn = input.reminders?.forDueOn ?? null;
  if (dueAt === null) return { kind: 'wait' };
  if (!input.open) return { kind: 'retire', dueAt, reason: 'closed' };
  if (forDueOn === null || input.dueOn !== forDueOn) return { kind: 'retire', dueAt, reason: 'due-changed' };
  if (withinGap(input.reminders, input.nowIso)) return { kind: 'wait' };
  return dueAt <= input.nowIso ? { kind: 'remind', dueAt, dueOn: forDueOn } : { kind: 'wait' };
}
