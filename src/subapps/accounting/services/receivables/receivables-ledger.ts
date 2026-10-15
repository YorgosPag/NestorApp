/**
 * @fileoverview Καθολικό απαιτήσεων — ανοιχτά στοιχεία σε ημερομηνία αναφοράς (SSoT)
 * @description «Τι μας οφείλει ο πελάτης στις `asOf`, και από πότε;» Καθαρές συναρτήσεις πάνω στα πρωτογενή
 *   παραστατικά: υπόλοιπο πελάτη, ηλικίωση, έλεγχος πιστωτικού ορίου, αναφορά ηλικίωσης — ΜΙΑ απάντηση για όλους.
 *
 * Πρακτική (ADR-ACC-010 §2.1.1 Φάση 3):
 * - **Διαχρονικό, όχι ανά χρήση** (SAP FI-AR open items · Xero / QuickBooks aged receivables): ένα απλήρωτο
 *   τιμολόγιο του Δεκεμβρίου οφείλεται και τον Ιανουάριο.
 * - **Κατά ημερομηνία από τα πρωτογενή**: ανοιχτό στις `asOf` = μικτό − πληρωμές ως τις `asOf` − πιστωτικά ως
 *   τις `asOf`. Το Xero ΔΕΝ το κάνει για παλιές ημερομηνίες (δείχνει τι ήταν ανοιχτό τότε μόνο αν δεν άλλαξε)·
 *   εδώ κάθε πληρωμή έχει ημερομηνία, άρα η εικόνα κάθε ημερομηνίας είναι ακριβής.
 * - **Πιστωτικό συμψηφίζεται με το τιμολόγιό του** (SAP «invoice reference» / Xero allocation) μέσω
 *   `relatedInvoiceId`, από την ημερομηνία έκδοσής του — υπολογιστικά, χωρίς να ξαναγράφεται φορολογικό
 *   παραστατικό. Ό,τι περισσεύει μένει **πίστωση υπέρ του πελάτη** (αρνητικό στοιχείο), όπως στο Xero.
 * - **Ακυρωμένο (void) = δεν εκδόθηκε ποτέ**· δεν μετρά πουθενά.
 * - Ταυτότητα που φυλά το test: Σ ηλικίωσης = καθαρό υπόλοιπο = τιμολογήθηκαν − πληρώθηκαν − πιστώθηκαν.
 *
 * @see ADR-ACC-010 §2.1.1 · DECISIONS-PHASE-1b.md Q1-Q4
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { daysBetweenDateKeys } from '@/lib/calendar/date-key';

import type { Invoice } from '../../types/invoice';
import type { AgingBuckets, ReceivablesPosition } from '../../types/customer-balance';
import { roundToTwo } from '../../utils/math';
import { isCreditNote, isVoidedInvoice } from '../../utils/invoice-open-amount';

/** Ένα ανοιχτό στοιχείο: θετικό = μας οφείλει, αρνητικό = πίστωση υπέρ του πελάτη. */
export interface OpenItem {
  readonly invoiceId: string;
  readonly kind: 'invoice' | 'credit';
  /** Από εδώ μετρά η ηλικίωση: λήξη· χωρίς λήξη, έκδοση. */
  readonly dueDate: string;
  readonly amount: number;
  readonly disputed: boolean;
}

interface MutableOpenItem {
  invoiceId: string;
  kind: 'invoice' | 'credit';
  dueDate: string;
  amount: number;
  disputed: boolean;
}

/** Η ημερολογιακή ημέρα ενός ISO πεδίου (`YYYY-MM-DD` ή πλήρες ISO). */
const dayOf = (iso: string): string => iso.slice(0, 10);

/**
 * Πληρωμές (ή, σε πιστωτικό, επιστροφές χρημάτων) ως και το `asOf`. Παλιά έγγραφα χωρίς `payments[]` αλλά με
 * `totalPaid` μετρούν το `totalPaid` — η ημερομηνία τους είναι άγνωστη, άρα θεωρούνται ήδη καταβεβλημένα.
 */
