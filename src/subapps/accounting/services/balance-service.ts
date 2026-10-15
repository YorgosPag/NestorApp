/**
 * @fileoverview Customer Balance Service — Hybrid Stored + Reconciliation
 * @description Event-driven balance updates + full recalculation + credit limit checks
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-29
 * @see DECISIONS-PHASE-1b.md Q1-Q4
 * @see ADR-ACC-010 §2.1.1 (Φάση 3, 2026-10-15) — ανοιχτά στοιχεία όλων των χρήσεων σε ημερομηνία αναφοράς
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 *
 * 🔴 Ως 2026-10-15 το υπόλοιπο ήταν «ανά χρήση» από τη ΣΕΛΙΔΑ `listInvoices(…, 1000)`, με ερώτημα χωρίς δείκτη
 *   (σφάλμα ⇒ «κανένα τιμολόγιο» ⇒ υπόλοιπο 0 € που ΓΡΑΦΟΤΑΝ), σε έγγραφο με κλειδί μόνο τον πελάτη (κάθε
 *   χρήση έσβηνε την άλλη), μετρώντας ακυρωμένα τιμολόγια και αφήνοντας το πιστωτικό σε άλλη χρήση από το
 *   τιμολόγιό του. Ο υπολογισμός ζει πλέον στο SSoT `receivables/receivables-ledger.ts`.
 */

import { chunkArray } from '@/lib/array-utils';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';

import type { IAccountingRepository } from '../types/interfaces';
import type { CustomerBalance, CreditCheckResult, ReceivablesPosition } from '../types/customer-balance';
import { accountingToday } from '../utils/accounting-day';
import { roundToTwo } from '../utils/math';
import { isoNow } from './repository/firestore-helpers';
import { groupInvoicesByCustomer, summarizeReceivables } from './receivables/receivables-ledger';

type BalanceRepository = Pick<
  IAccountingRepository,
  'collectInvoices' | 'getCustomerBalance' | 'upsertCustomerBalance' | 'listCustomerBalances'
>;

const logger = createModuleLogger('CUSTOMER_BALANCE');

/** Υπέρβαση πάνω από 1 λεπτό ⇒ διόρθωση (το αποθηκευμένο είχε αποκλίνει από τα παραστατικά). */
const RECONCILE_TOLERANCE = 0.01;

/** Θέση από τα παραστατικά + οι ρυθμίσεις πίστωσης του αποθηκευμένου (δεν τις παράγει ο υπολογισμός). */
function mergeWithCreditSettings(
  position: ReceivablesPosition,
  existing: CustomerBalance | null
): CustomerBalance {
  return {
    ...position,
    customerName: position.customerName || existing?.customerName || '',
    creditLimit: existing?.creditLimit ?? null,
    creditHoldRule: existing?.creditHoldRule ?? 'off',
    creditHoldActive: existing?.creditHoldActive ?? false,
    riskClass: existing?.riskClass ?? 'low',
    nextReviewDate: existing?.nextReviewDate ?? null,
    updatedAt: isoNow(),
  };
}

// ============================================================================
// COMPUTE (read-only) / RECALCULATE (compute + store)
// ============================================================================

/**
 * Το υπόλοιπο του πελάτη στις `asOf` (προεπιλογή: σήμερα, Αθήνα) από ΟΛΑ τα παραστατικά του — χωρίς εγγραφή.
 * Πετά αν η σάρωση αποτύχει: ποτέ «0» από σφάλμα.
 */
export async function computeCustomerBalance(
  repository: Pick<BalanceRepository, 'collectInvoices' | 'getCustomerBalance'>,
  customerId: string,
  asOf: string = accountingToday()
): Promise<CustomerBalance> {
  const [invoices, existing] = await Promise.all([
    repository.collectInvoices({ scope: { kind: 'customer', customerId, asOf } }),
    repository.getCustomerBalance(customerId),
  ]);
  return mergeWithCreditSettings(summarizeReceivables(customerId, invoices, asOf), existing);
}

/**
 * Ενημέρωση μετά από αλλαγή τιμολογίου / πληρωμής / πιστωτικού (Q4 — σύγχρονα): πλήρης επανυπολογισμός από τα
 * παραστατικά και αποθήκευση. Σε σφάλμα ΔΕΝ γράφει τίποτα — το αποθηκευμένο μένει ως είχε ως την επόμενη συμφωνία.
 */
async function updateCustomerBalance(
  repository: BalanceRepository,
  customerId: string
): Promise<CustomerBalance> {
  const balance = await computeCustomerBalance(repository, customerId);
  await repository.upsertCustomerBalance(customerId, balance);
  return balance;
}

/**
 * Ανανέωση της αποθηκευμένης προβολής ΜΕΤΑ από ήδη επιτυχημένη εγγραφή παραστατικού (routes). Δεν ρίχνει ποτέ
 * το αίτημα: το παραστατικό υπάρχει ήδη, και ένα 500 εδώ θα έφερνε επανάληψη από τον πελάτη ⇒ ΔΙΠΛΟ τιμολόγιο.
 * Σε σφάλμα: καταγραφή, το αποθηκευμένο μένει ως είχε (ΔΕΝ γράφεται «0»), και το διορθώνει η συμφωνία.
 * Ο έλεγχος πιστωτικού ορίου δεν εξαρτάται από αυτό — υπολογίζεται ζωντανά (`computeCustomerBalance`).
 */
