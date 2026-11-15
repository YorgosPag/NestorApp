/**
 * =============================================================================
 * Μητρώο λήξεων — Η ΠΡΟΘΕΣΜΙΑ ΠΑΡΑΔΟΣΗΣ της ανάθεσης έκδοσης και η ΚΑΘΥΣΤΕΡΗΣΗ (ADR-915 §45 Φ2)
 * =============================================================================
 *
 * **«Έως πότε; καθυστερεί; προλαβαίνει την υπογραφή;»** Η προθεσμία είναι **δέσμευση**, όχι εκτίμηση της εφαρμογής:
 * - ο επαγγελματίας γράφει «παράδοση σε N εργάσιμες» μέσα στην προσφορά, και ο υπεύθυνος εγκρίνει πρόσωπο + τιμή +
 *   χρόνο **μαζί** (§42 Π-1) ⇒ `dueOn` = N εργάσιμες από την ημέρα της έγκρισης, με ελληνικές αργίες·
 * - χωρίς δέσμευση (παλιά ανάθεση, προσφορά πριν από τη Φ2) την ημερομηνία την **ορίζει** το γραφείο·
 * - κάθε αλλαγή είναι **γεγονός** (`deliverySchedule`) με αιτιολογία — ποτέ σιωπηλή αντικατάσταση.
 *
 * 🔑 **Η τρέχουσα προθεσμία ΠΑΡΑΓΕΤΑΙ**: η νεότερη δέσμευση (έγκριση προσφοράς ή καταχώριση του γραφείου) κερδίζει. Νέα
 *    έγκριση μετά από αναθεώρηση της προσφοράς ⇒ νέα δέσμευση, χωρίς να σβηστεί το ίχνος.
 * 🔑 **Βαθμίδες όπως το Procore «My Open Items»**: καθυστερεί · λήγει σήμερα · λήγει σύντομα · εντός · χωρίς ημερομηνία.
 *    Τα όρια ζουν σε **ένα** `ISSUANCE_DELIVERY_POLICY`.
 * 🏆 **Πάνω από τους μεγάλους**: «δεν προλαβαίνει την υπογραφή» — η προθεσμία συγκρίνεται με την ημέρα που η συναλλαγή
 *    χρειάζεται το έγγραφο (`blockingDayOf`, §43), ήδη **πριν** από την έγκριση.
 * ⚠️ Κανένας επινοημένος «τυπικός χρόνος έκδοσης»: δεν βρέθηκε πηγή (§45.2) — τον χρόνο τον δεσμεύει ο επαγγελματίας.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O. Εισάγει από τον μειωτή **μόνο τύπους**.
 *
 * @module lib/document-validity/issuance-delivery-due
 */

import { addBusinessDays } from '@/lib/calendar/business-days';
import { daysBetweenDateKeys, isDateKey } from '@/lib/calendar/date-key';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';

import type { IssuanceAssignmentRecord, IssuanceReduction } from './issuance-assignment';
import { isQuoteDeliveryBusinessDays, type QuoteTerms } from './issuance-quote';
import type { IssuanceStage } from './issuance-stage';

/** Τα όρια — ΕΝΑ σημείο. `dueSoonDays`: ημερολογιακές ημέρες πριν από την προθεσμία που η γραμμή γίνεται κίτρινη. */
export const ISSUANCE_DELIVERY_POLICY = {
  dueSoonDays: 3,
  /** Αμυντικό φρένο του ιστορικού αλλαγών — όχι πολιτική. */
  maxScheduleEntries: 20,
} as const;

/** Μία καταχώριση προθεσμίας από το γραφείο — η πρώτη (χωρίς δέσμευση) ή αλλαγή (με αιτιολογία). */
export interface IssuanceDeliveryScheduleEntry {
  /** ISO ημέρα `YYYY-MM-DD`. */
  readonly dueOn: string;
  readonly reason: string | null;
  readonly at: string;
  readonly byUid: string;
}