export function paidAsOf(invoice: Pick<Invoice, 'payments' | 'totalPaid'>, asOf: string): number {
  const payments = invoice.payments ?? [];
  if (payments.length === 0) return invoice.totalPaid ?? 0;
  return payments.reduce((sum, p) => (dayOf(p.date) <= asOf ? sum + p.amount : sum), 0);
}

/** Τα παραστατικά που υπάρχουν στις `asOf`: εκδόθηκαν ως τότε και δεν ακυρώθηκαν. */
function liveAsOf(invoices: readonly Invoice[], asOf: string): Invoice[] {
  return invoices.filter((inv) => !isVoidedInvoice(inv) && dayOf(inv.issueDate) <= asOf);
}

function chargeItem(invoice: Invoice, asOf: string): MutableOpenItem {
  return {
    invoiceId: invoice.invoiceId,
    kind: 'invoice',
    dueDate: dayOf(invoice.dueDate ?? invoice.issueDate),
    amount: roundToTwo(invoice.totalGrossAmount - paidAsOf(invoice, asOf)),
    disputed: invoice.isDisputed === true,
  };
}

/** Συμψηφίζει το πιστωτικό με το τιμολόγιό του (ως το ανοιχτό του)· επιστρέφει ό,τι περισσεύει ως πίστωση. */
function applyCreditNote(credit: Invoice, charges: Map<string, MutableOpenItem>, asOf: string): MutableOpenItem {
  let available = roundToTwo(credit.totalGrossAmount - paidAsOf(credit, asOf));
  const target = credit.relatedInvoiceId ? charges.get(credit.relatedInvoiceId) : undefined;
  if (target && target.amount > 0 && available > 0) {
    const applied = Math.min(available, target.amount);
    target.amount = roundToTwo(target.amount - applied);
    available = roundToTwo(available - applied);
  }
  return { invoiceId: credit.invoiceId, kind: 'credit', dueDate: dayOf(credit.issueDate), amount: -available, disputed: false };
}

/** Τα ανοιχτά στοιχεία (≠ 0) ενός συνόλου παραστατικών στις `asOf`. */
export function buildOpenItems(invoices: readonly Invoice[], asOf: string): OpenItem[] {
  const live = liveAsOf(invoices, asOf);
  const charges = new Map<string, MutableOpenItem>();
  for (const inv of live) if (!isCreditNote(inv)) charges.set(inv.invoiceId, chargeItem(inv, asOf));
  const credits = live.filter(isCreditNote).map((cn) => applyCreditNote(cn, charges, asOf));
  return [...charges.values(), ...credits].filter((item) => item.amount !== 0);
}

// ============================================================================
// AGING (Q2 — SAP S/4HANA 6 κάδοι)
// ============================================================================

const AGING_LIMITS: ReadonlyArray<readonly [keyof AgingBuckets, number]> = [
  ['current', 0],
  ['days1_30', 30],
  ['days31_60', 60],
  ['days61_90', 90],
  ['days91_120', 120],
  ['days120plus', Number.POSITIVE_INFINITY],
];

export function emptyAgingBuckets(): AgingBuckets {
  return { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days91_120: 0, days120plus: 0 };
}

/** Ημέρες καθυστέρησης στις `asOf` (≤ 0 = δεν έληξε) — ημερολογιακές, ανεξάρτητες ζώνης ώρας. */
export function daysOverdue(item: Pick<OpenItem, 'dueDate' | 'invoiceId'>, asOf: string): number {
  const days = daysBetweenDateKeys(item.dueDate, asOf);
  if (days === null) throw new Error(`Receivables: invalid due date ${item.dueDate} on ${item.invoiceId}`);
  return days;
}

export function agingBucketOf(overdueDays: number): keyof AgingBuckets {
  return (AGING_LIMITS.find(([, max]) => overdueDays <= max) ?? AGING_LIMITS[AGING_LIMITS.length - 1])[0];
}