export async function refreshCustomerBalance(repository: BalanceRepository, customerId: string): Promise<boolean> {
  try {
    await updateCustomerBalance(repository, customerId);
    return true;
  } catch (error) {
    logger.error('Customer balance refresh failed — stored balance left unchanged until reconciliation', {
      customerId,
      error: getErrorMessage(error),
    });
    return false;
  }
}

// ============================================================================
// BATCH RECONCILIATION — ΜΙΑ σάρωση, ομαδοποίηση ανά πελάτη
// ============================================================================

export interface ReconcileResult {
  readonly reconciled: number;
  readonly corrected: number;
  /** Παραστατικά χωρίς `customer.contactId` — δεν αποδίδονται σε λογαριασμό πελάτη. */
  readonly unattributedInvoices: number;
  readonly asOf: string;
}

/**
 * Επανυπολογίζει ΟΛΟΥΣ τους πελάτες από μία σάρωση των παραστατικών της εταιρείας (όχι μία ανά πελάτη).
 * Πελάτης με αποθηκευμένο υπόλοιπο αλλά χωρίς πια παραστατικά (π.χ. όλα ακυρώθηκαν) μηδενίζεται.
 */
export async function reconcileAllBalances(
  repository: BalanceRepository,
  asOf: string = accountingToday()
): Promise<ReconcileResult> {
  const [invoices, stored] = await Promise.all([
    repository.collectInvoices({ scope: { kind: 'receivables', asOf } }),
    repository.listCustomerBalances(),
  ]);
  const { byCustomer, unattributed } = groupInvoicesByCustomer(invoices);
  const storedById = new Map(stored.map((b) => [b.customerId, b]));
  const customerIds = new Set([...byCustomer.keys(), ...storedById.keys()]);

  const updates = [...customerIds].map((customerId) => {
    const before = storedById.get(customerId) ?? null;
    const position = summarizeReceivables(customerId, byCustomer.get(customerId) ?? [], asOf);
    return { customerId, before, after: mergeWithCreditSettings(position, before) };
  });
  await writeInChunks(updates, ({ customerId, after }) => repository.upsertCustomerBalance(customerId, after));
  const corrected = updates.filter(
    ({ before, after }) => before !== null && Math.abs(before.netBalance - after.netBalance) > RECONCILE_TOLERANCE
  ).length;
  return { reconciled: updates.length, corrected, unattributedInvoices: unattributed, asOf };
}

/** Παράλληλες εγγραφές με φραγμένο πλήθος — ούτε μία-μία (αργό), ούτε όλες μαζί (κατακλυσμός). */
const WRITE_CONCURRENCY = 20;

async function writeInChunks<T>(items: T[], write: (item: T) => Promise<void>): Promise<void> {
  for (const chunk of chunkArray(items, WRITE_CONCURRENCY)) await Promise.all(chunk.map(write));
}

// ============================================================================
// CREDIT LIMIT CHECK (Q3 — SAP/NetSuite pattern)
// ============================================================================

/**
 * Έλεγχος πιστωτικού ορίου πριν την έκδοση νέου τιμολογίου.
 *
 * Exposure = ανοιχτές απαιτήσεις ΟΛΩΝ των χρήσεων (SAP credit exposure), όχι της τρέχουσας χρήσης.
 * Check: exposure + newInvoiceAmount > creditLimit
 * - auto → μπλοκ (API 422) · manual → προειδοποίηση · off → κανένας έλεγχος
 *
 * Επιστρέφει δομημένο αποτέλεσμα· το κείμενο το αποδίδει ο παραλήπτης (N.11).
 */
export function checkCreditLimit(balance: CustomerBalance, newInvoiceAmount: number): CreditCheckResult {
  const exposure = balance.netBalance;
  const projectedExposure = roundToTwo(exposure + newInvoiceAmount);
  if (balance.creditLimit === null || balance.creditHoldRule === 'off') {
    return { allowed: true, exceedsLimit: false, exposure, projectedExposure, availableCredit: null };
  }
  const exceedsLimit = projectedExposure > balance.creditLimit;
  return {
    allowed: !(exceedsLimit && balance.creditHoldRule === 'auto'),
    exceedsLimit,
    exposure,
    projectedExposure,
    availableCredit: roundToTwo(balance.creditLimit - exposure),
  };
}

/** Χρειάζεται ο έλεγχος σάρωση; Μόνο αν ο πελάτης έχει ενεργό όριο — αλλιώς δεν πληρώνουμε ανάγνωση. */
export function hasActiveCreditLimit(balance: CustomerBalance | null): balance is CustomerBalance {
  return balance !== null && balance.creditLimit !== null && balance.creditHoldRule !== 'off';
}