/** Η πράξη του μειωτή: ορισμός ή αλλαγή της προθεσμίας (μόνο γραφείο, μόνο από `accepted`). */
export interface IssuanceScheduleDeliveryAction {
  readonly kind: 'schedule-delivery';
  readonly dueOn: string;
  readonly reason: string | null;
}

/** Από πού ήρθε η τρέχουσα προθεσμία: η εγκεκριμένη προσφορά · το γραφείο (πρώτη φορά) · αλλαγή. */
export const ISSUANCE_DUE_SOURCES = ['quote', 'office', 'rescheduled'] as const;
export type IssuanceDueSource = (typeof ISSUANCE_DUE_SOURCES)[number];

export interface IssuanceDueDate {
  readonly dueOn: string;
  readonly source: IssuanceDueSource;
  /** Πότε δεσμεύτηκε (ISO στιγμή): η έγκριση ή η καταχώριση. */
  readonly since: string;
  readonly reason: string | null;
}

/** «Παράδοση σε N εργάσιμες από την έγκριση» ⇒ η ημέρα — `null` χωρίς δέσμευση χρόνου. */
export function deliveryDueFromApproval(approvalDay: string, terms: Pick<QuoteTerms, 'deliveryBusinessDays'>): string | null {
  return isQuoteDeliveryBusinessDays(terms.deliveryBusinessDays) ? addBusinessDays(approvalDay, terms.deliveryBusinessDays) : null;
}

interface Commitment {
  readonly dueOn: string;
  readonly at: string;
  readonly fromQuote: boolean;
  readonly reason: string | null;
}

/** Η δέσμευση της εγκεκριμένης προσφοράς — μόνο αν η απόφαση κάλυψε **την τρέχουσα** αναθεώρηση (§42 Π-3). */
function quoteCommitmentOf(record: IssuanceAssignmentRecord): Commitment | null {
  const { decision, quote } = record;
  if (decision === null || decision.outcome !== 'approved' || quote === null || decision.quoteRevision !== quote.revision) return null;
  const dueOn = deliveryDueFromApproval(conveyanceToday(new Date(decision.at)), quote);
  return dueOn === null ? null : { dueOn, at: decision.at, fromQuote: true, reason: null };
}

/** **Η τρέχουσα προθεσμία** — η νεότερη δέσμευση. `null` = καμία (ούτε στην προσφορά ούτε από το γραφείο). */
export function issuanceDeliveryOf(record: IssuanceAssignmentRecord): IssuanceDueDate | null {
  const fromQuote = quoteCommitmentOf(record);
  const commitments: Commitment[] = [
    ...(fromQuote === null ? [] : [fromQuote]),
    ...record.deliverySchedule.map((entry) => ({ dueOn: entry.dueOn, at: entry.at, fromQuote: false, reason: entry.reason })),
  ];
  // Σταθερή ταξινόμηση: ίδια στιγμή ⇒ η σειρά καταγραφής (η προσφορά πρώτη, μετά το ιστορικό).
  commitments.sort((a, b) => a.at.localeCompare(b.at));
  const latest = commitments.at(-1);
  if (latest === undefined) return null;
  const source: IssuanceDueSource = latest.fromQuote ? 'quote' : commitments.length > 1 ? 'rescheduled' : 'office';
  return { dueOn: latest.dueOn, source, since: latest.at, reason: latest.reason };
}

/** Οι βαθμίδες καθυστέρησης (Procore), στη σειρά επείγοντος. */
export const ISSUANCE_LATENESS_TIERS = ['overdue', 'due-today', 'due-soon', 'on-track', 'no-due-date'] as const;
export type IssuanceLatenessTier = (typeof ISSUANCE_LATENESS_TIERS)[number];

export type IssuanceLateness =
  | { readonly tier: 'overdue'; readonly days: number }
  | { readonly tier: 'due-today' }
  | { readonly tier: 'due-soon'; readonly daysLeft: number }
  | { readonly tier: 'on-track'; readonly daysLeft: number }
  | { readonly tier: 'no-due-date' };