/** Κατανομή σε κάδους. Οι πιστώσεις μπαίνουν (αρνητικές) στον κάδο της ημερομηνίας τους, όπως στο Xero. */
export function ageOpenItems(items: readonly OpenItem[], asOf: string): AgingBuckets {
  const buckets = emptyAgingBuckets();
  for (const item of items) {
    const bucket = agingBucketOf(daysOverdue(item, asOf));
    buckets[bucket] = roundToTwo(buckets[bucket] + item.amount);
  }
  return buckets;
}

export function sumAgingBuckets(all: readonly AgingBuckets[]): AgingBuckets {
  const total = emptyAgingBuckets();
  for (const buckets of all) {
    for (const [key] of AGING_LIMITS) total[key] = roundToTwo(total[key] + buckets[key]);
  }
  return total;
}

// ============================================================================
// POSITION
// ============================================================================

const sumAmounts = (items: readonly OpenItem[], keep: (item: OpenItem) => boolean): number =>
  roundToTwo(items.reduce((sum, item) => (keep(item) ? sum + item.amount : sum), 0));

function latestDay(days: readonly string[]): string | null {
  return days.reduce<string | null>((latest, d) => (latest === null || d > latest ? d : latest), null);
}

function lastPaymentDay(charges: readonly Invoice[], asOf: string): string | null {
  const days = charges.flatMap((inv) => (inv.payments ?? []).map((p) => dayOf(p.date)));
  return latestDay(days.filter((d) => d <= asOf));
}

/**
 * Η θέση απαιτήσεων ενός πελάτη στις `asOf`, από ΟΛΑ τα παραστατικά του (οποιασδήποτε χρήσης). Ο καλών
 * δίνει τα παραστατικά ΕΝΟΣ πελάτη (`groupInvoicesByCustomer` / σάρωση εμβέλειας `customer`).
 */
export function summarizeReceivables(
  customerId: string,
  invoices: readonly Invoice[],
  asOf: string
): ReceivablesPosition {
  const live = liveAsOf(invoices, asOf);
  const charges = live.filter((inv) => !isCreditNote(inv));
  const credits = live.filter(isCreditNote);
  const items = buildOpenItems(invoices, asOf);
  const owed = (item: OpenItem) => item.amount > 0;
  return {
    customerId,
    customerName: live[live.length - 1]?.customer?.name ?? '',
    totalInvoiced: roundToTwo(charges.reduce((s, inv) => s + inv.totalGrossAmount, 0)),
    totalPaid: roundToTwo(charges.reduce((s, inv) => s + paidAsOf(inv, asOf), 0)),
    totalCreditNotes: roundToTwo(credits.reduce((s, cn) => s + cn.totalGrossAmount - paidAsOf(cn, asOf), 0)),
    netBalance: sumAmounts(items, () => true),
    overdueBalance: sumAmounts(items, (item) => owed(item) && daysOverdue(item, asOf) > 0),
    aging: ageOpenItems(items, asOf),
    disputedBalance: sumAmounts(items, (item) => owed(item) && item.disputed),
    lastInvoiceDate: latestDay(charges.map((inv) => dayOf(inv.issueDate))),
    lastPaymentDate: lastPaymentDay(charges, asOf),
    invoiceCount: items.filter((item) => item.kind === 'invoice' && owed(item)).length,
    asOf,
  };
}

/** Ομαδοποίηση ανά πελάτη· όσα δεν έχουν `customer.contactId` δεν αποδίδονται σε λογαριασμό και μετρώνται. */
export function groupInvoicesByCustomer(invoices: readonly Invoice[]): {
  byCustomer: Map<string, Invoice[]>;
  unattributed: number;
} {
  const byCustomer = new Map<string, Invoice[]>();
  let unattributed = 0;
  for (const inv of invoices) {
    const customerId = inv.customer?.contactId;
    if (!customerId) {
      unattributed += 1;
      continue;
    }
    const list = byCustomer.get(customerId);
    if (list) list.push(inv);
    else byCustomer.set(customerId, [inv]);
  }
  return { byCustomer, unattributed };
}