/** Η βαθμίδα **σήμερα** — `today` = το ρολόι της απόκρισης (`asOf`), ποτέ του πελάτη. Ημερολογιακές ημέρες. */
export function issuanceLatenessOf(dueOn: string | null, today: string): IssuanceLateness {
  const daysLeft = dueOn === null ? null : daysBetweenDateKeys(today, dueOn);
  if (daysLeft === null) return { tier: 'no-due-date' };
  if (daysLeft < 0) return { tier: 'overdue', days: -daysLeft };
  if (daysLeft === 0) return { tier: 'due-today' };
  return daysLeft <= ISSUANCE_DELIVERY_POLICY.dueSoonDays ? { tier: 'due-soon', daysLeft } : { tier: 'on-track', daysLeft };
}

/** 🏆 Α4 — η παράδοση πέφτει **μετά** την ημέρα που τη χρειάζεται η υπογραφή. `signingDay === null` ⇒ καμία σύγκρουση. */
export function deliveryMissesSigning(dueOn: string, signingDay: string | null): boolean {
  return signingDay !== null && dueOn > signingDay;
}

/** Ό,τι δείχνουν κελί, πάνελ και καρτέλα «Καθυστερούν» — από **έναν** κριτή. */
export interface IssuanceDeliveryStatus {
  readonly due: IssuanceDueDate | null;
  readonly lateness: IssuanceLateness;
  readonly missesSigning: boolean;
}

/**
 * Η προθεσμία **μετράει μόνο όσο η μπάλα είναι στον επαγγελματία μετά την ανάθεση** (`accepted`). Σε κάθε άλλο στάδιο
 * ⇒ `null`: πριν από την έγκριση δεν υπάρχει δέσμευση, και μετά την ολοκλήρωση η ανάθεση δεν είναι πια ανοιχτή.
 */
export function issuanceDeliveryStatusOf(
  stage: IssuanceStage,
  record: IssuanceAssignmentRecord,
  today: string,
  signingDay: string | null,
): IssuanceDeliveryStatus | null {
  if (stage !== 'accepted') return null;
  const due = issuanceDeliveryOf(record);
  return {
    due,
    lateness: issuanceLatenessOf(due?.dueOn ?? null, today),
    missesSigning: due !== null && deliveryMissesSigning(due.dueOn, signingDay),
  };
}

export function isIssuanceOverdue(status: IssuanceDeliveryStatus | null): boolean {
  return status?.lateness.tier === 'overdue';
}

/**
 * **Η κρίση της πράξης** `schedule-delivery` — ο έλεγχος σταδίου και actor έγινε ήδη στον μειωτή:
 * - άκυρη ημέρα, ή πριν από την πρόταση ⇒ `terms-refused`·
 * - ίδια με την τρέχουσα ⇒ `changed: false` (ιδεμποτές)·
 * - **αλλαγή** υπάρχουσας προθεσμίας χωρίς αιτιολογία ⇒ `terms-refused` (Α2: ποτέ σιωπηλή αντικατάσταση)·
 * - γεμάτο ιστορικό ⇒ `terms-refused`.
 */
export function scheduledDelivery(
  record: IssuanceAssignmentRecord,
  action: IssuanceScheduleDeliveryAction,
  uid: string,
  nowIso: string,
): IssuanceReduction {
  if (!isDateKey(action.dueOn) || action.dueOn < conveyanceToday(new Date(record.proposedAt))) return { ok: false, refusal: 'terms-refused' };
  const current = issuanceDeliveryOf(record);
  if (current?.dueOn === action.dueOn) return { ok: true, record, changed: false };
  if (current !== null && action.reason === null) return { ok: false, refusal: 'terms-refused' };
  if (record.deliverySchedule.length >= ISSUANCE_DELIVERY_POLICY.maxScheduleEntries) return { ok: false, refusal: 'terms-refused' };
  const entry: IssuanceDeliveryScheduleEntry = { dueOn: action.dueOn, reason: action.reason, at: nowIso, byUid: uid };
  return { ok: true, record: { ...record, deliverySchedule: [...record.deliverySchedule, entry] }, changed: true };
}
